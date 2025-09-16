import React, { useMemo, useState } from 'react';
import { Player } from '../types';
import XIcon from './icons/XIcon';
import DnaIcon from './icons/DnaIcon';
import SpinnerIcon from './icons/SpinnerIcon';

interface PlayerDetailModalProps {
  player: Player | null;
  playerRank: number | undefined;
  allPlayers: Player[];
  onClose: () => void;
  onGenerateDnaReport: (playerId: string) => Promise<void>;
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

const getCorrelationColor = (value: number): string => {
    if (value > 0.4) return 'bg-green-500/30 text-green-300 border border-green-500'; // Strong positive
    if (value > 0.15) return 'bg-green-500/10 text-green-400 border border-green-500/40'; // Positive
    if (value < -0.4) return 'bg-red-500/30 text-red-300 border border-red-500'; // Strong negative
    if (value < -0.15) return 'bg-red-500/10 text-red-400 border border-red-500/40'; // Negative
    return 'bg-gray-500/10 text-gray-400 border border-gray-500/40'; // Neutral
};


const PlayerDetailModal: React.FC<PlayerDetailModalProps> = ({ player, playerRank, allPlayers, onClose, onGenerateDnaReport }) => {
  const [isDnaLoading, setIsDnaLoading] = useState(false);

  const { sortedCorrelations, hasCorrelations } = useMemo(() => {
    if (!player || !allPlayers) {
      return { sortedCorrelations: [], hasCorrelations: false };
    }
    const map = new Map(allPlayers.map(p => [p.id, p.name]));
    const correlationsExist = player.correlations && Object.keys(player.correlations).length > 0;
    const sorted = correlationsExist
      ? Object.entries(player.correlations)
          .map(([id, value]) => ({
            id,
            value,
            name: map.get(id) || 'Unknown Player',
          }))
          .filter(c => c.id !== player.id) // Don't show correlation with self
          .sort((a, b) => Math.abs(b.value) - Math.abs(a.value)) // Sort by absolute value to see strongest correlations first
      : [];
    return { sortedCorrelations: sorted, hasCorrelations: correlationsExist };
  }, [player, allPlayers]);
  
  if (!player) return null;

  const handleGenerateReportClick = async () => {
    if (!player) return;
    setIsDnaLoading(true);
    await onGenerateDnaReport(player.id);
    setIsDnaLoading(false);
  };

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
                <div className="bg-gray-800 p-4 rounded-lg">
                    <h3 className="font-bold text-lg mb-2 text-white">Correlation Heatmap</h3>
                    {hasCorrelations && sortedCorrelations.length > 0 ? (
                        <div className="max-h-40 overflow-y-auto pr-2">
                            <div className="flex flex-wrap gap-2">
                                {sortedCorrelations.map(({ id, value, name }) => (
                                    <div key={id} className={`flex items-baseline gap-2 px-3 py-1 rounded-full text-sm transition-colors ${getCorrelationColor(value)}`}>
                                        <span className="font-semibold">{name}</span>
                                        <span className="font-mono text-xs">{value.toFixed(2)}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <p className="text-sm text-gray-500 italic">Correlation data not available for this player.</p>
                    )}
                </div>
                 <div className="bg-gray-800 p-4 rounded-lg">
                    <h3 className="font-bold text-lg mb-2 text-white">AI Deep Dive Analysis</h3>
                    {player.playerDnaReport ? (
                      <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-300">{player.playerDnaReport}</p>
                    ) : (
                      <button 
                        onClick={handleGenerateReportClick} 
                        disabled={isDnaLoading}
                        className="w-full flex items-center justify-center gap-2 bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-2 px-4 rounded-lg transition duration-300 disabled:bg-cyan-800"
                      >
                        {isDnaLoading ? <SpinnerIcon /> : <DnaIcon />}
                        {isDnaLoading ? 'Generating Report...' : 'Generate Player DNA Report'}
                      </button>
                    )}
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};

export default PlayerDetailModal;