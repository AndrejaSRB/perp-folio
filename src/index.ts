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

// Individual providers (for advanced use)
export { hyperliquidProvider, fetchClearinghouseState } from './providers/hyperliquid';
export { lighterProvider, fetchAccount as fetchLighterAccount } from './providers/lighter';
export {
  pacificaProvider,
  fetchPacificaPositions,
  fetchPacificaAccountSettings,
  fetchPacificaMarkets,
  fetchPacificaPrices,
  clearPacificaMarketsCache,
} from './providers';

// ============ NORMALIZERS ============

export {
  normalizeHyperliquidPosition,
  normalizeLighterPosition,
  normalizePacificaPosition,
} from './normalizers';

// ============ UTILS ============

export {
  isEvmWallet,
  isSolanaWallet,
  normalizeWalletsInput,
  type NormalizedWallets,
  type WalletsParam,
} from './utils';
