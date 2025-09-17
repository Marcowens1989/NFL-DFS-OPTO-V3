import { ContestResult } from '../types';
import { ContestHistoryRowSchema } from './schemas';
import { logger } from './loggingService';

/**
 * Parses a FanDuel contest history CSV file.
 * IMPORTANT: This assumes a specific structure for the CSV.
 * It looks for a "Lineup" column and assumes player names are in a "Player, Position" format.
 * @param file The CSV file uploaded by the user.
 * @returns A promise that resolves to an array of ContestResult objects.
 */
export async function parseContestHistory(file: File): Promise<ContestResult[]> {
  const text = await file.text();
  const lines = text.split(/\r?\n/).filter(line => line.trim() !== '');
  if (lines.length < 2) {
    throw new Error("Contest history CSV must have a header and at least one entry.");
  }

  const header = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
  
  const requiredHeaders = ['Rank', 'Score', 'Winnings', 'Lineup'];
   if (!requiredHeaders.every(h => header.includes(h))) {
    throw new Error("CSV header is missing required columns. Expected 'Rank', 'Score', 'Winnings', and 'Lineup'.");
  }

  const results: ContestResult[] = [];

  for (let i = 1; i < lines.length; i++) {
    const data = lines[i].split(',').map(d => d.trim().replace(/"/g, ''));
    
    const rowObject: { [key: string]: string } = {};
    header.forEach((h, i) => {
        rowObject[h] = data[i];
    });

    const validation = ContestHistoryRowSchema.safeParse(rowObject);
    if (!validation.success) {
        logger.warn(`Skipping invalid contest history row ${i + 1}`, { error: validation.error.flatten(), row: lines[i] });
        continue;
    }

    const { Rank, Score, Winnings, Lineup } = validation.data;
      
    // Extract players, assuming format "Player1, Pos Player2, Pos ..."
    const players = Lineup.split(/\s(?=[A-Z][a-z])/).map(p => p.trim());
    if (players.length < 5) continue; // Skip invalid lineups

    const mvp = players.find(p => p.endsWith('MVP'))?.replace(' MVP', '').trim() || '';
    const flex = players.filter(p => !p.endsWith('MVP')).map(p => p.replace(/\s[A-Z]{1,3}$/, '').trim());

    results.push({
      rank: Rank,
      score: Score,
      payout: Winnings,
      lineup: {
        mvp,
        flex,
      },
    });
  }

  if(results.length === 0) {
      throw new Error("Could not parse any valid contest entries from the CSV. Please ensure it is the correct file from FanDuel history.");
  }

  return results;
}