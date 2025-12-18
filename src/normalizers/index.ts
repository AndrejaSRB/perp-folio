/**
 * Normalizers - Transform raw DEX responses to NormalizedPosition
 *
 * These are re-exported from providers for convenience.
 * Each provider has its own normalizePosition function.
 */

import { hyperliquidProvider } from '../providers/hyperliquid';
import { lighterProvider } from '../providers/lighter';
import { pacificaProvider } from '../providers/pacifica';
import { asterProvider } from '../providers/aster';
import { dydxProvider } from '../providers/dydx';

export const normalizeHyperliquidPosition = hyperliquidProvider.normalizePosition;
export const normalizeLighterPosition = lighterProvider.normalizePosition;
export const normalizePacificaPosition = pacificaProvider.normalizePosition;
export const normalizeAsterPosition = asterProvider.normalizePosition;
export const normalizeDydxPosition = dydxProvider.normalizePosition;
