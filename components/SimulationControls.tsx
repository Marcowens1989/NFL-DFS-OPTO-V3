import React from 'react';
import { SimulationParams } from '../types';

interface SimulationControlsProps {
    params: SimulationParams;
    onParamsChange: (params: SimulationParams) => void;
    isDisabled: boolean;
}

const SimulationControls: React.FC<SimulationControlsProps> = ({ params, onParamsChange, isDisabled }) => {
    
    const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        onParamsChange({
            ...params,
            [e.target.name]: parseInt(e.target.value, 10)
        });
    };

    return (
        <div className="border-t border-b border-gray-700 py-6">
            <h2 className="text-xl font-bold mb-4 text-white">Simulation Parameters</h2>
            <div className={`grid grid-cols-1 md:grid-cols-2 gap-6 ${isDisabled ? 'opacity-50' : ''}`}>
                <div>
                    <label htmlFor="trainValidateSplit" className="block text-sm font-medium text-gray-400 mb-2">
                        Train / Validate Split: <span className="font-bold text-white">{params.trainValidateSplit}% / {100 - params.trainValidateSplit}%</span>
                    </label>
                    <input
                        id="trainValidateSplit"
                        name="trainValidateSplit"
                        type="range"
                        min="50"
                        max="95"
                        step="5"
                        value={params.trainValidateSplit}
                        onChange={handleSliderChange}
                        disabled={isDisabled}
                        className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer disabled:cursor-not-allowed"
                    />
                    <p className="text-xs text-gray-500 mt-1">Percentage of historical data used for training vs. blind validation.</p>
                </div>
                 <div>
                    <label htmlFor="topKEnsemble" className="block text-sm font-medium text-gray-400 mb-2">
                        Ensemble Size: <span className="font-bold text-white">{params.topKEnsemble}</span> Models
                    </label>
                    <input
                        id="topKEnsemble"
                        name="topKEnsemble"
                        type="range"
                        min="1"
                        max="5"
                        step="1"
                        value={params.topKEnsemble}
                        onChange={handleSliderChange}
                        disabled={isDisabled}
                        className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer disabled:cursor-not-allowed"
                    />
                    <p className="text-xs text-gray-500 mt-1">Number of top candidate models to combine into the final Ensemble Super Model.</p>
                </div>
            </div>
        </div>
    );
};

export default SimulationControls;