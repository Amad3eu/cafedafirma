/**
 * Agregações puras sobre feitas e xícaras. Sem React, sem fetch, sem Date.now():
 * tudo recebe `now` por parâmetro, o que deixa este módulo testável.
 */
import { BREW_MAX_AGE, DAY, MIN_RATINGS_FOR_RANKING } from "./constants";
import { dayKey, startOfDay } from "./format";
import type { CoffeeEntry, CupEntry, Rating } from "./types";

/* ----------------------------- utilidades ----------------------------- */

export function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

/** "4,2" · "—" quando não há nota */
export function formatRating(avg: number | null | undefined): string {
  if (avg === null || avg === undefined || Number.isNaN(avg)) return "—";
  return avg.toFixed(1).replace(".", ",");
}

export function normalizeName(name: string | undefined | null): string {
  return (name ?? "").trim().toLowerCase();
}

export function sameName(a: string | undefined, b: string | undefined): boolean {
  const na = normalizeName(a);
  return na.length > 0 && na === normalizeName(b);
}

/* ------------------------------ períodos ------------------------------ */

export type DayPeriod = "manhã" | "almoço" | "tarde" | "noite";

export const PERIODS: readonly DayPeriod[] = ["manhã", "almoço", "tarde", "noite"];

/** manhã (<12h) · almoço (12–14h) · tarde (14–18h) · noite (18h em diante) */
export function periodOf(ts: number): DayPeriod {
  const hour = new Date(ts).getHours();
  if (hour < 12) return "manhã";
  if (hour < 14) return "almoço";
  if (hour < 18) return "tarde";
  return "noite";
}

/* ------------------------------- filtros ------------------------------ */

export function itemsOfDay<T extends { ts: number }>(items: T[], now: number): T[] {
  const key = dayKey(now);
  return items.filter((item) => dayKey(item.ts) === key);
}

export function itemsSince<T extends { ts: number }>(items: T[], since: number): T[] {
  return items.filter((item) => item.ts >= since);
}

export function itemsOf<T extends { who?: string }>(items: T[], name: string): T[] {
  if (!normalizeName(name)) return [];
  return items.filter((item) => sameName(item.who, name));
}

export function latest<T extends { ts: number }>(items: T[]): T | null {
  let best: T | null = null;
  for (const item of items) if (!best || item.ts > best.ts) best = item;
  return best;
}

/** Contagem por pessoa, maior primeiro. */
export function countBy<T extends { who?: string }>(
  items: T[],
  fallback = "sem nome",
): [string, number][] {
  const map = new Map<string, number>();
  for (const item of items) {
    const key = item.who?.trim() || fallback;
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  return [...map.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

/** Contagem por dia para os últimos `days` dias (inclui dias zerados). */
export function dailyCounts<T extends { ts: number }>(
  items: T[],
  days: number,
  now: number,
): { key: string; ts: number; value: number }[] {
  const counts = new Map<string, number>();
  for (const item of items) {
    const key = dayKey(item.ts);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const points: { key: string; ts: number; value: number }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const ts = startOfDay(now - i * DAY);
    const key = dayKey(ts);
    points.push({ key, ts, value: counts.get(key) ?? 0 });
  }
  return points;
}

/* ------------------------- feita ativa / xícaras ----------------------- */

/**
 * A feita "ativa" num instante: a última registrada até `at`, desde que não
 * tenha passado de `maxAge`. É a ela que uma xícara tomada em `at` pertence.
 */
export function activeBrewAt(
  entries: CoffeeEntry[],
  at: number,
  maxAge: number = BREW_MAX_AGE,
): CoffeeEntry | null {
  let best: CoffeeEntry | null = null;
  for (const entry of entries) {
    if (entry.ts > at) continue;
    if (at - entry.ts > maxAge) continue;
    if (!best || entry.ts > best.ts) best = entry;
  }
  return best;
}

export type BrewStats = {
  /** xícaras que saíram desta feita */
  cups: number;
  /** quantas delas foram avaliadas */
  ratings: number;
  avg: number | null;
};

/** Xícaras e nota média por feita (chave = id da feita). */
export function statsByBrew(cups: CupEntry[]): Map<string, BrewStats> {
  const acc = new Map<string, { cups: number; ratings: number[] }>();
  for (const cup of cups) {
    if (!cup.brewId) continue;
    const slot = acc.get(cup.brewId) ?? { cups: 0, ratings: [] };
    slot.cups += 1;
    if (cup.rating) slot.ratings.push(cup.rating);
    acc.set(cup.brewId, slot);
  }
  const out = new Map<string, BrewStats>();
  for (const [brewId, slot] of acc) {
    out.set(brewId, {
      cups: slot.cups,
      ratings: slot.ratings.length,
      avg: average(slot.ratings),
    });
  }
  return out;
}

/** Nota média de um conjunto de xícaras (ignora as sem nota). */
export function averageRating(cups: CupEntry[]): { avg: number | null; ratings: number } {
  const values = cups.map((cup) => cup.rating).filter((r): r is Rating => !!r);
  return { avg: average(values), ratings: values.length };
}

/** Quantas xícaras receberam cada nota (índice 1..5). */
export function ratingHistogram(cups: CupEntry[]): number[] {
  const hist = [0, 0, 0, 0, 0, 0];
  for (const cup of cups) if (cup.rating) hist[cup.rating] += 1;
  return hist;
}

/* -------------------------------- rankings ---------------------------- */

export type BaristaScore = {
  who: string;
  /** feitas da pessoa no período */
  brews: number;
  /** xícaras avaliadas das feitas da pessoa */
  ratings: number;
  avg: number;
};

/**
 * Quem faz o melhor café: média das notas das xícaras que saíram das feitas de
 * cada pessoa. Só entra quem tem pelo menos `minRatings` avaliações, para uma
 * nota 5 isolada não virar primeiro lugar.
 */
export function baristaRanking(
  entries: CoffeeEntry[],
  cups: CupEntry[],
  minRatings: number = MIN_RATINGS_FOR_RANKING,
): BaristaScore[] {
  const brewerById = new Map<string, string>();
  const brewsByWho = new Map<string, number>();
  for (const entry of entries) {
    const who = entry.who?.trim();
    if (!who) continue;
    brewerById.set(entry.id, who);
    brewsByWho.set(who, (brewsByWho.get(who) ?? 0) + 1);
  }

  const ratingsByWho = new Map<string, number[]>();
  for (const cup of cups) {
    if (!cup.brewId || !cup.rating) continue;
    const who = brewerById.get(cup.brewId);
    if (!who) continue;
    const list = ratingsByWho.get(who) ?? [];
    list.push(cup.rating);
    ratingsByWho.set(who, list);
  }

  const scores: BaristaScore[] = [];
  for (const [who, ratings] of ratingsByWho) {
    if (ratings.length < minRatings) continue;
    scores.push({
      who,
      brews: brewsByWho.get(who) ?? 0,
      ratings: ratings.length,
      avg: average(ratings) ?? 0,
    });
  }
  return scores.sort(
    (a, b) => b.avg - a.avg || b.ratings - a.ratings || a.who.localeCompare(b.who),
  );
}

export type PeriodScore = {
  period: DayPeriod;
  brews: number;
  cups: number;
  ratings: number;
  avg: number | null;
};

/**
 * Como o café fica em cada período do dia, considerando o horário em que a
 * **feita** foi passada (não o da xícara). Responde "o café da tarde é pior?".
 */
export function ratingsByPeriod(entries: CoffeeEntry[], cups: CupEntry[]): PeriodScore[] {
  const periodByBrew = new Map<string, DayPeriod>();
  const brews = new Map<DayPeriod, number>();
  for (const entry of entries) {
    const period = periodOf(entry.ts);
    periodByBrew.set(entry.id, period);
    brews.set(period, (brews.get(period) ?? 0) + 1);
  }

  const cupsBy = new Map<DayPeriod, number>();
  const ratingsBy = new Map<DayPeriod, number[]>();
  for (const cup of cups) {
    const period = cup.brewId ? periodByBrew.get(cup.brewId) : undefined;
    if (!period) continue;
    cupsBy.set(period, (cupsBy.get(period) ?? 0) + 1);
    if (cup.rating) {
      const list = ratingsBy.get(period) ?? [];
      list.push(cup.rating);
      ratingsBy.set(period, list);
    }
  }

  return PERIODS.map((period) => {
    const ratings = ratingsBy.get(period) ?? [];
    return {
      period,
      brews: brews.get(period) ?? 0,
      cups: cupsBy.get(period) ?? 0,
      ratings: ratings.length,
      avg: average(ratings),
    };
  });
}

/** Hora do dia com mais ocorrências (null quando não há dados). */
export function peakHour(items: { ts: number }[]): number | null {
  const counts = new Array<number>(24).fill(0);
  for (const item of items) counts[new Date(item.ts).getHours()] += 1;
  let best: number | null = null;
  for (let hour = 0; hour < 24; hour++) {
    if (counts[hour] > 0 && (best === null || counts[hour] > counts[best])) best = hour;
  }
  return best;
}
