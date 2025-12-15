/**
 * Factory for creating DEX providers
 * Reduces boilerplate by abstracting common patterns
 */

import type { ChainType, ProviderId, NormalizedPosition } from '../../types';
import type { DexProvider } from '../types';
import { isZeroPosition } from '../../utils/positionCalc';

/**
 * Configuration for creating a provider
 *
 * @template TRaw - Raw position type from DEX API
 * @template TEnriched - Position type with metadata added
 * @template TMeta - Metadata type (decimals, prices, etc.)
 */
export interface ProviderConfig<TRaw, TEnriched, TMeta = unknown> {
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
  fetchRawPositions: (address: string) => Promise<TRaw[]>;

  /**
   * Get the size value from a raw position (used for zero filtering)
   */
  getPositionSize: (raw: TRaw) => string | number;

  /**
   * Fetch metadata (decimals, prices, etc.)
   * Only called if there are non-zero positions
   */
  fetchMetadata: () => Promise<TMeta>;

  /**
   * Enrich a raw position with metadata
   */
  enrichPosition: (raw: TRaw, metadata: TMeta) => TEnriched;

  /**
   * Normalize an enriched position to the standard format
   */
  normalizePosition: (enriched: TEnriched, wallet: string) => NormalizedPosition;
}

/**
 * Create a DEX provider from configuration
 *
 * This factory handles the common pattern of:
 * 1. Fetching raw positions
 * 2. Filtering out zero positions
 * 3. Fetching metadata only if positions exist
 * 4. Enriching positions with metadata
 *
 * @example
 * ```typescript
 * const myProvider = createProvider({
 *   id: 'mydex',
 *   name: 'My DEX',
 *   chain: 'evm',
 *   fetchRawPositions: async (address) => fetchPositions(address),
 *   getPositionSize: (raw) => raw.size,
 *   fetchMetadata: async () => buildDecimalsMap(),
 *   enrichPosition: (raw, meta) => ({
 *     ...raw,
 *     _sizeDecimals: meta.sizeDecimals.get(raw.symbol) ?? 0,
 *   }),
 *   normalizePosition: (enriched, wallet) => ({
 *     id: `mydex-${wallet}-${enriched.symbol}`,
 *     // ... other fields
 *   }),
 * });
 * ```
 */
export function createProvider<TRaw, TEnriched, TMeta = unknown>(
  config: ProviderConfig<TRaw, TEnriched, TMeta>
): DexProvider<TEnriched> {
  const {
    id,
    name,
    chain,
    fetchRawPositions,
    getPositionSize,
    fetchMetadata,
    enrichPosition,
    normalizePosition,
  } = config;

  return {
    id,
    name,
    chain,

    async fetchPositions(address: string): Promise<TEnriched[]> {
      // Step 1: Fetch raw positions
      const rawPositions = await fetchRawPositions(address);

      // Step 2: Filter out zero positions
      const nonZeroPositions = rawPositions.filter(
        (p) => !isZeroPosition(getPositionSize(p))
      );

      // Step 3: Early return if no positions (skip metadata fetch)
      if (nonZeroPositions.length === 0) {
        return [];
      }

      // Step 4: Fetch metadata (only if we have positions)
      const metadata = await fetchMetadata();

      // Step 5: Enrich positions with metadata
      return nonZeroPositions.map((p) => enrichPosition(p, metadata));
    },

    normalizePosition,
  };
}

/**
 * Extended configuration for providers with symbol-based metadata
 * Common pattern where metadata is keyed by symbol
 */
export interface SymbolMetadataProviderConfig<TRaw, TEnriched, TMetaItem>
  extends Omit<ProviderConfig<TRaw, TEnriched, Map<string, TMetaItem>>, 'fetchMetadata' | 'enrichPosition'> {
  /**
   * Get the symbol from a raw position
   */
  getSymbol: (raw: TRaw) => string;

  /**
   * Fetch metadata and return as a Map<symbol, data>
   */
  fetchMetadata: () => Promise<Map<string, TMetaItem>>;

  /**
   * Create default metadata for unknown symbols
   */
  defaultMetadata: TMetaItem;

  /**
   * Enrich a raw position with its metadata
   */
  enrichPosition: (raw: TRaw, meta: TMetaItem) => TEnriched;
}

/**
 * Create a provider with symbol-based metadata lookup
 *
 * This is a convenience wrapper for the common pattern where
 * metadata is stored in a Map keyed by symbol.
 */
export function createSymbolMetadataProvider<TRaw, TEnriched, TMetaItem>(
  config: SymbolMetadataProviderConfig<TRaw, TEnriched, TMetaItem>
): DexProvider<TEnriched> {
  const { getSymbol, defaultMetadata, ...baseConfig } = config;

  return createProvider<TRaw, TEnriched, Map<string, TMetaItem>>({
    ...baseConfig,
    enrichPosition: (raw, metadataMap) => {
      const symbol = getSymbol(raw);
      const meta = metadataMap.get(symbol) ?? defaultMetadata;
      return config.enrichPosition(raw, meta);
    },
  });
}
