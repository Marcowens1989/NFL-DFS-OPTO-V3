import React, { useState, useMemo } from 'react';
import { Lineup, Player } from '../types';

interface LineupResultsProps {
  lineups: Lineup[] | null;
  players: Player[];
  exposures: Record<string, number>;
}

type Tab = 'lineups' | 'exposures';

const LineupCard: React.FC<{ lineup: Lineup, index: number }> = ({ lineup, index }) => (
    <div className="bg-gray-800 p-3 rounded-lg">
        <div className="flex justify-between items-center mb-2">
            <h4 className="font-bold text-white">Lineup #{index + 1}</h4>
            <div className="text-right">
                <p className="font-bold text-green-400">{lineup.totalFpts.toFixed(2)} <span className="text-xs font-normal text-gray-400">FPTS</span></p>
                <p className="text-sm text-gray-400">${lineup.totalSalary.toLocaleString()}</p>
            </div>
        </div>
        <div className="text-sm space-y-1">
            <div className="flex items-center">
                <span className="flex-shrink-0 font-bold text-gray-200 text-xs w-12 text-center mr-2 py-0.5 bg-gray-500/20 rounded-full">MVP</span>
                <span>{lineup.mvp.name} <span className="text-gray-400">({lineup.mvp.position})</span></span>
            </div>
            {lineup.flex.map((p) => (
                <div key={p.id} className="flex items-center">
                    <span className="flex-shrink-0 font-bold text-gray-400 text-xs w-12 text-center mr-2 py-0.5 bg-gray-500/20 rounded-full">FLEX</span>
                    <span>{p.name} <span className="text-gray-400">({p.position})</span></span>
                </div>
            ))}
        </div>
    </div>
);

const ExposureView: React.FC<{ lineups: Lineup[], players: Player[], exposures: Record<string, number> }> = ({ lineups, players, exposures }) => {
    const exposureCounts = useMemo(() => {
        const counts: Record<string, number> = {};
        players.forEach(p => counts[p.id] = 0);
        
        lineups.forEach(lineup => {
            counts[lineup.mvp.id]++;
            lineup.flex.forEach(player => {
                counts[player.id]++;
            });
        });
        return counts;
    }, [lineups, players]);

    const sortedPlayers = useMemo(() => {
        return [...players].sort((a, b) => (exposureCounts[b.id] - exposureCounts[a.id]));
    }, [players, exposureCounts]);

    const totalLineups = lineups.length;

    return (
        <div className="overflow-auto max-h-[400px]">
            <table className="w-full text-sm text-left">
                <thead className="text-xs text-gray-400 uppercase bg-gray-800 sticky top-0">
                    <tr>
                        <th className="px-4 py-2">Player</th>
                        <th className="px-4 py-2 text-center">Actual %</th>
                        <th className="px-4 py-2 text-center">Max %</th>
                        <th className="px-4 py-2 text-center">Count</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-700">
                    {sortedPlayers.map(player => {
                        const count = exposureCounts[player.id];
                        if (count === 0) return null;
                        const actualPercent = totalLineups > 0 ? (count / totalLineups) * 100 : 0;
                        const maxPercent = exposures[player.id] || 100;
                        return (
                            <tr key={player.id} className="bg-gray-800">
                                <td className="px-4 py-2 font-medium text-white">{player.name}</td>
                                <td className="px-4 py-2 text-center">{actualPercent.toFixed(1)}%</td>
                                <td className="px-4 py-2 text-center">{maxPercent}%</td>
                                <td className="px-4 py-2 text-center">{count}</td>
                            </tr>
                        )
                    })}
                </tbody>
            </table>
        </div>
    );
};


const LineupResults: React.FC<LineupResultsProps> = ({ lineups, players, exposures }) => {
  const [activeTab, setActiveTab] = useState<Tab>('lineups');

  if (!lineups) {
    return (
      <div className="flex items-center justify-center h-full border-2 border-dashed border-gray-700 rounded-lg">
        <p className="text-gray-500">Your optimal lineups will appear here</p>
      </div>
    );
  }
  
  if (lineups.length === 0) {
     return (
      <div className="flex items-center justify-center h-full border-2 border-dashed border-gray-700 rounded-lg">
        <p className="text-gray-500 text-center">No lineups could be generated with the current settings.</p>
      </div>
    );
  }

  return (
    <div className="bg-gray-900 border border-gray-700 p-4 rounded-lg h-full flex flex-col">
        <div className="flex justify-between items-baseline mb-4 pb-2 border-b-2 border-gray-500">
            <h3 className="text-xl font-bold text-white">Generated Results</h3>
            <p className="text-sm text-gray-400">{lineups.length} Lineups</p>
        </div>
        
        <div className="flex border-b border-gray-700 mb-4">
            <button onClick={() => setActiveTab('lineups')} className={`px-4 py-2 text-sm font-medium transition-colors ${activeTab === 'lineups' ? 'border-b-2 border-gray-500 text-white' : 'text-gray-400 hover:text-white'}`}>
                Lineups
            </button>
            <button onClick={() => setActiveTab('exposures')} className={`px-4 py-2 text-sm font-medium transition-colors ${activeTab === 'exposures' ? 'border-b-2 border-gray-500 text-white' : 'text-gray-400 hover:text-white'}`}>
                Exposures
            </button>
        </div>

        <div className="flex-grow overflow-hidden">
            {activeTab === 'lineups' && (
                <div className="space-y-2 overflow-y-auto max-h-[400px] pr-2">
                    {lineups.map((lineup, index) => (
                        <LineupCard key={index} lineup={lineup} index={index} />
                    ))}
                </div>
            )}
            {activeTab === 'exposures' && (
                <ExposureView lineups={lineups} players={players} exposures={exposures} />
            )}
        </div>
    </div>
  );
};

export default LineupResults;