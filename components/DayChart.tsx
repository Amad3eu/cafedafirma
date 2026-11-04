"use client";

export type DayPoint = {
  key: string;
  label: string;
  /** feitas (cafés passados) */
  value: number;
  /** xícaras tomadas */
  cups: number;
  isToday: boolean;
  weekDay: string;
};

const BAR_AREA = 104;

/**
 * Barras agrupadas por dia: feitas (caramelo) e xícaras (azul). As duas séries
 * são contagens na mesma escala, então dividem um único eixo. Rótulos diretos
 * só em "hoje" e no maior valor de cada série — o resto aparece no hover.
 */
export default function DayChart({ data }: { data: DayPoint[] }) {
  const max = Math.max(1, ...data.map((d) => Math.max(d.value, d.cups)));
  const maxBrews = Math.max(...data.map((d) => d.value));
  const maxCups = Math.max(...data.map((d) => d.cups));
  const hasCups = data.some((d) => d.cups > 0);

  return (
    <div className="flex h-full flex-col">
      <div className="mb-2 flex items-center gap-3 text-[11px] text-muted">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-sm bg-caramel" aria-hidden />
          feitas
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-sm bg-cups" aria-hidden />
          xícaras
        </span>
      </div>

      <div className="flex flex-1 items-end gap-[3px] sm:gap-1.5">
        {data.map((d, index) => {
          // no mobile mostramos o rótulo de 2 em 2 para não encavalar
          const showOnMobile = index % 2 === 0 || d.isToday;
          const labelBrews = d.value > 0 && (d.isToday || d.value === maxBrews);
          const labelCups = d.cups > 0 && (d.isToday || d.cups === maxCups);
          return (
            <div
              key={d.key}
              className="group flex h-full flex-1 flex-col items-center justify-end gap-1"
              title={`${d.weekDay} ${d.label}: ${d.value} feita(s) · ${d.cups} xícara(s)`}
            >
              <div className="flex w-full items-end justify-center gap-[2px]" style={{ height: BAR_AREA }}>
                <Bar
                  value={d.value}
                  max={max}
                  label={labelBrews}
                  className={
                    d.isToday
                      ? "bg-gradient-to-t from-caramel-deep to-caramel"
                      : "bg-gradient-to-t from-caramel/70 to-caramel/90 group-hover:from-caramel-deep group-hover:to-caramel"
                  }
                />
                {hasCups ? (
                  <Bar
                    value={d.cups}
                    max={max}
                    label={labelCups}
                    className={
                      d.isToday
                        ? "bg-gradient-to-t from-cups to-cups/85"
                        : "bg-gradient-to-t from-cups/65 to-cups/80 group-hover:from-cups group-hover:to-cups/90"
                    }
                  />
                ) : null}
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

function Bar({
  value,
  max,
  label,
  className,
}: {
  value: number;
  max: number;
  label: boolean;
  className: string;
}) {
  const pct = (value / max) * 100;
  return (
    <div className="relative flex h-full flex-1 items-end">
      <span
        className={`absolute inset-x-0 -top-0.5 -translate-y-full text-center font-mono text-[10px] tabular-nums transition ${
          value === 0
            ? "hidden"
            : label
              ? "text-mocha"
              : "text-transparent group-hover:text-muted"
        }`}
        style={{ bottom: `${Math.max(8, pct)}%`, top: "auto" }}
      >
        {value}
      </span>
      <div
        className={`w-full rounded-t-[4px] transition-all duration-500 ${
          value === 0 ? "bg-latte/60" : className
        }`}
        style={{ height: `${value === 0 ? 3 : Math.max(8, pct)}%` }}
      />
    </div>
  );
}
