// A mapping to handle discrepancies between FanDuel team abbreviations and the ESPN CDN abbreviations.
const teamAbbrMap: Record<string, string> = {
  'ARI': 'ARI',
  'ATL': 'ATL',
  'BAL': 'BAL',
  'BUF': 'BUF',
  'CAR': 'CAR',
  'CHI': 'CHI',
  'CIN': 'CIN',
  'CLE': 'CLE',
  'DAL': 'DAL',
  'DEN': 'DEN',
  'DET': 'DET',
  'GB': 'GB',
  'HOU': 'HOU',
  'IND': 'IND',
  'JAX': 'JAC', // FanDuel: JAX, ESPN: JAC
  'KC': 'KC',
  'LAC': 'LAC',
  'LAR': 'LAR',
  'LV': 'LV',
  'MIA': 'MIA',
  'MIN': 'MIN',
  'NE': 'NE',
  'NO': 'NO',
  'NYG': 'NYG',
  'NYJ': 'NYJ',
  'PHI': 'PHI',
  'PIT': 'PIT',
  'SF': 'SF',
  'SEA': 'SEA',
  'TB': 'TB',
  'TEN': 'TEN',
  'WAS': 'WSH', // FanDuel: WAS, ESPN: WSH
};

/**
 * Returns the URL for a team's logo from a reliable CDN.
 * @param teamAbbr The team's abbreviation (e.g., 'KC', 'BUF').
 * @returns A string containing the full URL to the team's logo.
 */
export function getTeamLogoUrl(teamAbbr: string): string {
    const mappedAbbr = teamAbbrMap[teamAbbr.toUpperCase()] || teamAbbr.toUpperCase();
    return `https://a.espncdn.com/i/teamlogos/nfl/500/${mappedAbbr}.png`;
}