import { RunManifest, OptimizerSettings, Player } from '../types';

/**
 * Creates a SHA-256 hash of a string.
 * This is a simple, dependency-free way to create a checksum.
 * @param str The string to hash.
 * @returns A promise that resolves to the hex-encoded hash.
 */
async function sha256(str: string): Promise<string> {
    const textAsBuffer = new TextEncoder().encode(str);
    const hashBuffer = await crypto.subtle.digest('SHA-256', textAsBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex;
}

/**
 * Generates a manifest for an optimization run, creating an auditable artifact.
 * This is a critical component of the "Anti-Leakage Wall" and "Re-application Control" directives.
 * @param settings The optimizer settings for the run.
 * @param activeModelId The ID of the model used for projections.
 * @param players The full list of players used in the run.
 * @returns A promise that resolves to a RunManifest object.
 */
export async function generateRunManifest(
    settings: OptimizerSettings,
    activeModelId: string | null,
    players: Player[]
): Promise<RunManifest> {
    const runId = `run_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    
    // Create a stable JSON string of the player data for hashing.
    const playerDataString = JSON.stringify(
        players.map(p => ({ id: p.id, fpts: p.fpts, salary: p.salary })).sort((a,b) => a.id.localeCompare(b.id))
    );
    
    const playerDataChecksum = await sha256(playerDataString);

    const manifest: RunManifest = {
        runId,
        timestamp: new Date().toISOString(),
        settings,
        activeModelId,
        playerDataChecksum,
    };

    return manifest;
}