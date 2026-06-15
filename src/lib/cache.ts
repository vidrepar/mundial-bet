import { cachified } from "@epic-web/cachified";
import type { Cache, CacheEntry } from "@epic-web/cachified";
import Redis from "ioredis";

/* cachified-backed read cache. Uses Redis when REDIS_URL is set (shared across
 * restarts), and always mirrors to an in-process Map so a Redis hiccup never
 * breaks a request. Keys are namespaced to avoid colliding with Coolify. */
const PREFIX = "mundial:";

let redis: Redis | null = null;
let tried = false;
function getRedis(): Redis | null {
  if (tried) return redis;
  tried = true;
  /* prefer discrete host/port/password — Coolify's password has URL-unsafe
   * chars, so a redis:// URL string fails to parse */
  /* queue commands until the connection is ready so the very first write lands
   * in Redis; maxRetriesPerRequest still bounds failure if Redis is truly down */
  const opts = { maxRetriesPerRequest: 2, enableOfflineQueue: true, lazyConnect: false };
  const host = process.env.REDIS_HOST;
  if (host) {
    redis = new Redis({
      host,
      port: Number(process.env.REDIS_PORT ?? 6379),
      password: process.env.REDIS_PASSWORD,
      ...opts,
    });
  } else if (process.env.REDIS_URL) {
    redis = new Redis(process.env.REDIS_URL, opts);
  } else {
    return null;
  }
  redis.on("error", () => {
    /* swallow — requests fall back to the in-memory map */
  });
  return redis;
}

const mem = new Map<string, CacheEntry>();

const cache: Cache = {
  name: "mundial",
  async get(key) {
    const r = getRedis();
    if (r) {
      try {
        const raw = await r.get(PREFIX + key);
        if (raw) return JSON.parse(raw);
      } catch {
        /* fall through to memory */
      }
    }
    return mem.get(key) ?? null;
  },
  async set(key, entry) {
    mem.set(key, entry);
    const r = getRedis();
    if (!r) return;
    try {
      const ttl = entry.metadata.ttl ?? 0;
      const swr = entry.metadata.swr ?? 0;
      const life = ttl > 0 ? ttl + swr : 0;
      const val = JSON.stringify(entry);
      if (life > 0) await r.set(PREFIX + key, val, "PX", Math.round(life));
      else await r.set(PREFIX + key, val);
    } catch {
      /* memory copy already set */
    }
  },
  async delete(key) {
    mem.delete(key);
    const r = getRedis();
    if (!r) return;
    try {
      await r.del(PREFIX + key);
    } catch {
      /* ignore */
    }
  },
};

/* serve `key` from cache for `ttlMs`, revalidating in the background for up to
 * another `ttlMs` (stale-while-revalidate) so reads stay snappy. */
export function cached<T>(
  key: string,
  ttlMs: number,
  getFreshValue: () => Promise<T> | T,
): Promise<T> {
  return cachified({
    key,
    cache,
    ttl: ttlMs,
    swr: ttlMs,
    getFreshValue: () => Promise.resolve(getFreshValue()),
  });
}
