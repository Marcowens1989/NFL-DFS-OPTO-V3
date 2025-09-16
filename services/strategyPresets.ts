import { StrategyPreset } from '../types';

export const strategyPresets: StrategyPreset[] = [
    {
        name: 'Balanced Attack',
        description: 'A standard approach suitable for most games. Does not force stacks, allowing the optimizer to find raw value.',
        rules: {
            stackQbWithReceiver: false,
            forceOpponentBringBack: false,
            maxFromPosition: { 'K': 1, 'D': 1 }
        }
    },
    {
        name: 'Shootout',
        description: 'Best for high-scoring games. Forces a QB stack with a player from the opposing team, aiming to capture scoring from both sides.',
        rules: {
            stackQbWithReceiver: true,
            forceOpponentBringBack: true,
            maxFromPosition: { 'K': 1, 'D': 1 }
        }
    },
    {
        name: 'Team Stack',
        description: 'Focuses on a single team having a great game. Stacks a QB with their pass-catcher but without an opponent bring-back.',
        rules: {
            stackQbWithReceiver: true,
            forceOpponentBringBack: false,
            maxFromPosition: { 'K': 1, 'D': 1 }
        }
    },
    {
        name: 'Grind It Out',
        description: 'For low-scoring, defensive games. Prevents QB stacks and allows up to 2 defenses, focusing on kickers and defensive points.',
        rules: {
            stackQbWithReceiver: false,
            forceOpponentBringBack: false,
            maxFromPosition: { 'K': 2, 'D': 2 }
        }
    }
];
