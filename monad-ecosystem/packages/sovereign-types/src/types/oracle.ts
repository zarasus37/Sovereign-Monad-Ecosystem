/**
 * OracleRegime — output of the Risk Gnosis Engine (RGE v2).
 *
 * The Oracle classifies the current market regime and assigns a posture.
 * These classifications feed into the Sovereign MEV Engine's position-sizing
 * and opportunity approval gates, and into Cardia's allocation discipline.
 *
 * Reference: MOF Section — Layer 6, RGE v2 canonical formulas
 */

/**
 * Market regime classification.
 * Derived from volatility surface, spread behavior, and macro correlation.
 */
export type RegimeClass =
  | 'trending-bullish'
  | 'trending-bearish'
  | 'ranging-tight'
  | 'ranging-wide'
  | 'high-volatility'
  | 'low-volatility'
  | 'crisis'
  | 'recovery'
  | 'undefined';

/**
 * Operational posture assigned by the Oracle.
 * Posture governs which strategy classes are active and at what scale.
 */
export type OraclePosture =
  | 'full-deployment'    // All strategies active at normal sizing
  | 'reduced-deployment' // Active but with reduced position limits
  | 'defensive'          // Only lowest-risk strategies active
  | 'observation-only'   // No capital deployment; data collection only
  | 'halted';            // Complete halt; awaiting manual operator review

/** Price feed snapshot used as Oracle input. */
export interface PriceFeedSnapshot {
  /** Asset identifier (e.g. 'ETH/USDC', 'MONAD/USDC'). */
  readonly asset: string;

  /** Mid-price in USD. */
  readonly priceMid: number;

  /** Available liquidity depth at 10 bps from mid (in USD). */
  readonly liquidityDepth10bps: number;

  /** Chain this price was sourced from. */
  readonly chain: 'monad' | 'ethereum' | 'aggregated';

  /** ISO-8601 timestamp of the price observation. */
  readonly observedAt: string;

  /** Price source identifier (e.g. Pyth Network endpoint). */
  readonly source: string;
}

/** Spread analysis from the spread-scanner component. */
export interface SpreadAnalysis {
  /** Raw spread in basis points between chains. */
  readonly rawSpreadBps: number;

  /**
   * Effective spread after volatility and cost adjustments.
   * Formula (canonical): rawSpread − vol×√t − 0.5×(vol×√t)² − 0.0015
   */
  readonly effectiveSpreadBps: number;

  /** Whether effective spread meets the minimum threshold (20 bps). */
  readonly meetsMinThreshold: boolean;

  /** Annualized volatility estimate used in the adjustment. */
  readonly annualizedVol: number;

  /** Time-to-execute estimate in seconds. */
  readonly executionTimeSeconds: number;
}

/** Kelly position-sizing output. */
export interface KellySizing {
  /**
   * Fractional Kelly position size as fraction of portfolio.
   * Formula (canonical): (edge / variance) × 0.25
   * Hard cap: min(kellyFrac, 0.10) — maximum 10% of portfolio per trade.
   */
  readonly kellyFraction: number;

  /** Dollar size based on current portfolio value. Returns $0 if effectiveBps < 20. */
  readonly positionSizeUsd: number;

  /** Current portfolio value at time of sizing. */
  readonly portfolioValueUsd: number;
}

/** Monte Carlo simulation summary for one opportunity. */
export interface MonteCarloSummary {
  /** Number of simulations run (canonical: 1,000). */
  readonly simulationCount: number;

  /** Mean expected value across simulations (in USD). */
  readonly evMean: number;

  /** Sharpe-like ratio across simulation outcomes. */
  readonly sharpeLike: number;

  /** Maximum tail loss observed (as fraction of position size). */
  readonly tailLoss: number;

  /**
   * Whether this opportunity passes the Monte Carlo gate:
   * evMean ≥ $10 AND sharpeLike ≥ 0.3 AND tailLoss ≤ 30%
   */
  readonly passed: boolean;
}

/** Full Oracle regime classification output. */
export interface OracleRegime {
  /** Unique classification identifier. */
  readonly classificationId: string;

  /** ISO-8601 timestamp of classification. */
  readonly classifiedAt: string;

  /** Current market regime classification. */
  readonly regime: RegimeClass;

  /** Assigned operational posture. */
  readonly posture: OraclePosture;

  /**
   * Confidence interval for the regime classification (0.0–1.0).
   * Low confidence triggers Dove Tier 1 observation.
   */
  readonly confidence: number;

  /** Price feed snapshots that fed this classification. */
  readonly priceFeeds: readonly PriceFeedSnapshot[];

  /** Spread analysis, if computed in this cycle. */
  readonly spreadAnalysis?: SpreadAnalysis;

  /** Kelly sizing, if an opportunity is being evaluated. */
  readonly kellySizing?: KellySizing;

  /** Monte Carlo summary, if simulations were run. */
  readonly monteCarlo?: MonteCarloSummary;

  /**
   * Whether capital deployment is authorized under the current regime + posture.
   * Must be true AND agent.riskEnvelope.capitalAuthorized for any trade to execute.
   */
  readonly capitalDeploymentAuthorized: boolean;

  /** Human-readable rationale for the posture assignment. */
  readonly postureRationale: string;
}
