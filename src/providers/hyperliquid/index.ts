import type { DexProvider } from '../types';
import type { HyperliquidPositionWithMeta } from './types';
import {
  fetchClearinghouseState,
  buildAssetDataMap,
} from './api';
import { normalizePosition } from './normalizer';

// ============================================
// Provider export
// ============================================

export const hyperliquidProvider: DexProvider<HyperliquidPositionWithMeta> = {
  id: 'hyperliquid',
  name: 'HyperLiquid',
  chain: 'evm',

  fetchPositions: async (address: string): Promise<HyperliquidPositionWithMeta[]> => {
    // First fetch positions
    const positions = await fetchClearinghouseState(address);

    // Filter out zero positions
    const nonZeroPositions = positions.filter(
      (p) => parseFloat(p.position.szi) !== 0
    );

    // Only fetch metadata if there are positions
    if (nonZeroPositions.length === 0) {
      return [];
    }

    // Fetch metadata for enrichment (includes szDecimals and markPx)
    const assetDataMap = await buildAssetDataMap();

    // Enrich with metadata
    return nonZeroPositions.map((p) => {
      const assetData = assetDataMap.get(p.position.coin);
      return {
        ...p,
        _szDecimals: assetData?.szDecimals ?? 0,
        _markPx: assetData?.markPx ?? null,
      };
    });
  },

  normalizePosition,
};

// Re-export everything for external use
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
