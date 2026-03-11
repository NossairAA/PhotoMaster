import { getServerlessEnv } from "./config.js";

type RedisResponse<T> = {
  result: T;
  error?: string;
};

async function redisCommand<T>(...args: Array<string | number>) {
  const env = getServerlessEnv();
  const response = await fetch(env.UPSTASH_REDIS_REST_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.UPSTASH_REDIS_REST_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(args),
  });

  if (!response.ok) {
    throw new Error(`Redis request failed (${response.status})`);
  }

  const payload = (await response.json()) as RedisResponse<T>;
  if (payload.error) {
    throw new Error(payload.error);
  }

  return payload.result;
}

export async function redisSetJson<T>(key: string, value: T, ttlSeconds?: number) {
  const json = JSON.stringify(value);
  if (ttlSeconds && ttlSeconds > 0) {
    await redisCommand("SET", key, json, "EX", ttlSeconds);
    return;
  }
  await redisCommand("SET", key, json);
}

export async function redisGetJson<T>(key: string) {
  const result = await redisCommand<string | null>("GET", key);
  if (!result) return null;
  return JSON.parse(result) as T;
}

export async function redisDelete(key: string) {
  await redisCommand("DEL", key);
}

export async function redisKeys(pattern: string) {
  return redisCommand<string[]>("KEYS", pattern);
}
