import { generateMultipleLineups } from '../services/optimizer.js';
import { runBacktest } from '../services/backtestService.js';

// Worker dispatcher
self.onmessage = async (event) => {
  const { id, type, payload } = event.data;

  try {
    if (type === 'GENERATE_LINEUPS') {
      const { players, lockedPlayers, excludedIds, numberOfLineups, salaryCap, stackingRules, optimizationTarget } = payload;
      // FIX: Re-added 'await' as generateMultipleLineups is an async function. This prevents a broken state.
      const lineups = await generateMultipleLineups(
        players,
        lockedPlayers,
        new Set(excludedIds), // Re-hydrate the Set
        numberOfLineups,
        salaryCap,
        stackingRules,
        optimizationTarget
      );
      self.postMessage({ id, type: 'SUCCESS', payload: lineups });
    } else if (type === 'RUN_BACKTEST') {
      const { settings, currentPlayers } = payload;
      // The onProgress callback will post messages back to the main thread
      const onProgress = (message, percentage) => {
        self.postMessage({ id, type: 'PROGRESS', payload: { message, percentage } });
      };
      const report = await runBacktest(settings, currentPlayers, onProgress);
      self.postMessage({ id, type: 'SUCCESS', payload: report });
    } else {
      throw new Error(`Unknown worker task type: ${type}`);
    }
  } catch (error) {
    self.postMessage({ 
        id, 
        type: 'ERROR', 
        payload: { 
            message: error.message, 
            stack: error.stack 
        }
    });
  }
};