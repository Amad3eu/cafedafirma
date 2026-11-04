"use client";

import { MIN_RATINGS_FOR_RANKING } from "@/lib/constants";
import { formatRating, type BaristaScore, type PeriodScore } from "@/lib/stats";
import { StarIcon, TrophyIcon } from "./Icons";

const MEDALS = ["🥇", "🥈", "🥉"];

type Props = {
  days: number;
  baristas: BaristaScore[];
  brewers: [string, number][];
  periods: PeriodScore[];
};

/**
 * Três leituras do mesmo histórico: quem faz o melhor café (nota), quem mais
 * faz café (volume) e em que período do dia o café sai melhor.
 */
export default function RankingCard({ days, baristas, brewers, periods }: Props) {
  const maxBrews = Math.max(1, ...brewers.map(([, total]) => total));
  const ratedPeriods = periods.filter((p) => p.ratings > 0);
  const bestPeriod =
    ratedPeriods.length > 0
      ? ratedPeriods.reduce((best, p) => ((p.avg ?? 0) > (best.avg ?? 0) ? p : best))
      : null;

  return (
    <section className="rounded-2xl border border-latte/70 bg-card/70 p-4">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-espresso">
          <TrophyIcon size={15} className="text-caramel" />
          Ranking da firma
        </h2>
        <span className="text-[11px] text-muted">últimos {days} dias</span>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {/* melhor café */}
        <div>
          <p className="text-[10px] font-medium tracking-wide text-muted uppercase">
            quem faz o melhor café
          </p>
          {baristas.length === 0 ? (
            <p className="mt-1.5 text-xs text-muted">
              Aparece aqui quem tiver pelo menos {MIN_RATINGS_FOR_RANKING} xícaras
              avaliadas das suas feitas.
            </p>
          ) : (
            <ol className="mt-1.5 space-y-1.5">
              {baristas.slice(0, 5).map((score, index) => (
                <li
                  key={score.who}
                  className="flex items-center gap-2 rounded-lg bg-cream/60 px-2 py-1.5 text-xs"
                >
                  <span className="w-5 text-center" aria-hidden>
                    {MEDALS[index] ?? `${index + 1}.`}
                  </span>
                  <span className="min-w-0 flex-1 truncate font-medium text-espresso">
                    {score.who}
                  </span>
                  <span className="inline-flex items-center gap-1 font-mono tabular-nums text-espresso">
                    <StarIcon size={11} filled className="text-amber-500" />
                    {formatRating(score.avg)}
                  </span>
                  <span className="w-14 text-right text-[10px] text-muted">
                    {score.ratings} {score.ratings === 1 ? "nota" : "notas"}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </div>

        {/* mais feitas */}
        <div>
          <p className="text-[10px] font-medium tracking-wide text-muted uppercase">
            quem mais fez café
          </p>
          {brewers.length === 0 ? (
            <p className="mt-1.5 text-xs text-muted">Sem feitas com nome no período.</p>
          ) : (
            <ol className="mt-1.5 space-y-1.5">
              {brewers.slice(0, 5).map(([who, total]) => (
                <li key={who} className="text-xs">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="min-w-0 truncate font-medium text-espresso">{who}</span>
                    <span className="font-mono tabular-nums text-mocha">
                      {total} {total === 1 ? "feita" : "feitas"}
                    </span>
                  </div>
                  <div className="mt-0.5 h-1.5 overflow-hidden rounded-full bg-cream-deep">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-mocha/70 to-caramel"
                      style={{ width: `${Math.max(6, (total / maxBrews) * 100)}%` }}
                    />
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>

        {/* por período */}
        <div>
          <p className="text-[10px] font-medium tracking-wide text-muted uppercase">
            café por período do dia
          </p>
          <table className="mt-1.5 w-full text-xs">
            <thead className="sr-only">
              <tr>
                <th>período</th>
                <th>feitas</th>
                <th>xícaras</th>
                <th>nota</th>
              </tr>
            </thead>
            <tbody>
              {periods.map((p) => {
                const isBest = bestPeriod?.period === p.period && p.ratings > 0;
                return (
                  <tr key={p.period} className="border-t border-latte/50 first:border-0">
                    <td className="py-1.5 capitalize text-espresso">
                      {p.period}
                      {isBest ? (
                        <span className="ml-1 rounded-full bg-emerald-600/10 px-1.5 py-0.5 text-[9px] font-semibold tracking-wide text-emerald-800 uppercase">
                          melhor
                        </span>
                      ) : null}
                    </td>
                    <td className="py-1.5 text-right font-mono tabular-nums text-mocha">
                      {p.brews}
                      <span className="ml-0.5 text-[9px] text-muted">f</span>
                    </td>
                    <td className="py-1.5 text-right font-mono tabular-nums text-mocha">
                      {p.cups}
                      <span className="ml-0.5 text-[9px] text-muted">x</span>
                    </td>
                    <td className="py-1.5 text-right">
                      <span className="inline-flex items-center gap-1 font-mono tabular-nums text-espresso">
                        {p.ratings > 0 ? (
                          <StarIcon size={10} filled className="text-amber-500" />
                        ) : null}
                        {formatRating(p.avg)}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="mt-1.5 text-[10px] text-muted">
            f = feitas · x = xícaras · nota pela hora em que o café foi passado
          </p>
        </div>
      </div>
    </section>
  );
}
