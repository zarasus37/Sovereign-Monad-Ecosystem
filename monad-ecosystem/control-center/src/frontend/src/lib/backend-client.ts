// Backend client helpers — type conversion and formatting utilities
// Backend now uses TypeScript enums directly — no Candid variant encoding needed

import type { Controls, PrimaryMode, SecondaryMode } from "@/backend";

// Pass-through helpers kept for API compatibility across imports
export function decodePrimaryMode(mode: PrimaryMode): PrimaryMode {
  return mode;
}

export function decodeSecondaryMode(mode: SecondaryMode): SecondaryMode {
  return mode;
}

export function decodeControls(raw: Controls): Controls {
  return raw;
}

// Encode helpers — identity since backend accepts enum strings directly
export function encodePrimaryMode(mode: PrimaryMode): PrimaryMode {
  return mode;
}

export function encodeSecondaryMode(mode: SecondaryMode): SecondaryMode {
  return mode;
}

export function formatUptime(seconds: bigint): string {
  const s = Number(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

export function formatTimestamp(ts: bigint): string {
  // IC timestamps are nanoseconds — divide by 1_000_000n before passing to Date
  const ms = Number(ts / 1_000_000n);
  return new Date(ms).toLocaleTimeString("en-US", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}
