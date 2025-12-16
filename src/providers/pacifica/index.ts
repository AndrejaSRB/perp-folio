/**
 * Pacifica provider - Solana perpetuals DEX
 */

import type { DexProvider } from '../types';
import type { PacificaPositionWithContext } from './types';
import {
  fetchPositions,
  fetchAccountSettings,
  fetchMarkets,
  fetchPrices,
  buildDecimalsMap,
} from './api';
import { normalizePosition } from './normalizer';

// ============================================
// Provider
// ============================================

/**
 * Pacifica provider with custom implementation
 * Handles address-specific settings and market data
 */
export const pacificaProvider: DexProvider<PacificaPositionWithContext> = {
  id: 'pacifica',
  name: 'Pacifica',
  chain: 'solana',

  async fetchPositions(address: string): Promise<PacificaPositionWithContext[]> {
    // Step 1: Fetch raw positions
    const positions = await fetchPositions(address);

    // Step 2: Early return if no positions
    if (positions.length === 0) {
      return [];
    }

    // Step 3: Fetch metadata in parallel (includes address-specific settings)
    const [settings, decimalsMap, prices] = await Promise.all([
      fetchAccountSettings(address),
      buildDecimalsMap(),
      fetchPrices(),
    ]);

    // Markets are already cached from buildDecimalsMap, this is instant
    const markets = await fetchMarkets();

    // Step 4: Enrich positions with context
    return positions.map((p) => {
      const setting = settings.find((s) => s.symbol === p.symbol);
      const market = markets.find((m) => m.symbol === p.symbol);
      const price = prices.find((pr) => pr.symbol === p.symbol);

      // If no setting found, user is using max leverage
      const leverage = setting?.leverage ?? market?.max_leverage ?? 1;

      return {
        ...p,
        _leverage: leverage,
        _maxLeverage: market?.max_leverage ?? null,
        _markPrice: price?.mark ?? null,
        _sizeDecimals: decimalsMap.sizeDecimals.get(p.symbol) ?? 0,
        _priceDecimals: decimalsMap.priceDecimals.get(p.symbol) ?? 2,
      };
    });
  },

  normalizePosition,
};

// ============================================
// Re-exports for external use
// ============================================

export type { PacificaPositionWithContext } from './types';
export {
  fetchMarkets,
  fetchPositions,
  fetchAccountSettings,
  fetchPrices,
  buildDecimalsMap,
  clearPacificaCache,
  fetchPortfolio,
} from './api';
export { normalizePosition } from './normalizer';
export { calculatePnl, calculatePositionValue, calculateMarginUsed, calculateRoi } from './utils';
