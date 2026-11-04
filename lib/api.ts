import { NextResponse } from "next/server";
import { DAY } from "./constants";

/** Dias no passado que a API aceita em um registro retroativo. */
export const MAX_PAST_DAYS = 60;
/** Janela máxima de consulta. */
export const MAX_DAYS_QUERY = 400;

export function corsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,PATCH,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Cache-Control": "no-store",
  };
}

export function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: corsHeaders() });
}

export function preflight() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}

/** `?days=N` saneado: inteiro entre 1 e MAX_DAYS_QUERY (padrão 60). */
export function parseDays(url: URL, fallback = 60): number {
  const raw = Number(url.searchParams.get("days") ?? fallback);
  return Number.isFinite(raw)
    ? Math.min(Math.max(Math.trunc(raw), 1), MAX_DAYS_QUERY)
    : fallback;
}

/** Timestamp aceito: entre MAX_PAST_DAYS atrás e 1 minuto no futuro. */
export function clampTimestamp(raw: unknown, now = Date.now()): number {
  const ts = typeof raw === "number" && Number.isFinite(raw) ? Math.trunc(raw) : now;
  const min = now - MAX_PAST_DAYS * DAY;
  return Math.min(Math.max(ts, min), now + 60_000);
}

export function cleanText(raw: unknown, max: number): string | undefined {
  if (typeof raw !== "string") return undefined;
  const text = raw.trim().slice(0, max);
  return text || undefined;
}

export async function readJson<T extends Record<string, unknown>>(request: Request): Promise<T> {
  try {
    const data = (await request.json()) as unknown;
    return data && typeof data === "object" ? (data as T) : ({} as T);
  } catch {
    return {} as T;
  }
}
