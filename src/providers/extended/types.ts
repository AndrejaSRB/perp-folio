/**
 * Extended provider internal types
 */

import type { ExtendedPositionRaw } from '../../types/extended';

/**
 * Extended position enriched with metadata
 */
export interface ExtendedPositionWithMeta extends ExtendedPositionRaw {
  /** Size decimals from market info */
  _sizeDecimals: number;
  /** Price decimals from market info */
  _priceDecimals: number;
  /** Max leverage for this market */
  _maxLeverage: number | null;
}
