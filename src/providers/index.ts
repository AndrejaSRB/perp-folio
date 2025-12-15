import type { ChainType, ProviderId } from '../types';
import type { DexProvider, ProviderRegistry } from './types';
import { hyperliquidProvider } from './hyperliquid';
import { lighterProvider } from './lighter';
import { pacificaProvider } from './pacifica';

/**
 * Registry of all available DEX providers
 */
export const providers: ProviderRegistry = {
  hyperliquid: hyperliquidProvider,
  lighter: lighterProvider,
  pacifica: pacificaProvider,
};

/**
 * Get provider IDs by chain type
 */
export const getProvidersByChain = (chain: ChainType): ProviderId[] => {
  return (Object.entries(providers) as [ProviderId, DexProvider<unknown>][])
    .filter(([, p]) => p.chain === chain)
    .map(([id]) => id);
};

/**
 * Get all EVM provider IDs
 */
export const evmProviders: ProviderId[] = getProvidersByChain('evm');

/**
 * Get all Solana provider IDs
 */
export const solanaProviders: ProviderId[] = getProvidersByChain('solana');

// Re-export types and individual providers
export type { DexProvider, ProviderRegistry } from './types';

// HyperLiquid exports
export {
  hyperliquidProvider,
  fetchClearinghouseState,
  fetchPerpDexs,
  fetchMetaAndAssetCtxs,
  buildSzDecimalsMap,
  buildAssetDataMap,
  getDexNames,
  clearHyperliquidCache,
  type HyperliquidPositionWithMeta,
  type HyperliquidAssetData,
} from './hyperliquid';

// Lighter exports
export {
  lighterProvider,
  fetchAccount,
  fetchOrderBooks,
  fetchOrderBookDetails,
  fetchMarkPrices as fetchLighterMarkPrices,
  buildDecimalsMap as buildLighterDecimalsMap,
  clearLighterCache,
  type LighterPositionWithMeta,
} from './lighter';

// Pacifica exports
export {
  pacificaProvider,
  fetchPositions as fetchPacificaPositions,
  fetchAccountSettings as fetchPacificaAccountSettings,
  fetchMarkets as fetchPacificaMarkets,
  fetchPrices as fetchPacificaPrices,
  buildDecimalsMap as buildPacificaDecimalsMap,
  clearPacificaCache,
  type PacificaPositionWithContext,
} from './pacifica';
