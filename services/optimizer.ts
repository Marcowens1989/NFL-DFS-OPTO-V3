import { Player, Lineup, StackingRules } from '../types';
import { solveLineup } from './solverService';
import { calculateLineupStats } from './evSimulationService';

export type OptimizationTarget = 'mean' | 'ceiling';

// Helper to get Fpts based on optimization target
export const getTargetFpts = (p: Player, target: OptimizationTarget) => {
    const baseFpts = target === 'ceiling' ? p.scenarioFpts.ceiling : p.fpts;
    return baseFpts + (p.usageBoost || 0);
};

// Creates a unique signature for a lineup to avoid duplicates
const getLineupSignature = (mvp: Player, flex: Player[]): string => {
  const sortedFlexIds = flex.map(p => p.id).sort();
  return [mvp.id, ...sortedFlexIds].join(',');
};

// Generates multiple lineups respecting exposure constraints
export async function generateMultipleLineups(
    players: Player[],
    lockedPlayers: Player[],
    excludedIds: Set<string>,
    numberOfLineups: number,
    salaryCap: number,
    stackingRules: StackingRules,
    optimizationTarget: OptimizationTarget,
): Promise<Lineup[]> {
    const lineups: Lineup[] = [];
    const excludedLineupSignatures = new Set<string>();
    const playerMap = new Map(players.map(p => [p.id, p]));

    for (let i = 0; i < numberOfLineups; i++) {
        const solution = await solveLineup(
            players,
            lockedPlayers,
            excludedIds,
            excludedLineupSignatures,
            salaryCap,
            stackingRules,
            optimizationTarget
        );

        if (solution && solution.length > 0) {
            const mvp = playerMap.get(solution.find(p => p.isMvp)!.id)!;
            const flex = solution.filter(p => !p.isMvp).map(p => playerMap.get(p.id)!);
            
            const lineup: Lineup = {
                mvp,
                flex,
                ...calculateLineupStats(mvp, flex, optimizationTarget),
            };

            lineups.push(lineup);
            const signature = getLineupSignature(lineup.mvp, lineup.flex);
            excludedLineupSignatures.add(signature);
        } else {
            break; // No more unique, valid lineups can be found
        }
    }

    return lineups;
}