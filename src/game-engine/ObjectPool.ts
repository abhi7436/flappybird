// ============================================================
// ObjectPool<T> — generic free-list pool
//
// Usage:
//   const pool = new ObjectPool(() => new Coin(stub), (c) => c.reconfigure(cfg));
//   const coin = pool.acquire(config);
//   pool.release(coin);
// ============================================================

export class ObjectPool<T, TConfig> {
  private free:     T[]   = [];
  private factory:  ()    => T;
  private configure: (obj: T, cfg: TConfig) => void;

  /** @param factory    Called when pool is empty — creates a fresh instance */
  /** @param configure  Called both on acquire AND after release to reset state */
  constructor(factory: () => T, configure: (obj: T, cfg: TConfig) => void) {
    this.factory   = factory;
    this.configure = configure;
  }

  /**
   * Acquire an object from the pool (or create one) and configure it.
   * O(1) amortised.
   */
  acquire(cfg: TConfig): T {
    const obj = this.free.length > 0 ? this.free.pop()! : this.factory();
    this.configure(obj, cfg);
    return obj;
  }

  /**
   * Return an object to the pool so it can be reused.
   * Caller must not use the reference after releasing.
   */
  release(obj: T): void {
    this.free.push(obj);
  }

  /** Pre-warm by creating n instances and putting them in the pool. */
  prewarm(n: number, dummyCfg: TConfig): void {
    for (let i = 0; i < n; i++) {
      const obj = this.factory();
      this.configure(obj, dummyCfg);
      this.free.push(obj);
    }
  }

  get size(): number {
    return this.free.length;
  }
}
