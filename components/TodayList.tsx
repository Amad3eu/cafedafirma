"use client";

import type { CoffeeEntry } from "@/lib/types";
import { formatTime, relativeTime } from "@/lib/format";
import { formatRating, type BrewStats } from "@/lib/stats";
import { CloseIcon, CupIcon, JarIcon, MugIcon, StarIcon, UserIcon } from "./Icons";

export default function TodayList({
  entries,
  now,
  brewStats,
  onDelete,
}: {
  entries: CoffeeEntry[];
  now: number;
  brewStats?: Map<string, BrewStats>;
  onDelete: (entry: CoffeeEntry) => void;
}) {
  const sorted = [...entries].sort((a, b) => b.ts - a.ts);

  return (
    <div className="flex flex-col gap-2">
      {sorted.length === 0 ? (
        <div className="rounded-xl border border-dashed border-latte bg-cream-deep/40 px-4 py-8 text-center">
          <JarIcon size={30} className="mx-auto text-caramel/70" />
          <p className="mt-2 text-sm font-medium text-mocha">
            Nenhuma feita registrada hoje
          </p>
          <p className="mt-1 text-xs text-muted">
            Comece o dia clicando em “Registrar café agora”.
          </p>
        </div>
      ) : null}

      {sorted.map((entry, index) => {
        const stats = brewStats?.get(entry.id);
        return (
          <div
            key={entry.id}
            className="group flex items-center gap-3 rounded-xl border border-latte/60 bg-card px-3 py-2.5 transition hover:border-caramel/50 hover:bg-cream/60"
          >
            <span
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                index === 0
                  ? "bg-caramel text-white shadow-sm"
                  : "bg-cream-deep text-mocha"
              }`}
            >
              <CupIcon size={17} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                <span className="font-mono text-lg leading-none font-semibold tabular-nums">
                  {formatTime(entry.ts)}
                </span>
                {index === 0 ? (
                  <span className="rounded-full bg-caramel/15 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-caramel-deep uppercase">
                    última
                  </span>
                ) : null}
                {stats && stats.cups > 0 ? (
                  <span
                    className="inline-flex items-center gap-1 text-[11px] text-mocha"
                    title={`${stats.cups} xícara(s) desta feita${
                      stats.ratings > 0 ? ` · ${stats.ratings} avaliada(s)` : ""
                    }`}
                  >
                    <MugIcon size={11} className="text-cups" />
                    {stats.cups}
                    {stats.avg !== null ? (
                      <>
                        <span aria-hidden>·</span>
                        <StarIcon size={11} filled className="text-amber-500" />
                        <span className="font-mono tabular-nums">{formatRating(stats.avg)}</span>
                      </>
                    ) : null}
                  </span>
                ) : null}
              </div>
              <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-muted">
                <span>{relativeTime(entry.ts, now)}</span>
                {entry.who ? (
                  <>
                    <span aria-hidden>·</span>
                    <UserIcon size={11} className="shrink-0" />
                    <span className="truncate">{entry.who}</span>
                  </>
                ) : null}
              </p>
            </div>
            <button
              type="button"
              onClick={() => onDelete(entry)}
              className="rounded-lg p-1.5 text-transparent transition group-hover:text-muted hover:bg-cream-deep hover:text-caramel-deep focus-visible:text-muted"
              title="Remover este registro"
              aria-label={`Remover registro das ${formatTime(entry.ts)}`}
            >
              <CloseIcon />
            </button>
          </div>
        );
      })}
    </div>
  );
}
