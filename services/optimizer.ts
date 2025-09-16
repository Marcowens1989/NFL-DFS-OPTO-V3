import { Player, Lineup, StackingRules } from '../types';

const ROSTER_SIZE = 6; // 1 MVP + 5 FLEX
const FLEX_SIZE = ROSTER_SIZE - 1;
const MVP_MULTIPLIER = 1.5;

// Helper to get Fpts with usage boost
const getBoostedFpts = (p: Player) => p.fpts + (p.usageBoost || 0);

// Creates a unique signature for a lineup to avoid duplicates
const getLineupSignature = (mvp: Player, flex: Player[]): string => {
  const sortedFlexIds = flex.map(p => p.id).sort();
  return [mvp.id, ...sortedFlexIds].join(',');
};

// Calculates stats for a given lineup
function calculateLineupStats(mvp: Player, flex: Player[]): Omit<Lineup, 'mvp' | 'flex'> {
  const totalSalary = flex.reduce((sum, p) => sum + p.salary, mvp.salary);
  const totalFpts = flex.reduce((sum, p) => sum + getBoostedFpts(p), getBoostedFpts(mvp) * MVP_MULTIPLIER);
  
  const lineup = [mvp, ...flex];

  const totalOwnership = lineup.reduce((sum, p) => sum + p.flexOwnership, 0);
  const ownershipScore = lineup.length > 0 ? totalOwnership / lineup.length : 0;
  
  const teamCounts: Record<string, number> = {};
  lineup.forEach(p => {
      teamCounts[p.team] = (teamCounts[p.team] || 0) + 1;
  });
  const stackType = Object.values(teamCounts).sort((a, b) => b - a).join('-');

  // Placeholder ROI Score: rewards points per dollar, penalizes ownership
  const roiScore = (totalFpts / (totalSalary / 10000)) - ownershipScore;

  return { 
      totalFpts, 
      totalSalary,
      ownershipScore,
      correlationScore: 0, // Placeholder: not enough data in CSV to calculate this.
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

// Rewritten, more stable recursive function to find the single best lineup
function findOptimalLineup(
  players: Player[],
  lockedPlayers: Player[],
  excludedIds: Set<string>,
  salaryCap: number,
  excludedSignatures: Set<string>,
  stackingRules: StackingRules
): Lineup | null {
  let bestLineup: Lineup | null = null;

  // Filter out players with 'unlikely' usage before starting optimization
  // FIX: Corrected typo from 'unlikely' to 'Unlikely' to match the type definition.
  const mainPool = players.filter(p => !excludedIds.has(p.id) && p.projectedUsage !== 'Unlikely');
  
  for (const mvp of mainPool) {
    // If MVP is locked, but this isn't a locked player, skip if any other locks exist
    const isMvpLocked = lockedPlayers.some(lp => lp.id === mvp.id);
    if (lockedPlayers.length > 0 && !isMvpLocked && !lockedPlayers.every(lp => lp.id === mvp.id)) {
        const hasLockedMvp = lockedPlayers.some(lp => mainPool.find(mp => mp.id === lp.id));
        if(hasLockedMvp) continue;
    }

    const lockedFlex = lockedPlayers.filter(p => p.id !== mvp.id);
    if (lockedFlex.length > FLEX_SIZE) continue;

    const currentSalary = lockedFlex.reduce((sum, p) => sum + p.salary, mvp.salary);
    const currentFpts = lockedFlex.reduce((sum, p) => sum + getBoostedFpts(p), 0);
    
    if (currentSalary > salaryCap) continue;

    const flexPool = mainPool.filter(p => p.id !== mvp.id && !lockedFlex.some(lp => lp.id === p.id))
                             .sort((a, b) => b.salary - a.salary); // Sort by salary for better pruning

    let bestFlexCombination: Player[] | null = null;
    let maxFpts = -1;

    function findFlex(startIndex: number, combination: Player[]) {
      const currentComboSalary = combination.reduce((sum, p) => sum + p.salary, currentSalary);
      
      if (combination.length === FLEX_SIZE - lockedFlex.length) {
        const finalFlex = [...lockedFlex, ...combination];
        if (!isLineupValid(mvp, finalFlex, stackingRules)) return;
        
        const signature = getLineupSignature(mvp, finalFlex);
        if (excludedSignatures.has(signature)) return;

        const comboFpts = combination.reduce((sum, p) => sum + getBoostedFpts(p), currentFpts);
        
        if (comboFpts > maxFpts) {
          maxFpts = comboFpts;
          bestFlexCombination = finalFlex;
        }
        return;
      }

      if (startIndex >= flexPool.length) return;

      for (let i = startIndex; i < flexPool.length; i++) {
        const player = flexPool[i];
        if (currentComboSalary + player.salary > salaryCap) continue;

        combination.push(player);
        findFlex(i + 1, combination);
        combination.pop();
      }
    }

    findFlex(0, []);

    if (bestFlexCombination) {
      const lineupStats = calculateLineupStats(mvp, bestFlexCombination);
      if (!bestLineup || lineupStats.totalFpts > bestLineup.totalFpts) {
        bestLineup = {
          mvp,
          flex: bestFlexCombination,
          ...lineupStats,
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
    playerExposures: Record<string, number>,
    numberOfLineups: number,
    salaryCap: number,
    stackingRules: StackingRules,
): Lineup[] {
    const lineups: Lineup[] = [];
    const excludedSignatures = new Set<string>();
    const playerCounts: Record<string, number> = {};
    players.forEach(p => playerCounts[p.id] = 0);

    for (let i = 0; i < numberOfLineups; i++) {
        const tempExcludedIds = new Set(excludedIds);
        
        Object.entries(playerCounts).forEach(([playerId, count]) => {
            const exposure = playerExposures[playerId] ?? 100;
            const exposureLimit = Math.ceil((exposure / 100) * numberOfLineups);
            if (count >= exposureLimit) {
                tempExcludedIds.add(playerId);
            }
        });

        const optimalLineup = findOptimalLineup(
            players,
            lockedPlayers,
            tempExcludedIds,
            salaryCap,
            excludedSignatures,
            stackingRules
        );

        if (optimalLineup) {
            lineups.push(optimalLineup);
            const signature = getLineupSignature(optimalLineup.mvp, optimalLineup.flex);
            excludedSignatures.add(signature);
            
            playerCounts[optimalLineup.mvp.id] = (playerCounts[optimalLineup.mvp.id] || 0) + 1;
            optimalLineup.flex.forEach(p => {
                playerCounts[p.id] = (playerCounts[p.id] || 0) + 1;
            });
        } else {
            break; // No more unique, valid lineups can be found
        }
    }

    return lineups;
}