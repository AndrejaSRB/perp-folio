// Lighter API Response Types
// Base URL: https://mainnet.zklighter.elliot.ai
// Docs: https://apidocs.lighter.xyz

// ============================================
// Credentials
// ============================================

/**
 * Lighter API credentials (read-only token)
 * Used for authenticated endpoints: /account, /orders, /positions, /fills, /transfers
 */
export interface LighterCredentials {
  /** Read-only API token (format: "ro:YOUR_READ_TOKEN") */
  readToken: string;
}

// ============================================
// Raw API Response Types
// ============================================

export interface LighterPosition {
  market_id: number;
  symbol: string;
  initial_margin_fraction: string;
  open_order_count: number;
  pending_order_count: number;
  position_tied_order_count: number;
  /** 1 = long, -1 = short */
  sign: number;
  position: string;
  avg_entry_price: string;
  position_value: string;
  unrealized_pnl: string;
  realized_pnl: string;
  liquidation_price: string;
  total_funding_paid_out?: string;
  /** 0 = cross, 1 = isolated */
  margin_mode: number;
  allocated_margin: string;
}

export interface LighterAccount {
  /** 0 = inactive, 1 = active */
  status: number;
  collateral: string;
  account_index: number;
  l1_address: string;
  positions: LighterPosition[];
  code: number;
  account_type: number;
  index: number;
  cancel_all_time: number;
  total_order_count: number;
  total_isolated_order_count: number;
  pending_order_count: number;
  available_balance: string;
  name: string;
  description: string;
}

export interface LighterAccountsResponse {
  code: number;
  total: number;
  accounts: LighterAccount[];
}

export interface LighterOrderBookDetails {
  symbol: string;
  market_id: number;
  market_type: string;
  status: string;
  last_trade_price: number;
  open_interest: number;
  daily_base_token_volume: number;
  daily_quote_token_volume: number;
  daily_price_low: number;
  daily_price_high: number;
  daily_price_change: number;
  supported_size_decimals: number;
  supported_price_decimals: number;
}

export interface LighterOrderBookDetailsResponse {
  code: number;
  order_book_details: LighterOrderBookDetails[];
}

/** Market metadata from orderBooks endpoint */
export interface LighterMarketMeta {
  symbol: string;
  market_id: number;
  market_type: string;
  base_asset_id: number;
  quote_asset_id: number;
  status: string;
  taker_fee: string;
  maker_fee: string;
  liquidation_fee: string;
  min_base_amount: string;
  min_quote_amount: string;
  order_quote_limit: string;
  supported_size_decimals: number;
  supported_price_decimals: number;
  supported_quote_decimals: number;
}

export interface LighterOrderBooksResponse {
  code: number;
  order_books: LighterMarketMeta[];
}
