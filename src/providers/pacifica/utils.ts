/**
 * Calculate unrealized PnL for a position
 *
 * Short: profit when price goes down (entry - mark)
 * Long: profit when price goes up (mark - entry)
 *
 * @param side - Position side ('long' or 'short')
 * @param entryPrice - Entry price
 * @param markPrice - Current mark price
 * @param amount - Position size (absolute value will be used)
 * @returns PnL value
 */
export const calculatePnl = (
  side: 'long' | 'short',
  entryPrice: number,
  markPrice: number,
  amount: number
): number => {
  const absAmount = Math.abs(amount);
  return side === 'long'
    ? (markPrice - entryPrice) * absAmount
    : (entryPrice - markPrice) * absAmount;
};

/**
 * Calculate position value
 *
 * @param amount - Position size (absolute value will be used)
 * @param markPrice - Current mark price
 * @returns Position value in USD
 */
export const calculatePositionValue = (
  amount: number,
  markPrice: number
): number => {
  return Math.abs(amount) * markPrice;
};

/**
 * Calculate margin used for a position
 *
 * - Isolated: Use actual margin from API (if > 0)
 * - Cross: Calculate as positionValue / leverage
 *
 * @param isolated - Whether position is isolated margin
 * @param apiMargin - Margin value from API
 * @param positionValue - Position value (amount * markPrice)
 * @param leverage - Position leverage
 * @returns Margin used
 */
export const calculateMarginUsed = (
  isolated: boolean,
  apiMargin: number,
  positionValue: number,
  leverage: number
): number => {
  if (isolated && apiMargin > 0) {
    return apiMargin;
  }
  if (leverage <= 0) return 0;
  return positionValue / leverage;
};

/**
 * Calculate ROI/ROE (Return on Equity) percentage for a position
 *
 * ROI% = (PnL / MarginUsed) × 100
 *
 * Where:
 * - PnL = (markPrice - entryPrice) × amount (for long)
 * - PnL = (entryPrice - markPrice) × amount (for short)
 * - MarginUsed = apiMargin (for isolated) or positionValue / leverage (for cross)
 *
 * @param side - Position side ('long' or 'short')
 * @param entryPrice - Entry price
 * @param markPrice - Current mark price
 * @param amount - Position size
 * @param leverage - Position leverage
 * @param isolated - Whether position is isolated margin
 * @param apiMargin - Margin value from API
 * @returns ROI percentage or null if cannot be calculated
 */
export const calculateRoi = (
  side: 'long' | 'short',
  entryPrice: number,
  markPrice: number,
  amount: number,
  leverage: number,
  isolated: boolean,
  apiMargin: number
): number | null => {
  if (markPrice <= 0 || amount === 0) {
    return null;
  }

  const pnl = calculatePnl(side, entryPrice, markPrice, amount);
  const positionValue = calculatePositionValue(amount, markPrice);
  const marginUsed = calculateMarginUsed(isolated, apiMargin, positionValue, leverage);

  if (marginUsed === 0) {
    return null;
  }

  return (pnl / marginUsed) * 100;
};
