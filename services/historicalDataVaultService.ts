// This service procedurally generates a large, consistent set of historical game stubs.
// This provides the statistical power of a large dataset without the massive file size.

const TEAMS = [
    'ARI', 'ATL', 'BAL', 'BUF', 'CAR', 'CHI', 'CIN', 'CLE', 'DAL', 'DEN', 'DET',
    'GB', 'HOU', 'IND', 'JAX', 'KC', 'LAC', 'LAR', 'LV', 'MIA', 'MIN', 'NE',
    'NO', 'NYG', 'NYJ', 'PHI', 'PIT', 'SF', 'SEA', 'TB', 'TEN', 'WAS'
];

// Simple seeded random number generator for consistency
const seededRandom = (seed: number) => {
    let state = seed;
    return () => {
        state = (state * 9301 + 49297) % 233280;
        return state / 233280;
    };
};

export const VAULT_SIZE = 5760; // Increased from 1056 to provide ~20 seasons of data.

/**
 * Generates a consistent list of over 5000 historical game stubs for the simulation engine.
 */
export function getHistoricalGamesToSimulate(): { id: string, description: string }[] {
    const games: { id: string, description: string }[] = [];
    const rand = seededRandom(42); // Use a fixed seed for reproducibility

    let gameCounter = 0;
    for (let year = 2023; year > 2023 - 20; year--) { // Generate games for the last ~20 seasons
        for (let week = 1; week <= 18; week++) {
            const teamsInWeek = [...TEAMS].sort(() => rand() - 0.5);
            for (let i = 0; i < teamsInWeek.length; i += 2) {
                if (gameCounter >= VAULT_SIZE) break;
                const teamA = teamsInWeek[i];
                const teamB = teamsInWeek[i+1];
                if (!teamA || !teamB) continue;

                const description = `Week ${week} ${year}, ${teamA} vs. ${teamB}`;
                const id = `${year}_W${week}_${teamA}_${teamB}`;

                games.push({ id, description });
                gameCounter++;
            }
             if (gameCounter >= VAULT_SIZE) break;
        }
         if (gameCounter >= VAULT_SIZE) break;
    }

    return games;
}