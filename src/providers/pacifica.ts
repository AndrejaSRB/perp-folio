import type { DexProvider } from './types';
import type {
  PacificaPosition,
  PacificaPositionsResponse,
  PacificaAccountSettingsResponse,
  PacificaMarketInfoResponse,
  PacificaPricesResponse,
  PacificaAccountSetting,
  PacificaMarketInfo,
  PacificaPrice,
  NormalizedPosition,
} from '../types';

const BASE_URL = 'https://api.pacifica.fi/api/v1';

// Cache for market info (static data, doesn't change often)
let marketsCache: PacificaMarketInfo[] | null = null;

/**
 * Fetch positions for a Solana wallet
 */
const fetchPositions = async (address: string): Promise<PacificaPosition[]> => {
  const response = await fetch(`${BASE_URL}/positions?account=${address}`);
  const data: PacificaPositionsResponse = await response.json();

  if (!data.success) {
    throw new Error(data.error ?? 'Failed to fetch Pacifica positions');
  }

  return data.data;
};

/**
 * Fetch account settings (leverage per symbol)
 */
const fetchAccountSettings = async (
  address: string
): Promise<PacificaAccountSetting[]> => {
  const response = await fetch(`${BASE_URL}/account/settings?account=${address}`);
  const data: PacificaAccountSettingsResponse = await response.json();

  if (!data.success) {
    throw new Error(data.error ?? 'Failed to fetch Pacifica account settings');
  }

  return data.data;
};

/**
 * Fetch market info (max leverage, etc.)
 */
const fetchMarkets = async (): Promise<PacificaMarketInfo[]> => {
  if (marketsCache) return marketsCache;

  const response = await fetch(`${BASE_URL}/info`);
  const data: PacificaMarketInfoResponse = await response.json();

  if (!data.success) {
    throw new Error(data.error ?? 'Failed to fetch Pacifica markets');
  }

  marketsCache = data.data;
  return data.data;
};

/**
 * Fetch current prices
 */
const fetchPrices = async (): Promise<PacificaPrice[]> => {
  const response = await fetch(`${BASE_URL}/info/prices`);
  const data: PacificaPricesResponse = await response.json();

  if (!data.success) {
    throw new Error(data.error ?? 'Failed to fetch Pacifica prices');
  }

  return data.data;
};

/** Extended type with enriched context (internal fields prefixed with _) */
export interface PacificaPositionWithContext extends PacificaPosition {
  _leverage: number;
  _maxLeverage: number | null;
  _markPrice: string | null;
}

/**
 * Fetch positions with all required context (settings, markets, prices)
 */
const fetchPositionsWithContext = async (
  address: string
): Promise<PacificaPositionWithContext[]> => {
  const [positions, settings, markets, prices] = await Promise.all([
    fetchPositions(address),
    fetchAccountSettings(address),
    fetchMarkets(),
    fetchPrices(),
  ]);

  // Enrich positions with context
  return positions.map((p) => {
    const setting = settings.find((s) => s.symbol === p.symbol);
    const market = markets.find((m) => m.symbol === p.symbol);
    const price = prices.find((pr) => pr.symbol === p.symbol);

    // If no setting found, user is using max leverage
    const leverage = setting?.leverage ?? market?.max_leverage ?? 1;

    return {
      ...p,
      _leverage: leverage,
      _maxLeverage: market?.max_leverage ?? null,
      _markPrice: price?.mark ?? null,
    };
  });
};

/**
 * Normalize Pacifica position to standard format
 */
const normalizePosition = (
  raw: PacificaPositionWithContext,
  wallet: string
): NormalizedPosition => {
  // Calculate unrealized PnL if we have mark price
  let unrealizedPnl = '0';
  if (raw._markPrice) {
    const size = parseFloat(raw.amount);
    const entryPrice = parseFloat(raw.entry_price);
    const markPrice = parseFloat(raw._markPrice);
    const pnl =
      raw.side === 'long'
        ? (markPrice - entryPrice) * size
        : (entryPrice - markPrice) * size;
    unrealizedPnl = pnl.toString();
  }

  return {
    id: `pacifica-${wallet}-${raw.symbol}`,
    provider: 'pacifica',
    wallet,
    symbol: raw.symbol,
    side: raw.side as 'long' | 'short',
    size: raw.amount,
    entryPrice: raw.entry_price,
    markPrice: raw._markPrice,
    unrealizedPnl,
    realizedPnl: null,
    leverage: raw._leverage,
    leverageType: raw.isolated ? 'isolated' : 'cross',
    liquidationPrice: null, // Would need calculation
    margin: raw.margin,
    maxLeverage: raw._maxLeverage,
    fundingAccrued: raw.funding,
    timestamp: raw.updated_at,
  };
};

export const pacificaProvider: DexProvider<PacificaPositionWithContext> = {
  id: 'pacifica',
  name: 'Pacifica',
  chain: 'solana',

  fetchPositions: fetchPositionsWithContext,

  normalizePosition,
};

// Export raw fetchers for advanced use
export {
  fetchPositions,
  fetchAccountSettings,
  fetchMarkets,
  fetchPrices,
};

// Export function to clear cache if needed
export const clearMarketsCache = (): void => {
  marketsCache = null;
};
