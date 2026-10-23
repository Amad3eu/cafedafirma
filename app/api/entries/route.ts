import { NextResponse } from "next/server";
import { addEntry, listEntries, removeEntry, storageKind } from "@/lib/store";
import type { CoffeeEntry, EntriesResponse } from "@/lib/types";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const MAX_PAST_DAYS = 60;
const MAX_DAYS_QUERY = 400;

function corsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Cache-Control": "no-store",
  };
}

function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: corsHeaders() });
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}

/** GET /api/entries?days=60 -> histórico dos últimos N dias */
export async function GET(request: Request) {
  const kind = storageKind();
  const url = new URL(request.url);
  const daysParam = Number(url.searchParams.get("days") ?? 60);
  const days = Number.isFinite(daysParam)
    ? Math.min(Math.max(Math.trunc(daysParam), 1), MAX_DAYS_QUERY)
    : 60;

  if (kind === "none") {
    const body: EntriesResponse = { storage: "none", entries: [] };
    return json(body);
  }

  try {
    const since = Date.now() - days * 24 * 60 * 60 * 1000;
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

  let payload: { ts?: unknown; who?: unknown; note?: unknown } = {};
  try {
    payload = await request.json();
  } catch {
    payload = {};
  }

  const now = Date.now();
  const tsRaw = typeof payload.ts === "number" ? payload.ts : now;
  const minTs = now - MAX_PAST_DAYS * 24 * 60 * 60 * 1000;
  const ts = Math.min(Math.max(Math.trunc(tsRaw), minTs), now + 60_000);

  const who =
    typeof payload.who === "string" ? payload.who.trim().slice(0, 60) : undefined;
  const note =
    typeof payload.note === "string"
      ? payload.note.trim().slice(0, 140)
      : undefined;

  const entry: CoffeeEntry = {
    id: crypto.randomUUID(),
    ts,
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
