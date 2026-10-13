#!/usr/bin/env node
/**
 * run-meshaleach-walk.mjs — orchestrator for the Meshaleach UI walk.
 *
 * Starts the Vite dev server, waits for it to come up, runs the walk,
 * then tears the server down. Lets the operator do `pnpm walk:meshaleach`
 * from a clean checkout (or in CI) without having to manually start Vite.
 *
 * Prerequisites (in addition to root pnpm install):
 *   - playwright + chromium installed: `npx playwright install chromium`
 *   - frontend node_modules (handled by `pnpm install` at the root)
 *
 * Usage:
 *   pnpm walk:meshaleach             # uses default 127.0.0.1:5173
 *   BASE=http://127.0.0.1:5173 pnpm walk:meshaleach
 *   SKIP_VITE=1 pnpm walk:meshaleach  # Vite already running elsewhere
 */
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..");
const FRONTEND_DIR = join(REPO_ROOT, "monad-ecosystem/control-center/src/frontend");
const BASE = (process.env.BASE || "http://127.0.0.1:5173").replace(/\/$/, "");
const SKIP_VITE = process.env.SKIP_VITE === "1";
const READY_TIMEOUT_MS = 60_000; // Vite cold start is ~10s; allow plenty
const READY_INTERVAL_MS = 1_000;

let vite = null;

async function isReady() {
  try {
    const r = await fetch(BASE + "/", { method: "GET" });
    return r.ok;
  } catch {
    return false;
  }
}

async function waitForReady() {
  const start = Date.now();
  while (Date.now() - start < READY_TIMEOUT_MS) {
    if (await isReady()) {
      console.log(`[walk] Vite ready at ${BASE} (${Math.round((Date.now() - start) / 1000)}s)`);
      return true;
    }
    await delay(READY_INTERVAL_MS);
  }
  return false;
}

async function startVite() {
  if (SKIP_VITE) {
    console.log(`[walk] SKIP_VITE=1, assuming Vite is already up at ${BASE}`);
    return null;
  }
  console.log(`[walk] Starting Vite dev server...`);
  vite = spawn("node", ["node_modules/vite/bin/vite.js", "--port", "5173", "--host", "127.0.0.1"], {
    cwd: FRONTEND_DIR,
    stdio: ["ignore", "pipe", "pipe"],
    detached: false,
  });
  vite.stdout.on("data", (d) => process.stdout.write(`[vite] ${d.toString()}`));
  vite.stderr.on("data", (d) => process.stderr.write(`[vite] ${d.toString()}`));
  vite.on("exit", (code) => {
    if (code !== null && code !== 0) {
      console.error(`[walk] Vite exited with code ${code}`);
    }
  });
  return vite;
}

function stopVite() {
  if (vite && !vite.killed) {
    console.log(`[walk] Stopping Vite (pid ${vite.pid})...`);
    try {
      vite.kill();
    } catch {}
  }
}

async function runWalk() {
  // Spawn the walk script as a child so we can capture its exit code.
  return await new Promise((resolve) => {
    const walk = spawn("node", ["scripts/meshaleach-ui-walk.mjs"], {
      cwd: REPO_ROOT,
      stdio: "inherit",
      env: { ...process.env, BASE },
    });
    walk.on("exit", (code) => resolve(code ?? 1));
  });
}

async function main() {
  const cleanup = () => stopVite();
  process.on("SIGINT", cleanup);
  process.on("SIGTERM", cleanup);

  await startVite();
  const ready = await waitForReady();
  if (!ready) {
    console.error(`[walk] Vite did not become ready at ${BASE} within ${READY_TIMEOUT_MS / 1000}s`);
    cleanup();
    process.exit(2);
  }

  const code = await runWalk();
  cleanup();
  process.exit(code);
}

main().catch((err) => {
  console.error(err);
  cleanup();
  process.exit(1);
});
