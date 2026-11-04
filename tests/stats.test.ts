import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  activeBrewAt,
  average,
  averageRating,
  baristaRanking,
  countBy,
  dailyCounts,
  formatRating,
  itemsOf,
  itemsOfDay,
  latest,
  peakHour,
  periodOf,
  ratingHistogram,
  ratingsByPeriod,
  statsByBrew,
} from "../lib/stats";
import type { CoffeeEntry, CupEntry } from "../lib/types";

const at = (y: number, m: number, d: number, h = 0, min = 0) =>
  new Date(y, m - 1, d, h, min, 0, 0).getTime();

const brew = (id: string, ts: number, who?: string): CoffeeEntry => ({ id, ts, who });
const cup = (id: string, ts: number, extra: Partial<CupEntry> = {}): CupEntry => ({
  id,
  ts,
  ...extra,
});

describe("stats — utilidades", () => {
  it("average e formatRating", () => {
    assert.equal(average([]), null);
    assert.equal(average([4, 5]), 4.5);
    assert.equal(formatRating(null), "—");
    assert.equal(formatRating(4.25), "4,3");
  });

  it("periodOf divide o dia em manhã/almoço/tarde/noite", () => {
    assert.equal(periodOf(at(2026, 1, 1, 8)), "manhã");
    assert.equal(periodOf(at(2026, 1, 1, 11, 59)), "manhã");
    assert.equal(periodOf(at(2026, 1, 1, 12)), "almoço");
    assert.equal(periodOf(at(2026, 1, 1, 13, 59)), "almoço");
    assert.equal(periodOf(at(2026, 1, 1, 14)), "tarde");
    assert.equal(periodOf(at(2026, 1, 1, 18)), "noite");
  });

  it("itemsOfDay / itemsOf / latest / countBy", () => {
    const now = at(2026, 10, 30, 16);
    const items = [
      brew("a", at(2026, 10, 30, 8), "Ana"),
      brew("b", at(2026, 10, 29, 23, 59), "Bruno"),
      brew("c", at(2026, 10, 30, 15), "ana "),
      brew("d", at(2026, 10, 30, 9)),
    ];
    assert.deepEqual(itemsOfDay(items, now).map((i) => i.id), ["a", "c", "d"]);
    assert.deepEqual(itemsOf(items, "ANA").map((i) => i.id), ["a", "c"], "nome é case-insensitive");
    assert.deepEqual(itemsOf(items, "  "), [], "sem nome não casa com nada");
    assert.equal(latest(items)?.id, "c");
    const counted = countBy([...items, brew("e", at(2026, 10, 30, 10), "Bruno")]);
    assert.deepEqual(counted[0], ["Bruno", 2], "maior contagem primeiro");
    assert.deepEqual(
      counted.slice(1).map(([, n]) => n),
      [1, 1, 1],
    );
    assert.ok(counted.some(([who]) => who === "sem nome"), "sem `who` vira 'sem nome'");
  });

  it("dailyCounts preenche dias sem registros", () => {
    const now = at(2026, 10, 30, 12);
    const items = [brew("a", at(2026, 10, 30, 8)), brew("b", at(2026, 10, 28, 8)), brew("c", at(2026, 10, 28, 9))];
    const points = dailyCounts(items, 3, now);
    assert.deepEqual(
      points.map((p) => [p.key, p.value]),
      [
        ["2026-10-28", 2],
        ["2026-10-29", 0],
        ["2026-10-30", 1],
      ],
    );
  });

  it("peakHour ignora horas vazias", () => {
    assert.equal(peakHour([]), null);
    assert.equal(
      peakHour([brew("a", at(2026, 1, 1, 9)), brew("b", at(2026, 1, 1, 9)), brew("c", at(2026, 1, 1, 15))]),
      9,
    );
  });
});

describe("stats — feita ativa", () => {
  const entries = [
    brew("manha", at(2026, 10, 30, 8, 0), "Ana"),
    brew("tarde", at(2026, 10, 30, 14, 30), "Bruno"),
  ];

  it("escolhe a última feita até o instante", () => {
    assert.equal(activeBrewAt(entries, at(2026, 10, 30, 10))?.id, "manha");
    assert.equal(activeBrewAt(entries, at(2026, 10, 30, 15))?.id, "tarde");
  });

  it("ignora feitas no futuro e feitas velhas demais", () => {
    assert.equal(activeBrewAt(entries, at(2026, 10, 30, 7)), null);
    assert.equal(activeBrewAt(entries, at(2026, 10, 31, 9)), null, "passou de 12 h");
    assert.equal(activeBrewAt(entries, at(2026, 10, 31, 1))?.id, "tarde", "dentro de 12 h");
  });
});

describe("stats — xícaras e notas", () => {
  const entries = [
    brew("a1", at(2026, 10, 30, 8), "Ana"),
    brew("b1", at(2026, 10, 30, 14), "Bruno"),
    brew("a2", at(2026, 10, 29, 9), "Ana"),
    brew("x", at(2026, 10, 29, 16)),
  ];
  const cups = [
    cup("c1", at(2026, 10, 30, 8, 10), { who: "Caio", brewId: "a1", rating: 5 }),
    cup("c2", at(2026, 10, 30, 8, 20), { who: "Dani", brewId: "a1", rating: 4 }),
    cup("c3", at(2026, 10, 30, 8, 30), { who: "Edu", brewId: "a1" }),
    cup("c4", at(2026, 10, 30, 14, 5), { who: "Caio", brewId: "b1", rating: 2 }),
    cup("c5", at(2026, 10, 30, 14, 9), { who: "Dani", brewId: "b1", rating: 3 }),
    cup("c6", at(2026, 10, 29, 9, 30), { who: "Caio", brewId: "a2", rating: 4 }),
    cup("c7", at(2026, 10, 29, 16, 30), { who: "Caio", brewId: "x", rating: 1 }),
    cup("c8", at(2026, 10, 29, 20), { who: "Caio", rating: 5 }),
  ];

  it("statsByBrew conta xícaras e média só das avaliadas", () => {
    const stats = statsByBrew(cups);
    assert.deepEqual(stats.get("a1"), { cups: 3, ratings: 2, avg: 4.5 });
    assert.deepEqual(stats.get("b1"), { cups: 2, ratings: 2, avg: 2.5 });
    assert.equal(stats.has("nope"), false);
  });

  it("averageRating e ratingHistogram", () => {
    assert.deepEqual(averageRating([]), { avg: null, ratings: 0 });
    assert.deepEqual(averageRating(cups.slice(0, 3)), { avg: 4.5, ratings: 2 });
    assert.deepEqual(ratingHistogram(cups), [0, 1, 1, 1, 2, 2]);
  });

  it("baristaRanking exige mínimo de avaliações e ordena por nota", () => {
    assert.deepEqual(baristaRanking(entries, cups, 1), [
      { who: "Ana", brews: 2, ratings: 3, avg: (5 + 4 + 4) / 3 },
      { who: "Bruno", brews: 1, ratings: 2, avg: 2.5 },
    ]);
    assert.deepEqual(
      baristaRanking(entries, cups, 3).map((s) => s.who),
      ["Ana"],
      "Bruno só tem 2 notas",
    );
    assert.deepEqual(baristaRanking(entries, cups).map((s) => s.who), ["Ana"], "padrão = 3");
  });

  it("ratingsByPeriod usa a hora da feita, não da xícara", () => {
    const periods = ratingsByPeriod(entries, cups);
    const manha = periods.find((p) => p.period === "manhã")!;
    const tarde = periods.find((p) => p.period === "tarde")!;
    const noite = periods.find((p) => p.period === "noite")!;
    assert.deepEqual(manha, { period: "manhã", brews: 2, cups: 4, ratings: 3, avg: 13 / 3 });
    // feita das 14h e das 16h são "tarde"; a xícara das 20h sem brewId não entra
    assert.deepEqual(tarde, { period: "tarde", brews: 2, cups: 3, ratings: 3, avg: 2 });
    assert.deepEqual(noite, { period: "noite", brews: 0, cups: 0, ratings: 0, avg: null });
  });
});
