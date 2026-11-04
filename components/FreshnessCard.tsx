"use client";

import { durationLabel } from "@/lib/format";
import { AGE_BUCKETS, formatRating, type AgeBucket, type FreshnessInsight } from "@/lib/stats";
import { ClockIcon, StarIcon } from "./Icons";

type Props = {
  days: number;
  buckets: AgeBucket[];
  insight: FreshnessInsight | null;
  /** texto sobre o café que está no bule agora (idade e nota típica) */
  currentHint: string | null;
};

/** "Depois de 1h" — limite da faixa anterior à queda. */
export function thresholdLabel(drop: AgeBucket): string | null {
  const index = AGE_BUCKETS.findIndex((b) => b.label === drop.label);
  const previous = index > 0 ? AGE_BUCKETS[index - 1] : null;
  return previous?.maxMinutes ? durationLabel(previous.maxMinutes) : null;
}

export function insightText(insight: FreshnessInsight | null): string {
  if (!insight) {
    return "Ainda faltam avaliações. Dê nota às xícaras e o app descobre a partir de quando o café perde a graça.";
  }
  if (!insight.drop) {
    return `A nota segue estável (${formatRating(insight.fresh.avg)} no café fresco). Café parado não está sendo punido por aqui.`;
  }
  const threshold = thresholdLabel(insight.drop);
  return `${threshold ? `Depois de ${threshold}` : `Em ${insight.drop.label}`} a nota cai de ${formatRating(
    insight.fresh.avg,
  )} para ${formatRating(insight.drop.avg)}. Vale passar outro café antes disso.`;
}

/**
 * Nota média por idade do café na hora da xícara. Uma barra por faixa, numa
 * cor só (é magnitude, não identidade), com o valor ao lado.
 */
export default function FreshnessCard({ days, buckets, insight, currentHint }: Props) {
  const dropLabel = insight?.drop?.label ?? null;

  return (
    <section className="rounded-2xl border border-latte/70 bg-card/70 p-4">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-espresso">
          <ClockIcon size={15} className="text-caramel" />
          Café fresco vale mais?
        </h2>
        <span className="text-[11px] text-muted">nota × idade · últimos {days} dias</span>
      </div>

      <ul className="space-y-1.5" aria-label="Nota média por idade do café">
        {buckets.map((bucket) => {
          const pct = bucket.avg === null ? 0 : (bucket.avg / 5) * 100;
          const isDrop = bucket.label === dropLabel;
          return (
            <li key={bucket.label} className="grid grid-cols-[88px_1fr_auto] items-center gap-2 text-xs">
              <span className={`truncate ${isDrop ? "font-semibold text-caramel-deep" : "text-mocha"}`}>
                {bucket.label}
              </span>
              <span className="h-2 overflow-hidden rounded-full bg-cream-deep">
                <span
                  className={`block h-full rounded-full ${
                    bucket.avg === null
                      ? ""
                      : isDrop
                        ? "bg-gradient-to-r from-caramel-deep to-caramel"
                        : "bg-gradient-to-r from-mocha/60 to-caramel/80"
                  }`}
                  style={{ width: `${Math.max(bucket.avg === null ? 0 : 6, pct)}%` }}
                />
              </span>
              <span className="inline-flex w-20 items-center justify-end gap-1 font-mono tabular-nums text-espresso">
                {bucket.ratings > 0 ? (
                  <>
                    <StarIcon size={10} filled className="text-amber-500" />
                    {formatRating(bucket.avg)}
                    <span className="text-[10px] text-muted">({bucket.ratings})</span>
                  </>
                ) : (
                  <span className="text-[10px] text-muted">sem notas</span>
                )}
              </span>
            </li>
          );
        })}
      </ul>

      <p className="mt-3 text-xs text-espresso-soft">{insightText(insight)}</p>

      {currentHint ? (
        <p className="mt-2 rounded-lg bg-cream/70 px-2.5 py-1.5 text-[11px] text-mocha">{currentHint}</p>
      ) : null}
    </section>
  );
}
