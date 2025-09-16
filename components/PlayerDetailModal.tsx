import React from 'react';
import { Player } from '../types';
import XIcon from './icons/XIcon';

interface PlayerDetailModalProps {
  player: Player | null;
  playerRank: number | undefined;
  onClose: () => void;
}

const StatDisplay: React.FC<{ label: string; value: string | number; color?: string }> = ({ label, value, color = 'text-green-400' }) => (
    <div className="bg-gray-800 p-3 rounded-lg text-center">
        <p className="text-sm text-gray-400">{label}</p>
        <p className={`text-xl font-bold ${color}`}>{value}</p>
    </div>
);

const MetricDisplay: React.FC<{ label: string; value: string | number | React.ReactNode }> = ({ label, value }) => (
    <div className="flex justify-between items-center text-sm py-1">
        <span className="text-gray-400">{label}:</span>
        <span className="font-mono text-white capitalize text-right">{value}</span>
    </div>
);


const PlayerDetailModal: React.FC<PlayerDetailModalProps> = ({ player, playerRank, onClose }) => {
  if (!player) return null;

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 transition-opacity"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="player-detail-title"
    >
      <div 
        className="bg-gray-900 border border-gray-700 rounded-lg shadow-xl w-full max-w-md m-4 transform transition-transform"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6">
            <div className="flex justify-between items-start mb-4">
                <div>
                    <h2 id="player-detail-title" className="text-3xl font-bold text-white">{player.name}</h2>
                    <p className="text-lg text-gray-400">{player.position} ({player.team} vs {player.opponent})</p>
                </div>
                <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors" aria-label="Close player details">
                    <XIcon />
                </button>
            </div>
            
            <div className="grid grid-cols-3 gap-4 mb-6">
                <StatDisplay label="Rank" value={`#${playerRank}`} />
                <StatDisplay label="FLEX FPTS" value={player.fpts.toFixed(2)} />
                <StatDisplay label="Salary" value={`$${player.salary.toLocaleString()}`} color="text-white" />
            </div>

            <div className="space-y-4">
                <div className="bg-gray-800 p-4 rounded-lg">
                    <h3 className="font-bold text-lg mb-2 text-white">Projections & Usage</h3>
                    <MetricDisplay label="FLEX Ownership" value={`${player.flexOwnership.toFixed(1)}%`} />
                    <MetricDisplay label="MVP Ownership" value={`${player.mvpOwnership.toFixed(1)}%`} />
                    <MetricDisplay label="Projected Usage" value={player.projectedUsage} />
                     <div className="pt-2 mt-2 border-t border-gray-700">
                        <p className="text-sm text-gray-400">Sentiment Summary:</p>
                        <p className="text-sm text-white italic">"{player.sentimentSummary}"</p>
                    </div>
                </div>
                 <div className="bg-gray-800 p-4 rounded-lg">
                    <h3 className="font-bold text-lg mb-2 text-white">Advanced Metrics</h3>
                    <MetricDisplay label="Game Script Score" value={player.gameScriptScore.toFixed(1)} />
                    <MetricDisplay label="Opponent Blitz Rate" value={`${player.blitzRateDefense.toFixed(1)}%`} />
                    <MetricDisplay label="Coordinator Tendency" value={player.coordinatorTendency} />
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};

export default PlayerDetailModal;