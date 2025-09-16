import React from 'react';

const Header: React.FC = () => {
  return (
    <header className="bg-gray-900 border-b border-gray-700 shadow-md">
      <div className="container mx-auto px-4 md:px-8 py-4">
        <div>
          <h1 className="text-3xl text-white tracking-wider">
            <span className="font-bold">Marcus' NFL SHOWDOWN OPTIMIZER</span>
            <span className="ml-3" role="img" aria-label="football">🏈</span>
          </h1>
          <p className="text-gray-400 mt-1">Your personal DFS lineup generator.</p>
        </div>
      </div>
    </header>
  );
};

export default Header;