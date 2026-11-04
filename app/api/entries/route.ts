import {
  addEntry,
  listEntries,
  listEntriesAndCups,
  removeEntry,
  storageKind,
} from "@/lib/store";
import {
  clampTimestamp,
  cleanText,
  json,
  parseDays,
  preflight,
  readJson,
} from "@/lib/api";
import { DAY } from "@/lib/constants";
import type { CoffeeEntry, EntriesResponse } from "@/lib/types";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function OPTIONS() {
  return preflight();
}

/**
 * GET /api/entries?days=60[&cups=1]
 * Histórico de feitas dos últimos N dias. Com `cups=1` inclui também as
 * xícaras do período, na mesma resposta (uma única leitura no banco).
 */
export async function GET(request: Request) {
  const kind = storageKind();
  const url = new URL(request.url);
  const days = parseDays(url);
  const withCups = url.searchParams.get("cups") === "1";

  if (kind === "none") {
    const body: EntriesResponse = { storage: "none", entries: [], ...(withCups ? { cups: [] } : {}) };
    return json(body);
  }

  try {
    const since = Date.now() - days * DAY;
    if (withCups) {
      const { entries, cups } = await listEntriesAndCups(since);
      const body: EntriesResponse = { storage: kind, entries, cups };
      return json(body);
    }
    const entries = await listEntries(since);
    const body: EntriesResponse = { storage: kind, entries };
    return json(body);
  } catch (error) {
    console.error("[api/entries] GET", error);
    return json({ error: "Falha ao ler o histórico." }, 500);
  }
}

/** POST /api/entries  body: { ts?, who?, note? } */
export async function POST(request: Request) {
  const kind = storageKind();
  if (kind === "none") {
    return json({ storage: "none", entry: null }, 200);
  }

  const payload = await readJson<{ ts?: unknown; who?: unknown; note?: unknown }>(request);
  const who = cleanText(payload.who, 60);
  const note = cleanText(payload.note, 140);

  const entry: CoffeeEntry = {
    id: crypto.randomUUID(),
    ts: clampTimestamp(payload.ts),
    ...(who ? { who } : {}),
    ...(note ? { note } : {}),
  };

  try {
    await addEntry(entry);
    return json({ storage: kind, entry });
  } catch (error) {
    console.error("[api/entries] POST", error);
    return json({ error: "Não foi possível registrar o café." }, 500);
  }
}

/** DELETE /api/entries?id=uuid */
export async function DELETE(request: Request) {
  const kind = storageKind();
  if (kind === "none") {
    return json({ storage: "none", removed: false }, 200);
  }

  const id = new URL(request.url).searchParams.get("id") ?? "";
  if (!id) return json({ error: "Informe o id." }, 400);

  try {
    const removed = await removeEntry(id);
    return json({ storage: kind, removed });
  } catch (error) {
    console.error("[api/entries] DELETE", error);
    return json({ error: "Não foi possível remover." }, 500);
  }
}
