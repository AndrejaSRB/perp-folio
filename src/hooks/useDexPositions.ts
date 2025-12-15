import { useQueries } from '@tanstack/react-query';
import { useMemo, useCallback } from 'react';
import { providers } from '../providers';
import { normalizeWalletsInput, type WalletsParam } from '../utils/chains';
import { formatPositionPrices } from '../utils/formatting';
import type { NormalizedPosition, ProviderId } from '../types';

export interface UseDexPositionsConfig {
  enabled?: boolean;
  refetchInterval?: number | false;
  refetchOnWindowFocus?: boolean;
  staleTime?: number;
  retry?: number | boolean;
  /** Keep previous data while refetching (default: true) */
  keepPreviousData?: boolean;
  /** Wait for all providers before returning data (default: false - stream as they arrive) */
  waitForAll?: boolean;
  /** Format price fields (entryPrice, markPrice, liquidationPrice) using priceDecimals (default: false) */
  formatPrices?: boolean;
}

export interface UseDexPositionsOptions extends UseDexPositionsConfig {
  /** Wallet address(es) - auto-detects chain type */
  wallets: WalletsParam;
  /** Only include these providers (whitelist) */
  providers?: ProviderId[];
  /** Exclude these providers (blacklist) */
  exclude?: ProviderId[];
}

export interface ProviderError {
  provider: ProviderId;
  error: Error;
}

export interface UseDexPositionsResult {
  /** All normalized positions from enabled providers */
  positions: NormalizedPosition[];
  /** Loading state (at least one provider is loading) */
  isLoading: boolean;
  /** Fetching state (at least one provider is fetching) */
  isFetching: boolean;
  /** Error state (at least one provider has error) */
  isError: boolean;
  /** Errors from individual providers */
  errors: ProviderError[];
  /** Refetch all providers */
  refetch: () => void;

  // Filter helpers
  /** Get positions by provider */
  getByProvider: (provider: ProviderId) => NormalizedPosition[];
  /** Get positions by wallet address */
  getByWallet: (wallet: string) => NormalizedPosition[];
  /** Get positions by symbol */
  getBySymbol: (symbol: string) => NormalizedPosition[];
  /** Get all long positions */
  getLongs: () => NormalizedPosition[];
  /** Get all short positions */
  getShorts: () => NormalizedPosition[];
}

export const useDexPositions = (
  options: UseDexPositionsOptions
): UseDexPositionsResult => {
  const {
    wallets,
    providers: includeProviders,
    exclude = [],
    enabled = true,
    refetchInterval,
    refetchOnWindowFocus = false,
    staleTime = 30_000,
    retry = 2,
    keepPreviousData = true,
    waitForAll = false,
    formatPrices = false,
  } = options;

  // Normalize wallet input to { evm: [], solana: [] }
  const normalizedWallets = useMemo(
    () => normalizeWalletsInput(wallets),
    [wallets]
  );

  // Determine which providers to query based on wallet types and include/exclude
  const activeProviders = useMemo(() => {
    const allProviderIds = Object.keys(providers) as ProviderId[];
    let filtered = includeProviders ?? allProviderIds;

    // Remove excluded providers
    filtered = filtered.filter((id) => !exclude.includes(id));

    // Only include providers where we have wallets for their chain
    return filtered.filter((id) => {
      const provider = providers[id];
      if (provider.chain === 'evm') return normalizedWallets.evm.length > 0;
      if (provider.chain === 'solana') return normalizedWallets.solana.length > 0;
      return false;
    });
  }, [includeProviders, exclude, normalizedWallets]);

  // Create queries for each active provider
  const queries = useQueries({
    queries: activeProviders.map((providerId) => {
      const provider = providers[providerId];
      const relevantWallets =
        provider.chain === 'evm'
          ? normalizedWallets.evm
          : normalizedWallets.solana;

      return {
        queryKey: ['dex-positions', providerId, ...relevantWallets.sort()],
        queryFn: async (): Promise<{
          providerId: ProviderId;
          positions: NormalizedPosition[];
        }> => {
          const results = await Promise.all(
            relevantWallets.map(async (wallet) => {
              const raw = await provider.fetchPositions(wallet);
              return raw.map((r) => provider.normalizePosition(r, wallet));
            })
          );
          return { providerId, positions: results.flat() };
        },
        enabled,
        refetchInterval,
        refetchOnWindowFocus,
        staleTime,
        retry,
        placeholderData: keepPreviousData
          ? (prev: { providerId: ProviderId; positions: NormalizedPosition[] } | undefined) => prev
          : undefined,
      };
    }),
  });

  // Aggregate all positions and optionally format prices
  const positions = useMemo(() => {
    const rawPositions = queries.flatMap((q) => q.data?.positions ?? []);
    return formatPrices ? rawPositions.map(formatPositionPrices) : rawPositions;
  }, [queries, formatPrices]);

  // Collect errors from failed queries
  const errors = useMemo(
    () =>
      queries
        .map((q, i) =>
          q.error
            ? { provider: activeProviders[i], error: q.error as Error }
            : null
        )
        .filter((e): e is ProviderError => e !== null),
    [queries, activeProviders]
  );

  // Refetch all providers
  const refetch = useCallback(() => {
    queries.forEach((q) => q.refetch());
  }, [queries]);

  // Filter helpers
  const getByProvider = useCallback(
    (provider: ProviderId) => positions.filter((p) => p.provider === provider),
    [positions]
  );

  const getByWallet = useCallback(
    (wallet: string) =>
      positions.filter(
        (p) => p.wallet.toLowerCase() === wallet.toLowerCase()
      ),
    [positions]
  );

  const getBySymbol = useCallback(
    (symbol: string) =>
      positions.filter(
        (p) => p.symbol.toLowerCase() === symbol.toLowerCase()
      ),
    [positions]
  );

  const getLongs = useCallback(
    () => positions.filter((p) => p.side === 'long'),
    [positions]
  );

  const getShorts = useCallback(
    () => positions.filter((p) => p.side === 'short'),
    [positions]
  );

  // Loading state depends on waitForAll flag
  // waitForAll=true: loading until ALL providers finish
  // waitForAll=false: loading only on initial load (no data yet)
  const isLoading = waitForAll
    ? queries.some((q) => q.isLoading)
    : queries.every((q) => q.isLoading) && positions.length === 0;

  return {
    positions,
    isLoading,
    isFetching: queries.some((q) => q.isFetching),
    isError: queries.some((q) => q.isError),
    errors,
    refetch,
    getByProvider,
    getByWallet,
    getBySymbol,
    getLongs,
    getShorts,
  };
};
