/**
 * React hook for fetching Pacifica positions
 */

import { pacificaProvider } from '../providers/pacifica';
import type { PacificaPositionWithContext } from '../providers/pacifica';
import {
  createProviderHook,
  type ProviderHookConfig,
  type ProviderHookOptions,
  type ProviderHookResult,
} from './createProviderHook';

// Re-export types with provider-specific names for backwards compatibility
export type UsePacificaPositionsConfig = ProviderHookConfig;
export type UsePacificaPositionsOptions = ProviderHookOptions;
export type UsePacificaPositionsResult = ProviderHookResult<PacificaPositionWithContext>;

/**
 * Fetch and normalize Pacifica perpetual positions
 *
 * @example
 * ```tsx
 * const { positions, isLoading, error } = usePacificaPositions({
 *   wallets: 'solana-wallet-address...',
 *   formatPrices: true,
 *   refetchInterval: 30000,
 * });
 * ```
 */
export const usePacificaPositions = createProviderHook(pacificaProvider);
