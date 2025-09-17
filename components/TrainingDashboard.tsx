import React, { useMemo, useRef, useEffect } from 'react';
import { TunedModel } from '../types';

interface TrainingDashboardProps {
    logEntries: string[];
    models: TunedModel[];
    isTraining: boolean; // NEW PROP to control animation
}

const PerformanceChart: React.FC<{ models: TunedModel[] }> = ({ models }) => {
    const chartData = useMemo(() => {
        if (models.length < 2) return null;
        
        const sortedModels = models
            .filter(m => typeof m.performance.validationMae === 'number')
            .map(m => ({ ...m, createdAt: new Date(m.createdAt) }))
            .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

        if (sortedModels.length < 2) return null;

        const maes = sortedModels.map(m => m.performance.validationMae!);
        const dates = sortedModels.map(m => m.createdAt.getTime());

        const minMae = Math.min(...maes);
        const maxMae = Math.max(...maes);
        const maeRange = maxMae - minMae || 1;

        const minDate = Math.min(...dates);
        const maxDate = Math.max(...dates);
        const dateRange = maxDate - minDate || 1;

        return sortedModels.map(model => ({
            ...model,
            x: ((model.createdAt.getTime() - minDate) / dateRange) * 100,
            y: 100 - (((model.performance.validationMae! - minMae) / maeRange) * 100)
        }));
    }, [models]);

    if (!chartData) {
        return (
            <div className="h-48 flex items-center justify-center text-gray-500 text-sm italic">
                {models.length > 0 ? "Save at least two models to see performance history." : "No saved models to chart."}
            </div>
        );
    }

    const minMae = Math.min(...chartData.map(d => d.performance.validationMae!));
    const maxMae = Math.max(...chartData.map(d => d.performance.validationMae!));

    return (
        <div className="h-48 bg-gray-900/50 p-4 rounded-lg relative">
            {/* Y-Axis Labels */}
            <span className="absolute top-2 left-2 text-xs text-gray-500">{maxMae.toFixed(4)}</span>
            <span className="absolute bottom-2 left-2 text-xs text-gray-500">{minMae.toFixed(4)}</span>
            {/* X-Axis Labels */}
             <span className="absolute bottom-2 left-1/2 -translate-x-1/2 text-xs text-gray-500">Time</span>
            
            {/* Grid lines */}
            <div className="absolute top-0 left-12 right-2 border-b border-gray-700/50 h-1/2"></div>

            {/* Chart Points */}
            {chartData.map(d => (
                <div 
                    key={d.id} 
                    className="absolute w-3 h-3 bg-green-500 rounded-full border-2 border-green-900 -translate-x-1/2 -translate-y-1/2 cursor-pointer transition-transform hover:scale-150"
                    style={{ left: `calc(3rem + ((100% - 3rem) * ${d.x / 100}))`, top: `${d.y}%` }}
                    title={`${d.name}\nMAE: ${d.performance.validationMae!.toFixed(4)}\nDate: ${d.createdAt.toLocaleDateString()}`}
                ></div>
            ))}
        </div>
    );
};


const TrainingDashboard: React.FC<TrainingDashboardProps> = ({ logEntries, models, isTraining }) => {
    const logContainerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (logContainerRef.current) {
            logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
        }
    }, [logEntries]);

    return (
        <div className="border-t border-gray-700 pt-6">
            <h2 className="text-2xl font-bold mb-2 text-white">Oracle's Heartbeat: Continuous Training Dashboard</h2>
            <p className="text-sm text-gray-400 mb-4 max-w-3xl">
                The key metric is <strong>Validation MAE (Mean Absolute Error)</strong>, which measures how many fantasy points a model's prediction was off by, on average. For example, if the average player scores 15 FDP, an MAE of 3 means the model is off by about 20% per prediction. A lower MAE means a more accurate model.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-gray-900 p-4 rounded-lg border border-gray-700">
                <div>
                    <h3 className="text-lg font-semibold text-gray-300 mb-2">Performance History <span className="text-xs text-gray-500">(Lower MAE is Better)</span></h3>
                    <PerformanceChart models={models} />
                </div>
                <div>
                    <h3 className={`text-lg font-semibold text-gray-300 mb-2 flex items-center gap-2`}>
                        {isTraining && <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>}
                        Live Training Log
                    </h3>
                    <div ref={logContainerRef} className="h-48 bg-black p-3 rounded-md font-mono text-xs text-gray-400 overflow-y-auto border border-gray-800">
                        {logEntries.map((entry, index) => (
                            <p key={index} className={`whitespace-pre-wrap ${entry.includes('[ERROR]') ? 'text-red-400' : entry.includes('[PROMOTION]') ? 'text-green-400' : ''}`}>
                                {entry}
                            </p>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TrainingDashboard;
