/**
 * Extended DEX API functions
 */

import type {
  ExtendedCredentials,
  ExtendedPositionRaw,
  ExtendedMarketRaw,
  ExtendedApiResponse,
  ExtendedBalanceRaw,
} from '../../types/extended';
import { cachedFetch } from '../../utils/cachedFetch';
import { buildDecimalsMap as buildDecimalsMapGeneric, type DecimalsMap } from '../../utils/metadata';
import { clearCacheByPrefix } from '../../utils/cache';

// ============================================
// Constants
// ============================================

const EXTENDED_BASE_URL = 'https://api.starknet.extended.exchange/api/v1';
const CACHE_PREFIX = 'extended';
const MARKETS_CACHE_TTL = 60000; // 1 minute

// ============================================
// Public Endpoints (cached)
// ============================================

/**
 * Fetch all markets info
 * Public endpoint - no authentication required
 */
export async function fetchMarkets(): Promise<ExtendedMarketRaw[]> {
  return cachedFetch<ExtendedApiResponse<ExtendedMarketRaw[]>, ExtendedMarketRaw[]>({
    url: `${EXTENDED_BASE_URL}/info/markets`,
    cachePrefix: CACHE_PREFIX,
    cacheKeySuffix: 'markets',
    cacheTtl: MARKETS_CACHE_TTL,
    transform: (data) => {
      const response = data as ExtendedApiResponse<ExtendedMarketRaw[]>;
      if (response.status === 'ERROR') {
        throw new Error(`Extended API Error: ${response.error?.message || 'Unknown'}`);
      }
      return response.data ?? [];
    },
    errorPrefix: 'Extended markets',
  });
}

/**
 * Build decimals map from markets info
 */
export async function buildDecimalsMap(): Promise<DecimalsMap> {
  const markets = await fetchMarkets();
  return buildDecimalsMapGeneric(markets, {
    getSymbol: (m) => m.name,
    getSizeDecimals: (m) => m.assetPrecision,
    getPriceDecimals: (m) => m.collateralAssetPrecision,
    filter: (m) => m.active && m.status === 'ACTIVE',
  });
}

// ============================================
// Authenticated Endpoints (not cached)
// ============================================

/**
 * Make an authenticated request to Extended API
 * Uses X-Api-Key header for authentication
 */
async function authRequest<T>(
  endpoint: string,
  credentials: ExtendedCredentials,
  params?: Record<string, string>
): Promise<T> {
  const query = params ? '?' + new URLSearchParams(params).toString() : '';
  const url = `${EXTENDED_BASE_URL}${endpoint}${query}`;

  const res = await fetch(url, {
    method: 'GET',
    headers: {
      'X-Api-Key': credentials.apiKey,
      'Content-Type': 'application/json',
    },
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Extended API ${res.status}: ${err}`);
  }

  const json: ExtendedApiResponse<T> = await res.json();

  if (json.status === 'ERROR') {
    throw new Error(`Extended API Error: ${json.error?.message || 'Unknown'}`);
  }

  return json.data as T;
}

/**
 * Fetch raw positions from Extended
 * Authenticated endpoint - requires API key
 */
export async function fetchPositions(
  credentials: ExtendedCredentials
): Promise<ExtendedPositionRaw[]> {
  return authRequest<ExtendedPositionRaw[]>('/user/positions', credentials);
}

/**
 * Fetch account balance from Extended
 * Authenticated endpoint - requires API key
 */
export async function fetchBalance(
  credentials: ExtendedCredentials
): Promise<ExtendedBalanceRaw> {
  return authRequest<ExtendedBalanceRaw>('/user/balance', credentials);
}

// ============================================
// Cache Management
// ============================================

/**
 * Clear all Extended-related cache entries
 */
export function clearExtendedCache(): void {
  clearCacheByPrefix(CACHE_PREFIX);
}
