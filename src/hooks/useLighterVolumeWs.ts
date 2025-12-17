/**
 * React hook for fetching Lighter volume via WebSocket
 * Uses @hypersignals/dex-ws for connection management
 */

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';

// ============================================
// Types
// ============================================

/**
 * Lighter WebSocket account_all response
 * Volume fields are at root level, not inside data
 */
interface LighterAccountAllMessage {
  channel: string;
  type?: string;
  daily_volume?: number;
  weekly_volume?: number;
  monthly_volume?: number;
  total_volume?: number;
  [key: string]: unknown;
}

/**
 * Volume data per wallet
 */
export interface WalletVolume {
  wallet: string;
  accountIndex: number;
  totalVolume: number;
  dailyVolume: number;
  weeklyVolume: number;
  monthlyVolume: number;
}

/**
 * Configuration options for useLighterVolumeWs
 */
export interface UseLighterVolumeWsConfig {
  /** Enable/disable the WebSocket connection (default: true) */
  enabled?: boolean;
  /** Lighter read-only API token */
  readToken?: string;
}

/**
 * Options passed to useLighterVolumeWs hook
 */
export interface UseLighterVolumeWsOptions extends UseLighterVolumeWsConfig {
  /** EVM wallet addresses to fetch volume for */
  wallets: string[];
}

/**
 * Result returned by useLighterVolumeWs hook
 */
export interface UseLighterVolumeWsResult {
  /** Volume data per wallet */
  volumes: WalletVolume[];
  /** Total volume across all wallets */
  totalVolume: number;
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

const LIGHTER_WS_URL = 'wss://mainnet.zklighter.elliot.ai/stream';
const LIGHTER_REST_URL = 'https://mainnet.zklighter.elliot.ai';

// ============================================
// Helper: Fetch account indices from REST API
// ============================================

interface AccountInfo {
  wallet: string;
  accountIndex: number;
}

async function fetchAccountIndices(
  wallets: string[],
  readToken?: string
): Promise<AccountInfo[]> {
  const results: AccountInfo[] = [];

  await Promise.all(
    wallets.map(async (wallet) => {
      try {
        let url = `${LIGHTER_REST_URL}/api/v1/account?by=l1_address&value=${wallet}`;
        if (readToken) {
          url += `&auth=${readToken}`;
        }

        const response = await fetch(url);
        if (!response.ok) return;

        const data = await response.json();
        const accounts = data.accounts ?? [];

        for (const account of accounts) {
          if (account.index !== undefined) {
            results.push({
              wallet,
              accountIndex: account.index,
            });
          }
        }
      } catch {
        // Ignore errors for individual wallets
      }
    })
  );

  return results;
}

// ============================================
// Hook
// ============================================

/**
 * Fetch Lighter volume via WebSocket
 *
 * @example
 * ```tsx
 * const { totalVolume, isConnected, volumes } = useLighterVolumeWs({
 *   wallets: ['0x123...', '0x456...'],
 *   readToken: 'your-token',
 * });
 *
 * console.log('Total Volume:', totalVolume);
 * volumes.forEach(({ wallet, totalVolume }) => {
 *   console.log(`${wallet}: ${totalVolume}`);
 * });
 * ```
 */
export function useLighterVolumeWs(
  options: UseLighterVolumeWsOptions
): UseLighterVolumeWsResult {
  const { wallets, enabled = true, readToken } = options;

  // State
  const [volumes, setVolumes] = useState<Map<number, WalletVolume>>(new Map());
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Refs
  const wsRef = useRef<InstanceType<typeof import('@hypersignals/dex-ws').default> | null>(null);
  const accountsRef = useRef<AccountInfo[]>([]);
  const mountedRef = useRef(true);

  // Memoize wallet list to prevent unnecessary reconnections
  const walletsKey = useMemo(() => wallets.sort().join(','), [wallets]);

  // Connect function
  const connect = useCallback(async () => {
    if (!enabled || wallets.length === 0) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Step 1: Fetch account indices
      const accounts = await fetchAccountIndices(wallets, readToken);
      if (!mountedRef.current) return;

      if (accounts.length === 0) {
        setIsLoading(false);
        return;
      }

      accountsRef.current = accounts;

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
      // Disable heartbeat - Lighter doesn't support the default ping format
      const ws = new DexWS(LIGHTER_WS_URL, {
        heartbeat: false,
      });
      wsRef.current = ws;

      ws.on('open', () => {
        if (!mountedRef.current) return;
        setIsConnected(true);

        // Subscribe to account_all for each account
        for (const { accountIndex } of accounts) {
          ws.send({
            type: 'subscribe',
            channel: `account_all/${accountIndex}`,
          });
        }
      });

      ws.on('message', (data: unknown) => {
        if (!mountedRef.current) return;

        const message = data as LighterAccountAllMessage;

        // Parse channel to get account index (format: "account_all:72162" with colon)
        const channelMatch = message.channel?.match(/^account_all[:/](\d+)$/);
        if (!channelMatch) return;

        const accountIndex = parseInt(channelMatch[1], 10);
        // Use accountsRef.current instead of closure variable
        const accountInfo = accountsRef.current.find((a) => a.accountIndex === accountIndex);
        if (!accountInfo) return;

        // Extract volume data (fields are at root level, not inside data)
        const volumeData: WalletVolume = {
          wallet: accountInfo.wallet,
          accountIndex,
          totalVolume: message.total_volume ?? 0,
          dailyVolume: message.daily_volume ?? 0,
          weeklyVolume: message.weekly_volume ?? 0,
          monthlyVolume: message.monthly_volume ?? 0,
        };

        setVolumes((prev) => {
          const next = new Map(prev);
          next.set(accountIndex, volumeData);
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
  }, [enabled, walletsKey, readToken]);

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

  // Compute total volume
  const totalVolume = useMemo(() => {
    let total = 0;
    volumes.forEach((v) => {
      total += v.totalVolume;
    });
    return total;
  }, [volumes]);

  // Convert Map to array
  const volumesArray = useMemo(() => Array.from(volumes.values()), [volumes]);

  return {
    volumes: volumesArray,
    totalVolume,
    isConnected,
    isLoading,
    error,
    reconnect,
  };
}
