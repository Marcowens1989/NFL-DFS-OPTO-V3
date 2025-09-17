

import { Player, Lineup, StackingRules } from '../types';

const ROSTER_SIZE = 5; // 1 MVP + 4 FLEX
const FLEX_SIZE = ROSTER_SIZE - 1;
const MVP_MULTIPLIER = 1.5;

export type OptimizationTarget = 'mean' | 'ceiling';

// Helper to get Fpts based on optimization target
const getTargetFpts = (p: Player, target: OptimizationTarget) => {
    const baseFpts = target === 'ceiling' ? p.scenarioFpts.ceiling : p.fpts;
    return baseFpts + (p.usageBoost || 0);
};

// Creates a unique signature for a lineup to avoid duplicates
const getLineupSignature = (mvp: Player, flex: Player[]): string => {
  const sortedFlexIds = flex.map(p => p.id).sort();
  return [mvp.id, ...sortedFlexIds].join(',');
};

// Calculates stats for a given lineup
function calculateLineupStats(mvp: Player, flex: Player[], optimizationTarget: OptimizationTarget): Omit<Lineup, 'mvp' | 'flex'> {
  const totalSalary = flex.reduce((sum, p) => sum + p.salary, mvp.salary);
  const totalFpts = flex.reduce((sum, p) => sum + getTargetFpts(p, 'mean'), getTargetFpts(mvp, 'mean') * MVP_MULTIPLIER);
  const totalCeilingFpts = flex.reduce((sum, p) => sum + getTargetFpts(p, 'ceiling'), getTargetFpts(mvp, 'ceiling') * MVP_MULTIPLIER);
  
  const lineup = [mvp, ...flex];

  const totalOwnership = lineup.reduce((sum, p, index) => {
      // MVP contributes their MVP ownership, FLEX their FLEX ownership
      const ownership = index === 0 ? p.mvpOwnership : p.flexOwnership;
      return sum + ownership;
  }, 0);
  const ownershipScore = lineup.length > 0 ? totalOwnership / lineup.length : 0;

  // Calculate Ownership Product (proxy for duplication rate)
  const ownershipProduct = lineup.reduce((prod, p, index) => {
      const ownership = index === 0 ? p.mvpOwnership : p.flexOwnership;
      // Use a small epsilon to avoid multiplying by zero for players with 0% ownership
      return prod * (ownership / 100 || 0.0001);
  }, 1);
  
  const totalLeverage = lineup.reduce((sum, p) => sum + (p.leverage || 0), 0);
  const leverageScore = lineup.length > 0 ? totalLeverage / lineup.length : 0;

  const teamCounts: Record<string, number> = {};
  lineup.forEach(p => {
      teamCounts[p.team] = (teamCounts[p.team] || 0) + 1;
  });
  const stackType = Object.values(teamCounts).sort((a, b) => b - a).join('-');

  let correlationScore = 0;
  for (let i = 0; i < lineup.length; i++) {
      for (let j = i + 1; j < lineup.length; j++) {
          const playerA = lineup[i];
          const playerB = lineup[j];
          const corrValue = (playerA.correlations?.[playerB.id] || playerB.correlations?.[playerA.id] || 0);
          correlationScore += corrValue;
      }
  }

  // Add a bonus for the primary QB-pass catcher stack to better value them.
  const qbInLineup = lineup.find(p => p.position === 'QB');
  if (qbInLineup) {
    const passCatchers = lineup.filter(p => 
      p.team === qbInLineup.team && 
      (p.position === 'WR' || p.position === 'TE')
    );

    if (passCatchers.length > 0) {
      const primaryStackCorrelation = Math.max(
        ...passCatchers.map(catcher => qbInLineup.correlations?.[catcher.id] || 0)
      );
      
      if (primaryStackCorrelation > 0) {
        // Add the strongest positive correlation value again as a bonus.
        correlationScore += primaryStackCorrelation;
      }
    }
  }

  // NEW ROI SCORE: Heavily rewards ceiling and uniqueness (low ownership product),
  // while also factoring in correlation and leverage.
  const uniquenessFactor = 1 / (Math.pow(ownershipProduct, 0.25) + 0.001);
  const roiScore = (totalCeilingFpts * (1 + correlationScore)) * uniquenessFactor * (leverageScore / 100);

  return { 
      totalFpts, 
      totalCeilingFpts,
      totalSalary,
      ownershipScore,
      ownershipProduct,
      correlationScore,
      leverageScore,
      stackType,
      roiScore,
  };
}

// Validates a lineup against the provided stacking rules
function isLineupValid(mvp: Player, flex: Player[], rules: StackingRules): boolean {
    const lineup = [mvp, ...flex];
    const positionCounts: Record<string, number> = {};
    lineup.forEach(p => {
        positionCounts[p.position] = (positionCounts[p.position] || 0) + 1;
    });

    for (const [pos, max] of Object.entries(rules.maxFromPosition)) {
        if ((positionCounts[pos] || 0) > max) return false;
    }

    const qbInLineup = lineup.find(p => p.position === 'QB');
    if (rules.stackQbWithReceiver && qbInLineup) {
        const passCatchers = lineup.filter(p => (p.position === 'WR' || p.position === 'TE') && p.team === qbInLineup.team && p.id !== qbInLineup.id);
        if (passCatchers.length === 0) return false;

        if (rules.forceOpponentBringBack) {
            const opponents = lineup.filter(p => p.team !== qbInLineup.team);
            if (opponents.length === 0) return false;
        }
    }
    return true;
}

/**
 * OPTIMIZATION: Replaced the recursive backtracking function with a much more performant
 * dynamic programming approach (0/1 Knapsack variant) to find the optimal FLEX combination.
 * This is a major step towards the robustness mandated by MD-TS-001.
 */
function findOptimalFlex(
  flexPool: Player[],
  remainingSlots: number,
  remainingSalary: number,
  optimizationTarget: OptimizationTarget
): Player[] | null {
  // dp[k][s] = max score for k slots with salary s.
  const dp = Array(remainingSlots + 1).fill(0).map(() => Array(remainingSalary + 1).fill(-1));
  // path[k][s] stores the player and previous salary that led to this optimal state.
  const path: ({ player: Player; prev_s: number } | null)[][] = Array(remainingSlots + 1).fill(0).map(() => Array(remainingSalary + 1).fill(null));
  
  dp[0].fill(0);

  for (const player of flexPool) {
    const salary = player.salary;
    const score = getTargetFpts(player, optimizationTarget);

    for (let k = remainingSlots; k >= 1; k--) {
      for (let s = remainingSalary; s >= salary; s--) {
        if (dp[k - 1][s - salary] !== -1) {
          const newScore = dp[k - 1][s - salary] + score;
          if (newScore > dp[k][s]) {
            dp[k][s] = newScore;
            path[k][s] = { player, prev_s: s - salary };
          }
        }
      }
    }
  }

  let bestScore = -1;
  let finalSalary = -1;
  for (let s = 0; s <= remainingSalary; s++) {
    if (dp[remainingSlots][s] > bestScore) {
      bestScore = dp[remainingSlots][s];
      finalSalary = s;
    }
  }

  if (finalSalary === -1) return null;

  // Reconstruct the path to find the players in the optimal lineup.
  const lineup: Player[] = [];
  let s = finalSalary;
  for (let k = remainingSlots; k > 0 && s >= 0; k--) {
    const p = path[k][s];
    if (!p) break;
    lineup.push(p.player);
    s = p.prev_s;
  }

  return lineup.length === remainingSlots ? lineup : null;
}


// Rewritten, more stable recursive function to find the single best lineup
function findOptimalLineup(
  players: Player[],
  lockedPlayers: Player[],
  excludedIds: Set<string>,
  salaryCap: number,
  excludedSignatures: Set<string>,
  stackingRules: StackingRules,
  optimizationTarget: OptimizationTarget
): Lineup | null {
  let bestLineup: Lineup | null = null;
  let bestLineupScore = -1;

  // PRUNING STEP 1: Sort main pool by Fpts to find good lineups early, which makes future pruning more effective.
  const mainPool = players
    .filter(p => !excludedIds.has(p.id) && p.projectedUsage !== 'Unlikely')
    .sort((a, b) => getTargetFpts(b, optimizationTarget) - getTargetFpts(a, optimizationTarget));
  
  for (const mvp of mainPool) {
    const lockedFlex = lockedPlayers.filter(p => p.id !== mvp.id);
    if (lockedFlex.length > FLEX_SIZE) continue;

    const currentLineup: Player[] = [mvp, ...lockedFlex];
    const remainingSalary = salaryCap - currentLineup.reduce((sum, p) => sum + p.salary, 0);
    const remainingSlots = FLEX_SIZE - lockedFlex.length;

    if (remainingSalary < 0 || remainingSlots < 0) continue;

    // Handle case where all slots are filled by locked players
    if (remainingSlots === 0) {
        const signature = getLineupSignature(mvp, lockedFlex);
        if (excludedSignatures.has(signature) || !isLineupValid(mvp, lockedFlex, stackingRules)) {
            continue;
        }
        const score = currentLineup.reduce((sum, p, i) => sum + getTargetFpts(p, optimizationTarget) * (i === 0 ? MVP_MULTIPLIER : 1), 0);
        if (score > bestLineupScore) {
            bestLineupScore = score;
            bestLineup = {
                mvp,
                flex: lockedFlex,
                ...calculateLineupStats(mvp, lockedFlex, optimizationTarget),
            };
        }
        continue;
    }

    const flexPool = mainPool.filter(p => !currentLineup.some(lp => lp.id === p.id));
    
    // Use the new, efficient DP-based function to find the best FLEX players
    const bestFlexForMvp = findOptimalFlex(flexPool, remainingSlots, remainingSalary, optimizationTarget);

    if (bestFlexForMvp) {
      const finalFlex = [...lockedFlex, ...bestFlexForMvp];
      const finalLineup = [mvp, ...finalFlex];
      const finalLineupScore = finalLineup.reduce((sum, p, i) => sum + getTargetFpts(p, optimizationTarget) * (i === 0 ? MVP_MULTIPLIER : 1), 0);
      
      if (finalLineupScore > bestLineupScore) {
          if (!isLineupValid(mvp, finalFlex, stackingRules)) continue;
          const signature = getLineupSignature(mvp, finalFlex);
          if (excludedSignatures.has(signature)) continue;

          bestLineupScore = finalLineupScore;
          bestLineup = {
              mvp,
              flex: finalFlex,
              ...calculateLineupStats(mvp, finalFlex, optimizationTarget),
          };
      }
    }
  }

  return bestLineup;
}


// Generates multiple lineups respecting exposure constraints
export function generateMultipleLineups(
    players: Player[],
    lockedPlayers: Player[],
    excludedIds: Set<string>,
    numberOfLineups: number,
    salaryCap: number,
    stackingRules: StackingRules,
    optimizationTarget: OptimizationTarget,
): Lineup[] {
    const lineups: Lineup[] = [];
    const excludedSignatures = new Set<string>();

    for (let i = 0; i < numberOfLineups; i++) {
        const optimalLineup = findOptimalLineup(
            players,
            lockedPlayers,
            excludedIds,
            salaryCap,
            excludedSignatures,
            stackingRules,
            optimizationTarget
        );

        if (optimalLineup) {
            lineups.push(optimalLineup);
            const signature = getLineupSignature(optimalLineup.mvp, optimalLineup.flex);
            excludedSignatures.add(signature);
        } else {
            break; // No more unique, valid lineups can be found
        }
    }

    return lineups;
}