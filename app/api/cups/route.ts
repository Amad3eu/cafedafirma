import { addCup, listCups, listEntries, removeCup, storageKind, updateCup } from "@/lib/store";
import {
  clampTimestamp,
  cleanText,
  json,
  parseDays,
  preflight,
  readJson,
} from "@/lib/api";
import { BREW_MAX_AGE, DAY } from "@/lib/constants";
import { activeBrewAt } from "@/lib/stats";
import { isRating, type CupEntry, type CupsResponse } from "@/lib/types";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function OPTIONS() {
  return preflight();
}

/** GET /api/cups?days=60 -> xícaras dos últimos N dias */
export async function GET(request: Request) {
  const kind = storageKind();
  const days = parseDays(new URL(request.url));

  if (kind === "none") {
    const body: CupsResponse = { storage: "none", cups: [] };
    return json(body);
  }

  try {
    const cups = await listCups(Date.now() - days * DAY);
    const body: CupsResponse = { storage: kind, cups };
    return json(body);
  } catch (error) {
    console.error("[api/cups] GET", error);
    return json({ error: "Falha ao ler as xícaras." }, 500);
  }
}

/**
 * POST /api/cups  body: { ts?, who?, rating?, brewId?, note? }
 * Registra uma xícara. Sem `brewId`, a API associa à última feita registrada
 * até `ts` (dentro de 12 h) — é "o café daquele período".
 */
export async function POST(request: Request) {
  const kind = storageKind();
  if (kind === "none") {
    return json({ storage: "none", cup: null }, 200);
  }

  const payload = await readJson<{
    ts?: unknown;
    who?: unknown;
    rating?: unknown;
    brewId?: unknown;
    note?: unknown;
  }>(request);

  const ts = clampTimestamp(payload.ts);
  const who = cleanText(payload.who, 60);
  const note = cleanText(payload.note, 140);
  const rating = isRating(payload.rating) ? payload.rating : undefined;
  let brewId = cleanText(payload.brewId, 80);

  try {
    if (!brewId) {
      const recent = await listEntries(ts - BREW_MAX_AGE);
      brewId = activeBrewAt(recent, ts)?.id;
    }

    const cup: CupEntry = {
      id: crypto.randomUUID(),
      ts,
      ...(who ? { who } : {}),
      ...(brewId ? { brewId } : {}),
      ...(rating ? { rating } : {}),
      ...(note ? { note } : {}),
    };

    await addCup(cup);
    return json({ storage: kind, cup });
  } catch (error) {
    console.error("[api/cups] POST", error);
    return json({ error: "Não foi possível registrar a xícara." }, 500);
  }
}

/** PATCH /api/cups?id=uuid  body: { rating?: 1..5 | null, note?: string | null } */
export async function PATCH(request: Request) {
  const kind = storageKind();
  if (kind === "none") {
    return json({ storage: "none", cup: null }, 200);
  }

  const id = new URL(request.url).searchParams.get("id") ?? "";
  if (!id) return json({ error: "Informe o id." }, 400);

  const payload = await readJson<{ rating?: unknown; note?: unknown }>(request);
  const patch: Partial<Omit<CupEntry, "id" | "ts">> = {};

  if ("rating" in payload) {
    if (payload.rating === null) patch.rating = undefined;
    else if (isRating(payload.rating)) patch.rating = payload.rating;
    else return json({ error: "Nota deve ser um inteiro de 1 a 5 (ou null)." }, 400);
  }
  if ("note" in payload) {
    patch.note = payload.note === null ? undefined : cleanText(payload.note, 140);
  }
  if (Object.keys(patch).length === 0) {
    return json({ error: "Nada para atualizar." }, 400);
  }

  try {
    const cup = await updateCup(id, patch);
    if (!cup) return json({ error: "Xícara não encontrada." }, 404);
    return json({ storage: kind, cup });
  } catch (error) {
    console.error("[api/cups] PATCH", error);
    return json({ error: "Não foi possível atualizar a xícara." }, 500);
  }
}

/** DELETE /api/cups?id=uuid */
export async function DELETE(request: Request) {
  const kind = storageKind();
  if (kind === "none") {
    return json({ storage: "none", removed: false }, 200);
  }

  const id = new URL(request.url).searchParams.get("id") ?? "";
  if (!id) return json({ error: "Informe o id." }, 400);

  try {
    const removed = await removeCup(id);
    return json({ storage: kind, removed });
  } catch (error) {
    console.error("[api/cups] DELETE", error);
    return json({ error: "Não foi possível remover." }, 500);
  }
}
