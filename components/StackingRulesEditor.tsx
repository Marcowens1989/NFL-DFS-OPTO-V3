import React from 'react';
import { StackingRules } from '../types';
import { strategyPresets } from '../services/strategyPresets';
import StarIcon from './icons/StarIcon';

interface StackingRulesEditorProps {
    rules: StackingRules;
    onRulesChange: (rules: StackingRules) => void;
    recommendedStrategy: string | null;
}

const StackingRulesEditor: React.FC<StackingRulesEditorProps> = ({ rules, onRulesChange, recommendedStrategy }) => {
    
    const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        onRulesChange({
            ...rules,
            [e.target.name]: e.target.checked
        });
    };

    const handleMaxPosChange = (pos: string, value: string) => {
        const numValue = parseInt(value, 10);
        onRulesChange({
            ...rules,
            maxFromPosition: {
                ...rules.maxFromPosition,
                [pos]: isNaN(numValue) ? 0 : numValue
            }
        });
    }

    return (
        <div className="border-t border-gray-700 pt-6">
            <h2 className="text-xl font-bold mb-4 text-white">4. Stacking & Correlation Rules</h2>
            
            <div className="mb-4">
                <p className="text-sm text-gray-400 mb-2">Select a preset or create custom rules below. The AI's recommended strategy is marked with a ⭐️.</p>
                <div className="grid grid-cols-2 gap-2">
                    {strategyPresets.map(preset => (
                        <button
                            key={preset.name}
                            onClick={() => onRulesChange(preset.rules)}
                            className="text-xs text-left p-2 rounded-md bg-gray-800 hover:bg-gray-700 border border-gray-600 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500"
                            title={preset.description}
                        >
                           <div className="flex items-center">
                             {preset.name === recommendedStrategy && <StarIcon />}
                             <span className="font-bold ml-1">{preset.name}</span>
                           </div>
                        </button>
                    ))}
                </div>
            </div>

            <div className="space-y-4 border-t border-gray-700 pt-4">
                 <h3 className="text-md font-semibold text-gray-300">Custom Rules</h3>
                <label className="flex items-center space-x-3 cursor-pointer">
                    <input
                        type="checkbox"
                        name="stackQbWithReceiver"
                        checked={rules.stackQbWithReceiver}
                        onChange={handleCheckboxChange}
                        className="h-5 w-5 rounded bg-gray-700 border-gray-600 text-red-600 focus:ring-red-500"
                    />
                    <span className="text-sm text-gray-300">Stack QB with 1+ WR/TE</span>
                </label>
                <label className={`flex items-center space-x-3 ${!rules.stackQbWithReceiver ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}>
                    <input
                        type="checkbox"
                        name="forceOpponentBringBack"
                        checked={rules.forceOpponentBringBack}
                        onChange={handleCheckboxChange}
                        disabled={!rules.stackQbWithReceiver}
                        className="h-5 w-5 rounded bg-gray-700 border-gray-600 text-red-600 focus:ring-red-500"
                    />
                     <span className="text-sm text-gray-300">Force Opponent "Bring-back"</span>
                </label>

                <div className="space-y-2">
                    <h4 className="text-sm font-semibold text-gray-300">Max Players from Position:</h4>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                        {Object.entries(rules.maxFromPosition).map(([pos, max]) => (
                            <div key={pos} className="flex items-center justify-between">
                                <label htmlFor={`max-${pos}`} className="text-sm text-gray-400">{pos}:</label>
                                <input
                                    type="number"
                                    id={`max-${pos}`}
                                    min="0"
                                    max="6"
                                    value={max}
                                    onChange={(e) => handleMaxPosChange(pos, e.target.value)}
                                    className="w-16 bg-gray-800 border border-gray-600 rounded-md text-center py-1 text-white focus:ring-2 focus:ring-gray-500 focus:outline-none"
                                />
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default StackingRulesEditor;