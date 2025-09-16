import { Player, PlayerStatus } from '../types';

const INJURY_STATUS_CODES = ['Q', 'D', 'O', 'IR', 'OUT'];
const BOOST_POSITIONS = ['RB', 'WR', 'TE'];

export const analyzePlayerValue = (players: Player[], statuses: Record<string, PlayerStatus>): Player[] => {
  // Find players who are confirmed EXCLUDED due to injury
  const injuredAndOutPlayers = players.filter(p => 
    statuses[p.id] === PlayerStatus.EXCLUDED &&
    INJURY_STATUS_CODES.includes(p.injuryStatus?.toUpperCase()) && 
    BOOST_POSITIONS.includes(p.position)
  );
  
  if (injuredAndOutPlayers.length === 0) {
    return players;
  }

  const playerMap = new Map(players.map(p => [p.id, { ...p, usageBoost: 0, notes: '' }]));

  for (const injuredPlayer of injuredAndOutPlayers) {
    const healthyBackups = players.filter(p => 
      p.team === injuredPlayer.team &&
      p.position === injuredPlayer.position &&
      p.id !== injuredPlayer.id &&
      statuses[p.id] !== PlayerStatus.EXCLUDED
    );

    for (const backup of healthyBackups) {
        // More significant boost for confirmed OUT players.
        // A more complex model could factor in the backup's salary, depth chart position etc.
        const boostAmount = injuredPlayer.fpts * 0.40; 

        const existingPlayer = playerMap.get(backup.id);
        if (existingPlayer) {
            existingPlayer.usageBoost += boostAmount;
            const newNote = `Increased role due to ${injuredPlayer.name} (${injuredPlayer.injuryStatus || 'Out'})`;
            existingPlayer.notes = existingPlayer.notes ? `${existingPlayer.notes}; ${newNote}` : newNote;
        }
    }
  }

  return Array.from(playerMap.values());
};