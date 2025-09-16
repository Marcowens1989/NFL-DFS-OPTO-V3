import React, { useState, useCallback, useRef } from 'react';
import { HistoricalPlayerStats, StatWeights } from '../types';
import UploadIcon from './icons/UploadIcon';

const DEFAULT_STAT_WEIGHTS: StatWeights = {
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

// A reusable slider component for a clean UI
const StatSlider: React.FC<{
    label: string;
    value: number;
    min: number;
    max: number;
    step: number;
    onChange: (value: number) => void;
}> = ({ label, value, min, max, step, onChange }) => (
    <div className="mb-4">
        <label className="flex justify-between items-center text-sm text-gray-400 mb-2">
            <span>{label}</span>
            <span className="font-mono text-white bg-gray-700 px-2 py-0.5 rounded">{value.toFixed(3)}</span>
        </label>
        <input
            type="range"
            min={min}
            max={max}
            step={step}
            value={value}
            onChange={(e) => onChange(parseFloat(e.target.value))}
            className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
        />
    </div>
);


const BacktestPage: React.FC = () => {
  const [historicalData, setHistoricalData] = useState<HistoricalPlayerStats[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [statWeights, setStatWeights] = useState<StatWeights>(DEFAULT_STAT_WEIGHTS);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleWeightChange = useCallback((key: keyof StatWeights, value: number) => {
    setStatWeights(prev => ({ ...prev, [key]: value }));
  }, []);

  const handleFileChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setError(null);
    setHistoricalData([]);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const lines = text.split(/\r?\n/).filter(line => line.trim() !== '');
        
        if (lines.length < 2) {
          throw new Error("CSV file must have a header and at least one data row.");
        }

        const header = lines[0].toLowerCase().split(',').map(h => h.trim().replace(/"/g, ''));
        
        const statMap: { [key: string]: keyof HistoricalPlayerStats } = {
          'player id': 'id', 'id': 'id',
          'player name': 'name', 'name': 'name', 'nickname': 'name',
          'passing yards': 'passYds', 'pass yds': 'passYds',
          'passing tds': 'passTds', 'pass tds': 'passTds',
          'interceptions': 'interceptions', 'ints': 'interceptions',
          'rushing yards': 'rushYds', 'rush yds': 'rushYds',
          'rushing tds': 'rushTds', 'rush tds': 'rushTds',
          'receptions': 'receptions', 'rec': 'receptions',
          'receiving yards': 'recYds', 'rec yds': 'recYds',
          'receiving tds': 'recTds', 'rec tds': 'recTds',
          'fumbles lost': 'fumblesLost', 'fumbles': 'fumblesLost',
          'actual fdp': 'actualFdp', 'actual fanduel points': 'actualFdp', 'actual': 'actualFdp'
        };

        const indices: { [key in keyof HistoricalPlayerStats]?: number } = {};
        header.forEach((h, i) => {
          if (statMap[h]) {
            indices[statMap[h]] = i;
          }
        });
        
        const requiredKeys: (keyof HistoricalPlayerStats)[] = ['id', 'name', 'actualFdp'];
        for (const key of requiredKeys) {
          if (indices[key] === undefined) {
            throw new Error(`CSV header is missing a required column for: '${key}'. Please check your file.`);
          }
        }
        
        const data: HistoricalPlayerStats[] = lines.slice(1).map((line, index) => {
          const rowData = line.match(/(".*?"|[^",]+)(?=\s*,|\s*$)/g)?.map(field => field.trim().replace(/"/g, '')) || [];
          
          const getStat = (key: keyof HistoricalPlayerStats): number => {
              const idx = indices[key];
              if (idx === undefined || idx >= rowData.length) return 0;
              return parseFloat(rowData[idx]) || 0;
          };

          const idIdx = indices.id as number;
          const nameIdx = indices.name as number;

          const id = idIdx < rowData.length ? rowData[idIdx] : `row-${index}`;
          const name = nameIdx < rowData.length ? rowData[nameIdx] : 'Unknown Player';

          if (!id || !name) {
              console.warn(`Skipping row ${index + 2} due to missing ID or Name.`);
              return null;
          }

          return {
            id,
            name,
            passYds: getStat('passYds'),
            passTds: getStat('passTds'),
            interceptions: getStat('interceptions'),
            rushYds: getStat('rushYds'),
            rushTds: getStat('rushTds'),
            receptions: getStat('receptions'),
            recYds: getStat('recYds'),
            recTds: getStat('recTds'),
            fumblesLost: getStat('fumblesLost'),
            actualFdp: getStat('actualFdp'),
          };
        }).filter((p): p is HistoricalPlayerStats => p !== null);

        if (data.length === 0) {
          throw new Error("No valid player data could be parsed from the file.");
        }

        setHistoricalData(data);
      } catch (error) {
        setError(error instanceof Error ? error.message : "Failed to parse CSV file.");
        setFileName(null);
      }
    };
    reader.onerror = () => {
        setError("Error reading file.");
        setFileName(null);
    };
    reader.readAsText(file);
  }, []);

  const handleButtonClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="bg-black border border-gray-700 p-6 rounded-lg shadow-lg">
      <h1 className="text-3xl font-bold text-white mb-4">Backtesting & Stat Weight Analysis</h1>
      
      <div className="border-t border-gray-700 pt-6">
        <h2 className="text-2xl font-bold mb-4 text-white">1. Load Historical Slate Data</h2>
        <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept=".csv"
            className="hidden"
        />
        <button
            onClick={handleButtonClick}
            className="w-full max-w-md flex items-center justify-center gap-2 bg-gray-700 hover:bg-gray-600 text-white font-bold py-3 px-4 rounded-lg transition duration-300"
        >
            <UploadIcon />
            Upload Historical Player Stats CSV
        </button>

        {fileName && !error && (
            <div className="mt-4 p-3 bg-green-500/20 text-green-300 border border-green-500 rounded max-w-md">
                Successfully loaded <strong>{fileName}</strong> with <strong>{historicalData.length}</strong> players.
            </div>
        )}

        {error && (
            <div className="mt-4 p-3 bg-red-500/20 text-red-300 border border-red-500 rounded max-w-md">
                {error}
            </div>
        )}

        <p className="text-xs text-left mt-2 text-gray-500 max-w-md">
            Upload a CSV with historical raw player stats and actual FanDuel points (ActualFDP). <br/>
            Required columns: 'ID', 'Name', 'ActualFDP'. Optional stat columns will be used for weight analysis.
        </p>
      </div>

      {historicalData.length > 0 && (
        <div className="border-t border-gray-700 pt-6 mt-8">
            <h2 className="text-2xl font-bold mb-4 text-white">2. Adjust Stat Weights</h2>
            <p className="text-sm text-gray-400 mb-6">
                Fine-tune the scoring model. These weights determine how many fantasy points are awarded for each statistical category.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-4">
                
                <div>
                    <h3 className="text-lg font-semibold text-indigo-300 mb-3 border-b border-gray-700 pb-2">Passing</h3>
                    <StatSlider label="Passing Yards (per yd)" value={statWeights.passYds} min={0} max={0.2} step={0.005} onChange={(v) => handleWeightChange('passYds', v)} />
                    <StatSlider label="Passing TD" value={statWeights.passTds} min={0} max={8} step={0.5} onChange={(v) => handleWeightChange('passTds', v)} />
                    <StatSlider label="Interception" value={statWeights.interceptions} min={-4} max={0} step={0.25} onChange={(v) => handleWeightChange('interceptions', v)} />
                </div>

                <div>
                    <h3 className="text-lg font-semibold text-indigo-300 mb-3 border-b border-gray-700 pb-2">Rushing</h3>
                    <StatSlider label="Rushing Yards (per yd)" value={statWeights.rushYds} min={0} max={0.3} step={0.01} onChange={(v) => handleWeightChange('rushYds', v)} />
                    <StatSlider label="Rushing TD" value={statWeights.rushTds} min={0} max={8} step={0.5} onChange={(v) => handleWeightChange('rushTds', v)} />
                </div>
                
                 <div>
                    <h3 className="text-lg font-semibold text-indigo-300 mb-3 border-b border-gray-700 pb-2">Receiving</h3>
                    <StatSlider label="Reception" value={statWeights.receptions} min={0} max={2} step={0.1} onChange={(v) => handleWeightChange('receptions', v)} />
                    <StatSlider label="Receiving Yards (per yd)" value={statWeights.recYds} min={0} max={0.3} step={0.01} onChange={(v) => handleWeightChange('recYds', v)} />
                    <StatSlider label="Receiving TD" value={statWeights.recTds} min={0} max={8} step={0.5} onChange={(v) => handleWeightChange('recTds', v)} />
                </div>

                <div>
                    <h3 className="text-lg font-semibold text-indigo-300 mb-3 border-b border-gray-700 pb-2">Misc</h3>
                    <StatSlider label="Fumble Lost" value={statWeights.fumblesLost} min={-4} max={0} step={0.25} onChange={(v) => handleWeightChange('fumblesLost', v)} />
                </div>

            </div>
        </div>
      )}

    </div>
  );
};

export default BacktestPage;