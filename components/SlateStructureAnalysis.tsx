import React from 'react';
import LightbulbIcon from './icons/LightbulbIcon';

interface SlateStructureAnalysisProps {
  notes: string | null;
}

const SlateStructureAnalysis: React.FC<SlateStructureAnalysisProps> = ({ notes }) => {
    if (!notes) {
        return null;
    }

    const sections = notes.split('### ').slice(1);

    return (
        <div className="mt-6 border-t border-gray-700 pt-6">
            <h2 className="text-2xl font-bold mb-4 text-white flex items-center gap-2">
                <LightbulbIcon />
                AI Ownership & Structure Forecast
            </h2>
            <div className="space-y-4 text-gray-300">
                {sections.map((section, index) => {
                    const [title, ...contentParts] = section.split('\n');
                    const content = contentParts.join('\n').trim();
                    return (
                        <div key={index} className="bg-gray-800/50 p-4 rounded-lg border border-gray-700">
                            <h3 className="text-lg font-semibold text-orange-300 mb-2">{title.trim()}</h3>
                            <p className="whitespace-pre-wrap text-sm leading-relaxed">{content}</p>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default SlateStructureAnalysis;
