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

/**
 * Fetch positions with all required context (settings, markets, prices, decimals)
 * Only fetches metadata APIs if there are positions
 */
const fetchPositionsWithContext = async (
  address: string
): Promise<PacificaPositionWithContext[]> => {
  // First fetch positions
  const positions = await fetchPositions(address);

  // Only fetch metadata if there are positions
  if (positions.length === 0) {
    return [];
  }

  // Fetch metadata for enrichment (in parallel)
  const [settings, decimalsMap, prices] = await Promise.all([
    fetchAccountSettings(address),
    buildDecimalsMap(),
    fetchPrices(),
  ]);

  // Markets are already cached from buildDecimalsMap, this is instant
  const markets = await fetchMarkets();

  // Enrich positions with context
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
};

// ============================================
// Provider export
// ============================================

export const pacificaProvider: DexProvider<PacificaPositionWithContext> = {
  id: 'pacifica',
  name: 'Pacifica',
  chain: 'solana',

  fetchPositions: fetchPositionsWithContext,

  normalizePosition,
};

// Re-export everything for external use
export type { PacificaPositionWithContext } from './types';
export {
  fetchMarkets,
  fetchPositions,
  fetchAccountSettings,
  fetchPrices,
  buildDecimalsMap,
  clearPacificaCache,
} from './api';
export { normalizePosition } from './normalizer';
export { calculatePnl, calculatePositionValue, calculateMarginUsed, calculateRoi } from './utils';
