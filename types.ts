// New interface for detailed statistical projections
export interface StatProjections {
  passingYards?: number;
  passingTds?: number;
  interceptions?: number;
  rushingYards?: number;
  rushingTds?: number;
  receptions?: number;
  receivingYards?: number;
  receivingTds?: number;
  sacks?: number; // For DST
  defensiveInterceptions?: number; // For DST
  defensiveTds?: number; // For DST
  fieldGoals?: number; // For K
  extraPoints?: number; // For K
}

// The core Player interface, now enhanced with advanced metrics
export interface Player {
  id: string;
  name: string;
  position: string;
  salary: number;
  fpts: number;
  mvpOwnership: number;
  flexOwnership: number;
  team: string;
  opponent: string; // Opponent team abbreviation
  injuryStatus: string; // e.g., 'Active', 'Questionable', 'Out'
  injuryDetails: string;
  usageBoost: number;
  notes: string;

  // Advanced Metrics for a more nuanced model
  statProjections: StatProjections;
  correlations: Record<string, number>; // Key: other player's ID, Value: correlation coefficient
  gameScriptScore: number; // Score representing projected game pace and total
  blitzRateDefense: number; // Opponent's blitz rate %
  coordinatorTendency: 'pass-heavy' | 'run-heavy' | 'balanced';
  projectedUsage: 'Starter' | 'Role Player' | 'Backup' | 'Unlikely';
  sentimentSummary: string;

  // This is parsed from the FD file but is not used in the 2025 rules where MVP salary = FLEX salary
  mvpSalary: number;
}


export interface Lineup {
  mvp: Player;
  flex: Player[]; // Will now contain 5 players
  totalFpts: number;
  totalSalary: number;
  ownershipScore: number; // Average ownership of players.
  correlationScore: number; // Sum of correlation coefficients.
  stackType: string; // Team stack (e.g., 3-3, 4-2).
  roiScore: number; // Projected ROI based on FDP variance and ownership.
}

export enum PlayerStatus {
  INCLUDED = 'INCLUDED',
  LOCKED = 'LOCKED',
  EXCLUDED = 'EXCLUDED',
}

export interface StackingRules {
  stackQbWithReceiver: boolean;
  forceOpponentBringBack: boolean;
  maxFromPosition: {
    [position: string]: number;
  };
}

export interface StrategyPreset {
  name: string;
  description: string;
  rules: StackingRules;
}

export interface HistoricalPlayerStats {
  id: string;
  name: string;
  passYds: number;
  passTds: number;
  interceptions: number;
  rushYds: number;
  rushTds: number;
  receptions: number;
  recYds: number;
  recTds: number;
  fumblesLost: number;
  actualFdp: number;
}

export interface StatWeights {
  passYds: number;
  passTds: number;
  interceptions: number;
  rushYds: number;
  rushTds: number;
  receptions: number;
  recYds: number;
  recTds: number;
  fumblesLost: number;
}

// Expanded interface for holding parsed historical data, ready for ML processing
export interface ParsedHistoricalPlayer {
    name: string;
    team: string;
    actualFdp: number;
    passYds?: number;
    passTds?: number;
    interceptions?: number;
    rushAtt?: number;
    rushYds?: number;
    rushTds?: number;
    receptions?: number;
    recYds?: number;
    recTds?: number;
    fumblesLost?: number;
    actualFlexOwnership?: number;
}

export interface OwnershipData {
    playerId: string;
    ownership: number;
}

export interface OptimalLineupData {
    rank: string;
    score: number;
    lineupSummary: string;
    dupeCount: number;
}