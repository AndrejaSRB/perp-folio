import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { pacificaProvider } from '../providers/pacifica';
import type { PacificaPosition, NormalizedPosition } from '../types';

export interface UsePacificaPositionsConfig {
  enabled?: boolean;
  refetchInterval?: number | false;
  refetchOnWindowFocus?: boolean;
  staleTime?: number;
  retry?: number | boolean;
}

export interface UsePacificaPositionsOptions extends UsePacificaPositionsConfig {
  wallets: string | string[];
}

export interface UsePacificaPositionsResult {
  /** Raw positions from Pacifica API (note: enriched with context) */
  raw: PacificaPosition[];
  /** Normalized positions */
  positions: NormalizedPosition[];
  isLoading: boolean;
  isFetching: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => void;
}

export const usePacificaPositions = (
  options: UsePacificaPositionsOptions
): UsePacificaPositionsResult => {
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
    queryKey: ['pacifica', 'positions', ...walletsArray.sort()],
    queryFn: async () => {
      const results = await Promise.all(
        walletsArray.map(async (wallet) => {
          const raw = await pacificaProvider.fetchPositions(wallet);
          const normalized = raw.map((r) =>
            pacificaProvider.normalizePosition(r, wallet)
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
