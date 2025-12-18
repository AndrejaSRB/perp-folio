# DEX Integration Guide

This document outlines the steps required to integrate a new DEX provider into the `@hypersignals/perp-folio` SDK.

## Overview

Integrating a new DEX requires modifications to multiple files across the SDK. The main components are:

1. **Types** - Define TypeScript types for the DEX's API responses
2. **Provider** - Create the provider with API functions and normalizer
3. **Hooks** - Integrate into React hooks for positions and portfolio
4. **Exports** - Export everything from the main index

---

## Step-by-Step Integration

### 1. Add Chain Type (if needed)

If the DEX uses a new chain type (not `evm`, `solana`, or `cosmos`), add it to:

**File: `src/types/common.ts`**
```typescript
export type ChainType = 'evm' | 'solana' | 'cosmos' | 'your-chain';
```

### 2. Add Provider ID

Add your DEX to the `ProviderId` union type:

**File: `src/types/common.ts`**
```typescript
export type ProviderId = 'hyperliquid' | 'lighter' | 'pacifica' | 'aster' | 'dydx' | 'your-dex';
```

### 3. Create Types File

Create a new types file for the DEX's API responses:

**File: `src/types/your-dex.ts`**
```typescript
/**
 * Your DEX API types
 */

// Credentials (if the DEX requires authentication)
export interface YourDexCredentials {
  apiKey: string;
  // ... other auth fields
}

// Raw position from API
export interface YourDexPositionRaw {
  symbol: string;
  size: string;
  entryPrice: string;
  markPrice: string;
  unrealizedPnl: string;
  // ... other fields from API
}

// Market metadata
export interface YourDexMarketRaw {
  symbol: string;
  tickSize: string;
  lotSize: string;
  // ... other fields
}

// API response wrappers
export interface YourDexPositionsResponse {
  positions: YourDexPositionRaw[];
}
```

### 4. Export Types

Add type exports:

**File: `src/types/index.ts`**
```typescript
// Your DEX raw types
export type {
  YourDexCredentials,
  YourDexPositionRaw,
  YourDexMarketRaw,
  YourDexPositionsResponse,
} from './your-dex';
```

### 5. Create Provider Directory

Create a new provider directory with these files:

```
src/providers/your-dex/
  ├── index.ts      # Provider export and re-exports
  ├── api.ts        # API functions (fetch positions, markets, etc.)
  ├── types.ts      # Internal types (enriched position, metadata)
  └── normalizer.ts # Position normalizer
```

#### 5a. Internal Types (`types.ts`)

```typescript
import type { YourDexPositionRaw } from '../../types/your-dex';

/**
 * Position enriched with metadata
 */
export interface YourDexPositionWithMeta extends YourDexPositionRaw {
  _sizeDecimals: number;
  _priceDecimals: number;
  _markPrice: string | null;
}
```

#### 5b. API Functions (`api.ts`)

```typescript
import { cachedFetch } from '../../utils/cachedFetch';
import type { YourDexPositionRaw, YourDexMarketRaw } from '../../types/your-dex';
import type { PortfolioTimeframe, PortfolioDataPoint } from '../../types/portfolio';

const BASE_URL = 'https://api.your-dex.com';

/**
 * Fetch market metadata (cached)
 */
export const fetchMarkets = async (): Promise<YourDexMarketRaw[]> => {
  return cachedFetch({
    url: `${BASE_URL}/markets`,
    cachePrefix: 'your-dex',
    transform: (json: any) => json.markets,
    fallbackOnError: [],
  });
};

/**
 * Build decimals map from market data
 */
export const buildDecimalsMap = async () => {
  const markets = await fetchMarkets();
  const sizeDecimals = new Map<string, number>();
  const priceDecimals = new Map<string, number>();

  for (const market of markets) {
    sizeDecimals.set(market.symbol, calculateDecimals(market.lotSize));
    priceDecimals.set(market.symbol, calculateDecimals(market.tickSize));
  }

  return { sizeDecimals, priceDecimals };
};

/**
 * Fetch positions for a wallet
 */
export const fetchPositions = async (address: string): Promise<YourDexPositionRaw[]> => {
  const response = await fetch(`${BASE_URL}/positions?address=${address}`);
  if (!response.ok) return [];
  const data = await response.json();
  return data.positions ?? [];
};

/**
 * Clear cache
 */
export const clearYourDexCache = () => {
  clearCacheByPrefix('your-dex');
};

/**
 * Fetch portfolio data (for useDexPortfolio hook)
 */
export const fetchPortfolio = async (
  address: string,
  timeframe: PortfolioTimeframe
): Promise<{ pnl: PortfolioDataPoint[]; accountValue: PortfolioDataPoint[] }> => {
  // Implement based on DEX's historical data API
  // Return arrays of { timestamp: number, value: string }
};

/**
 * Fetch total PnL (for useAggregatedPortfolio hook)
 */
export const fetchTotalPnl = async (address: string): Promise<number> => {
  // Implement based on DEX's PnL API
};
```

#### 5c. Normalizer (`normalizer.ts`)

```typescript
import type { NormalizedPosition } from '../../types/common';
import type { YourDexPositionWithMeta } from './types';

export const normalizePosition = (
  raw: YourDexPositionWithMeta,
  wallet: string
): NormalizedPosition => {
  const size = Math.abs(parseFloat(raw.size));
  const markPrice = parseFloat(raw.markPrice);

  return {
    id: `your-dex-${wallet}-${raw.symbol}`,
    provider: 'your-dex',
    wallet,
    symbol: raw.symbol,
    side: parseFloat(raw.size) >= 0 ? 'long' : 'short',
    size: size.toString(),
    sizeUsd: (size * markPrice).toString(),
    entryPrice: raw.entryPrice,
    markPrice: raw.markPrice,
    unrealizedPnl: raw.unrealizedPnl,
    realizedPnl: raw.realizedPnl ?? null,
    roi: null, // Calculate if available
    leverage: parseFloat(raw.leverage ?? '1'),
    leverageType: raw.marginMode === 'isolated' ? 'isolated' : 'cross',
    liquidationPrice: raw.liquidationPrice ?? null,
    margin: raw.margin ?? '0',
    maxLeverage: null,
    fundingAccrued: raw.funding ?? null,
    timestamp: Date.now(),
    sizeDecimals: raw._sizeDecimals,
    priceDecimals: raw._priceDecimals,
  };
};
```

#### 5d. Provider Index (`index.ts`)

```typescript
import type { YourDexPositionRaw } from '../../types/your-dex';
import { createProvider } from '../base';
import type { YourDexPositionWithMeta } from './types';
import { fetchPositions, fetchMarkets } from './api';
import { normalizePosition } from './normalizer';

export const yourDexProvider = createProvider<
  YourDexPositionRaw,
  YourDexPositionWithMeta,
  { sizeDecimals: Map<string, number>; priceDecimals: Map<string, number> }
>({
  id: 'your-dex',
  name: 'Your DEX',
  chain: 'evm', // or 'solana', 'cosmos', etc.

  // Set to true if DEX requires API credentials instead of wallet address
  // requiresCredentials: true,

  fetchRawPositions: fetchPositions,

  getPositionSize: (raw) => raw.size,

  fetchMetadata: async () => {
    const { sizeDecimals, priceDecimals } = await buildDecimalsMap();
    return { sizeDecimals, priceDecimals };
  },

  enrichPosition: (raw, metadata) => ({
    ...raw,
    _sizeDecimals: metadata.sizeDecimals.get(raw.symbol) ?? 4,
    _priceDecimals: metadata.priceDecimals.get(raw.symbol) ?? 2,
    _markPrice: raw.markPrice,
  }),

  normalizePosition,
});

// Re-exports
export type { YourDexPositionWithMeta } from './types';
export {
  fetchMarkets,
  fetchPositions,
  buildDecimalsMap,
  clearYourDexCache,
  fetchPortfolio,
  fetchTotalPnl,
} from './api';
export { normalizePosition } from './normalizer';
```

### 6. Register Provider

Add provider to the registry:

**File: `src/providers/index.ts`**

```typescript
// Add import
import { yourDexProvider } from './your-dex';

// Add to registry
export const providers: ProviderRegistry = {
  hyperliquid: hyperliquidProvider,
  lighter: lighterProvider,
  pacifica: pacificaProvider,
  aster: asterProvider,
  dydx: dydxProvider,
  'your-dex': yourDexProvider,  // ADD THIS
};

// Add exports section
export {
  yourDexProvider,
  fetchYourDexMarkets,
  fetchYourDexPositions,
  // ... other exports
  type YourDexPositionWithMeta,
} from './your-dex';
```

### 7. Add Normalizer Export

**File: `src/normalizers/index.ts`**

```typescript
import { yourDexProvider } from '../providers/your-dex';

export const normalizeYourDexPosition = yourDexProvider.normalizePosition;
```

### 8. Update Wallet Detection (if new chain)

If you added a new chain type, update wallet detection:

**File: `src/utils/chains.ts`**

```typescript
// Add wallet validator function
export const isYourChainWallet = (walletAddress: string): boolean => {
  return walletAddress.startsWith('yourprefix');
};

// Update NormalizedWallets interface
export interface NormalizedWallets {
  evm: string[];
  solana: string[];
  cosmos: string[];
  yourchain: string[];  // ADD THIS
}

// Update normalizeWalletsInput function
export const normalizeWalletsInput = (wallets: WalletsParam): NormalizedWallets => {
  // ... existing code
  return {
    evm: walletsArray.filter(isEvmWallet),
    solana: walletsArray.filter(isSolanaWallet),
    cosmos: walletsArray.filter(isDydxWallet),
    yourchain: walletsArray.filter(isYourChainWallet),  // ADD THIS
  };
};
```

### 9. Update useDexPositions Hook

**File: `src/hooks/useDexPositions.ts`**

Add chain filtering logic:

```typescript
// In activeProviders useMemo
if (provider.chain === 'yourchain') return normalizedWallets.yourchain.length > 0;

// In queries map for relevantWallets
const relevantWallets =
  provider.chain === 'evm' ? normalizedWallets.evm
  : provider.chain === 'cosmos' ? normalizedWallets.cosmos
  : provider.chain === 'yourchain' ? normalizedWallets.yourchain  // ADD THIS
  : normalizedWallets.solana;
```

### 10. Update useAggregatedPortfolio Hook

**File: `src/hooks/useAggregatedPortfolio.ts`**

#### 10a. Add import
```typescript
import { fetchSubaccount as fetchYourDexSubaccount, fetchTotalPnl as fetchYourDexTotalPnl } from '../providers/your-dex';
```

#### 10b. Add PerDexLoadingStates
```typescript
export interface PerDexLoadingStates {
  hyperliquid: boolean;
  lighter: boolean;
  pacifica: boolean;
  dydx: boolean;
  'your-dex': boolean;  // ADD THIS
}
```

#### 10c. Add account summary fetcher
```typescript
const fetchYourDexAccountSummary = async (
  wallets: string[]
): Promise<{ accountBalance: number; totalVolume: number; totalPnl: number }> => {
  // Implement similar to other DEXes
};
```

#### 10d. Add to activeProviders filter
```typescript
if (provider.chain === 'yourchain') return normalizedWallets.yourchain.length > 0;
```

#### 10e. Add account query
```typescript
{
  queryKey: ['account-summary', 'your-dex', ...normalizedWallets.yourchain.sort()],
  queryFn: () => fetchYourDexAccountSummary(normalizedWallets.yourchain),
  enabled: enabled && activeProviders.includes('your-dex'),
  // ... other options
},
```

#### 10f. Add to totals calculation
```typescript
const yourDexSummary = activeProviders.includes('your-dex') ? accountQueries[4].data : null;

const totalAccountBalance = ... + (yourDexSummary?.accountBalance ?? 0);
const totalPnl = ... + (yourDexSummary?.totalPnl ?? 0);
```

#### 10g. Add to perDex breakdown
```typescript
if (activeProviders.includes('your-dex')) {
  perDex['your-dex'] = yourDexSummary ? { ... } : null;
}
```

#### 10h. Add to loading states
```typescript
'your-dex': (activeProviders.includes('your-dex') && accountQueries[4]?.isLoading) || false,
```

### 11. Update useDexPortfolio Hook (if supporting portfolio charts)

**File: `src/hooks/useDexPortfolio.ts`**

#### 11a. Add to PortfolioProviderId type

**File: `src/types/portfolio.ts`**
```typescript
export type PortfolioProviderId = 'hyperliquid' | 'pacifica' | 'lighter' | 'dydx' | 'your-dex';
```

#### 11b. Add to providerChainFilter
```typescript
const providerChainFilter: Record<PortfolioProviderId, (wallet: string) => boolean> = {
  // ... existing
  'your-dex': isYourChainWallet,
};
```

#### 11c. Add to fetcher switch
```typescript
case 'your-dex':
  return fetchYourDexPortfolio;
```

### 12. Create Individual Hook (Optional)

**File: `src/hooks/useYourDexPositions.ts`**

```typescript
import { createProviderHook } from './createProviderHook';
import { yourDexProvider } from '../providers/your-dex';

export const useYourDexPositions = createProviderHook(yourDexProvider);

export type UseYourDexPositionsConfig = ProviderHookConfig;
export type UseYourDexPositionsOptions = ProviderHookOptions;
export type UseYourDexPositionsResult = ProviderHookResult<YourDexPositionWithMeta>;
```

### 13. Export from hooks/index.ts

```typescript
export {
  useYourDexPositions,
  type UseYourDexPositionsConfig,
  type UseYourDexPositionsOptions,
  type UseYourDexPositionsResult,
} from './useYourDexPositions';
```

### 14. Export Everything from Main Index

**File: `src/index.ts`**

Add all necessary exports:

```typescript
// Types
export type {
  YourDexCredentials,
  YourDexPositionRaw,
  YourDexMarketRaw,
} from './types/your-dex';

// Hook
export {
  useYourDexPositions,
  type UseYourDexPositionsConfig,
  type UseYourDexPositionsOptions,
  type UseYourDexPositionsResult,
} from './hooks/useYourDexPositions';

// Provider exports
export {
  yourDexProvider,
  fetchYourDexMarkets,
  fetchYourDexPositions,
  buildYourDexDecimalsMap,
  clearYourDexCache,
  type YourDexPositionWithMeta,
} from './providers';

// Normalizer
export { normalizeYourDexPosition } from './normalizers';

// Utils (if new chain)
export { isYourChainWallet } from './utils';
```

---

## Checklist

- [ ] Add chain type (if new chain)
- [ ] Add provider ID to `ProviderId` type
- [ ] Create `src/types/your-dex.ts`
- [ ] Export types from `src/types/index.ts`
- [ ] Create `src/providers/your-dex/` directory with:
  - [ ] `types.ts`
  - [ ] `api.ts`
  - [ ] `normalizer.ts`
  - [ ] `index.ts`
- [ ] Register provider in `src/providers/index.ts`
- [ ] Add normalizer export in `src/normalizers/index.ts`
- [ ] Update wallet detection in `src/utils/chains.ts` (if new chain)
- [ ] Update `useDexPositions` hook
- [ ] Update `useAggregatedPortfolio` hook
- [ ] Update `useDexPortfolio` hook (if supporting portfolio charts)
- [ ] Create individual hook (optional)
- [ ] Export from `src/hooks/index.ts`
- [ ] Export everything from `src/index.ts`
- [ ] Run `npm run typecheck`
- [ ] Run `npm run build`
- [ ] Bump version in `package.json`

---

## Testing

After integration:

1. Test positions fetching:
```typescript
const { positions } = useYourDexPositions({
  wallets: 'your-wallet-address',
});
```

2. Test with unified hook:
```typescript
const { positions } = useDexPositions({
  wallets: ['your-wallet-address'],
});
```

3. Test aggregated portfolio:
```typescript
const { data } = useAggregatedPortfolio({
  wallets: ['your-wallet-address'],
});
console.log(data?.perDex['your-dex']);
```
