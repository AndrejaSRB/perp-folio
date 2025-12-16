import type { ChainType, ProviderId } from '../types';
import type { DexProvider, ProviderRegistry } from './types';
import { hyperliquidProvider } from './hyperliquid';
import { lighterProvider } from './lighter';
import { pacificaProvider } from './pacifica';
import { asterProvider } from './aster';
import { extendedProvider } from './extended';

/**
 * Registry of all available DEX providers
 */
export const providers: ProviderRegistry = {
  hyperliquid: hyperliquidProvider,
  lighter: lighterProvider,
  pacifica: pacificaProvider,
  aster: asterProvider,
  extended: extendedProvider,
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

// Provider factory - for creating new providers
export {
  createProvider,
  createSymbolMetadataProvider,
  type ProviderConfig,
  type SymbolMetadataProviderConfig,
} from './base';

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
  calculatePriceDecimals,
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
  fetchPositions as fetchLighterPositions,
  buildDecimalsMap as buildLighterDecimalsMap,
  buildMetadata as buildLighterMetadata,
  clearLighterCache,
  fetchPnl as fetchLighterPnl,
  fetchPortfolio as fetchLighterPortfolio,
  fetchTotalPnl as fetchLighterTotalPnl,
  type LighterPositionWithMeta,
  type LighterMetadata,
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
  calculatePnl as calculatePacificaPnl,
  calculatePositionValue as calculatePacificaPositionValue,
  calculateMarginUsed as calculatePacificaMarginUsed,
  calculateRoi as calculatePacificaRoi,
  type PacificaPositionWithContext,
} from './pacifica';

// Aster exports
export {
  asterProvider,
  fetchExchangeInfo as fetchAsterExchangeInfo,
  fetchPositions as fetchAsterPositions,
  buildDecimalsMap as buildAsterDecimalsMap,
  clearAsterCache,
  hmacSha256,
  type AsterPositionWithMeta,
} from './aster';

// Extended exports
export {
  extendedProvider,
  fetchMarkets as fetchExtendedMarkets,
  fetchPositions as fetchExtendedPositions,
  fetchBalance as fetchExtendedBalance,
  buildDecimalsMap as buildExtendedDecimalsMap,
  clearExtendedCache,
  type ExtendedPositionWithMeta,
} from './extended';
