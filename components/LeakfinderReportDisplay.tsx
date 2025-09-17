import React, { useMemo } from 'react';
import { LeakfinderReport, PlayerExposureAnalysis } from '../types';
import CheckIcon from './icons/CheckIcon';
import WarningIcon from './icons/WarningIcon';

interface LeakfinderReportDisplayProps {
    report: LeakfinderReport;
}

const ExposureTable: React.FC<{ analysis: PlayerExposureAnalysis[] }> = ({ analysis }) => {
    const sortedAnalysis = useMemo(() => {
        return [...analysis].sort((a, b) => Math.abs(b.leverage) - Math.abs(a.leverage));
    }, [analysis]);
    
    const getLeverageColor = (leverage: number) => {
        if (leverage > 10) return 'bg-green-500/20 text-green-300'; // Significantly overweight
        if (leverage < -10) return 'bg-red-500/20 text-red-300'; // Significantly underweight
        return 'bg-gray-700/20 text-gray-400';
    };

    return (
        <div className="overflow-x-auto max-h-[60vh] relative border border-gray-700 rounded-lg">
            <table className="w-full text-sm text-left">
                <thead className="text-xs text-white font-bold uppercase bg-gray-800 sticky top-0">
                    <tr>
                        <th scope="col" className="px-4 py-3">Player</th>
                        <th scope="col" className="px-4 py-3 text-center">Your Exposure</th>
                        <th scope="col" className="px-4 py-3 text-center">Optimal Exposure</th>
                        <th scope="col" className="px-4 py-3 text-center">Leverage</th>
                    </tr>
                </thead>
                <tbody>
                    {sortedAnalysis.map((player) => (
                        <tr key={player.playerName} className="border-b border-gray-700 bg-gray-900 hover:bg-gray-800">
                            <td className="px-4 py-2 font-medium text-white">{player.playerName}</td>
                            <td className="px-4 py-2 text-center font-mono">{player.actualExposure.toFixed(1)}%</td>
                            <td className="px-4 py-2 text-center font-mono">{player.optimalExposure.toFixed(1)}%</td>
                            <td className="px-4 py-2 text-center">
                                <span className={`px-2 py-1 rounded-full font-mono text-xs ${getLeverageColor(player.leverage)}`}>
                                    {player.leverage > 0 ? '+' : ''}{player.leverage.toFixed(1)}%
                                </span>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

const LeakfinderReportDisplay: React.FC<LeakfinderReportDisplayProps> = ({ report }) => {
    const roiColor = report.overallRoi >= 0 ? 'text-green-400' : 'text-red-400';

    return (
        <div className="space-y-8 animate-fade-in">
            <h2 className="text-3xl font-bold text-center text-white">Your Leakfinder Report</h2>
            
            <div className="text-center bg-gray-800/50 p-6 rounded-lg border border-gray-700">
                <p className="text-sm uppercase tracking-wider text-gray-400">Overall Slate ROI</p>
                <p className={`text-6xl font-bold ${roiColor}`}>
                    {report.overallRoi >= 0 ? '+' : ''}{report.overallRoi.toFixed(2)}%
                </p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="bg-gray-800/50 p-6 rounded-lg border border-gray-700">
                    <h3 className="text-xl font-bold text-green-400 mb-4 flex items-center gap-2">
                        <CheckIcon />
                        What Went Right (Strengths)
                    </h3>
                    <ul className="space-y-3 list-inside">
                        {report.strengths.map((item, index) => (
                            <li key={index} className="text-gray-300 leading-relaxed">{item}</li>
                        ))}
                    </ul>
                </div>
                 <div className="bg-gray-800/50 p-6 rounded-lg border border-gray-700">
                    <h3 className="text-xl font-bold text-red-400 mb-4 flex items-center gap-2">
                        <WarningIcon />
                        Where to Improve (Leaks)
                    </h3>
                    <ul className="space-y-3 list-inside">
                        {report.leaks.map((item, index) => (
                            <li key={index} className="text-gray-300 leading-relaxed">{item}</li>
                        ))}
                    </ul>
                </div>
            </div>

            <div>
                 <h3 className="text-xl font-bold text-white mb-4">Player Exposure Analysis</h3>
                 <p className="text-sm text-gray-400 mb-4">
                    This table shows your actual exposure to key players versus the AI coach's recommended optimal GPP exposure. Leverage indicates how far over (+) or under (-) weight you were. The biggest leverage scores highlight your most significant strategic decisions on the slate.
                 </p>
                 <ExposureTable analysis={report.playerExposureAnalysis} />
            </div>

        </div>
    );
};

export default LeakfinderReportDisplay;
