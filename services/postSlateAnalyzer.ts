import { ContestResult, Player, LeakfinderReport, PlayerExposureAnalysis } from '../types';
import { generateContent } from './aiModelService';
import { Type } from '@google/genai';

/**
 * Uses AI to analyze a user's contest results and generate a "Leakfinder Report".
 * @param results The user's parsed contest results.
 * @param players The original player pool from the slate.
 * @returns A promise that resolves to a LeakfinderReport object.
 */
export async function generateLeakfinderReport(
    results: ContestResult[], 
    players: Player[]
): Promise<LeakfinderReport> {
    const totalEntries = results.length;
    const totalPayout = results.reduce((sum, r) => sum + r.payout, 0);
    // Assuming a standard $1 entry fee if not provided. This is a reasonable assumption for analysis.
    const totalCost = totalEntries * 1; 
    const overallRoi = totalCost > 0 ? ((totalPayout - totalCost) / totalCost) * 100 : 0;
    
    // Calculate user's actual exposures
    const userExposure: Record<string, number> = {};
    players.forEach(p => userExposure[p.name] = 0);
    
    results.forEach(r => {
        if (userExposure[r.lineup.mvp] !== undefined) userExposure[r.lineup.mvp]++;
        r.lineup.flex.forEach(flexPlayer => {
            if (userExposure[flexPlayer] !== undefined) userExposure[flexPlayer]++;
        });
    });

    const userExposureSummary = players
        .map(p => ({
            name: p.name,
            exposure: totalEntries > 0 ? (userExposure[p.name] / totalEntries) * 100 : 0,
            fpts: p.fpts,
            leverage: p.leverage,
        }))
        .filter(p => p.exposure > 0)
        .sort((a, b) => b.exposure - a.exposure)
        .slice(0, 25); // Limit to top 25 exposures for prompt efficiency

    const prompt = `
        You are a world-class DFS coach. Your client has provided their contest results and the original player data from a FanDuel NFL Showdown slate. Your task is to generate a "Leakfinder Report" to help them improve.

        **Client's Performance:**
        - Total Entries: ${totalEntries}
        - Overall ROI: ${overallRoi.toFixed(1)}%
        - Top 5 Highest Scoring Lineups:
          ${results.slice(0, 5).map(r => `  - Score: ${r.score}, Payout: $${r.payout}, Roster: ${r.lineup.mvp} (MVP), ${r.lineup.flex.join(', ')}`).join('\n')}

        **Client's Player Exposures (Top 25):**
        ${userExposureSummary.map(p => `  - ${p.name}: ${p.exposure.toFixed(1)}% Exposure (Pre-game Leverage Score: ${p.leverage})`).join('\n')}

        **Your Task:**
        Analyze all the provided data and return a single JSON object with four top-level keys: "overallRoi", "strengths", "leaks", and "playerExposureAnalysis".

        1.  **"overallRoi"**: The client's ROI, as a number.
        2.  **"strengths"**: An array of 2-3 strings. Identify positive patterns in the client's play. Did they correctly identify a high-leverage player? Were their lineup structures sound? Be encouraging but analytical.
        3.  **"leaks"**: An array of 2-3 strings. Identify the biggest "leaks" or mistakes that cost them money. Did they over-expose "bad chalk"? Did they fade a player they shouldn't have? Were their stacks suboptimal? Be direct and provide actionable advice.
        4.  **"playerExposureAnalysis"**: An array of objects. For the 10-15 most important players on the slate (both high and low owned), provide an analysis object with the following keys:
            *   "playerName": The player's full name.
            *   "actualExposure": The user's exposure percentage.
            *   "optimalExposure": Your expert opinion on what the GPP-optimal exposure *should have been* for this player, based on their leverage and ceiling potential.
            *   "leverage": The difference between actual and optimal exposure (actual - optimal).

        Return ONLY the single, valid JSON object.
    `;

    const responseSchema = {
        type: Type.OBJECT,
        properties: {
            overallRoi: { type: Type.NUMBER },
            strengths: { type: Type.ARRAY, items: { type: Type.STRING } },
            leaks: { type: Type.ARRAY, items: { type: Type.STRING } },
            playerExposureAnalysis: {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        playerName: { type: Type.STRING },
                        actualExposure: { type: Type.NUMBER },
                        optimalExposure: { type: Type.NUMBER },
                        leverage: { type: Type.NUMBER },
                    },
                    required: ['playerName', 'actualExposure', 'optimalExposure', 'leverage']
                }
            }
        },
        required: ['overallRoi', 'strengths', 'leaks', 'playerExposureAnalysis']
    };

    const responseText = await generateContent(prompt, { responseSchema });
    return JSON.parse(responseText);
}
