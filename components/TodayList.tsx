"use client";

import type { CoffeeEntry } from "@/lib/types";
import { formatTime, relativeTime } from "@/lib/format";
import { CloseIcon, CupIcon, JarIcon, UserIcon } from "./Icons";

export default function TodayList({
  entries,
  now,
  onDelete,
}: {
  entries: CoffeeEntry[];
  now: number;
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

      {sorted.map((entry, index) => (
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
            <div className="flex items-baseline gap-2">
              <span className="font-mono text-lg leading-none font-semibold tabular-nums">
                {formatTime(entry.ts)}
              </span>
              {index === 0 ? (
                <span className="rounded-full bg-caramel/15 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-caramel-deep uppercase">
                  última
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
      ))}
    </div>
  );
}
