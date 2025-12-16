/**
 * Aster provider internal types
 */

import type { AsterPositionRaw } from '../../types/aster';

/**
 * Aster position enriched with metadata
 */
export interface AsterPositionWithMeta extends AsterPositionRaw {
  /** Size decimals from exchange info */
  _sizeDecimals: number;
  /** Price decimals from exchange info */
  _priceDecimals: number;
  /** Mark price (already in raw, but typed for consistency) */
  _markPrice: number;
}
