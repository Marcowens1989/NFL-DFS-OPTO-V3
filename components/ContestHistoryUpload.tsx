import React, { useCallback, useRef, useState } from 'react';
import UploadIcon from './icons/UploadIcon';
import SpinnerIcon from './icons/SpinnerIcon';
import { parseContestHistory } from '../services/contestHistoryParser';
import { ContestResult } from '../types';


interface ContestHistoryUploadProps {
  onComplete: (results: ContestResult[]) => void;
  onError: (message: string) => void;
}

const ContestHistoryUpload: React.FC<ContestHistoryUploadProps> = ({ onComplete, onError }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isLoading, setIsLoading] = useState(false);

  const processFile = useCallback(async (file: File) => {
    if (!file) return;
    setIsLoading(true);
    onError("");

    try {
        const results = await parseContestHistory(file);
        onComplete(results);
    } catch (error) {
        onError(error instanceof Error ? error.message : "Failed to process contest history file.");
    } finally {
        setIsLoading(false);
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    }
  }, [onComplete, onError]);
  
  const handleFileChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (file) {
          processFile(file);
      }
  }, [processFile]);

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
            disabled={isLoading}
        />
        <button
            onClick={handleButtonClick}
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-2 bg-gray-700 hover:bg-gray-600 text-white font-bold py-3 px-4 rounded-lg transition duration-300 disabled:bg-gray-800 disabled:cursor-not-allowed"
        >
            {isLoading ? <SpinnerIcon /> : <UploadIcon />}
            {isLoading ? 'Parsing Results...' : 'Upload Contest History CSV'}
        </button>
         <p className="text-xs text-center mt-2 text-gray-500">
            Download the CSV from your FanDuel "History" page for the specific contest.
        </p>
    </div>
  );
};

export default ContestHistoryUpload;
