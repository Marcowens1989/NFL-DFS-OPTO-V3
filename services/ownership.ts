import { Player } from '../types';

// Helper to normalize an array of scores to sum to a target (e.g., 100)
const normalizeScores = (players: (Player & { popularityScore: number })[], targetSum: number): Record<string, number> => {
  const totalScore = players.reduce((sum, p) => sum + (p.popularityScore || 0), 0);
  if (totalScore === 0) {
    return players.reduce((acc, p) => ({ ...acc, [p.id]: 0 }), {});
  }
  const factor = targetSum / totalScore;
  return players.reduce((acc, p) => ({ ...acc, [p.id]: (p.popularityScore || 0) * factor }), {});
};

export const generateOwnershipProjections = (players: Player[]): Player[] => {
    // These weights are arbitrary and can be tuned for better projections
    const FLEX_FPTS_WEIGHT = 0.6;
    const FLEX_SALARY_WEIGHT = 0.4;
    const MVP_FPTS_WEIGHT = 0.8;
    const MVP_SALARY_WEIGHT = 0.2;

    const playersWithFlexScores = players.map(p => {
        const popularityScore = (p.fpts * FLEX_FPTS_WEIGHT) + ((p.salary / 1000) * FLEX_SALARY_WEIGHT);
        return { ...p, popularityScore };
    });

    const playersWithMvpScores = players.map(p => {
         // MVP popularity is more skewed towards high-scorers, hence Math.pow
        const popularityScore = (Math.pow(p.fpts, 1.5) * MVP_FPTS_WEIGHT) + ((p.mvpSalary / 1000) * MVP_SALARY_WEIGHT);
        return { ...p, popularityScore };
    });

    // Total FLEX ownership across all players in a showdown is 500% (100% * 5 roster spots)
    // A reasonable total projected ownership for the field is ~250-300%.
    const normalizedFlex = normalizeScores(playersWithFlexScores, 280);
    // Total MVP ownership is 100%
    const normalizedMvp = normalizeScores(playersWithMvpScores, 100);

    return players.map(p => ({
        ...p,
        flexOwnership: normalizedFlex[p.id] || 0,
        mvpOwnership: normalizedMvp[p.id] || 0,
    }));
};