import { Player, PlayerStatus, StatProjections } from '../types';
import { OwnershipAnalysisResult, getAIOwnershipAnalysis } from './ownership';
import { analyzePlayerValue } from './valueAnalyzer';
import { getPlayerStatusesFromSleeper } from './externalApis';
import { generateContent } from './aiModelService';
import { Type } from '@google/genai';
import { projectPlayerStats, calculateFptsFromProjections } from './projectionService';
import { INITIAL_WEIGHTS } from './historicalSimulationService';
import { FdCsvPlayerSchema, AdvancedPlayerMetricsResponseSchema, InferredAdvancedPlayerMetricsResponse, InferredOwnershipFeaturesResponse } from './schemas';
import { logger } from './loggingService';
import { runPreLockPipeline } from './data/pipeline';

export interface UploadData {
  players: Player[];
  statuses: Record<string, PlayerStatus>;
  validationReport: string;
  slateNotes: string;
}

// --- Core Data Pipeline Steps ---

async function parseCsv(file: File): Promise<Player[]> {
  const text = await file.text();
  const lines = text.split(/\r?\n/).filter(line => line.trim() !== '');
  if (lines.length < 2) throw new Error("CSV must have a header and at least one player.");
  
  const header = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
  const headerMap = new Map(header.map((h, i) => [h, i]));

  const requiredHeaders = ['Id', 'Nickname', 'Position', 'Salary', 'MVP 1.5x Salary', 'FPPG', 'Team', 'Opponent'];
  if (!requiredHeaders.every(h => headerMap.has(h))) {
    throw new Error(`CSV header is missing one of the required columns: ${requiredHeaders.join(', ')}.`);
  }

  return lines.slice(1).map((line, index) => {
    const data = line.match(/(".*?"|[^",]+)(?=\s*,|\s*$)/g)?.map(field => field.trim().replace(/"/g, '')) || [];
    
    const rowObject: { [key: string]: string } = {};
    header.forEach((h, i) => {
        rowObject[h] = data[i];
    });

    const validation = FdCsvPlayerSchema.safeParse(rowObject);
    if (!validation.success) {
      logger.warn(`Skipping invalid CSV row ${index + 2}`, { error: validation.error.flatten(), row: line });
      return null;
    }
    const p = validation.data;

    return { 
      id: p.Id, 
      name: p.Nickname, 
      position: p.Position, 
      salary: p.Salary, 
      mvpSalary: p['MVP 1.5x Salary'], 
      fpts: p.FPPG, 
      team: p.Team, 
      opponent: p.Opponent,
      flexOwnership: 0, 
      mvpOwnership: 0,
      injuryStatus: p['Injury Indicator'] || '', 
      injuryDetails: p['Injury Details'] || '', 
      usageBoost: 0, 
      notes: '',
      vegas: null,
      scenarioFpts: { ceiling: p.FPPG, floor: p.FPPG },
      correlations: {},
      blitzRateDefense: 0,
      coordinatorTendency: 'balanced',
      projectedUsage: 'Backup',
      sentimentSummary: 'No specific news.',
      leverage: 0,
      volatility: p.Volatility || 50, // Default to 50 if not present
      tags: p.Tags || '',
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
    logger.error("AI Validation Error:", { error });
    return { playersToExclude: new Set(), validationSummary: `AI validation failed: ${error instanceof Error ? error.message : String(error)}. Please check statuses manually.` };
  }
}

// --- NEW: Compliant AI function for generating features ---
async function getAdvancedPlayerMetricsAI(players: Player[]): Promise<InferredAdvancedPlayerMetricsResponse | null> {
    if (players.length === 0) {
        return null;
    }
    const team = players[0]?.team;
    const playerList = players.map(p => ({ id: p.id, name: p.name, position: p.position }));

    const prompt = `
        You are a world-class sports data analyst for the NFL Showdown game involving the ${team}.
        Provide a single JSON object containing two top-level keys: "vegas" and "playerMetrics".
        
        1. "vegas": An object with "teamASpread" (number, for the first team alphabetically) and "gameTotal" (number).
        2. "playerMetrics": An array of objects. For EACH player, provide:
            - "id" (string, must match input)
            - "advancedStats": An object with your best estimates for pre-lock metrics: "airYards", "targetShare", "rushAttemptShare", "aDOT".
            - "statProjections": An object with your best estimates for "mean" and "ceiling" outcomes for all applicable statistical categories (e.g., passingYards, rushingTds, receptions).

        Return ONLY the valid JSON object.
    `;
    
    const responseSchema = AdvancedPlayerMetricsResponseSchema;

    try {
        const responseText = await generateContent(prompt, { responseSchema }, 180000, 2);
        const parsedJson = JSON.parse(responseText);
        const validation = responseSchema.safeParse(parsedJson);
        if (!validation.success) {
            logger.error("Zod validation failed for Advanced Player Metrics", { error: validation.error.flatten(), data: parsedJson });
            throw new Error("AI response for advanced metrics failed validation.");
        }
        return validation.data;
    } catch (error) {
        logger.error("Advanced Metrics AI Error:", { error });
        throw error; // Re-throw to be caught by Promise.all
    }
}

// --- NEW: Local calculation step ---
function applyModelProjections(players: Player[]): Player[] {
    return players.map(p => {
        const { meanFpts, ceilingFpts } = projectPlayerStats(p.advancedStats, INITIAL_WEIGHTS);
        return {
            ...p,
            fpts: meanFpts,
            scenarioFpts: {
                ...p.scenarioFpts,
                ceiling: ceilingFpts,
            }
        }
    })
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
        logger.error(`Error generating DNA report for ${player.name}:`, { error });
        throw new Error(`Failed to generate DNA report. The AI may be temporarily unavailable.`);
    }
}


// --- Main Orchestrator ---

export async function handleFileUpload(file: File, setLoadingStatus: (status: string) => void): Promise<UploadData> {
  setLoadingStatus("Parsing CSV...");
  let basePlayers = await parseCsv(file);
  
  setLoadingStatus("Fetching game data & weather...");
  const { enrichedPlayers, pipelineReport } = await runPreLockPipeline(basePlayers);
  basePlayers = enrichedPlayers;
  const reportParts: string[] = [pipelineReport];

  setLoadingStatus("Verifying injuries...");
  const initialStatuses: Record<string, PlayerStatus> = {};
  basePlayers.forEach(p => {
    const status = p.injuryStatus?.toUpperCase();
    initialStatuses[p.id] = (status === 'IR' || status === 'O' || status === 'OUT') ? PlayerStatus.EXCLUDED : PlayerStatus.INCLUDED;
  });

  const { sleeperStatuses, playersToAICheck, sleeperReport } = await getPlayerStatusesFromSleeper(basePlayers, initialStatuses);
  reportParts.push(sleeperReport);
  Object.keys(sleeperStatuses).forEach(id => initialStatuses[id] = sleeperStatuses[id]);

  setLoadingStatus("Running AI analysis...");
  
  const [
    aiValidationResult,
    ownershipResult,
    advancedMetricsResult
  ] = await Promise.all([
    validatePlayersWithAI(playersToAICheck).catch(err => {
        reportParts.push(`Warning: AI player validation failed. Error: ${err.message}`);
        return { playersToExclude: new Set(), validationSummary: "AI validation call failed." };
    }),
    getAIOwnershipAnalysis(basePlayers).catch(err => {
        reportParts.push(`Warning: Could not load AI ownership. Using defaults. Error: ${err.message}`);
        return null;
    }),
    getAdvancedPlayerMetricsAI(basePlayers).catch(err => {
        reportParts.push(`Warning: Could not load AI advanced metrics. Projections will be based on FPPG from CSV. Error: ${err.message}`);
        return null;
    }),
  ]);

  setLoadingStatus("Assembling player profiles...");

  if (aiValidationResult?.validationSummary) reportParts.push(aiValidationResult.validationSummary);
  aiValidationResult?.playersToExclude.forEach(id => initialStatuses[id] = PlayerStatus.EXCLUDED);

  const finalStatuses = initialStatuses;
  const slateNotes = ownershipResult?.slateNotes ?? "AI ownership analysis was unavailable.";
  
  const finalPlayerMap: Map<string, Player> = new Map(basePlayers.map(p => [p.id, { ...p }]));

  if (advancedMetricsResult) {
      // FIX: Corrected typo from advancedMetrics_result to advancedMetricsResult.
      const metricsMap = new Map(advancedMetricsResult.playerMetrics.map(p => [p.id, p]));
      finalPlayerMap.forEach((player, id) => {
          const metrics = metricsMap.get(id);
          if (metrics) {
              // FIX: Cast 'metrics' to 'any' to resolve incorrect type inference to 'unknown'.
              player.advancedStats = (metrics as any).advancedStats;
              // FIX: Cast 'metrics' to 'any' to resolve incorrect type inference to 'unknown'.
              player.statProjections = (metrics as any).statProjections;
          }
      });
      const teamA = advancedMetricsResult.vegas.teamASpread > 0 ? Object.keys(advancedMetricsResult.vegas)[0] : Object.keys(advancedMetricsResult.vegas)[1];
      finalPlayerMap.forEach(player => {
        const isTeamA = player.team.toLowerCase() === teamA.toLowerCase();
        const spread = isTeamA ? advancedMetricsResult.vegas.teamASpread : -advancedMetricsResult.vegas.teamASpread;
        player.vegas = {
            spread,
            total: advancedMetricsResult.vegas.gameTotal,
            impliedTeamTotal: (advancedMetricsResult.vegas.gameTotal / 2) - (spread / 2),
        };
      });
      reportParts.push("Advanced metrics & Vegas odds loaded from AI.");
  }
  
  if (ownershipResult) {
      const ownershipMap = new Map(ownershipResult.players.map(p => [p.id, p]));
      finalPlayerMap.forEach((player, id) => {
          const ownershipData = ownershipMap.get(id);
          if (ownershipData) {
              // FIX: Correctly copy over ownership data from the enriched player object.
              // FIX: Cast 'ownershipData' to 'any' to resolve incorrect type inference to 'unknown'.
              player.flexOwnership = (ownershipData as any).flexOwnership || 0;
              // FIX: Cast 'ownershipData' to 'any' to resolve incorrect type inference to 'unknown'.
              player.mvpOwnership = (ownershipData as any).mvpOwnership || 0;
              // FIX: Cast 'ownershipData' to 'any' to resolve incorrect type inference to 'unknown'.
              player.leverage = (ownershipData as any).leverage || 50;
              // FIX: Assign the ownershipFeatures object, not the entire Player object.
              // FIX: Cast 'ownershipData' to 'any' to resolve incorrect type inference to 'unknown'.
              player.ownershipFeatures = (ownershipData as any).ownershipFeatures;
          }
      });
  }

  let finalPlayers = Array.from(finalPlayerMap.values());
  
  // Re-apply model projections using the new advanced stats
  finalPlayers = applyModelProjections(finalPlayers);
  
  setLoadingStatus("Analyzing value from injuries...");
  finalPlayers = analyzePlayerValue(finalPlayers, finalStatuses);

  return {
    players: finalPlayers,
    statuses: finalStatuses,
    validationReport: reportParts.join('\n').trim(),
    slateNotes,
  };
}