import { StatWeights, TunedModel, ModelDiscoveryReport, HistoricalGame, ValidationReport, SimulationParams } from '../types';
import { simulateGameDataScraping } from './gameSimulatorService';
import { discoverOptimalModel } from './modelDiscoveryService';
import { modelStore } from './modelStore';
import { MultivariateLinearRegression } from 'ml-regression';
import { getHistoricalGamesToSimulate } from './historicalDataVaultService';
import { generateContent } from './aiModelService';
import { Type } from '@google/genai';

const HISTORICAL_GAMES_TO_SIMULATE = getHistoricalGamesToSimulate();

// This constant is now exported to be used by the dataManager for initial projection calculation.
export const INITIAL_WEIGHTS: StatWeights = {
    passYds: 0.04, passTds: 4, interceptions: -1,
    rushYds: 0.1, rushTds: 6,
    receptions: 0.5, recYds: 0.1, recTds: 6,
    fumblesLost: -2,
    airYards: 0, redZoneTouches: 0, targetShare: 0, rushAttemptShare: 0,
    yardsPerRouteRun: 0, aDOT: 0, yardsAfterCatch: 0, routesRun: 0, avoidedTackles: 0,
    yardsCreatedPerTouch: 0, playActionPassRate: 0, timeToThrow: 0, cleanPocketCompletion: 0,
    underPressureCompletion: 0, deepBallCompletion: 0, redZoneConversionRate: 0,
    offensiveLineRank: 0, defensiveLineRank: 0, passRushWinRate: 0, runStopWinRate: 0,
    secondaryCoverageRank: 0, playsPerGame: 0, neutralSituationPace: 0, neutralSituationPassRate: 0,
    strengthOfSchedule: 0, weatherFactor: 0, homeFieldAdvantageScore: 0, coachingAggressivenessScore: 0,
    turnoverDifferential: 0, qb_passYds: 0, qb_rushYds: 0, topTeammate_recYds: 0,
    topTeammate_rushYds: 0, topTeammate_receptions: 0,
};

const ALL_STAT_WEIGHT_KEYS = Object.keys(INITIAL_WEIGHTS) as (keyof StatWeights)[];

/**
 * Calculates a player's predicted fantasy points based on a given model.
 * This is the core projection function, now fully refactored and hardened.
 */
function calculatePredictedFdp(player: HistoricalGame['players'][0], weights: StatWeights, game: HistoricalGame): number {
    let score = 0;
    const { team, stats, advancedStats, matchupAdvantageScore } = player;
    const opponentAbbr = Object.keys(game.pregameContext.teamDna || {}).find(t => t !== team);

    // 1. Apply weights to all player-level stats (raw and advanced)
    for (const key of ALL_STAT_WEIGHT_KEYS) {
        const value = (stats as any)?.[key] ?? (advancedStats as any)?.[key];
        if (value != null && weights[key] != null) {
            score += value * weights[key]!;
        }
    }

    // 2. Apply weights for team-level stats
    const teamMetrics = game.pregameContext.advancedTeamMetrics?.[team];
    if (teamMetrics) {
        for (const key of Object.keys(teamMetrics) as (keyof typeof teamMetrics)[]) {
            const weightKey = key as keyof StatWeights;
            if (teamMetrics[key] != null && weights[weightKey] != null) {
                score += teamMetrics[key]! * weights[weightKey]!;
            }
        }
    }

    // 3. Apply weights for opponent's defensive stats
    if (opponentAbbr) {
        const opponentMetrics = game.pregameContext.advancedTeamMetrics?.[opponentAbbr];
        if (opponentMetrics) {
            if (weights.defensiveLineRank && opponentMetrics.defensiveLineRank) score += opponentMetrics.defensiveLineRank * weights.defensiveLineRank;
            if (weights.secondaryCoverageRank && opponentMetrics.secondaryCoverageRank) score += opponentMetrics.secondaryCoverageRank * weights.secondaryCoverageRank;
        }
    }
    
    // 4. Apply game-level situational weights
    const { strengthOfSchedule, weatherFactor, homeFieldAdvantageScore } = game.pregameContext;
    if (strengthOfSchedule != null && weights.strengthOfSchedule) score += strengthOfSchedule * weights.strengthOfSchedule;
    if (weatherFactor != null && weights.weatherFactor) score += weatherFactor * weights.weatherFactor;
    if (homeFieldAdvantageScore != null && weights.homeFieldAdvantageScore) score += homeFieldAdvantageScore * weights.homeFieldAdvantageScore;

    // 5. Apply the Matchup Advantage Score as a final multiplier
    return score * (matchupAdvantageScore || 1.0);
}

/**
 * NEW: The Matchup Supremacy Engine's AI analysis step.
 * It analyzes all players in a batch of games and returns an enriched map.
 */
async function analyzeMatchupImpact(games: HistoricalGame[]): Promise<Map<string, HistoricalGame>> {
    const enrichedGamesMap = new Map<string, HistoricalGame>(games.map(g => [g.gameId, JSON.parse(JSON.stringify(g))])); // Deep copy
    const allPlayers = games.flatMap(g => {
        const opponentAbbrs = Object.keys(g.pregameContext.teamDna || {});
        return g.players.map(p => {
            const opponentTeam = opponentAbbrs.find(t => t !== p.team);
            return {
                gameId: g.gameId,
                playerName: p.name,
                playerTeam: p.team,
                playerArchetype: p.archetype,
                opponentDefensiveScheme: opponentTeam ? g.pregameContext.teamDna?.[opponentTeam]?.defensiveScheme : 'Unknown'
            };
        });
    });

    // To stay within token limits, we process in batches if needed
    if (allPlayers.length === 0) return enrichedGamesMap;

    const prompt = `
        You are a master NFL Scout and Analyst. Your task is to quantify player-vs-defense matchups.
        For each player provided, analyze the interaction between their **Player Archetype** and the opponent's **Defensive Scheme**.
        Return a numerical **Matchup Advantage Score**.
        - A score of **1.15 to 1.30** represents an elite "smash spot".
        - A score around **1.0** is a neutral matchup.
        - A score of **0.70 to 0.85** represents a brutal matchup.

        Return a single JSON object with a single key "matchups", which is an array of objects.
        Each object must contain "gameId", "playerName", and "matchupAdvantageScore".

        Player Matchups:
        ${JSON.stringify(allPlayers.slice(0, 150), null, 2)}
    `;

    const responseSchema = {
        type: Type.OBJECT,
        properties: {
            matchups: {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        gameId: { type: Type.STRING },
                        playerName: { type: Type.STRING },
                        matchupAdvantageScore: { type: Type.NUMBER },
                    },
                    required: ['gameId', 'playerName', 'matchupAdvantageScore']
                }
            }
        },
        required: ['matchups']
    };
    
    try {
        const responseText = await generateContent(prompt, { responseSchema });
        const result: { matchups: { gameId: string, playerName: string, matchupAdvantageScore: number }[] } = JSON.parse(responseText);
        
        for (const matchup of result.matchups) {
            const game = enrichedGamesMap.get(matchup.gameId);
            if (game) {
                const player = game.players.find(p => p.name === matchup.playerName);
                if (player) {
                    player.matchupAdvantageScore = matchup.matchupAdvantageScore;
                }
            }
        }
    } catch (error) {
        console.error("Failed to analyze matchup impacts with AI. Proceeding without matchup scores.", error);
    }
    
    return enrichedGamesMap;
}

/**
 * The main orchestrator for the backtesting engine.
 */
export async function runFullSimulation(
    params: SimulationParams,
    onProgress: (message: string, percentage: number) => void
): Promise<ValidationReport> {
    const totalGames = HISTORICAL_GAMES_TO_SIMULATE.length;
    if (totalGames < 4) throw new Error("A minimum of 4 historical games are required.");

    onProgress("Splitting data into training/validation sets...", 5);
    
    // Seeded PRNG for deterministic shuffling, complying with MD-AL-001 (Anti-Leakage Wall).
    // This ensures that train/validation splits are perfectly reproducible across runs.
    const createSeededRandom = (seed: number) => {
        let state = seed;
        return () => {
            state = (state * 9301 + 49297) % 233280;
            return state / 233280;
        };
    };
    const REPRODUCIBLE_SEED = 1337;
    const random = createSeededRandom(REPRODUCIBLE_SEED);
    const shuffledGames = [...HISTORICAL_GAMES_TO_SIMULATE].sort(() => 0.5 - random());

    const trainingSetSize = Math.floor(totalGames * (params.trainValidateSplit / 100));
    const validationSize = totalGames - trainingSetSize;

    if (validationSize < 2) throw new Error("Simulation requires at least 2 validation games. Please adjust the train/validate split.");

    const trainingGamesInfo = shuffledGames.slice(validationSize);
    const validationGamesInfo = shuffledGames.slice(0, validationSize);
    let historicalGames: HistoricalGame[] = [];

    // DATA FORTRESS: Layer 2 (Cache) & Layer 4 (Full Scrape)
    onProgress("Fetching and caching historical game data...", 10);
    const allGamesInfo = [...trainingGamesInfo, ...validationGamesInfo];
    for (let i = 0; i < allGamesInfo.length; i++) {
        const gameInfo = allGamesInfo[i];
        const percentage = 10 + Math.round((i / allGamesInfo.length) * 40);
        let gameData = await modelStore.getHistoricalGame(gameInfo.id);
        if (!gameData) {
            onProgress(`Simulating data for: ${gameInfo.description}...`, percentage);
            // Proactive throttling to be a polite API consumer
            await new Promise(res => setTimeout(res, 1500));
            gameData = await simulateGameDataScraping(gameInfo.id, gameInfo.description);
            await modelStore.saveHistoricalGame(gameData);
        }
        historicalGames.push(gameData);
    }
    
    onProgress("Analyzing player vs. defense matchups...", 50);
    const enrichedGamesMap = await analyzeMatchupImpact(historicalGames);

    const trainingGames = trainingGamesInfo.map(info => enrichedGamesMap.get(info.id)!);
    const validationGames = validationGamesInfo.map(info => enrichedGamesMap.get(info.id)!);

    onProgress("Discovering predictive models from training data...", 55);
    const discoveryReports: ModelDiscoveryReport[] = [];
    for (let i = 0; i < trainingGames.length; i++) {
        const gameData = trainingGames[i];
        if(!gameData) continue; // Skip if a game failed to load
        const percentage = 60 + Math.round((i / trainingGames.length) * 20);
        try {
            onProgress(`Reverse-engineering model for: ${gameData.description}...`, percentage);
            // Proactive throttling
            await new Promise(res => setTimeout(res, 1500));
            const report = await discoverOptimalModel(gameData);
            discoveryReports.push(report);
        } catch (error) {
            onProgress(`Error processing ${gameData.description}. Skipping.`, percentage);
            console.error(error);
        }
    }
    
    if (discoveryReports.length === 0) throw new Error("Failed to discover any models from training data.");
    
    onProgress("Creating candidate models...", 85);
    const candidateModels = createCandidateModels(discoveryReports, trainingGames, params);

    onProgress("Validating models against unseen historical data...", 90);
    const validatedModels = validateModels(candidateModels, validationGames);

    onProgress("Simulation and validation complete!", 100);

    return {
        trainingSetSize: trainingGames.length,
        validationSetSize: validationGames.length,
        models: validatedModels.sort((a, b) => a.performance.validationMae - b.performance.validationMae),
    };
}

// --- MODEL CREATION ---
function createCandidateModels(reports: ModelDiscoveryReport[], trainingGames: HistoricalGame[], params: SimulationParams): TunedModel[] {
    const models: TunedModel[] = [];
    const rawWeightKeys = ['passYds', 'passTds', 'interceptions', 'rushYds', 'rushTds', 'receptions', 'recYds', 'recTds', 'fumblesLost'] as const;

    try {
        const { X, y } = buildFeatureMatrix(trainingGames, rawWeightKeys);
        if (X.length > rawWeightKeys.length) {
            const regression = new MultivariateLinearRegression(X, y);
            const weights = buildWeightsFromCoefficients(INITIAL_WEIGHTS, regression.coefficients, rawWeightKeys);
            models.push({ name: 'Master Quant Model (Regression-Based)', weights, sourceDescription: `Regression on raw stats from ${y.length} players.` } as TunedModel);
        }
    } catch (e) { console.error("Failed to create Master Quant Model:", e); }

    const sabermetricWeightKeys = ALL_STAT_WEIGHT_KEYS.filter(k => !(rawWeightKeys as readonly string[]).includes(k) && !k.startsWith('qb_') && !k.startsWith('topTeammate_'));
    try {
        const { X, y } = buildFeatureMatrix(trainingGames, sabermetricWeightKeys);
        if (X.length > sabermetricWeightKeys.length) {
            const regression = new MultivariateLinearRegression(X, y);
            const weights = buildWeightsFromCoefficients(INITIAL_WEIGHTS, regression.coefficients, sabermetricWeightKeys);
            models.push({ name: 'Sabermetric Synthesis Model', weights, sourceDescription: `Regression on 25+ advanced sabermetrics.` } as TunedModel);
        }
    } catch(e) { console.error("Failed to create Sabermetric Synthesis Model:", e); }

    try {
        const { X, y, keys } = buildCorrelationFeatureMatrix(trainingGames, rawWeightKeys);
        if (X.length > keys.length) {
            const regression = new MultivariateLinearRegression(X, y);
            const weights = buildWeightsFromCoefficients(INITIAL_WEIGHTS, regression.coefficients, keys);
            models.push({ name: 'Correlation-Infused Quant Model', weights, sourceDescription: `Regression model that includes teammate performance.` } as TunedModel);
        }
    } catch(e) { console.error("Failed to create Correlation-Infused Quant Model:", e); }

    const allHindsightWeights = reports.map(r => r.hindsightModel.weights);
    if (allHindsightWeights.length > 0) {
        models.push({ name: 'Averaged Hindsight Model (AI-Based)', weights: averageWeights(allHindsightWeights), sourceDescription: `Averaged from ${reports.length} AI-analyzed games.` } as TunedModel);
    }
    
    // Ensemble the top K models based on their performance on the *training* set as a heuristic
    if (models.length > 1) {
        const trainingValidatedModels = validateModels(models, trainingGames);
        const topModels = trainingValidatedModels
            .sort((a,b) => a.performance.validationMae - b.performance.validationMae)
            .slice(0, params.topKEnsemble);

        models.push({
            name: `Ensemble Super Model (Top ${topModels.length})`,
            weights: averageWeights(topModels.map(m => m.weights)),
            sourceDescription: `A synthesized model averaging the top ${topModels.length} candidates.`
        } as TunedModel);
    }

    return models.map(m => ({ ...m, id: `${m.name.replace(/\s/g, '_')}_${Date.now()}`, createdAt: new Date().toISOString(), performance: { mae: 0 } }));
}

// --- MODEL VALIDATION ---
function validateModels(candidateModels: TunedModel[], validationGames: HistoricalGame[]): (TunedModel & { performance: { validationMae: number } })[] {
    return candidateModels.map(model => {
        let totalAbsoluteError = 0, playerCount = 0;
        for (const game of validationGames) {
             if(!game) continue;
            for (const player of game.players) {
                if (player.actualFdp > 0) {
                    const predictedFdp = calculatePredictedFdp(player, model.weights, game);
                    totalAbsoluteError += Math.abs(predictedFdp - player.actualFdp);
                    playerCount++;
                }
            }
        }
        return { ...model, performance: { ...model.performance, validationMae: playerCount > 0 ? totalAbsoluteError / playerCount : Infinity } };
    });
}

// --- HELPER FUNCTIONS ---
function buildFeatureMatrix(games: HistoricalGame[], keys: readonly (keyof StatWeights)[]) {
    const X: number[][] = [], y: number[] = [];
    for (const game of games) {
        if(!game) continue;
        for (const player of game.players) {
            if (player.actualFdp > 0) {
                const features = keys.map(key => (player.stats as any)?.[key] ?? (player.advancedStats as any)?.[key] ?? (game.pregameContext.advancedTeamMetrics?.[player.team] as any)?.[key] ?? (game.pregameContext as any)?.[key] ?? 0);
                if (features.some(f => f !== 0)) { X.push(features); y.push(player.actualFdp); }
            }
        }
    }
    return { X, y };
}

function buildCorrelationFeatureMatrix(games: HistoricalGame[], rawKeys: readonly (keyof StatWeights)[]) {
    const X: number[][] = [], y: number[] = [];
    const correlationKeys: (keyof StatWeights)[] = ['qb_passYds', 'qb_rushYds', 'topTeammate_recYds', 'topTeammate_rushYds', 'topTeammate_receptions'];
    const allKeys: readonly (keyof StatWeights)[] = [...rawKeys, ...correlationKeys];

    for (const game of games) {
        if(!game) continue;
        const qb = game.players.find(p => p.position === 'QB' && p.stats.passYds);
        const topTeammate = game.players.filter(p => p.name !== qb?.name && p.position !== 'QB').sort((a, b) => (b.salary || 0) - (a.salary || 0))[0];
        for (const player of game.players) {
             if (player.actualFdp > 0 && player.position !== 'QB') {
                const features = rawKeys.map(key => (player.stats as any)[key] || 0);
                features.push(qb?.stats.passYds || 0, qb?.stats.rushYds || 0, topTeammate?.name === player.name ? 0 : topTeammate?.stats.recYds || 0, topTeammate?.name === player.name ? 0 : topTeammate?.stats.rushYds || 0, topTeammate?.name === player.name ? 0 : topTeammate?.stats.receptions || 0);
                X.push(features); y.push(player.actualFdp);
             }
        }
    }
    return { X, y, keys: allKeys };
}

function buildWeightsFromCoefficients(base: StatWeights, coefficients: number[][], keys: readonly (keyof StatWeights)[]) {
    const newWeights = { ...base };
    // The regression library returns a 2D array for coefficients, so we access the first element.
    const coeffArray = coefficients[0]; 
    if (!coeffArray) return newWeights;

    coeffArray.forEach((coeff, i) => {
        if (keys[i]) {
            // ANTI-NAN SANITIZATION LAYER
            newWeights[keys[i]] = isNaN(coeff) ? 0 : coeff;
        }
    });
    return newWeights;
}

function averageWeights(weightsList: StatWeights[]): StatWeights {
    const avgWeights: { [k in keyof StatWeights]?: number } = {};
    for (const weights of weightsList) {
        for (const key of ALL_STAT_WEIGHT_KEYS) {
            avgWeights[key] = (avgWeights[key] || 0) + (weights[key] || 0);
        }
    }
    for (const key of ALL_STAT_WEIGHT_KEYS) {
        avgWeights[key] = (avgWeights[key] || 0) / weightsList.length;
    }
    return avgWeights as StatWeights;
}