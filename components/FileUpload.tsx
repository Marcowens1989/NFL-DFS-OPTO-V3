import React, { useCallback, useRef, useState } from 'react';
import { Player, PlayerStatus, StatProjections } from '../types';
import UploadIcon from './icons/UploadIcon';
import SpinnerIcon from './icons/SpinnerIcon';
import { generateOwnershipProjections } from '../services/ownership';
import { analyzePlayerValue } from '../services/valueAnalyzer';
import { validatePlayers, enrichGameData } from '../services/aiDataManager';

interface UploadData {
  players: Player[];
  statuses: Record<string, PlayerStatus>;
  validationReport: string;
}

interface FileUploadProps {
  onFileUpload: (data: UploadData) => void;
  onError: (message: string) => void;
}

const FileUpload: React.FC<FileUploadProps> = ({ onFileUpload, onError }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isLoading, setIsLoading] = useState<false | string>(false);

  const handleFileChange = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsLoading("Parsing CSV...");
    onError("");

    await new Promise(res => setTimeout(res, 50));

    try {
        const text = await file.text();
        const lines = text.split(/\r?\n/).filter(line => line.trim() !== '');
        
        if (lines.length < 2) {
            throw new Error("CSV file must have a header and at least one player row.");
        }

        const header = lines[0].toLowerCase().split(',').map(h => h.trim().replace(/"/g, ''));
        
        const idIndex = header.indexOf('id');
        const nameIndex = header.indexOf('nickname');
        const posIndex = header.indexOf('position');
        const salIndex = header.indexOf('salary');
        const mvpSalIndex = header.indexOf('mvp 1.5x salary');
        const fppgIndex = header.indexOf('fppg');
        const teamIndex = header.indexOf('team');
        const opponentIndex = header.indexOf('opponent');
        const injuryIndicatorIndex = header.indexOf('injury indicator');
        const injuryDetailsIndex = header.indexOf('injury details');

        if ([idIndex, nameIndex, posIndex, salIndex, mvpSalIndex, fppgIndex, teamIndex, opponentIndex].includes(-1)) {
            throw new Error("CSV header must contain 'Id', 'Nickname', 'Position', 'Salary', 'MVP 1.5x Salary', 'FPPG', 'Team', and 'Opponent'.");
        }
        
        const initialPlayers: Player[] = lines.slice(1).map((line, index) => {
          const data = line.match(/(".*?"|[^",]+)(?=\s*,|\s*$)/g)?.map(field => field.trim().replace(/"/g, '')) || [];

          const id = data[idIndex];
          const name = data[nameIndex];
          const position = data[posIndex];
          const team = data[teamIndex];
          const opponent = data[opponentIndex];
          const salary = parseInt(data[salIndex], 10);
          const mvpSalary = parseInt(data[mvpSalIndex], 10);
          const fpts = parseFloat(data[fppgIndex]) || 0;
          const injuryStatus = injuryIndicatorIndex > -1 ? data[injuryIndicatorIndex] : '';
          const injuryDetails = injuryDetailsIndex > -1 ? data[injuryDetailsIndex] : '';

          if (!id || !name || !position || !team || !opponent || isNaN(salary) || isNaN(mvpSalary)) {
            console.warn(`Skipping invalid data on row ${index + 2}.`);
            return null;
          }
          // Initialize with default/empty advanced stats
          return { 
            id, name, position, salary, mvpSalary, fpts, team, opponent,
            flexOwnership: 0, mvpOwnership: 0,
            injuryStatus, injuryDetails, usageBoost: 0, notes: '',
            statProjections: {} as StatProjections,
            correlations: {},
            gameScriptScore: 0,
            blitzRateDefense: 0,
            coordinatorTendency: 'balanced',
          };
        }).filter((p): p is Player => p !== null);

        if (initialPlayers.length === 0) {
          throw new Error("No valid players were found in the uploaded file.");
        }

        let processedPlayers = generateOwnershipProjections(initialPlayers);
        processedPlayers = analyzePlayerValue(processedPlayers);

        setIsLoading("AI: Validating player status...");
        const { playersToExclude, validationSummary } = await validatePlayers(processedPlayers);
        
        const initialStatuses: Record<string, PlayerStatus> = {};
        processedPlayers.forEach(p => {
          if (playersToExclude.has(p.id)) {
            initialStatuses[p.id] = PlayerStatus.EXCLUDED;
          } else {
            initialStatuses[p.id] = PlayerStatus.INCLUDED;
          }
        });

        setIsLoading("AI: Enriching game data...");
        processedPlayers = await enrichGameData(processedPlayers);

        onFileUpload({
          players: processedPlayers,
          statuses: initialStatuses,
          validationReport: validationSummary,
        });

    } catch (error) {
        onError(error instanceof Error ? error.message : "Failed to process file.");
    } finally {
        setIsLoading(false);
        // Reset file input to allow re-uploading the same file
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    }
  }, [onFileUpload, onError]);

  const handleButtonClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div>
        <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept=".csv"
            className="hidden"
            disabled={!!isLoading}
        />
        <button
            onClick={handleButtonClick}
            disabled={!!isLoading}
            className="w-full flex items-center justify-center gap-2 bg-gray-700 hover:bg-gray-600 text-white font-bold py-3 px-4 rounded-lg transition duration-300 disabled:bg-gray-800 disabled:cursor-not-allowed"
        >
            {isLoading ? <SpinnerIcon /> : <UploadIcon />}
            {isLoading || 'Upload FanDuel Player CSV'}
        </button>
         <p className="text-xs text-center mt-2 text-gray-500">
            Upload the CSV you downloaded directly from the FanDuel contest page.
        </p>
    </div>
  );
};

export default FileUpload;
