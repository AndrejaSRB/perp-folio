import type { ChainType, ProviderId, NormalizedPosition } from '../types';

/**
 * Interface for DEX providers - implement this to add a new DEX
 *
 * @template TRaw - The raw position type from the DEX API
 *
 * @example
 * ```typescript
 * const myDexProvider: DexProvider<MyDexPosition> = {
 *   id: 'mydex',
 *   name: 'My DEX',
 *   chain: 'evm',
 *   fetchPositions: async (address) => {
 *     const res = await fetch(`https://api.mydex.com/positions/${address}`);
 *     return res.json();
 *   },
 *   normalizePosition: (raw, wallet) => ({
 *     id: `mydex-${wallet}-${raw.symbol}`,
 *     // ... normalize other fields
 *   }),
 * };
 * ```
 */
export interface DexProvider<TRaw = unknown> {
  /** Unique provider identifier */
  id: ProviderId;
  /** Human-readable provider name */
  name: string;
  /** Blockchain type this provider supports */
  chain: ChainType;

  /**
   * Fetch raw positions from the DEX API
   * Should return empty array if no positions or on 404
   */
  fetchPositions: (address: string) => Promise<TRaw[]>;

  /**
   * Normalize a raw position to the standard NormalizedPosition format
   */
  normalizePosition: (raw: TRaw, wallet: string) => NormalizedPosition;
}

// Use 'any' for the registry to allow heterogeneous provider types
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ProviderRegistry = Record<ProviderId, DexProvider<any>>;
