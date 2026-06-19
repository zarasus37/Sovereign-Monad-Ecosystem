/**
 * RevenueEvent — canonical revenue routing event for the Sovereign Revenue Router.
 *
 * Every inflow and distribution through the Revenue Router is captured as a
 * RevenueEvent. The Signal Layer aggregates these for treasury accounting,
 * Data Rail licensing, and Dove monitoring of distribution ratios.
 *
 * Reference: MOF Section 4.1, 4.5 Capital Loop; Phase 1a router deployment
 * Deployed router: Monad mainnet (Phase 1a complete 2026-04-18)
 */

/** Categories of revenue that flow through the router. */
export type RevenueSource =
  | 'mev.profit'           // MEV arb engine profit return
  | 'hepar.fee'            // Hepar audit service fee
  | 'oracle.license'       // Oracle API licensing revenue
  | 'data-rail.license'    // Data Rail behavioral data license fee
  | 'lightverify.cert'     // LightVerify certification fee
  | 'monad-spin.revenue'   // MonadSpin GameFi revenue
  | 'bootstrap.manual'     // Manual bootstrap inflow
  | 'delegate.inflow'      // Shaliah delegate participation inflow
  | 'platform.fee'         // Builder platform fee
  | 'external.grant'       // External grant or partnership
  | 'treasury.release';    // Treasury reserve release

/** Canonical distribution destinations. */
export type RevenueDestination =
  | 'treasury'             // Sovereign Treasury reserve
  | 'mev.ops'              // MEV engine operational budget
  | 'data.pool'            // Data Rail contributor pool
  | 'delegate.pool'        // Shaliah delegate reward pool
  | 'founder.sink'         // Founder operational draw (Dove-monitored)
  | 'ops.general'          // General operational expenses
  | 'ecosystem.dev'        // Ecosystem development funding
  | 'behavioral.data.rev'; // Behavioral data revenue route (Router B)

/** Token or asset type for the revenue event. */
export type RevenueToken = 'MON' | 'ETH' | 'USDC' | 'USDT' | 'native' | string;

/**
 * A single revenue routing event.
 * Emitted by the on-chain Revenue Router and mirrored on the signal bus.
 */
export interface RevenueEvent {
  /** Unique event identifier. */
  readonly eventId: string;

  /** ISO-8601 timestamp of the routing event. */
  readonly timestamp: string;

  /** Source of the revenue. */
  readonly source: RevenueSource;

  /** Destination(s) of the routed revenue. */
  readonly destinations: readonly RevenueDistribution[];

  /** Total gross amount before distribution. */
  readonly grossAmountRaw: string;

  /** Token in which the revenue is denominated. */
  readonly token: RevenueToken;

  /** USD equivalent at time of routing (best-effort). */
  readonly usdEquivalent?: number;

  /** On-chain transaction hash (if from a mined transaction). */
  readonly txHash?: string;

  /** Block number on the target chain (if applicable). */
  readonly blockNumber?: number;

  /** Chain on which this event was recorded. */
  readonly chain: string;

  /** Router contract address. */
  readonly routerAddress?: string;

  /** Whether this event has been confirmed by Dove observation. */
  readonly doveConfirmed: boolean;
}

/** A single distribution leg within one revenue routing event. */
export interface RevenueDistribution {
  /** Destination of this leg. */
  readonly destination: RevenueDestination;

  /** Amount routed to this destination (raw, in token units). */
  readonly amountRaw: string;

  /** Percentage of gross this represents (0.0–1.0). */
  readonly fraction: number;

  /** Wallet or contract address receiving this distribution. */
  readonly recipientAddress?: string;
}

/** Treasury balance snapshot — produced periodically by treasury monitoring. */
export interface TreasurySnapshot {
  /** ISO-8601 timestamp of snapshot. */
  readonly snapshotAt: string;

  /** Current treasury balance by token. */
  readonly balances: Record<RevenueToken, string>;

  /** Total USD equivalent across all tokens (best-effort). */
  readonly totalUsdEquivalent?: number;

  /** RevenueSinkTreasury contract address. */
  readonly sinkAddress: string;

  /**
   * Treasury floor status.
   * Below floor = Dove observes for concentration risk.
   */
  readonly aboveFloor: boolean;

  /** Configured floor amount in USD. */
  readonly floorUsd: number;
}
