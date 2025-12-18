import type {
  LighterAccountsResponse,
  LighterMarketMeta,
  LighterOrderBooksResponse,
  LighterOrderBookDetails,
  LighterOrderBookDetailsResponse,
  LighterCredentials,
} from "../../types";
import { getCached, clearCacheByPrefix } from "../../utils/cache";

const BASE_URL = "https://mainnet.zklighter.elliot.ai";
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes

// ============================================
// Auth helpers
// ============================================

/**
 * Build URL with optional auth parameter
 */
const buildAuthUrl = (
  baseUrl: string,
  credentials?: LighterCredentials
): string => {
  if (credentials?.readToken) {
    const separator = baseUrl.includes("?") ? "&" : "?";
    return `${baseUrl}${separator}auth=${credentials.readToken}`;
  }
  return baseUrl;
};

// ============================================
// Metadata fetchers (cached)
// ============================================

/**
 * Fetch all market metadata (cached for 30min)
 */
export const fetchOrderBooks = async (): Promise<LighterMarketMeta[]> => {
  return getCached(
    "lighter:orderBooks",
    async () => {
      const response = await fetch(`${BASE_URL}/api/v1/orderBooks`);

      if (!response.ok) {
        throw new Error(`Lighter orderBooks error: ${response.status}`);
      }

      const data: LighterOrderBooksResponse = await response.json();
      return data.order_books;
    },
    CACHE_TTL
  );
};

/**
 * Build maps of symbol -> decimals from market metadata
 */
export const buildDecimalsMap = async (): Promise<{
  sizeDecimals: Map<string, number>;
  priceDecimals: Map<string, number>;
}> => {
  const markets = await fetchOrderBooks();

  const sizeDecimals = new Map<string, number>();
  const priceDecimals = new Map<string, number>();

  for (const market of markets) {
    sizeDecimals.set(market.symbol, market.supported_size_decimals);
    priceDecimals.set(market.symbol, market.supported_price_decimals);
  }

  return { sizeDecimals, priceDecimals };
};

/**
 * Fetch order book details for all symbols (includes last_trade_price as mark price)
 */
export const fetchOrderBookDetails = async (): Promise<
  LighterOrderBookDetails[]
> => {
  const response = await fetch(`${BASE_URL}/api/v1/orderBookDetails`);

  if (!response.ok) {
    return [];
  }

  const data: LighterOrderBookDetailsResponse = await response.json();
  return data.order_book_details ?? [];
};

/**
 * Fetch mark prices for multiple symbols
 * Uses last_trade_price from orderBookDetails as mark price
 */
export const fetchMarkPrices = async (
  symbols: string[]
): Promise<Map<string, string>> => {
  const priceMap = new Map<string, string>();

  // Fetch all order book details in one request
  const allDetails = await fetchOrderBookDetails();

  // Build map for requested symbols
  for (const details of allDetails) {
    if (symbols.includes(details.symbol) && details.last_trade_price != null) {
      priceMap.set(details.symbol, String(details.last_trade_price));
    }
  }

  return priceMap;
};

// ============================================
// Position fetchers
// ============================================

/**
 * Fetch account data from Lighter
 * @param address - Wallet address (l1_address)
 * @param credentials - Optional read-only API token for authenticated access
 */
export const fetchAccount = async (
  address: string,
  credentials?: LighterCredentials
): Promise<LighterAccountsResponse> => {
  const checksummedAddress = toChecksumAddress(address);
  const baseUrl = `${BASE_URL}/api/v1/account?by=l1_address&value=${checksummedAddress}`;
  const url = buildAuthUrl(baseUrl, credentials);

  const response = await fetch(url);

  if (!response.ok) {
    // Return empty on any error (including 404)
    return {
      code: response.status,
      total: 0,
      accounts: [],
    };
  }

  return response.json();
};

/**
 * Clear Lighter metadata cache
 */
export const clearLighterCache = (): void => {
  clearCacheByPrefix("lighter:");
};

/**
 * Fetch all positions for an address (aggregated from all accounts)
 * @param address - Wallet address (l1_address)
 * @param credentials - Optional read-only API token for authenticated access
 */
export const fetchPositions = async (
  address: string,
  credentials?: LighterCredentials
): Promise<LighterPosition[]> => {
  const accountData = await fetchAccount(address, credentials);

  if (accountData.accounts.length === 0) {
    return [];
  }

  // Aggregate positions from all accounts (master + subaccounts)
  return accountData.accounts.flatMap((account) => account.positions);
};

// Re-export LighterPosition type for use in fetchPositions
import type { LighterPosition } from "../../types";
import type {
  PortfolioTimeframe,
  PortfolioDataPoint,
  LighterPnlResponse,
} from "../../types/portfolio";
import { toChecksumAddress } from "../../utils";

/**
 * Lighter metadata type with decimals and mark prices
 */
export interface LighterMetadata {
  sizeDecimals: Map<string, number>;
  priceDecimals: Map<string, number>;
  markPrices: Map<string, string>;
}

/**
 * Build complete metadata map including mark prices
 * @param symbols - Optional list of symbols to fetch mark prices for
 */
export const buildMetadata = async (
  symbols?: string[]
): Promise<LighterMetadata> => {
  const [decimalsMap, markPrices] = await Promise.all([
    buildDecimalsMap(),
    symbols && symbols.length > 0
      ? fetchMarkPrices(symbols)
      : Promise.resolve(new Map<string, string>()),
  ]);

  return {
    sizeDecimals: decimalsMap.sizeDecimals,
    priceDecimals: decimalsMap.priceDecimals,
    markPrices,
  };
};

// ============================================
// Portfolio / PnL fetchers
// ============================================

/**
 * Map timeframe to Lighter API parameters
 */
const getTimeframeParams = (
  timeframe: PortfolioTimeframe
): {
  resolution: string;
  startTimestamp: number;
  countBack: number;
} => {
  const now = Math.floor(Date.now() / 1000);

  switch (timeframe) {
    case "1d":
      return {
        resolution: "1h",
        startTimestamp: now - 24 * 60 * 60,
        countBack: 24,
      };
    case "7d":
      return {
        resolution: "1h",
        startTimestamp: now - 7 * 24 * 60 * 60,
        countBack: 168, // 7 * 24
      };
    case "30d":
      return {
        resolution: "1d",
        startTimestamp: now - 30 * 24 * 60 * 60,
        countBack: 30,
      };
    case "all":
    default:
      return {
        resolution: "1d",
        startTimestamp: 0,
        countBack: 1000, // Large enough to get all data
      };
  }
};

/**
 * Fetch PnL chart data for a specific account index
 * @param accountIndex - The Lighter account index
 * @param timeframe - Timeframe for the data
 * @param credentials - Optional read-only API token
 */
export const fetchPnl = async (
  accountIndex: number,
  timeframe: PortfolioTimeframe,
  credentials?: LighterCredentials
): Promise<LighterPnlResponse> => {
  const { resolution, startTimestamp, countBack } =
    getTimeframeParams(timeframe);
  const endTimestamp = Math.floor(Date.now() / 1000);

  let url = `${BASE_URL}/api/v1/pnl?by=index&value=${accountIndex}&resolution=${resolution}&start_timestamp=${startTimestamp}&end_timestamp=${endTimestamp}&count_back=${countBack}`;
  url = buildAuthUrl(url, credentials);

  const response = await fetch(url);

  if (!response.ok) {
    return { code: response.status, resolution, pnl: [] };
  }

  const data: LighterPnlResponse = await response.json();

  // Filter data to only include points within the requested timeframe
  // The API may return data outside the requested range
  const filteredPnl = data.pnl.filter(
    (point) => point.timestamp >= startTimestamp
  );

  return { ...data, pnl: filteredPnl };
};

/**
 * Fetch portfolio data (PnL and account value history) for a wallet
 * Aggregates data from all accounts associated with the wallet
 * @param address - Wallet address (l1_address)
 * @param timeframe - Timeframe for the data
 * @param credentials - Optional read-only API token
 */
export const fetchPortfolio = async (
  address: string,
  timeframe: PortfolioTimeframe,
  credentials?: LighterCredentials
): Promise<{
  pnl: PortfolioDataPoint[];
  accountValue: PortfolioDataPoint[];
}> => {
  // First, get all account indices for this wallet
  const accountData = await fetchAccount(address, credentials);

  if (accountData.accounts.length === 0) {
    return { pnl: [], accountValue: [] };
  }

  // Fetch PnL for all accounts
  const pnlResults = await Promise.all(
    accountData.accounts.map((account) =>
      fetchPnl(account.account_index, timeframe, credentials)
    )
  );

  // Aggregate PnL data by timestamp
  const pnlByTimestamp = new Map<
    number,
    { tradePnl: number; poolPnl: number; inflow: number; outflow: number }
  >();

  for (const result of pnlResults) {
    for (const point of result.pnl) {
      const existing = pnlByTimestamp.get(point.timestamp) ?? {
        tradePnl: 0,
        poolPnl: 0,
        inflow: 0,
        outflow: 0,
      };
      pnlByTimestamp.set(point.timestamp, {
        tradePnl: existing.tradePnl + point.trade_pnl,
        poolPnl: existing.poolPnl + point.pool_pnl,
        inflow: existing.inflow + point.inflow,
        outflow: existing.outflow + point.outflow,
      });
    }
  }

  // Sort by timestamp and convert to PortfolioDataPoint format
  const sortedTimestamps = [...pnlByTimestamp.keys()].sort((a, b) => a - b);

  const pnl: PortfolioDataPoint[] = sortedTimestamps.map((timestamp) => {
    const data = pnlByTimestamp.get(timestamp)!;
    // Total PnL = trade_pnl + pool_pnl
    const totalPnl = data.tradePnl + data.poolPnl;
    // Convert seconds to milliseconds for consistency with other providers
    return { timestamp: timestamp * 1000, value: totalPnl.toFixed(2) };
  });

  // Account value = inflow - outflow + total_pnl
  const accountValue: PortfolioDataPoint[] = sortedTimestamps.map(
    (timestamp) => {
      const data = pnlByTimestamp.get(timestamp)!;
      const totalPnl = data.tradePnl + data.poolPnl;
      const value = data.inflow - data.outflow + totalPnl;
      // Convert seconds to milliseconds for consistency with other providers
      return { timestamp: timestamp * 1000, value: value.toFixed(2) };
    }
  );

  // Filter out empty/zero data - if all values are zero, return empty arrays
  const hasNonZeroPnl = pnl.some((p) => parseFloat(p.value) !== 0);
  const hasNonZeroAccountValue = accountValue.some(
    (p) => parseFloat(p.value) !== 0
  );

  if (!hasNonZeroPnl && !hasNonZeroAccountValue) {
    return { pnl: [], accountValue: [] };
  }

  return { pnl, accountValue };
};

/**
 * Get the all-time total PnL for a wallet (latest value from PnL endpoint)
 * @param address - Wallet address (l1_address)
 * @param credentials - Optional read-only API token
 */
export const fetchTotalPnl = async (
  address: string,
  credentials?: LighterCredentials
): Promise<number> => {
  const accountData = await fetchAccount(address, credentials);

  if (accountData.accounts.length === 0) {
    return 0;
  }

  // Fetch all-time PnL for all accounts
  const pnlResults = await Promise.all(
    accountData.accounts.map((account) =>
      fetchPnl(account.account_index, "all", credentials)
    )
  );

  // Sum the latest PnL from each account
  let totalPnl = 0;
  for (const result of pnlResults) {
    if (result.pnl.length > 0) {
      const latest = result.pnl[result.pnl.length - 1];
      totalPnl += latest.trade_pnl + latest.pool_pnl;
    }
  }

  return totalPnl;
};
