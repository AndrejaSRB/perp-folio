# Adding a New DEX Provider

Quick guide to integrate a new perpetual DEX into `@hypersignals/perp-folio`.

## File Structure

Create these files for your new DEX (e.g., `mydex`):

```
src/
├── types/mydex.ts              # Raw API types
├── providers/mydex/
│   ├── api.ts                  # API calls
│   ├── types.ts                # PositionWithMeta type
│   ├── normalizer.ts           # Position normalizer
│   └── index.ts                # Provider export
└── hooks/useMydexPositions.ts  # React hook (if credential-based)
```

## Step 1: Types (`src/types/mydex.ts`)

```typescript
export interface MydexCredentials {
  apiKey: string;
  // apiSecret?: string; // if needed
}

export interface MydexPositionRaw {
  // Raw fields from API response
  symbol: string;
  size: string;
  entryPrice: string;
  markPrice: string;
  // ... etc
}
```

## Step 2: Add to ProviderId (`src/types/common.ts`)

```typescript
export type ProviderId = 'hyperliquid' | 'lighter' | ... | 'mydex';
```

## Step 3: API Layer (`src/providers/mydex/api.ts`)

```typescript
import { cachedFetch } from '../../utils/cachedFetch';

const BASE_URL = 'https://api.mydex.com';

// Public endpoints (cached)
export async function fetchMarkets() { ... }
export async function buildDecimalsMap() { ... }

// Authenticated endpoints (not cached)
export async function fetchPositions(credentials: MydexCredentials) { ... }

export function clearMydexCache() { ... }
```

## Step 4: Provider (`src/providers/mydex/index.ts`)

```typescript
export const mydexProvider: DexProvider<MydexPositionWithMeta> = {
  id: 'mydex',
  name: 'MyDEX',
  chain: 'evm', // or 'solana'
  requiresCredentials: true, // false for wallet-based

  async fetchPositions(address, credentials?) {
    // 1. Fetch raw positions
    // 2. Filter zero positions
    // 3. Enrich with metadata (decimals, etc.)
    // 4. Return enriched positions
  },

  normalizePosition, // from ./normalizer.ts
};
```

## Step 5: Normalizer (`src/providers/mydex/normalizer.ts`)

Map raw position to `NormalizedPosition`:

```typescript
export function normalizePosition(
  position: MydexPositionWithMeta,
  wallet: string
): NormalizedPosition {
  return {
    id: `mydex-${wallet}-${position.symbol}`,
    provider: 'mydex',
    wallet,
    symbol: position.symbol,
    side: getSideFromSignedSize(parseFloat(position.size)),
    size: Math.abs(parseFloat(position.size)).toString(),
    // ... map all required fields
  };
}
```

## Step 6: Register Provider (`src/providers/index.ts`)

```typescript
import { mydexProvider } from './mydex';

export const providers: ProviderRegistry = {
  // ... existing
  mydex: mydexProvider,
};

// Add exports
export { mydexProvider, ... } from './mydex';
```

## Step 7: Hook (for credential-based DEXes)

If your DEX requires credentials, create `src/hooks/useMydexPositions.ts` and update `useDexPositions.ts`:

```typescript
// In DexCredentials interface
export interface DexCredentials {
  // ... existing
  mydexApiKey?: string;
}
```

## Step 8: Update Exports (`src/index.ts`)

Add exports for types, hooks, and provider functions.

## Checklist

- [ ] Types in `src/types/mydex.ts`
- [ ] ProviderId updated
- [ ] API layer with caching
- [ ] Provider implementation
- [ ] Normalizer mapping all fields
- [ ] Provider registered
- [ ] Hook (if credential-based)
- [ ] Credentials in `useDexPositions` (if needed)
- [ ] All exports updated
- [ ] `npm run typecheck` passes
- [ ] `npm run build` passes
