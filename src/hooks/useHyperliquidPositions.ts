/**
 * React hook for fetching HyperLiquid positions
 */

import { hyperliquidProvider } from '../providers/hyperliquid';
import type { HyperliquidPositionWithMeta } from '../providers/hyperliquid';
import {
  createProviderHook,
  type ProviderHookConfig,
  type ProviderHookOptions,
  type ProviderHookResult,
} from './createProviderHook';

// Re-export types with provider-specific names for backwards compatibility
export type UseHyperliquidPositionsConfig = ProviderHookConfig;
export type UseHyperliquidPositionsOptions = ProviderHookOptions;
export type UseHyperliquidPositionsResult = ProviderHookResult<HyperliquidPositionWithMeta>;

/**
 * Fetch and normalize HyperLiquid perpetual positions
 *
 * @example
 * ```tsx
 * const { positions, isLoading, error } = useHyperliquidPositions({
 *   wallets: '0x123...',
 *   formatPrices: true,
 *   refetchInterval: 30000,
 * });
 * ```
 */
export const useHyperliquidPositions = createProviderHook(hyperliquidProvider);
