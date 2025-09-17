import axios from 'axios';
import { GameInfo } from '../../types';
import { EspnEventSchema } from '../schemas';
import { getCachedData, setCachedData } from './cache';
import { logger } from '../loggingService';

const ESPN_SCOREBOARD_URL = 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard';

/**
 * Finds the corresponding ESPN game ID for a given pair of teams.
 * @param teamAbbrOne Abbreviation of the first team.
 * @param teamAbbrTwo Abbreviation of the second team.
 * @returns The ESPN game ID as a string, or null if not found.
 */
async function findEspnGameId(teamAbbrOne: string, teamAbbrTwo: string): Promise<string | null> {
    const cacheKey = `espn_scoreboard_${new Date().toISOString().split('T')[0]}`;
    let data = getCachedData<any>(cacheKey);

    if (!data) {
        try {
            const response = await axios.get(ESPN_SCOREBOARD_URL);
            data = response.data;
            setCachedData(cacheKey, data);
        } catch (error) {
            logger.error('Failed to fetch ESPN scoreboard data', { error });
            return null;
        }
    }

    if (!data || !data.events) {
        return null;
    }

    const teamAbbrs = new Set([teamAbbrOne.toUpperCase(), teamAbbrTwo.toUpperCase()]);

    for (const event of data.events) {
        const competitors = event.competitions?.[0]?.competitors;
        if (competitors && competitors.length === 2) {
            const eventTeamAbbrs = new Set(competitors.map((c: any) => c.team?.abbreviation.toUpperCase()));
            if (Array.from(teamAbbrs).every(abbr => eventTeamAbbrs.has(abbr))) {
                return event.id;
            }
        }
    }

    return null;
}

/**
 * Fetches detailed game information for a specific ESPN game ID.
 * @param gameId The ESPN game ID.
 * @returns A structured GameInfo object or null on failure.
 */
async function fetchGameDetails(gameId: string): Promise<GameInfo | null> {
    const url = `${ESPN_SCOREBOARD_URL}/${gameId}`;
    const cacheKey = `espn_game_${gameId}`;
    let data = getCachedData<any>(cacheKey);

    if (!data) {
        try {
            const response = await axios.get(url);
            data = response.data;
        } catch (error) {
            logger.error(`Failed to fetch ESPN game details for gameId: ${gameId}`, { error });
            return null;
        }
    }

    const validation = EspnEventSchema.safeParse(data);

    if (!validation.success) {
        logger.error('ESPN game detail validation failed', { errors: validation.error.flatten(), gameId });
        return null;
    }
    
    setCachedData(cacheKey, data); // Cache the validated data
    const event = validation.data;
    const competition = event.competitions[0];

    const homeCompetitor = competition.competitors.find(c => c.homeAway === 'home');
    const awayCompetitor = competition.competitors.find(c => c.homeAway === 'away');
    
    if (!homeCompetitor || !awayCompetitor) return null;

    const gameInfo: GameInfo = {
        id: event.id,
        date: event.date,
        name: event.name,
        shortName: event.shortName,
        venue: {
            fullName: competition.venue.fullName,
            city: competition.venue.address.city,
            state: competition.venue.address.state || '',
            capacity: competition.venue.capacity,
            grass: competition.venue.grass,
            indoor: competition.venue.indoor,
        },
        competitors: {
            home: { id: homeCompetitor.id, abbrev: homeCompetitor.abbreviation },
            away: { id: awayCompetitor.id, abbrev: awayCompetitor.abbreviation },
        },
    };

    return gameInfo;
}

/**
 * Public orchestrator to get game info for a given slate.
 * @param teamAbbrs An array containing the two team abbreviations for the slate.
 * @returns A GameInfo object or null.
 */
export async function getGameInfoForSlate(teamAbbrs: [string, string]): Promise<GameInfo | null> {
    try {
        const gameId = await findEspnGameId(teamAbbrs[0], teamAbbrs[1]);
        if (!gameId) {
            logger.warn(`Could not find ESPN gameId for slate: ${teamAbbrs.join(' vs ')}`);
            return null;
        }
        logger.info(`Found ESPN gameId: ${gameId} for slate: ${teamAbbrs.join(' vs ')}`);
        return await fetchGameDetails(gameId);
    } catch (error) {
        logger.error(`Error in getGameInfoForSlate for ${teamAbbrs.join(' vs ')}`, { error });
        return null;
    }
}