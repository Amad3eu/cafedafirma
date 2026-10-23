import { promises as fs } from "node:fs";
import path from "node:path";
import { redisCommand, redisConfigured } from "./redis";
import type { CoffeeEntry, StorageKind } from "./types";

const REDIS_KEY = "cafe:entries";
const DATA_FILE = path.join(process.cwd(), "data", "entries.json");
const ONE_YEAR = 365 * 24 * 60 * 60 * 1000;

/**
 * - `redis`: dados compartilhados com toda a equipe (produção).
 * - `file`: arquivo local em ./data/entries.json (desenvolvimento).
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

async function readFile(): Promise<CoffeeEntry[]> {
  try {
    const raw = await fs.readFile(DATA_FILE, "utf8");
    const parsed = JSON.parse(raw) as CoffeeEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeFile(entries: CoffeeEntry[]): Promise<void> {
  await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
  await fs.writeFile(DATA_FILE, JSON.stringify(entries, null, 2), "utf8");
}

/* ------------------------------------------------------------------ */
/* API pública                                                         */
/* ------------------------------------------------------------------ */

export async function listEntries(sinceTs: number): Promise<CoffeeEntry[]> {
  const kind = storageKind();

  if (kind === "redis") {
    const raw = await redisCommand<string[]>([
      "ZRANGEBYSCORE",
      REDIS_KEY,
      sinceTs,
      "+inf",
    ]);
    return (raw ?? [])
      .map((item) => safeParse(item))
      .filter((e): e is CoffeeEntry => e !== null)
      .sort((a, b) => a.ts - b.ts);
  }

  if (kind === "file") {
    const all = await readFile();
    return all.filter((e) => e.ts >= sinceTs).sort((a, b) => a.ts - b.ts);
  }

  return [];
}

export async function addEntry(entry: CoffeeEntry): Promise<void> {
  const kind = storageKind();

  if (kind === "redis") {
    await redisCommand(["ZADD", REDIS_KEY, entry.ts, JSON.stringify(entry)]);
    // mantém apenas o último ano de histórico
    await redisCommand([
      "ZREMRANGEBYSCORE",
      REDIS_KEY,
      "-inf",
      entry.ts - ONE_YEAR,
    ]).catch(() => undefined);
    return;
  }

  if (kind === "file") {
    const all = await readFile();
    all.push(entry);
    const cutoff = Date.now() - ONE_YEAR;
    await writeFile(
      all.filter((e) => e.ts >= cutoff).sort((a, b) => a.ts - b.ts),
    );
  }
}

export async function removeEntry(id: string): Promise<boolean> {
  const kind = storageKind();

  if (kind === "redis") {
    const raw = await redisCommand<string[]>(["ZRANGE", REDIS_KEY, 0, -1]);
    const member = (raw ?? []).find((item) => safeParse(item)?.id === id);
    if (!member) return false;
    await redisCommand(["ZREM", REDIS_KEY, member]);
    return true;
  }

  if (kind === "file") {
    const all = await readFile();
    const next = all.filter((e) => e.id !== id);
    if (next.length === all.length) return false;
    await writeFile(next);
    return true;
  }

  return false;
}

function safeParse(value: string): CoffeeEntry | null {
  try {
    const parsed = JSON.parse(value) as CoffeeEntry;
    if (typeof parsed?.ts !== "number" || typeof parsed?.id !== "string") {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}
