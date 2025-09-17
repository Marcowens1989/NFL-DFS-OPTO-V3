import React, { useState, useCallback, useMemo } from 'react';
import { Player, Lineup, PlayerStatus, StackingRules, StatWeights, OptimizerSettings, TunedModel, BacktestReport } from '../types';
import { OptimizationTarget } from '../services/optimizer';
import FileUpload from './FileUpload';
import PlayerTable from './PlayerTable';
import ResultsHub from './ResultsHub';
import SpinnerIcon from './icons/SpinnerIcon';
import PlayerDetailModal from './PlayerDetailModal';
import AIAnalysis from './AIAnalysis';
import StackingRulesEditor from './StackingRulesEditor';
import { strategyPresets } from '../services/strategyPresets';
import { UploadData, getPlayerDnaReport } from '../services/dataManager';
import { generateContent } from '../services/aiModelService';
import ShowdownCommandCenter from './ShowdownCommandCenter';
import OptimizationTargetSelector from './OptimizationTargetSelector';
import SlateStructureAnalysis from './SlateStructureAnalysis';
import { calculateFptsFromProjections } from '../services/projectionService';
import ModelSelector from './ModelSelector';
import { generateLineupsInWorker } from '../services/workerClient';


const SALARY_CAP = 60000;
const INITIAL_STACKING_RULES: StackingRules = {
  stackQbWithReceiver: false,
  forceOpponentBringBack: false,
  maxFromPosition: {
    'K': 1,
    'D': 1,
  },
};

interface OptimizerPageProps {
  players: Player[];
  statWeights: StatWeights;
  onPlayersUpdate: (players: Player[]) => void;
  onRunBacktest: (settings: OptimizerSettings) => void;
  savedModels: TunedModel[];
  activeModelId: string | null;
  onApplyModel: (model: TunedModel) => void;
  backtestReport: BacktestReport | null;
}

function OptimizerPage({ players, statWeights, onPlayersUpdate, onRunBacktest, savedModels, activeModelId, onApplyModel, backtestReport }: OptimizerPageProps) {
  const [playerStatuses, setPlayerStatuses] = useState<Record<string, PlayerStatus>>({});
  const [optimalLineups, setOptimalLineups] = useState<Lineup[] | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [salaryCap, setSalaryCap] = useState<number>(SALARY_CAP);
  const [numberOfLineups, setNumberOfLineups] = useState<number>(20);
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [stackingRules, setStackingRules] = useState<StackingRules>(INITIAL_STACKING_RULES);
  const [recommendedStrategy, setRecommendedStrategy] = useState<string | null>(null);
  const [aiValidationReport, setAiValidationReport] = useState<string | null>(null);
  const [optimizationTarget, setOptimizationTarget] = useState<OptimizationTarget>('mean');
  const [slateNotes, setSlateNotes] = useState<string | null>(null);
  const [recommendedModelId, setRecommendedModelId] = useState<string | null>(null);


  // FIX: Replaced a faulty useEffect with useMemo. This is the correct, idiomatic React way
  // to derive state. It ensures projections are always perfectly synchronized with the
  // active model and source player data, eliminating race conditions and infinite loops.
  const projectedPlayers = useMemo(() => {
    if (!players || players.length === 0) {
      return [];
    }
    return players.map(p => ({
      ...p,
      fpts: calculateFptsFromProjections(p.statProjections?.mean, statWeights),
      scenarioFpts: {
        ...p.scenarioFpts,
        ceiling: calculateFptsFromProjections(p.statProjections?.ceiling, statWeights),
      }
    }));
  }, [players, statWeights]);


  const playerRanks = useMemo(() => {
    const ranks = new Map<string, number>();
    if (projectedPlayers.length === 0) return ranks;

    const sortedByFpts = [...projectedPlayers].sort((a, b) => b.fpts - a.fpts);
    let rank = 0;
    let lastFpts = -1;
    sortedByFpts.forEach((player, index) => {
      if (player.fpts !== lastFpts) {
        rank = index + 1;
        lastFpts = player.fpts;
      }
      ranks.set(player.id, rank);
    });
    return ranks;
  }, [projectedPlayers]);
  
  const onComplete = useCallback((data: UploadData) => {
    onPlayersUpdate(data.players);
    setPlayerStatuses(data.statuses);
    setAiValidationReport(data.validationReport);
    setSlateNotes(data.slateNotes);

    setOptimalLineups(null);
    setError(null);
    setSelectedPlayer(null);
    setAiAnalysis(null);
    setRecommendedStrategy(null);
    setRecommendedModelId(null);
  }, [onPlayersUpdate]);

  const handleStatusChange = useCallback((playerId: string, newStatus: PlayerStatus) => {
    setPlayerStatuses(prev => ({
      ...prev,
      [playerId]: newStatus,
    }));
  }, []);
  
  const handlePlayerSelect = useCallback((player: Player) => {
    setSelectedPlayer(player);
  }, []);

  const handleCloseModal = useCallback(() => {
    setSelectedPlayer(null);
  }, []);
  
  const handleGenerateDnaReport = useCallback(async (playerId: string) => {
    const playerToUpdate = players.find(p => p.id === playerId);
    if (!playerToUpdate) return;

    try {
        const report = await getPlayerDnaReport(playerToUpdate);
        
        const updatedPlayers = players.map(p => 
            p.id === playerId ? { ...p, playerDnaReport: report } : p
        );
        onPlayersUpdate(updatedPlayers);
        
        setSelectedPlayer(prev => 
            prev && prev.id === playerId ? { ...prev, playerDnaReport: report } : prev
        );
    } catch (e) {
        const errorMessage = e instanceof Error ? e.message : "An unknown error occurred.";
        setError(`DNA Report Error: ${errorMessage}`);
        const updatedPlayers = players.map(p => 
            p.id === playerId ? { ...p, playerDnaReport: `Error: ${errorMessage}` } : p
        );
        onPlayersUpdate(updatedPlayers);

        setSelectedPlayer(prev => 
            prev && prev.id === playerId ? { ...prev, playerDnaReport: `Error: ${errorMessage}` } : prev
        );
    }
  }, [players, onPlayersUpdate]);


  const handleAnalyzeSlate = useCallback(async () => {
    if (!projectedPlayers || projectedPlayers.length === 0) return;

    setIsAnalyzing(true);
    setError(null);
    setAiAnalysis(null);
    setRecommendedStrategy(null);
    setRecommendedModelId(null);

    try {
       const topPlayers = projectedPlayers
        .slice()
        .sort((a, b) => b.salary - a.salary)
        .slice(0, 20);

      const playerDataSummary = topPlayers.map(p =>
        `- ${p.name} (${p.position}, ${p.team}): Salary $${p.salary}, FPPG ${p.fpts.toFixed(2)}, Own% ${p.flexOwnership.toFixed(1)}% (FLEX) ${p.mvpOwnership.toFixed(1)}% (MVP)${p.injuryStatus ? `, Status: ${p.injuryStatus}` : ''}`
      ).join('\n');
      
      const strategyDescriptions = strategyPresets.map(s => `- **${s.name}:** ${s.description}`).join('\n');
      const modelDescriptions = savedModels.map(m => `- **${m.name}**: ${m.sourceDescription}`).join('\n');

      const injuryReport = projectedPlayers
        .filter(p => playerStatuses[p.id] === PlayerStatus.EXCLUDED && (p.injuryStatus?.toUpperCase() === 'O' || p.injuryStatus?.toUpperCase() === 'OUT' || p.injuryStatus?.toUpperCase() === 'IR'))
        .map(p => `- ${p.name} (${p.position}, ${p.team}) is confirmed OUT.`)
        .join('\n');

      const prompt = `
        You are a world-class DFS analyst specializing in GPP (Guaranteed Prize Pool) tournament strategy for a FanDuel NFL Showdown slate.
        Your analysis must be sharp, concise, and actionable.

        **Injury Report:**
        ${injuryReport || "No key players are confirmed out."}
        
        **Player Data:**
        ${playerDataSummary}
        
        **Available Projection Models:**
        ${modelDescriptions || "No specific models provided."}

        **Your Task:**
        Generate a report with the usual five sections (Chalk Report, Pivots, Dart Throw, Summary).
        After that, add two recommendation sections separated by '|||'.

        ### Recommended Strategy
        Based on your analysis, which GPP strategy is the single best fit? Respond with ONLY the name of the strategy (e.g., "Shootout").
        ${strategyDescriptions}

        |||MODEL_RECOMMENDATION|||

        ### Recommended Projection Model
        Based on the matchup, which of the saved projection models is the single best fit? Respond with ONLY the name of the model.
      `;

      const responseText = await generateContent(prompt);
      
      if (!responseText) {
          throw new Error("Received an empty or invalid response from the AI. It may have been blocked due to safety settings.");
      }
      
      const [analysisPart, recommendationsPart] = responseText.split('### Recommended Strategy');
      const [strategyPart, modelPart] = (recommendationsPart || '').split('|||MODEL_RECOMMENDATION|||');

      setAiAnalysis(analysisPart);

      if (strategyPart) {
        const cleanedStrategyPart = strategyPart.trim().toLowerCase();
        const foundStrategy = strategyPresets.find(s => cleanedStrategyPart.includes(s.name.toLowerCase()));
        if (foundStrategy) {
          setRecommendedStrategy(foundStrategy.name);
          setStackingRules(foundStrategy.rules); // Automatically apply the recommended rules
        }
      }
      
      if (modelPart) {
          const modelName = modelPart.replace('### Recommended Projection Model', '').trim();
          const foundModel = savedModels.find(m => m.name === modelName);
          if (foundModel) {
              setRecommendedModelId(foundModel.id);
              onApplyModel(foundModel); // Automatically apply the recommended model
          }
      }

    } catch (e) {
      setError(e instanceof Error ? `AI Analysis Error: ${e.message}` : "An unknown error occurred during AI analysis.");
      setAiAnalysis(null);
    } finally {
      setIsAnalyzing(false);
    }
  }, [projectedPlayers, playerStatuses, savedModels, onApplyModel]);

  const handleOptimize = useCallback(async () => {
    setIsLoading(true);
    setOptimalLineups(null);
    setError(null);
    
    try {
      const { lockedPlayers, excludedIds } = Object.entries(playerStatuses).reduce(
        (acc, [id, status]) => {
          if (status === PlayerStatus.LOCKED) {
            const player = projectedPlayers.find(p => p.id === id);
            if(player) acc.lockedPlayers.push(player);
          } else if (status === PlayerStatus.EXCLUDED) {
            acc.excludedIds.add(id);
          }
          return acc;
        },
        { lockedPlayers: [] as Player[], excludedIds: new Set<string>() }
      );
      
      // Use the worker to generate lineups off the main thread
      const lineups = await generateLineupsInWorker(
        projectedPlayers, 
        lockedPlayers, 
        excludedIds, 
        numberOfLineups,
        salaryCap,
        stackingRules,
        optimizationTarget
      );
      
      if (lineups && lineups.length > 0) {
        setOptimalLineups(lineups);
        if (lineups.length < numberOfLineups) {
          setError(`Warning: Only able to generate ${lineups.length} of ${numberOfLineups} requested lineups with the current rules. Try relaxing constraints.`);
        }
      } else {
        setError("Could not generate any valid lineups with the given constraints. Try adjusting locked/excluded players, exposures, stacking rules, or the salary cap.");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "An unknown error occurred during optimization.");
    } finally {
      setIsLoading(false);
    }
  }, [projectedPlayers, playerStatuses, salaryCap, numberOfLineups, stackingRules, optimizationTarget]);

  const handleRunBacktestClick = useCallback(() => {
    const lockedPlayerIds = Object.entries(playerStatuses)
        .filter(([, status]) => status === PlayerStatus.LOCKED)
        .map(([id]) => id);

    const excludedPlayerIds = Object.entries(playerStatuses)
        .filter(([, status]) => status === PlayerStatus.EXCLUDED)
        .map(([id]) => id);

    const settings: OptimizerSettings = {
        lockedPlayerIds,
        excludedPlayerIds,
        numberOfLineups,
        salaryCap,
        stackingRules,
        optimizationTarget,
    };
    onRunBacktest(settings);
  }, [playerStatuses, numberOfLineups, salaryCap, stackingRules, optimizationTarget, onRunBacktest]);
  
  const hasPlayers = projectedPlayers.length > 0;

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-black border border-gray-700 p-6 rounded-lg shadow-lg">
          <h2 className="text-2xl font-bold mb-4 text-white">1. Load Players & Slate Data</h2>
          <FileUpload onComplete={onComplete} onError={setError} />
          
          {aiValidationReport && (
              <div className="mt-4 p-3 bg-blue-500/10 text-blue-300 border border-blue-500 rounded">
                  <h3 className="font-bold text-md mb-2">Data Validation Report</h3>
                  <p className="text-sm whitespace-pre-wrap">{aiValidationReport}</p>
              </div>
          )}

          {hasPlayers && <ShowdownCommandCenter players={projectedPlayers} />}
          
          {hasPlayers && <SlateStructureAnalysis notes={slateNotes} />}
          
           {hasPlayers &&
             <ModelSelector
                models={savedModels}
                activeModelId={activeModelId}
                recommendedModelId={recommendedModelId}
                onApplyModel={onApplyModel}
             />
           }

          <AIAnalysis 
              hasPlayers={hasPlayers}
              analysis={aiAnalysis}
              isLoading={isAnalyzing}
              onAnalyze={handleAnalyzeSlate}
          />

          {error && <div className="mt-4 p-3 bg-red-500/20 text-red-300 border border-red-500 rounded">{error}</div>}
          
          {hasPlayers && (
            <div className="mt-6">
              <h2 className="text-2xl font-bold mb-4 text-white">3. Manage Roster</h2>
              <PlayerTable 
                players={projectedPlayers} 
                statuses={playerStatuses} 
                playerRanks={playerRanks}
                onStatusChange={handleStatusChange} 
                onPlayerSelect={handlePlayerSelect}
              />
            </div>
          )}
        </div>
        
        <div className="bg-black border border-gray-700 p-6 rounded-lg shadow-lg flex flex-col">
          <h2 className="text-2xl font-bold mb-4 text-white">4. Generation Settings</h2>
          <OptimizationTargetSelector
              selected={optimizationTarget}
              onSelect={setOptimizationTarget}
          />
           <div className="my-4">
              <label htmlFor="salary-cap" className="block text-sm font-medium text-gray-400 mb-2">Salary Cap</label>
              <input
                  type="number"
                  id="salary-cap"
                  value={salaryCap}
                  onChange={(e) => setSalaryCap(Number(e.target.value))}
                  className="w-full bg-gray-800 border border-gray-600 rounded-md px-3 py-2 text-white focus:ring-2 focus:ring-gray-500 focus:outline-none"
              />
          </div>
          <div className="mb-6">
              <label htmlFor="num-lineups" className="block text-sm font-medium text-gray-400 mb-2">Number of Lineups</label>
              <input
                  type="number"
                  id="num-lineups"
                  value={numberOfLineups}
                  onChange={(e) => setNumberOfLineups(Math.max(1, Number(e.target.value)))}
                  className="w-full bg-gray-800 border border-gray-600 rounded-md px-3 py-2 text-white focus:ring-2 focus:ring-gray-500 focus:outline-none"
              />
          </div>

          <StackingRulesEditor 
              rules={stackingRules} 
              onRulesChange={setStackingRules}
              recommendedStrategy={recommendedStrategy} 
          />
          
          <div className="mt-auto pt-6 space-y-4">
            <button
              onClick={handleOptimize}
              disabled={!hasPlayers || isLoading}
              className="w-full flex items-center justify-center bg-gray-700 hover:bg-gray-600 text-white font-bold py-3 px-4 rounded-lg transition duration-300 disabled:bg-gray-600 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <>
                  <SpinnerIcon />
                  Generating...
                </>
              ) : (
                'Generate Optimal Lineups'
              )}
            </button>
            <button
              onClick={handleRunBacktestClick}
              disabled={!hasPlayers || isLoading}
              className="w-full flex items-center justify-center gap-2 bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-3 px-4 rounded-lg transition duration-300 disabled:bg-cyan-800 disabled:cursor-not-allowed"
            >
               🚀 Run Backtest on Historical Data
            </button>
          </div>
          <div className="mt-6 flex-grow">
            <ResultsHub lineups={optimalLineups} players={projectedPlayers} backtestReport={backtestReport} />
          </div>
        </div>
      </div>
      <PlayerDetailModal 
        player={selectedPlayer}
        playerRank={selectedPlayer ? playerRanks.get(selectedPlayer.id) : undefined}
        allPlayers={projectedPlayers}
        onClose={handleCloseModal}
        onGenerateDnaReport={handleGenerateDnaReport}
      />
    </>
  );
}

export default OptimizerPage;