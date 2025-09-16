import React, { useState, useMemo } from 'react';
import { Player, PlayerStatus } from '../types';
import LockIcon from './icons/LockIcon';
import UnlockIcon from './icons/UnlockIcon';
import ExcludeIcon from './icons/ExcludeIcon';
import IncludeIcon from './icons/IncludeIcon';
import FlameIcon from './icons/FlameIcon';

interface PlayerTableProps {
  players: Player[];
  statuses: Record<string, PlayerStatus>;
  exposures: Record<string, number>;
  playerRanks: Map<string, number>;
  onStatusChange: (playerId: string, newStatus: PlayerStatus) => void;
  onExposureChange: (playerId: string, exposure: number) => void;
  onPlayerSelect: (player: Player) => void;
}

type SortableKeys = 'fpts' | 'salary' | 'flexOwnership' | 'mvpOwnership' | 'value';

interface SortConfig {
  key: SortableKeys | null;
  direction: 'ascending' | 'descending';
}

const PlayerTable: React.FC<PlayerTableProps> = ({ players, statuses, exposures, playerRanks, onStatusChange, onExposureChange, onPlayerSelect }) => {
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'fpts', direction: 'descending' });

  const sortedPlayers = useMemo(() => {
    let sortableItems = [...players];
    if (sortConfig.key) {
      sortableItems.sort((a, b) => {
        let aValue, bValue;

        if (sortConfig.key === 'value') {
          aValue = a.salary > 0 ? a.fpts / (a.salary / 1000) : 0;
          bValue = b.salary > 0 ? b.fpts / (b.salary / 1000) : 0;
        } else {
          aValue = a[sortConfig.key];
          bValue = b[sortConfig.key];
        }
        
        if (aValue < bValue) {
          return sortConfig.direction === 'ascending' ? -1 : 1;
        }
        if (aValue > bValue) {
          return sortConfig.direction === 'ascending' ? 1 : -1;
        }
        return 0;
      });
    }
    return sortableItems;
  }, [players, sortConfig]);

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
      return `px-4 py-3 text-right cursor-pointer transition-colors ${sortConfig.key === key ? 'text-white' : 'text-gray-400 hover:text-white'}`;
  }

  const getRowClass = (status: PlayerStatus) => {
    switch (status) {
      case PlayerStatus.LOCKED:
        return 'bg-green-500/10';
      case PlayerStatus.EXCLUDED:
        return 'bg-red-500/10 line-through text-gray-600';
      default:
        return 'bg-gray-900 hover:bg-gray-800';
    }
  };
  
  return (
    <div className="overflow-x-auto max-h-[60vh] relative border border-gray-700 rounded-lg">
      <table className="w-full text-sm text-left">
        <thead className="text-xs text-white font-bold uppercase bg-gray-800 sticky top-0">
          <tr>
            <th scope="col" className="px-4 py-3 text-center">Rank</th>
            <th scope="col" className="px-4 py-3">Player</th>
            <th scope="col" className={getHeaderClass('value')} onClick={() => requestSort('value')}>
                Value (Pt/$)<span className="inline-block w-4">{getSortIndicator('value')}</span>
            </th>
            <th scope="col" className={getHeaderClass('fpts')} onClick={() => requestSort('fpts')}>
                FLEX FPTS<span className="inline-block w-4">{getSortIndicator('fpts')}</span>
            </th>
            <th scope="col" className={getHeaderClass('salary')} onClick={() => requestSort('salary')}>
                Salary<span className="inline-block w-4">{getSortIndicator('salary')}</span>
            </th>
            <th scope="col" className={getHeaderClass('flexOwnership')} onClick={() => requestSort('flexOwnership')}>
                FLEX Own%<span className="inline-block w-4">{getSortIndicator('flexOwnership')}</span>
            </th>
            <th scope="col" className={getHeaderClass('mvpOwnership')} onClick={() => requestSort('mvpOwnership')}>
                MVP Own%<span className="inline-block w-4">{getSortIndicator('mvpOwnership')}</span>
            </th>
            <th scope="col" className="px-4 py-3 text-center">Exposure %</th>
            <th scope="col" className="px-4 py-3 text-center">Actions</th>
          </tr>
        </thead>
        <tbody>
          {sortedPlayers.map((player) => {
            const status = statuses[player.id] || PlayerStatus.INCLUDED;
            const rank = playerRanks.get(player.id);
            return (
              <tr key={player.id} className={`border-b border-gray-700 transition-colors duration-200 ${getRowClass(status)}`}>
                <td className="px-4 py-2 font-medium text-white whitespace-nowrap text-center">{rank}</td>
                <td className="px-4 py-2 font-medium text-white whitespace-nowrap">
                   <div className="flex items-center gap-2">
                      <button onClick={() => onPlayerSelect(player)} className="text-left hover:underline focus:outline-none focus:underline" title={`View details for ${player.name}`}>
                        {player.name}
                      </button>
                      {player.usageBoost > 0 && (
                          <div title={player.notes}>
                              <FlameIcon />
                          </div>
                      )}
                   </div>
                  <span className="text-gray-400">{player.position}</span>
                </td>
                <td className="px-4 py-2 text-right">
                  {player.salary > 0 ? (player.fpts / (player.salary / 1000)).toFixed(2) : '0.00'}
                </td>
                <td className="px-4 py-2 text-right">{player.fpts.toFixed(2)}</td>
                <td className="px-4 py-2 text-right">${player.salary.toLocaleString()}</td>
                <td className="px-4 py-2 text-right">{player.flexOwnership.toFixed(1)}%</td>
                <td className="px-4 py-2 text-right">{player.mvpOwnership.toFixed(1)}%</td>
                <td className="px-4 py-2 text-center">
                    <input
                        type="number"
                        min="0"
                        max="100"
                        value={exposures[player.id] || ''}
                        onChange={(e) => onExposureChange(player.id, parseInt(e.target.value, 10))}
                        className="w-16 bg-gray-800 border border-gray-600 rounded-md text-center py-1 text-white focus:ring-2 focus:ring-gray-500 focus:outline-none"
                        disabled={status === PlayerStatus.EXCLUDED}
                    />
                </td>
                <td className="px-4 py-2">
                  <div className="flex justify-center items-center space-x-2">
                    <button 
                        onClick={() => onStatusChange(player.id, status === PlayerStatus.LOCKED ? PlayerStatus.INCLUDED : PlayerStatus.LOCKED)} 
                        className="p-1 rounded-full hover:bg-green-500/20 transition-colors"
                        title={status === PlayerStatus.LOCKED ? "Unlock Player" : "Lock Player"}
                    >
                      {status === PlayerStatus.LOCKED ? <UnlockIcon /> : <LockIcon />}
                    </button>
                    <button 
                        onClick={() => onStatusChange(player.id, status === PlayerStatus.EXCLUDED ? PlayerStatus.INCLUDED : PlayerStatus.EXCLUDED)} 
                        className="p-1 rounded-full hover:bg-red-500/20 transition-colors"
                        title={status === PlayerStatus.EXCLUDED ? "Include Player" : "Exclude Player"}
                    >
                      {status === PlayerStatus.EXCLUDED ? <IncludeIcon /> : <ExcludeIcon />}
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default PlayerTable;