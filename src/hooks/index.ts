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
