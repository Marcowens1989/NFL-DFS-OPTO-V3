import React, { useState, useEffect, useCallback, useRef } from 'react';
import { TunedModel, ValidationReport, SimulationParams, CalibrationReport } from '../types';
import { runFullSimulation } from '../services/historicalSimulationService';
import { modelStore } from '../services/modelStore';
import SpinnerIcon from './icons/SpinnerIcon';
import LightbulbIcon from './icons/LightbulbIcon';
import TrainingDashboard from './TrainingDashboard';
import { VAULT_SIZE } from '../services/historicalDataVaultService';
import ModelDetailModal from './ModelDetailModal';
import InspectIcon from './icons/InspectIcon';
import SimulationControls from './SimulationControls';

interface HistoricalSimulationEnginePageProps {
  onApplyModel: (model: TunedModel) => void;
}

const getModelSourceCode = (name: string): string => {
    if (name.includes('Ensemble')) return 'Ensemble';
    if (name.includes('Correlation-Infused')) return 'CorrQuant';
    if (name.includes('Master Quant')) return 'QuantReg';
    if (name.includes('Sabermetric')) return 'Saber';
    if (name.includes('Averaged Hindsight')) return 'AvgAI';
    if (name.endsWith(' Model') && name.split(' ').length === 2) {
        return `${name.split(' ')[0].substring(0, 8)}AI`;
    }
    return 'Custom';
};

const ValidationReportDisplay: React.FC<{
    report: ValidationReport,
    onSave: (model: TunedModel) => void,
    onPreview: (model: TunedModel) => void,
}> = ({ report, onSave, onPreview }) => (
    <div className="border-t border-gray-700 pt-6 animate-fade-in">
        <h2 className="text-2xl font-bold mb-4 text-white">Validation Report</h2>
        <div className="bg-gray-900 p-4 rounded-lg border border-gray-700">
           <p className="text-sm text-gray-400 mb-4">The following models were discovered using a <span className="font-bold text-white">{report.trainingSetSize}-game training set</span> and then tested on a blind <span className="font-bold text-white">{report.validationSetSize}-game validation set</span>. A lower MAE (Mean Absolute Error) indicates a more accurate model.</p>
           <div className="space-y-3">
               {report.models.map((model, index) => (
                   <div key={model.id} className={`p-4 rounded-lg border ${index === 0 ? 'bg-green-900/50 border-green-500' : 'bg-gray-800 border-gray-700'}`}>
                       <div className="flex flex-col sm:flex-row justify-between sm:items-start">
                           <div>
                                <h3 className="text-lg font-bold text-white">{index + 1}. {model.name}</h3>
                                <p className="text-xs text-gray-500">{model.sourceDescription}</p>
                           </div>
                           <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center mt-2 sm:mt-0">
                               <Metric title="MAE" value={model.performance.calibration?.mae.toFixed(4) || 'N/A'} isPrimary={true} />
                               <Metric title="CRPS" value={model.performance.calibration?.crps.toFixed(4) || 'N/A'} />
                               <Metric title="PIT p-val" value={model.performance.calibration?.pitKsPValue.toFixed(3) || 'N/A'} />
                               <Metric title="P50 Cov." value={`${(model.performance.calibration?.p50Coverage || 0).toFixed(1)}%`} />
                           </div>
                       </div>
                       <div className="mt-3 flex gap-2">
                           <button onClick={() => onSave(model)} className="text-xs bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-1 px-3 rounded">
                               Promote to Library
                           </button>
                           <button onClick={() => onPreview(model)} className="text-xs bg-gray-600 hover:bg-gray-500 text-white font-bold py-1 px-3 rounded">
                                Preview in Optimizer
                           </button>
                       </div>
                   </div>
               ))}
           </div>
        </div>
    </div>
);

const Metric: React.FC<{title: string, value: string, isPrimary?: boolean}> = ({ title, value, isPrimary }) => (
    <div className={isPrimary ? "sm:text-right" : ""}>
        <p className={`text-xs ${isPrimary ? 'text-gray-400' : 'text-gray-500'}`}>{title}</p>
        <p className={`font-bold ${isPrimary ? 'text-2xl text-green-400' : 'text-md text-gray-300'}`}>{value}</p>
    </div>
);


const HistoricalSimulationEnginePage: React.FC<HistoricalSimulationEnginePageProps> = ({ onApplyModel }) => {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [progress, setProgress] = useState<{ message: string; percentage: number }>({ message: '', percentage: 0 });
    const [validationReport, setValidationReport] = useState<ValidationReport | null>(null);
    const [savedModels, setSavedModels] = useState<TunedModel[]>([]);
    const [cachedGameCount, setCachedGameCount] = useState(0);
    const [logEntries, setLogEntries] = useState<string[]>(['[SYSTEM] Training dashboard initialized. Ready for simulation.']);
    const [isContinuousTraining, setIsContinuousTraining] = useState(false);
    const [inspectedModel, setInspectedModel] = useState<TunedModel | null>(null);
    const [simulationParams, setSimulationParams] = useState<SimulationParams>({
        trainValidateSplit: 75,
        topKEnsemble: 3,
    });
    
    const isRunningRef = useRef(false);
    const noImprovementCounterRef = useRef(0);

    const addLogEntry = useCallback((message: string) => {
        const timestamp = new Date().toLocaleTimeString();
        setLogEntries(prev => [...prev.slice(-100), `[${timestamp}] ${message}`]);
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
    
    const runSimulationCycle = async () => {
        addLogEntry('[ENGINE] Starting new training cycle...');
        setIsLoading(true);
        setError(null);
        setValidationReport(null);

        try {
            const report = await runFullSimulation(
                simulationParams,
                (message, percentage) => {
                    setProgress({ message, percentage });
                    if (percentage % 20 === 0 || percentage > 95) {
                        addLogEntry(`[SIM] ${message}`);
                    }
                }
            );
            setValidationReport(report);
            addLogEntry(`[VALIDATION] Cycle complete. ${report.models.length} candidate models produced.`);

            if (report.models.length > 0) {
                const bestNewModel = report.models[0];
                const currentModels = await refreshSavedModels();
                const bestSavedModel = currentModels[0];
                const newMae = bestNewModel.performance.calibration?.mae ?? Infinity;
                const bestSavedMae = bestSavedModel?.performance.calibration?.mae ?? Infinity;

                if (newMae < bestSavedMae) {
                    noImprovementCounterRef.current = 0;
                    const modelName = `Chimera-Evo-MAE-${newMae.toFixed(4)}-${getModelSourceCode(bestNewModel.name)}-${Date.now()}`;
                    addLogEntry(`[PROMOTION] New best model! MAE: ${newMae.toFixed(4)} < ${bestSavedMae.toFixed(4)}. Saving as "${modelName}".`);
                    const modelToSave = { ...bestNewModel, name: modelName };
                    await modelStore.saveModel(modelToSave.weights, modelToSave.performance, modelToSave.name, modelToSave.sourceDescription, modelToSave.gameScript);
                    await refreshSavedModels();
                } else {
                    noImprovementCounterRef.current++;
                    addLogEntry(`[PERFORMANCE] No improvement found. Best MAE remains ${bestSavedMae.toFixed(4)}.`);
                    if (noImprovementCounterRef.current >= 3) {
                        addLogEntry(`[AUDITOR] Performance plateau detected after ${noImprovementCounterRef.current} cycles.`);
                    }
                }
            }
        } catch (e) {
            const errorMessage = e instanceof Error ? e.message : "An unknown error occurred.";
            setError(errorMessage);
            addLogEntry(`[ERROR] Cycle failed: ${errorMessage}`);
        } finally {
            setIsLoading(false);
            setProgress({ message: 'Cycle Complete!', percentage: 100 });
        }
    };

    useEffect(() => {
        const runLoop = async () => {
            while (isRunningRef.current) {
                await runSimulationCycle();
                if (isRunningRef.current) {
                    addLogEntry('[ENGINE] Waiting 10s before next cycle...');
                    await new Promise(res => setTimeout(res, 10000));
                }
            }
        };

        if (isContinuousTraining) {
            isRunningRef.current = true;
            runLoop();
        } else {
            isRunningRef.current = false;
        }

        return () => { isRunningRef.current = false; };
    }, [isContinuousTraining, addLogEntry, refreshSavedModels, simulationParams]);

    const handleSaveModel = async (model: TunedModel) => {
        const name = prompt("Enter a name for this model:", model.name);
        if (!name || !name.trim()) return;
        const modelToSave = { ...model, name };
        await modelStore.saveModel(modelToSave.weights, modelToSave.performance, modelToSave.name, modelToSave.sourceDescription, modelToSave.gameScript);
        await refreshSavedModels();
        addLogEntry(`Promoted model "${name}" to library. Validation MAE: ${model.performance.calibration?.mae.toFixed(4)}`);
    };
    
    const handleDeleteModel = async (modelId: string, modelName: string) => {
        if(window.confirm(`Are you sure you want to delete "${modelName}"?`)) {
            await modelStore.deleteModel(modelId);
            await refreshSavedModels();
            addLogEntry(`Deleted model "${modelName}".`);
        }
    };

    return (
        <>
            <div className="bg-black border border-gray-700 p-6 rounded-lg shadow-lg space-y-8">
                <div>
                    <h1 className="text-3xl font-bold text-white mb-2">Quantitative Model Validation & Tuning Lab</h1>
                    <p className="text-gray-400">This lab uses a rigorous train/validate methodology against the Chronos Data Vault to discover, test, and promote new projection models.</p>
                     <p className="text-sm text-cyan-400 mt-2">
                        The engine learns from a vault of <span className="font-bold">{VAULT_SIZE}</span> historical games. Cached games: <span className="font-bold">{cachedGameCount}</span>/{VAULT_SIZE}.
                    </p>
                </div>

                <SimulationControls params={simulationParams} onParamsChange={setSimulationParams} isDisabled={isLoading || isContinuousTraining} />
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                     <button onClick={runSimulationCycle} disabled={isLoading || isContinuousTraining} className="w-full flex items-center justify-center gap-3 bg-red-700 hover:bg-red-600 text-white font-bold py-4 px-6 rounded-lg transition duration-300 disabled:bg-gray-600">
                        {isLoading && !isContinuousTraining ? <SpinnerIcon /> : <LightbulbIcon />}
                        {isLoading && !isContinuousTraining ? 'Running...' : 'Run Single Simulation'}
                    </button>
                    <button onClick={() => setIsContinuousTraining(p => !p)} disabled={isLoading && !isContinuousTraining} className={`w-full flex items-center justify-center gap-3 font-bold py-4 px-6 rounded-lg transition duration-300 ${isContinuousTraining ? 'bg-gray-700 hover:bg-gray-600' : 'bg-green-700 hover:bg-green-600'} text-white`}>
                        {isLoading && isContinuousTraining ? <SpinnerIcon /> : <span className="text-2xl">♾️</span>}
                        {isContinuousTraining ? 'Stop Training Engine' : 'Start Continuous Training'}
                    </button>
                </div>
                 
                {isLoading && (
                     <div>
                        <div className="w-full bg-gray-800 rounded-full h-4 border border-gray-600 overflow-hidden">
                            <div className="bg-red-600 h-full rounded-full transition-all" style={{ width: `${progress.percentage}%` }}></div>
                        </div>
                        <p className="text-center text-xs mt-2 text-gray-300">{progress.message}</p>
                    </div>
                )}
                
                {error && <div className="p-3 bg-red-500/20 text-red-300 border border-red-500 rounded">{error}</div>}
                
                <TrainingDashboard logEntries={logEntries} models={savedModels} isTraining={isContinuousTraining} />

                {validationReport && <ValidationReportDisplay report={validationReport} onSave={handleSaveModel} onPreview={onApplyModel} />}
                    
                <div className="border-t border-gray-700 pt-6">
                    <h2 className="text-2xl font-bold mb-4 text-white">Saved Models Library</h2>
                    <div className="space-y-2 max-h-96 overflow-y-auto pr-2">
                        {savedModels.length > 0 ? savedModels.map((model, index) => (
                            <div key={model.id} className={`p-3 rounded-md flex justify-between items-center border ${index === 0 ? 'bg-green-900/40 border-green-500/50' : 'bg-gray-800 border-gray-700'}`}>
                                <div>
                                    <p className="font-bold text-white">{model.name}</p>
                                    <p className="text-xs text-gray-400">
                                        Validation MAE: <span className="font-bold text-green-400">{model.performance.calibration?.mae?.toFixed(4) || 'N/A'}</span> | 
                                        Saved: {new Date(model.createdAt).toLocaleString()}
                                    </p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button onClick={() => setInspectedModel(model)} className="p-2 rounded-md hover:bg-gray-700" title="Inspect Model Weights"><InspectIcon /></button>
                                    <button onClick={() => onApplyModel(model)} className="text-xs bg-green-600 hover:bg-green-500 text-white font-bold py-2 px-3 rounded">Apply</button>
                                    <button onClick={() => handleDeleteModel(model.id, model.name)} className="text-xs bg-red-800 hover:bg-red-700 text-white font-bold py-2 px-3 rounded">Delete</button>
                                </div>
                            </div>
                        )) : <p className="text-gray-500 italic">No models saved. Run a simulation to discover, validate, and promote a new model.</p>}
                    </div>
                </div>
            </div>
            <ModelDetailModal model={inspectedModel} onClose={() => setInspectedModel(null)} />
        </>
    );
};

export default HistoricalSimulationEnginePage;