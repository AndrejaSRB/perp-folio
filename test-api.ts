/**
 * Simple API test script to verify provider fetchers work
 * Run with: npx tsx test-api.ts
 */

import {
  hyperliquidProvider,
  lighterProvider,
  pacificaProvider,
  isEvmWallet,
  isSolanaWallet,
} from './src/index';

// Test addresses (you can replace these with real addresses that have positions)
const TEST_EVM_ADDRESS = '0x0000000000000000000000000000000000000000';
const TEST_SOLANA_ADDRESS = '11111111111111111111111111111111';

async function testHyperliquid(address: string) {
  console.log('\n=== Testing HyperLiquid ===');
  console.log(`Address: ${address}`);

  try {
    const positions = await hyperliquidProvider.fetchPositions(address);
    console.log(`Found ${positions.length} positions`);

    if (positions.length > 0) {
      const normalized = positions.map(p =>
        hyperliquidProvider.normalizePosition(p, address)
      );
      console.log('First position (normalized):', JSON.stringify(normalized[0], null, 2));
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

async function testLighter(address: string) {
  console.log('\n=== Testing Lighter ===');
  console.log(`Address: ${address}`);

  try {
    const positions = await lighterProvider.fetchPositions(address);
    console.log(`Found ${positions.length} positions`);

    if (positions.length > 0) {
      const normalized = positions.map(p =>
        lighterProvider.normalizePosition(p, address)
      );
      console.log('First position (normalized):', JSON.stringify(normalized[0], null, 2));
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

async function testPacifica(address: string) {
  console.log('\n=== Testing Pacifica ===');
  console.log(`Address: ${address}`);

  try {
    const positions = await pacificaProvider.fetchPositions(address);
    console.log(`Found ${positions.length} positions`);

    if (positions.length > 0) {
      const normalized = positions.map(p =>
        pacificaProvider.normalizePosition(p, address)
      );
      console.log('First position (normalized):', JSON.stringify(normalized[0], null, 2));
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

async function testChainDetection() {
  console.log('\n=== Testing Chain Detection ===');

  const addresses = [
    '0x1234567890abcdef1234567890abcdef12345678',
    'DYw8jCTfwHNRJhhmFcbXvVDTqWMEVFBX6ZKUmG5CNSKK',
    '0xABCD',
    'ABC123xyz',
  ];

  for (const addr of addresses) {
    console.log(`${addr}: EVM=${isEvmWallet(addr)}, Solana=${isSolanaWallet(addr)}`);
  }
}

async function main() {
  console.log('🚀 @hypersignals/perp-folio API Test\n');

  // Test chain detection
  await testChainDetection();

  // Get address from command line or use test addresses
  const evmAddress = process.argv[2] || TEST_EVM_ADDRESS;
  const solanaAddress = process.argv[3] || TEST_SOLANA_ADDRESS;

  // Test EVM providers
  await testHyperliquid(evmAddress);
  await testLighter(evmAddress);

  // Test Solana provider
  await testPacifica(solanaAddress);

  console.log('\n✅ Tests completed');
}

main().catch(console.error);
