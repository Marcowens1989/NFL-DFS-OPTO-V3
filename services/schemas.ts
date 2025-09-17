import { z } from 'zod';

// Schema for raw data parsed from the FanDuel CSV
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
    // --- NEW: Optional advanced columns from user CSV ---
    Volatility: z.string().transform(val => parseFloat(val)).optional(),
    Tags: z.string().optional(),
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
}).passthrough();

export const AdvancedPlayerMetricsResponseSchema = z.object({
    vegas: z.object({
        teamASpread: z.number(),
        gameTotal: z.number(),
    }),
    playerMetrics: z.array(z.object({
        id: z.string(),
        advancedStats: z.object({
            airYards: z.number().optional(),
            targetShare: z.number().optional(),
            rushAttemptShare: z.number().optional(),
            aDOT: z.number().optional(),
        }).passthrough(),
        statProjections: z.object({
            mean: StatProjectionsSchema,
            ceiling: StatProjectionsSchema,
        }),
    })),
});
export type InferredAdvancedPlayerMetricsResponse = z.infer<typeof AdvancedPlayerMetricsResponseSchema>;


// --- NEW: Schema for the compliant, feature-based ownership model ---
export const OwnershipFeaturesResponseSchema = z.object({
  players: z.array(z.object({
    id: z.string(),
    buzzScore: z.number(),
    salaryTier: z.enum(['Premium', 'Mid-Range', 'Value']),
    chalkRating: z.number(),
    leverageScore: z.number(),
    // Add computed fields that will be added later
    flexOwnership: z.number().optional(),
    mvpOwnership: z.number().optional(),
    leverage: z.number().optional(),
  })),
  slateNotes: z.string(),
});
export type InferredOwnershipFeaturesResponse = z.infer<typeof OwnershipFeaturesResponseSchema>;


// --- Legacy Schemas (Deprecated) ---

const CorrelationItemSchema = z.object({
    playerId: z.string(),
    correlatedPlayers: z.array(z.object({
        playerId: z.string(),
        coefficient: z.number(),
    })),
});

export const AdvancedMetricsResponseSchema_Legacy = z.object({
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

// --- NEW: Schemas for Zero-Auth Data Adapters ---

export const EspnCompetitorSchema = z.object({
  id: z.string(),
  abbreviation: z.string(),
  homeAway: z.enum(['home', 'away']),
});

export const EspnEventSchema = z.object({
    id: z.string(),
    date: z.string(),
    name: z.string(),
    shortName: z.string(),
    competitions: z.array(z.object({
        competitors: z.array(EspnCompetitorSchema),
        venue: z.object({
            fullName: z.string(),
            address: z.object({
                city: z.string(),
                state: z.string().optional(),
            }),
            capacity: z.number(),
            grass: z.boolean(),
            indoor: z.boolean(),
        }),
    })).min(1),
});

export const WeatherPointSchema = z.object({
    properties: z.object({
        forecastHourly: z.string(), // URL to the hourly forecast
    }),
});

export const WeatherForecastSchema = z.object({
    properties: z.object({
        periods: z.array(z.object({
            number: z.number(),
            temperature: z.number(),
            temperatureUnit: z.string(),
            windSpeed: z.string(),
            windDirection: z.string(),
            shortForecast: z.string(),
            probabilityOfPrecipitation: z.object({
                value: z.number().nullable(),
            }),
        })).min(1),
    }),
});

export const OpenMeteoForecastSchema = z.object({
    latitude: z.number(),
    longitude: z.number(),
    hourly: z.object({
        time: z.array(z.string()),
        temperature_2m: z.array(z.number()),
        precipitation_probability: z.array(z.number()),
        wind_speed_10m: z.array(z.number()),
        wind_direction_10m: z.array(z.number()),
    }),
});