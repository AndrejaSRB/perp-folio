import type {
  LighterAccountsResponse,
  LighterMarketMeta,
  LighterOrderBooksResponse,
  LighterOrderBookDetails,
  LighterOrderBookDetailsResponse,
} from '../../types';
import { getCached, clearCacheByPrefix } from '../../utils/cache';

const BASE_URL = 'https://mainnet.zklighter.elliot.ai';
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes

// ============================================
// Metadata fetchers (cached)
// ============================================

/**
 * Fetch all market metadata (cached for 30min)
 */
export const fetchOrderBooks = async (): Promise<LighterMarketMeta[]> => {
  return getCached('lighter:orderBooks', async () => {
    const response = await fetch(`${BASE_URL}/api/v1/orderBooks`);

    if (!response.ok) {
      throw new Error(`Lighter orderBooks error: ${response.status}`);
    }

    const data: LighterOrderBooksResponse = await response.json();
    return data.order_books;
  }, CACHE_TTL);
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
 * Fetch order book details for a specific symbol (includes mark_price)
 */
export const fetchOrderBookDetails = async (
  symbol: string
): Promise<LighterOrderBookDetails | null> => {
  const response = await fetch(`${BASE_URL}/api/v1/orderBookDetails?symbol=${symbol}`);

  if (!response.ok) {
    return null;
  }

  const data: LighterOrderBookDetailsResponse = await response.json();
  return data.order_book;
};

/**
 * Fetch mark prices for multiple symbols
 */
export const fetchMarkPrices = async (
  symbols: string[]
): Promise<Map<string, string>> => {
  const priceMap = new Map<string, string>();

  // Fetch all in parallel
  const results = await Promise.all(
    symbols.map(async (symbol) => {
      const details = await fetchOrderBookDetails(symbol);
      return { symbol, markPrice: details?.mark_price ?? null };
    })
  );

  for (const { symbol, markPrice } of results) {
    if (markPrice) {
      priceMap.set(symbol, markPrice);
    }
  }

  return priceMap;
};

// ============================================
// Position fetchers
// ============================================

/**
 * Fetch account data from Lighter
 */
export const fetchAccount = async (address: string): Promise<LighterAccountsResponse> => {
  const response = await fetch(
    `${BASE_URL}/api/v1/account?by=l1_address&value=${address}`
  );

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
  clearCacheByPrefix('lighter:');
};

/**
 * Fetch all positions for an address (aggregated from all accounts)
 */
export const fetchPositions = async (address: string): Promise<LighterPosition[]> => {
  const accountData = await fetchAccount(address);

  if (accountData.accounts.length === 0) {
    return [];
  }

  // Aggregate positions from all accounts (master + subaccounts)
  return accountData.accounts.flatMap((account) => account.positions);
};

// Re-export LighterPosition type for use in fetchPositions
import type { LighterPosition } from '../../types';

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
export const buildMetadata = async (symbols?: string[]): Promise<LighterMetadata> => {
  const [decimalsMap, markPrices] = await Promise.all([
    buildDecimalsMap(),
    symbols && symbols.length > 0 ? fetchMarkPrices(symbols) : Promise.resolve(new Map<string, string>()),
  ]);

  return {
    sizeDecimals: decimalsMap.sizeDecimals,
    priceDecimals: decimalsMap.priceDecimals,
    markPrices,
  };
};
