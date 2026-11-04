/**
 * Cliente mínimo da API REST do Upstash Redis (também compatível com Vercel KV
 * / integração Redis do Marketplace da Vercel).
 *
 * Sem dependências externas: só fetch.
 *
 * Os nomes das variáveis variam conforme como o banco foi criado:
 *  - integração Upstash (padrão):  UPSTASH_REDIS_REST_URL / _TOKEN
 *  - Vercel KV:                    KV_REST_API_URL / KV_REST_API_TOKEN
 *  - integração com prefixo custom (ex.: STORAGE):
 *                                  STORAGE_URL / STORAGE_TOKEN
 *                                  STORAGE_REST_API_URL / STORAGE_REST_API_TOKEN
 *                                  STORAGE_KV_REST_API_URL / ..._TOKEN
 *  - Upstash single-var:           UPSTASH_REDIS_URL / STORAGE_REDIS_URL
 *
 * Por isso a busca é por padrão: qualquer variável terminada em `_URL`
 * (ou `_REST_API_URL`) cujo valor aponte para o Upstash, junto do token
 * correspondente.
 */

type RedisConfig = { url: string; token: string };

/** Nomes explícitos, em ordem de prioridade. */
const URL_VARS = [
  "UPSTASH_REDIS_REST_URL",
  "KV_REST_API_URL",
  "UPSTASH_REDIS_REST_KV_REST_API_URL",
] as const;

const TOKEN_VARS = [
  "UPSTASH_REDIS_REST_TOKEN",
  "KV_REST_API_TOKEN",
  "UPSTASH_REDIS_REST_KV_REST_API_TOKEN",
] as const;

/**
 * Deriva o nome do token a partir do nome da variável de URL.
 * Ex.: STORAGE_URL -> STORAGE_TOKEN | STORAGE_REST_API_URL -> STORAGE_REST_API_TOKEN
 */
function tokenNameFor(urlVar: string): string[] {
  const base = urlVar.replace(/_URL$/, "");
  return [
    `${base}_TOKEN`,
    `${base}_READ_ONLY_TOKEN`,
    `${base.replace(/_REST_API$/, "")}_REST_API_TOKEN`,
  ];
}

function findKnown(prefixes: readonly string[]): RedisConfig | null {
  for (const urlVar of prefixes) {
    const url = process.env[urlVar];
    if (!url) continue;
    for (const tokenVar of tokenNameFor(urlVar)) {
      const token = process.env[tokenVar];
      if (token) return { url: url.replace(/\/+$/, ""), token };
    }
  }
  return null;
}

/** Varre o ambiente procurando qualquer par URL/TOKEN que aponte para o Upstash. */
function scanEnvironment(): RedisConfig | null {
  const keys = Object.keys(process.env);

  for (const urlVar of keys) {
    if (!/_URL$/.test(urlVar)) continue;
    const raw = process.env[urlVar];
    if (!raw || !/^https?:\/\//.test(raw)) continue;
    if (!/upstash|redis/i.test(raw)) continue;

    for (const tokenVar of tokenNameFor(urlVar)) {
      const token = process.env[tokenVar];
      if (token) return { url: raw.replace(/\/+$/, ""), token };
    }

    // alguns setups usam <PREFIXO>_URL + <PREFIXO>_PASSWORD / <PREFIXO>_SECRET
    const base = urlVar.replace(/_URL$/, "");
    for (const suffix of ["_PASSWORD", "_SECRET", "_API_KEY"]) {
      const token = process.env[`${base}${suffix}`];
      if (token) return { url: raw.replace(/\/+$/, ""), token };
    }
  }

  return null;
}

export function redisConfig(): RedisConfig | null {
  const knownByUrl = findKnown(URL_VARS);
  if (knownByUrl) return knownByUrl;

  // fallback: token com nome conhecido -> procura a URL correspondente
  for (const tokenVar of TOKEN_VARS) {
    const token = process.env[tokenVar];
    if (!token) continue;
    const base = tokenVar.replace(/_TOKEN$/, "");
    for (const suffix of ["_URL", "_REST_URL", "_REDIS_URL"]) {
      const url = process.env[`${base}${suffix}`];
      if (url) return { url: url.replace(/\/+$/, ""), token };
    }
  }

  return scanEnvironment();
}

export function redisConfigured(): boolean {
  return redisConfig() !== null;
}

type RedisCommand = (string | number)[];
type RedisReply<T> = { result?: T; error?: string };

async function post<T>(path: string, body: unknown): Promise<T> {
  const config = redisConfig();
  if (!config) throw new Error("Redis não configurado");

  const res = await fetch(`${config.url}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Redis ${res.status}: ${text.slice(0, 300)}`);
  }

  return (await res.json()) as T;
}

/** Executa um comando Redis e retorna o campo `result`. */
export async function redisCommand<T = unknown>(command: RedisCommand): Promise<T> {
  const data = await post<RedisReply<T>>("", command);
  if (data.error) throw new Error(`Redis: ${data.error}`);
  return data.result as T;
}

/**
 * Executa vários comandos em uma única requisição HTTP (endpoint `/pipeline`
 * do Upstash). Os resultados vêm na mesma ordem dos comandos. Usado para ler
 * feitas e xícaras de uma vez só, sem dobrar a latência.
 */
export async function redisPipeline<T extends unknown[]>(
  commands: RedisCommand[],
): Promise<T> {
  if (commands.length === 0) return [] as unknown as T;
  const replies = await post<RedisReply<unknown>[]>("/pipeline", commands);
  return replies.map((reply, index) => {
    if (reply?.error) {
      throw new Error(`Redis (${commands[index][0]}): ${reply.error}`);
    }
    return reply?.result;
  }) as T;
}
