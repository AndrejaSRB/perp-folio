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
  LighterCredentials,
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

// Aster raw types
export type {
  AsterCredentials,
  AsterPositionRaw,
  AsterSymbolInfoRaw,
  AsterMarkPriceRaw,
  AsterExchangeInfoResponse,
} from './types/aster';

// Extended raw types
export type {
  ExtendedCredentials,
  ExtendedPositionRaw,
  ExtendedMarketRaw,
  ExtendedApiResponse,
  ExtendedBalanceRaw,
} from './types/extended';

// Portfolio types
export type {
  PortfolioTimeframe,
  PortfolioDataPoint,
  WalletPortfolio,
  PortfolioProviderId,
  LighterPnlDataPoint,
  LighterPnlResponse,
} from './types/portfolio';

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
  type DexCredentials,
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

export {
  useAsterPositions,
  type UseAsterPositionsConfig,
  type UseAsterPositionsOptions,
  type UseAsterPositionsResult,
} from './hooks/useAsterPositions';

export {
  useExtendedPositions,
  type UseExtendedPositionsConfig,
  type UseExtendedPositionsOptions,
  type UseExtendedPositionsResult,
} from './hooks/useExtendedPositions';

// Portfolio hook (PnL and Account Value history)
export {
  useDexPortfolio,
  type UseDexPortfolioConfig,
  type UseDexPortfolioOptions,
  type UseDexPortfolioResult,
} from './hooks/useDexPortfolio';

// Aggregated portfolio hook (totals across all DEXes)
export {
  useAggregatedPortfolio,
  type UseAggregatedPortfolioConfig,
  type UseAggregatedPortfolioOptions,
  type UseAggregatedPortfolioResult,
  type AggregatedPortfolioData,
  type DexAccountSummary,
  type PerDexBreakdown,
  type PerDexLoadingStates,
} from './hooks/useAggregatedPortfolio';

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
  fetchLighterPnl,
  fetchLighterPortfolio,
  fetchLighterTotalPnl,
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
  fetchPacificaVolume,
  fetchPacificaTotalPnl,
  buildPacificaDecimalsMap,
  clearPacificaCache,
  calculatePacificaPnl,
  calculatePacificaPositionValue,
  calculatePacificaMarginUsed,
  calculatePacificaRoi,
  type PacificaPositionWithContext,
} from './providers';

// Aster exports (for advanced use)
export {
  asterProvider,
  fetchAsterExchangeInfo,
  fetchAsterPositions,
  buildAsterDecimalsMap,
  clearAsterCache,
  hmacSha256,
  type AsterPositionWithMeta,
} from './providers';

// Extended exports (for advanced use)
export {
  extendedProvider,
  fetchExtendedMarkets,
  fetchExtendedPositions,
  fetchExtendedBalance,
  buildExtendedDecimalsMap,
  clearExtendedCache,
  type ExtendedPositionWithMeta,
} from './providers';

// ============ NORMALIZERS ============

export {
  normalizeHyperliquidPosition,
  normalizeLighterPosition,
  normalizePacificaPosition,
  normalizeAsterPosition,
  normalizeExtendedPosition,
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
