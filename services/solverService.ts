import GLPK from 'glpk.js';
import { Player, StackingRules } from '../types';
import { getTargetFpts, OptimizationTarget } from './optimizer';

const glpk = GLPK();

interface SolutionPlayer {
    id: string;
    isMvp: boolean;
}

/**
 * Solves for the single highest-scoring lineup given a set of constraints
 * using a Mixed-Integer Linear Program (MILP) formulation.
 * @returns An array of players in the optimal lineup, or null if no solution is found.
 */
export async function solveLineup(
    players: Player[],
    lockedPlayers: Player[],
    excludedIds: Set<string>,
    excludedSignatures: Set<string>,
    salaryCap: number,
    stackingRules: StackingRules,
    optimizationTarget: OptimizationTarget
): Promise<SolutionPlayer[] | null> {
    const playerPool = players.filter(p => !excludedIds.has(p.id));
    const numPlayers = playerPool.length;

    // Map players to indices for the solver
    const playerIndexMap = new Map(playerPool.map((p, i) => [p.id, i]));
    const indexPlayerMap = new Map(playerPool.map((p, i) => [i, p]));

    // --- Define the Problem ---
    const problem = {
        name: 'FanDuelShowdown',
        objective: {
            direction: glpk.GLP_MAX,
            name: 'fpts',
            vars: [] as { name: string, coef: number }[],
        },
        subjectTo: [] as any[],
        binaries: [] as string[],
    };

    // --- Create Variables ---
    // p_i = 1 if player i is in the lineup (FLEX)
    // m_i = 1 if player i is MVP
    for (let i = 0; i < numPlayers; i++) {
        const player = indexPlayerMap.get(i)!;
        const score = getTargetFpts(player, optimizationTarget);
        problem.objective.vars.push({ name: `p_${i}`, coef: score });
        problem.objective.vars.push({ name: `m_${i}`, coef: score * 0.5 }); // Additional 0.5x for MVP
        problem.binaries.push(`p_${i}`);
        problem.binaries.push(`m_${i}`);
    }

    // --- Define Constraints ---

    // 1. Total roster size must be 5
    problem.subjectTo.push({
        name: 'roster_size',
        vars: problem.objective.vars.map(v => ({ name: v.name, coef: 1 })),
        bnds: { type: glpk.GLP_FX, ub: 5, lb: 5 },
    });

    // 2. Exactly one MVP
    problem.subjectTo.push({
        name: 'one_mvp',
        vars: playerPool.map((_, i) => ({ name: `m_${i}`, coef: 1 })),
        bnds: { type: glpk.GLP_FX, ub: 1, lb: 1 },
    });

    // 3. A player can be either FLEX or MVP, but not both. An MVP must be in the lineup.
    // m_i <= p_i
    for (let i = 0; i < numPlayers; i++) {
        problem.subjectTo.push({
            name: `mvp_logic_${i}`,
            vars: [{ name: `m_${i}`, coef: 1 }, { name: `p_${i}`, coef: -1 }],
            bnds: { type: glpk.GLP_UP, ub: 0, lb: 0 },
        });
    }

    // 4. Salary cap constraint
    problem.subjectTo.push({
        name: 'salary_cap',
        vars: playerPool.map((p, i) => ({ name: `p_${i}`, coef: p.salary })),
        bnds: { type: glpk.GLP_UP, ub: salaryCap, lb: 0 },
    });

    // 5. Locked players must be in the lineup
    for (const lockedPlayer of lockedPlayers) {
        const idx = playerIndexMap.get(lockedPlayer.id);
        if (idx !== undefined) {
            problem.subjectTo.push({
                name: `lock_${lockedPlayer.id}`,
                vars: [{ name: `p_${idx}`, coef: 1 }],
                bnds: { type: glpk.GLP_FX, ub: 1, lb: 1 },
            });
        }
    }

    // 6. Exclude previously found lineups
    for (const signature of excludedSignatures) {
        const playerIds = signature.split(',');
        const mvpId = playerIds[0];
        const flexIds = playerIds.slice(1);
        const allIds = [mvpId, ...flexIds];

        const vars = allIds.map(id => {
            const idx = playerIndexMap.get(id);
            if (idx === undefined) return null;
            return { name: id === mvpId ? `m_${idx}` : `p_${idx}`, coef: 1 };
        }).filter((v): v is { name: string, coef: number } => v !== null);

        if (vars.length === 5) {
            problem.subjectTo.push({
                name: `exclude_lineup_${signature.substring(0, 10)}`,
                vars: vars,
                bnds: { type: glpk.GLP_UP, ub: 4, lb: 0 }
            });
        }
    }
    
    // --- Solve ---
    // Using a promise wrapper to make the callback-based API easier to use.
    const result = await new Promise<any>((resolve) => {
        glpk.solve(problem, { mip_gaps: 0.01 }, (res: any) => resolve(res));
    });

    if (result.result.status !== glpk.GLP_OPT) {
        return null; // No optimal solution found
    }

    const solution: SolutionPlayer[] = [];
    for (const [varName, value] of Object.entries(result.result.vars)) {
        if (value === 1) {
            const [type, indexStr] = varName.split('_');
            const index = parseInt(indexStr, 10);
            const player = indexPlayerMap.get(index);
            if (player) {
                if (type === 'm') {
                    // Check if already added as flex from p_i var
                    if (!solution.some(p => p.id === player.id)) {
                        solution.push({ id: player.id, isMvp: true });
                    } else {
                        solution.find(p => p.id === player.id)!.isMvp = true;
                    }
                } else { // type === 'p'
                     if (!solution.some(p => p.id === player.id)) {
                        solution.push({ id: player.id, isMvp: false });
                    }
                }
            }
        }
    }

    return solution.length === 5 ? solution : null;
}