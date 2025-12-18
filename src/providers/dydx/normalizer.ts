/**
 * dYdX position normalizer
 */

import type { NormalizedPosition } from '../../types';
import type { DydxPositionWithMeta } from './types';

/**
 * Calculate liquidation price for a dYdX position
 *
 * Uses Total Equity approach for cross-margin:
 * - availableEquity = totalEquity - otherPositionsMaintenanceMargin
 * - Long: liqPrice = (entryPrice * size - availableEquity) / (size * (1 - mmf))
 * - Short: liqPrice = (availableEquity + entryPrice * size) / (size * (1 + mmf))
 *
 * Returns null if liquidation price is <= 0 (impossible to reach)
 */
const calculateLiquidationPrice = (
  side: 'LONG' | 'SHORT',
  size: number,
  entryPrice: number,
  availableEquity: number,
  maintenanceMarginFraction: number
): string | null => {
  if (size === 0 || availableEquity <= 0) {
    return null;
  }

  let liquidationPrice: number;

  if (side === 'LONG') {
    // Long: liquidation when price drops
    // liqPrice = (entryPrice * size - availableEquity) / (size * (1 - mmf))
    const denominator = size * (1 - maintenanceMarginFraction);
    if (denominator === 0) return null;
    liquidationPrice = (entryPrice * size - availableEquity) / denominator;
  } else {
    // Short: liquidation when price rises
    // liqPrice = (availableEquity + entryPrice * size) / (size * (1 + mmf))
    const denominator = size * (1 + maintenanceMarginFraction);
    if (denominator === 0) return null;
    liquidationPrice = (availableEquity + entryPrice * size) / denominator;
  }

  // Return null if liquidation price is <= 0 (impossible)
  if (liquidationPrice <= 0) {
    return null;
  }

  return liquidationPrice.toString();
};

/**
 * Normalize dYdX position to standard format
 */
export const normalizePosition = (
  raw: DydxPositionWithMeta,
  wallet: string
): NormalizedPosition => {
  const size = parseFloat(raw.size);
  const absSize = Math.abs(size);
  const entryPrice = parseFloat(raw.entryPrice);
  const markPrice = raw._markPrice ? parseFloat(raw._markPrice) : null;

  // Calculate size in USD (notional value)
  const notional = markPrice ? absSize * markPrice : absSize * entryPrice;
  const sizeUsd = notional.toString();

  // Calculate unrealized PnL
  const unrealizedPnl = parseFloat(raw.unrealizedPnl ?? '0');

  // For cross-margin, use proportional margin allocation for leverage:
  // - positionShare = positionNotional / totalNotional
  // - positionMargin = positionShare * totalMarginUsed
  // - leverage = positionNotional / positionMargin
  let leverage = 1;
  let positionMargin = 0;

  if (raw._totalNotional > 0 && raw._totalMarginUsed > 0) {
    const positionShare = notional / raw._totalNotional;
    positionMargin = positionShare * raw._totalMarginUsed;
    leverage = positionMargin > 0 ? notional / positionMargin : 1;
  }

  // Margin for display: use proportional margin (position's share)
  const margin = positionMargin > 0 ? positionMargin.toString() : raw._accountEquity.toString();

  // Calculate ROI based on position's proportional margin
  const roi = positionMargin > 0 ? ((unrealizedPnl / positionMargin) * 100).toString() : '0';

  // Calculate liquidation price using Total Equity approach:
  // availableEquity = totalEquity - otherPositionsMaintenanceMargin
  const availableEquity = raw._accountEquity - raw._otherPositionsMaintenanceMargin;
  const liquidationPrice = availableEquity > 0
    ? calculateLiquidationPrice(
        raw.side,
        absSize,
        entryPrice,
        availableEquity,
        raw._maintenanceMarginFraction
      )
    : null;

  return {
    id: `dydx-${wallet}-${raw.market}`,
    provider: 'dydx',
    wallet,
    symbol: raw.market.replace('-USD', ''), // "BTC-USD" -> "BTC"
    side: raw.side === 'LONG' ? 'long' : 'short',
    size: absSize.toString(),
    sizeUsd,
    entryPrice: raw.entryPrice,
    markPrice: raw._markPrice,
    unrealizedPnl: raw.unrealizedPnl,
    realizedPnl: raw.realizedPnl,
    roi,
    leverage,
    leverageType: 'cross', // dYdX v4 uses cross margin
    liquidationPrice,
    margin,
    maxLeverage: raw._initialMarginFraction > 0 ? 1 / raw._initialMarginFraction : 20,
    fundingAccrued: raw.netFunding,
    timestamp: new Date(raw.createdAt).getTime(),
    sizeDecimals: raw._sizeDecimals,
    priceDecimals: raw._priceDecimals,
  };
};
