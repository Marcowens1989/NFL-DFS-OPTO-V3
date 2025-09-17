import Dexie, { Table } from 'dexie';
import { TunedModel, StatWeights, HistoricalGame } from '../types';
import { PREPOPULATED_VAULT } from './data/prepopulatedVault';

const db = new Dexie('NFLShowdownDB_v1') as Dexie & {
    tunedModels: Table<TunedModel, string>;
    historicalGames: Table<HistoricalGame, string>;
};

db.version(1).stores({
    tunedModels: 'id, name, createdAt, performance.validationMae',
    historicalGames: 'gameId',
});

class ModelStore {
    private initPromise: Promise<void>;

    constructor() {
        // The init process is started immediately but not awaited in the constructor.
        // All public methods will await this promise, ensuring the DB is ready before use.
        this.initPromise = this.init();
    }

    private async init(): Promise<void> {
        try {
            // Use db.historicalGames.count() directly to avoid recursive calls from a public method
            const count = await db.historicalGames.count();
            // Only seed the DB if it's completely empty to prime the cache on first load.
            if (count === 0 && PREPOPULATED_VAULT.length > 0) {
                console.log("Cache is empty. Priming with pre-populated static vault...");
                await db.historicalGames.bulkPut(PREPOPULATED_VAULT);
                console.log(`Successfully cached ${PREPOPULATED_VAULT.length} games.`);
            }
        } catch (error) {
            console.error("Failed to initialize and prime the historical game cache:", error);
        }
    }

    // --- Model Management ---

    async getSavedModels(): Promise<TunedModel[]> {
        await this.initPromise;
        try {
            const models = await db.tunedModels
                .orderBy('performance.validationMae')
                .toArray();
                
            return models.sort((a, b) => {
                if (a.performance.validationMae !== b.performance.validationMae) {
                    return (a.performance.validationMae || Infinity) - (b.performance.validationMae || Infinity);
                }
                return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
            });

        } catch (error) {
            console.error("Error retrieving models from Dexie:", error);
            return [];
        }
    }

    async saveModel(
        weights: StatWeights,
        performance: TunedModel['performance'],
        name: string,
        sourceDescription: string,
        gameScript?: TunedModel['gameScript']
    ): Promise<TunedModel> {
        await this.initPromise;
        const newModel: TunedModel = {
            id: `model_${Date.now()}`,
            name,
            createdAt: new Date().toISOString(),
            weights,
            performance,
            sourceDescription,
            gameScript,
        };
        
        try {
            await db.tunedModels.put(newModel);
        } catch (error) {
            console.error("Error saving model to Dexie:", error);
            throw error;
        }
        
        return newModel;
    }

    async deleteModel(modelId: string): Promise<void> {
        await this.initPromise;
        try {
            await db.tunedModels.delete(modelId);
        } catch (error) {
            console.error("Error deleting model from Dexie:", error);
        }
    }

    // --- Historical Data Vault ---

    async getHistoricalGames(): Promise<HistoricalGame[]> {
        await this.initPromise;
        try {
            return await db.historicalGames.toArray();
        } catch (error) {
            console.error("Error retrieving all historical games from vault:", error);
            return [];
        }
    }

    async getHistoricalGame(gameId: string): Promise<HistoricalGame | null> {
        await this.initPromise;
        try {
            const game = await db.historicalGames.get(gameId);
            return game || null;
        } catch (error) {
            console.error(`Error retrieving game ${gameId} from vault:`, error);
            return null;
        }
    }

    async saveHistoricalGame(gameData: HistoricalGame): Promise<void> {
        await this.initPromise;
        try {
            await db.historicalGames.put(gameData);
        } catch (error) {
            console.error(`Error saving game ${gameData.gameId} to vault:`, error);
        }
    }

    async getHistoricalGameCount(): Promise<number> {
        await this.initPromise;
        try {
            return await db.historicalGames.count();
        } catch (error) {
            console.error("Error getting historical game count:", error);
            return 0;
        }
    }
}

// Export a singleton instance of the store
export const modelStore = new ModelStore();
