/**
 * Gnosis Core — Production plurality scheduler CLI.
 *
 * Runs `PluralityScheduler` as a long-lived process, periodically observing
 * agent population archetype diversity and emitting Dove signals through
 * `@sovereign/bus`.
 *
 * Environment variables:
 * - `PLURALITY_INTERVAL_MS` — observation cadence in ms (default 900_000 = 15 min)
 * - `PLURALITY_THRESHOLD` — plurality threshold (default 0.6)
 * - `AGENT_PROFILES_PATH` — optional JSON file path containing AgentProfile[]
 * - `PLURALITY_SOURCE` — source identifier on emitted events
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { sovereignBus } from '@sovereign/bus';
import type { AgentProfile } from '@sovereign/types';

import { PluralityScheduler } from './plurality/scheduler.js';

const DEFAULT_INTERVAL_MS = 15 * 60 * 1000;
const DEFAULT_THRESHOLD = 0.6;
const DEFAULT_SOURCE = 'gnosis-core-plurality';

function getEnvNumber(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number(raw);
  if (Number.isNaN(parsed) || parsed <= 0) {
    console.warn(
      `[PluralityCLI] Invalid ${name}="${raw}"; using default ${fallback}.`
    );
    return fallback;
  }
  return parsed;
}

function getEnvString(name: string, fallback: string): string {
  return process.env[name] ?? fallback;
}

function createPopulationProvider(): () => Promise<readonly AgentProfile[]> {
  const profilesPath = process.env['AGENT_PROFILES_PATH'];

  if (profilesPath) {
    const absolutePath = resolve(profilesPath);
    if (!existsSync(absolutePath)) {
      console.warn(
        `[PluralityCLI] AGENT_PROFILES_PATH="${profilesPath}" not found. Scheduler will observe an empty population until the file appears.`
      );
    }

    return async () => {
      if (!existsSync(absolutePath)) {
        return [];
      }
      const raw = readFileSync(absolutePath, 'utf8');
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) {
        throw new Error(
          `Expected AgentProfile[] at ${absolutePath}, received ${typeof parsed}`
        );
      }
      return parsed as readonly AgentProfile[];
    };
  }

  console.warn(
    '[PluralityCLI] No AGENT_PROFILES_PATH configured. Scheduler will observe an empty population. Set AGENT_PROFILES_PATH to a JSON file containing AgentProfile[].'
  );
  return async () => [];
}

async function main(): Promise<void> {
  const intervalMs = getEnvNumber('PLURALITY_INTERVAL_MS', DEFAULT_INTERVAL_MS);
  const threshold = getEnvNumber('PLURALITY_THRESHOLD', DEFAULT_THRESHOLD);
  const source = getEnvString('PLURALITY_SOURCE', DEFAULT_SOURCE);

  console.log('[PluralityCLI] Sovereign Monad — Gnosis Core Plurality Scheduler');
  console.log(`[PluralityCLI] intervalMs=${intervalMs}`);
  console.log(`[PluralityCLI] threshold=${threshold}`);
  console.log(`[PluralityCLI] source=${source}`);

  const scheduler = new PluralityScheduler({
    bus: sovereignBus,
    provider: createPopulationProvider(),
    intervalMs,
    threshold,
    source,
  });

  scheduler.start();

  const shutdown = async (signal: string) => {
    console.log(`[PluralityCLI] Received ${signal}; shutting down...`);
    await scheduler.stop();
    await sovereignBus.shutdown();
    process.exit(0);
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

void main().catch((err) => {
  console.error('[PluralityCLI] Fatal error:', err);
  process.exit(1);
});
