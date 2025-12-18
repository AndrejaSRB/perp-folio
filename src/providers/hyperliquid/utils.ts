/**
 * Utility functions for Hyperliquid WebSocket data processing
 */

import type {
  HyperliquidDexStateTuple,
  HyperliquidCombinedClearinghouseState,
  HyperliquidMarginSummary,
  HyperliquidAssetPosition,
} from '../../types';

/**
 * Sum string values representing numbers
 */
const sumStringValues = (values: string[]): string => {
  const sum = values.reduce((acc, val) => acc + parseFloat(val || '0'), 0);
  return sum.toString();
};

/**
 * Combine data from multiple Hyperliquid clearinghouse states into a single unified state
 *
 * allDexsClearinghouseState provides separate states for Hyperliquid Perps, HIP-3, HIP-8, etc.
 * This function merges all positions and aggregates margin data from all DEX states.
 *
 * @param clearinghouseStates - Array of [dexName, clearinghouseState] tuples from allDexsClearinghouseState
 * @returns Combined clearinghouse state with merged positions and aggregated values
 *
 * @example
 * ```typescript
 * ws.on('message', (msg) => {
 *   if (msg.channel === 'allDexsClearinghouseState') {
 *     const combined = combineHyperliquidClearinghouseStates(msg.data.clearinghouseStates);
 *     // combined.assetPositions includes positions from all DEXs
 *     // combined.marginSummary has summed values from all DEXs
 *   }
 * });
 * ```
 */
export const combineHyperliquidClearinghouseStates = (
  clearinghouseStates: HyperliquidDexStateTuple[]
): HyperliquidCombinedClearinghouseState => {
  // Collect all asset positions
  const allAssetPositions: HyperliquidAssetPosition[] = [];

  for (const [, clearinghouseState] of clearinghouseStates) {
    allAssetPositions.push(...clearinghouseState.assetPositions);
  }

  // Extract just the clearinghouse states for aggregation
  const states = clearinghouseStates.map(([, state]) => state);

  // Combine margin summaries by summing all numeric values
  const combinedMarginSummary: HyperliquidMarginSummary = {
    accountValue: sumStringValues(states.map((s) => s.marginSummary.accountValue)),
    totalNtlPos: sumStringValues(states.map((s) => s.marginSummary.totalNtlPos)),
    totalRawUsd: sumStringValues(states.map((s) => s.marginSummary.totalRawUsd)),
    totalMarginUsed: sumStringValues(states.map((s) => s.marginSummary.totalMarginUsed)),
  };

  const combinedCrossMarginSummary: HyperliquidMarginSummary = {
    accountValue: sumStringValues(states.map((s) => s.crossMarginSummary.accountValue)),
    totalNtlPos: sumStringValues(states.map((s) => s.crossMarginSummary.totalNtlPos)),
    totalRawUsd: sumStringValues(states.map((s) => s.crossMarginSummary.totalRawUsd)),
    totalMarginUsed: sumStringValues(states.map((s) => s.crossMarginSummary.totalMarginUsed)),
  };

  return {
    marginSummary: combinedMarginSummary,
    crossMarginSummary: combinedCrossMarginSummary,
    crossMaintenanceMarginUsed: sumStringValues(states.map((s) => s.crossMaintenanceMarginUsed)),
    withdrawable: sumStringValues(states.map((s) => s.withdrawable)),
    assetPositions: allAssetPositions,
    time: Math.max(...states.map((s) => s.time)),
  };
};
