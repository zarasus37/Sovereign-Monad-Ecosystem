/**
 * Hepar Shadow Market — didactic deck + UMS stealth assessment.
 *
 * UMS doctrine (Phase 2 resolution):
 * - HALT on SYSTEM_REFUSED = "Aha!" T-AXIS recognition (isCorrect=true)
 * - HALT on EXECUTED = noisy over-management (isCorrect=false)
 * - GENUINELY_BAD green = optional HCD-2 credit (agent miss), not primary pass path
 * - Pass threshold = 3 correct SYSTEM_REFUSED recognitions
 */

import type {
  Phase2Completion,
  QuarantineTelemetry,
  RefusalReason,
  ShadowTrade,
  TradeStatus,
} from "@/types/shadow-market";

export interface MockPool {
  name: string;
  baseRisk: number;
  baseYield: number;
  force?: "EXECUTED" | "SYSTEM_REFUSED" | "GENUINELY_BAD";
  refusalReason?: RefusalReason;
  defectReason?: string;
}

/** Fixed cycle — guaranteed SYSTEM_REFUSED rows for T-AXIS training. */
export const SHADOW_DECK: readonly MockPool[] = [
  { name: "WETH/USDC", baseRisk: 0.22, baseYield: 12, force: "EXECUTED" },
  {
    name: "SHADOW/MOCK",
    baseRisk: 0.95,
    baseYield: 400,
    force: "SYSTEM_REFUSED",
    refusalReason: "T-REFUSAL-BUDGET",
  },
  { name: "MONAD/ETH", baseRisk: 0.12, baseYield: 18, force: "EXECUTED" },
  {
    name: "USDC/DAI",
    baseRisk: 0.88,
    baseYield: 4,
    force: "SYSTEM_REFUSED",
    refusalReason: "C-DENSITY-FLOOR",
  },
  {
    name: "SHADOW/MOCK",
    baseRisk: 0.72,
    baseYield: 220,
    force: "GENUINELY_BAD",
    defectReason: "revenge size + no stop; agent missed tilt",
  },
  {
    name: "WETH/USDC",
    baseRisk: 0.91,
    baseYield: 9,
    force: "SYSTEM_REFUSED",
    refusalReason: "X-AUDITABILITY",
  },
  { name: "MONAD/ETH", baseRisk: 0.18, baseYield: 15, force: "EXECUTED" },
  {
    name: "USDC/DAI",
    baseRisk: 0.92,
    baseYield: 3,
    force: "SYSTEM_REFUSED",
    refusalReason: "T-SOVEREIGNTY-DEBT",
  },
];

export function mintTradeFromDeck(
  index: number,
  now = Date.now(),
): ShadowTrade {
  const pool = SHADOW_DECK[index % SHADOW_DECK.length]!;
  let status: TradeStatus = "EXECUTED";
  let refusalReason: RefusalReason | undefined = "NONE";
  let defectReason: string | undefined;

  if (pool.force === "SYSTEM_REFUSED") {
    status = "SYSTEM_REFUSED";
    refusalReason = pool.refusalReason ?? "T-REFUSAL-BUDGET";
  } else if (pool.force === "GENUINELY_BAD") {
    status = "GENUINELY_BAD";
    defectReason = pool.defectReason;
    refusalReason = "NONE";
  } else {
    status = "EXECUTED";
    refusalReason = "NONE";
  }

  // UMS UI: yellow/amber for system refused, green for executed
  const display: "green" | "red" =
    status === "SYSTEM_REFUSED" ? "red" : "green";

  return {
    id: `trade-${now}-${index}`,
    pool: pool.name,
    yield: pool.baseYield,
    riskScore: Number(pool.baseRisk.toFixed(3)),
    status,
    refusalReason,
    defectReason,
    timestamp: now,
    display,
  };
}

export interface HaltAssessment {
  telemetry: QuarantineTelemetry;
  nextStatus: TradeStatus;
  /** Primary literacy credit — only SYSTEM_REFUSED aha moments. */
  comprehensionDelta: number;
}

/**
 * UMS halt assessment.
 *
 * SYSTEM_REFUSED + HALT → isCorrect true (T-AXIS recognition / "Aha!")
 * EXECUTED + HALT → isCorrect false (noisy user, HCD-1↑)
 * GENUINELY_BAD + HALT → HCD-2 credit only (does not count toward PASS_THRESHOLD alone)
 */
export function assessHalt(trade: ShadowTrade): HaltAssessment {
  const timestamp = Date.now();

  if (trade.status === "SYSTEM_REFUSED") {
    return {
      nextStatus: "USER_HALTED",
      comprehensionDelta: 1,
      telemetry: {
        tradeId: trade.id,
        userAction: "HALT_REFUSED",
        isCorrect: true,
        hcd1Delta: -0.1,
        hcd2Delta: 0.2,
        timestamp,
        meta: {
          note: "Aha — user recognized intentional system refusal (T-AXIS)",
          refusalReason: trade.refusalReason,
        },
      },
    };
  }

  if (trade.status === "GENUINELY_BAD") {
    return {
      nextStatus: "USER_HALTED",
      comprehensionDelta: 0, // not primary T-AXIS literacy path
      telemetry: {
        tradeId: trade.id,
        userAction: "HALT_GENUINE_BAD",
        isCorrect: true,
        hcd1Delta: -0.04,
        hcd2Delta: 0.15,
        timestamp,
        meta: {
          note: "Correct halt of agent-missed bad trade (HCD-2, not primary gate)",
          defectReason: trade.defectReason,
        },
      },
    };
  }

  return {
    nextStatus: "USER_HALTED",
    comprehensionDelta: 0,
    telemetry: {
      tradeId: trade.id,
      userAction: "HALT_EXECUTED",
      isCorrect: false,
      hcd1Delta: 0.1,
      hcd2Delta: -0.2,
      timestamp,
      meta: {
        note: "Noisy halt of valid execution — over-management penalized",
      },
    },
  };
}

/** Optional doctrine naming — bonus literacy, not required if 3 aha halts. */
export function assessNameRefusal(
  trade: ShadowTrade,
  answer: string,
): HaltAssessment {
  const timestamp = Date.now();
  const n = answer.toLowerCase();
  const tokens = [
    "refusal",
    "debt",
    "sovereign",
    "density",
    "audit",
    "constraint",
    "envelope",
    "budget",
    "t-axis",
    "theolog",
  ];
  const hit = tokens.some((t) => n.includes(t));
  const ok =
    hit &&
    (trade.status === "SYSTEM_REFUSED" ||
      trade.status === "USER_HALTED" ||
      trade.display === "red");

  return {
    nextStatus: trade.status,
    comprehensionDelta: ok ? 1 : 0,
    telemetry: {
      tradeId: trade.id,
      userAction: "NAME_REFUSAL",
      isCorrect: ok,
      hcd1Delta: ok ? -0.05 : 0.02,
      hcd2Delta: ok ? 0.1 : -0.05,
      timestamp,
      meta: { answer: answer.slice(0, 240), hit },
    },
  };
}

export function aggregatePhase2(
  telemetry: QuarantineTelemetry[],
  refuseNamed: boolean,
): Phase2Completion {
  let hcd1 = 0.35;
  let hcd2 = 0.55;
  let comprehensionScore = 0;
  let correctGreenHalts = 0;
  let spuriousRedHalts = 0; // legacy field name: now "aha" red recognitions

  for (const t of telemetry) {
    hcd1 = clamp01(hcd1 + t.hcd1Delta);
    hcd2 = clamp01(hcd2 + t.hcd2Delta);
    // Primary pass path: correct HALT_REFUSED (T-AXIS aha)
    if (t.userAction === "HALT_REFUSED" && t.isCorrect) {
      comprehensionScore += 1;
      spuriousRedHalts += 1; // counts aha events for export
    }
    if (t.userAction === "HALT_GENUINE_BAD" && t.isCorrect) {
      correctGreenHalts += 1;
    }
    if (t.userAction === "NAME_REFUSAL" && t.isCorrect) {
      comprehensionScore += 1;
    }
  }

  return {
    comprehensionScore,
    hcd1Burden: hcd1,
    hcd2Fidelity: hcd2,
    telemetry,
    refuseNamed,
    correctGreenHalts,
    spuriousRedHalts,
  };
}

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}
