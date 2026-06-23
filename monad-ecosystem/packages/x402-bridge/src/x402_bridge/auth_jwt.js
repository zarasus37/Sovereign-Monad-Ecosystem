# get_x402_jwt.js
# QuickNode x402 JWT Authentication Helper
# 
# Usage:
#   Interactive (human-readable):
#     1. Set your private key:   export X402_EVM_PRIVATE_KEY=0x...
#     2. Run:                    node get_x402_jwt.js
#     3. Copy the printed JWT to your .env file
#
#   Machine (JSON output — used by auto-refresh):
#     node get_x402_jwt.js --json
#     # outputs: {"success": true, "token": "eyJ...", "accountId": "..."}
#
#   Auto-refresh loop (runs every 55 minutes):
#     node get_x402_jwt.js --auto-refresh
#
# Prerequisites:
#   - Node.js 18+  (check: node --version)
#   - npm install @quicknode/x402
#
# This script uses the x402 "credit-drawdown" model:
#   - Authenticates once with SIWX (wallet signature)
#   - Gets a JWT token valid for ~1 hour
#   - The JWT is used for all subsequent RPC requests
#   - When credits exhaust, the server auto-buys a new bundle
#
# For 1,000,000 free credits/month, you only need to re-run this script
# when the JWT expires (every ~1 hour), or set up a cron job.

require('dotenv').config(); // optional: loads .env file

const { createQuicknodeX402Client } = require('@quicknode/x402');

const ARGS = process.argv.slice(2);
const JSON_MODE = ARGS.includes('--json');
const AUTO_REFRESH = ARGS.includes('--auto-refresh');

async function main() {
  const privateKey = process.env.X402_EVM_PRIVATE_KEY;
  
  if (!privateKey) {
    if (JSON_MODE) {
      console.log(JSON.stringify({ success: false, error: 'X402_EVM_PRIVATE_KEY not set' }));
    } else {
      console.error('ERROR: X402_EVM_PRIVATE_KEY not set.');
      console.error('Set your wallet private key:');
      console.error('  export X402_EVM_PRIVATE_KEY=0x...');
      console.error('');
      console.error('Note: This wallet needs USDC on the payment network');
      console.error('(default: Base Sepolia for dev, Base Mainnet for prod).');
    }
    process.exit(1);
  }

  const paymentNetwork = process.env.X402_PAYMENT_NETWORK || 'eip155:84532'; // Base Sepolia
  const paymentModel = process.env.X402_PAYMENT_MODEL || 'credit-drawdown';
  const baseUrl = process.env.X402_BASE_URL || 'https://x402.quicknode.com';

  if (!JSON_MODE) {
    console.log('Creating x402 client...');
    console.log(`  Payment network: ${paymentNetwork}`);
    console.log(`  Payment model:   ${paymentModel}`);
    console.log(`  Base URL:        ${baseUrl}`);
  }

  try {
    const client = await createQuicknodeX402Client({
      baseUrl,
      network: paymentNetwork,
      evmPrivateKey: privateKey,
      paymentModel,
      preAuth: true, // Authenticate immediately and get JWT
    });

    const token = client.getToken();
    const accountId = client.getAccountId();

    if (!token) {
      if (JSON_MODE) {
        console.log(JSON.stringify({ success: false, error: 'Failed to get JWT token' }));
      } else {
        console.error('ERROR: Failed to get JWT token. Check wallet balance and network.');
      }
      process.exit(1);
    }

    if (JSON_MODE) {
      console.log(JSON.stringify({ success: true, token, accountId }));
    } else {
      console.log('\n✅ Authentication successful!');
      console.log(`   Account ID: ${accountId}`);
      console.log('\n--- JWT TOKEN ---');
      console.log(token);
      console.log('--- END JWT ---\n');
      console.log('Add this to your environment:');
      console.log(`  export X402_JWT_TOKEN=${token}`);
      console.log('');
      console.log('Or add to your .env file:');
      console.log(`  X402_JWT_TOKEN=${token}`);
      console.log('');
      console.log(`Token expires in ~1 hour. Re-run this script to refresh.`);
      console.log(`Credits: 1,000,000 free requests/month per wallet.`);
    }

    // Optional: Test a live request to verify the token works
    if (!JSON_MODE) {
      console.log('\nTesting live RPC request...');
      const testResp = await client.fetch('https://x402.quicknode.com/monad-mainnet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'eth_blockNumber',
          params: []
        }),
      });
      
      const testResult = await testResp.json();
      console.log(`  Block number response: ${JSON.stringify(testResult.result)}`);
      console.log('  ✅ Token is working!');
    }

    // Auto-refresh loop: keep refreshing every 55 minutes
    if (AUTO_REFRESH && !JSON_MODE) {
      console.log('\n⏰ Auto-refresh mode enabled. Refreshing every 55 minutes.');
      console.log('   Press Ctrl+C to stop.');
      while (true) {
        await new Promise(resolve => setTimeout(resolve, 3300000)); // 55 minutes
        console.log('\n🔄 Refreshing JWT...');
        try {
          const newClient = await createQuicknodeX402Client({
            baseUrl,
            network: paymentNetwork,
            evmPrivateKey: privateKey,
            paymentModel,
            preAuth: true,
          });
          const newToken = newClient.getToken();
          if (newToken) {
            console.log(`  New JWT: ${newToken.slice(0, 20)}...${newToken.slice(-10)}`);
            console.log('  ✅ Refreshed successfully.');
          }
        } catch (err) {
          console.error('  ❌ Refresh failed:', err.message);
        }
      }
    }

  } catch (err) {
    if (JSON_MODE) {
      console.log(JSON.stringify({ success: false, error: err.message }));
    } else {
      console.error('\n❌ Authentication failed:', err.message);
      console.error('');
      console.error('Common issues:');
      console.error('  - Wallet has no USDC on the payment network');
      console.error('  - Wrong payment network (check X402_PAYMENT_NETWORK)');
      console.error('  - @quicknode/x402 not installed (run: npm install @quicknode/x402)');
      console.error('');
      console.error('For dev/test: Use Base Sepolia (eip155:84532) + testnet USDC');
      console.error('  Get testnet USDC: https://faucet.coinbase.com/');
    }
    process.exit(1);
  }
}

main();
