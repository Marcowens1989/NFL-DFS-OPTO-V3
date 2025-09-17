import { Player, PlayerStatus } from '../types';
import { getAIOwnershipAnalysis } from './ownership';
import { analyzePlayerValue } from './valueAnalyzer';
import { getPlayerStatusesFromSleeper } from './externalApis';
import { generateContent } from './aiModelService';
import { Type } from '@google/genai';

export interface UploadData {
  players: Player[];
  statuses: Record<string, PlayerStatus>;
  validationReport: string;
  slateNotes: string;
}

// --- Utility for Batching ---
function batch<T>(items: T[], batchSize: number): T[][] {
  const batches: T[][] = [];
  for (let i = 0; i < items.length; i += batchSize) {
    batches.push(items.slice(i, i + batchSize));
  }
  return batches;
}


// --- Core Data Pipeline Steps ---

async function parseCsv(file: File): Promise<Player[]> {
  const text = await file.text();
  const lines = text.split(/\r?\n/).filter(line => line.trim() !== '');
  if (lines.length < 2) throw new Error("CSV must have a header and at least one player.");
  
  const header = lines[0].toLowerCase().split(',').map(h => h.trim().replace(/"/g, ''));
  const requiredHeaders = ['id', 'nickname', 'position', 'salary', 'mvp 1.5x salary', 'fppg', 'team', 'opponent'];
  if (!requiredHeaders.every(h => header.includes(h))) {
    throw new Error(`CSV header is missing one of the required columns: ${requiredHeaders.join(', ')}.`);
  }

  const idIndex = header.indexOf('id');
  const nameIndex = header.indexOf('nickname');
  const posIndex = header.indexOf('position');
  const salIndex = header.indexOf('salary');
  const mvpSalIndex = header.indexOf('mvp 1.5x salary');
  const fppgIndex = header.indexOf('fppg');
  const teamIndex = header.indexOf('team');
  const opponentIndex = header.indexOf('opponent');
  const injuryIndicatorIndex = header.indexOf('injury indicator');
  const injuryDetailsIndex = header.indexOf('injury details');

  return lines.slice(1).map((line, index) => {
    const data = line.match(/(".*?"|[^",]+)(?=\s*,|\s*$)/g)?.map(field => field.trim().replace(/"/g, '')) || [];
    const id = data[idIndex];
    const name = data[nameIndex];
    const position = data[posIndex];
    const team = data[teamIndex];
    const opponent = data[opponentIndex];
    const salary = parseInt(data[salIndex], 10);
    const mvpSalary = parseInt(data[mvpSalIndex], 10);
    const fpts = parseFloat(data[fppgIndex]) || 0;
    const injuryStatus = injuryIndicatorIndex > -1 ? data[injuryIndicatorIndex] : '';
    const injuryDetails = injuryDetailsIndex > -1 ? data[injuryDetailsIndex] : '';

    if (!id || !name || !position || !team || !opponent || isNaN(salary) || isNaN(mvpSalary)) return null;

    // Initialize with default/empty values for new structures
    return { 
      id, name, position, salary, mvpSalary, fpts, team, opponent,
      flexOwnership: 0, mvpOwnership: 0,
      injuryStatus, injuryDetails, usageBoost: 0, notes: '',
      vegas: null,
      scenarioFpts: { ceiling: fpts, floor: fpts },
      correlations: {},
      blitzRateDefense: 0,
      coordinatorTendency: 'balanced',
      projectedUsage: 'Backup',
      sentimentSummary: 'No specific news.',
      leverage: 0,
    };
  }).filter((p): p is Player => p !== null);
}

async function validatePlayersWithAI(players: Player[]): Promise<{ playersToExclude: Set<string>; validationSummary: string; }> {
  if (players.length === 0) {
      return { playersToExclude: new Set(), validationSummary: "" };
  }
  try {
    const playerList = players.map(p => `- ${p.name} (${p.position}, ${p.team}) - Current Status: '${p.injuryStatus || 'None'}'`).join('\n');
    const prompt = `You are a DFS data validation expert. Using your search capabilities, determine if any players from the list below are confirmed INACTIVE (OUT, IR, etc.). Do not flag players who are just Questionable or Doubtful. Respond with a comma-separated list of the full names of ONLY the players confirmed INACTIVE, followed by '---', followed by a one-sentence summary. If none, respond with "None---All players appear active."\n\n${playerList}`;

    const responseText = await generateContent(prompt, undefined, 90000, 2);

    const [inactiveNamesStr, summary] = responseText.split('---');
    const playersToExclude = new Set<string>();
    if (inactiveNamesStr && inactiveNamesStr.toLowerCase().trim() !== 'none') {
      const inactiveNames = inactiveNamesStr.split(',').map(name => name.trim().toLowerCase());
      players.forEach(p => {
        if (inactiveNames.includes(p.name.toLowerCase())) {
          playersToExclude.add(p.id);
        }
      });
    }
    return { playersToExclude, validationSummary: summary ? `AI Fallback: ${summary.trim()}` : "AI validation complete." };
  } catch (error) {
    console.error("AI Validation Error:", error);
    return { playersToExclude: new Set(), validationSummary: `AI validation failed: ${error instanceof Error ? error.message : String(error)}. Please check statuses manually.` };
  }
}

// --- NEW: Granular AI Analysis Functions ---

interface VegasAndProjectionsResult {
    vegas: { teamASpread: number; gameTotal: number; };
    projections: { id: string; meanFpts: number; ceilingFpts: number; floorFpts: number; }[];
}

async function getVegasAndProjectionsAI(players: Player[]): Promise<VegasAndProjectionsResult | null> {
    if (players.length === 0) return null;
    const team = players[0]?.team;
    if (!team) return null;

    const playerList = players.map(p => ({ id: p.id, name: p.name }));
    const prompt = `
        You are a DFS data analyst. For the game involving the ${team}, provide two things:
        1. The current Vegas odds: spread for ${team} and the game total.
        2. For each player provided, your best fantasy point projections (mean, 90th percentile ceiling, 10th percentile floor).
        Return a single JSON object.

        Players: ${JSON.stringify(playerList)}
    `;
    const responseSchema = {
        type: Type.OBJECT,
        properties: {
            vegas: {
                type: Type.OBJECT,
                properties: { teamASpread: { type: Type.NUMBER }, gameTotal: { type: Type.NUMBER } },
                required: ['teamASpread', 'gameTotal']
            },
            projections: {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        id: { type: Type.STRING },
                        meanFpts: { type: Type.NUMBER },
                        ceilingFpts: { type: Type.NUMBER },
                        floorFpts: { type: Type.NUMBER },
                    },
                    required: ['id', 'meanFpts', 'ceilingFpts', 'floorFpts']
                }
            }
        },
        required: ['vegas', 'projections']
    };

    try {
        const responseText = await generateContent(prompt, { responseSchema }, 120000, 2);
        return JSON.parse(responseText);
    } catch (error) {
        console.error("Vegas & Projections AI Error:", error);
        throw error;
    }
}

interface CorrelationItem {
    playerId: string;
    correlatedPlayers: {
        playerId: string;
        coefficient: number;
    }[];
}

interface AdvancedMetricsResult {
    metrics: {
        id: string;
        projectedUsage: 'Starter' | 'Role Player' | 'Backup' | 'Unlikely';
        sentimentSummary: string;
        coordinatorTendency: 'pass-heavy' | 'run-heavy' | 'balanced';
        blitzRateDefense: number;
    }[];
    correlations: CorrelationItem[];
}

async function getAdvancedMetricsAndCorrelationsAI(players: Player[]): Promise<AdvancedMetricsResult | null> {
    if (players.length === 0) return null;
    const playerList = players.map(p => ({ id: p.id, name: p.name, team: p.team }));
    const prompt = `
        You are a DFS data analyst. For each player provided, return their projected usage, a 1-sentence sentiment summary, their team's offensive coordinator tendency, and their opponent's defensive blitz rate.
        Also, generate player correlations. The "correlations" key should be an array of objects. Each object must have a "playerId" (string) and a "correlatedPlayers" (array of objects). Each object in "correlatedPlayers" must have a "playerId" (string) and a "coefficient" (number).
        Example: "correlations": [{ "playerId": "p1", "correlatedPlayers": [{ "playerId": "p2", "coefficient": 0.5 }] }]
        Return a single JSON object.

        Players: ${JSON.stringify(playerList)}
    `;

     const responseSchema = {
        type: Type.OBJECT,
        properties: {
            metrics: {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        id: { type: Type.STRING },
                        projectedUsage: { type: Type.STRING, enum: ['Starter', 'Role Player', 'Backup', 'Unlikely'] },
                        sentimentSummary: { type: Type.STRING },
                        coordinatorTendency: { type: Type.STRING, enum: ['pass-heavy', 'run-heavy', 'balanced'] },
                        blitzRateDefense: { type: Type.NUMBER },
                    },
                     required: ['id', 'projectedUsage', 'sentimentSummary', 'coordinatorTendency', 'blitzRateDefense']
                }
            },
            correlations: {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        playerId: { type: Type.STRING },
                        correlatedPlayers: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    playerId: { type: Type.STRING },
                                    coefficient: { type: Type.NUMBER }
                                },
                                required: ['playerId', 'coefficient']
                            }
                        }
                    },
                    required: ['playerId', 'correlatedPlayers']
                }
            }
        },
        required: ['metrics', 'correlations']
    };

     try {
        const responseText = await generateContent(prompt, { responseSchema }, 180000, 2);
        return JSON.parse(responseText);
    } catch (error) {
        console.error("Advanced Metrics & Correlations AI Error:", error);
        throw error;
    }
}

export async function getPlayerDnaReport(player: Player): Promise<string> {
    const prompt = `
        You are a world-class NFL scout and fantasy football analyst.
        For the player ${player.name} (${player.position}, ${player.team}), who is playing against ${player.opponent}, perform a deep-dive analysis using your search capabilities.
        Find and synthesize advanced metrics to create a "Player DNA Report".
        The report should be a concise, actionable summary covering the following key areas:

        1.  **Usage & Role:** What is their specific role in the offense? (e.g., "High-volume possession receiver", "Red zone rushing specialist", "Deep threat").
        2.  **Key Strengths (based on advanced stats):** Mention 1-2 key strengths supported by metrics like Red Zone Target Share, Average Depth of Target (aDOT), Yards After Catch (YAC), or Yards Per Route Run.
        3.  **Key Weaknesses / Concerns:** Mention 1-2 weaknesses or concerns, such as a tough defensive matchup (e.g., "facing a shutdown cornerback"), inefficiency, or volatility.
        4.  **Path to a Ceiling Performance:** In one sentence, describe what needs to happen in the game for this player to have a slate-winning performance.

        Respond with only the markdown-formatted report.
    `;
    try {
        const report = await generateContent(prompt, undefined, 90000, 2);
        return report;
    } catch (error) {
        console.error(`Error generating DNA report for ${player.name}:`, error);
        throw new Error(`Failed to generate DNA report. The AI may be temporarily unavailable.`);
    }
}


// --- Main Orchestrator ---

export async function handleFileUpload(file: File, setLoadingStatus: (status: string) => void): Promise<UploadData> {
  setLoadingStatus("Parsing CSV...");
  let basePlayers = await parseCsv(file);
  const playerMap = new Map(basePlayers.map(p => [p.id, { ...p }]));
  
  const reportParts: string[] = [];

  // --- Validation Waterfall ---
  setLoadingStatus("Verifying injuries from CSV...");
  const initialStatuses: Record<string, PlayerStatus> = {};
  basePlayers.forEach(p => {
    const status = p.injuryStatus?.toUpperCase();
    initialStatuses[p.id] = (status === 'IR' || status === 'O' || status === 'OUT') ? PlayerStatus.EXCLUDED : PlayerStatus.INCLUDED;
  });

  setLoadingStatus("Verifying injuries (Sleeper API)...");
  const { sleeperStatuses, playersToAICheck, sleeperReport } = await getPlayerStatusesFromSleeper(basePlayers, initialStatuses);
  reportParts.push(sleeperReport);

  // Merge Sleeper statuses
  Object.keys(sleeperStatuses).forEach(id => initialStatuses[id] = sleeperStatuses[id]);

  // --- Parallel AI Analysis (Now Fully Resilient with Batching) ---
  setLoadingStatus("Running AI analysis...");
  
  const playerBatches = batch(basePlayers, 15);

  const [
    aiValidationResult,
    ownershipResult,
    vegasAndProjectionsBatchResults,
    advancedMetricsBatchResults
  ] = await Promise.all([
    validatePlayersWithAI(playersToAICheck).catch(err => {
        console.error("AI validation call failed but we are continuing.", err);
        reportParts.push(`Warning: AI player validation failed. Error: ${err.message}`);
        return { playersToExclude: new Set(), validationSummary: "AI validation call failed." };
    }),
    getAIOwnershipAnalysis(basePlayers).catch(err => {
        console.error("AI ownership call failed but we are continuing.", err);
        reportParts.push(`Warning: Could not load AI ownership. Using defaults. Error: ${err.message}`);
        return null;
    }),
    Promise.all(playerBatches.map(b => getVegasAndProjectionsAI(b))).catch(err => {
        console.error("One or more Vegas & projections calls failed but we are continuing.", err);
        reportParts.push(`Warning: Could not load AI projections. Using FPPG from CSV. Error: ${err.message}`);
        return null;
    }),
    Promise.all(playerBatches.map(b => getAdvancedMetricsAndCorrelationsAI(b))).catch(err => {
        console.error("One or more advanced metrics calls failed but we are continuing.", err);
        reportParts.push(`Warning: Could not load advanced metrics. Using defaults. Error: ${err.message}`);
        return null;
    })
  ]);

  // --- Assemble Final Player Data ---
  setLoadingStatus("Assembling player profiles...");

  // Process AI validation (Safe access)
  if (aiValidationResult?.validationSummary) reportParts.push(aiValidationResult.validationSummary);
  aiValidationResult?.playersToExclude.forEach(id => initialStatuses[id] = PlayerStatus.EXCLUDED);

  const finalStatuses = initialStatuses;
  const slateNotes = ownershipResult?.slateNotes ?? "AI ownership analysis was unavailable.";
  
  // Create maps for efficient lookup (Safe access)
  const ownershipMap = ownershipResult ? new Map(ownershipResult.players.map(p => [p.id, p])) : new Map();
  
  // MERGE BATCHED RESULTS
  const projectionsMap = new Map<string, { id: string; meanFpts: number; ceilingFpts: number; floorFpts: number; }>();
  vegasAndProjectionsBatchResults?.forEach(result => {
      result?.projections.forEach(p => projectionsMap.set(p.id, p));
  });

  const metricsMap = new Map<string, any>();
  const correlationsMap = new Map<string, Record<string, number>>();
  if (advancedMetricsBatchResults) {
    for (const result of advancedMetricsBatchResults) {
        if (!result) continue;
        result.metrics.forEach(m => metricsMap.set(m.id, m));
        for (const corr of result.correlations) {
            const playerCorrelations: Record<string, number> = correlationsMap.get(corr.playerId) || {};
            for (const correlated of corr.correlatedPlayers) {
                playerCorrelations[correlated.playerId] = correlated.coefficient;
            }
            correlationsMap.set(corr.playerId, playerCorrelations);
        }
    }
  }

  // Enrich player data
  playerMap.forEach((player, id) => {
    const ownership = ownershipMap.get(id);
    const projection = projectionsMap.get(id);
    const metric = metricsMap.get(id);

    if (ownership) {
        player.flexOwnership = ownership.flexOwnership;
        player.mvpOwnership = ownership.mvpOwnership;
        player.leverage = ownership.leverage;
    }
    
    if (projection) {
        player.fpts = projection.meanFpts;
        player.scenarioFpts = {
            ceiling: projection.ceilingFpts,
            floor: projection.floorFpts,
        };
    }

    if (metric) {
        player.projectedUsage = metric.projectedUsage;
        player.sentimentSummary = metric.sentimentSummary;
        player.coordinatorTendency = metric.coordinatorTendency;
        player.blitzRateDefense = metric.blitzRateDefense;
    }
    
    player.correlations = correlationsMap.get(id) || {};
  });

  // Add Vegas data to all players (from the first successful batch)
  const firstValidVegasResult = vegasAndProjectionsBatchResults?.find(r => r?.vegas);
  if (firstValidVegasResult) {
      const team = basePlayers[0]?.team;
      const { teamASpread, gameTotal } = firstValidVegasResult.vegas;
      playerMap.forEach(player => {
          const isHomeTeam = player.team === team;
          const spread = isHomeTeam ? teamASpread : -teamASpread;
          player.vegas = {
              spread,
              total: gameTotal,
              impliedTeamTotal: (gameTotal / 2) - (spread / 2),
          };
      });
      reportParts.push("Projections & Vegas odds loaded.");
  }

   if (advancedMetricsBatchResults) {
       reportParts.push("Advanced metrics & correlations loaded.");
   }


  let finalPlayers = Array.from(playerMap.values());

  // --- Post-Validation Steps ---
  setLoadingStatus("Analyzing value from injuries...");
  finalPlayers = analyzePlayerValue(finalPlayers, finalStatuses);

  return {
    players: finalPlayers,
    statuses: finalStatuses,
    validationReport: reportParts.join('\n').trim(),
    slateNotes,
  };
}