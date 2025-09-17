import { logger } from '../loggingService';

const CACHE_TTL = 15 * 60 * 1000; // 15 minutes

interface CacheItem<T> {
  timestamp: number;
  data: T;
}

/**
 * Retrieves data from the cache if it's not expired.
 * @param key The cache key.
 * @returns The cached data or null if not found or expired.
 */
export function getCachedData<T>(key: string): T | null {
  try {
    const itemStr = localStorage.getItem(key);
    if (!itemStr) {
      return null;
    }

    const item: CacheItem<T> = JSON.parse(itemStr);
    const now = Date.now();
    if (now - item.timestamp > CACHE_TTL) {
      localStorage.removeItem(key);
      logger.info(`Cache expired for key: ${key}`);
      return null;
    }
    
    logger.info(`Cache hit for key: ${key}`);
    return item.data;
  } catch (error) {
    logger.warn(`Error reading from cache for key: ${key}`, { error });
    return null;
  }
}

/**
 * Stores data in the cache with a timestamp.
 * @param key The cache key.
 * @param data The data to store.
 */
export function setCachedData<T>(key: string, data: T): void {
  try {
    const item: CacheItem<T> = {
      timestamp: Date.now(),
      data,
    };
    localStorage.setItem(key, JSON.stringify(item));
    logger.info(`Cached data for key: ${key}`);
  } catch (error) {
    logger.warn(`Error writing to cache for key: ${key}`, { error });
  }
}