export type ChainType = 'evm' | 'solana';

export type ProviderId = 'hyperliquid' | 'lighter' | 'pacifica' | 'aster' | 'extended';

export interface NormalizedPosition {
  /** Unique identifier: `{provider}-{wallet}-{symbol}` */
  id: string;
  /** DEX provider ID */
  provider: ProviderId;
  /** Wallet address */
  wallet: string;
  /** Trading symbol (e.g., 'BTC', 'ETH') */
  symbol: string;
  /** Position direction */
  side: 'long' | 'short';
  /** Position size (absolute value) */
  size: string;
  /** Position value in USD (size * markPrice) */
  sizeUsd: string | null;
  /** Entry price */
  entryPrice: string;
  /** Current mark price */
  markPrice: string | null;
  /** Unrealized profit/loss */
  unrealizedPnl: string;
  /** Realized profit/loss */
  realizedPnl: string | null;
  /** Return on Investment percentage (unrealizedPnl / margin * 100) */
  roi: string | null;
  /** Current leverage */
  leverage: number;
  /** Margin mode */
  leverageType: 'cross' | 'isolated';
  /** Liquidation price */
  liquidationPrice: string | null;
  /** Margin allocated to position */
  margin: string;
  /** Maximum allowed leverage for this market */
  maxLeverage: number | null;
  /** Accumulated funding payments */
  fundingAccrued: string | null;
  /** Timestamp of position data */
  timestamp: number;
  /** Size decimals for formatting (from market metadata) */
  sizeDecimals: number;
  /** Price decimals for formatting (from market metadata) */
  priceDecimals: number;
}
