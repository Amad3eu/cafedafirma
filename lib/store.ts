import { promises as fs } from "node:fs";
import path from "node:path";
import { redisCommand, redisConfigured, redisPipeline } from "./redis";
import type { CoffeeEntry, CupEntry, StorageKind } from "./types";

/**
 * Duas coleções, com o mesmo formato de armazenamento:
 *
 * - **feitas** (`CoffeeEntry`): quando o café foi passado.
 * - **xícaras** (`CupEntry`): quem tomou, de qual feita e que nota deu.
 *
 * No Redis cada coleção é um *sorted set* cujo score é o timestamp, o que dá
 * consultas por período de graça. Em desenvolvimento, cada uma é um JSON em
 * `./data`.
 */
export const REDIS_KEYS = {
  entries: "cafe:entries",
  cups: "cafe:cups",
} as const;

type Collection = { redisKey: string; file: string };

const BREWS: Collection = {
  redisKey: REDIS_KEYS.entries,
  file: path.join(process.cwd(), "data", "entries.json"),
};

const CUPS: Collection = {
  redisKey: REDIS_KEYS.cups,
  file: path.join(process.cwd(), "data", "cups.json"),
};

const ONE_YEAR = 365 * 24 * 60 * 60 * 1000;

type Item = { id: string; ts: number };

/**
 * - `redis`: dados compartilhados com toda a equipe (produção).
 * - `file`: arquivo local em ./data (desenvolvimento).
 * - `none`: sem persistência no servidor -> o app usa o localStorage do navegador.
 */
export function storageKind(): StorageKind {
  if (redisConfigured()) return "redis";
  const fileAllowed =
    process.env.NODE_ENV !== "production" || process.env.CAFE_FILE_STORE === "1";
  return fileAllowed ? "file" : "none";
}

/* ------------------------------------------------------------------ */
/* Arquivo local (dev)                                                 */
/* ------------------------------------------------------------------ */

async function readFile<T extends Item>(coll: Collection): Promise<T[]> {
  try {
    const raw = await fs.readFile(coll.file, "utf8");
    const parsed = JSON.parse(raw) as T[];
    return Array.isArray(parsed) ? parsed.filter(isItem) : [];
  } catch {
    return [];
  }
}

async function writeFile<T extends Item>(coll: Collection, items: T[]): Promise<void> {
  await fs.mkdir(path.dirname(coll.file), { recursive: true });
  await fs.writeFile(coll.file, JSON.stringify(items, null, 2), "utf8");
}

/* ------------------------------------------------------------------ */
/* Operações genéricas                                                 */
/* ------------------------------------------------------------------ */

function isItem(value: unknown): value is Item {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<Item>;
  return typeof item.id === "string" && typeof item.ts === "number";
}

function parseMembers<T extends Item>(raw: string[] | null | undefined): T[] {
  return (raw ?? [])
    .map((member) => safeParse<T>(member))
    .filter((item): item is T => item !== null)
    .sort((a, b) => a.ts - b.ts);
}

function safeParse<T extends Item>(value: string): T | null {
  try {
    const parsed = JSON.parse(value) as unknown;
    return isItem(parsed) ? (parsed as T) : null;
  } catch {
    return null;
  }
}

async function listIn<T extends Item>(coll: Collection, sinceTs: number): Promise<T[]> {
  const kind = storageKind();

  if (kind === "redis") {
    const raw = await redisCommand<string[]>([
      "ZRANGEBYSCORE",
      coll.redisKey,
      sinceTs,
      "+inf",
    ]);
    return parseMembers<T>(raw);
  }

  if (kind === "file") {
    const all = await readFile<T>(coll);
    return all.filter((item) => item.ts >= sinceTs).sort((a, b) => a.ts - b.ts);
  }

  return [];
}

async function addIn<T extends Item>(coll: Collection, item: T): Promise<void> {
  const kind = storageKind();

  if (kind === "redis") {
    await redisCommand(["ZADD", coll.redisKey, item.ts, JSON.stringify(item)]);
    // mantém apenas o último ano de histórico
    await redisCommand([
      "ZREMRANGEBYSCORE",
      coll.redisKey,
      "-inf",
      item.ts - ONE_YEAR,
    ]).catch(() => undefined);
    return;
  }

  if (kind === "file") {
    const all = await readFile<T>(coll);
    all.push(item);
    const cutoff = Date.now() - ONE_YEAR;
    await writeFile(
      coll,
      all.filter((entry) => entry.ts >= cutoff).sort((a, b) => a.ts - b.ts),
    );
  }
}

/** Localiza o membro bruto (string JSON) de um item pelo id. */
async function findMember<T extends Item>(
  coll: Collection,
  id: string,
): Promise<{ member: string; item: T } | null> {
  const raw = await redisCommand<string[]>(["ZRANGE", coll.redisKey, 0, -1]);
  for (const member of raw ?? []) {
    const item = safeParse<T>(member);
    if (item?.id === id) return { member, item };
  }
  return null;
}

async function removeIn(coll: Collection, id: string): Promise<boolean> {
  const kind = storageKind();

  if (kind === "redis") {
    const found = await findMember(coll, id);
    if (!found) return false;
    await redisCommand(["ZREM", coll.redisKey, found.member]);
    return true;
  }

  if (kind === "file") {
    const all = await readFile(coll);
    const next = all.filter((item) => item.id !== id);
    if (next.length === all.length) return false;
    await writeFile(coll, next);
    return true;
  }

  return false;
}

/**
 * Atualiza campos de um item mantendo `id` e `ts`. Campos com valor `undefined`
 * no patch são removidos (é assim que se "desavalia" uma xícara).
 */
async function updateIn<T extends Item>(
  coll: Collection,
  id: string,
  patch: Partial<Omit<T, "id" | "ts">>,
): Promise<T | null> {
  const kind = storageKind();

  const apply = (item: T): T => {
    const next = { ...item } as Record<string, unknown>;
    for (const [key, value] of Object.entries(patch)) {
      if (key === "id" || key === "ts") continue;
      if (value === undefined) delete next[key];
      else next[key] = value;
    }
    return next as T;
  };

  if (kind === "redis") {
    const found = await findMember<T>(coll, id);
    if (!found) return null;
    const next = apply(found.item);
    // ZADD com o mesmo score e membro novo + ZREM do antigo (sem transação:
    // na pior hipótese há um instante com os dois, nunca com nenhum)
    await redisCommand(["ZADD", coll.redisKey, next.ts, JSON.stringify(next)]);
    await redisCommand(["ZREM", coll.redisKey, found.member]);
    return next;
  }

  if (kind === "file") {
    const all = await readFile<T>(coll);
    const index = all.findIndex((item) => item.id === id);
    if (index === -1) return null;
    const next = apply(all[index]);
    all[index] = next;
    await writeFile(coll, all);
    return next;
  }

  return null;
}

/* ------------------------------------------------------------------ */
/* API pública — feitas                                                */
/* ------------------------------------------------------------------ */

export const listEntries = (sinceTs: number) => listIn<CoffeeEntry>(BREWS, sinceTs);
export const addEntry = (entry: CoffeeEntry) => addIn(BREWS, entry);
export const removeEntry = (id: string) => removeIn(BREWS, id);

/* ------------------------------------------------------------------ */
/* API pública — xícaras                                               */
/* ------------------------------------------------------------------ */

export const listCups = (sinceTs: number) => listIn<CupEntry>(CUPS, sinceTs);
export const addCup = (cup: CupEntry) => addIn(CUPS, cup);
export const removeCup = (id: string) => removeIn(CUPS, id);
export const updateCup = (id: string, patch: Partial<Omit<CupEntry, "id" | "ts">>) =>
  updateIn<CupEntry>(CUPS, id, patch);

/**
 * Lê feitas e xícaras de uma vez. No Redis usa pipeline (uma requisição HTTP
 * para os dois comandos), o que é o caminho quente do site e da extensão.
 */
export async function listEntriesAndCups(
  sinceTs: number,
): Promise<{ entries: CoffeeEntry[]; cups: CupEntry[] }> {
  const kind = storageKind();

  if (kind === "redis") {
    const [rawEntries, rawCups] = await redisPipeline<[string[], string[]]>([
      ["ZRANGEBYSCORE", BREWS.redisKey, sinceTs, "+inf"],
      ["ZRANGEBYSCORE", CUPS.redisKey, sinceTs, "+inf"],
    ]);
    return {
      entries: parseMembers<CoffeeEntry>(rawEntries),
      cups: parseMembers<CupEntry>(rawCups),
    };
  }

  const [entries, cups] = await Promise.all([listEntries(sinceTs), listCups(sinceTs)]);
  return { entries, cups };
}
