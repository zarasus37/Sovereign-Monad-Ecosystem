/**
 * Redis-backed bootstrap wallet nonce manager (UMS Vector 4.2).
 *
 * Atomic INCR across processes. Falls back to process-local counter when
 * REDIS_URL is unset (local/dev honesty — not multi-instance safe).
 *
 * Redis key stores "last allocated nonce". First getNextNonce after
 * syncWithChain(chainPending) returns chainPending.
 */

export const NONCE_KEY_DEFAULT = 'cardia:bootstrap_wallet:nonce';

/** Minimal Redis surface we need (ioredis-compatible). */
export interface NonceRedisClient {
  set(key: string, value: string | number): Promise<unknown>;
  incr(key: string): Promise<number>;
  get(key: string): Promise<string | null>;
  quit?(): Promise<unknown>;
}

export type GetChainPendingNonce = () => Promise<number>;

export type RedisNonceManagerOptions = {
  redis?: NonceRedisClient | null;
  /** Override Redis key (tests / multi-wallet). */
  key?: string;
  /** Fetch chain pending nonce (ethers provider.getTransactionCount). */
  getChainPendingNonce?: GetChainPendingNonce;
};

/**
 * In-memory atomic-ish counter for tests / no Redis.
 * Not safe across processes — same class of bug as the old `let currentNonce`.
 */
export class InMemoryNonceStore implements NonceRedisClient {
  private store = new Map<string, number>();

  async set(key: string, value: string | number): Promise<'OK'> {
    this.store.set(key, Number(value));
    return 'OK';
  }

  async incr(key: string): Promise<number> {
    const next = (this.store.get(key) ?? -1) + 1;
    this.store.set(key, next);
    return next;
  }

  async get(key: string): Promise<string | null> {
    const v = this.store.get(key);
    return v === undefined ? null : String(v);
  }
}

export class RedisNonceManager {
  private isInitialized = false;
  private readonly key: string;
  private redis: NonceRedisClient | null;
  private getChainPendingNonce?: GetChainPendingNonce;
  /** Fallback when redis is null */
  private readonly memory = new InMemoryNonceStore();

  constructor(opts: RedisNonceManagerOptions = {}) {
    this.key = opts.key ?? NONCE_KEY_DEFAULT;
    this.redis = opts.redis === undefined ? null : opts.redis;
    this.getChainPendingNonce = opts.getChainPendingNonce;
  }

  /** Inject Redis client after construction (lazy connect). */
  setRedis(client: NonceRedisClient | null): void {
    this.redis = client;
    this.isInitialized = false;
  }

  setChainPendingFetcher(fn: GetChainPendingNonce): void {
    this.getChainPendingNonce = fn;
  }

  private client(): NonceRedisClient {
    return this.redis ?? this.memory;
  }

  /**
   * Synchronize store with chain pending nonce.
   * Sets key to chainNonce - 1 so next INCR returns chainNonce.
   */
  async syncWithChain(chainNonce?: number): Promise<number> {
    let pending = chainNonce;
    if (pending === undefined) {
      if (!this.getChainPendingNonce) {
        throw new Error(
          '[NonceManager] syncWithChain requires getChainPendingNonce or explicit chainNonce',
        );
      }
      pending = await this.getChainPendingNonce();
    }
    // First INCR yields `pending`
    await this.client().set(this.key, pending - 1);
    this.isInitialized = true;
    console.log(`[NonceManager] Synced with chain. Next nonce: ${pending}`);
    return pending;
  }

  /**
   * Atomically allocate next nonce.
   * Initializes from chain (or 0 if no fetcher and never synced) on first use.
   */
  async getNextNonce(): Promise<number> {
    if (!this.isInitialized) {
      if (this.getChainPendingNonce) {
        await this.syncWithChain();
      } else {
        // Dev: start at 0 if never synced
        const existing = await this.client().get(this.key);
        if (existing === null) {
          await this.client().set(this.key, -1);
        }
        this.isInitialized = true;
      }
    }
    const nonce = await this.client().incr(this.key);
    console.log(`[NonceManager] Allocated nonce: ${nonce}`);
    return nonce;
  }

  /**
   * Resync after drop/revert/replacement to close gaps.
   */
  async handleTransactionFailure(): Promise<void> {
    console.warn(
      `[NonceManager] Transaction failure detected. Resyncing nonces with chain...`,
    );
    if (this.getChainPendingNonce) {
      await this.syncWithChain();
    } else {
      // No chain: reset init so next alloc re-reads store
      this.isInitialized = false;
    }
  }

  /** Test helper */
  async peekLastAllocated(): Promise<number | null> {
    const v = await this.client().get(this.key);
    return v === null ? null : Number(v);
  }

  resetForTests(): void {
    this.isInitialized = false;
    this.redis = null;
  }
}

/** Process singleton — wire Redis on bootstrap when REDIS_URL is set. */
export const nonceManager = new RedisNonceManager();

/**
 * Connect ioredis if REDIS_URL is set; otherwise leave memory fallback.
 */
export async function connectDefaultNonceRedis(
  manager: RedisNonceManager = nonceManager,
): Promise<'redis' | 'memory'> {
  const url = process.env.REDIS_URL;
  if (!url) {
    console.warn(
      '[NonceManager] REDIS_URL unset — using in-process memory (not multi-instance safe)',
    );
    manager.setRedis(null);
    return 'memory';
  }
  try {
    // Dynamic import keeps ioredis optional; cast matches ioredis v5 named export under NodeNext.
    type RedisCtor = new (
      url: string,
      opts?: { maxRetriesPerRequest?: number; enableReadyCheck?: boolean },
    ) => NonceRedisClient;
    const mod = (await import('ioredis')) as unknown as {
      Redis: RedisCtor;
      default?: RedisCtor;
    };
    const RedisCtor = mod.Redis ?? mod.default;
    if (!RedisCtor) {
      throw new Error('ioredis Redis constructor not found');
    }
    const client = new RedisCtor(url, {
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
    });
    manager.setRedis(client);
    console.log('[NonceManager] Connected to Redis');
    return 'redis';
  } catch (err) {
    console.error(
      '[NonceManager] Redis connect failed — falling back to memory:',
      err,
    );
    manager.setRedis(null);
    return 'memory';
  }
}

/**
 * Attach chain pending nonce fetcher from env (live funding).
 */
export async function attachChainNonceFetcher(
  manager: RedisNonceManager = nonceManager,
): Promise<void> {
  if (!process.env.MONAD_RPC_URL || !process.env.BOOTSTRAP_PRIVATE_KEY) {
    return;
  }
  const { ethers } = await import('ethers');
  const provider = new ethers.JsonRpcProvider(process.env.MONAD_RPC_URL);
  const wallet = new ethers.Wallet(process.env.BOOTSTRAP_PRIVATE_KEY, provider);
  manager.setChainPendingFetcher(async () =>
    provider.getTransactionCount(wallet.address, 'pending'),
  );
}
