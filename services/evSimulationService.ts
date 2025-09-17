import { Player, Lineup } from '../types';
import { OptimizationTarget } from './optimizer';

const MVP_MULTIPLIER = 1.5;
const FIELD_SIZE = 100000; // Assumed field size for GPP contest simulation

// Helper to get Fpts based on optimization target
const getTargetFpts = (p: Player, target: 'mean' | 'ceiling') => {
    const baseFpts = target === 'ceiling' ? p.scenarioFpts.ceiling : p.fpts;
    return baseFpts + (p.usageBoost || 0);
};

/**
 * Calculates all statistical and contest-related metrics for a given lineup.
 * This is the central hub for lineup evaluation.
 * @param mvp The MVP of the lineup.
 * @param flex The four FLEX players.
 * @param optimizationTarget The target ('mean' or 'ceiling') used for optimization.
 * @returns An object with all calculated stats, ready to be merged into a Lineup object.
 */
export function calculateLineupStats(
    mvp: Player,
    flex: Player[],
    optimizationTarget: OptimizationTarget
): Omit<Lineup, 'mvp' | 'flex'> {
    const totalSalary = flex.reduce((sum, p) => sum + p.salary, mvp.salary);
    const totalFpts = flex.reduce((sum, p) => sum + getTargetFpts(p, 'mean'), getTargetFpts(mvp, 'mean') * MVP_MULTIPLIER);
    const totalCeilingFpts = flex.reduce((sum, p) => sum + getTargetFpts(p, 'ceiling'), getTargetFpts(mvp, 'ceiling') * MVP_MULTIPLIER);

    const lineup = [mvp, ...flex];

    // --- Ownership & Duplication ---
    const ownershipProduct = lineup.reduce((prod, p, index) => {
        const ownership = index === 0 ? p.mvpOwnership : p.flexOwnership;
        return prod * (ownership / 100 || 0.0001); // Use epsilon for 0% owned players
    }, 1);

    // This is a simplified but effective proxy for duplication risk. A more advanced
    // model (e.g., a GBM trained on historical data) would be implemented here later.
    const duplicationRisk = Math.max(0, (ownershipProduct * FIELD_SIZE) - 1);

    // --- EV Simulation (Simplified) ---
    // A simplified Certainty Equivalent (CE) model for EV.
    // It rewards ceiling (upside) but penalizes duplication risk.
    // A more advanced model would simulate payouts against a projected score distribution.
    const uniquenessBonus = 1 / (1 + Math.sqrt(duplicationRisk));
    const expectedValue = totalCeilingFpts * uniquenessBonus;


    // --- Other Lineup Metrics ---
    const totalOwnership = lineup.reduce((sum, p, index) => {
        const ownership = index === 0 ? p.mvpOwnership : p.flexOwnership;
        return sum + ownership;
    }, 0);
    const ownershipScore = lineup.length > 0 ? totalOwnership / lineup.length : 0;

    const totalLeverage = lineup.reduce((sum, p) => sum + (p.leverage || 0), 0);
    const leverageScore = lineup.length > 0 ? totalLeverage / lineup.length : 0;

    const teamCounts: Record<string, number> = {};
    lineup.forEach(p => { teamCounts[p.team] = (teamCounts[p.team] || 0) + 1; });
    const stackType = Object.values(teamCounts).sort((a, b) => b - a).join('-');

    let correlationScore = 0;
    for (let i = 0; i < lineup.length; i++) {
        for (let j = i + 1; j < lineup.length; j++) {
            const playerA = lineup[i];
            const playerB = lineup[j];
            correlationScore += (playerA.correlations?.[playerB.id] || playerB.correlations?.[playerA.id] || 0);
        }
    }

    // A legacy score, can be deprecated in favor of EV.
    const roiScore = (totalCeilingFpts * (1 + correlationScore)) * (1 / (Math.pow(ownershipProduct, 0.25) + 0.001)) * (leverageScore / 100);

    return {
        totalFpts,
        totalCeilingFpts,
        totalSalary,
        ownershipScore,
        ownershipProduct,
        correlationScore,
        leverageScore,
        stackType,
        roiScore,
        expectedValue,
        duplicationRisk,
    };
}