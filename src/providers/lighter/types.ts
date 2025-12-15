import type { LighterPosition } from '../../types';

/**
 * Extended position type with metadata
 */
export interface LighterPositionWithMeta extends LighterPosition {
  _sizeDecimals: number;
  _priceDecimals: number;
  _markPrice: string | null;
}
