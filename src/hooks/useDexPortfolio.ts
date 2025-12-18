/**
 * React hook for fetching DEX portfolio history (PnL and Account Value)
 * Supports HyperLiquid, Pacifica, and Lighter
 */

import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import type {
  PortfolioTimeframe,
  WalletPortfolio,
  PortfolioProviderId,
} from '../types/portfolio';
import type { LighterCredentials } from '../types';
import { fetchPortfolio as fetchHyperliquidPortfolio } from '../providers/hyperliquid';
import { fetchPortfolio as fetchPacificaPortfolio } from '../providers/pacifica';
import { fetchPortfolio as fetchLighterPortfolioApi } from '../providers/lighter';
import { fetchPortfolio as fetchDydxPortfolioApi } from '../providers/dydx';
import { isEvmWallet, isSolanaWallet, isDydxWallet } from '../utils/chains';

// ============================================
// Types
// ============================================

/**
 * Configuration options for useDexPortfolio
 */
export interface UseDexPortfolioConfig {
  /** Enable/disable the query (default: true) */
  enabled?: boolean;
  /** Refetch interval in milliseconds (default: false - no auto-refetch) */
  refetchInterval?: number | false;
  /** Refetch when window regains focus (default: false) */
  refetchOnWindowFocus?: boolean;
  /** Time in ms before data is considered stale (default: 60000) */
  staleTime?: number;
  /** Number of retry attempts (default: 2) */
  retry?: number | boolean;
  /** Keep previous data while refetching (default: true) */
  keepPreviousData?: boolean;
}

/**
 * Options passed to useDexPortfolio hook
 */
export interface UseDexPortfolioOptions extends UseDexPortfolioConfig {
  /** DEX provider to fetch portfolio from */
  provider: PortfolioProviderId;
  /** Wallet address(es) to fetch portfolio for */
  wallets: string | string[];
  /** Timeframe for portfolio data */
  timeframe: PortfolioTimeframe;
  /** Lighter read-only API token (required for Lighter provider) */
  lighterReadToken?: string;
}

/**
 * Result returned by useDexPortfolio hook
 */
export interface UseDexPortfolioResult {
  /** Portfolio data per wallet (only wallets with data are included) */
  wallets: WalletPortfolio[];
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
// Portfolio Fetchers Map
// ============================================

/**
 * Wrapper for Lighter portfolio that accepts credentials
 */
const createLighterFetcher = (credentials?: LighterCredentials) => {
  return (address: string, timeframe: PortfolioTimeframe) =>
    fetchLighterPortfolioApi(address, timeframe, credentials);
};

/**
 * Map provider to chain type for wallet filtering
 * HyperLiquid = EVM, Lighter = EVM, Pacifica = Solana, dYdX = Cosmos
 */
const providerChainFilter: Record<PortfolioProviderId, (wallet: string) => boolean> = {
  hyperliquid: isEvmWallet,
  lighter: isEvmWallet,
  pacifica: isSolanaWallet,
  dydx: isDydxWallet,
};

// ============================================
// Hook
// ============================================

/**
 * Fetch portfolio history (PnL and Account Value) for a DEX
 *
 * @example
 * ```tsx
 * const { wallets, isLoading } = useDexPortfolio({
 *   provider: 'hyperliquid',
 *   wallets: ['0x123...', '0x456...'],
 *   timeframe: '7d',
 * });
 *
 * // wallets contains only those with data
 * wallets.forEach(({ wallet, pnl, accountValue }) => {
 *   console.log(`${wallet}: ${pnl.length} PnL points`);
 * });
 * ```
 */
export function useDexPortfolio(
  options: UseDexPortfolioOptions
): UseDexPortfolioResult {
  const {
    provider,
    wallets,
    timeframe,
    lighterReadToken,
    enabled = true,
    refetchInterval,
    refetchOnWindowFocus = false,
    staleTime = 60_000,
    retry = 2,
    keepPreviousData = true,
  } = options;

  // Build Lighter credentials if provided
  const lighterCredentials: LighterCredentials | undefined = useMemo(() => {
    if (lighterReadToken) {
      return { readToken: lighterReadToken };
    }
    return undefined;
  }, [lighterReadToken]);

  // Normalize wallets to array and filter by chain type
  const walletsArray = useMemo(() => {
    const arr = Array.isArray(wallets) ? wallets : [wallets];
    const chainFilter = providerChainFilter[provider];
    return arr.filter(chainFilter);
  }, [wallets, provider]);

  // Get the fetcher for this provider
  const fetcher = useMemo(() => {
    switch (provider) {
      case 'hyperliquid':
        return fetchHyperliquidPortfolio;
      case 'pacifica':
        return fetchPacificaPortfolio;
      case 'lighter':
        return createLighterFetcher(lighterCredentials);
      case 'dydx':
        return fetchDydxPortfolioApi;
      default:
        return fetchHyperliquidPortfolio;
    }
  }, [provider, lighterCredentials]);

  // Main query
  const query = useQuery({
    queryKey: ['dex-portfolio', provider, timeframe, ...walletsArray.sort(), lighterReadToken ?? ''],
    queryFn: async (): Promise<WalletPortfolio[]> => {
      // Fetch portfolio for all wallets in parallel
      const results = await Promise.all(
        walletsArray.map(async (wallet) => {
          try {
            const { pnl, accountValue } = await fetcher(wallet, timeframe);
            return { wallet, pnl, accountValue };
          } catch {
            // Return empty on error
            return { wallet, pnl: [], accountValue: [] };
          }
        })
      );

      // Filter out wallets with no data
      return results.filter(
        (w) => w.pnl.length > 0 || w.accountValue.length > 0
      );
    },
    enabled,
    refetchInterval,
    refetchOnWindowFocus,
    staleTime,
    retry,
    placeholderData: keepPreviousData ? (prev) => prev : undefined,
  });

  return {
    wallets: query.data ?? [],
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}
