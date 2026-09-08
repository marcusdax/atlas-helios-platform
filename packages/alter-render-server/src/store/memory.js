'use strict';

/**
 * Job store contract:
 *   create(job)            -> job
 *   get(id)                -> job | undefined
 *   update(id, patch)      -> job | undefined
 *   findByKey(key)         -> job | undefined
 *
 * Async implementations are fine; the router awaits every call. Swap in
 * Postgres/Redis for multi-instance or durable async rendering. The router
 * never assumes the store is local, which is what keeps the same route code
 * working behind a load balancer.
 */
class MemoryJobStore {
  constructor({ max = 500, ttlMs = 60 * 60 * 1000, now = () => Date.now() } = {}) {
    this.max = max;
    this.ttlMs = ttlMs;
    this.now = now;
    this.jobs = new Map();
    this.byKey = new Map();
  }

  #sweep() {
    const cutoff = this.now() - this.ttlMs;
    for (const [id, job] of this.jobs) {
      if (job.createdAt < cutoff) {
        this.jobs.delete(id);
        this.byKey.delete(job.idempotencyKey);
      }
    }
    while (this.jobs.size > this.max) {
      const [id, job] = this.jobs.entries().next().value;
      this.jobs.delete(id);
      this.byKey.delete(job.idempotencyKey);
    }
  }

  create(job) {
    this.jobs.set(job.id, job);
    if (job.idempotencyKey) this.byKey.set(job.idempotencyKey, job.id);
    this.#sweep();
    return job;
  }

  get(id) {
    return this.jobs.get(id);
  }

  update(id, patch) {
    const job = this.jobs.get(id);
    if (!job) return undefined;
    Object.assign(job, patch, { updatedAt: this.now() });
    return job;
  }

  findByKey(key) {
    const id = this.byKey.get(key);
    return id ? this.jobs.get(id) : undefined;
  }
}

module.exports = { MemoryJobStore };
