import type { CoffeeEntry, EntriesResponse } from "./types";

export type ClientMode = "shared" | "local";

const LS_ENTRIES = "cafe:entries:v1";
const LS_NAME = "cafe:name:v1";
const LS_SETTINGS = "cafe:settings:v1";

export type Settings = {
  remind: boolean;
  /** intervalo em minutos para o lembrete */
  interval: number;
};

export const DEFAULT_SETTINGS: Settings = { remind: true, interval: 180 };

let cachedMode: ClientMode | null = null;

export function getMode(): ClientMode | null {
  return cachedMode;
}

/* ----------------------------- localStorage ----------------------------- */

function readLocal(): CoffeeEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(LS_ENTRIES);
    const parsed = raw ? (JSON.parse(raw) as CoffeeEntry[]) : [];
    return Array.isArray(parsed)
      ? parsed.filter((e) => typeof e?.ts === "number" && typeof e?.id === "string")
      : [];
  } catch {
    return [];
  }
}

function writeLocal(entries: CoffeeEntry[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(LS_ENTRIES, JSON.stringify(entries));
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
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(settings: Settings): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(LS_SETTINGS, JSON.stringify(settings));
}

/* --------------------------- servidor / offline --------------------------- */

export async function loadEntries(days = 60): Promise<{
  mode: ClientMode;
  entries: CoffeeEntry[];
}> {
  try {
    const res = await fetch(`/api/entries?days=${days}`, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as EntriesResponse;

    if (data.storage === "none") {
      cachedMode = "local";
      return { mode: "local", entries: readLocal() };
    }

    cachedMode = "shared";
    return { mode: "shared", entries: data.entries ?? [] };
  } catch {
    cachedMode = "local";
    return { mode: "local", entries: readLocal() };
  }
}

export async function registerEntry(input: {
  ts?: number;
  who?: string;
  note?: string;
}): Promise<{ mode: ClientMode; entry: CoffeeEntry }> {
  if (cachedMode !== "local") {
    try {
      const res = await fetch("/api/entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as {
        storage: string;
        entry: CoffeeEntry | null;
      };
      if (data.storage === "none" || !data.entry) {
        cachedMode = "local";
      } else {
        cachedMode = "shared";
        return { mode: "shared", entry: data.entry };
      }
    } catch {
      if (cachedMode === "shared") throw new Error("Sem conexão com o servidor.");
      cachedMode = "local";
    }
  }

  // modo local
  const entry: CoffeeEntry = {
    id:
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    ts: input.ts ?? Date.now(),
    ...(input.who ? { who: input.who } : {}),
    ...(input.note ? { note: input.note } : {}),
  };
  const all = readLocal();
  all.push(entry);
  writeLocal(all);
  return { mode: "local", entry };
}

export async function deleteEntry(
  id: string,
  mode: ClientMode,
): Promise<void> {
  if (mode === "local") {
    writeLocal(readLocal().filter((e) => e.id !== id));
    return;
  }
  const res = await fetch(`/api/entries?id=${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error("Não foi possível remover.");
}
