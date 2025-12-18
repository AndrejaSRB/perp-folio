/**
 * React hook for fetching dYdX positions
 */

import { dydxProvider } from '../providers/dydx';
import type { DydxPositionWithMeta } from '../providers/dydx';
import {
  createProviderHook,
  type ProviderHookConfig,
  type ProviderHookOptions,
  type ProviderHookResult,
} from './createProviderHook';

// Re-export types with provider-specific names for backwards compatibility
export type UseDydxPositionsConfig = ProviderHookConfig;
export type UseDydxPositionsOptions = ProviderHookOptions;
export type UseDydxPositionsResult = ProviderHookResult<DydxPositionWithMeta>;

/**
 * Fetch and normalize dYdX perpetual positions
 *
 * Note: dYdX uses Cosmos addresses (dydx1...) not EVM addresses.
 * You'll need to convert EVM addresses to dYdX addresses if needed.
 *
 * @example
 * ```tsx
 * const { positions, isLoading, error } = useDydxPositions({
 *   wallets: 'dydx1abc...', // dYdX Cosmos address
 *   formatPrices: true,
 *   refetchInterval: 30000,
 * });
 * ```
 */
export const useDydxPositions = createProviderHook(dydxProvider);
