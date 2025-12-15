import type { NormalizedPosition } from '../../types';
import type { HyperliquidPositionWithMeta } from './types';

/**
 * Calculate how many decimals are allowed for a HyperLiquid perp price
 * https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/tick-and-lot-size
 *
 * Uses the more restrictive of: decimal limit (6 - szDecimals) or sig figs limit (5)
 *
 * @param value - The actual price value as a number
 * @param szDecimals - Size decimals from asset metadata
 * @returns Number of decimal places allowed for this price
 *
 * @example
 * // Large price (BTC at $103,948.5) - 6 digits, 5 sig figs = 0 decimals
 * calculatePriceDecimals(103948.5, 5) // 0
 *
 * @example
 * // Medium price ($1234.56) - decimal limit: 6-5=1, sig figs: 5-4=1
 * calculatePriceDecimals(1234.56, 5) // 1
 *
 * @example
 * // Small price ($12.345) - decimal limit wins: 6-5=1
 * calculatePriceDecimals(12.345, 5) // 1
 */
export const calculatePriceDecimals = (value: number, szDecimals: number): number => {
  // Handle invalid inputs
  if (!Number.isFinite(value) || value === 0) {
    return 0;
  }

  const MAX_DECIMALS = 6; // for perps
  const MAX_SIG_FIGS = 5;

  // Calculate decimal limit (6 - szDecimals)
  const maxPriceDecimals = Math.max(MAX_DECIMALS - szDecimals, 0);

  // Calculate sig figs limit based on magnitude
  const magnitude = Math.floor(Math.log10(Math.abs(value)));
  const sigFigDecimals = Math.max(0, MAX_SIG_FIGS - magnitude - 1);

  // Use the more restrictive limit
  return Math.min(maxPriceDecimals, sigFigDecimals);
};

/**
 * Normalize HyperLiquid position to standard format
 */
export const normalizePosition = (
  raw: HyperliquidPositionWithMeta,
  wallet: string
): NormalizedPosition => {
  const p = raw.position;
  const size = parseFloat(p.szi);
  const absSize = Math.abs(size);
  const entryPrice = parseFloat(p.entryPx);

  // Use positionValue from API for sizeUsd
  const sizeUsd = p.positionValue;

  // Use returnOnEquity from API and convert to percentage
  // API returns decimal (e.g., 0.05 = 5%), we need to multiply by 100
  const returnOnEquity = parseFloat(p.returnOnEquity);
  const roi = (returnOnEquity * 100).toString();

  return {
    id: `hyperliquid-${wallet}-${p.coin}`,
    provider: 'hyperliquid',
    wallet,
    symbol: p.coin,
    side: size >= 0 ? 'long' : 'short',
    size: absSize.toString(),
    sizeUsd,
    entryPrice: p.entryPx,
    markPrice: raw._markPx,
    unrealizedPnl: p.unrealizedPnl,
    realizedPnl: null,
    roi,
    leverage: p.leverage.value,
    leverageType: p.leverage.type,
    liquidationPrice: p.liquidationPx,
    margin: p.marginUsed,
    maxLeverage: p.maxLeverage,
    fundingAccrued: p.cumFunding.sinceOpen,
    timestamp: Date.now(),
    sizeDecimals: raw._szDecimals,
    priceDecimals: calculatePriceDecimals(entryPrice, raw._szDecimals),
  };
};
