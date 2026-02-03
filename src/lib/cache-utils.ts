/**
 * Shared cache utilities for widget data caching
 */

export interface CachedData {
  data: unknown;
  provider: string;
  fetchedAt: string;
  endpoint: string;
}

/**
 * Check if cached data is still fresh based on refresh_interval
 * @param dataUpdatedAt - ISO timestamp of when data was cached
 * @param refreshIntervalSeconds - How long cache should be considered fresh
 * @returns true if cache is fresh, false if stale or missing
 */
export function isCacheFresh(dataUpdatedAt: string | null, refreshIntervalSeconds: number): boolean {
  if (!dataUpdatedAt) return false;
  
  const cacheTime = new Date(dataUpdatedAt).getTime();
  const now = Date.now();
  const maxAgeMs = refreshIntervalSeconds * 1000;
  
  return (now - cacheTime) < maxAgeMs;
}

/**
 * Check if cached data is stale (inverse of isCacheFresh)
 * @param dataUpdatedAt - ISO timestamp of when data was cached
 * @param refreshIntervalSeconds - How long cache should be considered fresh
 * @returns true if cache is stale or missing, false if fresh
 */
export function isStale(dataUpdatedAt: string | null, refreshIntervalSeconds: number): boolean {
  return !isCacheFresh(dataUpdatedAt, refreshIntervalSeconds);
}

/**
 * Safely parse cached data JSON
 * @param cacheString - JSON string from data_cache column
 * @returns Parsed CachedData or null if parse fails
 */
export function parseCachedData(cacheString: string | null): CachedData | null {
  if (!cacheString) return null;
  
  try {
    return JSON.parse(cacheString) as CachedData;
  } catch (error) {
    console.warn('Failed to parse cached data:', error);
    return null;
  }
}

/**
 * Validate that cached data matches the current request
 * @param cachedData - The parsed cached data
 * @param requestEndpoint - The endpoint being requested
 * @param requestProvider - The provider being requested
 * @returns true if cache is valid for this request
 */
export function isCacheValidForRequest(
  cachedData: CachedData | null,
  requestEndpoint: string,
  requestProvider: string
): boolean {
  if (!cachedData) return false;
  
  return cachedData.endpoint === requestEndpoint && cachedData.provider === requestProvider;
}
