import React, { useState, useMemo } from 'react';
import { Lineup, Player } from '../types';

interface LineupResultsProps {
  lineups: Lineup[] | null;
  players: Player[];
}

type Tab = 'lineups' | 'exposures';
type SortableKeys = 'totalFpts' | 'totalCeilingFpts' | 'totalSalary' | 'correlationScore' | 'roiScore' | 'leverageScore';

interface SortConfig {
  key: SortableKeys | null;
  direction: 'ascending' | 'descending';
}

const ExposureView: React.FC<{ lineups: Lineup[], players: Player[] }> = ({ lineups, players }) => {
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
                        <th className="px-4 py-2 text-center">Exposure %</th>
                        <th className="px-4 py-2 text-center">Count</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-700">
                    {sortedPlayers.map(player => {
                        const count = exposureCounts[player.id];
                        if (count === 0) return null;
                        const actualPercent = totalLineups > 0 ? (count / totalLineups) * 100 : 0;
                        return (
                            <tr key={player.id} className="bg-gray-800 hover:bg-gray-900">
                                <td className="px-4 py-2 font-medium text-white">{player.name}</td>
                                <td className="px-4 py-2 text-center">{actualPercent.toFixed(1)}%</td>
                                <td className="px-4 py-2 text-center">{count}</td>
                            </tr>
                        )
                    })}
                </tbody>
            </table>
        </div>
    );
};

const LineupsTable: React.FC<{ lineups: Lineup[] }> = ({ lineups }) => {
    const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'totalFpts', direction: 'descending' });

    const sortedLineups = useMemo(() => {
        let sortableItems = [...lineups];
        if (sortConfig.key) {
            sortableItems.sort((a, b) => {
                const aValue = a[sortConfig.key!];
                const bValue = b[sortConfig.key!];
                if (aValue < bValue) return sortConfig.direction === 'ascending' ? -1 : 1;
                if (aValue > bValue) return sortConfig.direction === 'ascending' ? 1 : -1;
                return 0;
            });
        }
        return sortableItems;
    }, [lineups, sortConfig]);

    const requestSort = (key: SortableKeys) => {
        let direction: 'ascending' | 'descending' = 'descending';
        if (sortConfig.key === key && sortConfig.direction === 'descending') {
            direction = 'ascending';
        }
        setSortConfig({ key, direction });
    };

    const getSortIndicator = (key: SortableKeys) => {
        if (sortConfig.key !== key) return null;
        return sortConfig.direction === 'descending' ? '↓' : '↑';
    };

    const getHeaderClass = (key: SortableKeys) => {
      return `px-2 py-2 text-right cursor-pointer transition-colors ${sortConfig.key === key ? 'text-white' : 'text-gray-400 hover:text-white'}`;
    }

    const getCorrelationColor = (score: number) => {
      if (score > 0.5) return 'text-green-400 font-bold';
      if (score < -0.5) return 'text-red-400 font-bold';
      return 'text-gray-300';
    }
    
    const getLeverageColor = (score: number) => {
      if (score >= 85) return 'text-green-400 font-bold';
      if (score >= 50) return 'text-yellow-400';
      return 'text-red-400';
    }

    return (
        <div className="overflow-auto max-h-[400px]">
            <table className="w-full text-sm text-left">
                <thead className="text-xs uppercase bg-gray-800 sticky top-0">
                    <tr>
                        <th className="px-2 py-2 text-center">#</th>
                        <th className="px-2 py-2">Lineup</th>
                        <th className={getHeaderClass('totalFpts')} onClick={() => requestSort('totalFpts')}>Mean {getSortIndicator('totalFpts')}</th>
                        <th className={getHeaderClass('totalCeilingFpts')} onClick={() => requestSort('totalCeilingFpts')}>Ceiling {getSortIndicator('totalCeilingFpts')}</th>
                        <th className={getHeaderClass('correlationScore')} onClick={() => requestSort('correlationScore')}>Corr. {getSortIndicator('correlationScore')}</th>
                        <th className={getHeaderClass('leverageScore')} onClick={() => requestSort('leverageScore')}>Leverage {getSortIndicator('leverageScore')}</th>
                        <th className={getHeaderClass('totalSalary')} onClick={() => requestSort('totalSalary')}>Salary {getSortIndicator('totalSalary')}</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-700">
                    {sortedLineups.map((lineup, index) => (
                        <tr key={index} className="bg-gray-800 hover:bg-gray-900">
                            <td className="px-2 py-2 text-center font-medium">{index + 1}</td>
                            <td className="px-2 py-2">
                                <div className="text-xs">
                                    <span className="font-bold text-gray-300">MVP:</span> {lineup.mvp.name}
                                </div>
                                <div className="text-xs text-gray-400 mt-1">
                                    <span className="font-bold text-gray-500">FLEX:</span> {lineup.flex.map(p => p.name).join(', ')}
                                </div>
                            </td>
                            <td className="px-2 py-2 text-right font-bold text-green-400">{lineup.totalFpts.toFixed(2)}</td>
                            <td className="px-2 py-2 text-right font-bold text-cyan-400">{lineup.totalCeilingFpts.toFixed(2)}</td>
                            <td className={`px-2 py-2 text-right ${getCorrelationColor(lineup.correlationScore)}`}>
                                {lineup.correlationScore.toFixed(2)}
                            </td>
                            <td className={`px-2 py-2 text-right ${getLeverageColor(lineup.leverageScore)}`}>
                                {lineup.leverageScore.toFixed(1)}
                            </td>
                            <td className="px-2 py-2 text-right">${lineup.totalSalary.toLocaleString()}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};


const LineupResults: React.FC<LineupResultsProps> = ({ lineups, players }) => {
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
            {activeTab === 'lineups' && <LineupsTable lineups={lineups} />}
            {activeTab === 'exposures' && <ExposureView lineups={lineups} players={players} />}
        </div>
    </div>
  );
};

export default LineupResults;