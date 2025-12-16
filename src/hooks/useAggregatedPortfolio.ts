/**
 * React hook for aggregated portfolio data across all DEXes
 * Provides total account balance, PnL, unrealized PnL, and composite leverage
 */

import { useQueries } from '@tanstack/react-query';
import { useMemo, useCallback } from 'react';
import type { ProviderId, NormalizedPosition, LighterCredentials, ExtendedCredentials } from '../types';
import { providers } from '../providers';
import { fetchTotalPnl as fetchLighterTotalPnl } from '../providers/lighter';
import { fetchBalance as fetchExtendedBalance } from '../providers/extended';
import { normalizeWalletsInput, type WalletsParam } from '../utils/chains';
import type { DexCredentials } from './useDexPositions';

// ============================================
// Types
// ============================================

/**
 * Account summary data from a DEX
 */
export interface DexAccountSummary {
  /** Account equity/balance in USD */
  accountBalance: number;
  /** Total trading volume (0 for now) */
  totalVolume: number;
  /** Total realized PnL */
  totalPnl: number;
}

/**
 * Per-DEX breakdown (null if no data for that DEX)
 */
export type PerDexBreakdown = {
  [K in ProviderId]?: DexAccountSummary | null;
};

/**
 * Aggregated portfolio result
 */
export interface AggregatedPortfolioData {
  /** Total account balance across all DEXes */
  totalAccountBalance: number;
  /** Total trading volume (0 for now) */
  totalVolume: number;
  /** Total realized PnL across all DEXes */
  totalPnl: number;
  /** Total unrealized PnL from open positions */
  totalUnrealizedPnl: number;
  /** Composite leverage: Total Notional / Total Equity */
  compositeLeverage: number;
  /** Per-DEX breakdown */
  perDex: PerDexBreakdown;
}

/**
 * Configuration options for useAggregatedPortfolio
 */
export interface UseAggregatedPortfolioConfig {
  /** Enable/disable the query (default: true) */
  enabled?: boolean;
  /** Refetch interval in milliseconds (default: false) */
  refetchInterval?: number | false;
  /** Refetch when window regains focus (default: false) */
  refetchOnWindowFocus?: boolean;
  /** Time in ms before data is considered stale (default: 30000) */
  staleTime?: number;
  /** Number of retry attempts (default: 2) */
  retry?: number | boolean;
}

/**
 * Options passed to useAggregatedPortfolio hook
 */
export interface UseAggregatedPortfolioOptions extends UseAggregatedPortfolioConfig {
  /** Wallet address(es) - auto-detects chain type */
  wallets: WalletsParam;
  /** Credentials for authenticated providers */
  credentials?: DexCredentials;
  /** Only include these providers (whitelist) */
  providers?: ProviderId[];
  /** Exclude these providers (blacklist) */
  exclude?: ProviderId[];
}

/**
 * Per-DEX loading states
 */
export interface PerDexLoadingStates {
  hyperliquid: boolean;
  lighter: boolean;
  pacifica: boolean;
  extended: boolean;
}

/**
 * Result returned by useAggregatedPortfolio hook
 */
export interface UseAggregatedPortfolioResult {
  /** Aggregated portfolio data */
  data: AggregatedPortfolioData | null;
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
  /** Per-DEX loading states (true while loading) */
  loadingStates: PerDexLoadingStates;
}

// ============================================
// Account Summary Fetchers
// ============================================

/**
 * Fetch HyperLiquid account summary
 * - Account balance from clearinghouseState
 * - Volume from portfolio API (perpAllTime.vlm)
 */
const fetchHyperliquidAccountSummary = async (
  wallets: string[]
): Promise<{ accountBalance: number; totalVolume: number; totalPnl: number }> => {
  if (wallets.length === 0) {
    return { accountBalance: 0, totalVolume: 0, totalPnl: 0 };
  }

  const API_URL = 'https://api.hyperliquid.xyz/info';

  // Fetch clearinghouse state and portfolio for each wallet
  const results = await Promise.all(
    wallets.map(async (wallet) => {
      try {
        // Fetch both in parallel
        const [clearinghouseResponse, portfolioResponse] = await Promise.all([
          fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              type: 'clearinghouseState',
              user: wallet,
            }),
          }),
          fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              type: 'portfolio',
              user: wallet,
            }),
          }),
        ]);

        let accountValue = 0;
        let totalPnl = 0;
        let volume = 0;

        // Parse clearinghouse state
        if (clearinghouseResponse.ok) {
          const data = await clearinghouseResponse.json();
          accountValue = parseFloat(data.marginSummary?.accountValue ?? '0');

          // Sum unrealized PnL from positions
          totalPnl = (data.assetPositions ?? []).reduce(
            (sum: number, pos: { position?: { unrealizedPnl?: string } }) =>
              sum + parseFloat(pos.position?.unrealizedPnl ?? '0'),
            0
          );
        }

        // Parse portfolio for volume (perpAllTime.vlm)
        if (portfolioResponse.ok) {
          const portfolioData: [string, { vlm?: string }][] = await portfolioResponse.json();
          const allTimeEntry = portfolioData.find(([key]) => key === 'perpAllTime');
          if (allTimeEntry) {
            volume = parseFloat(allTimeEntry[1].vlm ?? '0');
          }
        }

        return { accountValue, totalPnl, volume };
      } catch {
        return { accountValue: 0, totalPnl: 0, volume: 0 };
      }
    })
  );

  return {
    accountBalance: results.reduce((sum, r) => sum + r.accountValue, 0),
    totalVolume: results.reduce((sum, r) => sum + r.volume, 0),
    totalPnl: results.reduce((sum, r) => sum + r.totalPnl, 0),
  };
};

/**
 * Fetch Lighter account summary (account value + total PnL from PnL endpoint)
 * @param wallets - EVM wallet addresses
 * @param readToken - Optional Lighter read-only API token
 */
const fetchLighterAccountSummary = async (
  wallets: string[],
  readToken?: string
): Promise<{ accountBalance: number; totalVolume: number; totalPnl: number }> => {
  if (wallets.length === 0) {
    return { accountBalance: 0, totalVolume: 0, totalPnl: 0 };
  }

  const BASE_URL = 'https://mainnet.zklighter.elliot.ai';
  const credentials: LighterCredentials | undefined = readToken ? { readToken } : undefined;

  const results = await Promise.all(
    wallets.map(async (wallet) => {
      try {
        // Fetch account data and total PnL in parallel
        let url = `${BASE_URL}/api/v1/account?by=l1_address&value=${wallet}`;
        if (readToken) {
          url += `&auth=${readToken}`;
        }

        const [accountResponse, totalPnl] = await Promise.all([
          fetch(url),
          fetchLighterTotalPnl(wallet, credentials),
        ]);

        let totalAssetValue = 0;

        if (accountResponse.ok) {
          const data = await accountResponse.json();
          const accounts = data.accounts ?? [];

          // Sum account values from all accounts
          for (const account of accounts) {
            // Use total_asset_value for account balance (includes unrealized PnL)
            // Fall back to collateral if total_asset_value not available
            totalAssetValue += parseFloat(account.total_asset_value ?? account.collateral ?? '0');
          }
        }

        return { totalAssetValue, totalPnl };
      } catch {
        return { totalAssetValue: 0, totalPnl: 0 };
      }
    })
  );

  return {
    accountBalance: results.reduce((sum, r) => sum + r.totalAssetValue, 0),
    totalVolume: 0, // Volume not available from Lighter API
    totalPnl: results.reduce((sum, r) => sum + r.totalPnl, 0),
  };
};

/**
 * Fetch Pacifica account summary
 * Uses portfolio endpoint to get latest account equity
 */
const fetchPacificaAccountSummary = async (
  wallets: string[]
): Promise<{ accountBalance: number; totalVolume: number; totalPnl: number }> => {
  if (wallets.length === 0) {
    return { accountBalance: 0, totalVolume: 0, totalPnl: 0 };
  }

  const BASE_URL = 'https://api.pacifica.fi/api/v1';

  const results = await Promise.all(
    wallets.map(async (wallet) => {
      try {
        // Fetch portfolio to get latest account equity
        const response = await fetch(
          `${BASE_URL}/portfolio?account=${wallet}&time_range=1d`
        );

        if (!response.ok) {
          return { accountEquity: 0, totalPnl: 0 };
        }

        const data = await response.json();

        if (!data.success || !data.data || data.data.length === 0) {
          return { accountEquity: 0, totalPnl: 0 };
        }

        // Get latest entry (last in array)
        const latest = data.data[data.data.length - 1];
        const accountEquity = parseFloat(latest.account_equity ?? '0');
        const totalPnl = parseFloat(latest.pnl ?? '0');

        return { accountEquity, totalPnl };
      } catch {
        return { accountEquity: 0, totalPnl: 0 };
      }
    })
  );

  return {
    accountBalance: results.reduce((sum, r) => sum + r.accountEquity, 0),
    totalVolume: 0, // Volume not available from Pacifica API
    totalPnl: results.reduce((sum, r) => sum + r.totalPnl, 0),
  };
};

/**
 * Fetch Extended account summary
 * Uses /user/balance endpoint - requires API key
 * @param credentials - Extended API credentials
 */
const fetchExtendedAccountSummary = async (
  credentials?: ExtendedCredentials
): Promise<{ accountBalance: number; totalVolume: number; totalPnl: number; unrealizedPnl: number }> => {
  if (!credentials?.apiKey) {
    return { accountBalance: 0, totalVolume: 0, totalPnl: 0, unrealizedPnl: 0 };
  }

  try {
    const balance = await fetchExtendedBalance(credentials);

    return {
      accountBalance: parseFloat(balance.equity ?? '0'),
      totalVolume: 0, // Volume not available without pagination
      totalPnl: 0, // Total realized PnL not available without pagination
      unrealizedPnl: parseFloat(balance.unrealisedPnl ?? '0'),
    };
  } catch {
    return { accountBalance: 0, totalVolume: 0, totalPnl: 0, unrealizedPnl: 0 };
  }
};

// ============================================
// Hook
// ============================================

/**
 * Fetch aggregated portfolio data across all DEXes
 *
 * @example
 * ```tsx
 * const { data, isLoading } = useAggregatedPortfolio({
 *   wallets: ['0x123...', 'Solana...'],
 * });
 *
 * if (data) {
 *   console.log('Total Balance:', data.totalAccountBalance);
 *   console.log('Composite Leverage:', data.compositeLeverage);
 *   console.log('HyperLiquid:', data.perDex.hyperliquid?.accountBalance);
 * }
 * ```
 */
export function useAggregatedPortfolio(
  options: UseAggregatedPortfolioOptions
): UseAggregatedPortfolioResult {
  const {
    wallets,
    credentials,
    providers: includeProviders,
    exclude = [],
    enabled = true,
    refetchInterval,
    refetchOnWindowFocus = false,
    staleTime = 30_000,
    retry = 2,
  } = options;

  // Extract credentials
  const lighterReadToken = credentials?.lighterReadToken;
  const extendedCredentials: ExtendedCredentials | undefined = useMemo(() => {
    if (credentials?.extendedApiKey) {
      return { apiKey: credentials.extendedApiKey };
    }
    return undefined;
  }, [credentials?.extendedApiKey]);

  // Normalize wallet input
  const normalizedWallets = useMemo(
    () => normalizeWalletsInput(wallets),
    [wallets]
  );

  // Determine active providers
  const activeProviders = useMemo(() => {
    const allProviderIds = Object.keys(providers) as ProviderId[];
    let filtered = includeProviders ?? allProviderIds;

    // Remove excluded providers
    filtered = filtered.filter((id) => !exclude.includes(id));

    // Filter providers based on credentials or wallet availability
    filtered = filtered.filter((id) => {
      const provider = providers[id];

      // Extended: include if we have credentials
      if (id === 'extended') {
        return extendedCredentials !== undefined;
      }

      // Aster: skip for now (no balance endpoint implemented)
      if (id === 'aster') {
        return false;
      }

      // Wallet-based providers: include if we have wallets for their chain
      if (provider.chain === 'evm') return normalizedWallets.evm.length > 0;
      if (provider.chain === 'solana') return normalizedWallets.solana.length > 0;
      return false;
    });

    return filtered;
  }, [includeProviders, exclude, normalizedWallets, extendedCredentials]);

  // Fetch positions from all providers (for unrealized PnL and notional)
  const positionQueries = useQueries({
    queries: activeProviders
      .filter((id) => id !== 'extended') // Extended positions are fetched separately via credentials
      .map((providerId) => {
        const provider = providers[providerId];
        const relevantWallets =
          provider.chain === 'evm'
            ? normalizedWallets.evm
            : normalizedWallets.solana;

        // Get credentials for this provider if available
        const providerCredentials = providerId === 'lighter' && lighterReadToken
          ? { readToken: lighterReadToken }
          : undefined;

        return {
          queryKey: ['aggregated-positions', providerId, ...relevantWallets.sort(), lighterReadToken ?? ''],
          queryFn: async (): Promise<{
            providerId: ProviderId;
            positions: NormalizedPosition[];
          }> => {
            const results = await Promise.all(
              relevantWallets.map(async (wallet) => {
                try {
                  const raw = await provider.fetchPositions(wallet, providerCredentials);
                  return raw.map((r) => provider.normalizePosition(r, wallet));
                } catch {
                  return [];
                }
              })
            );
            return { providerId, positions: results.flat() };
          },
          enabled,
          refetchInterval,
          refetchOnWindowFocus,
          staleTime,
          retry,
        };
      }),
  });

  // Fetch account summaries from each provider
  // Order: [0] = hyperliquid, [1] = lighter, [2] = pacifica, [3] = extended
  const accountQueries = useQueries({
    queries: [
      {
        queryKey: ['account-summary', 'hyperliquid', ...normalizedWallets.evm.sort()],
        queryFn: () => fetchHyperliquidAccountSummary(normalizedWallets.evm),
        enabled: enabled && activeProviders.includes('hyperliquid'),
        refetchInterval,
        refetchOnWindowFocus,
        staleTime,
        retry,
      },
      {
        queryKey: ['account-summary', 'lighter', ...normalizedWallets.evm.sort(), lighterReadToken ?? ''],
        queryFn: () => fetchLighterAccountSummary(normalizedWallets.evm, lighterReadToken),
        enabled: enabled && activeProviders.includes('lighter'),
        refetchInterval,
        refetchOnWindowFocus,
        staleTime,
        retry,
      },
      {
        queryKey: ['account-summary', 'pacifica', ...normalizedWallets.solana.sort()],
        queryFn: () => fetchPacificaAccountSummary(normalizedWallets.solana),
        enabled: enabled && activeProviders.includes('pacifica'),
        refetchInterval,
        refetchOnWindowFocus,
        staleTime,
        retry,
      },
      {
        queryKey: ['account-summary', 'extended', extendedCredentials?.apiKey ?? ''],
        queryFn: () => fetchExtendedAccountSummary(extendedCredentials),
        enabled: enabled && activeProviders.includes('extended'),
        refetchInterval,
        refetchOnWindowFocus,
        staleTime,
        retry,
      },
    ],
  });

  // Aggregate data
  const data = useMemo((): AggregatedPortfolioData | null => {
    // Check if we have any data
    const hasPositionData = positionQueries.some((q) => q.data !== undefined);
    const hasAccountData = accountQueries.some((q) => q.data !== undefined);

    if (!hasPositionData && !hasAccountData) {
      return null;
    }

    // Get all positions
    const allPositions = positionQueries.flatMap((q) => q.data?.positions ?? []);

    // Calculate totals from positions
    let totalUnrealizedPnl = 0;
    let totalNotional = 0;

    for (const pos of allPositions) {
      totalUnrealizedPnl += parseFloat(pos.unrealizedPnl ?? '0');
      // Notional = |size * markPrice|
      const size = parseFloat(pos.size ?? '0');
      const markPrice = parseFloat(pos.markPrice ?? pos.entryPrice ?? '0');
      totalNotional += Math.abs(size * markPrice);
    }

    // Get account summaries (order: [0]=hl, [1]=lighter, [2]=pacifica, [3]=extended)
    const hlSummary = activeProviders.includes('hyperliquid') ? accountQueries[0].data : null;
    const lighterSummary = activeProviders.includes('lighter') ? accountQueries[1].data : null;
    const pacificaSummary = activeProviders.includes('pacifica') ? accountQueries[2].data : null;
    const extendedSummary = activeProviders.includes('extended') ? accountQueries[3].data : null;

    // Add Extended's unrealized PnL (from balance endpoint) to total
    // Extended returns unrealizedPnl directly from balance API
    const extendedUnrealizedPnl = (extendedSummary as { unrealizedPnl?: number } | null)?.unrealizedPnl ?? 0;

    // Calculate totals
    const totalAccountBalance =
      (hlSummary?.accountBalance ?? 0) +
      (lighterSummary?.accountBalance ?? 0) +
      (pacificaSummary?.accountBalance ?? 0) +
      (extendedSummary?.accountBalance ?? 0);

    const totalPnl =
      (hlSummary?.totalPnl ?? 0) +
      (lighterSummary?.totalPnl ?? 0) +
      (pacificaSummary?.totalPnl ?? 0) +
      (extendedSummary?.totalPnl ?? 0);

    // Total volume (currently only HyperLiquid provides this)
    const totalVolume =
      (hlSummary?.totalVolume ?? 0) +
      (lighterSummary?.totalVolume ?? 0) +
      (pacificaSummary?.totalVolume ?? 0) +
      (extendedSummary?.totalVolume ?? 0);

    // Add Extended unrealized PnL to total
    totalUnrealizedPnl += extendedUnrealizedPnl;

    // Composite leverage = Total Notional / Total Equity
    const compositeLeverage = totalAccountBalance > 0
      ? totalNotional / totalAccountBalance
      : 0;

    // Build per-DEX breakdown
    const perDex: PerDexBreakdown = {};

    if (activeProviders.includes('hyperliquid')) {
      perDex.hyperliquid = hlSummary
        ? {
            accountBalance: hlSummary.accountBalance,
            totalVolume: hlSummary.totalVolume,
            totalPnl: hlSummary.totalPnl,
          }
        : null;
    }

    if (activeProviders.includes('lighter')) {
      perDex.lighter = lighterSummary
        ? {
            accountBalance: lighterSummary.accountBalance,
            totalVolume: lighterSummary.totalVolume,
            totalPnl: lighterSummary.totalPnl,
          }
        : null;
    }

    if (activeProviders.includes('pacifica')) {
      perDex.pacifica = pacificaSummary
        ? {
            accountBalance: pacificaSummary.accountBalance,
            totalVolume: pacificaSummary.totalVolume,
            totalPnl: pacificaSummary.totalPnl,
          }
        : null;
    }

    if (activeProviders.includes('extended')) {
      perDex.extended = extendedSummary
        ? {
            accountBalance: extendedSummary.accountBalance,
            totalVolume: extendedSummary.totalVolume,
            totalPnl: extendedSummary.totalPnl,
          }
        : null;
    }

    return {
      totalAccountBalance,
      totalVolume,
      totalPnl,
      totalUnrealizedPnl,
      compositeLeverage,
      perDex,
    };
  }, [positionQueries, accountQueries, activeProviders]);

  // Refetch all
  const refetch = useCallback(() => {
    positionQueries.forEach((q) => q.refetch());
    accountQueries.forEach((q) => q.refetch());
  }, [positionQueries, accountQueries]);

  // Loading/error states
  const isLoading =
    positionQueries.some((q) => q.isLoading) ||
    accountQueries.some((q) => q.isLoading);

  const isFetching =
    positionQueries.some((q) => q.isFetching) ||
    accountQueries.some((q) => q.isFetching);

  const isError =
    positionQueries.some((q) => q.isError) ||
    accountQueries.some((q) => q.isError);

  const error =
    positionQueries.find((q) => q.error)?.error ??
    accountQueries.find((q) => q.error)?.error ??
    null;

  // Per-DEX loading states
  // Account queries are indexed: [0] = hyperliquid, [1] = lighter, [2] = pacifica, [3] = extended
  // Position queries are indexed by activeProviders order (excluding extended)
  const loadingStates: PerDexLoadingStates = useMemo(() => {
    // Position queries exclude extended, so filter activeProviders accordingly
    const positionProviders = activeProviders.filter((id) => id !== 'extended');
    const hlPositionIdx = positionProviders.indexOf('hyperliquid');
    const lighterPositionIdx = positionProviders.indexOf('lighter');
    const pacificaPositionIdx = positionProviders.indexOf('pacifica');

    return {
      hyperliquid:
        (activeProviders.includes('hyperliquid') && accountQueries[0]?.isLoading) ||
        (hlPositionIdx >= 0 && positionQueries[hlPositionIdx]?.isLoading) ||
        false,
      lighter:
        (activeProviders.includes('lighter') && accountQueries[1]?.isLoading) ||
        (lighterPositionIdx >= 0 && positionQueries[lighterPositionIdx]?.isLoading) ||
        false,
      pacifica:
        (activeProviders.includes('pacifica') && accountQueries[2]?.isLoading) ||
        (pacificaPositionIdx >= 0 && positionQueries[pacificaPositionIdx]?.isLoading) ||
        false,
      extended:
        (activeProviders.includes('extended') && accountQueries[3]?.isLoading) ||
        false,
    };
  }, [activeProviders, accountQueries, positionQueries]);

  return {
    data,
    isLoading,
    isFetching,
    isError,
    error: error as Error | null,
    refetch,
    loadingStates,
  };
}
