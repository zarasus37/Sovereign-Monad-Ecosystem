/**
 * Redis-backed MandateStore — key TTL matches mandate.expiresAt so expired
 * mandates vanish instead of lingering as stale data a buggy caller could misread.
 */

import { Redis } from 'ioredis';
import type { MandateStore } from './ports.js';
import type { ACLMandate } from './types.js';

function key(principalId: string, domain?: string): string {
  // Domain-scoped keys prepare multi-domain; default domain = "primary" for single-domain era
  return `gate-acl:mandate:${principalId}:${domain ?? 'primary'}`;
}

export class RedisMandateStore implements MandateStore {
  constructor(private readonly redis: Redis) {}

  async put(mandate: ACLMandate): Promise<void> {
    const k = key(mandate.principalId, mandate.domain);
    const ttlSec = Math.max(1, Math.ceil((mandate.expiresAt - Date.now()) / 1000));
    // SET with EX: when TTL fires, key is gone — no stale read after expiry
    await this.redis.set(k, JSON.stringify(mandate), 'EX', ttlSec);
  }

  async get(principalId: string, domain?: string): Promise<ACLMandate | null> {
    const raw = await this.redis.get(key(principalId, domain));
    if (!raw) return null;
    try {
      return JSON.parse(raw) as ACLMandate;
    } catch {
      return null;
    }
  }

  async delete(principalId: string, domain?: string): Promise<void> {
    await this.redis.del(key(principalId, domain));
  }
}

/** In-memory store for tests / local demo without Redis. */
export class InMemoryMandateStore implements MandateStore {
  private readonly map = new Map<string, { mandate: ACLMandate; expiresAt: number }>();

  async put(mandate: ACLMandate): Promise<void> {
    this.map.set(key(mandate.principalId, mandate.domain), {
      mandate,
      expiresAt: mandate.expiresAt,
    });
  }

  async get(principalId: string, domain?: string): Promise<ACLMandate | null> {
    const entry = this.map.get(key(principalId, domain));
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.map.delete(key(principalId, domain));
      return null;
    }
    return entry.mandate;
  }

  async delete(principalId: string, domain?: string): Promise<void> {
    this.map.delete(key(principalId, domain));
  }
}

export function createRedisFromUrl(url: string): Redis {
  return new Redis(url, {
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
  });
}
