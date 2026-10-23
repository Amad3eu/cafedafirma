"use client";

export type HourPoint = { hour: number; value: number };

export default function HourChart({
  data,
  peakHour,
}: {
  data: HourPoint[];
  peakHour: number | null;
}) {
  const max = Math.max(1, ...data.map((d) => d.value));

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-1 items-end gap-[2px] sm:gap-1">
        {data.map((d) => {
          const pct = (d.value / max) * 100;
          const isPeak = peakHour !== null && d.hour === peakHour && d.value > 0;
          return (
            <div
              key={d.hour}
              className="group flex h-full flex-1 flex-col items-center justify-end gap-1"
              title={`${String(d.hour).padStart(2, "0")}h: ${d.value} café(s)`}
            >
              <div className="flex h-[104px] w-full items-end">
                <div
                  className={`w-full rounded-t-[5px] transition-all duration-500 ${
                    d.value === 0
                      ? "bg-latte/50"
                      : isPeak
                        ? "bg-gradient-to-t from-caramel-deep to-caramel"
                        : "bg-gradient-to-t from-mocha/60 to-latte group-hover:to-caramel/60"
                  }`}
                  style={{ height: `${d.value === 0 ? 3 : Math.max(8, pct)}%` }}
                />
              </div>
              <span
                className={`text-[9px] tabular-nums whitespace-nowrap sm:text-[10px] ${
                  isPeak ? "font-semibold text-caramel-deep" : "text-muted"
                }`}
              >
                {d.hour % 3 === 0 ? `${d.hour}h` : ""}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
