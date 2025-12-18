/**
 * dYdX v4 API types
 */

// ============================================
// Position types
// ============================================

export interface DydxPerpetualPosition {
  market: string;
  status: 'OPEN' | 'CLOSED' | 'LIQUIDATED';
  side: 'LONG' | 'SHORT';
  size: string;
  maxSize: string;
  entryPrice: string;
  exitPrice: string | null;
  realizedPnl: string;
  unrealizedPnl: string;
  createdAt: string;
  createdAtHeight: string;
  closedAt: string | null;
  sumOpen: string;
  sumClose: string;
  netFunding: string;
  subaccountNumber: number;
}

export interface DydxPositionsResponse {
  positions: DydxPerpetualPosition[];
}

// ============================================
// Subaccount types
// ============================================

export interface DydxSubaccount {
  address: string;
  subaccountNumber: number;
  equity: string;
  freeCollateral: string;
  openPerpetualPositions: Record<string, DydxPerpetualPosition>;
}

export interface DydxSubaccountResponse {
  subaccount: DydxSubaccount;
}

// ============================================
// Market types
// ============================================

export interface DydxPerpetualMarket {
  clobPairId: string;
  ticker: string;
  status: string;
  oraclePrice: string;
  priceChange24H: string;
  volume24H: string;
  trades24H: number;
  nextFundingRate: string;
  initialMarginFraction: string;
  maintenanceMarginFraction: string;
  stepBaseQuantums: number;
  subticksPerTick: number;
  stepSize: string;
  tickSize: string;
  atomicResolution: number;
  quantumConversionExponent: number;
}

export interface DydxMarketsResponse {
  markets: Record<string, DydxPerpetualMarket>;
}

// ============================================
// Historical PnL types
// ============================================

export interface DydxHistoricalPnlTick {
  equity: string;
  totalPnl: string;
  netTransfers: string;
  createdAt: string;
  blockHeight: string;
  blockTime: string;
}

export interface DydxHistoricalPnlResponse {
  historicalPnl: DydxHistoricalPnlTick[];
}

// ============================================
// Fill types (for volume calculation)
// ============================================

export interface DydxFill {
  id: string;
  side: 'BUY' | 'SELL';
  liquidity: 'TAKER' | 'MAKER';
  type: string;
  market: string;
  price: string;
  size: string;
  fee: string;
  createdAt: string;
  createdAtHeight: string;
  orderId: string;
  clientMetadata: string;
  subaccountNumber: number;
}

export interface DydxFillsResponse {
  fills: DydxFill[];
}
