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

type SortableKeys = 'fpts' | 'salary' | 'flexOwnership' | 'mvpOwnership' | 'value' | 'ceilingFpts' | 'leverage';

interface SortConfig {
  key: SortableKeys | null;
  direction: 'ascending' | 'descending';
}

const UsageBadge: React.FC<{ usage: Player['projectedUsage'], sentiment: string }> = ({ usage, sentiment }) => {
    const usageStyles: Record<Player['projectedUsage'], string> = {
        'Starter': 'bg-green-500/20 text-green-300 border-green-500',
        'Role Player': 'bg-yellow-500/20 text-yellow-300 border-yellow-500',
        'Backup': 'bg-orange-500/20 text-orange-300 border-orange-500',
        'Unlikely': 'bg-red-500/20 text-red-300 border-red-500',
    };

    return (
        <span
            title={sentiment}
            className={`px-2 py-1 text-xs font-semibold rounded-full border ${usageStyles[usage] || 'bg-gray-500/20 text-gray-300'}`}
        >
            {usage}
        </span>
    );
};

const LeverageBadge: React.FC<{ score: number }> = ({ score }) => {
    let colorClasses = 'bg-gray-500/20 text-gray-300 border-gray-500';
    if (score >= 85) {
        colorClasses = 'bg-green-500/20 text-green-300 border-green-500';
    } else if (score >= 50) {
        colorClasses = 'bg-yellow-500/20 text-yellow-300 border-yellow-500';
    } else if (score > 0) {
        colorClasses = 'bg-red-500/20 text-red-300 border-red-500';
    }
    
    return (
        <span className={`px-2 py-1 text-xs font-bold rounded-full border ${colorClasses}`}>
            {score.toFixed(0)}
        </span>
    );
};


const PlayerTable: React.FC<PlayerTableProps> = ({ players, statuses, playerRanks, onStatusChange, onPlayerSelect }) => {
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'fpts', direction: 'descending' });

  const sortedPlayers = useMemo(() => {
    let sortableItems = [...players];
    if (sortConfig.key) {
      sortableItems.sort((a, b) => {
        let aValue, bValue;

        if (sortConfig.key === 'value') {
          aValue = a.salary > 0 ? a.fpts / (a.salary / 1000) : 0;
          bValue = b.salary > 0 ? b.fpts / (b.salary / 1000) : 0;
        } else if (sortConfig.key === 'ceilingFpts') {
          aValue = a.scenarioFpts.ceiling;
          bValue = b.scenarioFpts.ceiling;
        } else if (sortConfig.key === 'leverage') {
          aValue = a.leverage;
          bValue = b.leverage;
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
            <th scope="col" className="px-2 py-3 text-center">Usage</th>
            <th scope="col" className={getHeaderClass('value')} onClick={() => requestSort('value')}>
                Value<span className="inline-block w-4">{getSortIndicator('value')}</span>
            </th>
            <th scope="col" className={getHeaderClass('fpts')} onClick={() => requestSort('fpts')}>
                Mean<span className="inline-block w-4">{getSortIndicator('fpts')}</span>
            </th>
            <th scope="col" className={getHeaderClass('ceilingFpts')} onClick={() => requestSort('ceilingFpts')}>
                Ceiling<span className="inline-block w-4">{getSortIndicator('ceilingFpts')}</span>
            </th>
            <th scope="col" className={getHeaderClass('salary')} onClick={() => requestSort('salary')}>
                Salary<span className="inline-block w-4">{getSortIndicator('salary')}</span>
            </th>
            <th scope="col" className={getHeaderClass('flexOwnership')} onClick={() => requestSort('flexOwnership')}>
                Own%<span className="inline-block w-4">{getSortIndicator('flexOwnership')}</span>
            </th>
             <th scope="col" className={getHeaderClass('leverage')} onClick={() => requestSort('leverage')}>
                Leverage<span className="inline-block w-4">{getSortIndicator('leverage')}</span>
            </th>
            <th scope="col" className="px-4 py-3 text-center">Actions</th>
          </tr>
        </thead>
        <tbody>
          {sortedPlayers.map((player) => {
            const status = statuses[player.id] || PlayerStatus.INCLUDED;
            const rank = playerRanks.get(player.id);
            const tooltipText = `FPTS: ${player.fpts.toFixed(2)}\nSalary: $${player.salary.toLocaleString()}\nFLEX Own%: ${player.flexOwnership.toFixed(1)}%\nMVP Own%: ${player.mvpOwnership.toFixed(1)}%`;

            return (
              <tr key={player.id} className={`border-b border-gray-700 transition-colors duration-200 ${getRowClass(status)}`}>
                <td className="px-4 py-2 font-medium text-white whitespace-nowrap text-center">{rank}</td>
                <td className="px-4 py-2 font-medium text-white whitespace-nowrap">
                   <div className="flex items-center gap-3">
                      <img src={getTeamLogoUrl(player.team)} alt={`${player.team} logo`} className="h-6 w-6 object-contain" />
                      <div>
                        <div className="flex items-center gap-2">
                            <button 
                                onClick={() => onPlayerSelect(player)} 
                                className="text-left hover:underline focus:outline-none focus:underline" 
                                title={tooltipText}
                            >
                                {player.name}
                            </button>
                            {player.playerDnaReport && <DnaIcon />}
                            {player.usageBoost > 0 && (
                                <div title={`Projected Gain: +${player.usageBoost.toFixed(2)} FDP ↑\nReason: ${player.notes}`}>
                                    <span role="img" aria-label="Rising stock">📈</span>
                                </div>
                            )}
                        </div>
                        <span className="text-gray-400 text-xs">{player.position}</span>
                      </div>
                   </div>
                </td>
                <td className="px-2 py-2 text-center">
                    <UsageBadge usage={player.projectedUsage} sentiment={player.sentimentSummary} />
                </td>
                <td className="px-4 py-2 text-right">
                  {player.salary > 0 ? (player.fpts / (player.salary / 1000)).toFixed(2) : '0.00'}
                </td>
                <td className="px-4 py-2 text-right">{player.fpts.toFixed(2)}</td>
                <td className="px-4 py-2 text-right font-bold text-cyan-400">{player.scenarioFpts.ceiling.toFixed(2)}</td>
                <td className="px-4 py-2 text-right">${player.salary.toLocaleString()}</td>
                <td className="px-4 py-2 text-right">{player.flexOwnership.toFixed(1)}%</td>
                <td className="px-4 py-2 text-center">
                    <LeverageBadge score={player.leverage} />
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