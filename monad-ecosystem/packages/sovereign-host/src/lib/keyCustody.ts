/**
 * Key Custody Module — Azure Key Vault Integration
 * 
 * Fetches the bootstrap private key from Azure Key Vault at startup,
 * rather than storing it in environment variables on the server filesystem.
 * 
 * This is the "Holy of Holies" — if the key leaks, the Archons win.
 * 
 * Usage:
 *   import { getBootstrapWallet } from './keyCustody.js';
 *   const wallet = await getBootstrapWallet();
 * 
 * Environment:
 *   KEY_VAULT_NAME (required): Name of the Azure Key Vault
 *   AZURE_TENANT_ID (required for service principal auth)
 *   AZURE_CLIENT_ID (required for service principal auth)
 *   AZURE_CLIENT_SECRET (required for service principal auth)
 * 
 * Alternative: Use Managed Identity (no secrets needed):
 *   - Assign a Managed Identity to the Azure VM / Container App
 *   - Grant the Managed Identity "Key Vault Secret User" role
 *   - No AZURE_TENANT_ID, AZURE_CLIENT_ID, or AZURE_CLIENT_SECRET needed
 */

import { ethers, Wallet } from 'ethers';

/** Secret name in Key Vault */
const SECRET_NAME = 'BOOTSTRAP-DEPLOYER-KEY';

/** Cache for the wallet instance */
let cachedWallet: Wallet | null = null;

/**
 * Check if Key Vault integration is configured.
 * KEY_VAULT_NAME is the only requirement — DefaultAzureCredential auto-detects
 * system MI (Container Apps), user-assigned MI, service principal, and env creds.
 */
export function isKeyCustodyConfigured(): boolean {
  return !!process.env.KEY_VAULT_NAME;
}

/**
 * Check for explicit managed identity env vars (not required — DefaultAzureCredential
 * handles system MI auto-detection in Container Apps without any env vars).
 */
function hasExplicitManagedIdentity(): boolean {
  return !!(
    process.env.MSI_ENDPOINT ||
    process.env.IDENTITY_ENDPOINT ||
    process.env.AZURE_CLIENT_ID
  );
}

/**
 * Check for service principal credentials.
 */
function hasServicePrincipal(): boolean {
  return !!(
    process.env.AZURE_TENANT_ID &&
    process.env.AZURE_CLIENT_ID &&
    process.env.AZURE_CLIENT_SECRET
  );
}

/**
 * Fetch the bootstrap private key from Azure Key Vault.
 * 
 * Supports both Managed Identity and service principal authentication.
 */
async function fetchKeyFromVault(): Promise<string> {
  const vaultName = process.env.KEY_VAULT_NAME;
  if (!vaultName) {
    throw new Error('KEY_VAULT_NAME environment variable is not set');
  }

  const vaultUrl = `https://${vaultName}.vault.azure.net`;

  // Use Managed Identity or service principal
  const credential = await getAzureCredential();
  const { SecretClient } = await import('@azure/keyvault-secrets');
  
  const client = new SecretClient(vaultUrl, credential);
  const secret = await client.getSecret(SECRET_NAME);
  
  if (!secret.value) {
    throw new Error(`Secret '${SECRET_NAME}' not found in Key Vault`);
  }
  
  return secret.value;
}

/**
 * Get the appropriate Azure credential based on environment.
 * Uses DefaultAzureCredential which auto-detects:
 *   - System-assigned MI (Container Apps, no env vars needed)
 *   - User-assigned MI (AZURE_CLIENT_ID)
 *   - Service principal (AZURE_TENANT_ID + AZURE_CLIENT_ID + AZURE_CLIENT_SECRET)
 *   - Environment variables (AZURE_TENANT_ID + AZURE_CLIENT_ID + AZURE_CLIENT_SECRET)
 */
async function getAzureCredential(): Promise<any> {
  const { DefaultAzureCredential } = await import('@azure/identity');
  return new DefaultAzureCredential();
}

/**
 * Get the bootstrap wallet.
 * 
 * Uses cached instance if available, otherwise fetches from Key Vault.
 * 
 * @param provider - Optional Ethereum provider (defaults to MONAD_RPC_URL)
 */
export async function getBootstrapWallet(provider?: ethers.Provider): Promise<Wallet> {
  if (cachedWallet) {
    return cachedWallet;
  }

  // Check for local development (env var fallback)
  let privateKey = process.env.BOOTSTRAP_PRIVATE_KEY;
  
  if (!privateKey && isKeyCustodyConfigured()) {
    // Fetch from Key Vault
    console.log('[Key Custody] Fetching bootstrap key from Azure Key Vault...');
    privateKey = await fetchKeyFromVault();
    console.log('[Key Custody] Bootstrap key loaded successfully');
  }
  
  if (!privateKey) {
    throw new Error(
      'Bootstrap private key not configured. ' +
      'Set BOOTSTRAP_PRIVATE_KEY (dev) or configure Key Vault (prod).'
    );
  }

  // Create wallet
  const ethProvider = provider || getDefaultProvider();
  cachedWallet = new Wallet(privateKey, ethProvider);
  
  console.log('[Key Custody] Bootstrap wallet address:', cachedWallet.address);
  
  return cachedWallet;
}

/**
 * Get the default Ethereum provider.
 */
function getDefaultProvider(): ethers.Provider {
  const rpcUrl = process.env.MONAD_RPC_URL || 'https://rpc.testnet.monad.xyz';
  return new ethers.JsonRpcProvider(rpcUrl);
}

/**
 * Invalidate the cached wallet (for testing or key rotation).
 */
export function invalidateCache(): void {
  cachedWallet = null;
  console.log('[Key Custody] Wallet cache invalidated');
}

/**
 * Health check for Key Vault connectivity.
 * Reports auth type based on which env vars are present (DefaultAzureCredential
 * handles all cases at runtime; this is just for diagnostics).
 */
export async function checkKeyVaultHealth(): Promise<{
  configured: boolean;
  keyVaultName: string | null;
  authType: 'managed-identity' | 'service-principal' | 'default-azure-credential' | 'none';
}> {
  const configured = isKeyCustodyConfigured();
  const keyVaultName = process.env.KEY_VAULT_NAME || null;

  let authType: 'managed-identity' | 'service-principal' | 'default-azure-credential' | 'none' = 'none';
  if (process.env.MSI_ENDPOINT || process.env.IDENTITY_ENDPOINT || process.env.AZURE_CLIENT_ID) {
    authType = 'managed-identity';
  } else if (process.env.AZURE_TENANT_ID && process.env.AZURE_CLIENT_SECRET) {
    authType = 'service-principal';
  } else if (configured) {
    authType = 'default-azure-credential';
  }

  return { configured, keyVaultName, authType };
}