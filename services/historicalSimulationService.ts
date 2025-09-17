import { StatWeights, TunedModel, ModelDiscoveryReport, HistoricalGame, ValidationReport } from '../types';
import { simulateGameDataScraping } from './gameSimulatorService';
import { discoverOptimalModel } from './modelDiscoveryService';
import { modelStore } from './modelStore';
import { PREPOPULATED_VAULT } from './data/prepopulatedVault';
import { MultivariateLinearRegression } from 'ml-regression';


// A sample list of historical games to simulate. In a real application, this could be a dynamic list.
const HISTORICAL_GAMES_TO_SIMULATE = [
    { id: '2023_W1_KC_DET', description: 'Week 1 2023, Kansas City Chiefs vs. Detroit Lions' },
    { id: '2023_SB_KC_SF', description: 'Super Bowl LVIII, Kansas City Chiefs vs. San Francisco 49ers' },
    { id: '2022_W4_MIN_NO', description: 'Week 4 2022, Minnesota Vikings vs. New Orleans Saints (London)' },
    { id: '2022_W1_BUF_LA', description: 'Week 1 2022, Buffalo Bills vs. Los Angeles Rams' },
    { id: '2023_W5_CHI_WSH', description: 'Week 5 2023, Chicago Bears vs. Washington Commanders' },
];

const INITIAL_WEIGHTS: StatWeights = {
    passYds: 0.04, passTds: 4, interceptions: -1,
    rushYds: 0.1, rushTds: 6,
    receptions: 0.5, recYds: 0.1, recTds: 6,
    fumblesLost: -2,
    airYards: 0,
    redZoneTouches: 0,
    targetShare: 0,
    rushAttemptShare: 0,
};

function calculatePredictedFdp(player: HistoricalGame['players'][0], weights: StatWeights): number {
    let score = 0;
    const { stats, advancedStats } = player;
    
    // Raw stats
    if (stats.passYds) score += stats.passYds * weights.passYds;
    if (stats.passTds) score += stats.passTds * weights.passTds;
    if (stats.interceptions) score += stats.interceptions * weights.interceptions;
    if (stats.rushYds) score += stats.rushYds * weights.rushYds;
    if (stats.rushTds) score += stats.rushTds * weights.rushTds;
    if (stats.receptions) score += stats.receptions * weights.receptions;
    if (stats.recYds) score += stats.recYds * weights.recYds;
    if (stats.recTds) score += stats.recTds * weights.recTds;
    if (stats.fumblesLost) score += stats.fumblesLost * weights.fumblesLost;
    
    // Advanced stats
    if (advancedStats?.airYards && weights.airYards) score += advancedStats.airYards * weights.airYards;
    if (advancedStats?.redZoneTouches && weights.redZoneTouches) score += advancedStats.redZoneTouches * weights.redZoneTouches;
    if (advancedStats?.targetShare && weights.targetShare) score += advancedStats.targetShare * weights.targetShare;
    if (advancedStats?.rushAttemptShare && weights.rushAttemptShare) score += advancedStats.rushAttemptShare * weights.rushAttemptShare;
    
    return score;
}


/**
 * Runs the full end-to-end historical simulation and model discovery process.
 * @param onProgress A callback function to report progress updates to the UI.
 * @returns The final "master model" derived from the simulation.
 */
export async function runFullSimulation(onProgress: (message: string, percentage: number) => void): Promise<ValidationReport> {
    const totalGames = HISTORICAL_GAMES_TO_SIMULATE.length;
    if (totalGames < 4) {
        throw new Error("Cannot run simulation. A minimum of 4 historical games are required for a valid train/validate split.");
    }

    // --- 1. Split Data into Training and Validation Sets ---
    onProgress("Splitting historical data into training and validation sets...", 5);
    const shuffledGames = [...HISTORICAL_GAMES_TO_SIMULATE].sort(() => 0.5 - Math.random());
    const validationSize = Math.max(1, Math.floor(totalGames * 0.25)); // Hold back 25% for validation
    const trainingGamesInfo = shuffledGames.slice(validationSize);
    const validationGamesInfo = shuffledGames.slice(0, validationSize);
    
    // --- 2. Process all games (Training & Validation) to ensure they are cached ---
    const allGamesInfo = [...trainingGamesInfo, ...validationGamesInfo];
    const historicalGamesMap = new Map<string, HistoricalGame>();
    const staticVaultMap = new Map(PREPOPULATED_VAULT.map(g => [g.gameId, g]));

    for(let i=0; i < allGamesInfo.length; i++) {
        const gameInfo = allGamesInfo[i];
        const percentage = 10 + Math.round((i / allGamesInfo.length) * 40);
        
        // Data Waterfall: Static Vault -> Dexie Vault -> AI Scrape
        let gameData = staticVaultMap.get(gameInfo.id) || null;
        if(gameData) {
             onProgress(`Loaded data from Static Vault for: ${gameInfo.description}`, percentage);
        } else {
            gameData = await modelStore.getHistoricalGame(gameInfo.id);
            if (gameData) {
                onProgress(`Loaded cached data from Dexie Vault for: ${gameInfo.description}`, percentage);
            } else {
                onProgress(`Simulating data for: ${gameInfo.description}...`, percentage);
                gameData = await simulateGameDataScraping(gameInfo.id, gameInfo.description);
                await modelStore.saveHistoricalGame(gameData);
            }
        }
        historicalGamesMap.set(gameInfo.id, gameData);
    }

    // --- 3. Discover Models using ONLY the Training Set ---
    onProgress("Discovering predictive models from training data...", 55);
    const discoveryReports: ModelDiscoveryReport[] = [];
    const trainingGames = trainingGamesInfo.map(info => historicalGamesMap.get(info.id)!);

    for (let i = 0; i < trainingGames.length; i++) {
        const gameData = trainingGames[i];
        const percentage = 60 + Math.round((i / trainingGames.length) * 20); // Progress from 60% to 80%
        try {
            onProgress(`Reverse-engineering model for: ${gameData.description}...`, percentage);
            const report = await discoverOptimalModel(gameData);
            discoveryReports.push(report);
        } catch (error) {
            console.error(`Skipping training game ${gameData.gameId} due to an error:`, error);
            onProgress(`Error processing ${gameData.description}. Skipping.`, percentage);
            continue; // Self-healing: An error in one game doesn't stop the whole simulation
        }
    }
    
    if (discoveryReports.length === 0) {
        throw new Error("The simulation failed to discover any models from the training data. Please check the AI service status.");
    }
    
    // --- 4. Create Candidate Models ---
    onProgress("Creating candidate models...", 85);
    const candidateModels = createCandidateModels(discoveryReports, trainingGames);

    // --- 5. Validate Models against the unseen Validation Set ---
    onProgress("Validating models against unseen historical data...", 90);
    const validationGames = validationGamesInfo.map(info => historicalGamesMap.get(info.id)!);
    const validatedModels = validateModels(candidateModels, validationGames);

    onProgress("Simulation and validation complete!", 100);

    return {
        trainingSetSize: trainingGames.length,
        validationSetSize: validationGames.length,
        models: validatedModels.sort((a,b) => a.performance.validationMae - b.performance.validationMae), // Best model first
    };
}

function createCandidateModels(reports: ModelDiscoveryReport[], trainingGames: HistoricalGame[]): TunedModel[] {
    const models: TunedModel[] = [];
    const rawWeightKeys = Object.keys(INITIAL_WEIGHTS).filter(k => !['airYards', 'redZoneTouches', 'targetShare', 'rushAttemptShare'].includes(k)) as (keyof Omit<StatWeights, 'airYards' | 'redZoneTouches' | 'targetShare' | 'rushAttemptShare'>)[];

    // --- Model 1: The "Master Quant Model" (Raw Stats Regression) ---
    try {
        const X: number[][] = [];
        const y: number[] = [];
        for (const game of trainingGames) {
            for (const player of game.players) {
                if (player.actualFdp > 0) {
                    const features = rawWeightKeys.map(key => player.stats[key as keyof typeof player.stats] || 0);
                    X.push(features);
                    y.push(player.actualFdp);
                }
            }
        }

        if (X.length > rawWeightKeys.length) {
            const regression = new MultivariateLinearRegression(X, y);
            const quantWeights: StatWeights = { ...INITIAL_WEIGHTS };
            regression.coefficients.forEach((coeff, i) => {
                const key = rawWeightKeys[i];
                quantWeights[key] = coeff;
            });
            models.push({
                id: `quant_${Date.now()}`, name: 'Master Quant Model (Regression-Based)', createdAt: new Date().toISOString(),
                weights: quantWeights,
                performance: { mae: 0 },
                sourceDescription: `Statistically derived via regression on raw stats from ${y.length} player performances.`
            });
        }
    } catch (e) {
        console.error("Failed to create Master Quant Model via regression:", e);
    }

    // --- Model 2: The "Establish The Edge" Heuristics Model ---
    const heuristicWeightKeys: (keyof StatWeights)[] = ['airYards', 'redZoneTouches'];
    try {
        const X_advanced: number[][] = [];
        const y_advanced: number[] = [];
        for (const game of trainingGames) {
            for (const player of game.players) {
                if (player.actualFdp > 0 && (player.advancedStats?.airYards || player.advancedStats?.redZoneTouches)) {
                     const features = heuristicWeightKeys.map(key => player.advancedStats?.[key as keyof typeof player.advancedStats] || 0);
                    X_advanced.push(features);
                    y_advanced.push(player.actualFdp);
                }
            }
        }
        if (X_advanced.length > heuristicWeightKeys.length) {
            const regression = new MultivariateLinearRegression(X_advanced, y_advanced);
            const heuristicWeights: StatWeights = { ...(models[0]?.weights || INITIAL_WEIGHTS) }; // Start with the raw quant model weights
            regression.coefficients.forEach((coeff, i) => {
                const key = heuristicWeightKeys[i];
                heuristicWeights[key] = coeff;
            });
             models.push({
                id: `ete_${Date.now()}`, name: 'ETE Heuristics Model', createdAt: new Date().toISOString(),
                weights: heuristicWeights,
                performance: { mae: 0 },
                sourceDescription: `Derived from advanced metrics (Air Yards, RZ Touches) inspired by industry experts.`
            });
        }
    } catch(e) {
        console.error("Failed to create ETE Heuristics Model:", e);
    }

    // --- Model 3: The "Opportunity-Weighted Quant Model" ---
    const opportunityWeightKeys: (keyof StatWeights)[] = ['targetShare', 'rushAttemptShare', 'airYards', 'redZoneTouches'];
    try {
        const X_opp: number[][] = [];
        const y_opp: number[] = [];
        for (const game of trainingGames) {
            for (const player of game.players) {
                if (player.actualFdp > 0 && opportunityWeightKeys.some(k => player.advancedStats?.[k as keyof typeof player.advancedStats])) {
                    const features = opportunityWeightKeys.map(key => player.advancedStats?.[key as keyof typeof player.advancedStats] || 0);
                    X_opp.push(features);
                    y_opp.push(player.actualFdp);
                }
            }
        }
        if (X_opp.length > opportunityWeightKeys.length) {
            const regression = new MultivariateLinearRegression(X_opp, y_opp);
            const opportunityWeights: StatWeights = { ...(models[0]?.weights || INITIAL_WEIGHTS) }; // Start with raw quant weights as a base
            regression.coefficients.forEach((coeff, i) => {
                const key = opportunityWeightKeys[i];
                opportunityWeights[key] = coeff;
            });
            models.push({
                id: `opp_${Date.now()}`, name: 'Opportunity-Weighted Quant Model', createdAt: new Date().toISOString(),
                weights: opportunityWeights,
                performance: { mae: 0 },
                sourceDescription: `Derived from opportunity metrics (Target Share, Rush Share, etc.)`
            });
        }
    } catch(e) {
        console.error("Failed to create Opportunity-Weighted Quant Model:", e);
    }


    // --- Model 4: The "Averaged Hindsight Model" (AI-Based) ---
    const masterWeights: StatWeights = { ...INITIAL_WEIGHTS };
    const weightKeys = Object.keys(INITIAL_WEIGHTS) as (keyof StatWeights)[];
    weightKeys.forEach(key => masterWeights[key] = 0);
    reports.forEach(report => weightKeys.forEach(key => masterWeights[key] += report.hindsightModel.weights[key] || 0));
    weightKeys.forEach(key => masterWeights[key] /= reports.length);

    models.push({
        id: `master_${Date.now()}`, name: 'Averaged Hindsight Model (AI-Based)', createdAt: new Date().toISOString(),
        weights: masterWeights,
        performance: { mae: 0, gamesSimulated: reports.length },
        sourceDescription: `Aggregated from ${reports.length} AI-analyzed training games.`
    });

    // --- Model 5: Game-Script Specific Models (AI-Based) ---
    const scriptModels: Record<string, { weights: StatWeights[], count: number }> = {};
    reports.forEach(report => {
        const script = report.hindsightModel.gameScript;
        if (!scriptModels[script]) scriptModels[script] = { weights: [], count: 0 };
        scriptModels[script].weights.push(report.hindsightModel.weights);
        scriptModels[script].count++;
    });

    for (const [script, data] of Object.entries(scriptModels)) {
        if (data.count === 0) continue;
        const scriptWeights: StatWeights = { ...INITIAL_WEIGHTS };
        weightKeys.forEach(key => scriptWeights[key] = 0);
        data.weights.forEach(w => weightKeys.forEach(key => scriptWeights[key] += w[key] || 0));
        weightKeys.forEach(key => scriptWeights[key] /= data.count);
        
        models.push({
            id: `script_${script}_${Date.now()}`, name: `${script} Model`, createdAt: new Date().toISOString(),
            weights: scriptWeights, gameScript: script as TunedModel['gameScript'],
            performance: { mae: 0, gamesSimulated: data.count },
            sourceDescription: `Averaged from ${data.count} '${script}' training games.`
        });
    }

    // --- FINAL UPGRADE: The "Ensemble Super Model" ---
    if (models.length > 1) {
        const ensembleWeights: StatWeights = { ...INITIAL_WEIGHTS };
        // Zero out the initial weights for accumulation
        weightKeys.forEach(key => (ensembleWeights[key] = 0));

        // Accumulate weights from all other candidate models
        models.forEach(model => {
            weightKeys.forEach(key => {
                ensembleWeights[key] = (ensembleWeights[key] || 0) + (model.weights[key] || 0);
            });
        });

        // Average the weights
        weightKeys.forEach(key => {
            ensembleWeights[key] = (ensembleWeights[key] || 0) / models.length;
        });

        models.push({
            id: `ensemble_${Date.now()}`,
            name: 'Ensemble Super Model',
            createdAt: new Date().toISOString(),
            weights: ensembleWeights,
            performance: { mae: 0 },
            sourceDescription: `A synthesized 'super model' created by averaging the weights of all ${models.length} other candidate models.`
        });
    }


    return models;
}

function validateModels(
    candidateModels: TunedModel[],
    validationGames: HistoricalGame[]
): (TunedModel & { performance: { validationMae: number } })[] {
    const validatedModels = [];
    
    for (const model of candidateModels) {
        let totalAbsoluteError = 0;
        let playerCount = 0;

        for (const game of validationGames) {
            for (const player of game.players) {
                // We only care about players who actually scored, to avoid skewing MAE with zeros
                if (player.actualFdp > 0) {
                    const predictedFdp = calculatePredictedFdp(player, model.weights);
                    totalAbsoluteError += Math.abs(predictedFdp - player.actualFdp);
                    playerCount++;
                }
            }
        }

        const validationMae = playerCount > 0 ? totalAbsoluteError / playerCount : Infinity;
        
        validatedModels.push({
            ...model,
            performance: {
                ...model.performance,
                validationMae
            }
        });
    }

    return validatedModels;
}