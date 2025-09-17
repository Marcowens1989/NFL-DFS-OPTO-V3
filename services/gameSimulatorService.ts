import { HistoricalGame, StatWeights } from '../types';
import { generateContent } from './aiModelService';
import { Type } from '@google/genai';

// Standard FanDuel scoring rules
const FANDUEL_WEIGHTS: StatWeights = {
    passYds: 0.04, passTds: 4, interceptions: -1,
    rushYds: 0.1, rushTds: 6,
    receptions: 0.5, recYds: 0.1, recTds: 6,
    fumblesLost: -2,
};

function calculateActualFdp(stats: HistoricalGame['players'][0]['stats']): number {
    let score = 0;
    if (stats.passYds) score += stats.passYds * FANDUEL_WEIGHTS.passYds;
    if (stats.passTds) score += stats.passTds * FANDUEL_WEIGHTS.passTds;
    if (stats.interceptions) score += stats.interceptions * FANDUEL_WEIGHTS.interceptions;
    if (stats.rushYds) score += stats.rushYds * FANDUEL_WEIGHTS.rushYds;
    if (stats.rushTds) score += stats.rushTds * FANDUEL_WEIGHTS.rushTds;
    if (stats.receptions) score += stats.receptions * FANDUEL_WEIGHTS.receptions;
    if (stats.recYds) score += stats.recYds * FANDUEL_WEIGHTS.recYds;
    if (stats.recTds) score += stats.recTds * FANDUEL_WEIGHTS.recTds;
    if (stats.fumblesLost) score += stats.fumblesLost * FANDUEL_WEIGHTS.fumblesLost;
    return score;
}

/**
 * Simulates a backend process that scrapes nfl.com gamebooks and other sources for a given historical game.
 * @param gameId A unique identifier for the game.
 * @param description A text description of the game (e.g., "Week 1 2023, Kansas City Chiefs vs. Detroit Lions").
 * @returns A structured HistoricalGame object with raw stats and pre-game context.
 */
export async function simulateGameDataScraping(gameId: string, description: string): Promise<HistoricalGame> {
    const prompt = `
        You are an automated data scraping and aggregation engine. Your task is to simulate fetching and parsing all relevant data for a historical NFL game, including advanced metrics used by DFS experts.

        **Game to Process:** ${description}

        **Instructions:**
        1.  **Simulate Scraping Play-by-Play Data:** Act as if you are parsing the official nfl.com gamebook for this matchup. Extract all relevant offensive fantasy statistics for every player (QB, RB, WR, TE).
        2.  **Simulate Scraping Advanced Metrics:** Emulate fetching data from advanced sources (like Pro Football Focus, Establish The Run). For each player, provide estimates for the following:
            *   "airYards": The total distance the ball traveled in the air on passes targeted to the player.
            *   "redZoneTouches": The total number of rushing attempts plus pass targets a player received inside the opponent's 20-yard line.
            *   "targetShare": The percentage of the team's total pass attempts that were thrown to this player (as a number, e.g., 25.5 for 25.5%).
            *   "rushAttemptShare": The percentage of the team's total rush attempts that this player handled (as a number, e.g., 60 for 60%).
        3.  **Simulate Fetching Pre-Game Context:** Use your search capabilities to find the key injuries and the final Vegas line (spread and total) that were known *before kickoff*.
        4.  **Return Structured JSON:** Format your findings into a single, valid JSON object according to the provided schema.

        **JSON Schema:**
        - "gameId": The provided ID ("${gameId}").
        - "description": The provided description.
        - "pregameContext":
            - "injuries": An array of strings describing key player injuries (e.g., "Travis Kelce (TE, KC) was inactive.").
            - "vegasLine": A string summarizing the closing Vegas line (e.g., "KC -4.5, Total: 52.5").
        - "players": An array of player objects. Each object must contain:
            - "name": Full name.
            - "team": Team abbreviation.
            - "position": Position.
            - "stats": An object containing all non-zero offensive stats (e.g., passYds, rushTds, receptions). Omit keys for stats that are zero.
            - "advancedStats": An object containing the advanced metrics. Omit keys for stats that are zero.

        Respond with ONLY the JSON object. Do not include any commentary or markdown formatting.
    `;

    const responseSchema = {
        type: Type.OBJECT,
        properties: {
            gameId: { type: Type.STRING },
            description: { type: Type.STRING },
            pregameContext: {
                type: Type.OBJECT,
                properties: {
                    injuries: { type: Type.ARRAY, items: { type: Type.STRING } },
                    vegasLine: { type: Type.STRING }
                },
                required: ['injuries', 'vegasLine']
            },
            players: {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        name: { type: Type.STRING },
                        team: { type: Type.STRING },
                        position: { type: Type.STRING },
                        stats: {
                            type: Type.OBJECT,
                            properties: {
                                passYds: { type: Type.NUMBER }, passTds: { type: Type.NUMBER }, interceptions: { type: Type.NUMBER },
                                rushYds: { type: Type.NUMBER }, rushTds: { type: Type.NUMBER },
                                receptions: { type: Type.NUMBER }, recYds: { type: Type.NUMBER }, recTds: { type: Type.NUMBER },
                                fumblesLost: { type: Type.NUMBER },
                            }
                        },
                         advancedStats: {
                            type: Type.OBJECT,
                            properties: {
                                airYards: { type: Type.NUMBER },
                                redZoneTouches: { type: Type.NUMBER },
                                targetShare: { type: Type.NUMBER },
                                rushAttemptShare: { type: Type.NUMBER },
                            }
                        }
                    },
                    required: ['name', 'team', 'position', 'stats']
                }
            }
        },
        required: ['gameId', 'description', 'pregameContext', 'players']
    };

    try {
        const responseText = await generateContent(prompt, { responseSchema }, 120000, 2);
        const parsedData: Omit<HistoricalGame, 'players'> & { players: Omit<HistoricalGame['players'][0], 'actualFdp'>[] } = JSON.parse(responseText);
        
        // Post-process to calculate the actual FDP for each player and store it.
        const playersWithFdp = parsedData.players.map(player => ({
            ...player,
            actualFdp: calculateActualFdp(player.stats)
        }));

        return { ...parsedData, players: playersWithFdp };
    } catch (e) {
        console.error(`Failed to simulate data for game: ${description}`, e);
        throw new Error(`AI simulation failed for game: ${description}. ${e instanceof Error ? e.message : 'Unknown error.'}`);
    }
}