/**
 * React hook for fetching Lighter positions
 */

import { lighterProvider } from '../providers/lighter';
import type { LighterPositionWithMeta } from '../providers/lighter';
import {
  createProviderHook,
  type ProviderHookConfig,
  type ProviderHookOptions,
  type ProviderHookResult,
} from './createProviderHook';

// Re-export types with provider-specific names for backwards compatibility
export type UseLighterPositionsConfig = ProviderHookConfig;
export type UseLighterPositionsOptions = ProviderHookOptions;
export type UseLighterPositionsResult = ProviderHookResult<LighterPositionWithMeta>;

/**
 * Fetch and normalize Lighter perpetual positions
 *
 * @example
 * ```tsx
 * const { positions, isLoading, error } = useLighterPositions({
 *   wallets: '0x123...',
 *   formatPrices: true,
 *   refetchInterval: 30000,
 * });
 * ```
 */
export const useLighterPositions = createProviderHook(lighterProvider);
