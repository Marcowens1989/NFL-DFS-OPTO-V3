import {
    OptimizerSettings,
    BacktestReport,
    BacktestGameResult,
    Player,
    HistoricalGame,
    Lineup
} from '../types';
import { modelStore } from './modelStore';
import { generateMultipleLineups } from './optimizer';

const MVP_MULTIPLIER = 1.5;

// Scores a lineup using actual historical FDPs
function scoreLineupWithActuals(lineup: Lineup, historicalPlayers: HistoricalGame['players'][0][]): number {
    const playerMap = new Map(historicalPlayers.map(p => [p.name, p.actualFdp]));
    
    const mvpPlayerName = lineup.mvp.name;
    const flexPlayerNames = lineup.flex.map(p => p.name);

    const mvpScore = (playerMap.get(mvpPlayerName) || 0) * MVP_MULTIPLIER;
    const flexScore = flexPlayerNames.reduce((sum, name) => sum + (playerMap.get(name) || 0), 0);
    
    return mvpScore + flexScore;
}


export async function runBacktest(
    settings: OptimizerSettings,
    currentPlayers: Player[],
    onProgress: (message: string, percentage: number) => void
): Promise<BacktestReport> {
    onProgress("Initializing backtest...", 0);

    const historicalGames = await modelStore.getHistoricalGames();
    if (!historicalGames || historicalGames.length === 0) {
        throw new Error("No historical games found in the cache. Please run a simulation in the Projections Lab first to populate the cache.");
    }

    const gameResults: BacktestGameResult[] = [];
    const totalGames = historicalGames.length;
    
    const currentPlayersMap = new Map(currentPlayers.map(p => [p.id, p]));
    const lockedPlayerNames = settings.lockedPlayerIds.map(id => currentPlayersMap.get(id)?.name).filter((name): name is string => !!name);
    const excludedPlayerNames = settings.excludedPlayerIds.map(id => currentPlayersMap.get(id)?.name).filter((name): name is string => !!name);

    for (let i = 0; i < totalGames; i++) {
        const game = historicalGames[i];
        const percentage = Math.round(((i + 1) / totalGames) * 100);
        onProgress(`Processing game: ${game.description}`, percentage);

        const poolWithSalaries: Player[] = game.players
            .filter(p => p.salary && p.salary > 0)
            .map(p => ({
                id: `${game.gameId}_${p.name.replace(/\s/g, '')}`,
                name: p.name,
                position: p.position,
                salary: p.salary!,
                fpts: p.actualFdp,
                team: p.team,
                opponent: game.players.find(op => op.team !== p.team)?.team || 'OPP',
                mvpOwnership: 0,
                flexOwnership: 0,
                injuryStatus: '',
                injuryDetails: '',
                usageBoost: 0,
                notes: '',
                statProjections: undefined,
                advancedStats: p.advancedStats,
                vegas: null,
                scenarioFpts: {
                    ceiling: p.actualFdp * 1.5,
                    floor: p.actualFdp * 0.5,
                },
                correlations: {},
                blitzRateDefense: 0,
                coordinatorTendency: 'balanced',
                projectedUsage: 'Starter',
                sentimentSummary: '',
                leverage: 0,
                // FIX: Add missing required properties 'volatility' and 'tags' to conform to the Player type.
                volatility: 50,
                tags: '',
                mvpSalary: p.salary!,
            }));
        
        if (poolWithSalaries.length < 10) {
            console.warn(`Skipping game ${game.gameId} due to insufficient salary data.`);
            continue;
        }

        const lockedPlayers = poolWithSalaries.filter(p => lockedPlayerNames.includes(p.name));
        const excludedIds = new Set(poolWithSalaries.filter(p => excludedPlayerNames.includes(p.name)).map(p => p.id));
        
        // FIX: Added await, as generateMultipleLineups is an async function.
        const generatedLineups = await generateMultipleLineups(
            poolWithSalaries,
            lockedPlayers,
            excludedIds,
            settings.numberOfLineups,
            settings.salaryCap,
            settings.stackingRules,
            'mean' // Use actualFdp as a proxy for perfect projections
        );

        const scoredLineups = generatedLineups.map(lineup => {
            const actualScore = scoreLineupWithActuals(lineup, game.players);
            return { ...lineup, totalFpts: actualScore };
        });

        gameResults.push({
            gameId: game.gameId,
            description: game.description,
            generatedLineups: scoredLineups,
            topScore: Math.max(...scoredLineups.map(l => l.totalFpts), 0),
        });
        
        await new Promise(res => setTimeout(res, 50));
    }
    
    const allGeneratedLineups = gameResults.flatMap(r => r.generatedLineups);
    const totalScore = gameResults.reduce((sum, r) => sum + r.topScore, 0);
    const averageScore = gameResults.length > 0 ? totalScore / gameResults.length : 0;
    
    const playerExposures: BacktestReport['playerExposures'] = {};
    const totalLineupCount = allGeneratedLineups.length;
    
    allGeneratedLineups.forEach(lineup => {
        const playersInLineup = [lineup.mvp, ...lineup.flex];
        playersInLineup.forEach(player => {
            if (!playerExposures[player.name]) {
                playerExposures[player.name] = { count: 0, percentage: 0 };
            }
            playerExposures[player.name].count++;
        });
    });

    Object.keys(playerExposures).forEach(name => {
        if(totalLineupCount > 0) {
            playerExposures[name].percentage = (playerExposures[name].count / totalLineupCount) * 100;
        }
    });

    onProgress("Backtest complete.", 100);

    return {
        settings,
        gameResults,
        summary: {
            averageScore,
            totalGames: gameResults.length,
        },
        playerExposures
    };
}