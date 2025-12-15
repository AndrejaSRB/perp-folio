/**
 * Shared position calculation utilities
 * Used across all providers for consistent calculations
 */

export type PositionSide = 'long' | 'short';

/**
 * Calculate unrealized PnL for a position
 *
 * Long: profit when price goes up (mark - entry)
 * Short: profit when price goes down (entry - mark)
 *
 * @param side - Position side ('long' or 'short')
 * @param entryPrice - Entry price
 * @param markPrice - Current mark price
 * @param size - Position size (absolute value will be used)
 * @returns PnL value
 */
export function calculatePnl(
  side: PositionSide,
  entryPrice: number,
  markPrice: number,
  size: number
): number {
  const absSize = Math.abs(size);
  return side === 'long'
    ? (markPrice - entryPrice) * absSize
    : (entryPrice - markPrice) * absSize;
}

/**
 * Calculate position value in USD
 *
 * @param size - Position size (absolute value will be used)
 * @param price - Price to use (usually mark price)
 * @returns Position value in USD
 */
export function calculatePositionValue(size: number, price: number): number {
  return Math.abs(size) * price;
}

/**
 * Calculate margin based on position type
 *
 * @param options - Calculation options
 * @returns Calculated margin
 */
export function calculateMargin(options: {
  /** Whether position is isolated margin */
  isolated: boolean;
  /** Margin value from API (for isolated positions) */
  apiMargin: number;
  /** Position value (size * price) */
  positionValue: number;
  /** Position leverage */
  leverage: number;
}): number {
  const { isolated, apiMargin, positionValue, leverage } = options;

  // Isolated: Use actual margin from API if available
  if (isolated && apiMargin > 0) {
    return apiMargin;
  }

  // Cross: Calculate as positionValue / leverage
  if (leverage <= 0) return 0;
  return positionValue / leverage;
}

/**
 * Calculate ROI (Return on Investment) percentage
 *
 * ROI% = (PnL / Margin) × 100
 *
 * @param pnl - Unrealized PnL
 * @param margin - Margin used
 * @returns ROI percentage or null if cannot be calculated
 */
export function calculateRoi(pnl: number, margin: number): number | null {
  if (margin === 0) return null;
  return (pnl / margin) * 100;
}

/**
 * Calculate ROI with full position data
 *
 * @param options - Position data
 * @returns ROI percentage or null
 */
export function calculateRoiFull(options: {
  side: PositionSide;
  entryPrice: number;
  markPrice: number;
  size: number;
  leverage: number;
  isolated: boolean;
  apiMargin: number;
}): number | null {
  const { side, entryPrice, markPrice, size, leverage, isolated, apiMargin } = options;

  if (markPrice <= 0 || size === 0) return null;

  const pnl = calculatePnl(side, entryPrice, markPrice, size);
  const positionValue = calculatePositionValue(size, markPrice);
  const margin = calculateMargin({ isolated, apiMargin, positionValue, leverage });

  return calculateRoi(pnl, margin);
}

/**
 * Calculate leverage from initial margin fraction
 * leverage = 1 / initial_margin_fraction
 *
 * @param imf - Initial margin fraction
 * @returns Calculated leverage
 */
export function calculateLeverageFromIMF(imf: number): number {
  if (imf <= 0) return 1;
  return Math.round(1 / imf);
}

/**
 * Determine position side from signed size
 *
 * @param signedSize - Signed position size (positive = long, negative = short)
 * @returns Position side
 */
export function getSideFromSignedSize(signedSize: number): PositionSide {
  return signedSize >= 0 ? 'long' : 'short';
}

/**
 * Check if a position is zero/closed
 *
 * @param size - Position size (can be string or number)
 * @returns true if position is zero
 */
export function isZeroPosition(size: string | number): boolean {
  const numSize = typeof size === 'string' ? parseFloat(size) : size;
  return numSize === 0 || !Number.isFinite(numSize);
}

/**
 * Calculate HyperLiquid price decimals based on sig figs rule
 * https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/tick-and-lot-size
 *
 * Uses the more restrictive of: decimal limit (6 - szDecimals) or sig figs limit (5)
 *
 * @param price - The price value
 * @param szDecimals - Size decimals from asset metadata
 * @returns Number of decimal places allowed
 */
export function calculateHyperliquidPriceDecimals(
  price: number,
  szDecimals: number
): number {
  if (!Number.isFinite(price) || price === 0) return 0;

  const MAX_DECIMALS = 6;
  const MAX_SIG_FIGS = 5;

  // Decimal limit (6 - szDecimals)
  const maxPriceDecimals = Math.max(MAX_DECIMALS - szDecimals, 0);

  // Sig figs limit based on magnitude
  const magnitude = Math.floor(Math.log10(Math.abs(price)));
  const sigFigDecimals = Math.max(0, MAX_SIG_FIGS - magnitude - 1);

  return Math.min(maxPriceDecimals, sigFigDecimals);
}
