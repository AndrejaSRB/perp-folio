/**
 * HyperLiquid provider - EVM perpetuals DEX
 */

import type { HyperliquidAssetPosition } from '../../types';
import { createProvider } from '../base';
import type { HyperliquidPositionWithMeta, HyperliquidAssetData } from './types';
import { fetchClearinghouseState, buildAssetDataMap } from './api';
import { normalizePosition } from './normalizer';

// ============================================
// Provider (using factory)
// ============================================

export const hyperliquidProvider = createProvider<
  HyperliquidAssetPosition,
  HyperliquidPositionWithMeta,
  Map<string, HyperliquidAssetData>
>({
  id: 'hyperliquid',
  name: 'HyperLiquid',
  chain: 'evm',

  fetchRawPositions: fetchClearinghouseState,

  getPositionSize: (raw) => raw.position.szi,

  fetchMetadata: buildAssetDataMap,

  enrichPosition: (raw, assetDataMap) => {
    const assetData = assetDataMap.get(raw.position.coin);
    return {
      ...raw,
      _szDecimals: assetData?.szDecimals ?? 0,
      _markPx: assetData?.markPx ?? null,
    };
  },

  normalizePosition,
});

// ============================================
// Re-exports for external use
// ============================================

export type { HyperliquidPositionWithMeta, HyperliquidAssetData } from './types';
export {
  fetchPerpDexs,
  getDexNames,
  fetchMetaAndAssetCtxs,
  buildAssetDataMap,
  buildSzDecimalsMap,
  fetchClearinghouseState,
  clearHyperliquidCache,
} from './api';
export { normalizePosition, calculatePriceDecimals } from './normalizer';
