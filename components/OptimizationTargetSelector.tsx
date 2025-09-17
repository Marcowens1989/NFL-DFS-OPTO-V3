import React from 'react';
import { OptimizationTarget } from '../services/optimizer';

interface OptimizationTargetSelectorProps {
    selected: OptimizationTarget;
    onSelect: (target: OptimizationTarget) => void;
}

const OptimizationTargetSelector: React.FC<OptimizationTargetSelectorProps> = ({ selected, onSelect }) => {

    const getButtonClass = (target: OptimizationTarget) => {
        const baseClass = "w-full py-2 px-4 text-sm font-bold transition-colors focus:outline-none";
        if (target === selected) {
            return `${baseClass} bg-gray-600 text-white`;
        }
        return `${baseClass} bg-gray-800 text-gray-400 hover:bg-gray-700`;
    }

    return (
        <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">Optimization Target</label>
            <div className="flex rounded-md border border-gray-600 overflow-hidden">
                <button
                    onClick={() => onSelect('mean')}
                    className={`${getButtonClass('mean')} rounded-l-md`}
                    title="Optimize for the highest average projected score. Good for cash games."
                >
                    Mean
                </button>
                <button
                    onClick={() => onSelect('ceiling')}
                    className={`${getButtonClass('ceiling')} rounded-r-md`}
                    title="Optimize for the highest 90th percentile outcome. Best for GPP tournaments."
                >
                    Ceiling (GPP)
                </button>
            </div>
        </div>
    );
};

export default OptimizationTargetSelector;