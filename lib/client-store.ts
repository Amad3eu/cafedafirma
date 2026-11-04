import type { CoffeeEntry, CupEntry, EntriesResponse, Rating } from "./types";

export type ClientMode = "shared" | "local";

const LS_ENTRIES = "cafe:entries:v1";
const LS_CUPS = "cafe:cups:v1";
const LS_NAME = "cafe:name:v1";
const LS_SETTINGS = "cafe:settings:v1";

export type Settings = {
  remind: boolean;
  /** intervalo em minutos para o lembrete */
  interval: number;
  /** meta pessoal de xícaras por dia (0 = sem meta) */
  cupGoal: number;
};

export const DEFAULT_SETTINGS: Settings = { remind: true, interval: 180, cupGoal: 4 };

let cachedMode: ClientMode | null = null;

export function getMode(): ClientMode | null {
  return cachedMode;
}

/* ----------------------------- localStorage ----------------------------- */

function readList<T extends { id: string; ts: number }>(key: string): T[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(key);
    const parsed = raw ? (JSON.parse(raw) as T[]) : [];
    return Array.isArray(parsed)
      ? parsed.filter((e) => typeof e?.ts === "number" && typeof e?.id === "string")
      : [];
  } catch {
    return [];
  }
}

function writeList<T>(key: string, items: T[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(items));
}

const readLocal = () => readList<CoffeeEntry>(LS_ENTRIES);
const writeLocal = (entries: CoffeeEntry[]) => writeList(LS_ENTRIES, entries);
const readLocalCups = () => readList<CupEntry>(LS_CUPS);
const writeLocalCups = (cups: CupEntry[]) => writeList(LS_CUPS, cups);

function newId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function loadName(): string {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(LS_NAME) ?? "";
}

export function saveName(name: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(LS_NAME, name);
}

export function loadSettings(): Settings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw = window.localStorage.getItem(LS_SETTINGS);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<Settings>;
    return {
      remind: typeof parsed.remind === "boolean" ? parsed.remind : true,
      interval:
        typeof parsed.interval === "number" && parsed.interval >= 15
          ? parsed.interval
          : DEFAULT_SETTINGS.interval,
      cupGoal:
        typeof parsed.cupGoal === "number" && parsed.cupGoal >= 0 && parsed.cupGoal <= 20
          ? Math.trunc(parsed.cupGoal)
          : DEFAULT_SETTINGS.cupGoal,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(settings: Settings): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(LS_SETTINGS, JSON.stringify(settings));
}

/* ------------------- migração do modo local para o banco ------------------- */

/** Cafés que ficaram salvos apenas neste navegador (modo local anterior). */
export function readLocalEntries(): CoffeeEntry[] {
  return readLocal();
}

/** Xícaras que ficaram salvas apenas neste navegador. */
export function readLocalCupEntries(): CupEntry[] {
  return readLocalCups();
}

/** Apaga o histórico local (depois de importar ou descartar). */
export function clearLocalEntries(): void {
  writeLocal([]);
  writeLocalCups([]);
}

/* --------------------------- servidor / offline --------------------------- */

type Snapshot = { mode: ClientMode; entries: CoffeeEntry[]; cups: CupEntry[] };

function localSnapshot(): Snapshot {
  cachedMode = "local";
  return { mode: "local", entries: readLocal(), cups: readLocalCups() };
}

/** Uma única requisição traz feitas e xícaras. */
export async function loadEntries(days = 60): Promise<Snapshot> {
  try {
    const res = await fetch(`/api/entries?days=${days}&cups=1`, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as EntriesResponse;

    if (data.storage === "none") return localSnapshot();

    cachedMode = "shared";
    return { mode: "shared", entries: data.entries ?? [], cups: data.cups ?? [] };
  } catch {
    return localSnapshot();
  }
}

/**
 * Tenta gravar no servidor; se o site está sem banco, cai para o localStorage.
 * Se já estávamos em modo compartilhado e a rede falhou, propaga o erro — não
 * faz sentido "salvar local" um registro que a equipe nunca verá.
 */
async function postShared<T>(
  url: string,
  body: unknown,
  pick: (data: Record<string, unknown>) => T | null,
): Promise<T | null> {
  if (cachedMode === "local") return null;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as Record<string, unknown>;
    const item = data.storage === "none" ? null : pick(data);
    if (item) {
      cachedMode = "shared";
      return item;
    }
    cachedMode = "local";
    return null;
  } catch {
    if (cachedMode === "shared") throw new Error("Sem conexão com o servidor.");
    cachedMode = "local";
    return null;
  }
}

export async function registerEntry(input: {
  ts?: number;
  who?: string;
  note?: string;
}): Promise<{ mode: ClientMode; entry: CoffeeEntry }> {
  const shared = await postShared<CoffeeEntry>("/api/entries", input, (data) =>
    (data.entry as CoffeeEntry | null) ?? null,
  );
  if (shared) return { mode: "shared", entry: shared };

  const entry: CoffeeEntry = {
    id: newId(),
    ts: input.ts ?? Date.now(),
    ...(input.who ? { who: input.who } : {}),
    ...(input.note ? { note: input.note } : {}),
  };
  const all = readLocal();
  all.push(entry);
  writeLocal(all);
  return { mode: "local", entry };
}

export async function deleteEntry(id: string, mode: ClientMode): Promise<void> {
  if (mode === "local") {
    writeLocal(readLocal().filter((e) => e.id !== id));
    return;
  }
  const res = await fetch(`/api/entries?id=${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error("Não foi possível remover.");
}

/* -------------------------------- xícaras -------------------------------- */

export async function registerCup(input: {
  ts?: number;
  who?: string;
  brewId?: string;
  rating?: Rating;
}): Promise<{ mode: ClientMode; cup: CupEntry }> {
  const shared = await postShared<CupEntry>("/api/cups", input, (data) =>
    (data.cup as CupEntry | null) ?? null,
  );
  if (shared) return { mode: "shared", cup: shared };

  const cup: CupEntry = {
    id: newId(),
    ts: input.ts ?? Date.now(),
    ...(input.who ? { who: input.who } : {}),
    ...(input.brewId ? { brewId: input.brewId } : {}),
    ...(input.rating ? { rating: input.rating } : {}),
  };
  const all = readLocalCups();
  all.push(cup);
  writeLocalCups(all);
  return { mode: "local", cup };
}

/** Define (ou remove, com `null`) a nota de uma xícara. */
export async function rateCup(
  id: string,
  rating: Rating | null,
  mode: ClientMode,
): Promise<CupEntry | null> {
  if (mode === "local") {
    const all = readLocalCups();
    const index = all.findIndex((cup) => cup.id === id);
    if (index === -1) return null;
    const next = { ...all[index] };
    if (rating) next.rating = rating;
    else delete next.rating;
    all[index] = next;
    writeLocalCups(all);
    return next;
  }
  const res = await fetch(`/api/cups?id=${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ rating }),
  });
  if (!res.ok) throw new Error("Não foi possível salvar a nota.");
  const data = (await res.json()) as { cup?: CupEntry | null };
  return data.cup ?? null;
}

export async function deleteCup(id: string, mode: ClientMode): Promise<void> {
  if (mode === "local") {
    writeLocalCups(readLocalCups().filter((cup) => cup.id !== id));
    return;
  }
  const res = await fetch(`/api/cups?id=${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error("Não foi possível remover.");
}
