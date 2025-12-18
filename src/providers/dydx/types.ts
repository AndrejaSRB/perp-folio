/**
 * dYdX provider internal types
 */

import type { DydxPerpetualPosition } from '../../types/dydx';

/**
 * dYdX position enriched with metadata
 */
export interface DydxPositionWithMeta extends DydxPerpetualPosition {
  /** Size decimals from market metadata */
  _sizeDecimals: number;
  /** Price decimals from market metadata */
  _priceDecimals: number;
  /** Current mark price from market data */
  _markPrice: string | null;
  /** Maintenance margin fraction for this market */
  _maintenanceMarginFraction: number;
  /** Initial margin fraction for this market (used to calculate max leverage) */
  _initialMarginFraction: number;
  /** Account equity (needed for cross-margin liquidation calculation) */
  _accountEquity: number;
  /** Total maintenance margin required by OTHER positions (for available equity calc) */
  _otherPositionsMaintenanceMargin: number;
  /** Total margin used across all positions (equity - freeCollateral) */
  _totalMarginUsed: number;
  /** Total notional across all positions */
  _totalNotional: number;
}
