/**
 * Factory for creating provider-specific React hooks
 * Eliminates code duplication across individual provider hooks
 */

import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import type { DexProvider } from '../providers/types';
import type { NormalizedPosition } from '../types';
import { formatPositionPrices } from '../utils/formatting';

/**
 * Common configuration options for provider hooks
 */
export interface ProviderHookConfig {
  /** Enable/disable the query (default: true) */
  enabled?: boolean;
  /** Refetch interval in milliseconds (default: false - no auto-refetch) */
  refetchInterval?: number | false;
  /** Refetch when window regains focus (default: false) */
  refetchOnWindowFocus?: boolean;
  /** Time in ms before data is considered stale (default: 30000) */
  staleTime?: number;
  /** Number of retry attempts (default: 2) */
  retry?: number | boolean;
  /** Keep previous data while refetching (default: true) */
  keepPreviousData?: boolean;
  /** Format price fields using priceDecimals (default: false) */
  formatPrices?: boolean;
}

/**
 * Options passed to provider hooks
 */
export interface ProviderHookOptions extends ProviderHookConfig {
  /** Wallet address(es) to fetch positions for */
  wallets: string | string[];
}

/**
 * Result returned by provider hooks
 */
export interface ProviderHookResult<TRaw> {
  /** Raw positions from DEX API */
  raw: TRaw[];
  /** Normalized positions */
  positions: NormalizedPosition[];
  /** True during initial load */
  isLoading: boolean;
  /** True when fetching (including background refetch) */
  isFetching: boolean;
  /** True if an error occurred */
  isError: boolean;
  /** Error object if isError is true */
  error: Error | null;
  /** Function to manually trigger refetch */
  refetch: () => void;
}

/**
 * Create a React hook for a specific DEX provider
 *
 * @param provider - The DEX provider instance
 * @returns A React hook for fetching positions from that provider
 *
 * @example
 * ```typescript
 * // Create a hook for HyperLiquid
 * export const useHyperliquidPositions = createProviderHook(hyperliquidProvider);
 *
 * // Usage in component
 * const { positions, isLoading } = useHyperliquidPositions({
 *   wallets: '0x123...',
 *   formatPrices: true,
 * });
 * ```
 */
export function createProviderHook<TRaw>(
  provider: DexProvider<TRaw>
): (options: ProviderHookOptions) => ProviderHookResult<TRaw> {
  return function useProviderPositions(
    options: ProviderHookOptions
  ): ProviderHookResult<TRaw> {
    const {
      wallets,
      enabled = true,
      refetchInterval,
      refetchOnWindowFocus = false,
      staleTime = 30_000,
      retry = 2,
      keepPreviousData = true,
      formatPrices = false,
    } = options;

    // Normalize wallets to array
    const walletsArray = useMemo(
      () => (Array.isArray(wallets) ? wallets : [wallets]),
      [wallets]
    );

    // Main query
    const query = useQuery({
      queryKey: [provider.id, 'positions', ...walletsArray.sort()],
      queryFn: async () => {
        const results = await Promise.all(
          walletsArray.map(async (wallet) => {
            const raw = await provider.fetchPositions(wallet);
            const normalized = raw.map((r) =>
              provider.normalizePosition(r, wallet)
            );
            return { raw, normalized };
          })
        );

        return {
          raw: results.flatMap((r) => r.raw),
          normalized: results.flatMap((r) => r.normalized),
        };
      },
      enabled,
      refetchInterval,
      refetchOnWindowFocus,
      staleTime,
      retry,
      placeholderData: keepPreviousData ? (prev) => prev : undefined,
    });

    // Apply price formatting if requested
    const positions = useMemo(() => {
      const normalized = query.data?.normalized ?? [];
      return formatPrices ? normalized.map(formatPositionPrices) : normalized;
    }, [query.data?.normalized, formatPrices]);

    return {
      raw: query.data?.raw ?? [],
      positions,
      isLoading: query.isLoading,
      isFetching: query.isFetching,
      isError: query.isError,
      error: query.error,
      refetch: query.refetch,
    };
  };
}
