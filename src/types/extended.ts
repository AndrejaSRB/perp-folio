/**
 * Extended DEX API types
 * https://api.docs.extended.exchange
 */

// ============================================
// Credentials
// ============================================

export interface ExtendedCredentials {
  apiKey: string;
}

// ============================================
// Raw API Response Types
// ============================================

/**
 * Raw position from /user/positions
 */
export interface ExtendedPositionRaw {
  id: number;
  accountId: number;
  market: string;
  side: 'LONG' | 'SHORT';
  leverage: string;
  size: string;
  value: string;
  openPrice: string;
  markPrice: string;
  liquidationPrice: string;
  margin: string;
  unrealisedPnl: string;
  realisedPnl: string;
  maxPositionSize: string;
  createdTime: number;
  updatedTime: number;
}

/**
 * Market info from /info/markets
 */
export interface ExtendedMarketRaw {
  name: string;
  assetName: string;
  assetPrecision: number;
  collateralAssetName: string;
  collateralAssetPrecision: number;
  active: boolean;
  status: 'ACTIVE' | 'REDUCE_ONLY' | 'DELISTED' | 'PRELISTED' | 'DISABLED';
  tradingConfig: {
    maxLeverage: string;
  };
}

/**
 * API response wrapper
 */
export interface ExtendedApiResponse<T> {
  status: 'OK' | 'ERROR';
  data?: T;
  error?: {
    message: string;
  };
}

/**
 * Balance info from /user/balance
 */
export interface ExtendedBalanceRaw {
  collateralName: string;
  balance: string;
  equity: string;
  availableForTrade: string;
  availableForWithdrawal: string;
  unrealisedPnl: string;
  initialMargin: string;
  marginRatio: string;
  exposure: string;
  leverage: string;
  updatedTime: number;
}
