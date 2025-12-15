/**
 * Check if a wallet address is an EVM address (starts with 0x)
 */
export const isEvmWallet = (walletAddress: string): boolean => {
  return walletAddress.slice(0, 2).toLowerCase() === '0x';
};

/**
 * Check if a wallet address is a Solana address (not starting with 0x)
 */
export const isSolanaWallet = (walletAddress: string): boolean => {
  return !isEvmWallet(walletAddress);
};

export interface NormalizedWallets {
  evm: string[];
  solana: string[];
}

export type WalletsParam = string | string[] | NormalizedWallets;

/**
 * Normalize wallet input to structured { evm: [], solana: [] } format
 * Auto-detects chain type based on address format
 */
export const normalizeWalletsInput = (wallets: WalletsParam): NormalizedWallets => {
  // Already normalized object
  if (typeof wallets === 'object' && !Array.isArray(wallets)) {
    return {
      evm: Array.isArray(wallets.evm) ? wallets.evm : wallets.evm ? [wallets.evm] : [],
      solana: Array.isArray(wallets.solana) ? wallets.solana : wallets.solana ? [wallets.solana] : [],
    };
  }

  // Single string or array - auto-detect chain by address format
  const walletsArray = Array.isArray(wallets) ? wallets : [wallets];

  return {
    evm: walletsArray.filter(isEvmWallet),
    solana: walletsArray.filter(isSolanaWallet),
  };
};
