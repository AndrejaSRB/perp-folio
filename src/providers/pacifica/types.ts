import type { PacificaPosition } from '../../types';

/**
 * Extended type with enriched context (internal fields prefixed with _)
 */
export interface PacificaPositionWithContext extends PacificaPosition {
  _leverage: number;
  _maxLeverage: number | null;
  _markPrice: string | null;
  _sizeDecimals: number;
  _priceDecimals: number;
}
