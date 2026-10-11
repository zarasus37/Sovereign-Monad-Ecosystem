/**
 * Yield Router (Router B) — 50/40/10 reciprocal split (Vector 5.3 / Axiom 7).
 *
 * Live chain only when YIELD_ROUTER_LIVE=true + treasury addresses set.
 * Otherwise honest dry-run synthesis (no private key required).
 */

import { createHash } from 'node:crypto';
import type { YieldDistribution } from '@sovereign/types';
import {
  computeYieldSplitsBaseUnits,
  LOOP_STABLE_DECIMALS,
  loopBaseUnitsToUsd,
  loopUsdToBaseUnits,
} from '@sovereign/types';

export type YieldTransferFn = (
  to: string,
  amountBaseUnits: bigint,
) => Promise<{ hash: string }>;

export type RouteYieldOpts = {
  tradeId?: string;
  tokenAddress?: string;
  decimals?: number;
  /** Force live path (still needs secrets / transferFn). */
  live?: boolean;
  principalTreasury?: string;
  shaliahTreasury?: string;
  ecosystemVault?: string;
  /** Injected transfers for tests / live contract wrapper. */
  transferFn?: YieldTransferFn;
  auditTrace?: string[];
};

function isLive(opts?: RouteYieldOpts): boolean {
  if (opts?.live === true) return true;
  if (opts?.live === false) return false;
  return process.env.YIELD_ROUTER_LIVE === 'true';
}

function resolveTreasuries(opts?: RouteYieldOpts): {
  principal: string;
  shaliah: string;
  vault: string;
} {
  return {
    principal:
      opts?.principalTreasury ||
      process.env.PRINCIPAL_TREASURY ||
      '',
    shaliah:
      opts?.shaliahTreasury || process.env.SHALIAH_TREASURY || '',
    vault: opts?.ecosystemVault || process.env.ECOSYSTEM_VAULT || '',
  };
}

/**
 * Split gross yield 50/40/10 and transfer (or synthesize) to ecosystem sinks.
 */
export async function routeYield(
  grossYieldUsd: number,
  opts: RouteYieldOpts = {},
): Promise<YieldDistribution> {
  if (!Number.isFinite(grossYieldUsd) || grossYieldUsd <= 0) {
    throw new Error('YIELD_NON_POSITIVE');
  }

  const decimals = opts.decimals ?? LOOP_STABLE_DECIMALS;
  const grossBase = BigInt(loopUsdToBaseUnits(grossYieldUsd, decimals));
  const splitsBase = computeYieldSplitsBaseUnits(grossBase);
  const tradeId = opts.tradeId ?? `yield-${Date.now()}`;
  const auditTrace = [...(opts.auditTrace ?? [])];

  const splits = {
    principal: loopBaseUnitsToUsd(Number(splitsBase.principal), decimals),
    shaliahTreasury: loopBaseUnitsToUsd(
      Number(splitsBase.shaliahTreasury),
      decimals,
    ),
    ecosystemVault: loopBaseUnitsToUsd(
      Number(splitsBase.ecosystemVault),
      decimals,
    ),
  };

  const treasuries = resolveTreasuries(opts);
  const live = isLive(opts) && Boolean(opts.transferFn);

  if (!live) {
    // Honest dry-run — physical routing not available
    const synth = (label: string) =>
      '0x' +
      createHash('sha256')
        .update(`${tradeId}:${label}:${grossYieldUsd}`)
        .digest('hex');
    auditTrace.push(
      'yield:mode:dry-run',
      'note:set_YIELD_ROUTER_LIVE=true_and_treasuries_for_chain',
    );
    console.log(
      `[Yield Router] Dry-run 50/40/10 for $${grossYieldUsd}: P=${splits.principal} S=${splits.shaliahTreasury} V=${splits.ecosystemVault}`,
    );
    return {
      tradeId,
      grossYield: grossYieldUsd,
      splits,
      txHashes: [synth('principal'), synth('shaliah'), synth('vault')],
      synthesized: true,
      auditTrace,
      timestamp: new Date().toISOString(),
    };
  }

  if (
    !treasuries.principal ||
    !treasuries.shaliah ||
    !treasuries.vault
  ) {
    throw new Error(
      'YIELD_TREASURIES_UNSET: PRINCIPAL_TREASURY, SHALIAH_TREASURY, ECOSYSTEM_VAULT required',
    );
  }

  const transfer = opts.transferFn!;
  const txHashes: string[] = [];

  const tx1 = await transfer(treasuries.principal, splitsBase.principal);
  txHashes.push(tx1.hash);
  auditTrace.push(`yield:tx:principal:${tx1.hash}`);

  const tx2 = await transfer(treasuries.shaliah, splitsBase.shaliahTreasury);
  txHashes.push(tx2.hash);
  auditTrace.push(`yield:tx:shaliah:${tx2.hash}`);

  const tx3 = await transfer(treasuries.vault, splitsBase.ecosystemVault);
  txHashes.push(tx3.hash);
  auditTrace.push(`yield:tx:vault:${tx3.hash}`);

  console.log(
    `[Yield Router] Routed $${grossYieldUsd} → 50/40/10 (${txHashes.length} txs)`,
  );

  return {
    tradeId,
    grossYield: grossYieldUsd,
    splits,
    txHashes,
    synthesized: false,
    auditTrace,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Build live ERC-20 transferFn from engine wallet + token.
 */
export async function createErc20TransferFn(
  privateKey: string,
  tokenAddress: string,
  rpcUrl?: string,
): Promise<YieldTransferFn> {
  const { ethers } = await import('ethers');
  const provider = new ethers.JsonRpcProvider(
    rpcUrl || process.env.MONAD_RPC_URL || process.env.RPC_URL,
  );
  const wallet = new ethers.Wallet(privateKey, provider);
  return createErc20TransferFnFromWallet(wallet, tokenAddress);
}

/**
 * UMS-shaped entry: engine wallet + token + gross yield USD.
 * Live when YIELD_ROUTER_LIVE=true; otherwise dry-run.
 */
export async function routeYieldFromWallet(
  engineWallet: {
    privateKey?: string;
    address: string;
    provider?: unknown;
  },
  tokenAddress: string,
  grossYieldUsd: number,
  opts: Omit<RouteYieldOpts, 'tokenAddress' | 'transferFn'> = {},
): Promise<YieldDistribution> {
  const live =
    opts.live === true ||
    (opts.live !== false && process.env.YIELD_ROUTER_LIVE === 'true');

  if (!live) {
    return routeYield(grossYieldUsd, {
      ...opts,
      tokenAddress,
      live: false,
    });
  }

  const { ethers } = await import('ethers');
  // Prefer connected wallet; else rebuild from privateKey if present
  const wallet =
    engineWallet.provider && 'sendTransaction' in (engineWallet as object)
      ? (engineWallet as InstanceType<typeof ethers.Wallet>)
      : engineWallet.privateKey
        ? new ethers.Wallet(
            engineWallet.privateKey,
            new ethers.JsonRpcProvider(
              process.env.MONAD_RPC_URL || process.env.RPC_URL,
            ),
          )
        : null;

  if (!wallet) {
    throw new Error(
      'routeYieldFromWallet: live mode requires a connected ethers.Wallet',
    );
  }

  const transferFn = createErc20TransferFnFromWallet(wallet, tokenAddress);
  return routeYield(grossYieldUsd, {
    ...opts,
    tokenAddress,
    live: true,
    transferFn,
  });
}

function createErc20TransferFnFromWallet(
  // ethers.Wallet / Signer — typed loosely to avoid hard coupling at compile
  wallet: unknown,
  tokenAddress: string,
): YieldTransferFn {
  return async (to: string, amountBaseUnits: bigint) => {
    const { ethers } = await import('ethers');
    const erc20Abi = [
      'function transfer(address to, uint256 amount) returns (bool)',
    ];
    const token = new ethers.Contract(
      tokenAddress,
      erc20Abi,
      wallet as import('ethers').ContractRunner,
    );
    const tx = await token.transfer(to, amountBaseUnits);
    await tx.wait(1);
    return { hash: tx.hash as string };
  };
}
