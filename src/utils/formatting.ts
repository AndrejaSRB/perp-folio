/**
 * Formatting utilities for position values
 * Based on HyperLiquid formatting rules:
 * https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/tick-and-lot-size
 */

import type { NormalizedPosition } from '../types';

// ============================================
// String-based math utilities (no floating point errors)
// ============================================

/**
 * Clean and normalize a decimal string
 */
const formatDecimalString = (value: string): string => {
  return value
    .trim()
    .replace(/^(-?)0+(?=\d)/, '$1') // remove leading zeros: "00123" → "123"
    .replace(/\.0*$|(\.\d+?)0+$/, '$1') // remove trailing zeros: "1.2000" → "1.2"
    .replace(/^(-?)\./, '$10.') // add leading zero: ".5" → "0.5"
    .replace(/^-?$/, '0') // empty → "0"
    .replace(/^-0$/, '0'); // "-0" → "0"
};

/**
 * Truncate to a certain number of decimal places (no rounding)
 */
const toFixedTruncate = (value: string, decimals: number): string => {
  if (decimals < 0) return value;

  const regex = new RegExp(`^-?(?:\\d+)?(?:\\.\\d{0,${decimals}})?`);
  const result = value.match(regex)?.[0];

  if (!result) return value;

  return formatDecimalString(result);
};

/**
 * Floor log10 (magnitude): position of most significant digit
 */
const log10Floor = (value: string): number => {
  const abs = value[0] === '-' ? value.slice(1) : value;
  const num = Number(abs);
  if (num === 0 || isNaN(num)) return -Infinity;

  const [int, dec] = abs.split('.');

  if (Number(int) !== 0) {
    const trimmed = int.replace(/^0+/, '');
    return trimmed.length - 1;
  }

  const leadingZeros = dec?.match(/^0*/)?.[0].length ?? 0;
  return -(leadingZeros + 1);
};

/**
 * Multiply by 10^exp: shift decimal point
 */
const multiplyByPow10 = (value: string, exp: number): string => {
  if (exp === 0) return formatDecimalString(value);

  const neg = value[0] === '-';
  const abs = neg ? value.slice(1) : value;
  const [intRaw, dec = ''] = abs.split('.');
  const int = intRaw || '0';

  let result: string;

  if (exp > 0) {
    if (exp >= dec.length) {
      result = int + dec + '0'.repeat(exp - dec.length);
    } else {
      result = int + dec.slice(0, exp) + '.' + dec.slice(exp);
    }
  } else {
    const absExp = -exp;
    if (absExp >= int.length) {
      result = '0.' + '0'.repeat(absExp - int.length) + int + dec;
    } else {
      result = int.slice(0, -absExp) + '.' + int.slice(-absExp) + dec;
    }
  }

  return formatDecimalString((neg ? '-' : '') + result);
};

/**
 * Get integer part (truncate decimal)
 */
const trunc = (value: string): string => {
  const dotIndex = value.indexOf('.');
  return dotIndex === -1 ? value : value.slice(0, dotIndex) || '0';
};

/**
 * Truncate to a certain number of significant figures
 */
const toPrecisionTruncate = (value: string, precision: number): string => {
  if (precision < 1) return value;
  if (/^-?0+(\.0*)?$/.test(value)) return '0';

  const neg = value[0] === '-';
  const abs = neg ? value.slice(1) : value;

  const magnitude = log10Floor(abs);
  const shiftAmount = precision - magnitude - 1;

  const shifted = multiplyByPow10(abs, shiftAmount);
  const truncated = trunc(shifted);
  const result = multiplyByPow10(truncated, -shiftAmount);

  return formatDecimalString(neg ? '-' + result : result);
};

// ============================================
// Public formatting functions
// ============================================

/**
 * Format a number to a specific number of decimal places (truncate, no rounding)
 * @param value - The string value to format
 * @param decimals - Number of decimal places
 * @returns Formatted string
 */
export const formatDecimals = (value: string, decimals: number): string => {
  return toFixedTruncate(value, decimals);
};

/**
 * Format size according to HyperLiquid rules:
 * - Truncate decimal places to szDecimals
 *
 * @param size - The size to format
 * @param szDecimals - The size decimals of the asset
 */
export const formatSize = (size: string, szDecimals: number): string => {
  return toFixedTruncate(size, szDecimals);
};

/**
 * Format price according to HyperLiquid rules:
 * - Maximum 5 significant figures
 * - Maximum (6 - szDecimals) decimal places for perp
 * - Integer prices are always allowed regardless of significant figures
 *
 * @param price - The price to format
 * @param szDecimals - The size decimals of the asset
 */
export const formatPrice = (price: string, szDecimals: number): string => {
  const trimmed = price.trim();

  // Integer prices are always allowed
  if (/^-?\d+$/.test(trimmed)) return formatDecimalString(trimmed);

  // Apply decimal limit: max 6 - szDecimals
  const maxDecimals = Math.max(6 - szDecimals, 0);
  let result = toFixedTruncate(trimmed, maxDecimals);

  // Apply sig figs limit: max 5 significant figures
  result = toPrecisionTruncate(result, 5);

  return result;
};

/**
 * Format position size using the position's sizeDecimals
 */
export const formatPositionSize = (position: NormalizedPosition): string => {
  return formatSize(position.size, position.sizeDecimals);
};

/**
 * Format position entry price using the position's priceDecimals
 */
export const formatPositionEntryPrice = (position: NormalizedPosition): string => {
  return formatDecimals(position.entryPrice, position.priceDecimals);
};

/**
 * Format position mark price using the position's priceDecimals
 */
export const formatPositionMarkPrice = (position: NormalizedPosition): string | null => {
  if (position.markPrice === null) return null;
  return formatDecimals(position.markPrice, position.priceDecimals);
};

/**
 * Format position liquidation price using the position's priceDecimals
 */
export const formatPositionLiquidationPrice = (position: NormalizedPosition): string | null => {
  if (position.liquidationPrice === null) return null;
  return formatDecimals(position.liquidationPrice, position.priceDecimals);
};

/**
 * Format PnL value with 2 decimal places (USD)
 */
export const formatPnl = (value: string): string => {
  return formatDecimals(value, 2);
};

/**
 * Format position unrealized PnL
 */
export const formatPositionUnrealizedPnl = (position: NormalizedPosition): string => {
  return formatPnl(position.unrealizedPnl);
};

/**
 * Format position realized PnL
 */
export const formatPositionRealizedPnl = (position: NormalizedPosition): string | null => {
  if (position.realizedPnl === null) return null;
  return formatPnl(position.realizedPnl);
};

/**
 * Format margin with 2 decimal places (USD)
 */
export const formatPositionMargin = (position: NormalizedPosition): string => {
  return formatDecimals(position.margin, 2);
};

/**
 * Format price fields in a position (entryPrice, markPrice, liquidationPrice)
 * Returns a new position object with formatted price fields
 */
export const formatPositionPrices = (position: NormalizedPosition): NormalizedPosition => {
  return {
    ...position,
    entryPrice: formatDecimals(position.entryPrice, position.priceDecimals),
    markPrice: position.markPrice
      ? formatDecimals(position.markPrice, position.priceDecimals)
      : null,
    liquidationPrice: position.liquidationPrice
      ? formatDecimals(position.liquidationPrice, position.priceDecimals)
      : null,
  };
};

/**
 * Format price fields for multiple positions
 */
export const formatPositionsPrices = (positions: NormalizedPosition[]): NormalizedPosition[] => {
  return positions.map(formatPositionPrices);
};

/**
 * Full formatted position type (all values formatted)
 */
export interface FormattedPosition {
  id: string;
  provider: string;
  wallet: string;
  symbol: string;
  side: 'long' | 'short';
  size: string;
  entryPrice: string;
  markPrice: string | null;
  unrealizedPnl: string;
  realizedPnl: string | null;
  leverage: number;
  leverageType: 'cross' | 'isolated';
  liquidationPrice: string | null;
  margin: string;
  maxLeverage: number | null;
  fundingAccrued: string | null;
  timestamp: number;
}

/**
 * Format all position values using appropriate decimals
 */
export const formatPosition = (position: NormalizedPosition): FormattedPosition => {
  return {
    id: position.id,
    provider: position.provider,
    wallet: position.wallet,
    symbol: position.symbol,
    side: position.side,
    size: formatPositionSize(position),
    entryPrice: formatPositionEntryPrice(position),
    markPrice: formatPositionMarkPrice(position),
    unrealizedPnl: formatPositionUnrealizedPnl(position),
    realizedPnl: formatPositionRealizedPnl(position),
    leverage: position.leverage,
    leverageType: position.leverageType,
    liquidationPrice: formatPositionLiquidationPrice(position),
    margin: formatPositionMargin(position),
    maxLeverage: position.maxLeverage,
    fundingAccrued: position.fundingAccrued ? formatDecimals(position.fundingAccrued, 4) : null,
    timestamp: position.timestamp,
  };
};

/**
 * Format multiple positions (all values)
 */
export const formatPositions = (positions: NormalizedPosition[]): FormattedPosition[] => {
  return positions.map(formatPosition);
};
