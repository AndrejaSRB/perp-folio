// Pacifica API Response Types
// Base URL: https://api.pacifica.fi/api/v1
// Docs: https://docs.pacifica.fi/api-documentation/api/rest-api

export interface PacificaPosition {
  symbol: string;
  side: string;
  amount: string;
  entry_price: string;
  margin: string;
  funding: string;
  isolated: boolean;
  created_at: number;
  updated_at: number;
}

export interface PacificaPositionsResponse {
  success: boolean;
  data: PacificaPosition[];
  error: string | null;
  code: string | null;
  last_order_id: number;
}

export interface PacificaAccountSetting {
  symbol: string;
  isolated: boolean;
  leverage: number;
  created_at: number;
  updated_at: number;
}

export interface PacificaAccountSettingsResponse {
  success: boolean;
  data: PacificaAccountSetting[];
  error: string | null;
  code: string | null;
}

export interface PacificaMarketInfo {
  symbol: string;
  tick_size: string;
  min_tick: string;
  max_tick: string;
  lot_size: string;
  max_leverage: number;
  isolated_only: boolean;
  min_order_size: string;
  max_order_size: string;
  funding_rate: string;
  next_funding_rate: string;
  created_at: string;
}

export interface PacificaMarketInfoResponse {
  success: boolean;
  data: PacificaMarketInfo[];
  error: string | null;
  code: string | null;
}

export interface PacificaPrice {
  symbol: string;
  funding: string;
  mark: string;
  mid: string;
  next_funding: string;
  open_interest: string;
  oracle: string;
  timestamp: number;
  volume_24h: string;
  yesterday_price: string;
}

export interface PacificaPricesResponse {
  success: boolean;
  data: PacificaPrice[];
  error: string | null;
  code: string | null;
}
