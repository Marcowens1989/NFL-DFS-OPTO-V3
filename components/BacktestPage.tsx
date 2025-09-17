import React, { useState, useEffect, useCallback } from 'react';
import { OptimizerSettings, BacktestReport, Player } from '../types';
import SpinnerIcon from './icons/SpinnerIcon';
import { runBacktestInWorker } from '../services/workerClient';

interface BacktestPageProps {
  settings: OptimizerSettings | null;
  players: Player[]; // Current player pool for ID/name mapping
  onBacktestComplete: (report: BacktestReport) => void;
}

const BacktestPage: React.FC<BacktestPageProps> = ({ settings, players, onBacktestComplete }) => {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [progress, setProgress] = useState<{ message: string; percentage: number }>({ message: '', percentage: 0 });
    
    // Auto-run the backtest when the component loads with settings
    useEffect(() => {
        if (settings && players.length > 0) {
            handleRunBacktest();
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [settings, players]);


    const handleRunBacktest = useCallback(async () => {
        if (!settings || players.length === 0) {
            setError("Optimizer settings or the player pool are missing. Please configure a lineup run on the Optimizer page first.");
            return;
        }

        setIsLoading(true);
        setError(null);
        setProgress({ message: '', percentage: 0 });

        try {
            // Use the worker to run the backtest off the main thread
            const backtestReport = await runBacktestInWorker(
                settings, 
                players, 
                (message, percentage) => {
                    setProgress({ message, percentage });
                }
            );
            onBacktestComplete(backtestReport);
        } catch (e) {
            setError(e instanceof Error ? e.message : "An unknown error occurred during the backtest.");
        } finally {
            setIsLoading(false);
        }
    }, [settings, players, onBacktestComplete]);

    if (!settings) {
        return (
            <div className="bg-black border border-gray-700 p-6 rounded-lg shadow-lg text-center">
                <h1 className="text-2xl font-bold text-white mb-4">Backtest Engine</h1>
                <p className="text-gray-400">
                    To run a backtest, first go to the 'Optimizer' tab, set up your desired player exposures and rules, and then click "Run Backtest on Historical Data".
                </p>
            </div>
        );
    }
    
    return (
        <div className="bg-black border border-gray-700 p-6 rounded-lg shadow-lg space-y-6">
            <div>
                <h1 className="text-3xl font-bold text-white mb-2">Backtest Engine</h1>
                <p className="text-gray-400">
                    Test your current optimizer settings against a vault of historical game data to see how your strategy would have performed.
                </p>
            </div>
            
            <div className="bg-gray-800/50 p-4 rounded-lg border border-gray-700">
                <h3 className="font-bold text-lg mb-2 text-white">Active Settings</h3>
                <p className="text-sm text-gray-400">Locked Players: {settings.lockedPlayerIds.length}</p>
                <p className="text-sm text-gray-400">Excluded Players: {settings.excludedPlayerIds.length}</p>
                <p className="text-sm text-gray-400">Lineups to Generate per Game: {settings.numberOfLineups}</p>
            </div>
            
            {isLoading && (
                 <div className="flex flex-col items-center justify-center text-center p-8">
                    <SpinnerIcon />
                    <p className="text-lg font-bold mt-4 text-white">Running Historical Simulation...</p>
                    <div className="w-full max-w-md mt-4">
                        <div className="w-full bg-gray-800 rounded-full h-4 border border-gray-600 overflow-hidden">
                            <div className="bg-red-600 h-full rounded-full transition-all duration-500" style={{ width: `${progress.percentage}%` }}></div>
                        </div>
                        <p className="text-center text-xs mt-2 text-gray-300">{progress.message}</p>
                    </div>
                     <p className="text-xs text-gray-500 mt-4">You will be returned to the optimizer page when the backtest is complete.</p>
                </div>
            )}

            {error && <div className="p-3 bg-red-500/20 text-red-300 border border-red-500 rounded">{error}</div>}

        </div>
    );
};

export default BacktestPage;