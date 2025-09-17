import { z } from 'zod';

// Schema for raw data parsed from the FanDuel CSV
// We use `passthrough` to avoid errors if FanDuel adds extra columns we don't use.
export const FdCsvPlayerSchema = z.object({
    Id: z.string().min(1),
    Nickname: z.string().min(1),
    Position: z.string(),
    Salary: z.string().transform(val => parseInt(val, 10)),
    'MVP 1.5x Salary': z.string().transform(val => parseInt(val, 10)),
    FPPG: z.string().transform(val => parseFloat(val) || 0),
    Team: z.string(),
    Opponent: z.string(),
    'Injury Indicator': z.string().optional(),
    'Injury Details': z.string().optional(),
}).passthrough();
export type FdCsvPlayer = z.infer<typeof FdCsvPlayerSchema>;

// Schema for the contest history CSV
export const ContestHistoryRowSchema = z.object({
    Rank: z.string().transform(val => parseInt(val, 10)),
    Score: z.string().transform(val => parseFloat(val)),
    Winnings: z.string().transform(val => parseFloat(val.replace('$', '')) || 0),
    Lineup: z.string(),
}).passthrough();
export type ContestHistoryRow = z.infer<typeof ContestHistoryRowSchema>;


// Schemas for AI Service Responses

const StatProjectionsSchema = z.object({
    passingYards: z.number().optional(),
    passingTds: z.number().optional(),
    interceptions: z.number().optional(),
    rushingYards: z.number().optional(),
    rushingTds: z.number().optional(),
    receptions: z.number().optional(),
    receivingYards: z.number().optional(),
    receivingTds: z.number().optional(),
}).passthrough(); // Allow extra fields

export const VegasAndProjectionsResponseSchema = z.object({
    vegas: z.object({
        teamASpread: z.number(),
        gameTotal: z.number(),
    }),
    projections: z.array(z.object({
        id: z.string(),
        mean: StatProjectionsSchema,
        ceiling: StatProjectionsSchema,
        floorFpts: z.number(),
    })),
});

const CorrelationItemSchema = z.object({
    playerId: z.string(),
    correlatedPlayers: z.array(z.object({
        playerId: z.string(),
        coefficient: z.number(),
    })),
});

export const AdvancedMetricsResponseSchema = z.object({
    metrics: z.array(z.object({
        id: z.string(),
        projectedUsage: z.enum(['Starter', 'Role Player', 'Backup', 'Unlikely']),
        sentimentSummary: z.string(),
        coordinatorTendency: z.enum(['pass-heavy', 'run-heavy', 'balanced']),
        blitzRateDefense: z.number(),
    })),
    correlations: z.array(CorrelationItemSchema),
});

export const OwnershipResponseSchema = z.object({
  players: z.array(z.object({
    id: z.string(),
    flexOwnership: z.number(),
    mvpOwnership: z.number(),
    leverage: z.number(),
  })),
  slateNotes: z.string(),
});
