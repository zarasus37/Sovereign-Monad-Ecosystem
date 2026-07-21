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
const SECRET_NAME = 'BootstrapPrivateKey';

/** Cache for the wallet instance */
let cachedWallet: Wallet | null = null;

/**
 * Check if Key Vault integration is configured.
 */
export function isKeyCustodyConfigured(): boolean {
  return !!(
    process.env.KEY_VAULT_NAME &&
    (hasManagedIdentity() || hasServicePrincipal())
  );
}

/**
 * Check for Azure Managed Identity (VM / Container Apps).
 * Container Apps doesn't set MSI_ENDPOINT/IDENTITY_ENDPOINT but DOES set
 * AZURE_CLIENT_ID when a system/user-managed identity is assigned.
 * DefaultAzureCredential + ManagedIdentityCredential handle this automatically.
 */
function hasManagedIdentity(): boolean {
  return !!(
    process.env.MSI_ENDPOINT ||
    process.env.IDENTITY_ENDPOINT ||
    process.env.AZURE_CLIENT_ID // Container Apps sets this for managed identity
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
 */
async function getAzureCredential(): Promise<any> {
  if (hasManagedIdentity()) {
    // Use Managed Identity (no additional config needed)
    const { DefaultAzureCredential } = await import('@azure/identity');
    return new DefaultAzureCredential();
  } else if (hasServicePrincipal()) {
    // Use service principal
    const { ClientSecretCredential } = await import('@azure/identity');
    return new ClientSecretCredential(
      process.env.AZURE_TENANT_ID!,
      process.env.AZURE_CLIENT_ID!,
      process.env.AZURE_CLIENT_SECRET!
    );
  } else {
    throw new Error(
      'Neither Managed Identity nor service principal credentials found. ' +
      'Set MSI_ENDPOINT (Managed Identity) or AZURE_TENANT_ID, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET (service principal).'
    );
  }
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
 */
export async function checkKeyVaultHealth(): Promise<{
  configured: boolean;
  keyVaultName: string | null;
  authType: 'managed-identity' | 'service-principal' | 'none';
}> {
  const configured = isKeyCustodyConfigured();
  const keyVaultName = process.env.KEY_VAULT_NAME || null;
  
  let authType: 'managed-identity' | 'service-principal' | 'none' = 'none';
  if (hasManagedIdentity()) {
    authType = 'managed-identity';
  } else if (hasServicePrincipal()) {
    authType = 'service-principal';
  }
  
  return {
    configured,
    keyVaultName,
    authType,
  };
}