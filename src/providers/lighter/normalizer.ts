import type { NormalizedPosition } from "../../types";
import type { LighterPositionWithMeta } from "./types";

const toNum = (v: unknown): number => {
  const n = typeof v === "string" ? Number(v) : typeof v === "number" ? v : NaN;
  return Number.isFinite(n) ? n : 0;
};

const toStr = (n: number): string => (Number.isFinite(n) ? String(n) : "0");

export const normalizePosition = (
  raw: LighterPositionWithMeta,
  wallet: string
): NormalizedPosition => {
  // IMF is a percent string in your payload: "5.00" = 5% => 20x
  const imfPct = toNum(raw.initial_margin_fraction);
  const leverage = imfPct > 0 ? Math.round(100 / imfPct) : 1;

  const size = toNum(raw.position);
  const absSize = Math.abs(size);

  const entry = toNum(raw.avg_entry_price);
  const mark = raw._markPrice != null ? toNum(raw._markPrice) : 0;

  // Prefer API-provided USD value when available
  const posValueAbs = Math.abs(toNum(raw.position_value));

  // sizeUsd: mark first, else api position_value, else entry fallback
  let sizeUsd: string | null = null;
  if (mark > 0) sizeUsd = toStr(absSize * mark);
  else if (posValueAbs > 0) sizeUsd = toStr(posValueAbs);
  else if (entry > 0) sizeUsd = toStr(absSize * entry);

  // Margin: allocated_margin is often 0 in cross mode.
  // For cross, estimate margin from position value and IMF%
  const allocatedMargin = toNum(raw.allocated_margin);

  // Calculate margin: use allocated if available, otherwise estimate from position value
  // For cross margin: margin = position_value / leverage = position_value * (IMF% / 100)
  let margin: number;
  if (allocatedMargin > 0) {
    margin = allocatedMargin;
  } else if (mark > 0 && imfPct > 0) {
    // Use mark price for more accurate margin calculation
    margin = (absSize * mark) * (imfPct / 100);
  } else if (posValueAbs > 0 && imfPct > 0) {
    margin = posValueAbs * (imfPct / 100);
  } else {
    margin = 0;
  }

  const unrealizedPnl = toNum(raw.unrealized_pnl);
  const roi = margin > 0 ? toStr((unrealizedPnl / margin) * 100) : null;

  // IMPORTANT: avoid id collisions. If you don’t have account_index on the position, see section 2.
  const accountKey = (raw as any)._accountIndex ?? "na";

  return {
    id: `lighter-${wallet}-${accountKey}-${raw.symbol}`,
    provider: "lighter",
    wallet,
    symbol: raw.symbol,
    side: raw.sign === 1 ? "long" : "short",
    size: raw.position,
    sizeUsd,
    entryPrice: raw.avg_entry_price,
    markPrice: raw._markPrice ?? null,
    unrealizedPnl: raw.unrealized_pnl,
    realizedPnl: raw.realized_pnl,
    roi,
    leverage,
    leverageType: raw.margin_mode === 1 ? "isolated" : "cross",
    liquidationPrice: raw.liquidation_price,
    margin: toStr(margin),
    maxLeverage: null,
    fundingAccrued: raw.total_funding_paid_out ?? null,
    timestamp: Date.now(),
    sizeDecimals: raw._sizeDecimals,
    priceDecimals: raw._priceDecimals,
  };
};
