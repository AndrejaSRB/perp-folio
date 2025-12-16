/**
 * Extended position normalizer
 */

import type { NormalizedPosition } from '../../types/common';
import type { ExtendedPositionWithMeta } from './types';
import { calculateRoi } from '../../utils/positionCalc';

/**
 * Normalize an Extended position to the standard format
 */
export function normalizePosition(
  position: ExtendedPositionWithMeta,
  wallet: string // For Extended, this will be the API key
): NormalizedPosition {
  const size = parseFloat(position.size);
  const markPrice = parseFloat(position.markPrice);
  const entryPrice = parseFloat(position.openPrice);
  const unrealizedPnl = parseFloat(position.unrealisedPnl);
  const realizedPnl = parseFloat(position.realisedPnl);
  const leverage = parseFloat(position.leverage);
  const margin = parseFloat(position.margin);
  const notional = parseFloat(position.value);
  const liquidationPrice = position.liquidationPrice
    ? parseFloat(position.liquidationPrice)
    : null;

  // Side is already provided as LONG/SHORT
  const side = position.side.toLowerCase() as 'long' | 'short';

  // ROI calculation
  const roi = calculateRoi(unrealizedPnl, margin);

  return {
    id: `extended-${wallet}-${position.market}`,
    provider: 'extended',
    wallet,
    symbol: position.market,
    side,
    size: size.toString(),
    sizeUsd: notional.toString(),
    entryPrice: entryPrice.toString(),
    markPrice: markPrice.toString(),
    unrealizedPnl: unrealizedPnl.toString(),
    realizedPnl: realizedPnl.toString(),
    roi: roi !== null ? roi.toString() : null,
    leverage,
    leverageType: 'cross', // Extended uses cross margin
    liquidationPrice: liquidationPrice !== null ? liquidationPrice.toString() : null,
    margin: margin.toString(),
    maxLeverage: position._maxLeverage,
    fundingAccrued: null, // Not available in position response
    timestamp: position.updatedTime,
    sizeDecimals: position._sizeDecimals,
    priceDecimals: position._priceDecimals,
  };
}
