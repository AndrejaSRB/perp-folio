/**
 * React hook for fetching Hyperliquid positions via WebSocket
 * Uses @hypersignals/dex-ws for connection management
 *
 * Subscribes to allDexsClearinghouseState which returns positions from ALL DEXs
 * (main Hyperliquid Perps + HIP-3 DEXs like flx, hyna, vntl, xyz, etc.)
 */

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import type {
  HyperliquidAllDexsWsMessage,
  HyperliquidAssetPosition,
  HyperliquidCombinedClearinghouseState,
} from '../types';
import type { NormalizedPosition } from '../types';
import { combineHyperliquidClearinghouseStates } from '../providers/hyperliquid/utils';
import { normalizePosition } from '../providers/hyperliquid/normalizer';
import { buildAssetDataMap } from '../providers/hyperliquid/api';
import type { HyperliquidAssetData } from '../providers/hyperliquid/types';
import { isZeroPosition } from '../utils/positionCalc';

// ============================================
// Types
// ============================================

/**
 * Configuration options for useHyperliquidPositionsWs
 */
export interface UseHyperliquidPositionsWsConfig {
  /** Enable/disable the WebSocket connection (default: true) */
  enabled?: boolean;
}

/**
 * Options passed to useHyperliquidPositionsWs hook
 */
export interface UseHyperliquidPositionsWsOptions extends UseHyperliquidPositionsWsConfig {
  /** EVM wallet addresses to fetch positions for */
  wallets: string[];
}

/**
 * Per-wallet position data
 */
export interface WalletPositions {
  wallet: string;
  /** Raw positions from WebSocket */
  raw: HyperliquidAssetPosition[];
  /** Normalized positions */
  positions: NormalizedPosition[];
  /** Combined clearinghouse state (account data) */
  clearinghouseState: HyperliquidCombinedClearinghouseState | null;
}

/**
 * Result returned by useHyperliquidPositionsWs hook
 */
export interface UseHyperliquidPositionsWsResult {
  /** Position data per wallet */
  wallets: WalletPositions[];
  /** All normalized positions across all wallets */
  positions: NormalizedPosition[];
  /** True if WebSocket is connected */
  isConnected: boolean;
  /** True if still loading initial data */
  isLoading: boolean;
  /** Error object if connection failed */
  error: Error | null;
  /** Manually reconnect */
  reconnect: () => void;
}

// ============================================
// Constants
// ============================================

const HYPERLIQUID_WS_URL = 'wss://api.hyperliquid.xyz/ws';

// ============================================
// Hook
// ============================================

/**
 * Fetch Hyperliquid positions via WebSocket
 *
 * Uses allDexsClearinghouseState subscription which returns positions from ALL DEXs
 * (main Hyperliquid Perps + HIP-3 DEXs) in a single WebSocket message.
 *
 * @example
 * ```tsx
 * const { positions, isConnected, wallets } = useHyperliquidPositionsWs({
 *   wallets: ['0x123...', '0x456...'],
 * });
 *
 * // All positions across all wallets
 * positions.forEach((pos) => {
 *   console.log(`${pos.symbol}: ${pos.side} ${pos.size}`);
 * });
 *
 * // Per-wallet data with account info
 * wallets.forEach(({ wallet, clearinghouseState }) => {
 *   console.log(`${wallet}: $${clearinghouseState?.marginSummary.accountValue}`);
 * });
 * ```
 */
export function useHyperliquidPositionsWs(
  options: UseHyperliquidPositionsWsOptions
): UseHyperliquidPositionsWsResult {
  const { wallets, enabled = true } = options;

  // State
  const [walletData, setWalletData] = useState<Map<string, WalletPositions>>(new Map());
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Refs
  const wsRef = useRef<InstanceType<typeof import('@hypersignals/dex-ws').default> | null>(null);
  const assetDataMapRef = useRef<Map<string, HyperliquidAssetData> | null>(null);
  const mountedRef = useRef(true);

  // Memoize wallet list to prevent unnecessary reconnections
  const walletsKey = useMemo(() => [...wallets].sort().join(','), [wallets]);
  const walletsList = useMemo(() => wallets, [walletsKey]);

  // Connect function
  const connect = useCallback(async () => {
    if (!enabled || walletsList.length === 0) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Step 1: Fetch asset metadata for normalization (szDecimals, markPx)
      assetDataMapRef.current = await buildAssetDataMap();
      if (!mountedRef.current) return;

      // Step 2: Dynamically import dex-ws (optional peer dependency)
      let DexWS: typeof import('@hypersignals/dex-ws').default;
      try {
        const module = await import('@hypersignals/dex-ws');
        DexWS = module.default;
      } catch {
        setError(new Error('@hypersignals/dex-ws is not installed. Install it to use WebSocket features.'));
        setIsLoading(false);
        return;
      }

      // Step 3: Create WebSocket connection
      const ws = new DexWS(HYPERLIQUID_WS_URL);
      wsRef.current = ws;

      ws.on('open', () => {
        if (!mountedRef.current) return;
        setIsConnected(true);

        // Subscribe to allDexsClearinghouseState for each wallet
        // Format: { method: 'subscribe', subscription: { type: 'allDexsClearinghouseState', user: '0x...' } }
        for (const wallet of walletsList) {
          ws.send({
            method: 'subscribe',
            subscription: {
              type: 'allDexsClearinghouseState',
              user: wallet,
            },
          });
        }
      });

      ws.on('message', (data: unknown) => {
        if (!mountedRef.current) return;

        const message = data as HyperliquidAllDexsWsMessage;

        // Only handle allDexsClearinghouseState messages
        if (message.channel !== 'allDexsClearinghouseState') return;

        const { user, clearinghouseStates } = message.data;

        // Combine all DEX states
        const combined = combineHyperliquidClearinghouseStates(clearinghouseStates);

        // Filter zero positions and enrich with metadata
        const assetDataMap = assetDataMapRef.current;
        const nonZeroPositions = combined.assetPositions.filter(
          (p) => !isZeroPosition(p.position.szi)
        );

        // Normalize positions
        const normalizedPositions: NormalizedPosition[] = nonZeroPositions.map((raw) => {
          const assetData = assetDataMap?.get(raw.position.coin);
          const enriched = {
            ...raw,
            _szDecimals: assetData?.szDecimals ?? 0,
            _markPx: assetData?.markPx ?? null,
          };
          return normalizePosition(enriched, user);
        });

        // Update wallet data
        setWalletData((prev) => {
          const next = new Map(prev);
          next.set(user.toLowerCase(), {
            wallet: user,
            raw: nonZeroPositions,
            positions: normalizedPositions,
            clearinghouseState: combined,
          });
          return next;
        });

        // Mark as not loading once we receive first message
        setIsLoading(false);
      });

      ws.on('close', () => {
        if (!mountedRef.current) return;
        setIsConnected(false);
      });

      ws.on('error', (err: Error) => {
        if (!mountedRef.current) return;
        setError(err);
        setIsLoading(false);
      });
    } catch (err) {
      if (!mountedRef.current) return;
      setError(err instanceof Error ? err : new Error('Failed to connect'));
      setIsLoading(false);
    }
  }, [enabled, walletsList]);

  // Disconnect function
  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.destroy();
      wsRef.current = null;
    }
    setIsConnected(false);
  }, []);

  // Reconnect function
  const reconnect = useCallback(() => {
    disconnect();
    connect();
  }, [disconnect, connect]);

  // Effect: Connect on mount, disconnect on unmount
  useEffect(() => {
    mountedRef.current = true;
    connect();

    return () => {
      mountedRef.current = false;
      disconnect();
    };
  }, [connect, disconnect]);

  // Compute aggregated results
  const walletsArray = useMemo(() => Array.from(walletData.values()), [walletData]);

  const allPositions = useMemo(
    () => walletsArray.flatMap((w) => w.positions),
    [walletsArray]
  );

  return {
    wallets: walletsArray,
    positions: allPositions,
    isConnected,
    isLoading,
    error,
    reconnect,
  };
}
