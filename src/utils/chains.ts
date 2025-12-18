import { Address, checksumAddress } from "viem";

/**
 * EVM address regex - validates 0x followed by 40 hex characters
 */
const EVM_ADDRESS_REGEX = /^0x[a-fA-F0-9]{40}$/;

/**
 * Solana address regex - validates Base58 format (32-44 characters)
 */
const SOLANA_ADDRESS_REGEX = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

/**
 * Check if a wallet address is a valid EVM address
 */
export const isEvmWallet = (walletAddress: string): boolean => {
  return EVM_ADDRESS_REGEX.test(walletAddress);
};

/**
 * Normalize position side to 'long' | 'short'
 * Handles various API formats: long/short, buy/sell, bid/ask
 */
export const normalizeSide = (side: string): "long" | "short" => {
  const normalized = side.toLowerCase().trim();

  if (["long", "buy", "bid"].includes(normalized)) {
    return "long";
  }

  if (["short", "sell", "ask"].includes(normalized)) {
    return "short";
  }

  // Default fallback - log warning in dev
  console.warn(`Unknown position side: "${side}", defaulting to "long"`);
  return "long";
};

/**
 * dYdX address regex - validates Cosmos Bech32 format
 * Format: dydx1 followed by 38 lowercase alphanumeric characters (excluding b, i, o, 1)
 */
const DYDX_ADDRESS_REGEX = /^dydx1[ac-hj-np-z02-9]{38}$/;

/**
 * Check if a wallet address is a valid dYdX (Cosmos) address
 */
export const isDydxWallet = (walletAddress: string): boolean => {
  return DYDX_ADDRESS_REGEX.test(walletAddress);
};

/**
 * Check if a wallet address is a valid Solana address (Base58 format)
 */
export const isSolanaWallet = (walletAddress: string): boolean => {
  return SOLANA_ADDRESS_REGEX.test(walletAddress);
};

export interface NormalizedWallets {
  evm: string[];
  solana: string[];
  cosmos: string[];
}

export type WalletsParam = string | string[] | NormalizedWallets;

/**
 * Convert an EVM address to checksum format
 * Assumes the address is already validated (no isAddress check)
 */
export const toChecksumAddress = (addr: string): string => {
  return checksumAddress(addr as Address);
};

/**
 * Normalize wallet input to structured { evm: [], solana: [], cosmos: [] } format
 * Auto-detects chain type based on address format
 */
export const normalizeWalletsInput = (
  wallets: WalletsParam
): NormalizedWallets => {
  // Already normalized object
  if (typeof wallets === "object" && !Array.isArray(wallets)) {
    return {
      evm: Array.isArray(wallets.evm)
        ? wallets.evm
        : wallets.evm
        ? [wallets.evm]
        : [],
      solana: Array.isArray(wallets.solana)
        ? wallets.solana
        : wallets.solana
        ? [wallets.solana]
        : [],
      cosmos: Array.isArray((wallets as NormalizedWallets).cosmos)
        ? (wallets as NormalizedWallets).cosmos
        : (wallets as NormalizedWallets).cosmos
        ? [(wallets as NormalizedWallets).cosmos as unknown as string]
        : [],
    };
  }

  // Single string or array - auto-detect chain by address format
  const walletsArray = Array.isArray(wallets) ? wallets : [wallets];

  return {
    evm: walletsArray.filter(isEvmWallet),
    solana: walletsArray.filter(isSolanaWallet),
    cosmos: walletsArray.filter(isDydxWallet),
  };
};
