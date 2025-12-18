/**
 * dYdX provider - Cosmos-based perpetuals DEX
 *
 * Custom implementation (not using createProvider factory) because dYdX
 * requires fetching subaccount data (equity) alongside positions for
 * cross-margin liquidation price calculation.
 */

import type { DexProvider } from '../types';
import type { DydxPositionWithMeta } from './types';
import { fetchPositions, fetchSubaccount, buildMetadata } from './api';
import { normalizePosition } from './normalizer';
import { isZeroPosition } from '../../utils/positionCalc';

// ============================================
// Provider (custom implementation for cross-margin support)
// ============================================

export const dydxProvider: DexProvider<DydxPositionWithMeta> = {
  id: 'dydx',
  name: 'dYdX',
  chain: 'cosmos',

  async fetchPositions(address: string): Promise<DydxPositionWithMeta[]> {
    // Fetch positions and subaccount data in parallel
    const [rawPositions, subaccountData, metadata] = await Promise.all([
      fetchPositions(address),
      fetchSubaccount(address),
      buildMetadata(),
    ]);

    // Filter out zero positions
    const nonZeroPositions = rawPositions.filter(
      (p) => !isZeroPosition(p.size)
    );

    if (nonZeroPositions.length === 0) {
      return [];
    }

    // Get account data for leverage calculation
    const subaccount = subaccountData?.subaccount;
    const accountEquity = parseFloat(subaccount?.equity ?? '0');
    const freeCollateral = parseFloat(subaccount?.freeCollateral ?? '0');

    // Total margin used = equity - freeCollateral
    const totalMarginUsed = accountEquity - freeCollateral;

    // Calculate maintenance margin and notional for each position
    const positionMaintenanceMargins = new Map<string, number>();
    let totalMaintenanceRequired = 0;
    let totalNotional = 0;

    for (const pos of nonZeroPositions) {
      const markPrice = metadata.markPrices.get(pos.market);
      const price = markPrice ? parseFloat(markPrice) : parseFloat(pos.entryPrice);
      const size = Math.abs(parseFloat(pos.size));
      const notional = size * price;
      const mmf = metadata.maintenanceMarginFractions.get(pos.market) ?? 0.03;
      const maintenance = notional * mmf;

      positionMaintenanceMargins.set(pos.market, maintenance);
      totalMaintenanceRequired += maintenance;
      totalNotional += notional;
    }

    // Enrich positions with metadata
    return nonZeroPositions.map((raw) => {
      const thisPositionMaintenance = positionMaintenanceMargins.get(raw.market) ?? 0;
      const otherPositionsMaintenanceMargin = totalMaintenanceRequired - thisPositionMaintenance;

      return {
        ...raw,
        _sizeDecimals: metadata.sizeDecimals.get(raw.market) ?? 4,
        _priceDecimals: metadata.priceDecimals.get(raw.market) ?? 2,
        _markPrice: metadata.markPrices.get(raw.market) ?? null,
        _maintenanceMarginFraction: metadata.maintenanceMarginFractions.get(raw.market) ?? 0.03,
        _initialMarginFraction: metadata.initialMarginFractions.get(raw.market) ?? 0.05,
        _accountEquity: accountEquity,
        _otherPositionsMaintenanceMargin: otherPositionsMaintenanceMargin,
        _totalMarginUsed: totalMarginUsed,
        _totalNotional: totalNotional,
      };
    });
  },

  normalizePosition,
};

// ============================================
// Re-exports for external use
// ============================================

export type { DydxPositionWithMeta } from './types';
export type { DydxMetadata } from './api';
export {
  fetchMarkets,
  fetchPositions,
  fetchSubaccount,
  fetchMarkPrices,
  buildDecimalsMap,
  buildMetadata,
  clearDydxCache,
  fetchHistoricalPnl,
  fetchPortfolio,
  fetchTotalPnl,
} from './api';
export { normalizePosition } from './normalizer';
