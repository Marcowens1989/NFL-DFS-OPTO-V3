import React, { useState, useMemo, useRef } from 'react';
import { Player, PlayerStatus } from '../types';
import LockIcon from './icons/LockIcon';
import UnlockIcon from './icons/UnlockIcon';
import ExcludeIcon from './icons/ExcludeIcon';
import IncludeIcon from './icons/IncludeIcon';
import DnaIcon from './icons/DnaIcon';
import { getTeamLogoUrl } from '../services/teamLogoService';
import { useVirtualizer } from '@tanstack/react-virtual';

interface PlayerTableProps {
  players: Player[];
  statuses: Record<string, PlayerStatus>;
  playerRanks: Map<string, number>;
  onStatusChange: (playerId: string, newStatus: PlayerStatus) => void;
  onPlayerSelect: (player: Player) => void;
}

type SortableKeys = 'fpts' | 'salary' | 'flexOwnership' | 'mvpOwnership' | 'value' | 'scenarioFpts.ceiling' | 'leverage' | 'vegas.impliedTeamTotal' | 'volatility';

interface SortConfig {
  key: SortableKeys | null;
  direction: 'ascending' | 'descending';
}

const Tag: React.FC<{ tag: string }> = ({ tag }) => {
    const getTagColor = (t: string) => {
        switch (t.toLowerCase()) {
            case 'value': return 'bg-green-500/20 text-green-300';
            case 'contrarian': return 'bg-purple-500/20 text-purple-300';
            case 'chalk': return 'bg-yellow-500/20 text-yellow-300';
            case 'injury pivot': return 'bg-blue-500/20 text-blue-300';
            default: return 'bg-gray-500/20 text-gray-300';
        }
    };
    return (
        <span className={`px-2 py-0.5 rounded text-xs font-semibold ${getTagColor(tag)}`}>
            {tag}
        </span>
    );
};


const PlayerTable: React.FC<PlayerTableProps> = ({ players, statuses, playerRanks, onStatusChange, onPlayerSelect }) => {
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'fpts', direction: 'descending' });
  const parentRef = useRef<HTMLDivElement>(null);

  const sortedPlayers = useMemo(() => {
    let sortableItems = [...players];
    if (sortConfig.key) {
      sortableItems.sort((a, b) => {
        const getValue = (player: Player, key: SortableKeys): number => {
            switch (key) {
                case 'value':
                    return player.salary > 0 ? player.fpts / (player.salary / 1000) : 0;
                case 'scenarioFpts.ceiling':
                    return player.scenarioFpts.ceiling;
                case 'vegas.impliedTeamTotal':
                    return player.vegas?.impliedTeamTotal ?? -1;
                default:
                    return player[key] as number ?? 0;
            }
        }
        
        const aValue = getValue(a, sortConfig.key!);
        const bValue = getValue(b, sortConfig.key!);
        
        if (aValue < bValue) return sortConfig.direction === 'ascending' ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === 'ascending' ? 1 : -1;
        return 0;
      });
    }
    return sortableItems;
  }, [players, sortConfig]);

  const rowVirtualizer = useVirtualizer({
    count: sortedPlayers.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 53, // Estimate row height
    overscan: 10,
  });

  const requestSort = (key: SortableKeys) => {
    let direction: 'ascending' | 'descending' = 'descending';
    if (sortConfig.key === key && sortConfig.direction === 'descending') {
      direction = 'ascending';
    }
    setSortConfig({ key, direction });
  };
  
  const getSortIndicator = (key: SortableKeys) => ` ${sortConfig.key === key ? (sortConfig.direction === 'descending' ? '↓' : '↑') : ''}`;
  
  const getHeaderClass = (key: SortableKeys) => `px-2 py-3 text-right cursor-pointer transition-colors ${sortConfig.key === key ? 'text-white' : 'text-gray-400 hover:text-white'}`;

  const getRowClass = (status: PlayerStatus) => {
    switch (status) {
      case PlayerStatus.LOCKED: return 'bg-green-500/10';
      case PlayerStatus.EXCLUDED: return 'bg-red-500/10 line-through text-gray-600';
      default: return 'bg-gray-900 hover:bg-gray-800';
    }
  };
  
  return (
    <div ref={parentRef} className="overflow-auto h-[65vh] relative border border-gray-700 rounded-lg">
      <div style={{ height: `${rowVirtualizer.getTotalSize()}px`, width: '100%', position: 'relative' }}>
        <table className="w-full text-sm text-left">
          <thead className="text-xs text-white font-bold uppercase bg-gray-800 sticky top-0 z-10">
            <tr>
              <th scope="col" className="px-4 py-3 text-left w-1/4">Player</th>
              <th scope="col" className={getHeaderClass('value')} onClick={() => requestSort('value')}>Value{getSortIndicator('value')}</th>
              <th scope="col" className={getHeaderClass('fpts')} onClick={() => requestSort('fpts')}>Mean{getSortIndicator('fpts')}</th>
              <th scope="col" className={getHeaderClass('scenarioFpts.ceiling')} onClick={() => requestSort('scenarioFpts.ceiling')}>Ceiling{getSortIndicator('scenarioFpts.ceiling')}</th>
              <th scope="col" className={getHeaderClass('salary')} onClick={() => requestSort('salary')}>Salary{getSortIndicator('salary')}</th>
              <th scope="col" className={getHeaderClass('flexOwnership')} onClick={() => requestSort('flexOwnership')}>FLEX%{getSortIndicator('flexOwnership')}</th>
              <th scope="col" className={getHeaderClass('mvpOwnership')} onClick={() => requestSort('mvpOwnership')}>MVP%{getSortIndicator('mvpOwnership')}</th>
              <th scope="col" className={getHeaderClass('volatility')} onClick={() => requestSort('volatility')}>Vol.{getSortIndicator('volatility')}</th>
              <th scope="col" className="px-4 py-3 text-center">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rowVirtualizer.getVirtualItems().map(virtualItem => {
              const player = sortedPlayers[virtualItem.index];
              const status = statuses[player.id] || PlayerStatus.INCLUDED;
              return (
                <tr 
                  key={player.id} 
                  className={`border-b border-gray-700 transition-colors duration-200 ${getRowClass(status)}`}
                  style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: `${virtualItem.size}px`, transform: `translateY(${virtualItem.start}px)` }}
                >
                  <td className="px-4 py-2 font-medium text-white whitespace-nowrap">
                     <div className="flex items-center gap-3">
                        <img src={getTeamLogoUrl(player.team)} alt={`${player.team} logo`} className="h-6 w-6 object-contain" />
                        <div>
                          <div className="flex items-center gap-2">
                              <button onClick={() => onPlayerSelect(player)} className="text-left hover:underline focus:outline-none focus:underline">{player.name}</button>
                              {player.playerDnaReport && <DnaIcon />}
                          </div>
                          <div className="flex items-center gap-1.5 mt-1">
                            <span className="text-gray-400 text-xs">{player.position}</span>
                            {player.tags && player.tags.split(',').map(tag => tag.trim() && <Tag key={tag} tag={tag.trim()} />)}
                          </div>
                        </div>
                     </div>
                  </td>
                  <td className="px-2 py-2 text-right">{(player.fpts / (player.salary / 1000)).toFixed(2)}</td>
                  <td className="px-2 py-2 text-right">{player.fpts.toFixed(2)}</td>
                  <td className="px-2 py-2 text-right font-bold text-cyan-400">{player.scenarioFpts.ceiling.toFixed(2)}</td>
                  <td className="px-2 py-2 text-right">${player.salary.toLocaleString()}</td>
                  <td className="px-2 py-2 text-right">{player.flexOwnership.toFixed(1)}%</td>
                  <td className="px-2 py-2 text-right text-gray-400">{player.mvpOwnership.toFixed(1)}%</td>
                  <td className="px-2 py-2 text-right font-bold text-orange-400">{player.volatility.toFixed(0)}</td>
                  <td className="px-4 py-2">
                    <div className="flex justify-center items-center space-x-1">
                      <button onClick={() => onStatusChange(player.id, status === PlayerStatus.LOCKED ? PlayerStatus.INCLUDED : PlayerStatus.LOCKED)} className="p-1 rounded-full hover:bg-green-500/20" title={status === PlayerStatus.LOCKED ? "Unlock Player" : "Lock Player"}>
                        {status === PlayerStatus.LOCKED ? <UnlockIcon /> : <LockIcon />}
                      </button>
                      <button onClick={() => onStatusChange(player.id, status === PlayerStatus.EXCLUDED ? PlayerStatus.INCLUDED : PlayerStatus.EXCLUDED)} className="p-1 rounded-full hover:bg-red-500/20" title={status === PlayerStatus.EXCLUDED ? "Include Player" : "Exclude Player"}>
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
    </div>
  );
};

export default PlayerTable;