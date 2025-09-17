import { HistoricalGame } from '../../types';

// This is a static, pre-processed library of historical game data.
// It acts as the ultimate fallback and a baseline for the simulation engine.
// "Scrape-once, use-forever."

export const PREPOPULATED_VAULT: HistoricalGame[] = [
    {
        gameId: '2023_W1_KC_DET',
        description: 'Week 1 2023, Kansas City Chiefs vs. Detroit Lions',
        pregameContext: {
            injuries: ["Travis Kelce (TE, KC) was inactive due to a knee injury."],
            vegasLine: "KC -4.5, Total: 52.5",
        },
        players: [
            { name: 'Patrick Mahomes', team: 'KC', position: 'QB', stats: { passYds: 226, passTds: 2, interceptions: 1, rushYds: 45 }, actualFdp: 21.54, salary: 18000 },
            { name: 'Jared Goff', team: 'DET', position: 'QB', stats: { passYds: 253, passTds: 1 }, actualFdp: 14.12, salary: 15000 },
            { name: 'Amon-Ra St. Brown', team: 'DET', position: 'WR', stats: { receptions: 6, recYds: 71, recTds: 1 }, actualFdp: 16.1, salary: 13500 },
            { name: 'David Montgomery', team: 'DET', position: 'RB', stats: { rushYds: 74, rushTds: 1 }, actualFdp: 13.4, salary: 11000 },
            { name: 'Rashee Rice', team: 'KC', position: 'WR', stats: { receptions: 3, recYds: 29, recTds: 1 }, actualFdp: 10.4, salary: 7500 },
            { name: 'Isiah Pacheco', team: 'KC', position: 'RB', stats: { rushYds: 23, receptions: 4, recYds: 31 }, actualFdp: 7.4, salary: 12000 },
            { name: 'Jahmyr Gibbs', team: 'DET', position: 'RB', stats: { rushYds: 42, receptions: 2, recYds: 18 }, actualFdp: 7.0, salary: 10000 },
        ]
    },
    {
        gameId: '2023_SB_KC_SF',
        description: 'Super Bowl LVIII, Kansas City Chiefs vs. San Francisco 49ers',
        pregameContext: {
            injuries: ["Jerick McKinnon (RB, KC) was on IR.", "No other major injuries for key skill players."],
            vegasLine: "SF -2, Total: 47.5",
        },
        players: [
            { name: 'Patrick Mahomes', team: 'KC', position: 'QB', stats: { passYds: 333, passTds: 2, interceptions: 1, rushYds: 66 }, actualFdp: 28.52, salary: 17500 },
            { name: 'Christian McCaffrey', team: 'SF', position: 'RB', stats: { rushYds: 80, receptions: 8, recYds: 80, recTds: 1, rushTds: 1 }, actualFdp: 32.0, salary: 17000 },
            { name: 'Jauan Jennings', team: 'SF', position: 'WR', stats: { receptions: 4, recYds: 42, recTds: 1, passYds: 21, passTds: 1 }, actualFdp: 19.04, salary: 8500 },
            { name: 'Marquez Valdes-Scantling', team: 'KC', position: 'WR', stats: { receptions: 3, recYds: 20, recTds: 1 }, actualFdp: 9.5, salary: 7000 },
            { name: 'Brock Purdy', team: 'SF', position: 'QB', stats: { passYds: 255, passTds: 1, rushYds: 12 }, actualFdp: 15.4, salary: 16000 },
            { name: 'Travis Kelce', team: 'KC', position: 'TE', stats: { receptions: 9, recYds: 93 }, actualFdp: 13.8, salary: 14000 },
            { name: 'Brandon Aiyuk', team: 'SF', position: 'WR', stats: { receptions: 3, recYds: 49 }, actualFdp: 6.4, salary: 13000 },
        ]
    },
     {
        gameId: '2022_W4_MIN_NO',
        description: 'Week 4 2022, Minnesota Vikings vs. New Orleans Saints (London)',
        pregameContext: { injuries: ["Jameis Winston, Michael Thomas, and Alvin Kamara were OUT for the Saints."], vegasLine: "MIN -3, Total: 43" },
        players: [
            { name: 'Justin Jefferson', team: 'MIN', position: 'WR', stats: { receptions: 10, recYds: 147, rushYds: 3, rushTds: 1 }, actualFdp: 25.0, salary: 16500 },
            { name: 'Chris Olave', team: 'NO', position: 'WR', stats: { receptions: 4, recYds: 67, recTds: 1 }, actualFdp: 14.7, salary: 11000 },
            { name: 'Kirk Cousins', team: 'MIN', position: 'QB', stats: { passYds: 273, passTds: 1, interceptions: 1, rushYds: 1 }, actualFdp: 14.02, salary: 15500 },
            { name: 'Latavius Murray', team: 'NO', position: 'RB', stats: { rushYds: 57, rushTds: 1 }, actualFdp: 11.7, salary: 7500 },
            { name: 'Andy Dalton', team: 'NO', position: 'QB', stats: { passYds: 236, passTds: 1 }, actualFdp: 13.44, salary: 14000 },
        ]
    }
];