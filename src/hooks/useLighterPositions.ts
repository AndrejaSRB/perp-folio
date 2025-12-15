import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { lighterProvider } from '../providers/lighter';
import type { LighterPosition, NormalizedPosition } from '../types';

export interface UseLighterPositionsConfig {
  enabled?: boolean;
  refetchInterval?: number | false;
  refetchOnWindowFocus?: boolean;
  staleTime?: number;
  retry?: number | boolean;
}

export interface UseLighterPositionsOptions extends UseLighterPositionsConfig {
  wallets: string | string[];
}

export interface UseLighterPositionsResult {
  /** Raw positions from Lighter API */
  raw: LighterPosition[];
  /** Normalized positions */
  positions: NormalizedPosition[];
  isLoading: boolean;
  isFetching: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => void;
}

export const useLighterPositions = (
  options: UseLighterPositionsOptions
): UseLighterPositionsResult => {
  const {
    wallets,
    enabled = true,
    refetchInterval,
    refetchOnWindowFocus = false,
    staleTime = 30_000,
    retry = 2,
  } = options;

  const walletsArray = useMemo(
    () => (Array.isArray(wallets) ? wallets : [wallets]),
    [wallets]
  );

  const query = useQuery({
    queryKey: ['lighter', 'positions', ...walletsArray.sort()],
    queryFn: async () => {
      const results = await Promise.all(
        walletsArray.map(async (wallet) => {
          const raw = await lighterProvider.fetchPositions(wallet);
          const normalized = raw.map((r) =>
            lighterProvider.normalizePosition(r, wallet)
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
  });

  return {
    raw: query.data?.raw ?? [],
    positions: query.data?.normalized ?? [],
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
};
