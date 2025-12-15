import type {
  HyperliquidAssetPosition,
  HyperliquidClearinghouseState,
  HyperliquidPerpDex,
  HyperliquidMetaAndAssetCtxs,
} from '../../types';
import { getCached, clearCacheByPrefix } from '../../utils/cache';
import type { HyperliquidAssetData } from './types';

const API_URL = 'https://api.hyperliquid.xyz/info';
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes

// ============================================
// Metadata fetchers (cached)
// ============================================

/**
 * Fetch all perp DEXes (cached for 30min)
 * Returns array where first element is null (main perp), rest are custom dexes
 */
export const fetchPerpDexs = async (): Promise<(HyperliquidPerpDex | null)[]> => {
  return getCached('hl:perpDexs', async () => {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'perpDexs' }),
    });

    if (!response.ok) {
      throw new Error(`HyperLiquid perpDexs error: ${response.status}`);
    }

    return response.json();
  }, CACHE_TTL);
};

/**
 * Get list of DEX names to query (null for main, plus custom dex names)
 */
export const getDexNames = async (): Promise<(string | null)[]> => {
  const dexes = await fetchPerpDexs();
  return dexes.map(d => d?.name ?? null);
};

/**
 * Fetch asset metadata for a specific DEX (cached for 30min)
 * @param dex - DEX name or null/undefined for main perp
 */
export const fetchMetaAndAssetCtxs = async (
  dex?: string | null
): Promise<HyperliquidMetaAndAssetCtxs> => {
  const cacheKey = `hl:meta:${dex ?? 'main'}`;

  return getCached(cacheKey, async () => {
    const body: Record<string, unknown> = { type: 'metaAndAssetCtxs' };
    if (dex) {
      body.dex = dex;
    }

    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`HyperLiquid metaAndAssetCtxs error: ${response.status}`);
    }

    const data = await response.json();
    // Response is [meta, assetCtxs] array
    return {
      universe: data[0]?.universe ?? [],
      assetCtxs: data[1] ?? [],
    };
  }, CACHE_TTL);
};

/**
 * Build maps of symbol -> szDecimals and symbol -> markPx from all DEXes
 */
export const buildAssetDataMap = async (): Promise<Map<string, HyperliquidAssetData>> => {
  const dexNames = await getDexNames();
  const map = new Map<string, HyperliquidAssetData>();

  const metaPromises = dexNames.map(dex =>
    fetchMetaAndAssetCtxs(dex).catch(() => ({ universe: [], assetCtxs: [] }))
  );

  const allMeta = await Promise.all(metaPromises);

  for (const meta of allMeta) {
    const assetCtxs = meta.assetCtxs ?? [];

    for (let i = 0; i < meta.universe.length; i++) {
      const asset = meta.universe[i];
      if (!asset.isDelisted) {
        const ctx = assetCtxs[i];
        map.set(asset.name, {
          szDecimals: asset.szDecimals,
          markPx: ctx?.markPx ?? null,
        });
      }
    }
  }

  return map;
};

/**
 * Build a map of symbol -> szDecimals from all DEXes
 * @deprecated Use buildAssetDataMap instead
 */
export const buildSzDecimalsMap = async (): Promise<Map<string, number>> => {
  const assetData = await buildAssetDataMap();
  const map = new Map<string, number>();

  for (const [symbol, data] of assetData) {
    map.set(symbol, data.szDecimals);
  }

  return map;
};

// ============================================
// Position fetchers
// ============================================

/**
 * Fetch clearinghouse state for a specific DEX
 */
const fetchClearinghouseStateForDex = async (
  address: string,
  dex?: string | null
): Promise<HyperliquidClearinghouseState> => {
  const body: Record<string, unknown> = {
    type: 'clearinghouseState',
    user: address,
  };
  if (dex) {
    body.dex = dex;
  }

  const response = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    // Return empty state on error (including 404)
    return {
      assetPositions: [],
      crossMaintenanceMarginUsed: '0',
      crossMarginSummary: {
        accountValue: '0',
        totalMarginUsed: '0',
        totalNtlPos: '0',
        totalRawUsd: '0',
      },
      marginSummary: {
        accountValue: '0',
        totalMarginUsed: '0',
        totalNtlPos: '0',
        totalRawUsd: '0',
      },
      time: Date.now(),
      withdrawable: '0',
    };
  }

  return response.json();
};

/**
 * Fetch clearinghouse state from ALL DEXes for an address
 */
export const fetchClearinghouseState = async (
  address: string
): Promise<HyperliquidAssetPosition[]> => {
  const dexNames = await getDexNames();

  // Fetch from all DEXes in parallel
  const statePromises = dexNames.map(dex =>
    fetchClearinghouseStateForDex(address, dex).catch(() => ({
      assetPositions: [],
    }))
  );

  const allStates = await Promise.all(statePromises);

  // Combine all positions
  return allStates.flatMap(state => state.assetPositions);
};

/**
 * Clear HyperLiquid metadata cache
 */
export const clearHyperliquidCache = (): void => {
  clearCacheByPrefix('hl:');
};
