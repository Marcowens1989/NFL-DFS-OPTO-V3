import { Player, PlayerStatus, StatProjections } from '../types';
import { generateOwnershipProjections } from './ownership';
import { analyzePlayerValue } from './valueAnalyzer';
import { getPlayerStatusesFromSleeper, getGameDataFromOddsApi } from './externalApis';
import { generateContent } from './aiModelService';

export interface UploadData {
  players: Player[];
  statuses: Record<string, PlayerStatus>;
  validationReport: string;
}

// --- Helper Functions ---

/**
 * Extracts a JSON object from a string, even if it's surrounded by other text.
 * @param text The text to parse.
 * @returns A parsed JSON object, or null if no valid JSON is found.
 */
function extractJsonObject(text: string): any {
  const match = text.match(/\{[\s\S]*\}/);
  if (match) {
    try {
      return JSON.parse(match[0]);
    } catch (e) {
      console.error("Failed to parse extracted JSON:", e);
      return null;
    }
  }
  return null;
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

    return { 
      id, name, position, salary, mvpSalary, fpts, team, opponent,
      flexOwnership: 0, mvpOwnership: 0,
      injuryStatus, injuryDetails, usageBoost: 0, notes: '',
      statProjections: {} as StatProjections,
      correlations: {},
      gameScriptScore: 0,
      blitzRateDefense: 0,
      coordinatorTendency: 'balanced',
      projectedUsage: 'Backup', // Default value
      sentimentSummary: 'No specific news.', // Default value
    };
  }).filter((p): p is Player => p !== null);
}

async function validatePlayersWithAI(players: Player[]): Promise<{ playersToExclude: Set<string>; validationSummary: string; }> {
  try {
    const playerList = players.map(p => `- ${p.name} (${p.position}, ${p.team}) - Current Status: '${p.injuryStatus || 'None'}'`).join('\n');
    const prompt = `You are a DFS data validation expert. Using your search capabilities, determine if any players from the list below are confirmed INACTIVE (OUT, IR, etc.). Do not flag players who are just Questionable or Doubtful. Respond with a comma-separated list of the full names of ONLY the players confirmed INACTIVE, followed by '---', followed by a one-sentence summary. If none, respond with "None---All players appear active."\n\n${playerList}`;

    const responseText = await generateContent(prompt);

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
    return { playersToExclude: new Set(), validationSummary: `AI validation failed: ${error.message}. Please check statuses manually.` };
  }
}

async function _enrichGameScriptWithAI(team: string, opponent: string): Promise<{ data: number, report: string }> {
    try {
        const gameIdentifier = `${team} vs ${opponent}`;
        const prompt = `What is the Vegas Point Total for the NFL game: ${gameIdentifier}? Respond with only the number.`;
        const responseText = await generateContent(prompt);
        const score = parseFloat(responseText);
        if (isNaN(score)) throw new Error("AI did not return a valid number.");
        return { data: score, report: `Game Script Score from AI Fallback: ${score.toFixed(1)}` };
    } catch (error) {
        console.error("Game Script AI Error:", error)
        return { data: 50, report: `Game Script AI failed: ${error.message}. Using default.`}
    }
}

async function _enrichCoordinatorTendenciesWithAI(team: string, opponent: string): Promise<{ data: Record<string, { coordinatorTendency: Player['coordinatorTendency'] }>, report: string }> {
  try {
    const prompt = `For the NFL game ${team} vs ${opponent}, what is the offensive coordinator tendency for each team ('pass-heavy', 'run-heavy', 'balanced')? Respond with ONLY a JSON object like {"${team}": {"coordinatorTendency": "value"}, "${opponent}": {"coordinatorTendency": "value"}}`;
    const responseText = await generateContent(prompt);
    const jsonData = extractJsonObject(responseText);
    if (!jsonData) throw new Error("AI did not return valid JSON.");
    return { data: jsonData, report: "Coordinator Tendencies from AI: Success." };
  } catch (error) {
    console.error("AI Coordinator Tendency Error:", error);
    const defaultData = { [team]: { coordinatorTendency: 'balanced' as const }, [opponent]: { coordinatorTendency: 'balanced' as const } };
    return { data: defaultData, report: `Coordinator Tendency AI failed: ${error.message}. Using defaults.` };
  }
}

async function _enrichBlitzRatesWithAI(team: string, opponent: string): Promise<{ data: Record<string, { blitzRateDefense: number }>, report: string}> {
  try {
    const prompt = `For the NFL game ${team} vs ${opponent}, what is the defensive blitz rate percentage for each team? Respond with ONLY a JSON object like {"${team}": {"blitzRateDefense": NUMBER}, "${opponent}": {"blitzRateDefense": NUMBER}}`;
    const responseText = await generateContent(prompt);
    const jsonData = extractJsonObject(responseText);
    if (!jsonData) throw new Error("AI did not return valid JSON.");
    return { data: jsonData, report: "Blitz Rates from AI: Success." };
  } catch (error) {
    console.error("AI Blitz Rate Error:", error);
    const defaultData = { [team]: { blitzRateDefense: 0 }, [opponent]: { blitzRateDefense: 0 } };
    return { data: defaultData, report: `Blitz Rate AI failed: ${error.message}. Using defaults.`};
  }
}

// Heuristic-based usage assignment (no AI)
function assignDefaultUsageHeuristics(players: Player[]): Player[] {
  return players.map(p => {
    let projectedUsage: Player['projectedUsage'] = 'Backup';
    if (p.salary >= 9000 || (p.salary >= 7000 && ['QB', 'RB', 'WR'].includes(p.position))) {
      projectedUsage = 'Starter';
    } else if (p.salary >= 4000) {
      projectedUsage = 'Role Player';
    } else if (p.salary < 2000 && p.position !== 'K' && p.position !== 'D') {
      projectedUsage = 'Unlikely';
    }
    return { ...p, projectedUsage };
  });
}

// New architecture: Individual, parallel, fault-tolerant AI calls for sentiment
async function enrichWithUsageAndSentiment(players: Player[]): Promise<Player[]> {
  // 1. Assign usage ratings instantly using heuristics
  let playersWithUsage = assignDefaultUsageHeuristics(players);

  // 2. Fetch sentiment for each player individually and in parallel
  const fetchSentiment = async (player: Player): Promise<Partial<Player>> => {
    const prompt = `
      You are an expert fantasy football analyst. For ${player.name} (${player.position}, ${player.team}), use your search capabilities to find the latest news, coach-speak, or beat reporter sentiment for their next game.
      Respond with a single, concise sentence summarizing the sentiment. If no specific news is found, respond with "No specific news."`;
    try {
      const responseText = await generateContent(prompt, 20000); // 20s timeout per player
      return { sentimentSummary: responseText.trim() };
    } catch (error) {
      console.error(`Error fetching sentiment for ${player.name}:`, error);
      return { sentimentSummary: "No specific news." }; // Default value on failure
    }
  };

  const sentimentPromises = players.map(p => fetchSentiment(p));
  const sentimentResults = await Promise.allSettled(sentimentPromises);

  // 3. Combine results
  return playersWithUsage.map((player, index) => {
    const result = sentimentResults[index];
    if (result.status === 'fulfilled') {
      return { ...player, ...result.value };
    }
    return player; // Keep original player data if promise failed
  });
}

export async function getPlayerDnaReport(player: Player): Promise<string> {
    const prompt = `
        You are a world-class NFL scout and fantasy football analyst.
        For the player ${player.name} (${player.position}, ${player.team}), who is playing against ${player.opponent}, perform a deep-dive analysis using your search capabilities.
        Find and synthesize advanced metrics to create a "Player DNA Report".
        The report should be a concise, actionable summary covering the following key areas:

        1.  **Usage & Role:** What is their specific role in the offense? (e.g., "High-volume possession receiver", "Red zone rushing specialist", "Deep threat").
        2.  **Key Strengths (based on advanced stats):** Mention 1-2 key strengths supported by metrics like Red Zone Target Share, Average Depth of Target (aDOT), Yards After Catch (YAC), Yards Per Route Run, or Breakaway Run Rate.
        3.  **Key Weaknesses / Concerns:** Mention 1-2 weaknesses or concerns, such as a tough defensive matchup (e.g., "facing a shutdown cornerback"), inefficiency, or volatility.
        4.  **Path to a Ceiling Performance:** In one sentence, describe what needs to happen in the game for this player to have a slate-winning performance.

        Respond with only the markdown-formatted report.
    `;
    try {
        const report = await generateContent(prompt, 45000); // Give it a longer timeout
        return report;
    } catch (error) {
        console.error(`Error generating DNA report for ${player.name}:`, error);
        throw new Error(`Failed to generate DNA report. The AI may be temporarily unavailable.`);
    }
}


// --- Main Orchestrator ---

export async function handleFileUpload(file: File, setLoadingStatus: (status: string) => void): Promise<UploadData> {
  setLoadingStatus("Parsing CSV...");
  let players = await parseCsv(file);

  setLoadingStatus("Projecting ownership...");
  players = generateOwnershipProjections(players);
  
  // --- Validation Waterfall ---
  const finalStatuses: Record<string, PlayerStatus> = {};
  const reportParts: string[] = [];

  // 1. Initial Pass from CSV data
  const excludedFromCsv: string[] = [];
  players.forEach(p => {
      const status = p.injuryStatus?.toUpperCase();
      if (status === 'IR' || status === 'O' || status === 'OUT') {
          finalStatuses[p.id] = PlayerStatus.EXCLUDED;
          excludedFromCsv.push(`${p.name} (IR/Out from CSV)`);
      } else {
          finalStatuses[p.id] = PlayerStatus.INCLUDED;
      }
  });
  if (excludedFromCsv.length > 0) {
      reportParts.push(`Initial Exclusions from CSV: ${excludedFromCsv.join(', ')}.`);
  }

  // 2. Primary Check with Sleeper API
  setLoadingStatus("Fetching injury data from Sleeper...");
  const { sleeperStatuses, playersToAICheck, sleeperReport } = await getPlayerStatusesFromSleeper(players, finalStatuses);
  Object.assign(finalStatuses, sleeperStatuses);
  reportParts.push(sleeperReport);

  // 3. AI Fallback for remaining players
  if (playersToAICheck.length > 0) {
    setLoadingStatus("Validating with AI (fallback)...");
    const { playersToExclude: aiExcludes, validationSummary: aiReport } = await validatePlayersWithAI(playersToAICheck);
    aiExcludes.forEach(id => finalStatuses[id] = PlayerStatus.EXCLUDED);
    reportParts.push(aiReport);
  }

  // --- Enrichment Waterfall (Parallel Processing) ---
  setLoadingStatus("Enriching game data...");
  
  const team = players[0].team;
  const opponent = players[0].opponent;

  const gameScriptPromise = (async () => {
    try {
      const gameData = await getGameDataFromOddsApi(team, opponent);
      if (gameData) {
        return { data: gameData.gameScriptScore, report: `Game Script Score from Odds API: ${gameData.gameScriptScore.toFixed(1)}` };
      }
    } catch (e) { console.error("Odds API Error:", e) }
    // Fallback
    return _enrichGameScriptWithAI(team, opponent);
  })();
  
  const [tendenciesPromise, blitzRatesPromise] = await Promise.all([
    _enrichCoordinatorTendenciesWithAI(team, opponent),
    _enrichBlitzRatesWithAI(team, opponent),
  ]);

  const gameScriptResult = await gameScriptPromise;

  reportParts.push(gameScriptResult.report, tendenciesPromise.report, blitzRatesPromise.report);

  players = players.map(p => ({
    ...p,
    gameScriptScore: gameScriptResult.data,
    coordinatorTendency: tendenciesPromise.data[p.team]?.coordinatorTendency || 'balanced',
    blitzRateDefense: blitzRatesPromise.data[p.opponent]?.blitzRateDefense || 0,
  }));

  // --- Post-Validation Steps ---
  setLoadingStatus("Analyzing player value based on injuries...");
  players = analyzePlayerValue(players, finalStatuses);
  
  setLoadingStatus("Analyzing usage & sentiment...");
  players = await enrichWithUsageAndSentiment(players);

  return {
    players,
    statuses: finalStatuses,
    validationReport: reportParts.join('\n').trim(),
  };
}