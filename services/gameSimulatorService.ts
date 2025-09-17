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
    const teamAbbrs = description.match(/\b([A-Z]{2,3})\b/g);

    if (!teamAbbrs || teamAbbrs.length < 2) {
        throw new Error(`Could not parse team abbreviations from game description: "${description}"`);
    }
    const [teamA, teamB] = teamAbbrs;

    const prompt = `
        You are an automated data scraping and aggregation engine. Your task is to simulate fetching and parsing all relevant data for a historical NFL game, including a comprehensive suite of sabermetrics and schematic DNA profiles.

        **Game to Process:** ${description}

        **Instructions:**
        1.  **Simulate Scraping Play-by-Play Data:** Extract all relevant offensive fantasy statistics for every key player.
        2.  **Simulate Scraping Advanced Player Metrics:** Emulate fetching data from advanced sources (PFF, Next Gen Stats). For each player, provide estimates for all applicable metrics from the schema below, including their player **archetype**.
        3.  **Simulate Scraping Advanced Team & Situational Metrics:** Emulate fetching team-level data. For each team, provide estimates for their respective metrics. Also include game-level situational data like weather.
        4.  **Simulate Scouting for Team DNA:** Analyze each team's typical play style and provide their primary **offensiveScheme** and **defensiveScheme**.
        5.  **Simulate Fetching Pre-Game Context:** Use your search capabilities to find the key injuries and the final Vegas line (spread and total) that were known *before kickoff*.
        6.  **Return Structured JSON:** Format your findings into a single, valid JSON object according to the provided schema. Omit any metric that is zero or not applicable.

        **JSON Schema:**
        - "gameId": The provided ID ("${gameId}").
        - "description": The provided description.
        - "pregameContext":
            - "injuries": Array of strings for key player injuries.
            - "vegasLine": String summarizing the closing Vegas line.
            - "teamDna": An object where keys are explicit team abbreviations ("${teamA}", "${teamB}"), containing their offensive and defensive schemes.
            - "advancedTeamMetrics": An object where keys are explicit team abbreviations, containing applicable team-level metrics.
            - "strengthOfSchedule", "weatherFactor", "homeFieldAdvantageScore": Game-level situational factors.
        - "players": An array of player objects. Each object must contain:
            - "name", "team", "position", "archetype".
            - "stats": Object containing all non-zero basic offensive stats.
            - "advancedStats": Object containing all non-zero advanced player metrics.

        Respond with ONLY the JSON object. Do not include any commentary or markdown formatting.
    `;

    const advancedPlayerStatsSchema = {
        type: Type.OBJECT,
        properties: {
            airYards: { type: Type.NUMBER }, redZoneTouches: { type: Type.NUMBER }, targetShare: { type: Type.NUMBER }, rushAttemptShare: { type: Type.NUMBER },
            yardsPerRouteRun: { type: Type.NUMBER }, aDOT: { type: Type.NUMBER }, yardsAfterCatch: { type: Type.NUMBER }, routesRun: { type: Type.NUMBER },
            avoidedTackles: { type: Type.NUMBER }, yardsCreatedPerTouch: { type: Type.NUMBER }, playActionPassRate: { type: Type.NUMBER }, timeToThrow: { type: Type.NUMBER },
            cleanPocketCompletion: { type: Type.NUMBER }, underPressureCompletion: { type: Type.NUMBER }, deepBallCompletion: { type: Type.NUMBER }, redZoneConversionRate: { type: Type.NUMBER },
        }
    };
    
    const singleTeamMetricsProperties = {
        offensiveLineRank: { type: Type.NUMBER }, defensiveLineRank: { type: Type.NUMBER }, passRushWinRate: { type: Type.NUMBER },
        runStopWinRate: { type: Type.NUMBER }, secondaryCoverageRank: { type: Type.NUMBER }, playsPerGame: { type: Type.NUMBER },
        neutralSituationPace: { type: Type.NUMBER }, neutralSituationPassRate: { type: Type.NUMBER },
        coachingAggressivenessScore: { type: Type.NUMBER }, turnoverDifferential: { type: Type.NUMBER },
    };

    const advancedTeamMetricsSchema = {
        type: Type.OBJECT,
        properties: {
            [teamA]: { type: Type.OBJECT, properties: singleTeamMetricsProperties },
            [teamB]: { type: Type.OBJECT, properties: singleTeamMetricsProperties }
        },
    };
    
    const teamDnaSchema = {
        type: Type.OBJECT,
        properties: {
            [teamA]: {
                type: Type.OBJECT,
                properties: { offensiveScheme: { type: Type.STRING }, defensiveScheme: { type: Type.STRING } }
            },
            [teamB]: {
                type: Type.OBJECT,
                properties: { offensiveScheme: { type: Type.STRING }, defensiveScheme: { type: Type.STRING } }
            }
        }
    };

    const responseSchema = {
        type: Type.OBJECT,
        properties: {
            gameId: { type: Type.STRING },
            description: { type: Type.STRING },
            pregameContext: {
                type: Type.OBJECT,
                properties: {
                    injuries: { type: Type.ARRAY, items: { type: Type.STRING } },
                    vegasLine: { type: Type.STRING },
                    teamDna: teamDnaSchema,
                    advancedTeamMetrics: advancedTeamMetricsSchema,
                    strengthOfSchedule: { type: Type.NUMBER },
                    weatherFactor: { type: Type.NUMBER },
                    homeFieldAdvantageScore: { type: Type.NUMBER },
                },
                required: ['injuries', 'vegasLine']
            },
            players: {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        name: { type: Type.STRING }, team: { type: Type.STRING }, position: { type: Type.STRING },
                        archetype: { type: Type.STRING },
                        stats: {
                            type: Type.OBJECT,
                            properties: {
                                passYds: { type: Type.NUMBER }, passTds: { type: Type.NUMBER }, interceptions: { type: Type.NUMBER },
                                rushYds: { type: Type.NUMBER }, rushTds: { type: Type.NUMBER },
                                receptions: { type: Type.NUMBER }, recYds: { type: Type.NUMBER }, recTds: { type: Type.NUMBER },
                                fumblesLost: { type: Type.NUMBER },
                            }
                        },
                        advancedStats: advancedPlayerStatsSchema,
                    },
                    required: ['name', 'team', 'position', 'stats', 'archetype']
                }
            }
        },
        required: ['gameId', 'description', 'pregameContext', 'players']
    };

    try {
        const responseText = await generateContent(prompt, { responseSchema }, 180000, 2);
        const parsedData: Omit<HistoricalGame, 'players'> & { players: Omit<HistoricalGame['players'][0], 'actualFdp'>[] } = JSON.parse(responseText);
        
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