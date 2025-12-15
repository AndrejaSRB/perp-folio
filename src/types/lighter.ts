// Lighter API Response Types
// Base URL: https://mainnet.zklighter.elliot.ai
// Docs: https://apidocs.lighter.xyz

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
  mark_price: string;
  index_price: string;
  funding_rate: string;
  next_funding_time: number;
  open_interest: string;
  volume_24h: string;
}

export interface LighterOrderBookDetailsResponse {
  order_book: LighterOrderBookDetails;
}
