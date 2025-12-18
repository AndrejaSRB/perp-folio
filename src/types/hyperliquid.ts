// HyperLiquid API Response Types
// Docs: https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/info-endpoint

/** Perp DEX info from perpDexs endpoint */
export interface HyperliquidPerpDex {
  name: string;
  fullName: string;
  deployer: string;
  oracleUpdater: string | null;
  feeRecipient: string;
  assetToStreamingOiCap: [string, string][];
}

/** Asset metadata from metaAndAssetCtxs endpoint */
export interface HyperliquidAssetMeta {
  name: string;
  szDecimals: number;
  maxLeverage: number;
  marginTableId: number;
  onlyIsolated?: boolean;
  isDelisted?: boolean;
  marginMode?: string;
}

/** Asset context (current state) from metaAndAssetCtxs endpoint */
export interface HyperliquidAssetCtx {
  funding: string;
  openInterest: string;
  prevDayPx: string;
  dayNtlVlm: string;
  premium: string;
  oraclePx: string;
  markPx: string;
  midPx: string;
  impactPxs: [string, string];
}

/** Response from metaAndAssetCtxs endpoint */
export interface HyperliquidMetaAndAssetCtxs {
  universe: HyperliquidAssetMeta[];
  assetCtxs?: HyperliquidAssetCtx[];
}

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
  /** Liquidation price */
  liquidationPx: string;
  marginUsed: string;
  maxLeverage: number;
  /** Position value in USD */
  positionValue: string;
  /** Return on equity (ROI) as decimal (e.g., 0.05 = 5%) */
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

// ============================================
// WebSocket Types for allDexsClearinghouseState
// ============================================

/**
 * WebSocket subscription message for allDexsClearinghouseState
 */
export interface HyperliquidWsSubscription {
  type: 'allDexsClearinghouseState';
  user: string;
}

/**
 * Individual DEX clearinghouse state tuple
 * [dexName, clearinghouseState] where dexName is "" for main perp
 */
export type HyperliquidDexStateTuple = [string, HyperliquidClearinghouseState];

/**
 * WebSocket event data for allDexsClearinghouseState
 */
export interface HyperliquidAllDexsClearinghouseData {
  user: string;
  clearinghouseStates: HyperliquidDexStateTuple[];
}

/**
 * WebSocket message for allDexsClearinghouseState channel
 */
export interface HyperliquidAllDexsWsMessage {
  channel: 'allDexsClearinghouseState';
  data: HyperliquidAllDexsClearinghouseData;
}

/**
 * Combined clearinghouse state from all DEXs
 */
export interface HyperliquidCombinedClearinghouseState {
  /** Aggregated margin summary across all DEXs */
  marginSummary: HyperliquidMarginSummary;
  /** Aggregated cross margin summary across all DEXs */
  crossMarginSummary: HyperliquidMarginSummary;
  /** Sum of cross maintenance margin used across all DEXs */
  crossMaintenanceMarginUsed: string;
  /** Sum of withdrawable across all DEXs */
  withdrawable: string;
  /** Combined positions from all DEXs */
  assetPositions: HyperliquidAssetPosition[];
  /** Most recent time from all DEXs */
  time: number;
}
