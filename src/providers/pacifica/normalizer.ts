import type { NormalizedPosition } from '../../types';
import { normalizeSide } from '../../utils/chains';
import type { PacificaPositionWithContext } from './types';
import { calculatePnl, calculatePositionValue, calculateMarginUsed, calculateRoi } from './utils';

/**
 * Normalize Pacifica position to standard format
 */
export const normalizePosition = (
  raw: PacificaPositionWithContext,
  wallet: string
): NormalizedPosition => {
  const side = normalizeSide(raw.side);
  const amount = parseFloat(raw.amount);
  const entryPrice = parseFloat(raw.entry_price);
  const apiMargin = parseFloat(raw.margin);

  // Calculate values if we have mark price
  let sizeUsd: string | null = null;
  let unrealizedPnl = '0';
  let roi: string | null = null;

  if (raw._markPrice) {
    const markPrice = parseFloat(raw._markPrice);

    // Calculate position value (size in USD)
    const positionValue = calculatePositionValue(amount, markPrice);
    sizeUsd = positionValue.toString();

    // Calculate unrealized PnL
    const pnl = calculatePnl(side, entryPrice, markPrice, amount);
    unrealizedPnl = pnl.toString();

    // Calculate ROI using the correct margin:
    // - Isolated: Use actual margin from API
    // - Cross: Calculate as positionValue / leverage
    const roiValue = calculateRoi(
      side,
      entryPrice,
      markPrice,
      amount,
      raw._leverage,
      raw.isolated,
      apiMargin
    );
    roi = roiValue !== null ? roiValue.toString() : null;
  }

  // Calculate margin used for the response
  // Use mark price if available, otherwise entry price
  const priceForMargin = raw._markPrice ? parseFloat(raw._markPrice) : entryPrice;
  const positionValue = calculatePositionValue(amount, priceForMargin);
  const marginUsed = calculateMarginUsed(raw.isolated, apiMargin, positionValue, raw._leverage);

  return {
    id: `pacifica-${wallet}-${raw.symbol}`,
    provider: 'pacifica',
    wallet,
    symbol: raw.symbol,
    side,
    size: raw.amount,
    sizeUsd,
    entryPrice: raw.entry_price,
    markPrice: raw._markPrice,
    unrealizedPnl,
    realizedPnl: null,
    roi,
    leverage: raw._leverage,
    leverageType: raw.isolated ? 'isolated' : 'cross',
    liquidationPrice: raw.liquidation_price,
    margin: marginUsed.toString(),
    maxLeverage: raw._maxLeverage,
    fundingAccrued: raw.funding,
    timestamp: raw.updated_at,
    sizeDecimals: raw._sizeDecimals,
    priceDecimals: raw._priceDecimals,
  };
};
