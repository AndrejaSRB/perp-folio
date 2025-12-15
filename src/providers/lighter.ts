import type { DexProvider } from './types';
import type {
  LighterPosition,
  LighterAccountsResponse,
  NormalizedPosition,
} from '../types';

const BASE_URL = 'https://mainnet.zklighter.elliot.ai';

/**
 * Fetch account data from Lighter
 */
const fetchAccount = async (address: string): Promise<LighterAccountsResponse> => {
  const response = await fetch(
    `${BASE_URL}/api/v1/account?by=l1_address&value=${address}`
  );

  if (!response.ok) {
    if (response.status === 404) {
      // No account found - return empty
      return {
        code: 404,
        total: 0,
        accounts: [],
      };
    }
    throw new Error(`Lighter API error: ${response.status}`);
  }

  return response.json();
};

/**
 * Normalize Lighter position to standard format
 */
const normalizePosition = (
  raw: LighterPosition,
  wallet: string
): NormalizedPosition => {
  // Calculate leverage from initial margin fraction
  // leverage = 1 / initial_margin_fraction
  const imf = parseFloat(raw.initial_margin_fraction);
  const leverage = imf > 0 ? Math.round(1 / imf) : 1;

  return {
    id: `lighter-${wallet}-${raw.symbol}`,
    provider: 'lighter',
    wallet,
    symbol: raw.symbol,
    side: raw.sign === 1 ? 'long' : 'short',
    size: raw.position,
    entryPrice: raw.avg_entry_price,
    markPrice: null, // Would need orderBookDetails fetch
    unrealizedPnl: raw.unrealized_pnl,
    realizedPnl: raw.realized_pnl,
    leverage,
    leverageType: raw.margin_mode === 1 ? 'isolated' : 'cross',
    liquidationPrice: raw.liquidation_price,
    margin: raw.allocated_margin,
    maxLeverage: null,
    fundingAccrued: raw.total_funding_paid_out ?? null,
    timestamp: Date.now(),
  };
};

export const lighterProvider: DexProvider<LighterPosition> = {
  id: 'lighter',
  name: 'Lighter',
  chain: 'evm',

  fetchPositions: async (address: string): Promise<LighterPosition[]> => {
    const data = await fetchAccount(address);

    // No accounts found
    if (data.accounts.length === 0) {
      return [];
    }

    // Aggregate positions from all accounts (master + subaccounts)
    const allPositions = data.accounts.flatMap((account) => account.positions);

    // Filter out zero positions
    return allPositions.filter((p) => parseFloat(p.position) !== 0);
  },

  normalizePosition,
};

// Export raw fetcher for advanced use
export { fetchAccount };
