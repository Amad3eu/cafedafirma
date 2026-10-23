"use client";

import { useState } from "react";
import { CloseIcon } from "./Icons";
import type { CoffeeEntry } from "@/lib/types";
import { formatTime } from "@/lib/format";

export type DayGroup = {
  key: string;
  label: string;
  weekDay: string;
  count: number;
  entries: CoffeeEntry[];
};

export default function HistoryList({
  groups,
  onDelete,
}: {
  groups: DayGroup[];
  onDelete: (entry: CoffeeEntry) => void;
}) {
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? groups : groups.slice(0, 8);
  const max = Math.max(1, ...groups.map((g) => g.count));

  if (groups.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-muted">
        O histórico aparece aqui assim que o primeiro café for registrado.
      </p>
    );
  }

  return (
    <div>
      <ul className="scrollarea flex max-h-[420px] flex-col gap-1.5 overflow-y-auto pr-1">
        {visible.map((group) => (
          <li
            key={group.key}
            className="rounded-xl border border-transparent px-2 py-2 transition hover:border-latte/70 hover:bg-cream/50"
          >
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
              <div className="flex w-[92px] shrink-0 items-baseline gap-2">
                <span className="font-mono text-sm font-semibold tabular-nums">
                  {group.label}
                </span>
                <span className="text-[10px] text-muted">{group.weekDay}</span>
              </div>

              <div className="hidden h-1.5 w-20 shrink-0 overflow-hidden rounded-full bg-cream-deep sm:block">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-mocha/70 to-caramel"
                  style={{ width: `${Math.max(6, (group.count / max) * 100)}%` }}
                />
              </div>

              <span className="w-14 shrink-0 text-[11px] font-medium text-mocha">
                {group.count} café{group.count === 1 ? "" : "s"}
              </span>

              <div className="flex flex-1 flex-wrap gap-1">
                {group.entries.map((entry) => (
                  <span
                    key={entry.id}
                    className="group inline-flex items-center gap-1 rounded-md bg-cream-deep/70 py-0.5 pr-0.5 pl-1.5 text-[11px] text-espresso-soft"
                    title={entry.who ? `Registrado por ${entry.who}` : undefined}
                  >
                    <span className="font-mono tabular-nums">
                      {formatTime(entry.ts)}
                    </span>
                    <button
                      type="button"
                      onClick={() => onDelete(entry)}
                      className="flex items-center rounded px-1 py-0.5 text-muted/50 transition hover:bg-white hover:text-caramel-deep"
                      aria-label={`Remover registro das ${formatTime(entry.ts)}`}
                    >
                      <CloseIcon size={11} />
                    </button>
                  </span>
                ))}
              </div>
            </div>
          </li>
        ))}
      </ul>

      {groups.length > 8 ? (
        <button
          type="button"
          onClick={() => setShowAll((v) => !v)}
          className="mt-3 w-full rounded-lg border border-latte/70 py-2 text-xs font-medium text-mocha transition hover:border-caramel/60 hover:bg-cream"
        >
          {showAll
            ? "Mostrar menos"
            : `Ver os ${groups.length} dias registrados`}
        </button>
      ) : null}
    </div>
  );
}
