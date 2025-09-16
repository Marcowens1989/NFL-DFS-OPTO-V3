

import React, { useState, useCallback, useMemo } from 'react';
import { Player, Lineup, PlayerStatus, StackingRules } from '../types';
import { generateMultipleLineups } from '../services/optimizer';
import FileUpload from './FileUpload';
import PlayerTable from './PlayerTable';
import LineupResults from './OptimalLineup';
import SpinnerIcon from './icons/SpinnerIcon';
import PlayerDetailModal from './PlayerDetailModal';
import AIAnalysis from './AIAnalysis';
import { GoogleGenAI } from "@google/genai";
import StackingRulesEditor from './StackingRulesEditor';
import { strategyPresets } from '../services/strategyPresets';

const SALARY_CAP = 60000;
const INITIAL_STACKING_RULES: StackingRules = {
  stackQbWithReceiver: false,
  forceOpponentBringBack: false,
  maxFromPosition: {
    'K': 1,
    'D': 1,
  },
};

// FIX: Added UploadData interface to match the data structure from FileUpload.
interface UploadData {
  players: Player[];
  statuses: Record<string, PlayerStatus>;
  validationReport: string;
}

function OptimizerPage() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [playerStatuses, setPlayerStatuses] = useState<Record<string, PlayerStatus>>({});
  const [playerExposures, setPlayerExposures] = useState<Record<string, number>>({});
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
  // FIX: Added state to store the AI validation report from the file upload.
  const [aiValidationReport, setAiValidationReport] = useState<string | null>(null);

  const playerRanks = useMemo(() => {
    const ranks = new Map<string, number>();
    if (players.length === 0) return ranks;

    const sortedByFpts = [...players].sort((a, b) => b.fpts - a.fpts);
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
  }, [players]);

  // FIX: Updated handleFileUpload to accept UploadData object and correctly set state. This resolves the type error.
  const handleFileUpload = useCallback((data: UploadData) => {
    setPlayers(data.players);
    setPlayerStatuses(data.statuses);
    setAiValidationReport(data.validationReport);

    const initialExposures: Record<string, number> = {};
    data.players.forEach(p => {
      initialExposures[p.id] = 100;
    });
    setPlayerExposures(initialExposures);
    setOptimalLineups(null);
    setError(null);
    setSelectedPlayer(null);
    setAiAnalysis(null);
    setRecommendedStrategy(null);
  }, []);

  const handleStatusChange = useCallback((playerId: string, newStatus: PlayerStatus) => {
    setPlayerStatuses(prev => ({
      ...prev,
      [playerId]: newStatus,
    }));
  }, []);

  const handleExposureChange = useCallback((playerId: string, exposure: number) => {
    const clampedExposure = Math.max(0, Math.min(100, isNaN(exposure) ? 0 : exposure));
    setPlayerExposures(prev => ({
        ...prev,
        [playerId]: clampedExposure,
    }));
  }, []);
  
  const handlePlayerSelect = useCallback((player: Player) => {
    setSelectedPlayer(player);
  }, []);

  const handleCloseModal = useCallback(() => {
    setSelectedPlayer(null);
  }, []);

  const handleAnalyzeSlate = useCallback(async () => {
    if (!players || players.length === 0) return;

    setIsAnalyzing(true);
    setError(null);
    setAiAnalysis(null);
    setRecommendedStrategy(null);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
      
       const topPlayers = players
        .slice()
        .sort((a, b) => b.salary - a.salary)
        .slice(0, 20);

      const playerDataSummary = topPlayers.map(p =>
        `- ${p.name} (${p.position}, ${p.team}): Salary $${p.salary}, FPPG ${p.fpts.toFixed(2)}, Own% ${p.flexOwnership.toFixed(1)}% (FLEX) ${p.mvpOwnership.toFixed(1)}% (MVP)${p.injuryStatus ? `, Status: ${p.injuryStatus}` : ''}`
      ).join('\n');
      
      const strategyDescriptions = strategyPresets.map(s => `- **${s.name}:** ${s.description}`).join('\n');

      const prompt = `
        You are a world-class DFS analyst specializing in GPP (Guaranteed Prize Pool) tournament strategy for a FanDuel NFL Showdown slate.
        Your analysis must be sharp, concise, and actionable for building winning fantasy lineups. Ownership projections are key to GPP success.

        Based on the following player data (including ownership projections), provide a strategic overview for the game.

        **Player Data:**
        ${playerDataSummary}

        **Your Task:**
        Generate a report with the following FIVE sections. Use the exact headings below, separated by a newline. Do not add any other commentary.

        ### Chalk Report
        Identify 2-3 players who are likely to be the highest-owned (chalk). Explain why based on their talent, projections, and role. Mention both their MVP and FLEX popularity.

        ### Pivot Plays & Leverage
        This is the most critical section for GPP success. Your goal is to identify smart, calculated risks. For two separate popular (chalk) players you identified in the Chalk Report:
        1.  **The Chalk Play:** Name the high-owned player and their projected ownership.
        2.  **The Pivot Play:** Name a specific, lower-owned player in a similar salary range or position who has a comparable ceiling.
        3.  **The Rationale:** Explain *why* this pivot is viable. What is the pivot's path to a slate-winning score? How could the chalk player fail? This should be a direct comparison of upside and downside.
        4.  **The Leverage Gained:** Quantify the ownership advantage clearly. For example: "Pivoting from Tyreek Hill (45% FLEX) to Jaylen Waddle (18% FLEX) creates direct leverage on 27% of the field."

        ### GPP Dart Throw
        Identify one player with less than 5% projected ownership who has a plausible, albeit low-probability, path to being in the optimal lineup. Explain the contrarian game script that would need to happen for this player to succeed.

        ### Strategic Summary
        Provide a brief, high-level narrative for the slate. Suggest 1-2 potential game scripts (e.g., "Bills dominate in a blowout," "High-scoring shootout") and how a user might build lineups to correlate with those scripts, incorporating the pivot and dart throw plays you identified.

        ### Recommended Strategy
        Based on your analysis of the matchup and player data, which of the following GPP strategies is the single best fit for this slate? You must choose one. Respond with ONLY the name of the strategy (e.g., "Shootout").
        ${strategyDescriptions}
      `;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
      });
      
      const responseText = response.text;
      const [analysisPart, strategyPart] = responseText.split('### Recommended Strategy');
      setAiAnalysis(analysisPart);

      if (strategyPart) {
        const cleanedStrategyPart = strategyPart.trim().toLowerCase();
        const foundStrategy = strategyPresets.find(s => cleanedStrategyPart.includes(s.name.toLowerCase()));
        if (foundStrategy) {
          setRecommendedStrategy(foundStrategy.name);
        }
      }

    } catch (e) {
      setError(e instanceof Error ? `AI Analysis Error: ${e.message}` : "An unknown error occurred during AI analysis.");
      setAiAnalysis(null);
    } finally {
      setIsAnalyzing(false);
    }
  }, [players]);

  const handleOptimize = useCallback(async () => {
    setIsLoading(true);
    setOptimalLineups(null);
    setError(null);

    await new Promise(res => setTimeout(res, 50)); 
    
    try {
      const { includedPlayers, lockedPlayers, excludedIds } = Object.entries(playerStatuses).reduce(
        (acc, [id, status]) => {
          const player = players.find(p => p.id === id);
          if (!player) return acc;

          if (status === PlayerStatus.LOCKED) {
            acc.lockedPlayers.push(player);
          } else if (status === PlayerStatus.EXCLUDED) {
            acc.excludedIds.add(id);
          } else {
            acc.includedPlayers.push(player);
          }
          return acc;
        },
        { includedPlayers: [] as Player[], lockedPlayers: [] as Player[], excludedIds: new Set<string>() }
      );

      const lineups = generateMultipleLineups(
        includedPlayers, 
        lockedPlayers, 
        excludedIds, 
        playerExposures,
        numberOfLineups,
        salaryCap,
        stackingRules,
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
  }, [players, playerStatuses, salaryCap, playerExposures, numberOfLineups, stackingRules]);
  
  const hasPlayers = players.length > 0;

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-black border border-gray-700 p-6 rounded-lg shadow-lg">
          <h2 className="text-2xl font-bold mb-4 text-white">1. Load Players</h2>
          <FileUpload onFileUpload={handleFileUpload} onError={setError} />
          
          {/* FIX: Added rendering for the AI validation report. */}
          {aiValidationReport && (
              <div className="mt-4 p-3 bg-blue-500/10 text-blue-300 border border-blue-500 rounded">
                  <h3 className="font-bold text-md mb-2">AI Validation Report</h3>
                  <p className="text-sm whitespace-pre-wrap">{aiValidationReport}</p>
              </div>
          )}

          <AIAnalysis 
              hasPlayers={hasPlayers}
              analysis={aiAnalysis}
              isLoading={isAnalyzing}
              onAnalyze={handleAnalyzeSlate}
          />

          {error && <div className="mt-4 p-3 bg-red-500/20 text-red-300 border border-red-500 rounded">{error}</div>}
          
          {hasPlayers && (
            <div className="mt-6">
              <h2 className="text-2xl font-bold mb-4 text-white">2. Manage Roster & Exposures</h2>
              <PlayerTable 
                players={players} 
                statuses={playerStatuses} 
                exposures={playerExposures}
                playerRanks={playerRanks}
                onStatusChange={handleStatusChange} 
                onExposureChange={handleExposureChange}
                onPlayerSelect={handlePlayerSelect}
              />
            </div>
          )}
        </div>
        
        <div className="bg-black border border-gray-700 p-6 rounded-lg shadow-lg flex flex-col">
          <h2 className="text-2xl font-bold mb-4 text-white">3. Generation Settings</h2>
           <div className="mb-4">
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
          
          <button
            onClick={handleOptimize}
            disabled={!hasPlayers || isLoading}
            className="w-full flex items-center justify-center bg-gray-700 hover:bg-gray-600 text-white font-bold py-3 px-4 rounded-lg transition duration-300 disabled:bg-gray-600 disabled:cursor-not-allowed mt-6"
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
          <div className="mt-6 flex-grow">
            <LineupResults lineups={optimalLineups} players={players} exposures={playerExposures} />
          </div>
        </div>
      </div>
      <PlayerDetailModal 
        player={selectedPlayer}
        playerRank={selectedPlayer ? playerRanks.get(selectedPlayer.id) : undefined}
        onClose={handleCloseModal}
      />
    </>
  );
}

export default OptimizerPage;