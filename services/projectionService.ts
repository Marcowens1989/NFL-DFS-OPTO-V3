import { StatProjections, StatWeights } from "../types";

/**
 * Calculates a player's fantasy point projection based on their granular stat projections and a given set of weights.
 * This is the core function that connects the tuning lab to the optimizer.
 * @param projections The player's mean or ceiling stat projections.
 * @param weights The StatWeights object from a tuned model.
 * @returns A single, calculated fantasy point score.
 */
export function calculateFptsFromProjections(projections: StatProjections | undefined, weights: StatWeights): number {
    if (!projections) {
        return 0;
    }

    let score = 0;

    // Map StatProjections keys to StatWeights keys and calculate score
    if (projections.passingYards && weights.passYds) score += projections.passingYards * weights.passYds;
    if (projections.passingTds && weights.passTds) score += projections.passingTds * weights.passTds;
    if (projections.interceptions && weights.interceptions) score += projections.interceptions * weights.interceptions;
    if (projections.rushingYards && weights.rushYds) score += projections.rushingYards * weights.rushYds;
    if (projections.rushingTds && weights.rushTds) score += projections.rushingTds * weights.rushTds;
    if (projections.receptions && weights.receptions) score += projections.receptions * weights.receptions;
    if (projections.receivingYards && weights.recYds) score += projections.receivingYards * weights.recYds;
    if (projections.receivingTds && weights.recTds) score += projections.receivingTds * weights.recTds;
    
    return score;
}

/**
 * Applies a given set of weights to a player's advanced stats to generate mean and ceiling projections.
 * @param advancedStats The player's advanced statistical profile.
 * @param weights The StatWeights from a TunedModel.
 * @returns An object containing the calculated mean and ceiling fantasy points.
 */
export function projectPlayerStats(
    advancedStats: { [key: string]: number } | undefined, 
    weights: StatWeights
): { meanFpts: number; ceilingFpts: number } {
    if (!advancedStats) {
        return { meanFpts: 0, ceilingFpts: 0 };
    }

    let meanFpts = 0;
    for (const [stat, value] of Object.entries(advancedStats)) {
        if (weights[stat as keyof StatWeights]) {
            meanFpts += value * (weights[stat as keyof StatWeights] as number);
        }
    }

    // Generate ceiling weights using a heuristic (e.g., increase positive weights, decrease negative)
    const ceilingWeights = generateCeilingWeights(weights);
    let ceilingFpts = 0;
    for (const [stat, value] of Object.entries(advancedStats)) {
        if (ceilingWeights[stat as keyof StatWeights]) {
            ceilingFpts += value * (ceilingWeights[stat as keyof StatWeights] as number);
        }
    }

    return { meanFpts, ceilingFpts: Math.max(meanFpts, ceilingFpts) };
}

/**
 * Creates a "ceiling" version of a StatWeights model by amplifying positive weights
 * and diminishing negative ones, to project a player's high-end range of outcomes.
 * @param baseWeights The base StatWeights from a TunedModel.
 * @returns A new StatWeights object optimized for ceiling projections.
 */
export function generateCeilingWeights(baseWeights: StatWeights): StatWeights {
    const ceilingWeights = { ...baseWeights };
    for (const key in ceilingWeights) {
        const weightKey = key as keyof StatWeights;
        const value = ceilingWeights[weightKey] as number;
        if (value > 0) {
            // Amplify positive contributors to ceiling
            ceilingWeights[weightKey] = value * 1.25;
        } else {
            // Diminish negative contributors for ceiling (less likely to happen in a ceiling game)
            ceilingWeights[weightKey] = value * 0.75;
        }
    }
    return ceilingWeights;
}