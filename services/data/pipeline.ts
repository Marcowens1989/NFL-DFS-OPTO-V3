import { Player, GameInfo, WeatherData } from '../../types';
import { getGameInfoForSlate } from './espnAdapter';
import { getWeatherDataForGame } from './weatherAdapter';
import { logger } from '../loggingService';
import { getCoordinates } from './geocoder';

interface PreLockSnapshot {
    enrichedPlayers: Player[];
    pipelineReport: string;
}

/**
 * Orchestrates the fetching and merging of all pre-lock data sources.
 * This function embodies the "freeze-before-score" principle of the Anti-Leakage Wall.
 * @param basePlayers The initial list of players parsed from the FanDuel CSV.
 * @returns A PreLockSnapshot containing the enriched player data and a report of operations.
 */
export async function runPreLockPipeline(basePlayers: Player[]): Promise<PreLockSnapshot> {
    if (basePlayers.length === 0) {
        return { enrichedPlayers: [], pipelineReport: "No players provided to pipeline." };
    }

    const reportParts: string[] = [];
    const teams = Array.from(new Set(basePlayers.map(p => p.team)));

    if (teams.length !== 2) {
        return {
            enrichedPlayers: basePlayers,
            pipelineReport: `Warning: Expected 2 teams but found ${teams.length}. Cannot fetch game-specific data.`,
        };
    }
    
    let gameInfo: GameInfo | null = null;
    let weatherData: WeatherData | null = null;

    // 1. Fetch Game Info from ESPN
    try {
        gameInfo = await getGameInfoForSlate([teams[0], teams[1]]);
        if (gameInfo) {
            reportParts.push(`Successfully loaded game data for ${gameInfo.shortName}. Venue: ${gameInfo.venue.fullName}.`);

            // 2. Fetch Weather Data using Game Info
            if (!gameInfo.venue.indoor) {
                try {
                    const coords = await getCoordinates(gameInfo.venue.city, gameInfo.venue.state);
                    if (coords) {
                        gameInfo.geo = coords;
                        weatherData = await getWeatherDataForGame(coords.lat, coords.lon);
                        if (weatherData) {
                            reportParts.push(`Weather Forecast (${weatherData.source}): ${weatherData.shortForecast}, ${weatherData.temperature}°F, Wind ${weatherData.windSpeed}.`);
                        } else {
                            reportParts.push("Could not retrieve weather forecast.");
                        }
                    } else {
                         reportParts.push("Could not geocode venue city for weather lookup.");
                    }
                } catch (weatherError) {
                    logger.error("Weather data pipeline failed", { error: weatherError });
                    reportParts.push("Error fetching weather data.");
                }
            } else {
                reportParts.push("Weather: Dome game.");
            }
        } else {
            reportParts.push("Could not load game data from ESPN.");
        }
    } catch (gameInfoError) {
        logger.error("Game info pipeline failed", { error: gameInfoError });
        reportParts.push("Error fetching game data.");
    }
    
    // 3. Enrich Player Objects
    const enrichedPlayers = basePlayers.map(player => ({
        ...player,
        gameInfo: gameInfo || undefined,
        weather: weatherData || undefined,
    }));
    
    return {
        enrichedPlayers,
        pipelineReport: reportParts.join(' '),
    };
}

// NOTE: A `runPostLockPipeline` function would be implemented here later.
// It would take a `preLockSnapshot` and fetch the actual outcomes (box scores, etc.)
// to create the `POST` snapshot for evaluation, strictly adhering to the anti-leakage wall.
// For now, this is a placeholder for future implementation.
export async function runPostLockPipeline() {
    // 1. Fetch actual box score from ESPN
    // 2. Fetch actual ownership from a source (e.g., contest results)
    // 3. Merge with pre-lock data to create a complete evaluation file
    logger.info("Post-lock pipeline not yet implemented.");
}