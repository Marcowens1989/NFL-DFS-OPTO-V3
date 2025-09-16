import React, { useMemo } from 'react';
import LightbulbIcon from './icons/LightbulbIcon';
import SpinnerIcon from './icons/SpinnerIcon';

interface AIAnalysisProps {
  hasPlayers: boolean;
  analysis: string | null;
  isLoading: boolean;
  onAnalyze: () => void;
}

const AIAnalysis: React.FC<AIAnalysisProps> = ({ hasPlayers, analysis, isLoading, onAnalyze }) => {
    if (!hasPlayers) {
        return null;
    }

    const formattedAnalysis = useMemo(() => {
        if (!analysis) return null;
        
        const sections = analysis.split('### ').slice(1); // Split by ### and remove the initial empty string

        return sections.map(section => {
            const [title, ...contentParts] = section.split('\n');
            const content = contentParts.join('\n').trim();
            return {
                title: title.trim(),
                content,
            };
        });
    }, [analysis]);

    return (
        <div className="mt-6 border-t border-gray-700 pt-6">
            <h2 className="text-2xl font-bold mb-4 text-white">AI Slate Analysis</h2>
            
            {!analysis && !isLoading && (
                <button
                    onClick={onAnalyze}
                    disabled={isLoading}
                    className="w-full flex items-center justify-center gap-2 bg-red-700 hover:bg-red-600 text-white font-bold py-3 px-4 rounded-lg transition duration-300 disabled:bg-red-500"
                >
                    <LightbulbIcon />
                    Analyze Slate with AI
                </button>
            )}

            {isLoading && (
                 <div className="flex items-center justify-center gap-2 text-red-300 p-3 bg-red-500/10 border border-red-500 rounded-lg">
                    <SpinnerIcon />
                    AI is analyzing the slate...
                </div>
            )}
            
            {formattedAnalysis && (
                <div className="space-y-4 text-gray-300">
                    {formattedAnalysis.map(({ title, content }) => (
                        <div key={title} className="bg-gray-800/50 p-4 rounded-lg border border-gray-700">
                            <h3 className="text-lg font-semibold text-red-300 mb-2">{title}</h3>
                            <p className="whitespace-pre-wrap text-sm leading-relaxed">{content}</p>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default AIAnalysis;