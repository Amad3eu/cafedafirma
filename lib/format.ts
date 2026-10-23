export const WEEKDAYS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

/** Chave do dia no fuso local: "2026-10-23" */
export function dayKey(ts: number): string {
  const d = new Date(ts);
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

export function todayKey(): string {
  return dayKey(Date.now());
}

export function startOfDay(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** "15:32" */
export function formatTime(ts: number): string {
  const d = new Date(ts);
  return `${`${d.getHours()}`.padStart(2, "0")}:${`${d.getMinutes()}`.padStart(2, "0")}`;
}

/** "23/10" */
export function formatShortDate(ts: number): string {
  const d = new Date(ts);
  return `${`${d.getDate()}`.padStart(2, "0")}/${`${d.getMonth() + 1}`.padStart(2, "0")}`;
}

/** "sexta, 23/10" */
export function formatLongDate(ts: number): string {
  return `${new Date(ts).toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
  })}`;
}

/** "há 12 min", "há 2 h 5 min", "agora" */
export function relativeTime(ts: number, now: number): string {
  const diff = Math.max(0, now - ts);
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "agora";
  if (minutes < 60) return `há ${minutes} min`;

  const hours = Math.floor(minutes / 60);
  const restMin = minutes % 60;
  if (hours < 24) {
    return restMin === 0 ? `há ${hours} h` : `há ${hours} h ${restMin} min`;
  }

  const days = Math.floor(hours / 24);
  if (days === 1) return "ontem";
  if (days < 30) return `há ${days} dias`;
  const months = Math.floor(days / 30);
  return months === 1 ? "há 1 mês" : `há ${months} meses`;
}

/** Rótulo curto de um dia: "hoje", "ontem", "21/10" */
export function formatDayLabel(key: string, now: number): string {
  if (key === dayKey(now)) return "hoje";
  if (key === dayKey(now - 86_400_000)) return "ontem";
  const [, m, d] = key.split("-");
  return `${d}/${m}`;
}

export function pad2(n: number): string {
  return `${n}`.padStart(2, "0");
}

/** Duração legível a partir de minutos: "2h05" */
export function durationLabel(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h${pad2(m)}`;
}
