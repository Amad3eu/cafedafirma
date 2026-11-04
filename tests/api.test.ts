import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { MAX_DAYS_QUERY, MAX_PAST_DAYS, clampTimestamp, cleanText, parseDays } from "../lib/api";
import { isRating } from "../lib/types";

const DAY = 86_400_000;

describe("api helpers", () => {
  it("parseDays sanitiza o parâmetro", () => {
    assert.equal(parseDays(new URL("http://x/api?days=7")), 7);
    assert.equal(parseDays(new URL("http://x/api")), 60);
    assert.equal(parseDays(new URL("http://x/api?days=abc")), 60);
    assert.equal(parseDays(new URL("http://x/api?days=0")), 1);
    assert.equal(parseDays(new URL("http://x/api?days=99999")), MAX_DAYS_QUERY);
    assert.equal(parseDays(new URL("http://x/api?days=2.9")), 2);
  });

  it("clampTimestamp limita ao passado permitido e a 1 min no futuro", () => {
    const now = 1_800_000_000_000;
    assert.equal(clampTimestamp(undefined, now), now);
    assert.equal(clampTimestamp("ontem", now), now);
    assert.equal(clampTimestamp(now - DAY, now), now - DAY);
    assert.equal(clampTimestamp(now - 1000 * DAY, now), now - MAX_PAST_DAYS * DAY);
    assert.equal(clampTimestamp(now + DAY, now), now + 60_000);
    assert.equal(clampTimestamp(now + 0.7, now), now);
  });

  it("cleanText apara, limita e descarta vazios", () => {
    assert.equal(cleanText("  Ana  ", 60), "Ana");
    assert.equal(cleanText("   ", 60), undefined);
    assert.equal(cleanText(42, 60), undefined);
    assert.equal(cleanText("abcdef", 3), "abc");
  });

  it("isRating aceita só inteiros de 1 a 5", () => {
    for (const ok of [1, 2, 3, 4, 5]) assert.equal(isRating(ok), true);
    for (const bad of [0, 6, 2.5, "4", null, undefined, NaN]) assert.equal(isRating(bad), false);
  });
});
