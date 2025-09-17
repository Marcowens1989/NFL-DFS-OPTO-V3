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
  fpts: number; // Represents the MEAN projection
  mvpOwnership: number;
  flexOwnership: number;
  team: string;
  opponent: string; // Opponent team abbreviation
  injuryStatus: string; // e.g., 'Active', 'Questionable', 'Out'
  injuryDetails: string;
  usageBoost: number;
  notes: string;

  // --- NEW: Game & Scenario Modeling ---
  vegas: {
      spread: number; // e.g., -7 for favorite, 7 for underdog
      total: number;
      impliedTeamTotal: number;
  } | null;

  scenarioFpts: {
      ceiling: number; // 90th percentile outcome
      floor: number;   // 10th percentile outcome
  };

  // Advanced Metrics for a more nuanced model
  correlations: Record<string, number>; // Key: other player's ID, Value: correlation coefficient
  blitzRateDefense: number; // Opponent's blitz rate %
  coordinatorTendency: 'pass-heavy' | 'run-heavy' | 'balanced';
  projectedUsage: 'Starter' | 'Role Player' | 'Backup' | 'Unlikely';
  sentimentSummary: string;
  playerDnaReport?: string; // For on-demand AI deep-dive analysis
  leverage: number; // AI-generated GPP leverage score (1-100)

  // This is parsed from the FD file but is not used in the 2025 rules where MVP salary = FLEX salary
  mvpSalary: number;
}


export interface Lineup {
  mvp: Player;
  flex: Player[];
  totalFpts: number;
  totalCeilingFpts: number;
  totalSalary: number;
  ownershipScore: number; // Average ownership of players.
  ownershipProduct: number; // Product of ownerships, a proxy for duplication rate.
  correlationScore: number; // Sum of correlation coefficients.
  leverageScore: number; // Average leverage score of players in the lineup.
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
  // Advanced heuristic weights
  airYards?: number;
  redZoneTouches?: number;
  targetShare?: number;
  rushAttemptShare?: number;
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
    salary?: number; // NEW
    vegasTotal?: number; // NEW
    vegasSpread?: number; // NEW
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

// --- NEW: Types for the Automated Historical Simulation Engine ---

export interface HistoricalGame {
    gameId: string;
    description: string;
    pregameContext: {
        injuries: string[];
        vegasLine: string;
    };
    players: {
        name: string;
        team: string;
        position: string;
        stats: {
            passYds?: number; passTds?: number; interceptions?: number;
            rushYds?: number; rushTds?: number;
            receptions?: number; recYds?: number; recTds?: number;
            fumblesLost?: number;
        };
        // NEW: Advanced metrics based on expert DFS theory
        advancedStats?: {
            airYards?: number;
            redZoneTouches?: number;
            targetShare?: number;
            rushAttemptShare?: number;
        };
        actualFdp: number;
        salary?: number;
    }[];
}

export interface ModelDiscoveryReport {
    gameId: string;
    gameScriptAnalysis: string;
    coachingTendencyAnalysis: string;
    hindsightModel: {
        weights: StatWeights;
        gameScript: 'Neutral' | 'Shootout' | 'Defensive Struggle' | 'Blowout';
        notes: string;
    };
}

export interface TunedModel {
    id: string;
    name: string;
    createdAt: string;
    weights: StatWeights;
    performance: {
        mae: number; // Mean Absolute Error on the training set
        gamesSimulated?: number;
        validationMae?: number; // Mean Absolute Error on the BLIND validation set
    };
    sourceDescription: string;
    gameScript?: 'Neutral' | 'Shootout' | 'Defensive Struggle' | 'Blowout';
}


export interface ValidationReport {
    trainingSetSize: number;
    validationSetSize: number;
    models: (TunedModel & { performance: { validationMae: number } })[]; // Ensure validationMae is present
}

// --- NEW: Types for Post-Slate Analysis ---
export interface ContestResult {
    rank: number;
    score: number;
    payout: number;
    lineup: {
        mvp: string; // Player name
        flex: string[];
    }
}

export interface LineupGrade {
    userLineup: ContestResult;
    modelPredictedScore: number;
    optimalLineupForSlate: Lineup | null;
    analysis: string; // AI-generated analysis of the lineup's strengths/weaknesses
}

export interface PlayerExposureAnalysis {
    playerName: string;
    actualExposure: number;
    optimalExposure: number;
    leverage: number; // Positive means user was overweight, negative means underweight
}

export interface LeakfinderReport {
    overallRoi: number;
    strengths: string[]; // e.g., "Good at identifying low-owned RBs"
    leaks: string[]; // e.g., "Tends to over-expose players from favorite team"
    playerExposureAnalysis: PlayerExposureAnalysis[];
}