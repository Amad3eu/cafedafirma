"use client";

import type { ClientMode } from "@/lib/client-store";
import { formatTime } from "@/lib/format";
import { formatRating, type BrewStats } from "@/lib/stats";
import type { CoffeeEntry, CupEntry, Rating } from "@/lib/types";
import RatingStars from "./RatingStars";
import { CloseIcon, MugIcon, SpinnerIcon, StarIcon, UserIcon } from "./Icons";

const GOAL_OPTIONS = [0, 2, 3, 4, 5, 6, 8];

type Props = {
  name: string;
  mode: ClientMode | null;
  busy: boolean;
  /** suas xícaras de hoje, mais recente primeiro */
  myCups: CupEntry[];
  /** todas as xícaras de hoje */
  teamCups: CupEntry[];
  /** feita que uma xícara tomada agora vai avaliar */
  activeBrew: CoffeeEntry | null;
  brewById: Map<string, CoffeeEntry>;
  brewStats: Map<string, BrewStats>;
  todayRating: { avg: number | null; ratings: number };
  histogram: number[];
  cupGoal: number;
  /** xícara recém-registrada que ainda pede nota */
  promptCupId: string | null;
  /** "Café atual tem 1h40 · nessa idade a nota costuma ser 2,9." */
  freshnessHint?: string | null;
  onDrink: () => void;
  onRate: (cup: CupEntry, rating: Rating | null) => void;
  onRemove: (cup: CupEntry) => void;
  onGoalChange: (goal: number) => void;
};

/**
 * "Tomei um café": consumo pessoal do dia, nota do café que está no bule e o
 * panorama da equipe. É o lado do *bebedor*; o cartão escuro acima é o lado
 * de quem *faz* o café.
 */
export default function CupsCard({
  name,
  mode,
  busy,
  myCups,
  teamCups,
  activeBrew,
  brewById,
  brewStats,
  todayRating,
  histogram,
  cupGoal,
  promptCupId,
  freshnessHint,
  onDrink,
  onRate,
  onRemove,
  onGoalChange,
}: Props) {
  const hasName = name.trim().length > 0;
  const count = myCups.length;
  const overGoal = cupGoal > 0 && count > cupGoal;
  const atGoal = cupGoal > 0 && count === cupGoal;
  const promptCup = promptCupId ? myCups.find((cup) => cup.id === promptCupId) : undefined;
  const promptBrew = promptCup?.brewId ? brewById.get(promptCup.brewId) : undefined;
  const activeStats = activeBrew ? brewStats.get(activeBrew.id) : undefined;
  const teamByWho = countByWho(teamCups);
  const maxHist = Math.max(1, ...histogram.slice(1));

  return (
    <section className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
      {/* --------------------------- você --------------------------- */}
      <div className="rounded-2xl border border-cups/25 bg-gradient-to-br from-card to-sky-50/60 p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-sm font-semibold text-espresso">
              <MugIcon size={16} className="text-cups" />
              Tomei um café
            </h2>
            <p className="mt-0.5 text-xs text-muted">
              Conte suas xícaras do dia e diga como estava o café.
            </p>
          </div>
          <label className="flex items-center gap-1.5 text-[11px] text-muted">
            meta
            <select
              value={cupGoal}
              onChange={(event) => onGoalChange(Number(event.target.value))}
              className="rounded-lg border border-latte bg-card px-1.5 py-1 text-xs text-espresso outline-none focus:border-cups/60"
              title="Meta pessoal de xícaras por dia"
            >
              {GOAL_OPTIONS.map((goal) => (
                <option key={goal} value={goal}>
                  {goal === 0 ? "sem meta" : `${goal}/dia`}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={onDrink}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-2xl bg-cups px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-cups/25 transition hover:brightness-110 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy ? (
              <SpinnerIcon size={16} className="animate-spin" />
            ) : (
              <MugIcon size={16} />
            )}
            Tomei um café
          </button>

          <div className="min-w-[180px] flex-1">
            <div className="flex items-baseline justify-between text-xs">
              <span className="text-mocha">
                {hasName ? (
                  <>
                    <strong className="font-mono text-base text-espresso">{count}</strong>{" "}
                    {count === 1 ? "xícara" : "xícaras"} hoje
                    {cupGoal > 0 ? (
                      <span className="text-muted"> · meta {cupGoal}</span>
                    ) : null}
                  </>
                ) : (
                  <span className="inline-flex items-center gap-1 text-caramel-deep">
                    <UserIcon size={12} /> coloque seu nome para contar as suas
                  </span>
                )}
              </span>
              {overGoal ? (
                <span className="font-medium text-amber-700">acima da meta</span>
              ) : atGoal ? (
                <span className="font-medium text-emerald-700">meta batida</span>
              ) : null}
            </div>
            {cupGoal > 0 ? (
              <div
                className="mt-1.5 flex gap-1"
                role="meter"
                aria-valuemin={0}
                aria-valuemax={cupGoal}
                aria-valuenow={Math.min(count, cupGoal)}
                aria-label="Xícaras de hoje em relação à meta"
              >
                {Array.from({ length: Math.max(cupGoal, count) }, (_, i) => (
                  <span
                    key={i}
                    className={`h-1.5 flex-1 rounded-full ${
                      i < count
                        ? i < cupGoal
                          ? "bg-cups"
                          : "bg-amber-500"
                        : "bg-cups/15"
                    }`}
                  />
                ))}
              </div>
            ) : null}
          </div>
        </div>

        {/* café que está no bule agora */}
        <p className="mt-3 text-[11px] text-muted">
          {activeBrew ? (
            <>
              Café atual: feita das{" "}
              <span className="font-mono text-espresso">{formatTime(activeBrew.ts)}</span>
              {activeBrew.who ? ` por ${activeBrew.who}` : ""}
              {activeStats && activeStats.cups > 0 ? (
                <>
                  {" "}
                  · {activeStats.cups} {activeStats.cups === 1 ? "xícara" : "xícaras"}
                  {activeStats.avg !== null ? (
                    <>
                      {" "}
                      · <StarIcon size={10} filled className="inline text-amber-500" />{" "}
                      {formatRating(activeStats.avg)}
                    </>
                  ) : null}
                </>
              ) : null}
            </>
          ) : (
            "Nenhuma feita recente — a xícara fica sem café associado, mas conta no seu dia."
          )}
          {activeBrew && freshnessHint ? <span className="block text-muted/90">{freshnessHint}</span> : null}
        </p>

        {/* pedido de nota da xícara recém-registrada */}
        {promptCup ? (
          <div className="animate-rise mt-3 flex flex-wrap items-center gap-3 rounded-xl border border-amber-400/40 bg-amber-50/80 px-3 py-2.5">
            <div className="min-w-[160px] flex-1 text-xs text-espresso">
              <strong>Como estava o café?</strong>
              {promptBrew ? (
                <span className="text-mocha">
                  {" "}
                  feita das {formatTime(promptBrew.ts)}
                  {promptBrew.who ? ` por ${promptBrew.who}` : ""}
                </span>
              ) : null}
            </div>
            <RatingStars
              value={promptCup.rating}
              onChange={(rating) => onRate(promptCup, rating)}
              size={22}
              showLabel
            />
          </div>
        ) : null}

        {/* suas xícaras de hoje */}
        {hasName && myCups.length > 0 ? (
          <ul className="mt-3 flex flex-wrap gap-1.5">
            {myCups.map((cup) => {
              const brew = cup.brewId ? brewById.get(cup.brewId) : undefined;
              return (
                <li
                  key={cup.id}
                  className="group inline-flex items-center gap-1.5 rounded-lg border border-latte/70 bg-card px-2 py-1"
                  title={
                    brew
                      ? `Café das ${formatTime(brew.ts)}${brew.who ? ` por ${brew.who}` : ""}`
                      : "Sem feita associada"
                  }
                >
                  <span className="font-mono text-xs tabular-nums text-espresso">
                    {formatTime(cup.ts)}
                  </span>
                  <RatingStars
                    value={cup.rating}
                    onChange={(rating) => onRate(cup, rating)}
                    size={13}
                  />
                  <button
                    type="button"
                    onClick={() => onRemove(cup)}
                    className="rounded p-0.5 text-muted/40 transition hover:bg-cream-deep hover:text-caramel-deep"
                    aria-label={`Remover xícara das ${formatTime(cup.ts)}`}
                  >
                    <CloseIcon size={11} />
                  </button>
                </li>
              );
            })}
          </ul>
        ) : null}

        {mode === "local" ? (
          <p className="mt-3 text-[11px] text-muted">
            Em modo local as xícaras ficam só neste navegador.
          </p>
        ) : null}
      </div>

      {/* -------------------------- equipe -------------------------- */}
      <div className="rounded-2xl border border-latte/70 bg-card/70 p-4">
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-semibold text-espresso">Café de hoje</h2>
          <span className="text-[11px] text-muted">
            {teamCups.length} {teamCups.length === 1 ? "xícara" : "xícaras"} na equipe
          </span>
        </div>

        <div className="mt-3 flex items-end gap-3">
          <div>
            <p className="font-mono text-4xl leading-none font-semibold text-espresso">
              {formatRating(todayRating.avg)}
            </p>
            <p className="mt-1 text-[11px] text-muted">
              {todayRating.ratings === 0
                ? "sem avaliações ainda"
                : `nota média · ${todayRating.ratings} ${
                    todayRating.ratings === 1 ? "avaliação" : "avaliações"
                  }`}
            </p>
          </div>
          <RatingStars
            value={
              todayRating.avg === null
                ? null
                : (Math.round(todayRating.avg) as Rating)
            }
            size={18}
            className="pb-1"
          />
        </div>

        {/* distribuição das notas (1..5) */}
        {todayRating.ratings > 0 ? (
          <ul className="mt-3 space-y-1" aria-label="Distribuição das notas de hoje">
            {[5, 4, 3, 2, 1].map((rating) => (
              <li key={rating} className="flex items-center gap-2 text-[11px] text-muted">
                <span className="w-3 text-right font-mono tabular-nums">{rating}</span>
                <StarIcon size={10} filled className="text-amber-500" />
                <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-cream-deep">
                  <span
                    className="block h-full rounded-full bg-amber-400"
                    style={{ width: `${(histogram[rating] / maxHist) * 100}%` }}
                  />
                </span>
                <span className="w-4 font-mono tabular-nums">{histogram[rating]}</span>
              </li>
            ))}
          </ul>
        ) : null}

        <div className="mt-4">
          <p className="text-[10px] font-medium tracking-wide text-muted uppercase">
            quem tomou
          </p>
          {teamByWho.length === 0 ? (
            <p className="mt-1 text-xs text-muted">ninguém registrou xícara hoje ainda</p>
          ) : (
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {teamByWho.map(([who, total]) => (
                <span
                  key={who}
                  className="inline-flex items-center gap-1 rounded-full bg-cups/10 px-2 py-0.5 text-[11px] text-espresso-soft"
                >
                  {who}
                  <span className="font-mono text-[10px] font-semibold text-cups">{total}</span>
                </span>
              ))}
            </div>
          )}
        </div>

        <p className="mt-3 text-[11px] text-muted">
          Cada xícara é ligada à feita que estava no bule na hora. É assim que
          sabemos se o café daquele período estava bom.
        </p>
      </div>
    </section>
  );
}

function countByWho(cups: CupEntry[]): [string, number][] {
  const map = new Map<string, number>();
  for (const cup of cups) {
    const key = cup.who?.trim() || "sem nome";
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  return [...map.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}
