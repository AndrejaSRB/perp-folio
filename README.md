# @hypersignals/perp-folio

Multi-chain DEX position aggregator SDK with React hooks. Fetch perpetual positions, portfolio history, and account data from HyperLiquid, Lighter, Pacifica, Aster, and Extended.

## Installation

```bash
npm install @hypersignals/perp-folio
# or
pnpm add @hypersignals/perp-folio
```

### Peer Dependencies

```bash
npm install @tanstack/react-query react
```

## Quick Start

Wrap your app with `QueryClientProvider`:

```tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <YourApp />
    </QueryClientProvider>
  );
}
```

## Supported DEXes

| Provider | Chain | Positions | Portfolio History | Account Summary |
|----------|-------|-----------|-------------------|-----------------|
| HyperLiquid | EVM | Yes | Yes | Yes |
| Lighter | EVM | Yes | Yes | Yes |
| Pacifica | Solana | Yes | Yes | Yes |
| Aster | EVM | Yes | No | No |
| Extended | API Key | Yes | No | Yes (balance only) |

## Hooks

### `useDexPositions` - Fetch Positions from All DEXes

Fetch normalized positions from multiple DEXes in a single hook.

```tsx
import { useDexPositions } from '@hypersignals/perp-folio';

function Positions() {
  const { positions, isLoading, errors } = useDexPositions({
    wallets: ['0x1234...', '0x5678...'], // EVM addresses
    solanaWallets: ['ABC123...'],         // Solana addresses
    credentials: {
      lighter: { readToken: 'your-lighter-token' },
      aster: { apiKey: 'key', apiSecret: 'secret' },
      extended: { apiKey: 'your-extended-api-key' },
    },
  });

  return (
    <div>
      {positions.map((pos) => (
        <div key={`${pos.provider}-${pos.symbol}`}>
          {pos.provider}: {pos.symbol} {pos.side} {pos.size} @ {pos.entryPrice}
          PnL: {pos.unrealizedPnl}
        </div>
      ))}
    </div>
  );
}
```

### Individual DEX Hooks

For more control, use individual hooks:

```tsx
import {
  useHyperliquidPositions,
  useLighterPositions,
  usePacificaPositions,
  useAsterPositions,
  useExtendedPositions,
} from '@hypersignals/perp-folio';

// HyperLiquid (EVM)
const { positions } = useHyperliquidPositions({
  wallets: ['0x1234...'],
});

// Lighter (EVM) - requires read token
const { positions } = useLighterPositions({
  wallets: ['0x1234...'],
  credentials: { readToken: 'your-token' },
});

// Pacifica (Solana)
const { positions } = usePacificaPositions({
  wallets: ['ABC123...'],
});

// Aster (EVM) - requires API credentials
const { positions } = useAsterPositions({
  credentials: { apiKey: 'key', apiSecret: 'secret' },
});

// Extended - requires API key
const { positions } = useExtendedPositions({
  credentials: { apiKey: 'your-api-key' },
});
```

### `useDexPortfolio` - Portfolio History (PnL & Account Value)

Fetch historical PnL and account value data for charting.

```tsx
import { useDexPortfolio } from '@hypersignals/perp-folio';

function PortfolioChart() {
  const { wallets, isLoading } = useDexPortfolio({
    provider: 'hyperliquid', // 'hyperliquid' | 'lighter' | 'pacifica' | 'extended'
    wallets: ['0x1234...'],
    timeframe: '7d', // '1d' | '7d' | '30d' | 'all'
    lighterReadToken: 'token', // Required for Lighter
  });

  // wallets contains array of { wallet, pnl, accountValue }
  // pnl and accountValue are arrays of { timestamp, value }

  return (
    <div>
      {wallets.map(({ wallet, pnl, accountValue }) => (
        <div key={wallet}>
          {pnl.map((point) => (
            <span key={point.timestamp}>
              {new Date(point.timestamp).toLocaleDateString()}: ${point.value}
            </span>
          ))}
        </div>
      ))}
    </div>
  );
}
```

### `useAggregatedPortfolio` - Combined Account Summary

Get aggregated account data across all DEXes.

```tsx
import { useAggregatedPortfolio } from '@hypersignals/perp-folio';

function AccountSummary() {
  const {
    data,
    perDexBreakdown,
    isLoading,
    perDexLoading,
  } = useAggregatedPortfolio({
    wallets: ['0x1234...'],
    solanaWallets: ['ABC123...'],
    credentials: {
      lighter: { readToken: 'token' },
      extended: { apiKey: 'key' },
    },
  });

  return (
    <div>
      <h2>Total Account Value: ${data.accountBalance.toFixed(2)}</h2>
      <p>Total PnL: ${data.totalPnl.toFixed(2)}</p>
      <p>Unrealized PnL: ${data.unrealizedPnl.toFixed(2)}</p>

      <h3>Per-DEX Breakdown</h3>
      <p>HyperLiquid: ${perDexBreakdown.hyperliquid.accountBalance.toFixed(2)}</p>
      <p>Lighter: ${perDexBreakdown.lighter.accountBalance.toFixed(2)}</p>
      <p>Pacifica: ${perDexBreakdown.pacifica.accountBalance.toFixed(2)}</p>
      <p>Extended: ${perDexBreakdown.extended.accountBalance.toFixed(2)}</p>
    </div>
  );
}
```

## Normalized Position Type

All positions are normalized to a common format:

```typescript
interface NormalizedPosition {
  provider: 'hyperliquid' | 'lighter' | 'pacifica' | 'aster' | 'extended';
  wallet: string;
  symbol: string;
  side: 'long' | 'short';
  size: string;
  entryPrice: string;
  markPrice: string;
  liquidationPrice: string | null;
  leverage: string;
  marginUsed: string;
  unrealizedPnl: string;
  realizedPnl: string;
  fundingPnl: string;
  sizeDecimals: number;
  priceDecimals: number;
}
```

## Configuration Options

All hooks accept common configuration options:

```typescript
{
  enabled?: boolean;           // Enable/disable the query (default: true)
  refetchInterval?: number;    // Auto-refetch interval in ms (default: false)
  refetchOnWindowFocus?: boolean; // Refetch on window focus (default: false)
  staleTime?: number;          // Time before data is stale in ms (default: 60000)
  retry?: number | boolean;    // Retry attempts (default: 2)
  keepPreviousData?: boolean;  // Keep previous data while refetching (default: true)
}
```

## Utility Functions

### Formatting

```typescript
import {
  formatPosition,
  formatPositions,
  formatPnl,
  formatSize,
  formatPrice,
} from '@hypersignals/perp-folio';

// Format a single position with proper decimals
const formatted = formatPosition(position);

// Format PnL with sign
const pnl = formatPnl('123.456789', 2); // "+123.46"
```

### Chain Utilities

```typescript
import { isEvmWallet, isSolanaWallet } from '@hypersignals/perp-folio';

isEvmWallet('0x1234...'); // true
isSolanaWallet('ABC123...'); // true
```

### Cache Management

```typescript
import {
  clearHyperliquidCache,
  clearLighterCache,
  clearPacificaCache,
  clearAsterCache,
  clearExtendedCache,
  clearAllCache,
} from '@hypersignals/perp-folio';

// Clear cache for specific provider
clearHyperliquidCache();

// Clear all caches
clearAllCache();
```

## Advanced Usage

### Direct API Access

For advanced use cases, you can access the underlying API functions:

```typescript
import {
  fetchClearinghouseState,
  fetchLighterPositions,
  fetchPacificaPositions,
  fetchLighterPnl,
  fetchLighterTotalPnl,
  fetchExtendedBalance,
} from '@hypersignals/perp-folio';

// Fetch raw HyperLiquid clearinghouse state
const state = await fetchClearinghouseState('0x1234...');

// Fetch Lighter PnL data
const pnl = await fetchLighterPnl(accountIndex, '7d', { readToken: 'token' });

// Fetch total PnL for Lighter account
const totalPnl = await fetchLighterTotalPnl('0x1234...', { readToken: 'token' });

// Fetch Extended balance
const balance = await fetchExtendedBalance({ apiKey: 'key' });
```

### Creating Custom Providers

```typescript
import { createProvider } from '@hypersignals/perp-folio';

const customProvider = createProvider({
  id: 'custom',
  name: 'Custom DEX',
  chain: 'evm',
  fetchPositions: async (wallet) => {
    // Your implementation
  },
  normalizePosition: (raw) => {
    // Normalize to NormalizedPosition
  },
});
```

## TypeScript Support

Full TypeScript support with exported types:

```typescript
import type {
  NormalizedPosition,
  ProviderId,
  ChainType,
  PortfolioTimeframe,
  PortfolioDataPoint,
  WalletPortfolio,
  UseDexPositionsOptions,
  UseDexPortfolioOptions,
  UseAggregatedPortfolioOptions,
} from '@hypersignals/perp-folio';
```

## License

MIT
