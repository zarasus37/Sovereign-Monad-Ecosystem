/**
 * Production Meshaleach issuer key custody.
 * Never uses Wallet.createRandom() for production seals.
 *
 * Resolution order:
 *  1. MESHALEACH_ISSUER_PRIVATE_KEY (env — local/dev)
 *  2. Azure Key Vault secret MESHALEACH-ISSUER-KEY when KEY_VAULT_NAME set
 *  3. BOOTSTRAP_PRIVATE_KEY only when NODE_ENV !== 'production' (shared bootstrap; warned)
 *  4. throw — no silent random wallets
 */

import { Wallet, type Signer } from 'ethers';

const VAULT_SECRET_NAME = 'MESHALEACH-ISSUER-KEY';

let cached: Wallet | null = null;

export function clearIssuerWalletCache(): void {
  cached = null;
}

export function isProductionRuntime(): boolean {
  return process.env.NODE_ENV === 'production';
}

async function fetchIssuerKeyFromVault(): Promise<string> {
  const vaultName = process.env.KEY_VAULT_NAME;
  if (!vaultName) {
    throw new Error('KEY_VAULT_NAME not set');
  }
  const { DefaultAzureCredential } = await import('@azure/identity');
  const { SecretClient } = await import('@azure/keyvault-secrets');
  const client = new SecretClient(
    `https://${vaultName}.vault.azure.net`,
    new DefaultAzureCredential(),
  );
  const secret = await client.getSecret(VAULT_SECRET_NAME);
  if (!secret.value) {
    throw new Error(`Secret ${VAULT_SECRET_NAME} empty in Key Vault`);
  }
  return secret.value;
}

/**
 * Resolve issuer Signer for MeshaleachPoC production mint.
 * @throws if no key configured (never invents a random wallet)
 */
export async function getMeshaleachIssuerSigner(): Promise<Signer> {
  if (cached) return cached;

  let privateKey =
    process.env.MESHALEACH_ISSUER_PRIVATE_KEY ||
    process.env.MESHALEACH_ISSUER_KEY ||
    '';

  if (!privateKey && process.env.KEY_VAULT_NAME) {
    console.log('[Meshaleach Issuer] Loading key from Azure Key Vault…');
    privateKey = await fetchIssuerKeyFromVault();
  }

  if (!privateKey && !isProductionRuntime() && process.env.BOOTSTRAP_PRIVATE_KEY) {
    console.warn(
      '[Meshaleach Issuer] Using BOOTSTRAP_PRIVATE_KEY as dev fallback — set MESHALEACH_ISSUER_PRIVATE_KEY for real seals',
    );
    privateKey = process.env.BOOTSTRAP_PRIVATE_KEY;
  }

  if (!privateKey) {
    throw new Error(
      'Meshaleach issuer key not configured. Set MESHALEACH_ISSUER_PRIVATE_KEY ' +
        '(dev) or KEY_VAULT_NAME + secret MESHALEACH-ISSUER-KEY (prod). ' +
        'Random wallets are not allowed for production seals.',
    );
  }

  if (!privateKey.startsWith('0x')) {
    privateKey = `0x${privateKey}`;
  }

  cached = new Wallet(privateKey);
  console.log('[Meshaleach Issuer] address:', cached.address);
  return cached;
}

/** True when an issuer key is available without throwing. */
export async function meshaleachIssuerAvailable(): Promise<boolean> {
  try {
    await getMeshaleachIssuerSigner();
    return true;
  } catch {
    return false;
  }
}

/**
 * Mint PoC with production issuer key (server-side).
 * Prefer this for host/API paths; browser continues to use user wallet Signer.
 */
export async function mintMeshaleachPoCWithIssuerCustody(
  unsigned: import('./meshaleachPoCMint.js').MeshaleachPoCUnsigned,
): Promise<import('./meshaleachPoCMint.js').MintPoCResult> {
  const { mintMeshaleachPoC } = await import('./meshaleachPoCMint.js');
  const signer = await getMeshaleachIssuerSigner();
  return mintMeshaleachPoC(unsigned, signer);
}
