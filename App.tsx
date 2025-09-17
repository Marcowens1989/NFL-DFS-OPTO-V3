import React, { useState } from 'react';
import Header from './components/Header';
import OptimizerPage from './components/OptimizerPage';
import HistoricalSimulationEnginePage from './components/HistoricalSimulationEnginePage';
import ErrorBoundary from './components/ErrorBoundary';
import { StatWeights } from './types';

export type AppTab = 'optimizer' | 'lab';

const INITIAL_WEIGHTS: StatWeights = {
    passYds: 0.04,
    passTds: 4,
    interceptions: -1,
    rushYds: 0.1,
    rushTds: 6,
    receptions: 0.5,
    recYds: 0.1,
    recTds: 6,
    fumblesLost: -2,
};

function App() {
  const [activeTab, setActiveTab] = useState<AppTab>('optimizer');
  const [statWeights, setStatWeights] = useState<StatWeights>(INITIAL_WEIGHTS);

  const handleStatWeightsChange = (newWeights: StatWeights) => {
    setStatWeights(newWeights);
    // Switch to the optimizer tab to see the effect
    setActiveTab('optimizer');
  };

  return (
    <div className="min-h-screen bg-black font-sans text-white">
      <Header activeTab={activeTab} onTabChange={setActiveTab} />
      <main className="container mx-auto p-4 md:p-8">
        <ErrorBoundary>
          {activeTab === 'optimizer' && <OptimizerPage statWeights={statWeights} />}
          {activeTab === 'lab' && <HistoricalSimulationEnginePage onApplyWeights={handleStatWeightsChange} initialWeights={statWeights} />}
        </ErrorBoundary>
      </main>
    </div>
  );
}

export default App;