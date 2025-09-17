import { Player } from '../types';
import { generateContent } from './aiModelService';
import { Type } from '@google/genai';
import { OwnershipResponseSchema } from './schemas';
import { logger } from './loggingService';

export interface OwnershipAnalysisResult {
    players: Player[];
    slateNotes: string;
}

export async function getAIOwnershipAnalysis(players: Player[]): Promise<OwnershipAnalysisResult> {
    const playerList = players.map(p => ({
        id: p.id,
        name: p.name,
        position: p.position,
        team: p.team,
        fpts: p.fpts,
        salary: p.salary
    }));

    const prompt = `
        You are a world-class Daily Fantasy Sports (DFS) analyst for GPP tournaments. Your specialty is projecting player ownership and identifying leverage opportunities on a FanDuel NFL Showdown slate.

        Analyze the provided player list and return a single JSON object with two top-level keys: "players" and "slateNotes".

        1.  **"players" key**: This should be an array of objects. For EACH player in the original list, provide an object with the following keys:
            *   "id": The player's ID (must match the input).
            *   "flexOwnership": Your best projection for their FLEX ownership percentage (as a number).
            *   "mvpOwnership": Your best projection for their MVP ownership percentage (as a number).
            *   "leverage": A GPP leverage score from 1-100.
                - A high score (85+) means the player has massive upside relative to their projected ownership, making them an elite tournament play. They are a "good chalk" or a high-upside pivot.
                - A medium score (50-84) represents a solid play who is appropriately owned.
                - A low score (<50) means they are likely "bad chalk" (over-owned relative to their ceiling) or have very low upside.

        2.  **"slateNotes" key**: A string containing sharp, concise analysis. Structure it with two markdown subheadings:
            *   "### Roster Construction Forecast": Describe the 2-3 most common roster builds you expect to see and **estimate their combined ownership percentage**. (e.g., "Chalk 4-2 KC stacks featuring the QB and his top two targets will be popular, likely making up ~25-30% of the field...").
            *   "### Top Leverage Stack": Identify a single, lower-owned stack that has the potential to win a tournament if the game script breaks their way. **Estimate its ownership** and explain the rationale.

        Return ONLY the single, valid JSON object.

        Player List:
        ${JSON.stringify(playerList, null, 2)}
    `;

    const responseSchema = {
        type: Type.OBJECT,
        properties: {
            players: {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        id: { type: Type.STRING },
                        flexOwnership: { type: Type.NUMBER },
                        mvpOwnership: { type: Type.NUMBER },
                        leverage: { type: Type.NUMBER },
                    },
                    required: ['id', 'flexOwnership', 'mvpOwnership', 'leverage']
                }
            },
            slateNotes: { type: Type.STRING },
        },
        required: ['players', 'slateNotes']
    };

    const responseText = await generateContent(prompt, { responseSchema }, 120000, 2);
    
    const parsedJson = JSON.parse(responseText);
    const validationResult = OwnershipResponseSchema.safeParse(parsedJson);

    if (!validationResult.success) {
        logger.error("Zod validation failed for AI ownership response", {
            error: validationResult.error.flatten(),
            data: parsedJson,
        });
        throw new Error("AI ownership response failed validation. The data structure was not as expected.");
    }
    
    const analysis = validationResult.data;

    const analysisMap = new Map(analysis.players.map(p => [p.id, p]));

    const updatedPlayers = players.map(p => {
        const playerData = analysisMap.get(p.id);
        if (playerData) {
            return {
                ...p,
                flexOwnership: playerData.flexOwnership,
                mvpOwnership: playerData.mvpOwnership,
                leverage: playerData.leverage,
            };
        }
        return p;
    });

    return {
        players: updatedPlayers,
        slateNotes: analysis.slateNotes,
    };
}