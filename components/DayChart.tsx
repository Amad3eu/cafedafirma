"use client";

export type DayPoint = {
  key: string;
  label: string;
  value: number;
  isToday: boolean;
  weekDay: string;
};

export default function DayChart({ data }: { data: DayPoint[] }) {
  const max = Math.max(1, ...data.map((d) => d.value));

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-1 items-end gap-[3px] sm:gap-1.5">
        {data.map((d, index) => {
          const pct = (d.value / max) * 100;
          // no mobile mostramos o rótulo de 2 em 2 para não encavalar
          const showOnMobile = index % 2 === 0 || d.isToday;
          return (
            <div
              key={d.key}
              className="group flex h-full flex-1 flex-col items-center justify-end gap-1"
              title={`${d.weekDay} ${d.label}: ${d.value} café(s)`}
            >
              <span
                className={`font-mono text-[10px] tabular-nums transition ${
                  d.value > 0
                    ? "text-mocha"
                    : "text-transparent group-hover:text-muted"
                }`}
              >
                {d.value > 0 ? d.value : "0"}
              </span>
              <div className="flex h-[104px] w-full items-end">
                <div
                  className={`w-full rounded-t-[5px] transition-all duration-500 ${
                    d.value === 0
                      ? "bg-latte/60"
                      : d.isToday
                        ? "bg-gradient-to-t from-caramel-deep to-caramel shadow-[0_0_0_1px_rgba(180,105,58,0.4)]"
                        : "bg-gradient-to-t from-mocha/70 to-latte group-hover:from-mocha group-hover:to-caramel/60"
                  }`}
                  style={{ height: `${d.value === 0 ? 3 : Math.max(8, pct)}%` }}
                />
              </div>
              <span
                className={`text-[9px] leading-tight whitespace-nowrap sm:text-[10px] ${
                  d.isToday ? "font-semibold text-caramel-deep" : "text-muted"
                } ${showOnMobile ? "" : "hidden sm:inline"}`}
              >
                {d.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
