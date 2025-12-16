/**
 * React hook for fetching Aster DEX positions
 * Requires API credentials (apiKey + apiSecret)
 */

import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import type { AsterCredentials } from '../types/aster';
import type { NormalizedPosition } from '../types';
import { asterProvider, type AsterPositionWithMeta } from '../providers/aster';
import { formatPositionPrices } from '../utils/formatting';

// ============================================
// Types
// ============================================

/**
 * Configuration options for useAsterPositions
 */
export interface UseAsterPositionsConfig {
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
 * Options passed to useAsterPositions hook
 */
export interface UseAsterPositionsOptions extends UseAsterPositionsConfig {
  /** API credentials for Aster */
  credentials: AsterCredentials;
}

/**
 * Result returned by useAsterPositions hook
 */
export interface UseAsterPositionsResult {
  /** Raw positions from Aster API */
  raw: AsterPositionWithMeta[];
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
 * Fetch and normalize Aster perpetual positions
 *
 * @example
 * ```tsx
 * const { positions, isLoading, error } = useAsterPositions({
 *   credentials: {
 *     apiKey: process.env.ASTER_API_KEY!,
 *     apiSecret: process.env.ASTER_API_SECRET!,
 *   },
 *   formatPrices: true,
 *   refetchInterval: 30000,
 * });
 *
 * // Handle missing credentials
 * if (error?.message.includes('credentials')) {
 *   return <div>Please configure Aster API credentials</div>;
 * }
 * ```
 */
export function useAsterPositions(
  options: UseAsterPositionsOptions
): UseAsterPositionsResult {
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
  const hasValidCredentials = Boolean(
    credentials?.apiKey && credentials?.apiSecret
  );

  // Main query
  const query = useQuery({
    // Key by apiKey (don't include secret for security)
    queryKey: ['aster', 'positions', credentials?.apiKey ?? 'no-key'],
    queryFn: async () => {
      if (!hasValidCredentials) {
        // Return empty - error is handled via the error field
        return { raw: [] as AsterPositionWithMeta[], normalized: [] as NormalizedPosition[] };
      }

      const raw = await asterProvider.fetchPositions('', credentials);
      // Use apiKey as the "wallet" identifier for normalized positions
      const normalized = raw.map((r) =>
        asterProvider.normalizePosition(r, credentials.apiKey)
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
    ? new Error('Aster API credentials required (apiKey and apiSecret)')
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
