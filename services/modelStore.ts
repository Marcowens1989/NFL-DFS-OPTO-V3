import Dexie, { Table } from 'dexie';
import { TunedModel, StatWeights, HistoricalGame } from '../types';

// FIX: Refactored to a typed Dexie instance instead of a class extension.
// This resolves a TypeScript issue where methods on the superclass (Dexie)
// were not being recognized on `this` inside the constructor.
const db = new Dexie('NFLShowdownDB_v1') as Dexie & {
    tunedModels: Table<TunedModel, string>;
    historicalGames: Table<HistoricalGame, string>;
};

db.version(1).stores({
    tunedModels: 'id, name, createdAt, performance.validationMae',
    historicalGames: 'gameId',
});

class ModelStore {
    // --- Model Management ---

    async getSavedModels(): Promise<TunedModel[]> {
        try {
            // Dexie's orderBy can only sort by a single index.
            // For multi-level sorting (e.g., by validationMae then createdAt),
            // we sort by the primary indexed key first, then apply secondary sorting in memory.
            const models = await db.tunedModels
                .orderBy('performance.validationMae')
                .toArray();
                
            // Secondary sort by creation date (newest first) for models with the same MAE
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
        try {
            await db.tunedModels.delete(modelId);
        } catch (error) {
            console.error("Error deleting model from Dexie:", error);
        }
    }

    // --- Historical Data Vault ---

    async getHistoricalGame(gameId: string): Promise<HistoricalGame | null> {
        try {
            const game = await db.historicalGames.get(gameId);
            return game || null;
        } catch (error) {
            console.error(`Error retrieving game ${gameId} from vault:`, error);
            return null;
        }
    }

    async saveHistoricalGame(gameData: HistoricalGame): Promise<void> {
        try {
            await db.historicalGames.put(gameData);
        } catch (error) {
            console.error(`Error saving game ${gameData.gameId} to vault:`, error);
        }
    }

    async getHistoricalGameCount(): Promise<number> {
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