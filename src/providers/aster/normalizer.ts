/**
 * Aster position normalizer
 */

import type { NormalizedPosition } from '../../types/common';
import type { AsterPositionWithMeta } from './types';
import { getSideFromSignedSize, calculateRoi } from '../../utils/positionCalc';

/**
 * Normalize an Aster position to the standard format
 */
export function normalizePosition(
  position: AsterPositionWithMeta,
  wallet: string // For Aster, this will be the API key
): NormalizedPosition {
  const size = parseFloat(position.positionAmt);
  const absSize = Math.abs(size);
  const markPrice = parseFloat(position.markPrice);
  const entryPrice = parseFloat(position.entryPrice);
  const unrealizedPnl = parseFloat(position.unRealizedProfit);
  const leverage = parseFloat(position.leverage);
  const notional = Math.abs(parseFloat(position.notional));
  const isIsolated = position.marginType === 'isolated';
  const liquidationPrice = position.liquidationPrice
    ? parseFloat(position.liquidationPrice)
    : null;

  // Margin calculation: isolated uses isolatedMargin, cross uses notional/leverage
  const margin = isIsolated
    ? parseFloat(position.isolatedMargin)
    : notional / leverage;

  // Symbol cleanup: "BTCUSDT" -> "BTC"
  const symbol = position.symbol.replace(/USDT$/, '');

  // ROI calculation
  const roi = calculateRoi(unrealizedPnl, margin);

  return {
    id: `aster-${wallet}-${position.symbol}`,
    provider: 'aster',
    wallet,
    symbol,
    side: getSideFromSignedSize(size),
    size: absSize.toString(),
    sizeUsd: notional.toString(),
    entryPrice: entryPrice.toString(),
    markPrice: markPrice.toString(),
    unrealizedPnl: unrealizedPnl.toString(),
    realizedPnl: null, // Not available in position response
    roi: roi !== null ? roi.toString() : null,
    leverage,
    leverageType: isIsolated ? 'isolated' : 'cross',
    liquidationPrice: liquidationPrice !== null ? liquidationPrice.toString() : null,
    margin: margin.toString(),
    maxLeverage: null, // Could be fetched from exchange info if needed
    fundingAccrued: null, // Not available in position response
    timestamp: position.updateTime,
    sizeDecimals: position._sizeDecimals,
    priceDecimals: position._priceDecimals,
  };
}
