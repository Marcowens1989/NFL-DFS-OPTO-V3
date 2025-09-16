import { Player } from '../types';

const INJURY_STATUS_CODES = ['Q', 'D', 'O', 'IR'];
const BOOST_POSITIONS = ['RB', 'WR', 'TE'];

export const analyzePlayerValue = (players: Player[]): Player[] => {
  const injuredPlayers = players.filter(p => 
    INJURY_STATUS_CODES.includes(p.injuryStatus?.toUpperCase()) && BOOST_POSITIONS.includes(p.position)
  );
  
  if (injuredPlayers.length === 0) {
    return players;
  }

  const playerMap = new Map(players.map(p => [p.id, p]));

  for (const injuredPlayer of injuredPlayers) {
    const healthyBackups = players.filter(p => 
      p.team === injuredPlayer.team &&
      p.position === injuredPlayer.position &&
      p.id !== injuredPlayer.id &&
      !INJURY_STATUS_CODES.includes(p.injuryStatus?.toUpperCase())
    );

    for (const backup of healthyBackups) {
        // Simple boost logic: give a boost proportional to the injured player's FPPG.
        // A more complex model could factor in the backup's salary, depth chart position etc.
        const boostAmount = injuredPlayer.fpts * 0.25; 

        const existingPlayer = playerMap.get(backup.id);
        if (existingPlayer) {
            existingPlayer.usageBoost += boostAmount;
            const newNote = `Increased role due to ${injuredPlayer.name} (${injuredPlayer.injuryStatus})`;
            existingPlayer.notes = existingPlayer.notes ? `${existingPlayer.notes}; ${newNote}` : newNote;
        }
    }
  }

  return Array.from(playerMap.values());
};
