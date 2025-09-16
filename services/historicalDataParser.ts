import { ParsedHistoricalPlayer, OptimalLineupData } from '../types';
import { getAiClient } from './aiService';

// FanDuel Scoring Rules (simplified for offense)
const SCORING_RULES = {
    passYds: 0.04,
    passTds: 4,
    interceptions: -1,
    rushYds: 0.1,
    rushTds: 6,
    receptions: 0.5,
    recYds: 0.1,
    recTds: 6,
    fumblesLost: -2,
};

function calculateFanduelPoints(player: ParsedHistoricalPlayer): number {
    let score = 0;
    if (player.passYds) score += player.passYds * SCORING_RULES.passYds;
    if (player.passTds) score += player.passTds * SCORING_RULES.passTds;
    if (player.interceptions) score += player.interceptions * SCORING_RULES.interceptions;
    if (player.receptions) score += player.receptions * SCORING_RULES.receptions;
    if (player.recYds) score += player.recYds * SCORING_RULES.recYds;
    if (player.recTds) score += player.recTds * SCORING_RULES.recTds;
    if (player.rushYds) score += player.rushYds * SCORING_RULES.rushYds;
    if (player.rushTds) score += player.rushTds * SCORING_RULES.rushTds;
    if (player.fumblesLost) score += player.fumblesLost * SCORING_RULES.fumblesLost;
    return score;
}

async function parsePlayerStatBlob(statBlob: string): Promise<ParsedHistoricalPlayer[]> {
    if (!statBlob.trim()) return [];
    const ai = getAiClient();
    const prompt = `
        You are a data parsing expert. Convert the following unstructured text blob of player stats into a clean JSON array.
        Each object in the array should represent a player and have the following structure with ONLY these keys:
        { "name": "STRING", "team": "STRING", "passYds": NUMBER, "passTds": NUMBER, "interceptions": NUMBER, "rushAtt": NUMBER, "rushYds": NUMBER, "rushTds": NUMBER, "receptions": NUMBER, "recYds": NUMBER, "recTds": NUMBER, "fumblesLost": NUMBER }
        - Extract the player's full name. Handle suffixes like 'Sr.' correctly.
        - Extract the player's team abbreviation.
        - Parse all available offensive stats. If a stat is not present for a player, OMIT the key.
        - For '3/5 REC', the first number (3) is 'receptions'.
        - For '15 ATT', the number (15) is 'rushAtt'.
        - Do not include stats for Kickers or Defenses.
        - Respond with ONLY the JSON array. Do not include any other text, markdown, or commentary.

        TEXT BLOB:
        ---
        ${statBlob}
        ---
    `;
    
    const response = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: prompt });
    const jsonText = response.text.trim().match(/\[[\s\S]*\]/)?.[0] || '[]';
    
    try {
        const parsed = JSON.parse(jsonText);
        // Post-processing validation to filter out malformed objects
        return parsed.filter((p: any) => p && typeof p.name === 'string' && typeof p.team === 'string');
    } catch (e) {
        console.error("Failed to parse AI response as JSON for player stats:", jsonText);
        throw new Error("AI failed to return valid JSON for player stats. Please check the format of the pasted data.");
    }
}

async function parseOwnershipBlob(ownershipBlob: string): Promise<Record<string, { actualFlexOwnership: number }>> {
    if (!ownershipBlob.trim()) return {};
    const ai = getAiClient();
    const prompt = `
        You are a data parsing expert. The following text contains player ownership data. Convert it into a JSON object where the key is the player's full name and the value is an object with one key, "actualFlexOwnership", which should be the ownership percentage as a NUMBER.
        - Handle suffixes like 'Sr.' correctly.
        - Ignore any lines that are not player data.
        - Respond with ONLY the JSON object. Do not include any other text, markdown, or commentary.

        TEXT BLOB:
        ---
        ${ownershipBlob}
        ---
    `;
    const response = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: prompt });
    const jsonText = response.text.trim().match(/\{[\s\S]*\}/)?.[0] || '{}';

    try {
        return JSON.parse(jsonText);
    } catch (e) {
        console.error("Failed to parse AI response as JSON for ownership:", jsonText);
        throw new Error("AI failed to return valid JSON for ownership data.");
    }
}

async function parseOptimalsBlob(optimalsBlob: string): Promise<OptimalLineupData[]> {
    if (!optimalsBlob.trim()) return [];
    // This is a simple text format, we can parse it with regex instead of AI for speed and reliability.
    const lines = optimalsBlob.split('\n').slice(1); // Skip header
    const optimals: OptimalLineupData[] = [];
    const regex = /(.+?)\s+(\d+(?:st|nd|rd|th))\s+([\d–]+)\s+([\d.]+)\s+(.+?)\s+(\d+)\s+/;
    for (const line of lines) {
        const match = line.match(regex);
        if (match) {
            optimals.push({
                rank: match[2],
                score: parseFloat(match[4]),
                lineupSummary: match[5].trim(),
                dupeCount: parseInt(match[6], 10),
            });
        }
    }
    return optimals;
}

export async function getWinningFactorsAnalysis(players: ParsedHistoricalPlayer[], optimals: OptimalLineupData[]): Promise<string> {
    const ai = getAiClient();
    const topPlayers = players.sort((a,b) => b.actualFdp - a.actualFdp).slice(0,15);
    const playersSummary = topPlayers.map(p => `${p.name}: ${p.actualFdp.toFixed(2)} FDP @ ${p.actualFlexOwnership?.toFixed(1) ?? 'N/A'}% own`).join('\n');
    const optimalsSummary = optimals.slice(0,5).map(o => `Rank ${o.rank}: ${o.score.toFixed(2)} FDP - ${o.lineupSummary}`).join('\n');

    const prompt = `
    You are a world-class DFS analyst. Based on the provided historical data for an NFL Showdown slate, generate a "Slate DNA" report that identifies the key characteristics of the winning lineups.

    **Historical Data:**
    *Top Players:*
    ${playersSummary}

    *Top Optimal Lineups:*
    ${optimalsSummary}

    **Your Task:**
    Analyze the data and provide a concise report answering the following questions:
    1.  **Stack Strategy:** What was the dominant lineup construction? (e.g., "QB MVP with two pass-catchers and an opponent bring-back won the slate.")
    2.  **Chalk vs. Leverage:** Did the optimal lineups feature the high-owned chalk players, or did low-owned pivot plays make the difference? Identify a key leverage play.
    3.  **Salary Allocation:** Was it a "stars and scrubs" build (using very cheap players to afford expensive studs) or a more balanced approach?
    4.  **Winning Narrative:** What was the likely game script that led to this result?
    `;
    const response = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: prompt });
    return response.text;
}

export async function parseHistoricalData(statBlob: string, ownershipBlob: string, optimalsBlob: string): Promise<{ players: ParsedHistoricalPlayer[], optimals: OptimalLineupData[] }> {
    const [playersResult, ownershipResult, optimalsResult] = await Promise.all([
        parsePlayerStatBlob(statBlob),
        parseOwnershipBlob(ownershipBlob),
        parseOptimalsBlob(optimalsBlob)
    ]);
    
    const ownershipMap = new Map(Object.entries(ownershipResult));

    const combinedPlayers = playersResult.map(p => {
        const ownershipInfo = ownershipMap.get(p.name);
        return {
            ...p,
            actualFdp: calculateFanduelPoints(p),
            actualFlexOwnership: ownershipInfo?.actualFlexOwnership,
        };
    });

    return { players: combinedPlayers, optimals: optimalsResult };
}