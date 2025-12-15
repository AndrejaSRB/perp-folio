/**
 * Generic metadata utilities for building decimals and price maps
 */

/**
 * Standard decimals map structure used across all providers
 */
export interface DecimalsMap {
  sizeDecimals: Map<string, number>;
  priceDecimals: Map<string, number>;
}

/**
 * Configuration for building a decimals map from market data
 */
export interface DecimalsMapConfig<TMarket> {
  /** Function to get the symbol/name from a market */
  getSymbol: (market: TMarket) => string;
  /** Function to extract size decimals from a market */
  getSizeDecimals: (market: TMarket) => number;
  /** Function to extract price decimals from a market */
  getPriceDecimals: (market: TMarket) => number;
  /** Optional filter to exclude markets (e.g., delisted) */
  filter?: (market: TMarket) => boolean;
}

/**
 * Build a decimals map from an array of markets
 *
 * @example
 * const decimalsMap = buildDecimalsMap(markets, {
 *   getSymbol: (m) => m.symbol,
 *   getSizeDecimals: (m) => m.supported_size_decimals,
 *   getPriceDecimals: (m) => m.supported_price_decimals,
 * });
 */
export function buildDecimalsMap<TMarket>(
  markets: TMarket[],
  config: DecimalsMapConfig<TMarket>
): DecimalsMap {
  const sizeDecimals = new Map<string, number>();
  const priceDecimals = new Map<string, number>();

  for (const market of markets) {
    // Skip if filter returns false
    if (config.filter && !config.filter(market)) {
      continue;
    }

    const symbol = config.getSymbol(market);
    sizeDecimals.set(symbol, config.getSizeDecimals(market));
    priceDecimals.set(symbol, config.getPriceDecimals(market));
  }

  return { sizeDecimals, priceDecimals };
}

/**
 * Asset data with decimals and mark price
 */
export interface AssetData {
  sizeDecimals: number;
  priceDecimals: number;
  markPrice: string | null;
}

/**
 * Configuration for building an asset data map
 */
export interface AssetDataMapConfig<TMarket> {
  /** Function to get the symbol/name from a market */
  getSymbol: (market: TMarket) => string;
  /** Function to extract size decimals from a market */
  getSizeDecimals: (market: TMarket) => number;
  /** Function to extract price decimals from a market */
  getPriceDecimals: (market: TMarket) => number;
  /** Function to extract mark price from a market (optional) */
  getMarkPrice?: (market: TMarket) => string | null;
  /** Optional filter to exclude markets */
  filter?: (market: TMarket) => boolean;
}

/**
 * Build an asset data map with decimals and mark prices
 *
 * @example
 * const assetDataMap = buildAssetDataMap(markets, {
 *   getSymbol: (m) => m.name,
 *   getSizeDecimals: (m) => m.szDecimals,
 *   getPriceDecimals: (m) => calculatePriceDecimals(m),
 *   getMarkPrice: (m) => m.markPx,
 *   filter: (m) => !m.isDelisted,
 * });
 */
export function buildAssetDataMap<TMarket>(
  markets: TMarket[],
  config: AssetDataMapConfig<TMarket>
): Map<string, AssetData> {
  const map = new Map<string, AssetData>();

  for (const market of markets) {
    // Skip if filter returns false
    if (config.filter && !config.filter(market)) {
      continue;
    }

    const symbol = config.getSymbol(market);
    map.set(symbol, {
      sizeDecimals: config.getSizeDecimals(market),
      priceDecimals: config.getPriceDecimals(market),
      markPrice: config.getMarkPrice?.(market) ?? null,
    });
  }

  return map;
}

/**
 * Calculate decimals from a tick size or lot size string
 * e.g., "0.01" -> 2, "0.0001" -> 4, "1" -> 0
 */
export function calculateDecimalsFromString(value: string): number {
  const num = parseFloat(value);
  if (!Number.isFinite(num) || num <= 0) return 0;

  // Count decimal places in the string
  const parts = value.split('.');
  if (parts.length === 1) return 0;
  return parts[1].length;
}

/**
 * Build a simple symbol -> value map from an array
 */
export function buildSymbolMap<T, V>(
  items: T[],
  getSymbol: (item: T) => string,
  getValue: (item: T) => V
): Map<string, V> {
  const map = new Map<string, V>();
  for (const item of items) {
    map.set(getSymbol(item), getValue(item));
  }
  return map;
}
