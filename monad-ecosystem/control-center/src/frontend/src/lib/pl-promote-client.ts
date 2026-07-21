/**
 * Client → gate-acl PL promote bridge.
 * Local ledger is optimistic cache; server verifies and may broadcast Kafka.
 */

export type PromoteTaskId =
  | "broken-genesis-repair"
  | "quarantine-refusal-literacy"
  | "archon-comprehension-gate";

export interface PromoteClaimBody {
  principalId: string;
  domain?: string;
  taskId: PromoteTaskId;
  taskPayload: Record<string, unknown>;
}

export interface PromoteSuccess {
  status: "PL_BROADCAST_SUCCESS" | "PL_LOCAL_SYNTHESIS";
  event: {
    eventId: string;
    principalId: string;
    taskId: string;
    pointsAwarded: number;
    totalPl: number;
    verifiedBy: string;
    auditTrace: string[];
    timestamp: string;
  };
  kafkaEnabled: boolean;
}

function bridgeBaseUrl(): string {
  // Vite env or same-origin proxy
  const env =
    typeof import.meta !== "undefined"
      ? (import.meta as { env?: Record<string, string> }).env
      : undefined;
  return (
    env?.VITE_GATE_ACL_URL?.replace(/\/$/, "") ||
    env?.VITE_API_BASE?.replace(/\/$/, "") ||
    ""
  );
}

/**
 * POST /api/v1/gate-acl/promote-pl
 * Falls back to throwing if offline — caller retains local PL.
 */
export async function promotePlToBridge(
  claim: PromoteClaimBody,
): Promise<PromoteSuccess> {
  const base = bridgeBaseUrl();
  const url = `${base}/api/v1/gate-acl/promote-pl`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(claim),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      (err as { message?: string }).message ||
        `PL Promotion Failed (${res.status})`,
    );
  }
  return res.json() as Promise<PromoteSuccess>;
}
