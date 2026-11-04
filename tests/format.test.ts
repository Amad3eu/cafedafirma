import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  dayKey,
  durationLabel,
  formatDayLabel,
  formatShortDate,
  formatTime,
  relativeTime,
  startOfDay,
} from "../lib/format";

const at = (y: number, m: number, d: number, h = 0, min = 0) =>
  new Date(y, m - 1, d, h, min, 0, 0).getTime();

describe("format", () => {
  it("dayKey usa o fuso local e zero à esquerda", () => {
    assert.equal(dayKey(at(2026, 3, 7, 23, 59)), "2026-03-07");
    assert.equal(dayKey(at(2026, 12, 25)), "2026-12-25");
  });

  it("startOfDay zera horas/minutos", () => {
    const ts = at(2026, 10, 30, 15, 42);
    assert.equal(startOfDay(ts), at(2026, 10, 30));
  });

  it("formatTime / formatShortDate", () => {
    assert.equal(formatTime(at(2026, 1, 2, 8, 5)), "08:05");
    assert.equal(formatShortDate(at(2026, 1, 2)), "02/01");
  });

  it("relativeTime descreve minutos, horas, dias e meses", () => {
    const now = at(2026, 10, 30, 12, 0);
    assert.equal(relativeTime(now, now), "agora");
    assert.equal(relativeTime(now - 5 * 60_000, now), "há 5 min");
    assert.equal(relativeTime(now - 60 * 60_000, now), "há 1 h");
    assert.equal(relativeTime(now - 125 * 60_000, now), "há 2 h 5 min");
    assert.equal(relativeTime(now - 25 * 3_600_000, now), "ontem");
    assert.equal(relativeTime(now - 3 * 86_400_000, now), "há 3 dias");
    assert.equal(relativeTime(now - 40 * 86_400_000, now), "há 1 mês");
    assert.equal(relativeTime(now + 60_000, now), "agora", "futuro nunca fica negativo");
  });

  it("formatDayLabel: hoje, ontem, dd/mm", () => {
    const now = at(2026, 10, 30, 10, 0);
    assert.equal(formatDayLabel("2026-10-30", now), "hoje");
    assert.equal(formatDayLabel("2026-10-29", now), "ontem");
    assert.equal(formatDayLabel("2026-10-01", now), "01/10");
  });

  it("durationLabel", () => {
    assert.equal(durationLabel(45), "45 min");
    assert.equal(durationLabel(60), "1h");
    assert.equal(durationLabel(125), "2h05");
  });
});
