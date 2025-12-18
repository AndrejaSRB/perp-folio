/**
 * Portfolio types for PnL and Account Value history
 */

/**
 * Supported timeframes for portfolio data
 */
export type PortfolioTimeframe = '1d' | '7d' | '30d' | 'all';

/**
 * Single data point in portfolio history
 */
export interface PortfolioDataPoint {
  timestamp: number;
  value: string;
}

/**
 * Portfolio data for a single wallet
 */
export interface WalletPortfolio {
  wallet: string;
  pnl: PortfolioDataPoint[];
  accountValue: PortfolioDataPoint[];
}

/**
 * Providers that support portfolio data
 */
export type PortfolioProviderId = 'hyperliquid' | 'pacifica' | 'lighter' | 'dydx';

/**
 * Lighter PnL data point from API
 */
export interface LighterPnlDataPoint {
  timestamp: number;
  /** Total trading PnL (realized + unrealized) */
  trade_pnl: number;
  /** LP pool PnL */
  pool_pnl: number;
  /** Total deposits */
  inflow: number;
  /** Total withdrawals */
  outflow: number;
}

/**
 * Lighter PnL API response
 */
export interface LighterPnlResponse {
  code: number;
  resolution: string;
  pnl: LighterPnlDataPoint[];
}
