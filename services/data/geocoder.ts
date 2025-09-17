// services/data/geocoder.ts

import { logger } from '../loggingService';

// This is a placeholder/stub for a real geocoding service.
// In a production environment, this would call an API like Google Geocoding.
// To satisfy the zero-auth, no-new-dependency constraint, we use a small, hardcoded map.
const cityCoordinates: Record<string, { lat: number, lon: number }> = {
    // NFL Stadium Cities
    "arlington,tx": { lat: 32.7473, lon: -97.0945 }, // Dallas Cowboys
    "atlanta,ga": { lat: 33.7554, lon: -84.4008 }, // Atlanta Falcons
    "baltimore,md": { lat: 39.2780, lon: -76.6227 }, // Baltimore Ravens
    "charlotte,nc": { lat: 35.2259, lon: -80.8528 }, // Carolina Panthers
    "chicago,il": { lat: 41.8623, lon: -87.6167 }, // Chicago Bears
    "cincinnati,oh": { lat: 39.0955, lon: -84.5160 }, // Cincinnati Bengals
    "cleveland,oh": { lat: 41.5061, lon: -81.6995 }, // Cleveland Browns
    "denver,co": { lat: 39.7439, lon: -105.0201 }, // Denver Broncos
    "detroit,mi": { lat: 42.3400, lon: -83.0456 }, // Detroit Lions
    "foxborough,ma": { lat: 42.0909, lon: -71.2643 }, // New England Patriots
    "green bay,wi": { lat: 44.5013, lon: -88.0622 }, // Green Bay Packers
    "houston,tx": { lat: 29.6847, lon: -95.4107 }, // Houston Texans
    "indianapolis,in": { lat: 39.7601, lon: -86.1639 }, // Indianapolis Colts
    "inglewood,ca": { lat: 33.9534, lon: -118.3391 }, // LA Rams/Chargers
    "jacksonville,fl": { lat: 30.3239, lon: -81.6373 }, // Jacksonville Jaguars
    "kansas city,mo": { lat: 39.0489, lon: -94.4839 }, // Kansas City Chiefs
    "las vegas,nv": { lat: 36.0907, lon: -115.1838 }, // Las Vegas Raiders
    "miami gardens,fl": { lat: 25.9580, lon: -80.2389 }, // Miami Dolphins
    "minneapolis,mn": { lat: 44.9740, lon: -93.2580 }, // Minnesota Vikings
    "nashville,tn": { lat: 36.1665, lon: -86.7713 }, // Tennessee Titans
    "new orleans,la": { lat: 29.9511, lon: -90.0812 }, // New Orleans Saints
    "orchard park,ny": { lat: 42.7737, lon: -78.7869 }, // Buffalo Bills
    "philadelphia,pa": { lat: 39.9008, lon: -75.1675 }, // Philadelphia Eagles
    "pittsburgh,pa": { lat: 40.4468, lon: -80.0158 }, // Pittsburgh Steelers
    "santa clara,ca": { lat: 37.4032, lon: -121.9697 }, // San Francisco 49ers
    "seattle,wa": { lat: 47.5952, lon: -122.3316 }, // Seattle Seahawks
    "tampa,fl": { lat: 27.9759, lon: -82.5033 }, // Tampa Bay Buccaneers
    "east rutherford,nj": { lat: 40.8135, lon: -74.0745 }, // NY Giants/Jets
    "landover,md": { lat: 38.9077, lon: -76.8645 }, // Washington Commanders
    "glendale,az": { lat: 33.5276, lon: -112.2626 }, // Arizona Cardinals
};

export async function getCoordinates(city: string, state: string | undefined): Promise<{ lat: number, lon: number } | null> {
    const key = `${city.toLowerCase()},${(state || '').toLowerCase()}`;
    const keyWithoutState = city.toLowerCase();

    // Try finding with state first, then without, to handle cases like "Green Bay"
    const coords = cityCoordinates[key] || Object.keys(cityCoordinates).find(k => k.startsWith(keyWithoutState));
    
    if (coords && typeof coords === 'string') {
         logger.info(`Geocoded ${city} to ${coords}`);
        return cityCoordinates[coords];
    } else if (coords && typeof coords === 'object') {
         logger.info(`Geocoded ${city} to coordinates`);
        return coords;
    }

    logger.warn(`Could not find coordinates for city: ${city}`);
    return null;
}