/**
 * React hook for aggregated portfolio data across all DEXes
 * Provides total account balance, PnL, unrealized PnL, and composite leverage
 */

import { useQueries } from '@tanstack/react-query';
import { useMemo, useCallback } from 'react';
import type { ProviderId, NormalizedPosition, LighterCredentials } from '../types';
import { providers } from '../providers';
import { fetchTotalPnl as fetchLighterTotalPnl } from '../providers/lighter';
import { fetchVolume as fetchPacificaVolume, fetchTotalPnl as fetchPacificaTotalPnl } from '../providers/pacifica';
import { fetchSubaccount as fetchDydxSubaccount, fetchTotalPnl as fetchDydxTotalPnl } from '../providers/dydx';
import { normalizeWalletsInput, type WalletsParam } from '../utils/chains';
import { useLighterVolumeWs } from './useLighterVolumeWs';
import { useHyperliquidPositionsWs } from './useHyperliquidPositionsWs';
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
  /** Total trading volume */
  totalVolume: number;
  /** Total realized PnL */
  totalPnl: number;
  /** Total unrealized PnL from open positions */
  unrealizedPnl: number;
  /** Total size in USD (notional) from open positions */
  sizeUsd: number;
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
  /** Total trading volume */
  totalVolume: number;
  /** Total realized PnL across all DEXes */
  totalPnl: number;
  /** Total unrealized PnL from open positions */
  totalUnrealizedPnl: number;
  /** Total size in USD (notional) from all open positions */
  totalSizeUsd: number;
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
  /** Enable Lighter volume via WebSocket (requires @hypersignals/dex-ws) */
  enableLighterWebSocket?: boolean;
  /** Enable Hyperliquid via WebSocket for positions and account data (requires @hypersignals/dex-ws) */
  enableHyperliquidWebSocket?: boolean;
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
  dydx: boolean;
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
 * Fetch HyperLiquid portfolio stats (volume + totalPnl) from REST API
 * Used when WebSocket is enabled for account data but we still need portfolio stats
 */
const fetchHyperliquidPortfolioStats = async (
  wallets: string[]
): Promise<{ totalVolume: number; totalPnl: number }> => {
  if (wallets.length === 0) {
    return { totalVolume: 0, totalPnl: 0 };
  }

  const API_URL = 'https://api.hyperliquid.xyz/info';

  const results = await Promise.all(
    wallets.map(async (wallet) => {
      try {
        const response = await fetch(API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'portfolio',
            user: wallet,
          }),
        });

        let totalPnl = 0;
        let volume = 0;

        if (response.ok) {
          const portfolioData: [string, { vlm?: string; pnlHistory?: [number, string][] }][] = await response.json();
          const allTimeEntry = portfolioData.find(([key]) => key === 'perpAllTime');
          if (allTimeEntry) {
            volume = parseFloat(allTimeEntry[1].vlm ?? '0');
            const pnlHistory = allTimeEntry[1].pnlHistory ?? [];
            if (pnlHistory.length > 0) {
              totalPnl = parseFloat(pnlHistory[pnlHistory.length - 1][1] ?? '0');
            }
          }
        }

        return { totalPnl, volume };
      } catch {
        return { totalPnl: 0, volume: 0 };
      }
    })
  );

  return {
    totalVolume: results.reduce((sum, r) => sum + r.volume, 0),
    totalPnl: results.reduce((sum, r) => sum + r.totalPnl, 0),
  };
};

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

        // Parse clearinghouse state for account value
        if (clearinghouseResponse.ok) {
          const data = await clearinghouseResponse.json();
          accountValue = parseFloat(data.marginSummary?.accountValue ?? '0');
        }

        // Parse portfolio for volume and total PnL (perpAllTime)
        if (portfolioResponse.ok) {
          const portfolioData: [string, { vlm?: string; pnlHistory?: [number, string][] }][] = await portfolioResponse.json();
          const allTimeEntry = portfolioData.find(([key]) => key === 'perpAllTime');
          if (allTimeEntry) {
            volume = parseFloat(allTimeEntry[1].vlm ?? '0');
            // Get total PnL from last entry of pnlHistory
            const pnlHistory = allTimeEntry[1].pnlHistory ?? [];
            if (pnlHistory.length > 0) {
              totalPnl = parseFloat(pnlHistory[pnlHistory.length - 1][1] ?? '0');
            }
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
 * Uses portfolio endpoint for equity, volume endpoint for volume, and all-time PnL
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
        // Fetch account equity (1d for latest), volume, and all-time PnL in parallel
        const [portfolioResponse, volume, totalPnl] = await Promise.all([
          fetch(`${BASE_URL}/portfolio?account=${wallet}&time_range=1d`),
          fetchPacificaVolume(wallet),
          fetchPacificaTotalPnl(wallet),
        ]);

        let accountEquity = 0;

        if (portfolioResponse.ok) {
          const data = await portfolioResponse.json();
          if (data.success && data.data && data.data.length > 0) {
            // Get latest entry (last in array)
            const latest = data.data[data.data.length - 1];
            accountEquity = parseFloat(latest.account_equity ?? '0');
          }
        }

        return { accountEquity, volume, totalPnl };
      } catch {
        return { accountEquity: 0, volume: 0, totalPnl: 0 };
      }
    })
  );

  return {
    accountBalance: results.reduce((sum, r) => sum + r.accountEquity, 0),
    totalVolume: results.reduce((sum, r) => sum + r.volume, 0),
    totalPnl: results.reduce((sum, r) => sum + r.totalPnl, 0),
  };
};

/**
 * Fetch dYdX account summary
 * Uses subaccount endpoint for equity and historical PnL endpoint for total PnL
 */
const fetchDydxAccountSummary = async (
  wallets: string[]
): Promise<{ accountBalance: number; totalVolume: number; totalPnl: number }> => {
  if (wallets.length === 0) {
    return { accountBalance: 0, totalVolume: 0, totalPnl: 0 };
  }

  const results = await Promise.all(
    wallets.map(async (wallet) => {
      try {
        // Fetch subaccount (for equity) and total PnL in parallel
        const [subaccountData, totalPnl] = await Promise.all([
          fetchDydxSubaccount(wallet),
          fetchDydxTotalPnl(wallet),
        ]);

        const accountEquity = parseFloat(subaccountData?.subaccount?.equity ?? '0');

        return { accountEquity, totalPnl };
      } catch {
        return { accountEquity: 0, totalPnl: 0 };
      }
    })
  );

  return {
    accountBalance: results.reduce((sum, r) => sum + r.accountEquity, 0),
    totalVolume: 0, // dYdX doesn't have a volume endpoint
    totalPnl: results.reduce((sum, r) => sum + r.totalPnl, 0),
  };
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
    enableLighterWebSocket = false,
    enableHyperliquidWebSocket = false,
  } = options;

  // Extract credentials
  const lighterReadToken = credentials?.lighterReadToken;

  // Normalize wallet input
  const normalizedWallets = useMemo(
    () => normalizeWalletsInput(wallets),
    [wallets]
  );

  // Lighter volume via WebSocket (optional)
  const lighterVolumeWs = useLighterVolumeWs({
    wallets: normalizedWallets.evm,
    readToken: lighterReadToken,
    enabled: enabled && enableLighterWebSocket && normalizedWallets.evm.length > 0,
  });

  // Check if Hyperliquid should use WebSocket
  const useHyperliquidWs = enableHyperliquidWebSocket && normalizedWallets.evm.length > 0;

  // Hyperliquid WebSocket for positions and account data (optional)
  const hyperliquidWs = useHyperliquidPositionsWs({
    wallets: normalizedWallets.evm,
    enabled: enabled && useHyperliquidWs,
  });

  // Determine active providers (for account summary queries - NOT position queries)
  const activeProviders = useMemo(() => {
    const allProviderIds = Object.keys(providers) as ProviderId[];
    let filtered = includeProviders ?? allProviderIds;

    // Remove excluded providers
    filtered = filtered.filter((id) => !exclude.includes(id));

    // Filter providers based on credentials or wallet availability
    filtered = filtered.filter((id) => {
      const provider = providers[id];

      // Aster: skip for now (no balance endpoint implemented)
      if (id === 'aster') {
        return false;
      }

      // Wallet-based providers: include if we have wallets for their chain
      if (provider.chain === 'evm') return normalizedWallets.evm.length > 0;
      if (provider.chain === 'solana') return normalizedWallets.solana.length > 0;
      if (provider.chain === 'cosmos') return normalizedWallets.cosmos.length > 0;
      return false;
    });

    return filtered;
  }, [includeProviders, exclude, normalizedWallets]);

  // Providers for REST position queries (exclude Hyperliquid if using WebSocket)
  const positionProviders = useMemo(() => {
    if (useHyperliquidWs) {
      return activeProviders.filter((id) => id !== 'hyperliquid');
    }
    return activeProviders;
  }, [activeProviders, useHyperliquidWs]);

  // Fetch positions from providers via REST (exclude Hyperliquid if using WebSocket)
  const positionQueries = useQueries({
    queries: positionProviders.map((providerId) => {
        const provider = providers[providerId];
        const relevantWallets =
          provider.chain === 'evm'
            ? normalizedWallets.evm
            : provider.chain === 'cosmos'
            ? normalizedWallets.cosmos
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
  // Order: [0] = hyperliquid (skipped if using WebSocket), [1] = lighter, [2] = pacifica, [3] = dydx, [4] = hyperliquid portfolio stats (when using WebSocket)
  const accountQueries = useQueries({
    queries: [
      {
        queryKey: ['account-summary', 'hyperliquid', ...normalizedWallets.evm.sort()],
        queryFn: () => fetchHyperliquidAccountSummary(normalizedWallets.evm),
        // Skip REST if using WebSocket for Hyperliquid
        enabled: enabled && activeProviders.includes('hyperliquid') && !useHyperliquidWs,
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
        queryKey: ['account-summary', 'dydx', ...normalizedWallets.cosmos.sort()],
        queryFn: () => fetchDydxAccountSummary(normalizedWallets.cosmos),
        enabled: enabled && activeProviders.includes('dydx'),
        refetchInterval,
        refetchOnWindowFocus,
        staleTime,
        retry,
      },
      // Hyperliquid portfolio stats (volume + totalPnl) - only when using WebSocket for account data
      {
        queryKey: ['portfolio-stats', 'hyperliquid', ...normalizedWallets.evm.sort()],
        queryFn: () => fetchHyperliquidPortfolioStats(normalizedWallets.evm),
        // Only fetch when WebSocket is enabled (account data comes from WS, but volume/pnl from REST)
        enabled: enabled && activeProviders.includes('hyperliquid') && useHyperliquidWs,
        refetchInterval,
        refetchOnWindowFocus,
        staleTime,
        retry,
      },
    ],
  });

  // Aggregate data
  const data = useMemo((): AggregatedPortfolioData | null => {
    // Check if we have any data (including WebSocket data)
    const hasPositionData = positionQueries.some((q) => q.data !== undefined);
    const hasAccountData = accountQueries.some((q) => q.data !== undefined);
    const hasHyperliquidWsData = useHyperliquidWs && hyperliquidWs.wallets.length > 0;

    if (!hasPositionData && !hasAccountData && !hasHyperliquidWsData) {
      return null;
    }

    // Get all positions (REST + WebSocket)
    const restPositions = positionQueries.flatMap((q) => q.data?.positions ?? []);
    const wsPositions = useHyperliquidWs ? hyperliquidWs.positions : [];
    const allPositions = [...restPositions, ...wsPositions];

    // Calculate totals and per-DEX breakdown from positions
    let totalUnrealizedPnl = 0;
    let totalSizeUsd = 0;

    // Per-DEX position stats
    const perDexPositionStats: Record<ProviderId, { unrealizedPnl: number; sizeUsd: number }> = {
      hyperliquid: { unrealizedPnl: 0, sizeUsd: 0 },
      lighter: { unrealizedPnl: 0, sizeUsd: 0 },
      pacifica: { unrealizedPnl: 0, sizeUsd: 0 },
      aster: { unrealizedPnl: 0, sizeUsd: 0 },
      dydx: { unrealizedPnl: 0, sizeUsd: 0 },
    };

    for (const pos of allPositions) {
      const unrealizedPnl = parseFloat(pos.unrealizedPnl ?? '0');
      totalUnrealizedPnl += unrealizedPnl;

      // Use sizeUsd if available, otherwise calculate from size * markPrice
      let sizeUsd: number;
      if (pos.sizeUsd) {
        sizeUsd = Math.abs(parseFloat(pos.sizeUsd));
      } else {
        const size = parseFloat(pos.size ?? '0');
        const markPrice = parseFloat(pos.markPrice ?? pos.entryPrice ?? '0');
        sizeUsd = Math.abs(size * markPrice);
      }
      totalSizeUsd += sizeUsd;

      // Aggregate per provider
      if (perDexPositionStats[pos.provider]) {
        perDexPositionStats[pos.provider].unrealizedPnl += unrealizedPnl;
        perDexPositionStats[pos.provider].sizeUsd += sizeUsd;
      }
    }

    // Get account summaries (order: [0]=hl, [1]=lighter, [2]=pacifica, [3]=dydx, [4]=hl portfolio stats)
    // For Hyperliquid, use WebSocket data for account balance, but REST for volume/totalPnl
    let hlAccountBalance = 0;
    let hlTotalVolume = 0;
    let hlTotalPnl = 0;

    if (activeProviders.includes('hyperliquid')) {
      if (useHyperliquidWs) {
        // Account balance from WebSocket
        for (const walletData of hyperliquidWs.wallets) {
          const state = walletData.clearinghouseState;
          if (state) {
            hlAccountBalance += parseFloat(state.marginSummary.accountValue);
          }
        }
        // Volume and totalPnl from REST portfolio stats query [4]
        const hlPortfolioStats = accountQueries[4]?.data as { totalVolume: number; totalPnl: number } | undefined;
        hlTotalVolume = hlPortfolioStats?.totalVolume ?? 0;
        hlTotalPnl = hlPortfolioStats?.totalPnl ?? 0;
      } else {
        const hlSummary = accountQueries[0].data;
        hlAccountBalance = hlSummary?.accountBalance ?? 0;
        hlTotalVolume = hlSummary?.totalVolume ?? 0;
        hlTotalPnl = hlSummary?.totalPnl ?? 0;
      }
    }

    const lighterSummary = activeProviders.includes('lighter') ? accountQueries[1].data : null;
    const pacificaSummary = activeProviders.includes('pacifica') ? accountQueries[2].data : null;
    const dydxSummary = activeProviders.includes('dydx') ? accountQueries[3].data : null;

    // Calculate totals
    const totalAccountBalance =
      hlAccountBalance +
      (lighterSummary?.accountBalance ?? 0) +
      (pacificaSummary?.accountBalance ?? 0) +
      (dydxSummary?.accountBalance ?? 0);

    const totalPnl =
      hlTotalPnl +
      (lighterSummary?.totalPnl ?? 0) +
      (pacificaSummary?.totalPnl ?? 0) +
      (dydxSummary?.totalPnl ?? 0);

    // Lighter volume from WebSocket (if enabled) or REST (0)
    const lighterVolume = enableLighterWebSocket
      ? lighterVolumeWs.totalVolume
      : (lighterSummary?.totalVolume ?? 0);

    // Total volume
    const totalVolume =
      hlTotalVolume +
      lighterVolume +
      (pacificaSummary?.totalVolume ?? 0) +
      (dydxSummary?.totalVolume ?? 0);

    // Composite leverage = Total Size USD / Total Equity
    const compositeLeverage = totalAccountBalance > 0
      ? totalSizeUsd / totalAccountBalance
      : 0;

    // Build per-DEX breakdown
    const perDex: PerDexBreakdown = {};

    if (activeProviders.includes('hyperliquid')) {
      // Use WebSocket data if enabled, otherwise REST
      const hasHlData = useHyperliquidWs ? hlAccountBalance > 0 : accountQueries[0].data !== null;
      perDex.hyperliquid = hasHlData
        ? {
            accountBalance: hlAccountBalance,
            totalVolume: hlTotalVolume,
            totalPnl: hlTotalPnl,
            unrealizedPnl: perDexPositionStats.hyperliquid.unrealizedPnl,
            sizeUsd: perDexPositionStats.hyperliquid.sizeUsd,
          }
        : null;
    }

    if (activeProviders.includes('lighter')) {
      perDex.lighter = lighterSummary
        ? {
            accountBalance: lighterSummary.accountBalance,
            totalVolume: lighterVolume,
            totalPnl: lighterSummary.totalPnl,
            unrealizedPnl: perDexPositionStats.lighter.unrealizedPnl,
            sizeUsd: perDexPositionStats.lighter.sizeUsd,
          }
        : null;
    }

    if (activeProviders.includes('pacifica')) {
      perDex.pacifica = pacificaSummary
        ? {
            accountBalance: pacificaSummary.accountBalance,
            totalVolume: pacificaSummary.totalVolume,
            totalPnl: pacificaSummary.totalPnl,
            unrealizedPnl: perDexPositionStats.pacifica.unrealizedPnl,
            sizeUsd: perDexPositionStats.pacifica.sizeUsd,
          }
        : null;
    }

    if (activeProviders.includes('dydx')) {
      perDex.dydx = dydxSummary
        ? {
            accountBalance: dydxSummary.accountBalance,
            totalVolume: dydxSummary.totalVolume,
            totalPnl: dydxSummary.totalPnl,
            unrealizedPnl: perDexPositionStats.dydx.unrealizedPnl,
            sizeUsd: perDexPositionStats.dydx.sizeUsd,
          }
        : null;
    }

    return {
      totalAccountBalance,
      totalVolume,
      totalPnl,
      totalUnrealizedPnl,
      totalSizeUsd,
      compositeLeverage,
      perDex,
    };
  }, [positionQueries, accountQueries, activeProviders, enableLighterWebSocket, lighterVolumeWs.totalVolume, useHyperliquidWs, hyperliquidWs.wallets, hyperliquidWs.positions]);

  // Refetch all (REST + reconnect WebSocket)
  const refetch = useCallback(() => {
    positionQueries.forEach((q) => q.refetch());
    accountQueries.forEach((q) => q.refetch());
    // Reconnect Hyperliquid WebSocket if enabled
    if (useHyperliquidWs) {
      hyperliquidWs.reconnect();
    }
  }, [positionQueries, accountQueries, useHyperliquidWs, hyperliquidWs]);

  // Loading/error states (includes WebSocket loading)
  const isLoading =
    positionQueries.some((q) => q.isLoading) ||
    accountQueries.some((q) => q.isLoading) ||
    (enableLighterWebSocket && lighterVolumeWs.isLoading) ||
    (useHyperliquidWs && hyperliquidWs.isLoading);

  const isFetching =
    positionQueries.some((q) => q.isFetching) ||
    accountQueries.some((q) => q.isFetching);

  const isError =
    positionQueries.some((q) => q.isError) ||
    accountQueries.some((q) => q.isError) ||
    (useHyperliquidWs && hyperliquidWs.error !== null);

  const error =
    positionQueries.find((q) => q.error)?.error ??
    accountQueries.find((q) => q.error)?.error ??
    (useHyperliquidWs ? hyperliquidWs.error : null) ??
    null;

  // Per-DEX loading states
  // Account queries are indexed: [0] = hyperliquid, [1] = lighter, [2] = pacifica, [3] = dydx, [4] = hyperliquid portfolio stats
  const loadingStates: PerDexLoadingStates = useMemo(() => {
    const hlPositionIdx = activeProviders.indexOf('hyperliquid');
    const lighterPositionIdx = activeProviders.indexOf('lighter');
    const pacificaPositionIdx = activeProviders.indexOf('pacifica');
    const dydxPositionIdx = activeProviders.indexOf('dydx');

    return {
      hyperliquid:
        (useHyperliquidWs && (hyperliquidWs.isLoading || accountQueries[4]?.isLoading)) ||
        (activeProviders.includes('hyperliquid') && !useHyperliquidWs && accountQueries[0]?.isLoading) ||
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
      dydx:
        (activeProviders.includes('dydx') && accountQueries[3]?.isLoading) ||
        (dydxPositionIdx >= 0 && positionQueries[dydxPositionIdx]?.isLoading) ||
        false,
    };
  }, [activeProviders, accountQueries, positionQueries, useHyperliquidWs, hyperliquidWs.isLoading]);

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
