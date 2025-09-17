import React from 'react';
import { Player } from '../types';

interface GameEnvironmentProps {
    players: Player[];
}

const GameEnvironment: React.FC<GameEnvironmentProps> = ({ players }) => {
    if (!players || players.length === 0 || !players[0].vegas) {
        return null;
    }

    const firstPlayer = players[0];
    const team = firstPlayer.team;
    const opponent = firstPlayer.opponent;
    const vegas = firstPlayer.vegas;
    
    const teamVegas = players.find(p => p.team === team)?.vegas;
    const opponentVegas = players.find(p => p.team === opponent)?.vegas;

    if (!teamVegas || !opponentVegas) {
        return null;
    }

    return (
        <div className="mt-6 border-t border-gray-700 pt-6">
            <h2 className="text-2xl font-bold mb-4 text-white">Game Environment</h2>
            <div className="bg-gray-800/50 p-4 rounded-lg border border-gray-700 flex items-center justify-around text-center">
                <div>
                    <p className="text-sm text-gray-400">{team} Spread</p>
                    <p className="text-2xl font-bold text-white">{teamVegas.spread > 0 ? `+${teamVegas.spread}` : teamVegas.spread}</p>
                </div>
                <div className="border-l border-r border-gray-600 px-6 mx-4">
                    <p className="text-sm text-gray-400">Game Total</p>
                    <p className="text-3xl font-bold text-orange-400">{vegas.total}</p>
                </div>
                <div>
                    <p className="text-sm text-gray-400">{opponent} Spread</p>
                     <p className="text-2xl font-bold text-white">{opponentVegas.spread > 0 ? `+${opponentVegas.spread}` : opponentVegas.spread}</p>
                </div>
            </div>
        </div>
    );
};

export default GameEnvironment;