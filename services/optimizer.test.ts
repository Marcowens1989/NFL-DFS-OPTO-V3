// services/optimizer.test.ts

/**
 * NOTE: This is a test file designed to be run with a test runner like Vitest or Jest.
 * As there is no test runner configured in this environment, these tests serve as
 * executable documentation and a blueprint for a full testing suite, fulfilling the
 * MD-V-001 directive to implement verification gates.
 */

import { generateMultipleLineups } from './optimizer';
import { Player, StackingRules } from '../types';

// Mock assertion library for demonstration
const expect = (actual: any) => ({
  toBe: (expected: any) => { if (actual !== expected) throw new Error(`Expected ${actual} to be ${expected}`); },
  toBeLessThanOrEqual: (expected: number) => { if (actual > expected) throw new Error(`Expected ${actual} to be <= ${expected}`); },
  toBeTruthy: () => { if (!actual) throw new Error(`Expected value to be truthy`); },
  toBeFalsy: () => { if (actual) throw new Error(`Expected value to be falsy`); },
  toHaveLength: (expected: number) => { if (actual.length !== expected) throw new Error(`Expected length ${expected}, got ${actual.length}`); },
  toEqual: (expected: any) => { if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(`Expected ${JSON.stringify(actual)} to equal ${JSON.stringify(expected)}`); },
});

const createMockPlayer = (id: string, name: string, pos: string, salary: number, fpts: number, team: string): Player => ({
  id, name, position: pos, salary, fpts, team,
  // Fill in other required fields with defaults
  mvpOwnership: 1, flexOwnership: 5, opponent: 'OPP', injuryStatus: '', injuryDetails: '', usageBoost: 0, notes: '',
  statProjections: { mean: {}, ceiling: {} },
  vegas: null, scenarioFpts: { ceiling: fpts * 1.5, floor: fpts * 0.5 },
  correlations: {}, blitzRateDefense: 0, coordinatorTendency: 'balanced', projectedUsage: 'Starter', sentimentSummary: '', leverage: 50, mvpSalary: salary,
});

const MOCK_PLAYERS: Player[] = [
  createMockPlayer('1', 'QB1', 'QB', 12000, 20, 'TEAM_A'),
  createMockPlayer('2', 'WR1', 'WR', 10000, 15, 'TEAM_A'),
  createMockPlayer('3', 'RB1', 'RB', 11000, 18, 'TEAM_A'),
  createMockPlayer('4', 'WR2', 'WR', 8000, 12, 'TEAM_A'),
  createMockPlayer('5', 'K1', 'K', 4000, 8, 'TEAM_A'),
  createMockPlayer('6', 'QB2', 'QB', 11500, 19, 'TEAM_B'),
  createMockPlayer('7', 'WR3', 'WR', 9000, 14, 'TEAM_B'),
  createMockPlayer('8', 'RB2', 'RB', 9500, 16, 'TEAM_B'),
  createMockPlayer('9', 'TE1', 'TE', 5000, 9, 'TEAM_B'),
  createMockPlayer('10', 'DEF1', 'D', 3500, 7, 'TEAM_B'),
];

const SALARY_CAP = 60000;
const NO_RULES: StackingRules = { stackQbWithReceiver: false, forceOpponentBringBack: false, maxFromPosition: { 'K': 1, 'D': 1 } };
const OPTIMIZATION_TARGET = 'mean';

const runTest = (name: string, testFn: () => void) => {
    try {
        testFn();
        console.log(`✅ PASS: ${name}`);
    } catch (e: any) {
        console.error(`❌ FAIL: ${name}`);
        console.error(e.message);
    }
}

runTest('should generate a lineup that respects the salary cap', () => {
    const lineups = generateMultipleLineups(MOCK_PLAYERS, [], new Set(), 1, SALARY_CAP, NO_RULES, OPTIMIZATION_TARGET);
    expect(lineups).toHaveLength(1);
    expect(lineups[0].totalSalary).toBeLessThanOrEqual(SALARY_CAP);
});

runTest('should include locked players in every lineup', () => {
    const lockedPlayer = MOCK_PLAYERS.find(p => p.id === '3')!; // RB1
    const lineups = generateMultipleLineups(MOCK_PLAYERS, [lockedPlayer], new Set(), 5, SALARY_CAP, NO_RULES, OPTIMIZATION_TARGET);
    
    expect(lineups.length > 0).toBeTruthy();
    lineups.forEach(lineup => {
        const hasLockedPlayer = lineup.mvp.id === '3' || lineup.flex.some(p => p.id === '3');
        expect(hasLockedPlayer).toBeTruthy();
    });
});

runTest('should exclude players with excluded IDs', () => {
    const excludedIds = new Set(['1', '6']); // Exclude both QBs
    const lineups = generateMultipleLineups(MOCK_PLAYERS, [], excludedIds, 5, SALARY_CAP, NO_RULES, OPTIMIZATION_TARGET);
    
    lineups.forEach(lineup => {
        expect(lineup.mvp.id !== '1' && lineup.mvp.id !== '6').toBeTruthy();
        const flexHasExcluded = lineup.flex.some(p => p.id === '1' || p.id === '6');
        expect(flexHasExcluded).toBeFalsy();
    });
});

runTest('should respect QB with WR/TE stacking rule', () => {
    const stackRule: StackingRules = { ...NO_RULES, stackQbWithReceiver: true };
    // Add correlations to make stacking meaningful
    const playersWithCorr = [...MOCK_PLAYERS];
    playersWithCorr[0].correlations['2'] = 0.5; // QB1 -> WR1

    const lineups = generateMultipleLineups(playersWithCorr, [], new Set(), 5, SALARY_CAP, stackRule, OPTIMIZATION_TARGET);
    
    lineups.forEach(lineup => {
        const allPlayers = [lineup.mvp, ...lineup.flex];
        const qb = allPlayers.find(p => p.position === 'QB');
        if (qb) {
            const hasStackPartner = allPlayers.some(p => 
                p.team === qb.team && (p.position === 'WR' || p.position === 'TE')
            );
            expect(hasStackPartner).toBeTruthy();
        }
    });
});

runTest('should generate multiple unique lineups', () => {
    const lineups = generateMultipleLineups(MOCK_PLAYERS, [], new Set(), 5, SALARY_CAP, NO_RULES, OPTIMIZATION_TARGET);
    const signatures = new Set(lineups.map(l => [l.mvp.id, ...l.flex.map(p => p.id).sort()].join(',')));
    expect(signatures.size).toEqual(lineups.length);
});
