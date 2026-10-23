/**
 * Cliente mínimo da API REST do Upstash Redis (também compatível com Vercel KV
 * / Redis da Vercel, que expõe as mesmas variáveis KV_REST_API_*).
 *
 * Sem dependências externas: só fetch.
 */

type RedisConfig = { url: string; token: string };

export function redisConfig(): RedisConfig | null {
  const url =
    process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL ?? "";
  const token =
    process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN ?? "";

  if (!url || !token) return null;
  return { url: url.replace(/\/+$/, ""), token };
}

export function redisConfigured(): boolean {
  return redisConfig() !== null;
}

/** Executa um comando Redis e retorna o campo `result`. */
export async function redisCommand<T = unknown>(
  command: (string | number)[],
): Promise<T> {
  const config = redisConfig();
  if (!config) throw new Error("Redis não configurado");

  const res = await fetch(config.url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(command),
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Redis ${res.status}: ${text.slice(0, 300)}`);
  }

  const data = (await res.json()) as { result?: T; error?: string };
  if (data.error) throw new Error(`Redis: ${data.error}`);
  return data.result as T;
}
