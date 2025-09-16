import React, { useState } from 'react';
import { ParsedHistoricalPlayer, StatWeights, OptimalLineupData } from '../types';
import { parseHistoricalData, getWinningFactorsAnalysis } from '../services/historicalDataParser';
import SpinnerIcon from './icons/SpinnerIcon';
import { MultivariateLinearRegression } from 'ml-regression';

const STAT_KEYS: (keyof StatWeights)[] = [
    'passYds', 'passTds', 'interceptions',
    'rushYds', 'rushTds', 'receptions',
    'recYds', 'recTds', 'fumblesLost'
];

const INITIAL_WEIGHTS: StatWeights = {
    passYds: 0.04,
    passTds: 4,
    interceptions: -1,
    rushYds: 0.1,
    rushTds: 6,
    receptions: 0.5,
    recYds: 0.1,
    recTds: 6,
    fumblesLost: -2,
};

const StatWeightSlider: React.FC<{
    label: string;
    stat: keyof StatWeights;
    value: number;
    min: number;
    max: number;
    step: number;
    onChange: (stat: keyof StatWeights, value: number) => void;
}> = ({ label, stat, value, min, max, step, onChange }) => (
    <div className="flex flex-col space-y-2">
        <div className="flex justify-between items-center">
            <label htmlFor={stat} className="text-sm font-medium text-gray-400">{label}</label>
            <span className="text-sm font-mono text-white bg-gray-700 px-2 py-0.5 rounded">{value.toFixed(2)}</span>
        </div>
        <input
            type="range"
            id={stat}
            name={stat}
            min={min}
            max={max}
            step={step}
            value={value}
            onChange={(e) => onChange(stat, parseFloat(e.target.value))}
            className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-red-600"
        />
    </div>
);

interface BacktestPageProps {
  onStatWeightsChange: (newWeights: StatWeights) => void;
}

const BacktestPage: React.FC<BacktestPageProps> = ({ onStatWeightsChange }) => {
    const [statsBlob, setStatsBlob] = useState('');
    const [ownershipBlob, setOwnershipBlob] = useState('');
    const [optimalsBlob, setOptimalsBlob] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [processedData, setProcessedData] = useState<ParsedHistoricalPlayer[]>([]);
    const [optimalLineups, setOptimalLineups] = useState<OptimalLineupData[]>([]);
    const [statWeights, setStatWeights] = useState<StatWeights>(INITIAL_WEIGHTS);
    const [winningFactors, setWinningFactors] = useState<string | null>(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const hasProcessedData = processedData.length > 0;

    const handleWeightChange = (stat: keyof StatWeights, value: number) => {
        setStatWeights(prev => ({ ...prev, [stat]: value }));
    };

    const handleProcessData = async () => {
        if (!statsBlob) {
            setError("Please paste historical player stats data.");
            return;
        }
        setIsLoading(true);
        setError(null);
        setProcessedData([]);
        setOptimalLineups([]);
        setWinningFactors(null);
        try {
            const { players, optimals } = await parseHistoricalData(statsBlob, ownershipBlob, optimalsBlob);
            setProcessedData(players);
            setOptimalLineups(optimals);
        } catch (e) {
            setError(e instanceof Error ? e.message : "An unknown error occurred during parsing.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleCalculateOptimalWeights = () => {
        if (processedData.length === 0) {
            setError("No processed player data to analyze.");
            return;
        }
        
        const featureData: number[][] = [];
        const targetData: number[] = [];

        processedData.forEach(player => {
            const features = STAT_KEYS.map(key => player[key as keyof ParsedHistoricalPlayer] as number || 0);
            if (player.actualFdp > 0) {
                featureData.push(features);
                targetData.push(player.actualFdp);
            }
        });

        if (featureData.length < 2) {
            setError("Not enough data points to calculate optimal weights.");
            return;
        }
        
        try {
            const regression = new MultivariateLinearRegression(featureData, targetData);
            const newWeights: Partial<StatWeights> = {};
            STAT_KEYS.forEach((key, index) => {
                newWeights[key] = regression.weights[index][0];
            });
            setStatWeights(prev => ({...prev, ...newWeights}));
            alert("Optimal stat weights have been calculated and applied to the sliders.");
        } catch(e) {
            setError(`Machine Learning Error: ${e instanceof Error ? e.message : 'Could not compute weights.'}`)
        }
    };

    const handleAnalyzeWinningFactors = async () => {
        if (processedData.length === 0) {
            setError("Please process data before analyzing winning factors.");
            return;
        }
        setIsAnalyzing(true);
        setWinningFactors(null);
        setError(null);
        try {
            const analysis = await getWinningFactorsAnalysis(processedData, optimalLineups);
            setWinningFactors(analysis);
        } catch(e) {
            setError(`AI Analysis Error: ${e instanceof Error ? e.message : 'Could not analyze slate.'}`);
        } finally {
            setIsAnalyzing(false);
        }
    }

    return (
        <div className="bg-black border border-gray-700 p-6 rounded-lg shadow-lg space-y-8">
            <div>
                <h1 className="text-3xl font-bold text-white mb-2">Projections Lab: Backtest & Refine</h1>
                <p className="text-gray-400">Reverse-engineer past slates to build a better model for the future.</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                 <div>
                    <label htmlFor="stats-blob" className="block text-lg font-medium text-gray-300 mb-2">1. Paste Player Stats</label>
                    <textarea
                        id="stats-blob"
                        rows={10}
                        value={statsBlob}
                        onChange={(e) => setStatsBlob(e.target.value)}
                        className="w-full bg-gray-800 border border-gray-600 rounded-md px-3 py-2 text-gray-300 focus:ring-2 focus:ring-gray-500 focus:outline-none font-mono text-xs"
                        placeholder="Paste text from sources like FantasyData, RotoGrinders, etc. (e.g., 'T. Kraft GB 3/5 REC, 45 YDS, 1 TD...')"
                    />
                </div>
                <div>
                    <label htmlFor="ownership-blob" className="block text-lg font-medium text-gray-300 mb-2">2. Paste Ownership (Optional)</label>
                     <textarea
                        id="ownership-blob"
                        rows={10}
                        value={ownershipBlob}
                        onChange={(e) => setOwnershipBlob(e.target.value)}
                        className="w-full bg-gray-800 border border-gray-600 rounded-md px-3 py-2 text-gray-300 focus:ring-2 focus:ring-gray-500 focus:outline-none font-mono text-xs"
                        placeholder="Paste data from a contest entry CSV or a list of players and their ownership percentages."
                    />
                </div>
                 <div>
                    <label htmlFor="optimals-blob" className="block text-lg font-medium text-gray-300 mb-2">3. Paste Contest Results (Optional)</label>
                     <textarea
                        id="optimals-blob"
                        rows={10}
                        value={optimalsBlob}
                        onChange={(e) => setOptimalsBlob(e.target.value)}
                        className="w-full bg-gray-800 border border-gray-600 rounded-md px-3 py-2 text-gray-300 focus:ring-2 focus:ring-gray-500 focus:outline-none font-mono text-xs"
                        placeholder="Paste the table of winning lineup clusters and their scores."
                    />
                </div>
            </div>

            <div className="text-center">
                 <button
                    onClick={handleProcessData}
                    disabled={isLoading}
                    className="w-1/2 flex items-center justify-center gap-2 bg-red-700 hover:bg-red-600 text-white font-bold py-3 px-4 rounded-lg transition duration-300 disabled:bg-red-800 disabled:cursor-not-allowed"
                >
                    {isLoading ? <><SpinnerIcon /> AI is Processing Data...</> : 'Process Historical Data'}
                </button>
            </div>
             
            {error && <div className="mt-4 p-3 bg-red-500/20 text-red-300 border border-red-500 rounded">{error}</div>}

            {hasProcessedData && (
                <>
                 <div className="border-t border-gray-700 pt-6">
                    <h2 className="text-2xl font-bold mb-4 text-white">Processed Slate Data</h2>
                     <div className="overflow-x-auto max-h-[60vh] relative border border-gray-700 rounded-lg">
                        <table className="w-full text-sm text-left">
                            <thead className="text-xs text-white font-bold uppercase bg-gray-800 sticky top-0">
                                <tr>
                                    <th className="px-4 py-3">Player</th>
                                    <th className="px-4 py-3 text-right">Actual FDP</th>
                                    <th className="px-4 py-3 text-right">Actual Own%</th>
                                </tr>
                            </thead>
                            <tbody>
                                {processedData.map((player) => (
                                    <tr key={player.name} className="border-b border-gray-700 bg-gray-900 hover:bg-gray-800">
                                        <td className="px-4 py-2 font-medium text-white">{player.name} ({player.team})</td>
                                        <td className="px-4 py-2 font-bold text-green-400 text-right">{player.actualFdp.toFixed(2)}</td>
                                        <td className="px-4 py-2 text-right text-gray-300">{player.actualFlexOwnership ? `${player.actualFlexOwnership.toFixed(1)}%` : 'N/A'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
                
                {optimalLineups.length > 0 && (
                  <div className="border-t border-gray-700 pt-6">
                      <h2 className="text-2xl font-bold mb-4 text-white">Top Contest Lineups</h2>
                      <div className="overflow-x-auto max-h-[60vh] relative border border-gray-700 rounded-lg">
                          <table className="w-full text-sm text-left">
                              <thead className="text-xs text-white font-bold uppercase bg-gray-800 sticky top-0">
                                  <tr>
                                      <th className="px-4 py-3">Rank</th>
                                      <th className="px-4 py-3 text-right">Score</th>
                                      <th className="px-4 py-3">Lineup Summary</th>
                                      <th className="px-4 py-3 text-right">Dupes</th>
                                  </tr>
                              </thead>
                              <tbody>
                                  {optimalLineups.map((lineup, index) => (
                                      <tr key={index} className="border-b border-gray-700 bg-gray-900 hover:bg-gray-800">
                                          <td className="px-4 py-2 font-medium text-white">{lineup.rank}</td>
                                          <td className="px-4 py-2 font-bold text-green-400 text-right">{lineup.score.toFixed(2)}</td>
                                          <td className="px-4 py-2 text-gray-300 text-xs">{lineup.lineupSummary}</td>
                                          <td className="px-4 py-2 text-right text-gray-300">{lineup.dupeCount}</td>
                                      </tr>
                                  ))}
                              </tbody>
                          </table>
                      </div>
                  </div>
                )}


                <div className="border-t border-gray-700 pt-6">
                    <h2 className="text-2xl font-bold mb-4 text-white">Projection Model</h2>
                    <div className="bg-gray-900 p-4 rounded-lg border border-gray-700 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-4">
                        <StatWeightSlider label="Passing Yards" stat="passYds" value={statWeights.passYds} min={0} max={0.1} step={0.005} onChange={handleWeightChange} />
                        <StatWeightSlider label="Passing TDs" stat="passTds" value={statWeights.passTds} min={0} max={6} step={0.25} onChange={handleWeightChange} />
                        <StatWeightSlider label="Interceptions" stat="interceptions" value={statWeights.interceptions} min={-3} max={0} step={0.25} onChange={handleWeightChange} />
                        <StatWeightSlider label="Rushing Yards" stat="rushYds" value={statWeights.rushYds} min={0} max={0.2} step={0.01} onChange={handleWeightChange} />
                        <StatWeightSlider label="Rushing TDs" stat="rushTds" value={statWeights.rushTds} min={0} max={6} step={0.25} onChange={handleWeightChange} />
                        <StatWeightSlider label="Receptions" stat="receptions" value={statWeights.receptions} min={0} max={1} step={0.1} onChange={handleWeightChange} />
                        <StatWeightSlider label="Receiving Yards" stat="recYds" value={statWeights.recYds} min={0} max={0.2} step={0.01} onChange={handleWeightChange} />
                        <StatWeightSlider label="Receiving TDs" stat="recTds" value={statWeights.recTds} min={0} max={6} step={0.25} onChange={handleWeightChange} />
                        <StatWeightSlider label="Fumbles Lost" stat="fumblesLost" value={statWeights.fumblesLost} min={-3} max={0} step={0.25} onChange={handleWeightChange} />
                    </div>
                     <div className="mt-4 flex flex-col sm:flex-row gap-4">
                         <button 
                            onClick={handleCalculateOptimalWeights} 
                            disabled={!hasProcessedData}
                            className="flex-1 bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded transition-colors disabled:bg-gray-800 disabled:cursor-not-allowed"
                         >
                           Calculate Optimal Weights (ML)
                         </button>
                         <button 
                            onClick={() => onStatWeightsChange(statWeights)}
                            disabled={!hasProcessedData}
                            className="flex-1 bg-red-700 hover:bg-red-600 text-white font-bold py-2 px-4 rounded transition-colors disabled:bg-red-900 disabled:cursor-not-allowed"
                          >
                           Apply Weights to Optimizer
                         </button>
                    </div>
                </div>
                
                 <div className="border-t border-gray-700 pt-6">
                    <h2 className="text-2xl font-bold mb-4 text-white">AI Winning Factors Analysis</h2>
                    {!winningFactors && !isAnalyzing && (
                         <button 
                            onClick={handleAnalyzeWinningFactors} 
                            disabled={!hasProcessedData}
                            className="w-full bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded transition-colors disabled:bg-gray-800 disabled:cursor-not-allowed"
                         >
                           Analyze Winning Factors (AI)
                         </button>
                    )}
                    {isAnalyzing && <div className="flex items-center justify-center gap-2"><SpinnerIcon /> AI is analyzing the slate DNA...</div>}
                    {winningFactors && (
                        <div className="bg-gray-800/50 p-4 rounded-lg border border-gray-700 whitespace-pre-wrap text-sm leading-relaxed">
                            {winningFactors}
                        </div>
                    )}
                </div>
                </>
            )}
        </div>
    );
};

export default BacktestPage;