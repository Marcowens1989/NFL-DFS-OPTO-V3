import React, { useState, useMemo } from 'react';
import { Player, PlayerStatus } from '../types';
import LockIcon from './icons/LockIcon';
import UnlockIcon from './icons/UnlockIcon';
import ExcludeIcon from './icons/ExcludeIcon';
import IncludeIcon from './icons/IncludeIcon';
import DnaIcon from './icons/DnaIcon';
import { getTeamLogoUrl } from '../services/teamLogoService';

interface PlayerTableProps {
  players: Player[];
  statuses: Record<string, PlayerStatus>;
  playerRanks: Map<string, number>;
  onStatusChange: (playerId: string, newStatus: PlayerStatus) => void;
  onPlayerSelect: (player: Player) => void;
}

type SortableKeys = 'fpts' | 'salary' | 'flexOwnership' | 'mvpOwnership' | 'value' | 'ceilingFpts' | 'leverage' | 'topCorrelation';

interface SortConfig {
  key: SortableKeys | null;
  direction: 'ascending' | 'descending';
}

const getTopCorrelation = (player: Player, allPlayers: Player[]): { name: string; value: number } | null => {
    if (!player.correlations || Object.keys(player.correlations).length === 0) {
        return null;
    }
    const allPlayersMap = new Map(allPlayers.map(p => [p.id, p.name]));
    let topCorrId: string | null = null;
    let topCorrValue = -Infinity;

    for (const [teammateId, corrValue] of Object.entries(player.correlations)) {
        if (Math.abs(corrValue) > Math.abs(topCorrValue)) {
            topCorrValue = corrValue;
            topCorrId = teammateId;
        }
    }
    
    if (topCorrId && allPlayersMap.has(topCorrId)) {
        return { name: allPlayersMap.get(topCorrId)!, value: topCorrValue };
    }
    return null;
};

const getCorrelationColor = (value: number): string => {
    if (value > 0.4) return 'bg-green-500/30 text-green-300 border border-green-500'; // Strong positive
    if (value > 0.15) return 'bg-green-500/10 text-green-400 border border-green-500/40'; // Positive
    if (value < -0.4) return 'bg-red-500/30 text-red-300 border border-red-500'; // Strong negative
    if (value < -0.15) return 'bg-red-500/10 text-red-400 border border-red-500/40'; // Negative
    return 'bg-gray-500/10 text-gray-400 border border-gray-500/40'; // Neutral
};


const PlayerTable: React.FC<PlayerTableProps> = ({ players, statuses, playerRanks, onStatusChange, onPlayerSelect }) => {
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'fpts', direction: 'descending' });

  const sortedPlayers = useMemo(() => {
    let sortableItems = [...players];
    if (sortConfig.key) {
      sortableItems.sort((a, b) => {
        let aValue, bValue;

        switch(sortConfig.key) {
            case 'value':
                aValue = a.salary > 0 ? a.fpts / (a.salary / 1000) : 0;
                bValue = b.salary > 0 ? b.fpts / (b.salary / 1000) : 0;
                break;
            case 'ceilingFpts':
                aValue = a.scenarioFpts.ceiling;
                bValue = b.scenarioFpts.ceiling;
                break;
            case 'topCorrelation':
                aValue = Math.abs(getTopCorrelation(a, players)?.value ?? 0);
                bValue = Math.abs(getTopCorrelation(b, players)?.value ?? 0);
                break;
            default:
                aValue = a[sortConfig.key as keyof Player] as number;
                bValue = b[sortConfig.key as keyof Player] as number;
                break;
        }
        
        if (aValue < bValue) return sortConfig.direction === 'ascending' ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === 'ascending' ? 1 : -1;
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
    if (sortConfig.key !== key) return ' ';
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
            <th scope="col" className="px-4 py-3">Player</th>
            <th scope="col" className={getHeaderClass('value')} onClick={() => requestSort('value')}>
                Value <span className="inline-block w-4">{getSortIndicator('value')}</span>
            </th>
            <th scope="col" className={getHeaderClass('fpts')} onClick={() => requestSort('fpts')}>
                Mean <span className="inline-block w-4">{getSortIndicator('fpts')}</span>
            </th>
            <th scope="col" className={getHeaderClass('ceilingFpts')} onClick={() => requestSort('ceilingFpts')}>
                Ceiling <span className="inline-block w-4">{getSortIndicator('ceilingFpts')}</span>
            </th>
            <th scope="col" className={getHeaderClass('salary')} onClick={() => requestSort('salary')}>
                Salary <span className="inline-block w-4">{getSortIndicator('salary')}</span>
            </th>
            <th scope="col" className={getHeaderClass('flexOwnership')} onClick={() => requestSort('flexOwnership')}>
                Own% <span className="inline-block w-4">{getSortIndicator('flexOwnership')}</span>
            </th>
             <th scope="col" className={getHeaderClass('topCorrelation')} onClick={() => requestSort('topCorrelation')}>
                Top Corr. <span className="inline-block w-4">{getSortIndicator('topCorrelation')}</span>
            </th>
            <th scope="col" className="px-4 py-3 text-center">Actions</th>
          </tr>
        </thead>
        <tbody>
          {sortedPlayers.map((player) => {
            const status = statuses[player.id] || PlayerStatus.INCLUDED;
            const topCorrelation = getTopCorrelation(player, players);

            return (
              <tr key={player.id} className={`border-b border-gray-700 transition-colors duration-200 ${getRowClass(status)}`}>
                <td className="px-4 py-2 font-medium text-white whitespace-nowrap">
                   <div className="flex items-center gap-3">
                      <img src={getTeamLogoUrl(player.team)} alt={`${player.team} logo`} className="h-6 w-6 object-contain" />
                      <div>
                        <div className="flex items-center gap-2">
                            <button onClick={() => onPlayerSelect(player)} className="text-left hover:underline focus:outline-none focus:underline">
                                {player.name}
                            </button>
                            {player.playerDnaReport && <DnaIcon />}
                        </div>
                        <span className="text-gray-400 text-xs">{player.position}</span>
                      </div>
                   </div>
                </td>
                <td className="px-4 py-2 text-right">
                  {player.salary > 0 ? (player.fpts / (player.salary / 1000)).toFixed(2) : '0.00'}
                </td>
                <td className="px-4 py-2 text-right">{player.fpts.toFixed(2)}</td>
                <td className="px-4 py-2 text-right font-bold text-cyan-400">{player.scenarioFpts.ceiling.toFixed(2)}</td>
                <td className="px-4 py-2 text-right">${player.salary.toLocaleString()}</td>
                <td className="px-4 py-2 text-right">{player.flexOwnership.toFixed(1)}%</td>
                <td className="px-4 py-2 text-center">
                    {topCorrelation ? (
                        <div className={`flex items-baseline justify-center gap-1.5 px-2 py-1 rounded-full text-xs transition-colors ${getCorrelationColor(topCorrelation.value)}`}>
                            <span className="font-semibold truncate max-w-[80px]">{topCorrelation.name.split(' ').pop()}</span>
                            <span className="font-mono text-xs">{topCorrelation.value.toFixed(2)}</span>
                        </div>
                    ) : (
                        <span className="text-gray-600">-</span>
                    )}
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
