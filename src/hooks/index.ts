// Hook factory - for creating custom provider hooks
export {
  createProviderHook,
  type ProviderHookConfig,
  type ProviderHookOptions,
  type ProviderHookResult,
} from './createProviderHook';

// Unified hook
export {
  useDexPositions,
  type UseDexPositionsConfig,
  type UseDexPositionsOptions,
  type UseDexPositionsResult,
  type ProviderError,
  type DexCredentials,
} from './useDexPositions';

// Individual DEX hooks
export {
  useHyperliquidPositions,
  type UseHyperliquidPositionsConfig,
  type UseHyperliquidPositionsOptions,
  type UseHyperliquidPositionsResult,
} from './useHyperliquidPositions';

export {
  useLighterPositions,
  type UseLighterPositionsConfig,
  type UseLighterPositionsOptions,
  type UseLighterPositionsResult,
} from './useLighterPositions';

export {
  usePacificaPositions,
  type UsePacificaPositionsConfig,
  type UsePacificaPositionsOptions,
  type UsePacificaPositionsResult,
} from './usePacificaPositions';

export {
  useAsterPositions,
  type UseAsterPositionsConfig,
  type UseAsterPositionsOptions,
  type UseAsterPositionsResult,
} from './useAsterPositions';

export {
  useExtendedPositions,
  type UseExtendedPositionsConfig,
  type UseExtendedPositionsOptions,
  type UseExtendedPositionsResult,
} from './useExtendedPositions';

// Portfolio hook
export {
  useDexPortfolio,
  type UseDexPortfolioConfig,
  type UseDexPortfolioOptions,
  type UseDexPortfolioResult,
} from './useDexPortfolio';

// Aggregated portfolio hook
export {
  useAggregatedPortfolio,
  type UseAggregatedPortfolioConfig,
  type UseAggregatedPortfolioOptions,
  type UseAggregatedPortfolioResult,
  type AggregatedPortfolioData,
  type DexAccountSummary,
  type PerDexBreakdown,
} from './useAggregatedPortfolio';
