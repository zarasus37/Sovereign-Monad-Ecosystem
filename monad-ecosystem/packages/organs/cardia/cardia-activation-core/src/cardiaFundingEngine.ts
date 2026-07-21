/**
 * Cardia Funding Engine — Bootstrap Source signer for Tier-1 Meshaleach capital.
 *
 * Hard-gated by Hepar address audit (Axiom 6). Live chain only when:
 *   CARDIA_FUNDING_LIVE=true
 *   + MONAD_RPC_URL
 *   + BOOTSTRAP_PRIVATE_KEY
 *   + STABLECOIN_CONTRACT
 * Otherwise TX_SYNTHESIZED (honest dry-run).
 */

import { createHash } from 'node:crypto';
import { isHeparPass, type HeparAuditResponse } from '@sovereign/types';
import type {
  HeparAuditFn,
  HeparFundingAuditFn,
} from './heparAuditClient.js';
import { heparAuditClient } from './heparAuditClient.js';
import {
  CARDIA_FUNDING_TOPIC,
  TIER_1_FUNDING_USD,
  type CardiaFundingKafkaEvent,
  type FundingMandate,
} from './cardiaFunding.types.js';
import {
  nonceManager,
  type RedisNonceManager,
} from './redisNonceManager.js';

export type FundingBroadcastFn = (
  event: CardiaFundingKafkaEvent,
) => Promise<void> | void;

export type FundingEngineDeps = {
  /**
   * Preferred: full forensic audit (Vector 4.4).
   * Inject in tests for deterministic verdicts.
   */
  auditFunding?: HeparFundingAuditFn;
  /**
   * @deprecated Use auditFunding. Legacy (wallet → {passed}) still honored.
   */
  auditAddress?: HeparAuditFn;
  broadcast?: FundingBroadcastFn;
  /** Force live path (still needs env secrets). */
  live?: boolean;
  /** USD notional override (default 15000). */
  amountUsd?: number;
  /**
   * Injected transfer for tests. Receives allocated nonce.
   */
  transferFn?: (
    to: string,
    amount: bigint,
    nonce: number,
  ) => Promise<{
    hash: string;
    wait: (confirms?: number) => Promise<{ status?: number; blockNumber?: number }>;
  }>;
  /** Override nonce manager (tests). */
  nonceManager?: RedisNonceManager;
  /** @deprecated prefer nonceManager — still honored as one-shot getNextNonce */
  getNonce?: () => Promise<number>;
};

export function resetFundingNonceForTests(): void {
  nonceManager.resetForTests();
}

function isLiveEnabled(deps?: FundingEngineDeps): boolean {
  if (deps?.live === true) return true;
  if (deps?.live === false) return false;
  return process.env.CARDIA_FUNDING_LIVE === 'true';
}

function hasLiveSecrets(): boolean {
  return Boolean(
    process.env.MONAD_RPC_URL &&
      process.env.BOOTSTRAP_PRIVATE_KEY &&
      process.env.STABLECOIN_CONTRACT,
  );
}

async function defaultBroadcast(event: CardiaFundingKafkaEvent): Promise<void> {
  if (process.env.KAFKA_ENABLED === 'true') {
    try {
      const { Kafka } = await import('kafkajs');
      const brokers = (process.env.KAFKA_BROKERS || 'localhost:9092')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      const kafka = new Kafka({ clientId: 'cardia-funding', brokers });
      const producer = kafka.producer();
      await producer.connect();
      await producer.send({
        topic: CARDIA_FUNDING_TOPIC,
        messages: [
          { key: event.principalWallet, value: JSON.stringify(event) },
        ],
      });
      await producer.disconnect();
      return;
    } catch (err) {
      console.error('[Cardia Engine] Kafka funding broadcast failed:', err);
    }
  }
  console.log('[Local Dev] Cardia Funding Event:', event);
}

async function broadcastStatus(
  mandate: FundingMandate,
  broadcast: FundingBroadcastFn,
): Promise<void> {
  const event: CardiaFundingKafkaEvent = {
    mandateId: mandate.mandateId,
    principalWallet: mandate.principalWallet,
    status: mandate.status,
    amount: mandate.amount,
    tier: mandate.tier,
    txHash: mandate.txHash,
    blockNumber: mandate.blockNumber,
    auditTrace: [...mandate.auditTrace],
    timestamp: new Date().toISOString(),
    synthesized: mandate.synthesized,
  };
  await broadcast(event);
}

/**
 * Build a Tier-1 mandate from a wallet-bind PL event.
 */
export function mandateFromWalletBind(opts: {
  principalWallet: string;
  amountUsd?: number;
  priorTrace?: string[];
}): FundingMandate {
  const ts = new Date().toISOString();
  const h = createHash('sha1')
    .update(`mandate:${opts.principalWallet}:${ts}`)
    .digest('hex')
    .slice(0, 12);
  return {
    mandateId: `mandate-${h}`,
    principalWallet: opts.principalWallet,
    amount: opts.amountUsd ?? TIER_1_FUNDING_USD,
    tier: 'TIER_1_MESHALEACH',
    status: 'PENDING_HEPAR_AUDIT',
    auditTrace: [
      'kafka:consume:sovereign.pl.ledger.events',
      'cardia:evaluate:wallet_bind_tier1',
      ...(opts.priorTrace ?? []),
    ],
    timestamp: ts,
  };
}

/**
 * Execute funding under Hepar gate + Cosmo constraints.
 * Mutates and returns the mandate with terminal status.
 */
async function resolveHeparAudit(
  mandate: FundingMandate,
  deps: FundingEngineDeps,
): Promise<HeparAuditResponse> {
  const request = {
    targetAddress: mandate.principalWallet,
    context: 'TIER_1_FUNDING' as const,
    auditTrace: mandate.auditTrace,
  };

  if (deps.auditFunding) {
    return deps.auditFunding(request);
  }

  if (deps.auditAddress) {
    // Legacy injector: map {passed} → verdict envelope
    const legacy = await deps.auditAddress(mandate.principalWallet);
    if (legacy.verdict) {
      return {
        verdict: legacy.verdict,
        riskScore: legacy.riskScore ?? (legacy.passed ? 0.1 : 0.9),
        flags: legacy.flags ?? [],
        auditId: legacy.auditId,
        reason: legacy.reason,
      };
    }
    return {
      verdict: legacy.passed ? 'PASS' : 'FAIL_HIGH_RISK',
      riskScore: legacy.riskScore ?? (legacy.passed ? 0.1 : 0.9),
      flags: legacy.flags ?? [legacy.reason],
      auditId: legacy.auditId,
      reason: legacy.reason,
    };
  }

  return heparAuditClient.auditAddressForFunding(request);
}

export async function executeFunding(
  mandate: FundingMandate,
  deps: FundingEngineDeps = {},
): Promise<FundingMandate> {
  const broadcast = deps.broadcast ?? defaultBroadcast;
  const amountUsd = deps.amountUsd ?? mandate.amount ?? TIER_1_FUNDING_USD;
  mandate.amount = amountUsd;

  console.log(
    `[Cardia Engine] Evaluating mandate ${mandate.mandateId} for ${mandate.principalWallet}`,
  );

  // 1. HEPAR GATE (Vector 4.4 — real forensic client, fail-closed)
  mandate.status = 'PENDING_HEPAR_AUDIT';
  const heparResponse = await resolveHeparAudit(mandate, deps);

  mandate.auditTrace.push(
    `hepar:audit:${heparResponse.verdict}:score:${heparResponse.riskScore}:id:${heparResponse.auditId}`,
  );
  if (heparResponse.flags.length > 0) {
    mandate.auditTrace.push(`hepar:flags:${heparResponse.flags.join(',')}`);
  }
  // Keep legacy token for existing tests / consumers
  mandate.auditTrace.push(
    `hepar:audit:${isHeparPass(heparResponse.verdict) ? 'pass' : 'fail'}:${heparResponse.auditId}:${heparResponse.reason ?? heparResponse.verdict}`,
  );

  if (!isHeparPass(heparResponse.verdict)) {
    console.warn(
      `[Cardia Engine] Hepar audit FAILED for ${mandate.principalWallet}. Verdict: ${heparResponse.verdict}. Holding funds in escrow.`,
    );
    mandate.status = 'AUDIT_FAILED';
    if (heparResponse.verdict === 'ERROR_SERVICE_UNAVAILABLE') {
      mandate.auditTrace.push('hepar:fail_closed:service_unavailable');
    }
    await broadcastStatus(mandate, broadcast);
    return mandate;
  }

  mandate.status = 'AUDIT_PASSED';
  mandate.auditTrace.push(
    'hepar:gate:passed',
    `hepar:auditId:${heparResponse.auditId}`,
  );

  const live = isLiveEnabled(deps) && (deps.transferFn || hasLiveSecrets());

  if (!live) {
    // Honest dry-run — no private key required
    const synthHash =
      '0x' +
      createHash('sha256')
        .update(`${mandate.mandateId}:${mandate.principalWallet}:synth`)
        .digest('hex');
    mandate.txHash = synthHash;
    mandate.status = 'TX_SYNTHESIZED';
    mandate.synthesized = true;
    mandate.auditTrace.push(
      'mode:dry-run',
      `tx:synthesized:${synthHash.slice(0, 18)}…`,
      'note:set_CARDIA_FUNDING_LIVE=true_and_secrets_for_chain',
    );
    console.log(
      `[Cardia Engine] Dry-run funding synthesized for ${mandate.principalWallet} ($${amountUsd}).`,
    );
    await broadcastStatus(mandate, broadcast);
    return mandate;
  }

  const nm = deps.nonceManager ?? nonceManager;

  try {
    // 2. Allocate nonce (Redis INCR when wired; atomic across processes)
    const nonce = deps.getNonce
      ? await deps.getNonce()
      : await nm.getNextNonce();

    // 3. Prepare transfer (USDC 6 decimals)
    const amountInUnits = BigInt(amountUsd) * 10n ** 6n;

    let transferFn = deps.transferFn;
    if (!transferFn) {
      const { ethers } = await import('ethers');
      const provider = new ethers.JsonRpcProvider(process.env.MONAD_RPC_URL);
      const bootstrapWallet = new ethers.Wallet(
        process.env.BOOTSTRAP_PRIVATE_KEY!,
        provider,
      );
      // Ensure chain fetcher is attached for resync
      nm.setChainPendingFetcher(async () =>
        provider.getTransactionCount(bootstrapWallet.address, 'pending'),
      );
      const erc20Abi = [
        'function transfer(address to, uint256 amount) returns (bool)',
      ];
      const tokenContract = new ethers.Contract(
        process.env.STABLECOIN_CONTRACT!,
        erc20Abi,
        bootstrapWallet,
      );

      transferFn = async (to: string, amount: bigint, n: number) => {
        const tx = await tokenContract.transfer(to, amount, {
          nonce: n,
          gasLimit: 100_000n,
        });
        return {
          hash: tx.hash as string,
          wait: (confirms = 1) => tx.wait(confirms),
        };
      };
    }

    console.log(
      `[Cardia Engine] Signing transaction with nonce ${nonce} to fund ${mandate.principalWallet}…`,
    );
    const tx = await transferFn!(
      mandate.principalWallet,
      amountInUnits,
      nonce,
    );

    mandate.txHash = tx.hash;
    mandate.status = 'TX_BROADCAST';
    mandate.auditTrace.push(`tx:broadcast:${tx.hash}:nonce:${nonce}`);
    await broadcastStatus(mandate, broadcast);

    console.log(`[Cardia Engine] Awaiting confirmation for tx ${tx.hash}…`);
    const receipt = await tx.wait(1);

    if (receipt && receipt.status === 1) {
      mandate.status = 'TX_CONFIRMED';
      mandate.blockNumber = receipt.blockNumber;
      mandate.auditTrace.push(
        `tx:confirmed:block:${receipt.blockNumber ?? 'unknown'}:nonce:${nonce}`,
      );
      console.log(
        `[Cardia Engine] Funding successful for ${mandate.principalWallet}.`,
      );
    } else {
      mandate.status = 'TX_FAILED';
      mandate.auditTrace.push(
        `tx:reverted:block:${receipt?.blockNumber ?? 'unknown'}:nonce:${nonce}`,
      );
      console.error(
        `[Cardia Engine] Transaction reverted for ${mandate.principalWallet}.`,
      );
      await nm.handleTransactionFailure();
    }
    await broadcastStatus(mandate, broadcast);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[Cardia Engine] Execution error:`, error);
    mandate.status = 'TX_FAILED';
    mandate.auditTrace.push(`error:execution:${message}`);
    if (
      /nonce|replacement|underpriced/i.test(message)
    ) {
      await nm.handleTransactionFailure();
      mandate.auditTrace.push('nonce:resync:after_failure');
    }
    await broadcastStatus(mandate, broadcast);
  }

  return mandate;
}
