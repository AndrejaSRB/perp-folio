import type { HyperliquidAssetPosition } from '../../types';

/**
 * Asset metadata with market data
 */
export interface HyperliquidAssetData {
  szDecimals: number;
  markPx: string | null;
}

/**
 * Extended position type with metadata
 */
export interface HyperliquidPositionWithMeta extends HyperliquidAssetPosition {
  _szDecimals: number;
  _markPx: string | null;
}
