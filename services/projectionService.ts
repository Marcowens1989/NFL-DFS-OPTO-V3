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
    
    // Note: fumblesLost is part of StatWeights but not typically projected granularly by AI,
    // so it's often handled via a baseline negative expectation if needed, but omitted here for simplicity.

    return score;
}
