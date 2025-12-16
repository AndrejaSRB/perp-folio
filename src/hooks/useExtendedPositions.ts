/**
 * React hook for fetching Extended DEX positions
 * Requires API credentials (apiKey)
 */

import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import type { ExtendedCredentials } from '../types/extended';
import type { NormalizedPosition } from '../types';
import { extendedProvider, type ExtendedPositionWithMeta } from '../providers/extended';
import { formatPositionPrices } from '../utils/formatting';

// ============================================
// Types
// ============================================

/**
 * Configuration options for useExtendedPositions
 */
export interface UseExtendedPositionsConfig {
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
 * Options passed to useExtendedPositions hook
 */
export interface UseExtendedPositionsOptions extends UseExtendedPositionsConfig {
  /** API credentials for Extended */
  credentials: ExtendedCredentials;
}

/**
 * Result returned by useExtendedPositions hook
 */
export interface UseExtendedPositionsResult {
  /** Raw positions from Extended API */
  raw: ExtendedPositionWithMeta[];
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

// ============================================
// Hook
// ============================================

/**
 * Fetch and normalize Extended perpetual positions
 *
 * @example
 * ```tsx
 * const { positions, isLoading, error } = useExtendedPositions({
 *   credentials: {
 *     apiKey: process.env.EXTENDED_API_KEY!,
 *   },
 *   formatPrices: true,
 *   refetchInterval: 30000,
 * });
 *
 * // Handle missing credentials
 * if (error?.message.includes('credentials')) {
 *   return <div>Please configure Extended API credentials</div>;
 * }
 * ```
 */
export function useExtendedPositions(
  options: UseExtendedPositionsOptions
): UseExtendedPositionsResult {
  const {
    credentials,
    enabled = true,
    refetchInterval,
    refetchOnWindowFocus = false,
    staleTime = 30_000,
    retry = 2,
    keepPreviousData = true,
    formatPrices = false,
  } = options;

  // Check if credentials are valid
  const hasValidCredentials = Boolean(credentials?.apiKey);

  // Main query
  const query = useQuery({
    // Key by apiKey (truncated for security)
    queryKey: ['extended', 'positions', credentials?.apiKey?.slice(0, 8) ?? 'no-key'],
    queryFn: async () => {
      if (!hasValidCredentials) {
        // Return empty - error is handled via the error field
        return { raw: [] as ExtendedPositionWithMeta[], normalized: [] as NormalizedPosition[] };
      }

      const raw = await extendedProvider.fetchPositions('', credentials);
      // Use apiKey as the "wallet" identifier for normalized positions
      const normalized = raw.map((r) =>
        extendedProvider.normalizePosition(r, credentials.apiKey)
      );

      return { raw, normalized };
    },
    enabled,
    refetchInterval,
    refetchOnWindowFocus,
    staleTime,
    retry: hasValidCredentials ? retry : false, // Don't retry if no credentials
    placeholderData: keepPreviousData ? (prev) => prev : undefined,
  });

  // Apply price formatting if requested
  const positions = useMemo(() => {
    const normalized = query.data?.normalized ?? [];
    return formatPrices ? normalized.map(formatPositionPrices) : normalized;
  }, [query.data?.normalized, formatPrices]);

  // Create credentials error if missing
  const credentialsError = !hasValidCredentials
    ? new Error('Extended API credentials required (apiKey)')
    : null;

  return {
    raw: query.data?.raw ?? [],
    positions,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isError: query.isError || !hasValidCredentials,
    error: credentialsError ?? query.error,
    refetch: query.refetch,
  };
}
