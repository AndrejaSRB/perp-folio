// ============================================================
// @hypersignals/perp-folio
// Multi-chain DEX position aggregator SDK with React hooks
// ============================================================

// ============ TYPES ============

// Common / Normalized types
export type {
  ChainType,
  ProviderId,
  NormalizedPosition,
} from './types/common';

// HyperLiquid raw types
export type {
  HyperliquidPerpDex,
  HyperliquidAssetMeta,
  HyperliquidAssetCtx,
  HyperliquidMetaAndAssetCtxs,
  HyperliquidLeverage,
  HyperliquidCumFunding,
  HyperliquidPositionData,
  HyperliquidAssetPosition,
  HyperliquidMarginSummary,
  HyperliquidClearinghouseState,
} from './types/hyperliquid';

// Lighter raw types
export type {
  LighterPosition,
  LighterAccount,
  LighterAccountsResponse,
  LighterOrderBookDetails,
  LighterOrderBookDetailsResponse,
  LighterMarketMeta,
  LighterOrderBooksResponse,
} from './types/lighter';

// Pacifica raw types
export type {
  PacificaPosition,
  PacificaPositionsResponse,
  PacificaAccountSetting,
  PacificaAccountSettingsResponse,
  PacificaMarketInfo,
  PacificaMarketInfoResponse,
  PacificaPrice,
  PacificaPricesResponse,
} from './types/pacifica';

// ============ HOOKS ============

// Hook factory - for creating custom provider hooks
export {
  createProviderHook,
  type ProviderHookConfig,
  type ProviderHookOptions,
  type ProviderHookResult,
} from './hooks/createProviderHook';

// Unified hook (queries all DEXes)
export {
  useDexPositions,
  type UseDexPositionsConfig,
  type UseDexPositionsOptions,
  type UseDexPositionsResult,
  type ProviderError,
} from './hooks/useDexPositions';

// Individual DEX hooks
export {
  useHyperliquidPositions,
  type UseHyperliquidPositionsConfig,
  type UseHyperliquidPositionsOptions,
  type UseHyperliquidPositionsResult,
} from './hooks/useHyperliquidPositions';

export {
  useLighterPositions,
  type UseLighterPositionsConfig,
  type UseLighterPositionsOptions,
  type UseLighterPositionsResult,
} from './hooks/useLighterPositions';

export {
  usePacificaPositions,
  type UsePacificaPositionsConfig,
  type UsePacificaPositionsOptions,
  type UsePacificaPositionsResult,
} from './hooks/usePacificaPositions';

// ============ PROVIDERS ============

// Provider registry and utilities
export {
  providers,
  getProvidersByChain,
  evmProviders,
  solanaProviders,
  type DexProvider,
  type ProviderRegistry,
} from './providers';

// Provider factory - for creating new providers
export {
  createProvider,
  createSymbolMetadataProvider,
  type ProviderConfig,
  type SymbolMetadataProviderConfig,
} from './providers';

// HyperLiquid exports (for advanced use)
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
  type HyperliquidAssetData,
  type HyperliquidPositionWithMeta,
} from './providers';

// Lighter exports (for advanced use)
export {
  lighterProvider,
  fetchAccount as fetchLighterAccount,
  fetchOrderBooks,
  fetchOrderBookDetails,
  fetchLighterMarkPrices,
  fetchLighterPositions,
  buildLighterDecimalsMap,
  buildLighterMetadata,
  clearLighterCache,
  type LighterPositionWithMeta,
  type LighterMetadata,
} from './providers';

// Pacifica exports (for advanced use)
export {
  pacificaProvider,
  fetchPacificaPositions,
  fetchPacificaAccountSettings,
  fetchPacificaMarkets,
  fetchPacificaPrices,
  buildPacificaDecimalsMap,
  clearPacificaCache,
  calculatePacificaPnl,
  calculatePacificaPositionValue,
  calculatePacificaMarginUsed,
  calculatePacificaRoi,
  type PacificaPositionWithContext,
} from './providers';

// ============ NORMALIZERS ============

export {
  normalizeHyperliquidPosition,
  normalizeLighterPosition,
  normalizePacificaPosition,
} from './normalizers';

// ============ UTILS ============

// Chain utilities
export {
  isEvmWallet,
  isSolanaWallet,
  normalizeSide,
  normalizeWalletsInput,
  type NormalizedWallets,
  type WalletsParam,
} from './utils';

// Formatting utilities
export {
  formatDecimals,
  formatSize,
  formatPrice,
  formatPosition,
  formatPositions,
  formatPositionPrices,
  formatPositionsPrices,
  formatPositionSize,
  formatPositionEntryPrice,
  formatPositionMarkPrice,
  formatPositionLiquidationPrice,
  formatPositionUnrealizedPnl,
  formatPositionRealizedPnl,
  formatPositionMargin,
  formatPnl,
  type FormattedPosition,
} from './utils';

// Cache utilities
export {
  getCached,
  clearCache,
  clearCacheByPrefix,
  clearAllCache,
} from './utils';

// Cached fetch utilities
export {
  cachedFetch,
  uncachedFetch,
  type CachedFetchConfig,
  type HttpMethod,
} from './utils';

// Metadata utilities
export {
  buildDecimalsMap,
  buildAssetDataMap as buildGenericAssetDataMap,
  buildSymbolMap,
  calculateDecimalsFromString,
  type DecimalsMap,
  type AssetData,
  type DecimalsMapConfig,
  type AssetDataMapConfig,
} from './utils';

// Position calculation utilities
export {
  calculatePnl,
  calculatePositionValue,
  calculateMargin,
  calculateRoi,
  calculateRoiFull,
  calculateLeverageFromIMF,
  calculateHyperliquidPriceDecimals,
  getSideFromSignedSize,
  isZeroPosition,
  type PositionSide,
} from './utils';
