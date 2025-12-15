// HyperLiquid API Response Types
// Docs: https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/info-endpoint

export interface HyperliquidLeverage {
  rawUsd: string;
  type: 'isolated' | 'cross';
  value: number;
}

export interface HyperliquidCumFunding {
  allTime: string;
  sinceChange: string;
  sinceOpen: string;
}

export interface HyperliquidPositionData {
  coin: string;
  cumFunding: HyperliquidCumFunding;
  entryPx: string;
  leverage: HyperliquidLeverage;
  liquidationPx: string | null;
  marginUsed: string;
  maxLeverage: number;
  positionValue: string;
  returnOnEquity: string;
  /** Signed position size: positive = long, negative = short */
  szi: string;
  unrealizedPnl: string;
}

export interface HyperliquidAssetPosition {
  position: HyperliquidPositionData;
  type: 'oneWay';
}

export interface HyperliquidMarginSummary {
  accountValue: string;
  totalMarginUsed: string;
  totalNtlPos: string;
  totalRawUsd: string;
}

export interface HyperliquidClearinghouseState {
  assetPositions: HyperliquidAssetPosition[];
  crossMaintenanceMarginUsed: string;
  crossMarginSummary: HyperliquidMarginSummary;
  marginSummary: HyperliquidMarginSummary;
  time: number;
  withdrawable: string;
}
