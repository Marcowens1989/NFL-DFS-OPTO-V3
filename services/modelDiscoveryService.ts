import { HistoricalGame, ModelDiscoveryReport, StatWeights } from '../types';
import { generateContent } from './aiModelService';
import { Type } from '@google/genai';

/**
 * Analyzes a historical game to reverse-engineer the optimal predictive model for that slate.
 * @param game The processed historical game data.
 * @returns A report containing the analysis and the hindsight-optimized model.
 */
export async function discoverOptimalModel(game: HistoricalGame): Promise<ModelDiscoveryReport> {
    const topPerformers = game.players
        .sort((a, b) => b.actualFdp - a.actualFdp)
        .slice(0, 15)
        .map(p => `- ${p.name} (${p.position}, ${p.team}): ${p.actualFdp.toFixed(2)} FDP`);

    const prompt = `
        You are a world-class Quantitative DFS Analyst. Your task is to reverse-engineer the perfect predictive model for a historical NFL Showdown slate based on its outcome and pre-game context.

        **Game Data:**
        - **Description:** ${game.description}
        - **Game ID (MUST be returned exactly as is):** ${game.gameId}
        - **Pre-Game Context:**
            - Injuries: ${game.pregameContext.injuries.join(', ') || 'None'}
            - Vegas Line: ${game.pregameContext.vegasLine}
        - **Top Fantasy Performers:**
            ${topPerformers.join('\n')}

        **Your Task:**
        Analyze the data and return a single JSON object representing your "Model Discovery Report".
        The JSON must contain the following top-level keys: "gameId", "gameScriptAnalysis", "coachingTendencyAnalysis", and "hindsightModel".

        1.  **gameId**: YOU MUST RETURN THE EXACT "Game ID" provided above: "${game.gameId}". Do not alter it in any way.
        2.  **gameScriptAnalysis**: A string describing the actual game script that unfolded. (e.g., "This was a high-scoring shootout where both QBs excelled," or "A defensive slugfest where RBs and defenses dominated.").
        3.  **coachingTendencyAnalysis**: A string analyzing how coaching tendencies or player archetypes influenced the outcome. (e.g., "The Lions' pass-heavy offense exploited the Chiefs' weak secondary, making their WR2 a slate-breaking value.").
        4.  **hindsightModel**: An object with the following keys:
            *   **weights**: An object containing the hindsight-optimal StatWeights. These are the weights you believe would have most accurately predicted this specific game's fantasy outputs. For example, in a game with many passing TDs, you might increase the 'passTds' weight.
            *   **gameScript**: Classify the game script as one of: 'Neutral', 'Shootout', 'Defensive Struggle', or 'Blowout'.
            *   **notes**: A concise string explaining the reasoning for your model adjustments. (e.g., "Increased passing TD and reception weights to capture the shootout nature of the game.").

        **Constraint:** Your analysis and model must only be based on information that could have been reasonably inferred *before* the game, combined with the *hindsight knowledge* of the final stats. The goal is to find the *best possible pre-game model* for this specific outcome.

        Respond with ONLY the valid JSON object.
    `;

    const responseSchema = {
        type: Type.OBJECT,
        properties: {
            gameId: { type: Type.STRING },
            gameScriptAnalysis: { type: Type.STRING },
            coachingTendencyAnalysis: { type: Type.STRING },
            hindsightModel: {
                type: Type.OBJECT,
                properties: {
                    weights: {
                        type: Type.OBJECT,
                        properties: {
                            passYds: { type: Type.NUMBER }, passTds: { type: Type.NUMBER }, interceptions: { type: Type.NUMBER },
                            rushYds: { type: Type.NUMBER }, rushTds: { type: Type.NUMBER },
                            receptions: { type: Type.NUMBER }, recYds: { type: Type.NUMBER }, recTds: { type: Type.NUMBER },
                            fumblesLost: { type: Type.NUMBER }
                        },
                        required: ['passYds', 'passTds', 'interceptions', 'rushYds', 'rushTds', 'receptions', 'recYds', 'recTds', 'fumblesLost']
                    },
                    gameScript: { type: Type.STRING, enum: ['Neutral', 'Shootout', 'Defensive Struggle', 'Blowout'] },
                    notes: { type: Type.STRING }
                },
                required: ['weights', 'gameScript', 'notes']
            }
        },
        required: ['gameId', 'gameScriptAnalysis', 'coachingTendencyAnalysis', 'hindsightModel']
    };

    try {
        const responseText = await generateContent(prompt, { responseSchema }, 120000, 2);
        const report: ModelDiscoveryReport = JSON.parse(responseText);

        // THE AUDITOR LAYER: Forcefully correct the gameId to prevent AI formatting errors from breaking the simulation.
        if (report.gameId !== game.gameId) {
            console.warn(`Mismatched gameId from AI. Expected: ${game.gameId}, Got: ${report.gameId}. Correcting.`);
            report.gameId = game.gameId;
        }
        
        return report;
    } catch (e) {
        console.error(`Failed to discover model for game: ${game.description}`, e);
        throw new Error(`AI model discovery failed for game: ${game.description}. ${e instanceof Error ? e.message : 'Unknown error.'}`);
    }
}