import React, { useCallback, useRef, useState } from 'react';
import UploadIcon from './icons/UploadIcon';
import SpinnerIcon from './icons/SpinnerIcon';
import { UploadData, handleFileUpload } from '../services/dataManager';

interface FileUploadProps {
  onComplete: (data: UploadData) => void;
  onError: (message: string) => void;
}

const FileUpload: React.FC<FileUploadProps> = ({ onComplete, onError }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isLoading, setIsLoading] = useState<false | string>(false);

  const processFile = useCallback(async (file: File) => {
    if (!file) return;

    onError("");

    try {
        const data = await handleFileUpload(file, (status) => setIsLoading(status));
        onComplete(data);
    } catch (error) {
        onError(error instanceof Error ? error.message : "Failed to process file.");
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