import type { NormalizedPosition } from '../../types';
import type { LighterPositionWithMeta } from './types';

/**
 * Normalize Lighter position to standard format
 */
export const normalizePosition = (
  raw: LighterPositionWithMeta,
  wallet: string
): NormalizedPosition => {
  // Calculate leverage from initial margin fraction
  // leverage = 1 / initial_margin_fraction
  const imf = parseFloat(raw.initial_margin_fraction);
  const leverage = imf > 0 ? Math.round(1 / imf) : 1;

  const size = parseFloat(raw.position);

  // Calculate sizeUsd if we have mark price
  let sizeUsd: string | null = null;
  if (raw._markPrice) {
    const markPrice = parseFloat(raw._markPrice);
    sizeUsd = (size * markPrice).toString();
  }

  // Calculate ROI: (unrealizedPnl / margin) * 100
  let roi: string | null = null;
  const margin = parseFloat(raw.allocated_margin);
  const unrealizedPnl = parseFloat(raw.unrealized_pnl);
  if (margin > 0) {
    roi = ((unrealizedPnl / margin) * 100).toString();
  }

  return {
    id: `lighter-${wallet}-${raw.symbol}`,
    provider: 'lighter',
    wallet,
    symbol: raw.symbol,
    side: raw.sign === 1 ? 'long' : 'short',
    size: raw.position,
    sizeUsd,
    entryPrice: raw.avg_entry_price,
    markPrice: raw._markPrice,
    unrealizedPnl: raw.unrealized_pnl,
    realizedPnl: raw.realized_pnl,
    roi,
    leverage,
    leverageType: raw.margin_mode === 1 ? 'isolated' : 'cross',
    liquidationPrice: raw.liquidation_price,
    margin: raw.allocated_margin,
    maxLeverage: null,
    fundingAccrued: raw.total_funding_paid_out ?? null,
    timestamp: Date.now(),
    sizeDecimals: raw._sizeDecimals,
    priceDecimals: raw._priceDecimals,
  };
};
