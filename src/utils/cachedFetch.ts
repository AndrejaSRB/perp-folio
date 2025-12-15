/**
 * Cached fetch utility for API calls with automatic caching
 */

import { getCached } from './cache';

const DEFAULT_CACHE_TTL = 30 * 60 * 1000; // 30 minutes

/**
 * HTTP method type
 */
export type HttpMethod = 'GET' | 'POST';

/**
 * Configuration for cached fetch requests
 */
export interface CachedFetchConfig<T, R = T> {
  /** Full URL to fetch */
  url: string;
  /** HTTP method (default: GET) */
  method?: HttpMethod;
  /** Request body for POST requests */
  body?: Record<string, unknown>;
  /** Cache key prefix (e.g., 'hyperliquid', 'lighter') */
  cachePrefix: string;
  /** Optional cache key suffix (appended to prefix:url) */
  cacheKeySuffix?: string;
  /** Cache TTL in milliseconds (default: 30 minutes) */
  cacheTtl?: number;
  /** Transform the raw JSON response */
  transform?: (json: unknown) => R;
  /** Custom error message prefix */
  errorPrefix?: string;
  /** Return this value on error instead of throwing */
  fallbackOnError?: R;
}

/**
 * Generate a cache key from config
 */
const generateCacheKey = <T, R>(config: CachedFetchConfig<T, R>): string => {
  const suffix = config.cacheKeySuffix ?? config.url;
  return `${config.cachePrefix}:${suffix}`;
};

/**
 * Perform a cached fetch request
 *
 * @example
 * // Simple GET request
 * const data = await cachedFetch({
 *   url: 'https://api.example.com/markets',
 *   cachePrefix: 'example',
 *   transform: (json) => json.markets,
 * });
 *
 * @example
 * // POST request with body
 * const data = await cachedFetch({
 *   url: 'https://api.example.com/info',
 *   method: 'POST',
 *   body: { type: 'clearinghouseState', user: address },
 *   cachePrefix: 'example',
 *   cacheKeySuffix: `positions:${address}`,
 * });
 *
 * @example
 * // With fallback on error
 * const data = await cachedFetch({
 *   url: 'https://api.example.com/data',
 *   cachePrefix: 'example',
 *   fallbackOnError: [],
 * });
 */
export async function cachedFetch<T, R = T>(
  config: CachedFetchConfig<T, R>
): Promise<R> {
  const {
    url,
    method = 'GET',
    body,
    cachePrefix,
    cacheTtl = DEFAULT_CACHE_TTL,
    transform,
    errorPrefix,
    fallbackOnError,
  } = config;

  const cacheKey = generateCacheKey(config);

  return getCached(
    cacheKey,
    async () => {
      const fetchOptions: RequestInit = {
        method,
        headers: { 'Content-Type': 'application/json' },
      };

      if (body && method === 'POST') {
        fetchOptions.body = JSON.stringify(body);
      }

      const response = await fetch(url, fetchOptions);

      if (!response.ok) {
        if (fallbackOnError !== undefined) {
          return fallbackOnError;
        }
        const prefix = errorPrefix ?? cachePrefix;
        throw new Error(`${prefix} API error: ${response.status}`);
      }

      const json = await response.json();
      return transform ? transform(json) : (json as R);
    },
    cacheTtl
  );
}

/**
 * Perform an uncached fetch request (still uses same pattern but bypasses cache)
 * Useful for user-specific data that shouldn't be cached
 */
export async function uncachedFetch<T, R = T>(
  config: Omit<CachedFetchConfig<T, R>, 'cachePrefix' | 'cacheTtl' | 'cacheKeySuffix'>
): Promise<R> {
  const { url, method = 'GET', body, transform, errorPrefix, fallbackOnError } = config;

  const fetchOptions: RequestInit = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };

  if (body && method === 'POST') {
    fetchOptions.body = JSON.stringify(body);
  }

  const response = await fetch(url, fetchOptions);

  if (!response.ok) {
    if (fallbackOnError !== undefined) {
      return fallbackOnError;
    }
    const prefix = errorPrefix ?? 'API';
    throw new Error(`${prefix} error: ${response.status}`);
  }

  const json = await response.json();
  return transform ? transform(json) : (json as R);
}
