/**
 * Aster provider - EVM perpetuals DEX with API authentication
 */

import type { AsterCredentials } from '../../types/aster';
import type { DexProvider } from '../types';
import type { AsterPositionWithMeta } from './types';
import { fetchPositions as fetchPositionsRaw, buildDecimalsMap } from './api';
import { normalizePosition } from './normalizer';
import { isZeroPosition } from '../../utils/positionCalc';

// ============================================
// Provider
// ============================================

/**
 * Aster provider with API authentication
 * Requires API key and secret for fetching positions
 */
export const asterProvider: DexProvider<AsterPositionWithMeta> = {
  id: 'aster',
  name: 'Aster',
  chain: 'evm',
  requiresCredentials: true,

  async fetchPositions(
    _address: string, // Ignored - Aster uses API credentials
    credentials?: unknown
  ): Promise<AsterPositionWithMeta[]> {
    // Cast credentials to expected type
    const creds = credentials as AsterCredentials | undefined;

    // Validate credentials - return empty if missing (error handled by hook)
    if (!creds?.apiKey || !creds?.apiSecret) {
      return [];
    }

    // Step 1: Fetch raw positions (signed request)
    const rawPositions = await fetchPositionsRaw(creds);

    // Step 2: Filter zero positions
    const nonZeroPositions = rawPositions.filter(
      (p) => !isZeroPosition(p.positionAmt)
    );

    // Step 3: Early return if no positions
    if (nonZeroPositions.length === 0) {
      return [];
    }

    // Step 4: Fetch decimals map (public, cached)
    const decimalsMap = await buildDecimalsMap();

    // Step 5: Enrich positions with metadata
    return nonZeroPositions.map((p) => ({
      ...p,
      _sizeDecimals: decimalsMap.sizeDecimals.get(p.symbol) ?? 0,
      _priceDecimals: decimalsMap.priceDecimals.get(p.symbol) ?? 2,
      _markPrice: parseFloat(p.markPrice),
    }));
  },

  normalizePosition,
};

// ============================================
// Re-exports for external use
// ============================================

export type { AsterPositionWithMeta } from './types';
export {
  fetchExchangeInfo,
  fetchPositions,
  buildDecimalsMap,
  clearAsterCache,
} from './api';
export { normalizePosition } from './normalizer';
export { hmacSha256 } from './crypto';
