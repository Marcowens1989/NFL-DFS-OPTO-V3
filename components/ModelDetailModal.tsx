import React from 'react';
import { TunedModel, StatWeights } from '../types';
import XIcon from './icons/XIcon';

interface ModelDetailModalProps {
  model: TunedModel | null;
  onClose: () => void;
}

const WeightDisplay: React.FC<{ weights: StatWeights, title: string, keys: (keyof StatWeights)[] }> = ({ weights, title, keys }) => {
    const relevantWeights = keys.filter(key => weights[key] !== undefined && weights[key] !== 0);

    if (relevantWeights.length === 0) {
        return null; // Don't render the section if no relevant weights exist
    }

    return (
        <div className="bg-gray-800 p-4 rounded-lg">
            <h3 className="font-bold text-lg mb-2 text-white">{title}</h3>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                {relevantWeights.map(key => (
                    <div key={key} className="flex justify-between items-center">
                        <span className="text-gray-400">{key}:</span>
                        <span className="font-mono text-cyan-400">{(weights[key]! as number).toFixed(4)}</span>
                    </div>
                ))}
            </div>
        </div>
    );
};

const ModelDetailModal: React.FC<ModelDetailModalProps> = ({ model, onClose }) => {
    if (!model) return null;

    const rawStatKeys: (keyof StatWeights)[] = ['passYds', 'passTds', 'interceptions', 'rushYds', 'rushTds', 'receptions', 'recYds', 'recTds', 'fumblesLost'];
    const correlationKeys: (keyof StatWeights)[] = ['qb_passYds', 'qb_rushYds', 'topTeammate_recYds', 'topTeammate_rushYds', 'topTeammate_receptions'];
    const sabermetricKeys = Object.keys(model.weights).filter(k => !rawStatKeys.includes(k as any) && !correlationKeys.includes(k as any)) as (keyof StatWeights)[];

    return (
        <div
            className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 transition-opacity"
            onClick={onClose}
            role="dialog"
            aria-modal="true"
            aria-labelledby="model-detail-title"
        >
            <div
                className="bg-gray-900 border border-gray-700 rounded-lg shadow-xl w-full max-w-2xl m-4 transform transition-transform max-h-[90vh] flex flex-col"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="p-6 border-b border-gray-700">
                    <div className="flex justify-between items-start">
                        <div>
                            <h2 id="model-detail-title" className="text-2xl font-bold text-white">{model.name}</h2>
                            <p className="text-sm text-gray-400">{model.sourceDescription}</p>
                        </div>
                        <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors" aria-label="Close model details">
                            <XIcon />
                        </button>
                    </div>
                </div>
                <div className="p-6 space-y-4 overflow-y-auto">
                    <WeightDisplay weights={model.weights} title="Raw Stat Weights" keys={rawStatKeys} />
                    <WeightDisplay weights={model.weights} title="Sabermetric & Efficiency Weights" keys={sabermetricKeys} />
                    <WeightDisplay weights={model.weights} title="Correlation-Based Weights" keys={correlationKeys} />
                </div>
            </div>
        </div>
    );
};

export default ModelDetailModal;
