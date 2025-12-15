import type { DexProvider } from '../types';
import type { LighterPositionWithMeta } from './types';
import {
  fetchAccount,
  buildDecimalsMap,
  fetchMarkPrices,
} from './api';
import { normalizePosition } from './normalizer';

// ============================================
// Provider export
// ============================================

export const lighterProvider: DexProvider<LighterPositionWithMeta> = {
  id: 'lighter',
  name: 'Lighter',
  chain: 'evm',

  fetchPositions: async (address: string): Promise<LighterPositionWithMeta[]> => {
    // First fetch account data
    const accountData = await fetchAccount(address);

    // No accounts found
    if (accountData.accounts.length === 0) {
      return [];
    }

    // Aggregate positions from all accounts (master + subaccounts)
    const allPositions = accountData.accounts.flatMap(
      (account) => account.positions
    );

    // Filter out zero positions
    const nonZeroPositions = allPositions.filter(
      (p) => parseFloat(p.position) !== 0
    );

    // Only fetch metadata if there are positions
    if (nonZeroPositions.length === 0) {
      return [];
    }

    // Get unique symbols for mark price fetching
    const symbols = [...new Set(nonZeroPositions.map((p) => p.symbol))];

    // Fetch metadata and mark prices in parallel
    const [decimalsMap, markPrices] = await Promise.all([
      buildDecimalsMap(),
      fetchMarkPrices(symbols),
    ]);

    // Enrich with metadata
    return nonZeroPositions.map((p) => ({
      ...p,
      _sizeDecimals: decimalsMap.sizeDecimals.get(p.symbol) ?? 0,
      _priceDecimals: decimalsMap.priceDecimals.get(p.symbol) ?? 2,
      _markPrice: markPrices.get(p.symbol) ?? null,
    }));
  },

  normalizePosition,
};

// Re-export everything for external use
export type { LighterPositionWithMeta } from './types';
export {
  fetchOrderBooks,
  fetchOrderBookDetails,
  fetchMarkPrices,
  buildDecimalsMap,
  fetchAccount,
  clearLighterCache,
} from './api';
export { normalizePosition } from './normalizer';
