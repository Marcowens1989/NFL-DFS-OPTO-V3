import React, { useMemo } from 'react';
import { BacktestReport } from '../types';

const BacktestResultsDisplay: React.FC<{ report: BacktestReport }> = ({ report }) => {
    
    const sortedExposures = useMemo(() => {
        return Object.entries(report.playerExposures)
            .map(([name, data]) => ({ name, ...data }))
            .sort((a, b) => b.count - a.count);
    }, [report.playerExposures]);

    return (
        <div className="border-t border-gray-700 pt-6 mt-6 space-y-8 animate-fade-in">
            <h2 className="text-3xl font-bold text-center text-white">Backtest Results</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-center">
                <div className="bg-gray-800/50 p-4 rounded-lg border border-gray-700">
                    <p className="text-sm uppercase tracking-wider text-gray-400">Games Simulated</p>
                    <p className="text-4xl font-bold text-white">{report.summary.totalGames}</p>
                </div>
                <div className="bg-gray-800/50 p-4 rounded-lg border border-gray-700">
                    <p className="text-sm uppercase tracking-wider text-gray-400">Average Top Score</p>
                    <p className="text-4xl font-bold text-green-400">{report.summary.averageScore.toFixed(2)}</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div>
                    <h3 className="text-xl font-bold text-white mb-4">Per-Game Performance</h3>
                    <div className="overflow-x-auto max-h-[60vh] relative border border-gray-700 rounded-lg">
                        <table className="w-full text-sm text-left">
                            <thead className="text-xs text-white font-bold uppercase bg-gray-800 sticky top-0">
                                <tr>
                                    <th className="px-4 py-3">Game</th>
                                    <th className="px-4 py-3 text-right">Top Score Achieved</th>
                                </tr>
                            </thead>
                            <tbody>
                                {report.gameResults.map(game => (
                                    <tr key={game.gameId} className="border-b border-gray-700 bg-gray-900 hover:bg-gray-800">
                                        <td className="px-4 py-2 text-gray-300">{game.description}</td>
                                        <td className="px-4 py-2 text-right font-bold text-green-400">{game.topScore.toFixed(2)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
                <div>
                    <h3 className="text-xl font-bold text-white mb-4">Aggregate Player Exposures</h3>
                     <div className="overflow-x-auto max-h-[60vh] relative border border-gray-700 rounded-lg">
                        <table className="w-full text-sm text-left">
                            <thead className="text-xs text-white font-bold uppercase bg-gray-800 sticky top-0">
                                <tr>
                                    <th className="px-4 py-3">Player</th>
                                    <th className="px-4 py-3 text-right">Exposure %</th>
                                    <th className="px-4 py-3 text-right">Count</th>
                                </tr>
                            </thead>
                             <tbody>
                                {sortedExposures.map(player => (
                                     <tr key={player.name} className="border-b border-gray-700 bg-gray-900 hover:bg-gray-800">
                                        <td className="px-4 py-2 font-medium text-white">{player.name}</td>
                                        <td className="px-4 py-2 text-right font-mono">{player.percentage.toFixed(1)}%</td>
                                        <td className="px-4 py-2 text-right font-mono">{player.count}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default BacktestResultsDisplay;
