import type { DexProvider } from './types';
import type {
  HyperliquidAssetPosition,
  HyperliquidClearinghouseState,
  NormalizedPosition,
} from '../types';

const API_URL = 'https://api.hyperliquid.xyz/info';

/**
 * Fetch clearinghouse state from HyperLiquid
 */
const fetchClearinghouseState = async (
  address: string
): Promise<HyperliquidClearinghouseState> => {
  const response = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type: 'clearinghouseState',
      user: address,
    }),
  });

  if (!response.ok) {
    throw new Error(`HyperLiquid API error: ${response.status}`);
  }

  return response.json();
};

/**
 * Normalize HyperLiquid position to standard format
 */
const normalizePosition = (
  raw: HyperliquidAssetPosition,
  wallet: string
): NormalizedPosition => {
  const p = raw.position;
  const size = parseFloat(p.szi);

  return {
    id: `hyperliquid-${wallet}-${p.coin}`,
    provider: 'hyperliquid',
    wallet,
    symbol: p.coin,
    side: size >= 0 ? 'long' : 'short',
    size: Math.abs(size).toString(),
    entryPrice: p.entryPx,
    markPrice: null, // Would need separate price fetch
    unrealizedPnl: p.unrealizedPnl,
    realizedPnl: null,
    leverage: p.leverage.value,
    leverageType: p.leverage.type,
    liquidationPrice: p.liquidationPx,
    margin: p.marginUsed,
    maxLeverage: p.maxLeverage,
    fundingAccrued: p.cumFunding.sinceOpen,
    timestamp: Date.now(),
  };
};

export const hyperliquidProvider: DexProvider<HyperliquidAssetPosition> = {
  id: 'hyperliquid',
  name: 'HyperLiquid',
  chain: 'evm',

  fetchPositions: async (address: string): Promise<HyperliquidAssetPosition[]> => {
    const state = await fetchClearinghouseState(address);

    // Filter out positions with zero size
    return state.assetPositions.filter(
      (p) => parseFloat(p.position.szi) !== 0
    );
  },

  normalizePosition,
};

// Export raw fetcher for advanced use
export { fetchClearinghouseState };
