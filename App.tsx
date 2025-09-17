import React, { useState, useCallback, useEffect } from 'react';
import Header from './components/Header';
import OptimizerPage from './components/OptimizerPage';
import HistoricalSimulationEnginePage from './components/HistoricalSimulationEnginePage';
import PostSlateAnalysisPage from './components/PostSlateAnalysisPage';
import ErrorBoundary from './components/ErrorBoundary';
import { StatWeights, Player, OptimizerSettings, TunedModel, BacktestReport } from './types';
import { INITIAL_WEIGHTS } from './services/historicalSimulationService';
import BacktestPage from './components/BacktestPage';
import { modelStore } from './services/modelStore';

export type AppTab = 'optimizer' | 'lab' | 'post-slate' | 'backtest';

function App() {
  const [activeTab, setActiveTab] = useState<AppTab>('optimizer');
  const [statWeights, setStatWeights] = useState<StatWeights>(INITIAL_WEIGHTS);
  const [players, setPlayers] = useState<Player[]>([]);
  const [backtestSettings, setBacktestSettings] = useState<OptimizerSettings | null>(null);
  const [savedModels, setSavedModels] = useState<TunedModel[]>([]);
  const [activeModelId, setActiveModelId] = useState<string | null>(null);
  const [backtestReport, setBacktestReport] = useState<BacktestReport | null>(null);


  useEffect(() => {
    // On initial load, fetch all saved models and set the best one as active.
    modelStore.getSavedModels().then(models => {
      setSavedModels(models);
      // Automatically apply the best model if one isn't already active
      if (!activeModelId && models.length > 0) {
        const bestModel = models[0]; // Models are pre-sorted by MAE
        setActiveModelId(bestModel.id);
        setStatWeights(bestModel.weights);
      }
    });
  }, [activeModelId]);


  const handleApplyModel = useCallback((model: TunedModel) => {
    setStatWeights(model.weights);
    setActiveModelId(model.id);
    // If applying from the lab, switch to the optimizer to see the effect
    if (activeTab === 'lab') {
        setActiveTab('optimizer');
    }
  }, [activeTab]);

  const handlePlayersChange = useCallback((newPlayers: Player[]) => {
    setPlayers(newPlayers);
    setBacktestReport(null); // Clear stale backtest report on new player file
  }, []);

  const handleRunBacktest = useCallback((settings: OptimizerSettings) => {
    setBacktestSettings(settings);
    setActiveTab('backtest');
  }, []);

  const handleBacktestComplete = useCallback((report: BacktestReport) => {
    setBacktestReport(report);
    setActiveTab('optimizer');
  }, []);


  return (
    <div className="min-h-screen bg-black font-sans text-white">
      <Header activeTab={activeTab} onTabChange={setActiveTab} />
      <main className="container mx-auto p-4 md:p-8">
        <ErrorBoundary>
          {activeTab === 'optimizer' && 
            <OptimizerPage 
              players={players}
              statWeights={statWeights} 
              onPlayersUpdate={handlePlayersChange} 
              onRunBacktest={handleRunBacktest}
              savedModels={savedModels}
              activeModelId={activeModelId}
              onApplyModel={handleApplyModel}
              backtestReport={backtestReport}
            />
          }
          {activeTab === 'lab' && <HistoricalSimulationEnginePage onApplyModel={handleApplyModel} />}
          {activeTab === 'post-slate' && <PostSlateAnalysisPage players={players} />}
          {activeTab === 'backtest' && <BacktestPage settings={backtestSettings} players={players} onBacktestComplete={handleBacktestComplete} />}
        </ErrorBoundary>
      </main>
    </div>
  );
}

export default App;