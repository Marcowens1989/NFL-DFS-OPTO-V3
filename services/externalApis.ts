import axios from 'axios';
import { Player, PlayerStatus } from '../types';

interface SleeperPlayer {
  full_name: string;
  player_id: string;
  status: string; // 'Active', 'Questionable', 'Doubtful', 'Out', 'IR'
}

let sleeperPlayers: Record<string, SleeperPlayer> | null = null;
let lastFetchTime = 0;
const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes

// Fetches all NFL player data from Sleeper and caches it for the session
async function getSleeperData(): Promise<Record<string, SleeperPlayer>> {
  const now = Date.now();
  if (sleeperPlayers && (now - lastFetchTime < CACHE_DURATION)) {
      return sleeperPlayers;
  }
  try {
    const response = await axios.get('https://api.sleeper.app/v1/players/nfl');
    sleeperPlayers = response.data;
    lastFetchTime = Date.now();
    return sleeperPlayers || {};
  } catch (error) {
    console.error("Error fetching data from Sleeper API:", error);
    sleeperPlayers = null; // Invalidate cache on error
    return {}; // Return empty object on failure to avoid breaking the app
  }
}

// Normalizes a name for better matching (e.g., "D.J. Moore" -> "djmoore")
function normalizeName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '').replace(/(jr|sr|iii|ii|iv)$/, '');
}

export async function getPlayerStatusesFromSleeper(players: Player[], currentStatuses: Record<string, PlayerStatus>): Promise<{
    sleeperStatuses: Record<string, PlayerStatus>;
    playersToAICheck: Player[];
    sleeperReport: string;
}> {
    const sleeperData = await getSleeperData();
    if (Object.keys(sleeperData).length === 0) {
        // If Sleeper API fails, send all non-excluded players to AI for validation
        return {
            sleeperStatuses: {},
            playersToAICheck: players.filter(p => currentStatuses[p.id] !== PlayerStatus.EXCLUDED),
            sleeperReport: "Sleeper API failed; falling back to AI for all players."
        }
    }

    const sleeperPlayerMap = new Map<string, SleeperPlayer>();
    for (const p of Object.values(sleeperData)) {
        if (p.full_name) {
            sleeperPlayerMap.set(normalizeName(p.full_name), p);
        }
    }
    
    const sleeperStatuses: Record<string, PlayerStatus> = {};
    const playersToAICheck: Player[] = [];
    const excludedBySleeper: string[] = [];
    const questionableFromSleeper: string[] = [];

    for (const player of players) {
        // Don't check players who were already excluded from the initial CSV pass
        if(currentStatuses[player.id] === PlayerStatus.EXCLUDED) continue;

        const normalizedPlayerName = normalizeName(player.name);
        const sleeperPlayer = sleeperPlayerMap.get(normalizedPlayerName);

        if (sleeperPlayer?.status) {
            const status = sleeperPlayer.status.toLowerCase();
            if (status === 'out' || status === 'ir') {
                sleeperStatuses[player.id] = PlayerStatus.EXCLUDED;
                excludedBySleeper.push(`${player.name} (${sleeperPlayer.status})`);
            } else {
                 sleeperStatuses[player.id] = PlayerStatus.INCLUDED;
                 if(status === 'questionable' || status === 'doubtful'){
                     // These are uncertain, so we can double-check with AI
                     playersToAICheck.push(player);
                     questionableFromSleeper.push(player.name)
                 }
            }
        } else {
            // If we can't find the player in Sleeper's DB, add them to the AI check list
            playersToAICheck.push(player);
        }
    }

    let sleeperReport = "Sleeper API: ";
    if(excludedBySleeper.length > 0) {
        sleeperReport += `Excluded: ${excludedBySleeper.join(', ')}. `;
    }
    if(questionableFromSleeper.length > 0) {
        sleeperReport += `Marked as Q/D: ${questionableFromSleeper.join(', ')}.`;
    }
    if (excludedBySleeper.length === 0 && questionableFromSleeper.length === 0) {
        sleeperReport += "All players appear active.";
    }


    return { sleeperStatuses, playersToAICheck, sleeperReport: sleeperReport.trim() };
}

// FIX: Export the missing function getGameDataFromOddsApi to resolve import error in dataManager.ts.
// This is a placeholder as no external odds API is available. It returns null to allow the 
// data pipeline to gracefully fall back to AI enrichment.
export async function getGameDataFromOddsApi(team: string, opponent: string): Promise<{ gameScriptScore: number } | null> {
    console.log(`[Placeholder] Attempted to fetch odds for ${team} vs ${opponent}. No odds API configured, returning null.`);
    return null;
}
