import { useQueries } from '@tanstack/react-query';
import { useMemo, useCallback } from 'react';
import { providers } from '../providers';
import { normalizeWalletsInput, type WalletsParam } from '../utils/chains';
import { formatPositionPrices } from '../utils/formatting';
import type { NormalizedPosition, ProviderId, AsterCredentials, LighterCredentials } from '../types';
import { useHyperliquidPositionsWs } from './useHyperliquidPositionsWs';

/**
 * Credentials for authenticated DEX providers
 */
export interface DexCredentials {
  /** Aster DEX API key */
  asterApiKey?: string;
  /** Aster DEX API secret */
  asterApiSecret?: string;
  /** Lighter read-only API token (format: "ro:YOUR_READ_TOKEN") */
  lighterReadToken?: string;
}

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
  /** Use WebSocket for Hyperliquid positions (requires @hypersignals/dex-ws) (default: false) */
  enableHyperliquidWebSocket?: boolean;
}

export interface UseDexPositionsOptions extends UseDexPositionsConfig {
  /** Wallet address(es) - auto-detects chain type */
  wallets: WalletsParam;
  /** Only include these providers (whitelist) */
  providers?: ProviderId[];
  /** Exclude these providers (blacklist) */
  exclude?: ProviderId[];
  /** Credentials for authenticated providers (e.g., Aster) */
  credentials?: DexCredentials;
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
  /** True if Hyperliquid WebSocket is connected (when enableHyperliquidWebSocket is true) */
  hyperliquidWsConnected: boolean;

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
    credentials,
    enabled = true,
    refetchInterval,
    refetchOnWindowFocus = false,
    staleTime = 30_000,
    retry = 2,
    keepPreviousData = true,
    waitForAll = false,
    formatPrices = false,
    enableHyperliquidWebSocket = false,
  } = options;

  // Build Aster credentials if provided
  const asterCredentials: AsterCredentials | undefined = useMemo(() => {
    if (credentials?.asterApiKey && credentials?.asterApiSecret) {
      return {
        apiKey: credentials.asterApiKey,
        apiSecret: credentials.asterApiSecret,
      };
    }
    return undefined;
  }, [credentials?.asterApiKey, credentials?.asterApiSecret]);

  // Build Lighter credentials if provided
  const lighterCredentials: LighterCredentials | undefined = useMemo(() => {
    if (credentials?.lighterReadToken) {
      return {
        readToken: credentials.lighterReadToken,
      };
    }
    return undefined;
  }, [credentials?.lighterReadToken]);

  // Normalize wallet input to { evm: [], solana: [] }
  const normalizedWallets = useMemo(
    () => normalizeWalletsInput(wallets),
    [wallets]
  );

  // Check if Hyperliquid should use WebSocket
  const useHyperliquidWs = enableHyperliquidWebSocket && normalizedWallets.evm.length > 0;

  // Hyperliquid WebSocket hook (only enabled when useHyperliquidWs is true)
  const hyperliquidWs = useHyperliquidPositionsWs({
    wallets: normalizedWallets.evm,
    enabled: enabled && useHyperliquidWs,
  });

  // Determine which providers to query via REST (exclude Hyperliquid if using WebSocket)
  const activeProviders = useMemo(() => {
    const allProviderIds = Object.keys(providers) as ProviderId[];
    let filtered = includeProviders ?? allProviderIds;

    // Remove excluded providers
    filtered = filtered.filter((id) => !exclude.includes(id));

    // Exclude Hyperliquid from REST if using WebSocket
    if (useHyperliquidWs) {
      filtered = filtered.filter((id) => id !== 'hyperliquid');
    }

    // Only include providers where we have wallets for their chain OR credentials for authenticated providers
    return filtered.filter((id) => {
      const provider = providers[id];

      // For credential-based providers, check if credentials are available
      if (provider.requiresCredentials) {
        if (id === 'aster') {
          return asterCredentials !== undefined;
        }
        // Add other credential-based providers here as needed
        return false;
      }

      // For wallet-based providers, check if we have wallets for their chain
      if (provider.chain === 'evm') return normalizedWallets.evm.length > 0;
      if (provider.chain === 'solana') return normalizedWallets.solana.length > 0;
      if (provider.chain === 'cosmos') return normalizedWallets.cosmos.length > 0;
      return false;
    });
  }, [includeProviders, exclude, normalizedWallets, asterCredentials, useHyperliquidWs]);

  // Create queries for each active provider
  const queries = useQueries({
    queries: activeProviders.map((providerId) => {
      const provider = providers[providerId];

      // Handle credential-based providers (like Aster, Extended)
      if (provider.requiresCredentials) {
        let providerCredentials: unknown;
        let walletId: string;

        if (providerId === 'aster') {
          providerCredentials = asterCredentials;
          walletId = asterCredentials?.apiKey ?? 'unknown';
        } else {
          providerCredentials = undefined;
          walletId = 'unknown';
        }

        return {
          queryKey: ['dex-positions', providerId, walletId],
          queryFn: async (): Promise<{
            providerId: ProviderId;
            positions: NormalizedPosition[];
          }> => {
            const raw = await provider.fetchPositions('', providerCredentials);
            const positions = raw.map((r) =>
              provider.normalizePosition(r, walletId)
            );
            return { providerId, positions };
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
      }

      // Handle wallet-based providers (HyperLiquid, Lighter, Pacifica, dYdX)
      const relevantWallets =
        provider.chain === 'evm'
          ? normalizedWallets.evm
          : provider.chain === 'cosmos'
          ? normalizedWallets.cosmos
          : normalizedWallets.solana;

      // Get credentials for this provider if available
      const providerCredentials = providerId === 'lighter' ? lighterCredentials : undefined;

      return {
        queryKey: ['dex-positions', providerId, ...relevantWallets.sort(), providerCredentials?.readToken ?? ''],
        queryFn: async (): Promise<{
          providerId: ProviderId;
          positions: NormalizedPosition[];
        }> => {
          const results = await Promise.all(
            relevantWallets.map(async (wallet) => {
              const raw = await provider.fetchPositions(wallet, providerCredentials);
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

  // Aggregate all positions (REST + WebSocket) and optionally format prices
  const positions = useMemo(() => {
    // REST positions from queries
    const restPositions = queries.flatMap((q) => q.data?.positions ?? []);

    // Hyperliquid WebSocket positions (if enabled)
    const wsPositions = useHyperliquidWs ? hyperliquidWs.positions : [];

    // Combine all positions
    const allPositions = [...restPositions, ...wsPositions];

    return formatPrices ? allPositions.map(formatPositionPrices) : allPositions;
  }, [queries, formatPrices, useHyperliquidWs, hyperliquidWs.positions]);

  // Collect errors from failed queries (REST + WebSocket)
  const errors = useMemo(() => {
    const restErrors = queries
      .map((q, i) =>
        q.error
          ? { provider: activeProviders[i], error: q.error as Error }
          : null
      )
      .filter((e): e is ProviderError => e !== null);

    // Add Hyperliquid WebSocket error if present
    if (useHyperliquidWs && hyperliquidWs.error) {
      restErrors.push({ provider: 'hyperliquid', error: hyperliquidWs.error });
    }

    return restErrors;
  }, [queries, activeProviders, useHyperliquidWs, hyperliquidWs.error]);

  // Refetch all providers (REST + reconnect WebSocket)
  const refetch = useCallback(() => {
    queries.forEach((q) => q.refetch());
    // Reconnect WebSocket if enabled
    if (useHyperliquidWs) {
      hyperliquidWs.reconnect();
    }
  }, [queries, useHyperliquidWs, hyperliquidWs]);

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

  // Loading state depends on waitForAll flag (includes WebSocket loading)
  // waitForAll=true: loading until ALL providers finish
  // waitForAll=false: loading only on initial load (no data yet)
  const restIsLoading = waitForAll
    ? queries.some((q) => q.isLoading)
    : queries.every((q) => q.isLoading) && queries.length > 0;

  const wsIsLoading = useHyperliquidWs && hyperliquidWs.isLoading;

  const isLoading = waitForAll
    ? restIsLoading || wsIsLoading
    : (restIsLoading || wsIsLoading) && positions.length === 0;

  const isFetching = queries.some((q) => q.isFetching);
  const isError = queries.some((q) => q.isError) || (useHyperliquidWs && hyperliquidWs.error !== null);

  return {
    positions,
    isLoading,
    isFetching,
    isError,
    errors,
    refetch,
    hyperliquidWsConnected: useHyperliquidWs ? hyperliquidWs.isConnected : false,
    getByProvider,
    getByWallet,
    getBySymbol,
    getLongs,
    getShorts,
  };
};
