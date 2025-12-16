/**
 * Aster DEX API functions
 */

import type {
  AsterCredentials,
  AsterPositionRaw,
  AsterSymbolInfoRaw,
  AsterExchangeInfoResponse,
} from '../../types/aster';
import { cachedFetch } from '../../utils/cachedFetch';
import { buildDecimalsMap as buildDecimalsMapGeneric, type DecimalsMap } from '../../utils/metadata';
import { hmacSha256 } from './crypto';

// ============================================
// Constants
// ============================================

const ASTER_BASE_URL = 'https://fapi.asterdex.com';
const CACHE_PREFIX = 'aster';
const EXCHANGE_INFO_CACHE_TTL = 60000; // 1 minute

// ============================================
// Public Endpoints (cached)
// ============================================

/**
 * Fetch exchange info (symbols, precision, filters)
 * Public endpoint - no authentication required
 */
export async function fetchExchangeInfo(): Promise<AsterSymbolInfoRaw[]> {
  return cachedFetch<AsterExchangeInfoResponse, AsterSymbolInfoRaw[]>({
    url: `${ASTER_BASE_URL}/fapi/v1/exchangeInfo`,
    cachePrefix: CACHE_PREFIX,
    cacheKeySuffix: 'exchange-info',
    cacheTtl: EXCHANGE_INFO_CACHE_TTL,
    transform: (data) => (data as AsterExchangeInfoResponse).symbols,
    errorPrefix: 'Aster exchangeInfo',
  });
}

/**
 * Build decimals map from exchange info
 */
export async function buildDecimalsMap(): Promise<DecimalsMap> {
  const symbols = await fetchExchangeInfo();
  return buildDecimalsMapGeneric(symbols, {
    getSymbol: (s) => s.symbol,
    getSizeDecimals: (s) => s.quantityPrecision,
    getPriceDecimals: (s) => s.pricePrecision,
  });
}

// ============================================
// Signed Endpoints (not cached - timestamp required)
// ============================================

/**
 * Make a signed request to Aster API
 * Each request requires a fresh timestamp in the signature
 */
async function signedRequest<T>(
  endpoint: string,
  credentials: AsterCredentials,
  params: Record<string, string | number> = {}
): Promise<T> {
  // Add timestamp
  params.timestamp = Date.now();

  // Build query string (sorted keys for consistent signing)
  const queryString = Object.keys(params)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join('&');

  // Sign the query string
  const signature = await hmacSha256(queryString, credentials.apiSecret);
  const url = `${ASTER_BASE_URL}${endpoint}?${queryString}&signature=${signature}`;

  const res = await fetch(url, {
    method: 'GET',
    headers: { 'X-MBX-APIKEY': credentials.apiKey },
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Aster API ${res.status}: ${err}`);
  }

  return res.json();
}

/**
 * Fetch raw positions from Aster
 * Signed endpoint - requires API credentials
 */
export async function fetchPositions(
  credentials: AsterCredentials
): Promise<AsterPositionRaw[]> {
  return signedRequest<AsterPositionRaw[]>(
    '/fapi/v2/positionRisk',
    credentials
  );
}

// ============================================
// Cache Management
// ============================================

import { clearCacheByPrefix } from '../../utils/cache';

/**
 * Clear all Aster-related cache entries
 */
export function clearAsterCache(): void {
  clearCacheByPrefix(CACHE_PREFIX);
}
