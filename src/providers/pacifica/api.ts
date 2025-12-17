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

// ============================================
// Volume fetcher
// ============================================

/**
 * Raw volume response from Pacifica
 */
interface PacificaVolumeResponse {
  success: boolean;
  data: {
    volume_1d: string;
    volume_7d: string;
    volume_14d: string;
    volume_30d: string;
    volume_all_time: string;
  };
  error: string | null;
}

/**
 * Fetch total trading volume for a wallet (all-time)
 */
export const fetchVolume = async (address: string): Promise<number> => {
  try {
    const response = await fetch(`${BASE_URL}/portfolio/volume?account=${address}`);

    if (!response.ok) {
      return 0;
    }

    const data: PacificaVolumeResponse = await response.json();

    if (!data.success || !data.data) {
      return 0;
    }

    return parseFloat(data.data.volume_all_time ?? '0');
  } catch {
    return 0;
  }
};

/**
 * Fetch total PnL for a wallet (all-time)
 * Uses portfolio endpoint with time_range=all
 */
export const fetchTotalPnl = async (address: string): Promise<number> => {
  try {
    const response = await fetch(
      `${BASE_URL}/portfolio?account=${address}&time_range=all`
    );

    if (!response.ok) {
      return 0;
    }

    const data = await response.json();

    if (!data.success || !data.data || data.data.length === 0) {
      return 0;
    }

    // Get latest entry (last in array) for most recent total PnL
    const latest = data.data[data.data.length - 1];
    return parseFloat(latest.pnl ?? '0');
  } catch {
    return 0;
  }
};

// ============================================
// Portfolio fetchers
// ============================================

import type { PortfolioTimeframe, PortfolioDataPoint } from '../../types/portfolio';

/**
 * Raw portfolio response from Pacifica
 */
interface PacificaPortfolioEntry {
  account_equity: string;
  pnl: string;
  timestamp: number;
}

interface PacificaPortfolioResponse {
  success: boolean;
  data: PacificaPortfolioEntry[];
  error: string | null;
}

/**
 * Map our timeframe to Pacifica's time_range param
 */
const TIMEFRAME_TO_PACIFICA: Record<PortfolioTimeframe, string> = {
  '1d': '1d',
  '7d': '7d',
  '30d': '30d',
  'all': 'all',
};

/**
 * Fetch portfolio history for a wallet
 * Returns PnL and account value (equity) history for the specified timeframe
 */
export const fetchPortfolio = async (
  address: string,
  timeframe: PortfolioTimeframe
): Promise<{ pnl: PortfolioDataPoint[]; accountValue: PortfolioDataPoint[] }> => {
  const timeRange = TIMEFRAME_TO_PACIFICA[timeframe];
  const response = await fetch(
    `${BASE_URL}/portfolio?account=${address}&time_range=${timeRange}`
  );

  if (!response.ok) {
    return { pnl: [], accountValue: [] };
  }

  const data: PacificaPortfolioResponse = await response.json();

  if (!data.success || !data.data) {
    return { pnl: [], accountValue: [] };
  }

  // Transform to normalized format
  const pnl: PortfolioDataPoint[] = data.data.map((entry) => ({
    timestamp: entry.timestamp,
    value: entry.pnl,
  }));

  const accountValue: PortfolioDataPoint[] = data.data.map((entry) => ({
    timestamp: entry.timestamp,
    value: entry.account_equity,
  }));

  // Filter out empty/zero data - if all values are zero, return empty arrays
  const hasNonZeroPnl = pnl.some((p) => parseFloat(p.value) !== 0);
  const hasNonZeroAccountValue = accountValue.some((p) => parseFloat(p.value) !== 0);

  if (!hasNonZeroPnl && !hasNonZeroAccountValue) {
    return { pnl: [], accountValue: [] };
  }

  return { pnl, accountValue };
};
