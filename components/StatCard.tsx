import {
  CalendarIcon,
  ChartIcon,
  ClockIcon,
  CupIcon,
} from "./Icons";

const ICONS = {
  cup: CupIcon,
  calendar: CalendarIcon,
  chart: ChartIcon,
  clock: ClockIcon,
} as const;

type StatCardProps = {
  label: string;
  value: string;
  hint?: string;
  icon?: keyof typeof ICONS;
};

export default function StatCard({ label, value, hint, icon }: StatCardProps) {
  const Icon = icon ? ICONS[icon] : null;

  return (
    <div className="rounded-2xl border border-latte/70 bg-card/80 p-3.5 shadow-[0_1px_0_rgba(255,255,255,0.8)_inset] transition hover:border-caramel/50">
      <div className="flex items-center gap-1.5 text-[11px] font-medium tracking-wide text-muted uppercase">
        {Icon ? <Icon size={13} className="shrink-0 text-caramel" /> : null}
        <span className="truncate">{label}</span>
      </div>
      <p className="mt-1.5 font-mono text-2xl leading-none font-semibold text-espresso">
        {value}
      </p>
      <p className="mt-1 truncate text-[11px] text-muted">{hint ?? "\u00a0"}</p>
    </div>
  );
}
