import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { hyperliquidProvider } from '../providers/hyperliquid';
import { formatPositionPrices } from '../utils/formatting';
import type { HyperliquidAssetPosition, NormalizedPosition } from '../types';

export interface UseHyperliquidPositionsConfig {
  enabled?: boolean;
  refetchInterval?: number | false;
  refetchOnWindowFocus?: boolean;
  staleTime?: number;
  retry?: number | boolean;
  /** Keep previous data while refetching (default: true) */
  keepPreviousData?: boolean;
  /** Format price fields (entryPrice, markPrice, liquidationPrice) using priceDecimals (default: false) */
  formatPrices?: boolean;
}

export interface UseHyperliquidPositionsOptions extends UseHyperliquidPositionsConfig {
  wallets: string | string[];
}

export interface UseHyperliquidPositionsResult {
  /** Raw positions from HyperLiquid API */
  raw: HyperliquidAssetPosition[];
  /** Normalized positions */
  positions: NormalizedPosition[];
  isLoading: boolean;
  isFetching: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => void;
}

export const useHyperliquidPositions = (
  options: UseHyperliquidPositionsOptions
): UseHyperliquidPositionsResult => {
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

  const walletsArray = useMemo(
    () => (Array.isArray(wallets) ? wallets : [wallets]),
    [wallets]
  );

  const query = useQuery({
    queryKey: ['hyperliquid', 'positions', ...walletsArray.sort()],
    queryFn: async () => {
      const results = await Promise.all(
        walletsArray.map(async (wallet) => {
          const raw = await hyperliquidProvider.fetchPositions(wallet);
          const normalized = raw.map((r) =>
            hyperliquidProvider.normalizePosition(r, wallet)
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
