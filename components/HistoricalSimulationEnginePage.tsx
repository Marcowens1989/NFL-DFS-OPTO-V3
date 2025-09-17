import React, { useState, useEffect, useCallback, useRef } from 'react';
import { TunedModel, StatWeights, ValidationReport } from '../types';
import { runFullSimulation } from '../services/historicalSimulationService';
import { modelStore } from '../services/modelStore';
import SpinnerIcon from './icons/SpinnerIcon';
import LightbulbIcon from './icons/LightbulbIcon';
import TrainingDashboard from './TrainingDashboard';

interface HistoricalSimulationEnginePageProps {
  onApplyWeights: (newWeights: StatWeights) => void;
  initialWeights: StatWeights;
}

const HistoricalSimulationEnginePage: React.FC<HistoricalSimulationEnginePageProps> = ({ onApplyWeights, initialWeights }) => {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [progress, setProgress] = useState<{ message: string; percentage: number }>({ message: '', percentage: 0 });
    const [validationReport, setValidationReport] = useState<ValidationReport | null>(null);
    const [savedModels, setSavedModels] = useState<TunedModel[]>([]);
    const [cachedGameCount, setCachedGameCount] = useState(0);
    const [logEntries, setLogEntries] = useState<string[]>(['[SYSTEM] Training dashboard initialized. Ready for simulation.']);
    const [isContinuousTraining, setIsContinuousTraining] = useState(false);
    
    // Use a ref to control the loop to avoid issues with stale state in async functions
    const isRunningRef = useRef(false);
    const noImprovementCounterRef = useRef(0);

    const addLogEntry = useCallback((message: string) => {
        const timestamp = new Date().toLocaleTimeString();
        setLogEntries(prev => [...prev.slice(-100), `[${timestamp}] ${message}`]); // Keep log to last 100 entries
    }, []);

    const refreshSavedModels = useCallback(async () => {
        const models = await modelStore.getSavedModels();
        setSavedModels(models);
        setCachedGameCount(await modelStore.getHistoricalGameCount());
        return models;
    }, []);

    useEffect(() => {
        refreshSavedModels();
    }, [refreshSavedModels]);
    
    // The main continuous training loop effect
    useEffect(() => {
        const runTrainingLoop = async () => {
            while (isRunningRef.current) {
                addLogEntry('[ENGINE] Starting new training cycle...');
                setIsLoading(true);
                setError(null);
                setValidationReport(null);
                
                try {
                    const report = await runFullSimulation((message, percentage) => {
                        setProgress({ message, percentage });
                        if (percentage % 20 === 0 || percentage > 95) {
                            addLogEntry(`[SIM] ${message}`);
                        }
                    });
                    setValidationReport(report);
                    addLogEntry(`[VALIDATION] Cycle complete. ${report.models.length} candidate models produced.`);

                    // Auto-promote the best model if it's an improvement
                    if (report.models.length > 0) {
                        const bestNewModel = report.models[0];
                        const currentModels = await refreshSavedModels();
                        const bestSavedModel = currentModels[0]; // Models are pre-sorted by MAE

                        const newMae = bestNewModel.performance.validationMae;
                        const bestSavedMae = bestSavedModel?.performance.validationMae ?? Infinity;

                        if (newMae < bestSavedMae) {
                            noImprovementCounterRef.current = 0; // Reset counter on improvement
                            const modelName = `Chimera-Evo-MAE-${newMae.toFixed(4)}-${Date.now()}`;
                            addLogEntry(`[PROMOTION] New best model found! MAE: ${newMae.toFixed(4)} < ${bestSavedMae.toFixed(4)}. Saving as "${modelName}".`);
                            
                            const modelToSave = { ...bestNewModel, name: modelName };
                             await modelStore.saveModel(modelToSave.weights, modelToSave.performance, modelToSave.name, modelToSave.sourceDescription, modelToSave.gameScript);
                             await refreshSavedModels();

                        } else {
                            noImprovementCounterRef.current++;
                            addLogEntry(`[PERFORMANCE] No improvement found. Best MAE remains ${bestSavedMae.toFixed(4)}.`);
                            if (noImprovementCounterRef.current >= 3) {
                                addLogEntry(`[AUDITOR] Performance plateau detected after ${noImprovementCounterRef.current} cycles without improvement. The engine will continue seeking a breakthrough.`);
                            }
                        }
                    }

                } catch (e) {
                    const errorMessage = e instanceof Error ? e.message : "An unknown error occurred during the simulation.";
                    setError(errorMessage);
                    addLogEntry(`[ERROR] Cycle failed: ${errorMessage}`);
                } finally {
                    setIsLoading(false);
                    setProgress({ message: 'Cycle Complete!', percentage: 100 });
                    if (isRunningRef.current) {
                         addLogEntry('[ENGINE] Cycle finished. Waiting 10 seconds before next cycle...');
                         await new Promise(res => setTimeout(res, 10000));
                    }
                }
            }
        };

        if (isContinuousTraining) {
            isRunningRef.current = true;
            runTrainingLoop();
        } else {
            isRunningRef.current = false;
        }

        // Cleanup function to stop the loop when the component unmounts or state changes
        return () => {
            isRunningRef.current = false;
        };
    }, [isContinuousTraining, addLogEntry, refreshSavedModels]);


    const handleRunSimulation = async () => {
        setIsLoading(true);
        setError(null);
        setValidationReport(null);
        addLogEntry('Starting new manual simulation & validation session...');
        try {
            const report = await runFullSimulation((message, percentage) => {
                setProgress({ message, percentage });
                if(percentage % 10 === 0 || percentage > 95) { // Throttle log entries
                    addLogEntry(message);
                }
            });
            setValidationReport(report);
            addLogEntry(`Validation successful. ${report.models.length} candidate models produced.`);
        } catch (e) {
            const errorMessage = e instanceof Error ? e.message : "An unknown error occurred during the simulation.";
            setError(errorMessage);
            addLogEntry(`ERROR: ${errorMessage}`);
        } finally {
            setIsLoading(false);
            setProgress({ message: 'Simulation complete!', percentage: 100 });
            await refreshSavedModels(); 
            addLogEntry('Session complete.');
        }
    };
    
    const handleSaveModel = async (model: TunedModel, validationMae: number) => {
        const name = prompt("Enter a name for this model:", model.name);
        if (!name || !name.trim()) return;

        const modelToSave = { ...model, name, performance: { ...model.performance, validationMae } };
        await modelStore.saveModel(modelToSave.weights, modelToSave.performance, modelToSave.name, modelToSave.sourceDescription, modelToSave.gameScript);
        await refreshSavedModels();
        addLogEntry(`Promoted model "${name}" to library. Validation MAE: ${validationMae.toFixed(4)}`);
        alert(`Model "${name}" saved!`);
    }
    
    const handleDeleteModel = async (modelId: string, modelName: string) => {
        if(window.confirm(`Are you sure you want to delete the model "${modelName}"? This action cannot be undone.`)) {
            await modelStore.deleteModel(modelId);
            await refreshSavedModels();
            addLogEntry(`Deleted model "${modelName}" (ID: ${modelId}).`);
        }
    };

    const handleToggleContinuousTraining = () => {
        if (!isContinuousTraining) {
            noImprovementCounterRef.current = 0; // Reset counter when starting
        }
        setIsContinuousTraining(prev => !prev);
    };

    return (
        <div className="bg-black border border-gray-700 p-6 rounded-lg shadow-lg space-y-8">
            <div>
                <h1 className="text-3xl font-bold text-white mb-2">Quantitative Model Validation & Tuning Lab</h1>
                <p className="text-gray-400">Scientifically discover and validate predictive models using a rigorous train/validate methodology against historical data.</p>
                <p className="text-sm text-cyan-400 mt-2">Historical Data Vault: <span className="font-bold">{cachedGameCount}</span> pre-processed games available in local cache.</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 <button onClick={handleRunSimulation} disabled={isLoading || isContinuousTraining} className="w-full flex items-center justify-center gap-3 bg-red-700 hover:bg-red-600 text-white font-bold py-4 px-6 rounded-lg transition duration-300 disabled:bg-gray-600 disabled:cursor-not-allowed">
                    {isLoading && !isContinuousTraining ? <SpinnerIcon /> : <LightbulbIcon />}
                    {isLoading && !isContinuousTraining ? 'Running Simulation...' : 'Run Single Simulation'}
                </button>
                <button onClick={handleToggleContinuousTraining} disabled={isLoading && !isContinuousTraining} className={`w-full flex items-center justify-center gap-3 font-bold py-4 px-6 rounded-lg transition duration-300 ${isContinuousTraining ? 'bg-gray-700 hover:bg-gray-600 text-white' : 'bg-green-700 hover:bg-green-600 text-white'} disabled:bg-gray-600 disabled:cursor-not-allowed`}>
                    {isLoading && isContinuousTraining ? <SpinnerIcon /> : <span className="text-2xl">♾️</span>}
                    {isContinuousTraining ? 'Stop Training Engine' : 'Start Continuous Training Engine'}
                </button>
            </div>
             
            {isLoading && (
                 <div>
                    <div className="w-full bg-gray-800 rounded-full h-4 border border-gray-600 overflow-hidden">
                        <div className="bg-red-600 h-full rounded-full transition-all duration-500" style={{ width: `${progress.percentage}%` }}></div>
                    </div>
                    <p className="text-center text-xs mt-2 text-gray-300">{progress.message}</p>
                </div>
            )}
            
            {error && <div className="p-3 bg-red-500/20 text-red-300 border border-red-500 rounded">{error}</div>}
            
            <TrainingDashboard logEntries={logEntries} models={savedModels} />

            {validationReport && (
                 <div className="border-t border-gray-700 pt-6 animate-fade-in">
                    <h2 className="text-2xl font-bold mb-4 text-white">Validation Report</h2>
                    <div className="bg-gray-900 p-4 rounded-lg border border-gray-700">
                       <p className="text-sm text-gray-400 mb-4">The following models were discovered using a <span className="font-bold text-white">{validationReport.trainingSetSize}-game training set</span> and then tested on a blind <span className="font-bold text-white">{validationReport.validationSetSize}-game validation set</span>. A lower MAE (Mean Absolute Error) on the validation set indicates a more predictively accurate model.</p>
                       <div className="space-y-3">
                           {validationReport.models.map((model, index) => (
                               <div key={model.id} className={`p-4 rounded-lg border ${index === 0 ? 'bg-green-900/50 border-green-500' : 'bg-gray-800 border-gray-700'}`}>
                                   <div className="flex flex-col sm:flex-row justify-between sm:items-center">
                                       <div>
                                            <h3 className="text-lg font-bold text-white">{index + 1}. {model.name}</h3>
                                            <p className="text-xs text-gray-500">{model.sourceDescription}</p>
                                       </div>
                                       <div className="text-left sm:text-right mt-2 sm:mt-0">
                                            <p className="text-xs text-gray-400">Validation MAE</p>
                                            <p className="text-2xl font-bold text-green-400">{model.performance.validationMae.toFixed(4)}</p>
                                       </div>
                                   </div>
                                   <div className="mt-3 flex gap-2">
                                       <button onClick={() => handleSaveModel(model, model.performance.validationMae)} className="text-xs bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-1 px-3 rounded">
                                           Promote to Library
                                       </button>
                                       <button onClick={() => onApplyWeights(model.weights)} className="text-xs bg-gray-600 hover:bg-gray-500 text-white font-bold py-1 px-3 rounded">
                                            Preview in Optimizer
                                       </button>
                                   </div>
                               </div>
                           ))}
                       </div>
                    </div>
                </div>
            )}
                
            <div className="border-t border-gray-700 pt-6">
                <h2 className="text-2xl font-bold mb-4 text-white">Saved Models Library</h2>
                <div className="space-y-2 max-h-96 overflow-y-auto pr-2">
                    {savedModels.length > 0 ? savedModels.map((model, index) => (
                        <div key={model.id} className={`p-3 rounded-md flex justify-between items-center border ${index === 0 ? 'bg-green-900/40 border-green-500/50' : 'bg-gray-800 border-gray-700'}`}>
                            <div>
                                <p className="font-bold text-white">{model.name}</p>
                                <p className="text-xs text-gray-400">
                                    Validation MAE: <span className="font-bold text-green-400">{model.performance.validationMae?.toFixed(4) || 'N/A'}</span> | 
                                    Saved: {new Date(model.createdAt).toLocaleString()}
                                </p>
                            </div>
                            <div className="flex gap-2">
                                <button onClick={() => onApplyWeights(model.weights)} className="text-xs bg-green-600 hover:bg-green-500 text-white font-bold py-1 px-3 rounded">Apply</button>
                                <button onClick={() => handleDeleteModel(model.id, model.name)} className="text-xs bg-red-800 hover:bg-red-700 text-white font-bold py-1 px-3 rounded">Delete</button>
                            </div>
                        </div>
                    )) : <p className="text-gray-500 italic">No models saved yet. Run a simulation to discover, validate, and promote a new model.</p>}
                </div>
            </div>
        </div>
    );
};

export default HistoricalSimulationEnginePage;