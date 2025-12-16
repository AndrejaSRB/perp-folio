/**
 * Extended provider - Starknet perpetuals DEX with API authentication
 */

import type { ExtendedCredentials } from '../../types/extended';
import type { DexProvider } from '../types';
import type { ExtendedPositionWithMeta } from './types';
import { fetchPositions as fetchPositionsRaw, fetchMarkets, buildDecimalsMap } from './api';
import { normalizePosition } from './normalizer';
import { isZeroPosition } from '../../utils/positionCalc';

// ============================================
// Provider
// ============================================

/**
 * Extended provider with API authentication
 * Requires API key for fetching positions
 */
export const extendedProvider: DexProvider<ExtendedPositionWithMeta> = {
  id: 'extended',
  name: 'Extended',
  chain: 'evm', // Starknet-based but uses EVM-style addresses
  requiresCredentials: true,

  async fetchPositions(
    _address: string, // Ignored - Extended uses API credentials
    credentials?: unknown
  ): Promise<ExtendedPositionWithMeta[]> {
    // Cast credentials to expected type
    const creds = credentials as ExtendedCredentials | undefined;

    // Validate credentials - return empty if missing (error handled by hook)
    if (!creds?.apiKey) {
      return [];
    }

    // Step 1: Fetch raw positions (authenticated request)
    const rawPositions = await fetchPositionsRaw(creds);

    // Step 2: Filter zero positions
    const nonZeroPositions = rawPositions.filter(
      (p) => !isZeroPosition(p.size)
    );

    // Step 3: Early return if no positions
    if (nonZeroPositions.length === 0) {
      return [];
    }

    // Step 4: Fetch metadata in parallel (public, cached)
    const [decimalsMap, markets] = await Promise.all([
      buildDecimalsMap(),
      fetchMarkets(),
    ]);

    // Build max leverage map from markets
    const maxLeverageMap = new Map<string, number>();
    for (const market of markets) {
      maxLeverageMap.set(market.name, parseFloat(market.tradingConfig.maxLeverage));
    }

    // Step 5: Enrich positions with metadata
    return nonZeroPositions.map((p) => ({
      ...p,
      _sizeDecimals: decimalsMap.sizeDecimals.get(p.market) ?? 0,
      _priceDecimals: decimalsMap.priceDecimals.get(p.market) ?? 2,
      _maxLeverage: maxLeverageMap.get(p.market) ?? null,
    }));
  },

  normalizePosition,
};

// ============================================
// Re-exports for external use
// ============================================

export type { ExtendedPositionWithMeta } from './types';
export {
  fetchMarkets,
  fetchPositions,
  fetchBalance,
  buildDecimalsMap,
  clearExtendedCache,
} from './api';
export { normalizePosition } from './normalizer';
