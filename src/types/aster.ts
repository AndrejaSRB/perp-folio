/**
 * Aster DEX API types
 * https://fapi.asterdex.com
 */

// ============================================
// Credentials
// ============================================

export interface AsterCredentials {
  apiKey: string;
  apiSecret: string;
}

// ============================================
// Raw API Response Types
// ============================================

/**
 * Raw position from /fapi/v2/positionRisk
 */
export interface AsterPositionRaw {
  symbol: string;
  positionAmt: string;
  entryPrice: string;
  markPrice: string;
  unRealizedProfit: string;
  liquidationPrice: string;
  leverage: string;
  marginType: string;
  positionSide: 'BOTH' | 'LONG' | 'SHORT';
  notional: string;
  isolatedMargin: string;
  isAutoAddMargin: string;
  updateTime: number;
}

/**
 * Symbol info from /fapi/v1/exchangeInfo
 */
export interface AsterSymbolInfoRaw {
  symbol: string;
  pricePrecision: number;
  quantityPrecision: number;
  filters: Array<{
    filterType: string;
    tickSize?: string;
    stepSize?: string;
    minQty?: string;
    maxQty?: string;
    notional?: string;
  }>;
}

/**
 * Mark price from /fapi/v1/premiumIndex
 */
export interface AsterMarkPriceRaw {
  symbol: string;
  markPrice: string;
  indexPrice: string;
  lastFundingRate: string;
  nextFundingTime: number;
  time: number;
}

/**
 * Exchange info response
 */
export interface AsterExchangeInfoResponse {
  symbols: AsterSymbolInfoRaw[];
}
