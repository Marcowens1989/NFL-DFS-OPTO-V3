import { Player } from '../types';
import { generateContent } from './aiModelService';
import { Type } from '@google/genai';
// FIX: Correctly import the InferredOwnershipFeaturesResponse type, as OwnershipFeaturesResponse is not exported.
import { OwnershipFeaturesResponseSchema, InferredOwnershipFeaturesResponse } from './schemas';
import { logger } from './loggingService';

export interface OwnershipAnalysisResult {
    players: Player[];
    slateNotes: string;
}

// --- NEW: Compliant AI function for generating ownership FEATURES ---
// FIX: Update function signature to use the correct return type.
async function getOwnershipFeaturesAI(players: Player[]): Promise<InferredOwnershipFeaturesResponse> {
    const playerList = players.map(p => ({
        id: p.id,
        name: p.name,
        position: p.position,
        team: p.team,
        fpts: p.fpts,
        salary: p.salary
    }));

    const prompt = `
        You are a world-class Daily Fantasy Sports (DFS) analyst for GPP tournaments. Your specialty is analyzing pre-lock data to generate features for an ownership model.

        Analyze the provided player list and return a single JSON object with two top-level keys: "players" and "slateNotes".

        1.  **"players" key**: This should be an array of objects. For EACH player in the original list, provide an object with the following keys:
            *   "id": The player's ID (must match the input).
            *   "buzzScore": A 1-100 score reflecting public hype and media attention.
            *   "salaryTier": Classify the salary as 'Premium', 'Mid-Range', or 'Value'.
            *   "chalkRating": A 1-100 score indicating how "obvious" or "chalky" the play is to the public.
            *   "leverageScore": A GPP leverage score from 1-100, indicating upside relative to projected ownership.

        2.  **"slateNotes" key**: A string containing sharp, concise analysis. Structure it with two markdown subheadings:
            *   "### Roster Construction Forecast": Describe the 2-3 most common roster builds you expect to see.
            *   "### Top Leverage Stack": Identify a single, lower-owned stack that has tournament-winning potential.

        Return ONLY the single, valid JSON object.

        Player List:
        ${JSON.stringify(playerList.slice(0, 40), null, 2)}
    `;

    const responseSchema = OwnershipFeaturesResponseSchema;
    
    try {
        const responseText = await generateContent(prompt, { responseSchema }, 120000, 2);
        const parsedJson = JSON.parse(responseText);
        const validationResult = responseSchema.safeParse(parsedJson);

        if (!validationResult.success) {
            logger.error("Zod validation failed for AI ownership features response", {
                error: validationResult.error.flatten(),
                data: parsedJson,
            });
            throw new Error("AI ownership features response failed validation.");
        }
        return validationResult.data;
    } catch (error) {
        logger.error("Ownership Features AI Error:", { error });
        throw error;
    }
}

// --- NEW: Local calculation step ---
function calculateOwnershipFromFeatures(players: Player[]): Player[] {
    return players.map(player => {
        const features = player.ownershipFeatures;
        if (!features) {
            return { ...player, flexOwnership: 0.1, mvpOwnership: 0.1, leverage: 50 };
        }

        // This is a simple linear model based on the generated features.
        // In a more advanced system, this would be a loaded GBM or neural network model.
        let flexOwnership = 0;
        flexOwnership += (features.buzzScore / 10); // Buzz is a strong driver
        flexOwnership += (features.chalkRating / 5); // Chalkiness is a very strong driver

        if (features.salaryTier === 'Value') flexOwnership += 5;
        if (features.salaryTier === 'Premium') flexOwnership += 2;
        
        // Normalize based on position and salary
        if(player.position === 'QB') flexOwnership *= 1.1;
        if(player.position === 'RB') flexOwnership *= 1.05;
        if(player.salary < 8000) flexOwnership *= 0.9;

        // Ensure ownership is within a reasonable range (e.g., 0.1% to 80%)
        const clampedFlex = Math.max(0.1, Math.min(80, flexOwnership));
        
        // MVP ownership is roughly a fraction of FLEX ownership
        const mvpOwnership = clampedFlex * (player.position === 'QB' ? 0.4 : 0.2);

        return {
            ...player,
            flexOwnership: clampedFlex,
            mvpOwnership: mvpOwnership,
            leverage: features.leverageScore,
        };
    });
}


/**
 * Main orchestrator for the statistically rigorous ownership pipeline.
 */
export async function getAIOwnershipAnalysis(players: Player[]): Promise<OwnershipAnalysisResult> {
    // 1. Get ownership FEATURES from the AI
    const ownershipFeaturesResult = await getOwnershipFeaturesAI(players);
    const { players: features, slateNotes } = ownershipFeaturesResult;

    // 2. Enrich base players with these features
    const featuresMap = new Map(features.map(p => [p.id, p]));
    let enrichedPlayers = players.map(p => {
        const playerFeatures = featuresMap.get(p.id);
        if (playerFeatures) {
            return {
                ...p,
                ownershipFeatures: {
                    buzzScore: playerFeatures.buzzScore,
                    salaryTier: playerFeatures.salaryTier,
                    chalkRating: playerFeatures.chalkRating,
                    leverageScore: playerFeatures.leverageScore,
                },
            };
        }
        return p;
    });

    // 3. Calculate final ownership locally using the features
    enrichedPlayers = calculateOwnershipFromFeatures(enrichedPlayers);

    return {
        players: enrichedPlayers,
        slateNotes,
    };
}