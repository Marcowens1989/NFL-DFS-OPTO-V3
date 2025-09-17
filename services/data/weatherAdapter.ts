import axios from 'axios';
import { WeatherData } from '../../types';
import { WeatherPointSchema, WeatherForecastSchema, OpenMeteoForecastSchema } from '../schemas';
import { getCachedData, setCachedData } from './cache';
import { logger } from '../loggingService';

// --- NWS (api.weather.gov) - Primary Source ---
async function fetchNwsData(lat: number, lon: number): Promise<WeatherData | null> {
    const pointUrl = `https://api.weather.gov/points/${lat.toFixed(4)},${lon.toFixed(4)}`;
    const cacheKey = `nws_point_${lat.toFixed(4)}_${lon.toFixed(4)}`;

    try {
        let pointData = getCachedData<any>(cacheKey);
        if (!pointData) {
            const pointResponse = await axios.get(pointUrl, { headers: { 'Accept': 'application/geo+json' } });
            pointData = pointResponse.data;
            setCachedData(cacheKey, pointData);
        }
        
        const pointValidation = WeatherPointSchema.safeParse(pointData);
        if (!pointValidation.success) {
            logger.warn('NWS point data validation failed', { errors: pointValidation.error.flatten() });
            return null;
        }

        const forecastUrl = pointValidation.data.properties.forecastHourly;
        const forecastCacheKey = `nws_forecast_${lat.toFixed(4)}_${lon.toFixed(4)}`;
        
        let forecastData = getCachedData<any>(forecastCacheKey);
        if (!forecastData) {
            const forecastResponse = await axios.get(forecastUrl, { headers: { 'Accept': 'application/geo+json' } });
            forecastData = forecastResponse.data;
            setCachedData(forecastCacheKey, forecastData);
        }

        const forecastValidation = WeatherForecastSchema.safeParse(forecastData);
        if (!forecastValidation.success) {
            logger.warn('NWS forecast data validation failed', { errors: forecastValidation.error.flatten() });
            return null;
        }
        
        const firstPeriod = forecastValidation.data.properties.periods[0];
        
        return {
            temperature: firstPeriod.temperature,
            windSpeed: firstPeriod.windSpeed,
            windDirection: firstPeriod.windDirection,
            shortForecast: firstPeriod.shortForecast,
            precipitationChance: firstPeriod.probabilityOfPrecipitation.value ?? 0,
            source: 'NWS',
        };

    } catch (error) {
        logger.warn('Failed to fetch data from NWS API', { error });
        return null;
    }
}

// --- Open-Meteo - Fallback Source ---
async function fetchOpenMeteoData(lat: number, lon: number): Promise<WeatherData | null> {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&hourly=temperature_2m,precipitation_probability,wind_speed_10m,wind_direction_10m&temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=auto`;
    const cacheKey = `openmeteo_${lat.toFixed(4)}_${lon.toFixed(4)}`;
    
    try {
        let data = getCachedData<any>(cacheKey);
        if (!data) {
            const response = await axios.get(url);
            data = response.data;
            setCachedData(cacheKey, data);
        }
        
        const validation = OpenMeteoForecastSchema.safeParse(data);
        if (!validation.success) {
            logger.warn('Open-Meteo data validation failed', { errors: validation.error.flatten() });
            return null;
        }
        
        const forecast = validation.data.hourly;
        const now = new Date();
        const currentIndex = forecast.time.findIndex(t => new Date(t) > now) -1;
        if (currentIndex < 0) return null; // No current data

        // Function to convert wind direction from degrees to cardinal direction
        const getWindDirection = (degrees: number) => {
            const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
            return directions[Math.round(degrees / 45) % 8];
        };

        return {
            temperature: Math.round(forecast.temperature_2m[currentIndex]),
            windSpeed: `${Math.round(forecast.wind_speed_10m[currentIndex])} mph`,
            windDirection: getWindDirection(forecast.wind_direction_10m[currentIndex]),
            shortForecast: forecast.precipitation_probability[currentIndex] > 20 ? 'Chance of Rain' : 'Clear',
            precipitationChance: forecast.precipitation_probability[currentIndex],
            source: 'Open-Meteo',
        };

    } catch (error) {
        logger.error('Failed to fetch data from Open-Meteo API', { error });
        return null;
    }
}


/**
 * Public orchestrator to get weather data, implementing a fallback strategy.
 * @param lat Latitude of the game venue.
 * @param lon Longitude of the game venue.
 * @returns A WeatherData object or null.
 */
export async function getWeatherDataForGame(lat: number, lon: number): Promise<WeatherData | null> {
    logger.info(`Fetching weather for coords: ${lat}, ${lon}`);
    const nwsData = await fetchNwsData(lat, lon);
    if (nwsData) {
        return nwsData;
    }

    logger.warn('NWS fetch failed, falling back to Open-Meteo.');
    const openMeteoData = await fetchOpenMeteoData(lat, lon);
    if (openMeteoData) {
        return openMeteoData;
    }
    
    logger.error('All weather sources failed.');
    return null;
}

// NOTE: A geocoding service is needed to convert city/state to lat/lon.
// As we cannot add new external dependencies/APIs without explicit instruction,
// a placeholder function is added in a separate file.
// In a real system, this would use a robust service like Google Geocoding API.
