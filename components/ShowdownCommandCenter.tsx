import React, { useMemo } from 'react';
import { Player } from '../types';
import { getTeamLogoUrl } from '../services/teamLogoService';

interface ShowdownCommandCenterProps {
    players: Player[];
}

interface TeamDisplayData {
    name: string;
    logoUrl: string;
    impliedTotal: number;
    spread: number;
    topPlayers: Player[];
}

const TeamPanel: React.FC<{ teamData: TeamDisplayData, isAway: boolean }> = ({ teamData, isAway }) => (
    <div className={`flex flex-col items-center text-center p-4 rounded-lg w-full md:w-5/12 ${isAway ? 'bg-gray-800/30' : 'bg-gray-800/30'}`}>
        <img src={teamData.logoUrl} alt={`${teamData.name} logo`} className="h-20 w-20 md:h-24 md:w-24 mb-3" />
        <h3 className="text-xl md:text-2xl font-bold text-white">{teamData.name}</h3>
        <div className="flex items-baseline gap-2 mt-1">
            <p className="text-3xl md:text-4xl font-bold text-green-400">{teamData.impliedTotal.toFixed(1)}</p>
            <p className="text-md text-gray-400">({teamData.spread > 0 ? `+${teamData.spread}` : teamData.spread})</p>
        </div>
        <div className="w-full mt-4 border-t border-gray-700 pt-3 space-y-2 text-xs">
             <h4 className="font-bold text-gray-400 uppercase tracking-wider mb-2">Key Players</h4>
             {teamData.topPlayers.map(p => (
                 <div key={p.id} className="flex justify-between items-center w-full">
                     <span className="text-gray-300">{p.name} <span className="text-gray-500">{p.position}</span></span>
                     <span className="font-mono text-green-400">{p.fpts.toFixed(1)}</span>
                 </div>
             ))}
        </div>
    </div>
);


const ShowdownCommandCenter: React.FC<ShowdownCommandCenterProps> = ({ players }) => {
    const { teamA, teamB, gameTotal } = useMemo(() => {
        if (!players || players.length === 0) return { teamA: null, teamB: null, gameTotal: 0 };

        const teams = Array.from(new Set(players.map(p => p.team)));
        if (teams.length !== 2) return { teamA: null, teamB: null, gameTotal: 0 };
        
        const [teamAName, teamBName] = teams;

        const createTeamData = (name: string): TeamDisplayData => {
            const teamPlayers = players.filter(p => p.team === name);
            const vegas = teamPlayers[0]?.vegas;
            const topPlayers = teamPlayers.sort((a,b) => b.fpts - a.fpts).slice(0, 3);

            return {
                name,
                logoUrl: getTeamLogoUrl(name),
                impliedTotal: vegas?.impliedTeamTotal || 0,
                spread: vegas?.spread || 0,
                topPlayers,
            };
        };
        
        return {
            teamA: createTeamData(teamAName),
            teamB: createTeamData(teamBName),
            gameTotal: players[0].vegas?.total || 0,
        };
    }, [players]);

    if (!teamA || !teamB) {
        return null;
    }

    return (
        <div className="mt-6 border-t border-gray-700 pt-6">
            <h2 className="text-2xl font-bold mb-4 text-white">Showdown Command Center</h2>
            <div className="bg-black border border-gray-700/50 p-4 rounded-xl shadow-2xl flex flex-col md:flex-row items-center justify-between gap-4 relative overflow-hidden">
                <div 
                    className="absolute top-0 left-0 w-1/2 h-full bg-gradient-to-r from-gray-800/40 to-transparent opacity-50 z-0"
                    style={{ background: `radial-gradient(circle at 10% 50%, var(--team-a-color, #374151) 0%, transparent 70%)` }}
                ></div>
                 <div 
                    className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-gray-800/40 to-transparent opacity-50 z-0"
                    style={{ background: `radial-gradient(circle at 90% 50%, var(--team-b-color, #374151) 0%, transparent 70%)` }}
                ></div>
                
                <TeamPanel teamData={teamA} isAway={true} />

                <div className="text-center my-4 md:my-0 z-10">
                    <p className="text-lg font-bold text-gray-400">TOTAL</p>
                    <p className="text-5xl font-extrabold text-orange-400 tracking-tighter">{gameTotal}</p>
                    <p className="text-2xl font-bold text-gray-500 -mt-2">VS</p>
                </div>

                <TeamPanel teamData={teamB} isAway={false} />
            </div>
        </div>
    );
};

export default ShowdownCommandCenter;
