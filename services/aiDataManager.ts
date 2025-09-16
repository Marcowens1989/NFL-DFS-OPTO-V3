import { GoogleGenAI, Type } from "@google/genai";
import { Player } from '../types';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });

interface ValidationResult {
    playersToExclude: Set<string>;
    validationSummary: string;
}

export async function validatePlayers(players: Player[]): Promise<ValidationResult> {
    try {
        const playerList = players.map(p => `- ${p.name} (${p.position}, ${p.team}) - Injury Status from file: '${p.injuryStatus || 'None'}'`).join('\n');
        
        const prompt = `
            You are a DFS data validation expert. Your task is to check the real-time active status of a list of NFL players for an upcoming game.
            Using your search capabilities, determine which players from the list below are confirmed to be INACTIVE. This includes players on Injured Reserve (IR), ruled OUT, on the practice squad, or otherwise not expected to play. Do not flag players who are simply Questionable or Doubtful unless news confirms they are officially out.

            Player List:
            ${playerList}

            Your response must be in two parts, separated by '---'.
            1. A comma-separated list of the full names of ONLY the players who are confirmed INACTIVE. If no players are inactive, respond with "None".
            2. A brief, one-sentence summary of your findings. For example: "John Doe excluded (IR), Jane Smith excluded (Out)." or "All players appear to be active."

            Example Response:
            Jason Sanders,Tyler Bass---Jason Sanders excluded (IR), Tyler Bass excluded (Out).
        `;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                tools: [{ googleSearch: {} }],
            },
        });

        const [inactiveNamesStr, summary] = response.text.split('---');

        const playersToExclude = new Set<string>();
        if (inactiveNamesStr && inactiveNamesStr.toLowerCase().trim() !== 'none') {
            const inactiveNames = inactiveNamesStr.split(',').map(name => name.trim().toLowerCase());
            players.forEach(p => {
                if (inactiveNames.includes(p.name.toLowerCase())) {
                    playersToExclude.add(p.id);
                }
            });
        }
        
        return {
            playersToExclude,
            validationSummary: summary ? summary.trim() : "AI validation complete. All players appear to be active.",
        };

    } catch (error) {
        console.error("Error validating player data with AI:", error);
        return {
            playersToExclude: new Set(),
            validationSummary: "AI validation failed. Please check player statuses manually.",
        };
    }
}


export async function enrichGameData(players: Player[]): Promise<Player[]> {
    if (players.length === 0) return players;

    try {
        const teams = Array.from(new Set(players.map(p => p.team)));
        const gameIdentifier = `${players[0].team} vs ${players[0].opponent}`;

        const prompt = `
            You are a DFS data analyst for an NFL Showdown slate: ${gameIdentifier}.
            Your task is to provide three specific data points for this game using your search capabilities.

            1.  **Vegas Point Total:** Find the current Over/Under (total points) line for this game from a reputable sportsbook.
            2.  **Coordinator Tendencies:** For BOTH teams involved (${teams.join(', ')}), determine if their offensive coordinator's scheme is generally considered "pass-heavy", "run-heavy", or "balanced".
            3.  **Defensive Blitz Rates:** For BOTH teams involved, find their defensive blitz rate percentage (how often they send extra pass rushers).

            Respond with a JSON object with the exact following structure. Do not include any other text or explanations.

            {
              "gameScriptScore": VEGAS_POINT_TOTAL,
              "teamData": {
                "TEAM_ABBR_1": {
                  "coordinatorTendency": "pass-heavy" | "run-heavy" | "balanced",
                  "blitzRateDefense": BLITZ_RATE_PERCENTAGE
                },
                "TEAM_ABBR_2": {
                  "coordinatorTendency": "pass-heavy" | "run-heavy" | "balanced",
                  "blitzRateDefense": BLITZ_RATE_PERCENTAGE
                }
              }
            }
        `;
        
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
             config: {
                responseMimeType: "application/json",
                tools: [{ googleSearch: {} }],
             },
        });
        
        const jsonText = response.text.trim();
        const data = JSON.parse(jsonText);

        const enrichedPlayers = players.map(p => {
            const opponentTeamData = data.teamData[p.opponent];
            const playerTeamData = data.teamData[p.team];
            return {
                ...p,
                gameScriptScore: data.gameScriptScore || 50, // Default to 50 if not found
                blitzRateDefense: opponentTeamData?.blitzRateDefense || 0,
                coordinatorTendency: playerTeamData?.coordinatorTendency || 'balanced',
            };
        });
        
        return enrichedPlayers;

    } catch (error) {
        console.error("Error enriching game data with AI:", error);
        // Return original players if enrichment fails so the app doesn't break
        return players;
    }
}
