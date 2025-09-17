import { OptimizerSettings, BacktestReport, Player, Lineup, StackingRules } from '../types';
import { OptimizationTarget } from './optimizer';

// A type-safe representation of the tasks our worker can perform.
type WorkerTask = 
  | { type: 'GENERATE_LINEUPS', payload: {
        players: Player[],
        lockedPlayers: Player[],
        excludedIds: string[],
        numberOfLineups: number,
        salaryCap: number,
        stackingRules: StackingRules,
        optimizationTarget: OptimizationTarget,
    }}
  | { type: 'RUN_BACKTEST', payload: {
        settings: OptimizerSettings,
        currentPlayers: Player[],
    }};

type ProgressCallback = (message: string, percentage: number) => void;

interface PendingTask {
    resolve: (value: any) => void;
    reject: (reason?: any) => void;
    onProgress?: ProgressCallback;
}

let worker: Worker | null = null;
let taskIdCounter = 0;
const pendingTasks = new Map<number, PendingTask>();

function getWorker(): Worker {
    if (!worker) {
        worker = new Worker('/worker.js', { type: 'module' });
        
        worker.onmessage = (event) => {
            const { id, type, payload } = event.data;
            const task = pendingTasks.get(id);
            if (!task) return;

            if (type === 'SUCCESS') {
                task.resolve(payload);
                pendingTasks.delete(id);
            } else if (type === 'ERROR') {
                const error = new Error(payload.message);
                error.stack = payload.stack;
                task.reject(error);
                pendingTasks.delete(id);
            } else if (type === 'PROGRESS') {
                if (task.onProgress) {
                    task.onProgress(payload.message, payload.percentage);
                }
            }
        };

        worker.onerror = (error) => {
            console.error("Unhandled worker error:", error);
            // Reject all pending tasks on a catastrophic worker failure
            for (const [id, task] of pendingTasks.entries()) {
                task.reject(new Error("The background worker crashed."));
                pendingTasks.delete(id);
            }
        };
    }
    return worker;
}

function postTask<T>(type: WorkerTask['type'], payload: WorkerTask['payload'], onProgress?: ProgressCallback): Promise<T> {
    return new Promise<T>((resolve, reject) => {
        const id = taskIdCounter++;
        pendingTasks.set(id, { resolve, reject, onProgress });
        getWorker().postMessage({ id, type, payload });
    });
}

export function generateLineupsInWorker(
    players: Player[],
    lockedPlayers: Player[],
    excludedIds: Set<string>,
    numberOfLineups: number,
    salaryCap: number,
    stackingRules: StackingRules,
    optimizationTarget: OptimizationTarget
): Promise<Lineup[]> {
    return postTask<Lineup[]>('GENERATE_LINEUPS', {
        players,
        lockedPlayers,
        excludedIds: Array.from(excludedIds), // Convert Set to Array for transfer
        numberOfLineups,
        salaryCap,
        stackingRules,
        optimizationTarget
    });
}

export function runBacktestInWorker(
    settings: OptimizerSettings,
    currentPlayers: Player[],
    onProgress: ProgressCallback
): Promise<BacktestReport> {
    return postTask<BacktestReport>('RUN_BACKTEST', { settings, currentPlayers }, onProgress);
}
