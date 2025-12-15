import type {
  PacificaPosition,
  PacificaPositionsResponse,
  PacificaAccountSetting,
  PacificaAccountSettingsResponse,
  PacificaMarketInfo,
  PacificaMarketInfoResponse,
  PacificaPrice,
  PacificaPricesResponse,
} from '../../types';
import { getCached, clearCacheByPrefix } from '../../utils/cache';

const BASE_URL = 'https://api.pacifica.fi/api/v1';
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes

// ============================================
// Metadata fetchers (cached)
// ============================================

/**
 * Fetch market info (cached for 30min)
 * Returns tick_size (price decimals) and lot_size (size decimals)
 */
export const fetchMarkets = async (): Promise<PacificaMarketInfo[]> => {
  return getCached('pacifica:markets', async () => {
    const response = await fetch(`${BASE_URL}/info`);

    if (!response.ok) {
      throw new Error(`Pacifica markets error: ${response.status}`);
    }

    const data: PacificaMarketInfoResponse = await response.json();

    if (!data.success) {
      throw new Error(data.error ?? 'Failed to fetch Pacifica markets');
    }

    return data.data;
  }, CACHE_TTL);
};

/**
 * Calculate decimals from tick_size or lot_size string
 * e.g., "0.01" -> 2, "0.0001" -> 4, "1" -> 0
 */
const calculateDecimals = (value: string): number => {
  const num = parseFloat(value);
  if (!Number.isFinite(num) || num <= 0) return 0;

  // Count decimal places in the string
  const parts = value.split('.');
  if (parts.length === 1) return 0;
  return parts[1].length;
};

/**
 * Build maps of symbol -> decimals from market metadata
 */
export const buildDecimalsMap = async (): Promise<{
  sizeDecimals: Map<string, number>;
  priceDecimals: Map<string, number>;
}> => {
  const markets = await fetchMarkets();

  const sizeDecimals = new Map<string, number>();
  const priceDecimals = new Map<string, number>();

  for (const market of markets) {
    sizeDecimals.set(market.symbol, calculateDecimals(market.lot_size));
    priceDecimals.set(market.symbol, calculateDecimals(market.tick_size));
  }

  return { sizeDecimals, priceDecimals };
};

// ============================================
// Position fetchers
// ============================================

/**
 * Fetch positions for a Solana wallet
 */
export const fetchPositions = async (address: string): Promise<PacificaPosition[]> => {
  const response = await fetch(`${BASE_URL}/positions?account=${address}`);

  if (!response.ok) {
    // Return empty on any error (including 404)
    return [];
  }

  const data: PacificaPositionsResponse = await response.json();

  if (!data.success) {
    return [];
  }

  return data.data;
};

/**
 * Fetch account settings (leverage per symbol)
 */
export const fetchAccountSettings = async (
  address: string
): Promise<PacificaAccountSetting[]> => {
  const response = await fetch(`${BASE_URL}/account/settings?account=${address}`);

  if (!response.ok) {
    // Return empty on any error
    return [];
  }

  const data: PacificaAccountSettingsResponse = await response.json();

  if (!data.success) {
    return [];
  }

  return data.data;
};

/**
 * Fetch current prices
 */
export const fetchPrices = async (): Promise<PacificaPrice[]> => {
  const response = await fetch(`${BASE_URL}/info/prices`);

  if (!response.ok) {
    return [];
  }

  const data: PacificaPricesResponse = await response.json();

  if (!data.success) {
    return [];
  }

  return data.data;
};

/**
 * Clear Pacifica metadata cache
 */
export const clearPacificaCache = (): void => {
  clearCacheByPrefix('pacifica:');
};
