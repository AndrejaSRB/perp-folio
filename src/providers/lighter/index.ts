/**
 * Lighter provider - EVM perpetuals DEX
 */

import type { DexProvider } from '../types';
import type { LighterPositionWithMeta } from './types';
import type { LighterCredentials } from '../../types';
import {
  fetchPositions,
  buildDecimalsMap,
  fetchMarkPrices,
} from './api';
import { normalizePosition } from './normalizer';
import { isZeroPosition } from '../../utils/positionCalc';

// ============================================
// Provider
// ============================================

/**
 * Lighter provider with custom implementation
 * Handles symbol-based mark price fetching
 * Supports optional read-only API token for authenticated access
 */
export const lighterProvider: DexProvider<LighterPositionWithMeta> = {
  id: 'lighter',
  name: 'Lighter',
  chain: 'evm',

  async fetchPositions(address: string, credentials?: unknown): Promise<LighterPositionWithMeta[]> {
    // Cast credentials to LighterCredentials if provided
    const lighterCredentials = credentials as LighterCredentials | undefined;

    // Step 1: Fetch raw positions (aggregated from all accounts)
    const rawPositions = await fetchPositions(address, lighterCredentials);

    // Step 2: Filter out zero positions
    const nonZeroPositions = rawPositions.filter(
      (p) => !isZeroPosition(p.position)
    );

    // Step 3: Early return if no positions
    if (nonZeroPositions.length === 0) {
      return [];
    }

    // Step 4: Get unique symbols for mark price fetching
    const symbols = [...new Set(nonZeroPositions.map((p) => p.symbol))];

    // Step 5: Fetch metadata and mark prices in parallel
    const [decimalsMap, markPrices] = await Promise.all([
      buildDecimalsMap(),
      fetchMarkPrices(symbols),
    ]);

    // Step 6: Enrich positions with metadata
    return nonZeroPositions.map((p) => ({
      ...p,
      _sizeDecimals: decimalsMap.sizeDecimals.get(p.symbol) ?? 0,
      _priceDecimals: decimalsMap.priceDecimals.get(p.symbol) ?? 2,
      _markPrice: markPrices.get(p.symbol) ?? null,
    }));
  },

  normalizePosition,
};

// ============================================
// Re-exports for external use
// ============================================

export type { LighterPositionWithMeta } from './types';
export {
  fetchOrderBooks,
  fetchOrderBookDetails,
  fetchMarkPrices,
  buildDecimalsMap,
  fetchAccount,
  fetchPositions,
  buildMetadata,
  clearLighterCache,
  fetchPnl,
  fetchPortfolio,
  fetchTotalPnl,
  type LighterMetadata,
} from './api';
export { normalizePosition } from './normalizer';
