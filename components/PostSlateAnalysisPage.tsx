import React, { useState, useCallback } from 'react';
import { Player, ContestResult, LeakfinderReport } from '../types';
import ContestHistoryUpload from './ContestHistoryUpload';
import { generateLeakfinderReport } from '../services/postSlateAnalyzer';
import SpinnerIcon from './icons/SpinnerIcon';
import LightbulbIcon from './icons/LightbulbIcon';
import LeakfinderReportDisplay from './LeakfinderReportDisplay';


interface PostSlateAnalysisPageProps {
  players: Player[]; // Players from the optimizer page for context
}

const PostSlateAnalysisPage: React.FC<PostSlateAnalysisPageProps> = ({ players }) => {
    const [contestResults, setContestResults] = useState<ContestResult[] | null>(null);
    const [leakfinderReport, setLeakfinderReport] = useState<LeakfinderReport | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleUploadComplete = useCallback((results: ContestResult[]) => {
        setContestResults(results);
        setLeakfinderReport(null); // Reset report on new upload
        setError(null);
    }, []);

    const handleAnalyzeResults = async () => {
        if (!contestResults || !players || players.length === 0) {
            setError("Cannot analyze without both contest results and the original player pool loaded in the Optimizer tab.");
            return;
        }
        setIsLoading(true);
        setError(null);
        try {
            const report = await generateLeakfinderReport(contestResults, players);
            setLeakfinderReport(report);
        } catch (e) {
            const errorMessage = e instanceof Error ? e.message : "An unknown error occurred during AI analysis.";
            setError(errorMessage);
        } finally {
            setIsLoading(false);
        }
    };


    return (
        <div className="bg-black border border-gray-700 p-6 rounded-lg shadow-lg space-y-8">
            <div>
                <h1 className="text-3xl font-bold text-white mb-2">Post-Slate Leakfinder Analysis</h1>
                <p className="text-gray-400">
                    Upload your FanDuel contest history CSV to get an AI-powered analysis of your performance. Your personal DFS coach will identify your strengths, find your leaks, and help you improve your process.
                </p>
            </div>
            
            {!players || players.length === 0 ? (
                <div className="p-4 bg-yellow-900/50 border border-yellow-500 text-yellow-300 rounded-lg">
                    <p className="font-bold">Player Pool Required</p>
                    <p className="text-sm">Please go to the 'Optimizer' tab and upload the FanDuel player CSV for the slate you want to analyze first. This provides the AI with the necessary context (projections, salaries, etc.) to perform its analysis.</p>
                </div>
            ) : (
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
                    <div>
                        <h2 className="text-xl font-bold mb-4 text-white">1. Upload Contest History CSV</h2>
                        <ContestHistoryUpload onComplete={handleUploadComplete} onError={setError} />
                        {contestResults && (
                            <div className="mt-4 p-3 bg-green-500/10 text-green-300 border border-green-500 rounded">
                                <p className="font-bold">Successfully parsed {contestResults.length} contest entries.</p>
                            </div>
                        )}
                    </div>
                    <div>
                        <h2 className="text-xl font-bold mb-4 text-white">2. Generate Report</h2>
                         <button 
                            onClick={handleAnalyzeResults} 
                            disabled={!contestResults || isLoading}
                            className="w-full flex items-center justify-center gap-2 bg-red-700 hover:bg-red-600 text-white font-bold py-3 px-4 rounded-lg transition duration-300 disabled:bg-gray-600 disabled:cursor-not-allowed"
                        >
                            {isLoading ? <SpinnerIcon /> : <LightbulbIcon />}
                            {isLoading ? 'Your Coach is Analyzing...' : 'Generate Leakfinder Report'}
                        </button>
                    </div>
                </div>
            )}


            {error && <div className="mt-4 p-3 bg-red-500/20 text-red-300 border border-red-500 rounded">{error}</div>}

            {leakfinderReport && (
                <div className="border-t border-gray-700 pt-8 mt-8">
                    <LeakfinderReportDisplay report={leakfinderReport} />
                </div>
            )}
        </div>
    );
};

export default PostSlateAnalysisPage;
