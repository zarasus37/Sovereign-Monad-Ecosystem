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
 * - `PLURALITY_SOURCE` — source identifier on emitted events
 * - `PLURALITY_PROVIDER` — `file` (default) or `registry`
 * - `AGENT_PROFILES_PATH` — JSON file path containing AgentProfile[] (file provider)
 * - `AGENT_REGISTRY_URL` — registry endpoint returning AgentProfile[] (registry provider)
 * - `AGENT_REGISTRY_TOKEN` — optional bearer token for the registry
 * - `AGENT_REGISTRY_TIMEOUT_MS` — registry request timeout in ms (default 10_000)
 * - `PLURALITY_HEALTH_PORT` — port for the /health and /metrics HTTP server (default 8080)
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { sovereignBus } from '@sovereign/bus';
import type { AgentProfile } from '@sovereign/types';

import { PluralityScheduler } from './plurality/scheduler.js';
import { createAgentRegistryProvider } from './plurality/registry-provider.js';
import { HealthServer } from './health-server.js';

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

function createFileProvider(profilesPath: string): () => Promise<readonly AgentProfile[]> {
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

function createPopulationProvider(): () => Promise<readonly AgentProfile[]> {
  const providerType = process.env['PLURALITY_PROVIDER'] ?? 'file';

  if (providerType === 'registry') {
    const registryUrl = process.env['AGENT_REGISTRY_URL'];
    if (!registryUrl) {
      throw new Error(
        'PLURALITY_PROVIDER=registry requires AGENT_REGISTRY_URL to be set.'
      );
    }

    const timeoutMs = getEnvNumber('AGENT_REGISTRY_TIMEOUT_MS', 10_000);
    console.log(
      `[PluralityCLI] provider=registry url=${registryUrl} timeoutMs=${timeoutMs}`
    );

    return createAgentRegistryProvider({
      url: registryUrl,
      token: process.env['AGENT_REGISTRY_TOKEN'],
      timeoutMs,
    });
  }

  if (providerType !== 'file') {
    console.warn(
      `[PluralityCLI] Unknown PLURALITY_PROVIDER="${providerType}"; falling back to file provider.`
    );
  }

  const profilesPath = process.env['AGENT_PROFILES_PATH'];
  if (profilesPath) {
    console.log(`[PluralityCLI] provider=file path=${profilesPath}`);
    return createFileProvider(profilesPath);
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

  const healthPort = getEnvNumber('PLURALITY_HEALTH_PORT', 8080);
  const healthServer = new HealthServer({
    port: healthPort,
    getMetrics: () => scheduler.getMetrics(),
  });
  healthServer.start();

  scheduler.start();

  const shutdown = async (signal: string) => {
    console.log(`[PluralityCLI] Received ${signal}; shutting down...`);
    await scheduler.stop();
    await healthServer.stop();
    await sovereignBus.shutdown();
    process.exit(0);
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));

  // Keep the process alive until an explicit shutdown signal. The scheduler
  // interval is unref'd, so this timeout prevents the event loop from draining
  // and exiting the container immediately.
  setTimeout(() => undefined, 2 ** 31 - 1);
}

void main().catch((err) => {
  console.error('[PluralityCLI] Fatal error:', err);
  process.exit(1);
});
