/**
 * dYdX v4 API functions
 */

import type {
  DydxPerpetualPosition,
  DydxPositionsResponse,
  DydxSubaccountResponse,
  DydxMarketsResponse,
  DydxPerpetualMarket,
  DydxHistoricalPnlResponse,
  DydxHistoricalPnlTick,
} from '../../types/dydx';
import { getCached, clearCacheByPrefix } from '../../utils/cache';
import type { PortfolioTimeframe, PortfolioDataPoint } from '../../types/portfolio';

// ============================================
// Constants
// ============================================

const BASE_URL = 'https://indexer.dydx.trade/v4';
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes

// ============================================
// Metadata fetchers (cached)
// ============================================

/**
 * Fetch all perpetual markets (cached for 30min)
 */
export const fetchMarkets = async (): Promise<Record<string, DydxPerpetualMarket>> => {
  return getCached('dydx:markets', async () => {
    const response = await fetch(`${BASE_URL}/perpetualMarkets`);

    if (!response.ok) {
      throw new Error(`dYdX markets error: ${response.status}`);
    }

    const data: DydxMarketsResponse = await response.json();
    return data.markets;
  }, CACHE_TTL);
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

  for (const [ticker, market] of Object.entries(markets)) {
    // stepSize is like "0.0001" -> 4 decimals
    const stepDecimals = countDecimals(market.stepSize);
    // tickSize is like "0.1" -> 1 decimal
    const tickDecimals = countDecimals(market.tickSize);

    sizeDecimals.set(ticker, stepDecimals);
    priceDecimals.set(ticker, tickDecimals);
  }

  return { sizeDecimals, priceDecimals };
};

/**
 * Count decimal places in a string number
 */
const countDecimals = (value: string): number => {
  const parts = value.split('.');
  return parts.length === 2 ? parts[1].length : 0;
};

/**
 * Fetch mark prices for multiple symbols
 */
export const fetchMarkPrices = async (
  symbols: string[]
): Promise<Map<string, string>> => {
  const markets = await fetchMarkets();
  const priceMap = new Map<string, string>();

  for (const symbol of symbols) {
    const market = markets[symbol];
    if (market?.oraclePrice) {
      priceMap.set(symbol, market.oraclePrice);
    }
  }

  return priceMap;
};

// ============================================
// Position fetchers
// ============================================

/**
 * Fetch subaccount data (includes equity + positions in one call)
 * @param address - dYdX address (starts with dydx1...)
 * @param subaccountNumber - Subaccount number (default 0)
 */
export const fetchSubaccount = async (
  address: string,
  subaccountNumber = 0
): Promise<DydxSubaccountResponse | null> => {
  const response = await fetch(
    `${BASE_URL}/addresses/${address}/subaccountNumber/${subaccountNumber}`
  );

  if (!response.ok) {
    // Return null on 404 (no subaccount found)
    if (response.status === 404) {
      return null;
    }
    throw new Error(`dYdX subaccount error: ${response.status}`);
  }

  return response.json();
};

/**
 * Fetch open positions for an address
 * @param address - dYdX address (starts with dydx1...)
 * @param subaccountNumber - Subaccount number (default 0)
 */
export const fetchPositions = async (
  address: string,
  subaccountNumber = 0
): Promise<DydxPerpetualPosition[]> => {
  const response = await fetch(
    `${BASE_URL}/perpetualPositions?address=${address}&subaccountNumber=${subaccountNumber}&status=OPEN`
  );

  if (!response.ok) {
    return [];
  }

  const data: DydxPositionsResponse = await response.json();
  return data.positions ?? [];
};

/**
 * Clear dYdX metadata cache
 */
export const clearDydxCache = (): void => {
  clearCacheByPrefix('dydx:');
};

// ============================================
// dYdX metadata type with decimals and mark prices
// ============================================

export interface DydxMetadata {
  sizeDecimals: Map<string, number>;
  priceDecimals: Map<string, number>;
  markPrices: Map<string, string>;
  maintenanceMarginFractions: Map<string, number>;
  initialMarginFractions: Map<string, number>;
}

/**
 * Build complete metadata map including mark prices and maintenance margin fractions
 */
export const buildMetadata = async (): Promise<DydxMetadata> => {
  const markets = await fetchMarkets();

  const sizeDecimals = new Map<string, number>();
  const priceDecimals = new Map<string, number>();
  const markPrices = new Map<string, string>();
  const maintenanceMarginFractions = new Map<string, number>();
  const initialMarginFractions = new Map<string, number>();

  for (const [ticker, market] of Object.entries(markets)) {
    sizeDecimals.set(ticker, countDecimals(market.stepSize));
    priceDecimals.set(ticker, countDecimals(market.tickSize));
    if (market.oraclePrice) {
      markPrices.set(ticker, market.oraclePrice);
    }
    maintenanceMarginFractions.set(ticker, parseFloat(market.maintenanceMarginFraction));
    initialMarginFractions.set(ticker, parseFloat(market.initialMarginFraction));
  }

  return {
    sizeDecimals,
    priceDecimals,
    markPrices,
    maintenanceMarginFractions,
    initialMarginFractions,
  };
};

// ============================================
// Portfolio / PnL fetchers
// ============================================

/**
 * Get date range for timeframe
 */
const getTimeframeRange = (timeframe: PortfolioTimeframe): {
  createdOnOrAfter?: string;
  createdBeforeOrAt: string;
} => {
  const now = new Date();
  let startDate: Date | undefined;

  switch (timeframe) {
    case '1d':
      startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      break;
    case '7d':
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case '30d':
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      break;
    case 'all':
    default:
      startDate = undefined;
      break;
  }

  return {
    createdOnOrAfter: startDate?.toISOString(),
    createdBeforeOrAt: now.toISOString(),
  };
};

/**
 * Fetch historical PnL data for a subaccount
 * @param address - dYdX address
 * @param timeframe - Timeframe for the data
 * @param subaccountNumber - Subaccount number (default 0)
 */
export const fetchHistoricalPnl = async (
  address: string,
  timeframe: PortfolioTimeframe,
  subaccountNumber = 0
): Promise<DydxHistoricalPnlTick[]> => {
  const { createdOnOrAfter, createdBeforeOrAt } = getTimeframeRange(timeframe);

  let url = `${BASE_URL}/historical-pnl?address=${address}&subaccountNumber=${subaccountNumber}&createdBeforeOrAt=${createdBeforeOrAt}`;

  if (createdOnOrAfter) {
    url += `&createdOnOrAfter=${createdOnOrAfter}`;
  }

  // Limit to reasonable amount of data points
  url += '&limit=500';

  const response = await fetch(url);

  if (!response.ok) {
    return [];
  }

  const data: DydxHistoricalPnlResponse = await response.json();
  return data.historicalPnl ?? [];
};

/**
 * Fetch portfolio data (PnL and equity history) for a wallet
 * @param address - dYdX address
 * @param timeframe - Timeframe for the data
 * @param subaccountNumber - Subaccount number (default 0)
 */
export const fetchPortfolio = async (
  address: string,
  timeframe: PortfolioTimeframe,
  subaccountNumber = 0
): Promise<{
  pnl: PortfolioDataPoint[];
  accountValue: PortfolioDataPoint[];
}> => {
  const historicalPnl = await fetchHistoricalPnl(address, timeframe, subaccountNumber);

  if (historicalPnl.length === 0) {
    return { pnl: [], accountValue: [] };
  }

  // Convert to PortfolioDataPoint format
  // Note: dYdX returns data in reverse chronological order, so we reverse it
  const sortedData = [...historicalPnl].reverse();

  // dYdX returns cumulative all-time totalPnl, we need relative PnL for the timeframe
  // Subtract the first value to get PnL starting from 0
  const basePnl = parseFloat(sortedData[0]?.totalPnl ?? '0');
  const pnl: PortfolioDataPoint[] = sortedData.map((tick) => ({
    timestamp: new Date(tick.createdAt).getTime(),
    value: (parseFloat(tick.totalPnl) - basePnl).toString(),
  }));

  // Similarly for account value - show relative change from first data point
  const baseEquity = parseFloat(sortedData[0]?.equity ?? '0');
  const accountValue: PortfolioDataPoint[] = sortedData.map((tick) => ({
    timestamp: new Date(tick.createdAt).getTime(),
    value: (parseFloat(tick.equity) - baseEquity).toString(),
  }));

  // Filter out empty/zero data
  const hasNonZeroPnl = pnl.some((p) => parseFloat(p.value) !== 0);
  const hasNonZeroAccountValue = accountValue.some((p) => parseFloat(p.value) !== 0);

  if (!hasNonZeroPnl && !hasNonZeroAccountValue) {
    return { pnl: [], accountValue: [] };
  }

  return { pnl, accountValue };
};

/**
 * Get the all-time total PnL for a wallet
 * @param address - dYdX address
 * @param subaccountNumber - Subaccount number (default 0)
 */
export const fetchTotalPnl = async (
  address: string,
  subaccountNumber = 0
): Promise<number> => {
  // Fetch most recent PnL entry
  const response = await fetch(
    `${BASE_URL}/historical-pnl?address=${address}&subaccountNumber=${subaccountNumber}&limit=1`
  );

  if (!response.ok) {
    return 0;
  }

  const data: DydxHistoricalPnlResponse = await response.json();

  if (!data.historicalPnl || data.historicalPnl.length === 0) {
    return 0;
  }

  return parseFloat(data.historicalPnl[0].totalPnl ?? '0');
};
