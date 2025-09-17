import React from 'react';
import { AppTab } from '../App';

interface HeaderProps {
  activeTab: AppTab;
  onTabChange: (tab: AppTab) => void;
}

const Header: React.FC<HeaderProps> = ({ activeTab, onTabChange }) => {
  const getButtonClass = (tab: AppTab) => {
    const baseClass = "px-3 py-2 rounded-md text-sm font-medium transition-colors";
    if (tab === activeTab) {
      return `${baseClass} bg-gray-700 text-white`;
    }
    return `${baseClass} text-gray-300 hover:bg-gray-700 hover:text-white`;
  };

  return (
    <header className="bg-gray-900 border-b border-gray-700 shadow-md">
      <div className="container mx-auto px-4 md:px-8">
        <div className="flex justify-between items-center py-4">
          <div>
            <h1 className="text-3xl text-white tracking-wider">
              <span className="font-bold">Marcus' NFL SHOWDOWN OPTIMIZER</span>
              <span className="ml-3" role="img" aria-label="football">🏈</span>
            </h1>
            <p className="text-gray-400 mt-1">Your personal DFS lineup generator.</p>
          </div>
          <nav className="flex space-x-2">
            <button 
              onClick={() => onTabChange('optimizer')}
              className={getButtonClass('optimizer')}
            >
              Optimizer
            </button>
            <button
              onClick={() => onTabChange('lab')}
              className={getButtonClass('lab')}
            >
              Projections Lab
            </button>
          </nav>
        </div>
      </div>
    </header>
  );
};

export default Header;