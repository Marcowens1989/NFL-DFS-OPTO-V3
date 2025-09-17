import React from 'react';
import { TunedModel } from '../types';
import StarIcon from './icons/StarIcon';

interface ModelSelectorProps {
    models: TunedModel[];
    activeModelId: string | null;
    recommendedModelId: string | null;
    onApplyModel: (model: TunedModel) => void;
}

const ModelSelector: React.FC<ModelSelectorProps> = ({ models, activeModelId, recommendedModelId, onApplyModel }) => {
    
    if (models.length === 0) {
        return (
            <div className="mt-6 border-t border-gray-700 pt-6">
                <h2 className="text-2xl font-bold mb-4 text-white">2. Select Projection Model</h2>
                <div className="p-4 bg-yellow-900/50 border border-yellow-500 text-yellow-300 rounded-lg">
                    <p className="font-bold">No Projection Models Found</p>
                    <p className="text-sm">Please go to the 'Projections Lab' tab and run a simulation to discover and save a model first.</p>
                </div>
            </div>
        )
    }

    return (
        <div className="mt-6 border-t border-gray-700 pt-6">
            <h2 className="text-2xl font-bold mb-4 text-white">2. Select Projection Model</h2>
            <div className="space-y-2">
                {models.map(model => {
                    const isActive = model.id === activeModelId;
                    const isRecommended = model.id === recommendedModelId;
                    
                    const baseClass = "p-3 rounded-md flex justify-between items-center border transition-colors duration-200";
                    let stateClass = "bg-gray-800 border-gray-700";
                    if (isRecommended) {
                        stateClass = "bg-green-900/40 border-green-500/50 ring-2 ring-green-500";
                    } else if (isActive) {
                         stateClass = "bg-gray-700/50 border-gray-500";
                    }

                    return (
                        <div key={model.id} className={`${baseClass} ${stateClass}`}>
                            <div>
                                <div className="flex items-center gap-2">
                                     {isRecommended && <StarIcon />}
                                    <p className="font-bold text-white">{model.name}</p>
                                </div>
                                <p className="text-xs text-gray-400">
                                    Validation MAE: <span className="font-bold text-green-400">{model.performance.validationMae?.toFixed(4) || 'N/A'}</span>
                                </p>
                            </div>
                            <div className="flex items-center gap-2">
                                {isActive ? (
                                    <span className="text-xs font-bold bg-gray-600 text-white py-1 px-3 rounded-full">Active</span>
                                ) : (
                                    <button onClick={() => onApplyModel(model)} className="text-xs bg-green-600 hover:bg-green-500 text-white font-bold py-2 px-3 rounded">Apply</button>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default ModelSelector;