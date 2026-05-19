type CacheLike = {
  get<T>(key: string): Promise<T | null>;
  set(key: string, value: unknown, options?: { ex?: number }): Promise<unknown>;
};

const memory = new Map<string, { expiresAt: number; value: unknown }>();

function memoryCache(): CacheLike {
  return {
    async get<T>(key: string) {
      const item = memory.get(key);
      if (!item) return null;
      if (item.expiresAt < Date.now()) {
        memory.delete(key);
        return null;
      }
      return item.value as T;
    },
    async set(key: string, value: unknown, options?: { ex?: number }) {
      memory.set(key, {
        value,
        expiresAt: Date.now() + (options?.ex || 300) * 1000
      });
    }
  };
}

async function kvCache(): Promise<CacheLike | null> {
  if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) return null;
  try {
    const mod = await import("@vercel/kv");
    return mod.kv;
  } catch {
    return null;
  }
}

export async function cache() {
  return (await kvCache()) || memoryCache();
}

export async function getCached<T>(key: string) {
  return (await cache()).get<T>(key);
}

export async function setCached(key: string, value: unknown, seconds: number) {
  return (await cache()).set(key, value, { ex: seconds });
}
