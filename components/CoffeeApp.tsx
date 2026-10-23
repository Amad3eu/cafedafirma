"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CoffeeEntry, StorageKind } from "@/lib/types";
import {
  DAY,
} from "@/lib/constants";
import {
  WEEKDAYS,
  dayKey,
  durationLabel,
  formatDayLabel,
  formatLongDate,
  formatShortDate,
  formatTime,
  relativeTime,
  startOfDay,
  todayKey,
} from "@/lib/format";
import {
  type ClientMode,
  type Settings,
  DEFAULT_SETTINGS,
  clearLocalEntries,
  deleteEntry,
  loadEntries,
  loadName,
  loadSettings,
  readLocalEntries,
  registerEntry,
  saveName,
  saveSettings,
} from "@/lib/client-store";
import StatCard from "./StatCard";
import DayChart, { type DayPoint } from "./DayChart";
import HourChart, { type HourPoint } from "./HourChart";
import TodayList from "./TodayList";
import HistoryList, { type DayGroup } from "./HistoryList";
import ExtensionCard from "./ExtensionCard";
import {
  BellIcon,
  ClockIcon,
  CloudIcon,
  CupIcon,
  DeviceIcon,
  DownloadIcon,
  SpinnerIcon,
  UserIcon,
  WarningIcon,
  CloseIcon,
} from "./Icons";

const CHART_DAYS = 14;
const HISTORY_DAYS = 60;
const REMIND_OPTIONS = [60, 120, 180, 240, 300, 360];

type Toast = { kind: "success" | "error"; text: string; undoId?: string };

export default function CoffeeApp({ siteUrl }: { siteUrl: string }) {
  const [mounted, setMounted] = useState(false);
  const [now, setNow] = useState(0);
  const [entries, setEntries] = useState<CoffeeEntry[]>([]);
  const [mode, setMode] = useState<ClientMode | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState("");
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [manualTime, setManualTime] = useState("");
  const [pendingLocal, setPendingLocal] = useState<CoffeeEntry[]>([]);
  const [importing, setImporting] = useState(false);
  const [lastSync, setLastSync] = useState<number | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* ------------------------------------------------------------- */
  /* Carga inicial                                                  */
  /* ------------------------------------------------------------- */

  const refresh = useCallback(async () => {
    const { mode: nextMode, entries: list } = await loadEntries(HISTORY_DAYS);
    setMode(nextMode);
    setEntries(list);
    setLastSync(Date.now());
    return nextMode;
  }, []);

  useEffect(() => {
    const start = () => {
      setMounted(true);
      setNow(Date.now());
      setName(loadName());
      setSettings(loadSettings());

      refresh()
        .then((loadedMode) => {
          // se o histórico passou a ser compartilhado, oferece migrar o que
          // ficou salvo neste navegador no modo local
          if (loadedMode === "shared") {
            const cutoff = Date.now() - 59 * DAY;
            setPendingLocal(
              readLocalEntries()
                .filter((entry) => entry.ts >= cutoff)
                .sort((a, b) => a.ts - b.ts),
            );
          }
        })
        .finally(() => setLoading(false));
    };

    start();

    const clock = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(clock);
  }, [refresh]);

  // Em modo compartilhado, busca novidades dos colegas periodicamente.
  // Só consulta com a aba visível, para economizar comandos do Redis.
  useEffect(() => {
    if (mode !== "shared") return;

    const tick = () => {
      if (document.visibilityState === "visible") void refresh();
    };

    const poll = setInterval(tick, 20_000);
    document.addEventListener("visibilitychange", tick);
    window.addEventListener("focus", tick);
    return () => {
      clearInterval(poll);
      document.removeEventListener("visibilitychange", tick);
      window.removeEventListener("focus", tick);
    };
  }, [mode, refresh]);

  const showToast = useCallback((next: Toast) => {
    setToast(next);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 8000);
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, []);

  /* ------------------------------------------------------------- */
  /* Ações                                                          */
  /* ------------------------------------------------------------- */

  const register = useCallback(
    async (ts?: number) => {
      if (busy) return;
      setBusy(true);
      try {
        const { mode: nextMode, entry } = await registerEntry({
          ts,
          who: name.trim() || undefined,
        });
        setMode(nextMode);
        setEntries((prev) =>
          [...prev, entry].sort((a, b) => a.ts - b.ts),
        );
        setNow(Date.now());
        showToast({
          kind: "success",
          text: `Café registrado às ${formatTime(entry.ts)}${name.trim() ? ` — ${name.trim()}` : ""}`,
          undoId: entry.id,
        });

        // confirma que o registro realmente chegou ao servidor
        if (nextMode === "shared") {
          try {
            const res = await fetch("/api/entries?days=1", { cache: "no-store" });
            if (res.ok) {
              const data = (await res.json()) as { entries?: CoffeeEntry[] };
              const saved = (data.entries ?? []).some(
                (item) => item.id === entry.id,
              );
              if (!saved) {
                showToast({
                  kind: "error",
                  text: "O café apareceu aqui, mas não foi confirmado no servidor. Abra /api/health para ver o diagnóstico.",
                });
              }
            }
          } catch {
            /* verificação é opcional */
          }
        }
      } catch {
        showToast({
          kind: "error",
          text: "Não deu para registrar. Verifique a conexão e tente de novo.",
        });
      } finally {
        setBusy(false);
      }
    },
    [busy, name, showToast],
  );

  const removeEntry = useCallback(
    async (entry: CoffeeEntry) => {
      const currentMode = mode ?? "local";
      setEntries((prev) => prev.filter((item) => item.id !== entry.id));
      try {
        await deleteEntry(entry.id, currentMode);
        showToast({
          kind: "success",
          text: `Registro das ${formatTime(entry.ts)} removido.`,
        });
      } catch {
        showToast({ kind: "error", text: "Não foi possível remover." });
        void refresh();
      }
    },
    [mode, refresh, showToast],
  );

  const importLocalEntries = useCallback(async () => {
    if (importing || pendingLocal.length === 0) return;
    setImporting(true);
    try {
      for (const entry of pendingLocal) {
        await registerEntry({ ts: entry.ts, who: entry.who });
      }
      clearLocalEntries();
      const total = pendingLocal.length;
      setPendingLocal([]);
      await refresh();
      showToast({
        kind: "success",
        text: `${total} registro(s) importados para o histórico compartilhado.`,
      });
    } catch {
      showToast({
        kind: "error",
        text: "Falha ao importar. Tente de novo em alguns segundos.",
      });
    } finally {
      setImporting(false);
    }
  }, [importing, pendingLocal, refresh, showToast]);

  const discardLocalEntries = useCallback(() => {
    clearLocalEntries();
    setPendingLocal([]);
    showToast({ kind: "success", text: "Registros locais descartados." });
  }, [showToast]);

  const syncNow = useCallback(async () => {
    if (syncing) return;
    setSyncing(true);
    try {
      await refresh();
    } finally {
      setSyncing(false);
    }
  }, [refresh, syncing]);

  const registerManual = useCallback(() => {
    if (!manualTime) return;
    const [hours, minutes] = manualTime.split(":").map(Number);
    if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return;
    const date = new Date();
    date.setHours(hours, minutes, 0, 0);
    let ts = date.getTime();
    if (ts > Date.now() + 60_000) {
      // horário ainda não chegou hoje -> registra como sendo de ontem
      ts -= DAY;
    }
    void register(ts);
    setManualTime("");
  }, [manualTime, register]);

  const updateSettings = useCallback((patch: Partial<Settings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      saveSettings(next);
      return next;
    });
  }, []);

  const updateName = useCallback((value: string) => {
    setName(value);
    saveName(value);
  }, []);

  const exportCsv = useCallback(() => {
    const header = ["data", "hora", "quem", "observacao"];
    const rows = [...entries]
      .sort((a, b) => a.ts - b.ts)
      .map((entry) => {
        const d = new Date(entry.ts);
        return [
          `${`${d.getDate()}`.padStart(2, "0")}/${`${d.getMonth() + 1}`.padStart(2, "0")}/${d.getFullYear()}`,
          formatTime(entry.ts),
          entry.who ?? "",
          entry.note ?? "",
        ];
      });
    const csv = [header, ...rows]
      .map((row) =>
        row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(";"),
      )
      .join("\r\n");

    const blob = new Blob([`\uFEFF${csv}`], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `cafes-${todayKey()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }, [entries]);

  /* ------------------------------------------------------------- */
  /* Dados derivados                                                */
  /* ------------------------------------------------------------- */

  const todayEntries = useMemo(() => {
    if (!now) return [];
    const key = dayKey(now);
    return entries.filter((entry) => dayKey(entry.ts) === key);
  }, [entries, now]);

  const todayByWho = useMemo(() => {
    const map = new Map<string, number>();
    for (const entry of todayEntries) {
      const key = entry.who?.trim() || "sem nome";
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [todayEntries]);

  const lastEntry = useMemo(() => {
    if (entries.length === 0) return null;
    return entries.reduce((latest, entry) =>
      entry.ts > latest.ts ? entry : latest,
    );
  }, [entries]);

  const dayGroups = useMemo<DayGroup[]>(() => {
    const map = new Map<string, CoffeeEntry[]>();
    for (const entry of entries) {
      const key = dayKey(entry.ts);
      const list = map.get(key);
      if (list) list.push(entry);
      else map.set(key, [entry]);
    }

    return [...map.entries()]
      .map(([key, list]) => {
        const sorted = [...list].sort((a, b) => a.ts - b.ts);
        return {
          key,
          label: formatDayLabel(key, now),
          weekDay: WEEKDAYS[new Date(sorted[0].ts).getDay()],
          count: sorted.length,
          entries: sorted,
        };
      })
      .sort((a, b) => (a.key < b.key ? 1 : -1));
  }, [entries, now]);

  const dayPoints = useMemo<DayPoint[]>(() => {
    if (!now) return [];
    const base = now;
    const counts = new Map<string, number>();
    for (const entry of entries) {
      const key = dayKey(entry.ts);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }

    const points: DayPoint[] = [];
    for (let i = CHART_DAYS - 1; i >= 0; i--) {
      const ts = startOfDay(base - i * DAY);
      const key = dayKey(ts);
      points.push({
        key,
        label: i === 0 ? "hoje" : formatShortDate(ts),
        value: counts.get(key) ?? 0,
        isToday: i === 0,
        weekDay: WEEKDAYS[new Date(ts).getDay()],
      });
    }
    return points;
  }, [entries, now]);

  const hourPoints = useMemo<HourPoint[]>(() => {
    const counts = new Array<number>(24).fill(0);
    for (const entry of entries) counts[new Date(entry.ts).getHours()] += 1;
    return counts.map((value, hour) => ({ hour, value }));
  }, [entries]);

  const peakHour = useMemo(() => {
    let best: HourPoint | null = null;
    for (const point of hourPoints) {
      if (point.value > 0 && (!best || point.value > best.value)) best = point;
    }
    return best ? best.hour : null;
  }, [hourPoints]);

  const weekCount = useMemo(() => {
    if (!now) return 0;
    const from = startOfDay(now) - 6 * DAY;
    return entries.filter((entry) => entry.ts >= from).length;
  }, [entries, now]);

  const sinceLast = lastEntry && now ? now - lastEntry.ts : null;
  const reminderDue =
    mounted &&
    settings.remind &&
    sinceLast !== null &&
    sinceLast > settings.interval * 60_000;

  const needName = mounted && mode === "shared" && name.trim().length === 0;

  const lastWasToday =
    lastEntry && now ? dayKey(lastEntry.ts) === dayKey(now) : false;

  const storageKind: StorageKind =
    mode === "shared" ? "redis" : mode === "local" ? "none" : "file";

  /* ------------------------------------------------------------- */
  /* Render                                                         */
  /* ------------------------------------------------------------- */

  return (
    <main className="mx-auto w-full max-w-6xl px-4 pt-6 pb-16 sm:pt-9">
      {/* Cabeçalho ------------------------------------------------- */}
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="relative flex h-11 w-11 items-center justify-center rounded-2xl bg-espresso text-xl text-cream shadow-md">
            <CupIcon size={20} />
            <span className="steam absolute -top-2 left-1/2 flex -translate-x-1/2 gap-[3px]">
              <span />
              <span />
              <span />
            </span>
          </div>
          <div>
            <h1 className="text-lg leading-tight font-semibold tracking-tight sm:text-xl">
              Café da Firma
            </h1>
            <p className="text-[11px] text-muted sm:text-xs">
              Registro das feitas de café · {mounted ? formatLongDate(now) : "—"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium ${
              mode === "shared"
                ? "border-emerald-600/25 bg-emerald-600/10 text-emerald-800"
                : "border-caramel/30 bg-caramel/10 text-caramel-deep"
            }`}
            title={
              mode === "shared"
                ? "Histórico salvo no servidor e compartilhado com a equipe"
                : "Histórico salvo apenas neste navegador"
            }
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                mode === "shared" ? "bg-emerald-600" : "bg-caramel"
              }`}
            />
            {mode === null
              ? "conectando…"
              : mode === "shared"
                ? "compartilhado"
                : "só neste navegador"}
          </span>

          <button
            type="button"
            onClick={() => void syncNow()}
            disabled={syncing}
            title={
              lastSync
                ? `Atualizado às ${formatTime(lastSync)} — clique para buscar novidades`
                : "Buscar novidades"
            }
            className="inline-flex items-center gap-1.5 rounded-full border border-latte bg-card px-2.5 py-1 text-[11px] font-medium text-mocha transition hover:border-caramel/60 hover:bg-cream disabled:opacity-60"
          >
            <span
              className={syncing ? "inline-flex animate-spin" : "inline-flex"}
              aria-hidden
            >
              ↻
            </span>
            {lastSync ? `atualizado ${formatTime(lastSync)}` : "atualizar"}
          </button>

          <label
            className={`flex items-center gap-1.5 rounded-full border bg-card px-2.5 py-1 text-[11px] text-muted transition ${
              needName
                ? "border-caramel ring-2 ring-caramel/25"
                : "border-latte"
            }`}
            title={
              needName
                ? "Defina seu nome para a equipe saber quem fez o café"
                : undefined
            }
          >
            <UserIcon size={13} className="shrink-0" />
            <input
              value={name}
              onChange={(event) => updateName(event.target.value)}
              placeholder="seu nome"
              maxLength={20}
              className="w-[74px] bg-transparent text-xs text-espresso outline-none placeholder:text-muted/70 sm:w-24"
            />
          </label>
        </div>
      </header>

      {/* Aviso: modo local ---------------------------------------- */}
      {mounted && mode === "local" ? (
        <div className="animate-rise mt-4 rounded-2xl border border-amber-500/30 bg-amber-50/80 px-4 py-3 text-xs text-amber-900">
          <p className="flex items-center gap-1.5 font-semibold">
            <DeviceIcon size={14} /> Histórico salvo apenas neste navegador
          </p>
          <p className="mt-0.5 text-amber-800/90">
            Funciona agora, mas os cafés ficam no seu dispositivo. Para a equipe
            toda ver o mesmo histórico na Vercel, conecte um banco Redis
            (Upstash) ao projeto e defina{" "}
            <code className="rounded bg-amber-100 px-1">
              UPSTASH_REDIS_REST_URL
            </code>{" "}
            e{" "}
            <code className="rounded bg-amber-100 px-1">
              UPSTASH_REDIS_REST_TOKEN
            </code>
            . Passo a passo no README.
          </p>
        </div>
      ) : null}

      {/* Falta definir o nome -------------------------------------- */}
      {needName ? (
        <div className="animate-rise mt-4 flex flex-wrap items-center gap-3 rounded-2xl border border-caramel/40 bg-caramel/10 px-4 py-2.5">
          <UserIcon size={18} className="shrink-0 text-caramel-deep" />
          <p className="min-w-[200px] flex-1 text-xs text-espresso">
            <strong>Coloque seu nome</strong> no campo ao lado do selo
            “compartilhado”. É ele que identifica os cafés e avisa os colegas
            quando você registra.
          </p>
        </div>
      ) : null}

      {/* Migração do histórico local para o compartilhado ---------- */}
      {mounted && mode === "shared" && pendingLocal.length > 0 ? (
        <div className="animate-rise mt-4 flex flex-wrap items-center gap-3 rounded-2xl border border-sky-600/25 bg-sky-50/80 px-4 py-3">
          <CloudIcon size={20} className="shrink-0 text-sky-700" />
          <div className="min-w-[200px] flex-1">
            <p className="text-sm font-semibold text-espresso">
              {pendingLocal.length} café(s) salvos neste navegador
            </p>
            <p className="mt-0.5 text-xs text-mocha">
              São de antes de o banco ser conectado. Quer enviar para o
              histórico compartilhado?
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void importLocalEntries()}
              disabled={importing}
              className="inline-flex items-center gap-1.5 rounded-xl bg-sky-700 px-3 py-2 text-xs font-semibold text-white transition hover:bg-sky-800 disabled:opacity-60"
            >
              {importing ? (
                <SpinnerIcon size={14} className="animate-spin" />
              ) : (
                <DownloadIcon size={14} />
              )}
              {importing ? "Importando…" : "Importar"}
            </button>
            <button
              type="button"
              onClick={discardLocalEntries}
              disabled={importing}
              className="rounded-xl border border-espresso/15 px-3 py-2 text-xs font-semibold text-espresso transition hover:bg-white disabled:opacity-60"
            >
              Descartar
            </button>
          </div>
        </div>
      ) : null}

      {/* Aviso: hora de cadastrar a feita -------------------------- */}
      {reminderDue && sinceLast !== null ? (
        <div className="animate-rise mt-4 flex flex-wrap items-center gap-3 rounded-2xl border border-caramel/40 bg-gradient-to-r from-caramel/15 to-caramel/5 px-4 py-3">
          <BellIcon size={22} className="shrink-0 text-caramel-deep" />
          <div className="min-w-[190px] flex-1">
            <p className="text-sm font-semibold text-espresso">
              Hora de cadastrar a feita do café!
            </p>
            <p className="mt-0.5 text-xs text-mocha">
              A última foi {relativeTime(lastEntry!.ts, now)} (
              {lastWasToday ? "hoje" : "outro dia"} às{" "}
              {formatTime(lastEntry!.ts)}) — já passou de{" "}
              {durationLabel(settings.interval)}.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void register()}
            disabled={busy}
            className="rounded-xl bg-caramel px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-caramel-deep disabled:opacity-60"
          >
            Registrar agora
          </button>
        </div>
      ) : null}

      {/* Hero + estatísticas -------------------------------------- */}
      <section className="mt-4 grid gap-4 lg:grid-cols-[1.3fr_1fr]">
        <div className="relative overflow-hidden rounded-3xl bg-espresso p-5 text-cream shadow-xl shadow-espresso/20 sm:p-6">
          <div className="pointer-events-none absolute -top-16 -right-12 h-52 w-52 rounded-full bg-caramel/25 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-20 -left-10 h-40 w-40 rounded-full bg-latte/10 blur-2xl" />

          <div className="relative">
            <p className="text-[10px] font-medium tracking-[0.22em] text-latte/70 uppercase">
              {lastWasToday ? "Último café de hoje" : "Último café registrado"}
            </p>

            <div className="mt-1.5 flex flex-wrap items-end gap-x-3 gap-y-1">
              <span className="font-mono text-6xl leading-none font-semibold tracking-tight tabular-nums sm:text-7xl">
                {mounted && lastEntry ? formatTime(lastEntry.ts) : "--:--"}
              </span>
              <span className="pb-1.5 text-xs text-latte/80 sm:text-sm">
                {mounted && lastEntry
                  ? `${relativeTime(lastEntry.ts, now)}${lastEntry.who ? ` · ${lastEntry.who}` : ""}`
                  : "nenhum registro ainda"}
              </span>
            </div>

            <p className="mt-1 text-xs text-latte/60">
              {mounted && lastEntry && !lastWasToday
                ? `Último registro ${relativeTime(lastEntry.ts, now)} · ${formatLongDate(lastEntry.ts)}`
                : todayEntries.length > 0
                  ? `${todayEntries.length} café(s) hoje — a casa está animada`
                  : "Bora inaugurar o dia com um café?"}
            </p>

            <button
              type="button"
              onClick={() => void register()}
              disabled={busy}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-caramel px-5 py-3.5 text-base font-semibold text-white shadow-lg shadow-caramel/30 transition hover:bg-caramel-deep active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy ? (
                <SpinnerIcon size={18} className="animate-spin" />
              ) : (
                <CupIcon size={18} />
              )}
              {busy ? "Registrando…" : "Registrar café agora"}
            </button>

            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] text-latte/70">
              <div className="flex items-center gap-1.5">
                <ClockIcon size={13} />
                <span>Outro horário</span>
                <input
                  type="time"
                  value={manualTime}
                  onChange={(event) => setManualTime(event.target.value)}
                  className="rounded-lg border border-white/20 bg-white/10 px-1.5 py-1 font-mono text-xs text-cream outline-none focus:border-caramel/70"
                />
                <button
                  type="button"
                  onClick={registerManual}
                  disabled={!manualTime || busy}
                  className="rounded-lg bg-white/15 px-2 py-1 text-[11px] font-semibold text-cream transition hover:bg-white/25 disabled:opacity-40"
                >
                  add
                </button>
              </div>

              <label className="flex items-center gap-1.5">
                <input
                  type="checkbox"
                  checked={settings.remind}
                  onChange={(event) =>
                    updateSettings({ remind: event.target.checked })
                  }
                  className="h-3.5 w-3.5 accent-caramel"
                />
                <span>avisar após</span>
                <select
                  value={settings.interval}
                  onChange={(event) =>
                    updateSettings({ interval: Number(event.target.value) })
                  }
                  disabled={!settings.remind}
                  className="rounded-lg border border-white/20 bg-white/10 px-1.5 py-1 text-xs text-cream outline-none disabled:opacity-40"
                >
                  {REMIND_OPTIONS.map((minutes) => (
                    <option key={minutes} value={minutes} className="text-espresso">
                      {durationLabel(minutes)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:gap-4">
          <StatCard
            label="Hoje"
            icon="cup"
            value={mounted ? String(todayEntries.length) : "—"}
            hint={
              mounted && todayEntries.length > 0 && lastEntry
                ? `última ${formatTime(lastEntry.ts)}`
                : "nenhuma ainda"
            }
          />
          <StatCard
            label="Últimos 7 dias"
            icon="calendar"
            value={mounted ? String(weekCount) : "—"}
            hint="incluindo hoje"
          />
          <StatCard
            label="Média por dia"
            icon="chart"
            value={mounted ? (weekCount / 7).toFixed(1).replace(".", ",") : "—"}
            hint="na última semana"
          />
          <StatCard
            label="Horário de pico"
            icon="clock"
            value={
              mounted && peakHour !== null
                ? `${`${peakHour}`.padStart(2, "0")}h`
                : "—"
            }
            hint="no histórico"
          />
        </div>
      </section>

      {/* Gráficos -------------------------------------------------- */}
      <section className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-latte/70 bg-card/70 p-4">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="text-sm font-semibold text-espresso">
              Cafés por dia
            </h2>
            <span className="text-[11px] text-muted">
              últimos {CHART_DAYS} dias · máx.{" "}
              {Math.max(0, ...dayPoints.map((point) => point.value))}
            </span>
          </div>
          <DayChart data={dayPoints} />
        </div>

        <div className="rounded-2xl border border-latte/70 bg-card/70 p-4">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="text-sm font-semibold text-espresso">
              Cafés por hora do dia
            </h2>
            <span className="text-[11px] text-muted">
              {peakHour !== null
                ? `pico às ${`${peakHour}`.padStart(2, "0")}h`
                : "sem dados ainda"}
            </span>
          </div>
          <HourChart data={hourPoints} peakHour={peakHour} />
        </div>
      </section>

      {/* Hoje + histórico ------------------------------------------ */}
      <section className="mt-4 grid gap-4 lg:grid-cols-[1fr_1.25fr]">
        <div className="rounded-2xl border border-latte/70 bg-card/70 p-4">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="text-sm font-semibold text-espresso">Hoje</h2>
            <span className="text-[11px] text-muted">
              {mounted ? `${todayEntries.length} registro(s)` : "—"}
            </span>
          </div>
          {mounted && todayByWho.length > 0 ? (
            <div className="mb-3 flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] font-medium tracking-wide text-muted uppercase">
                quem fez
              </span>
              {todayByWho.map(([who, count]) => (
                <span
                  key={who}
                  className="inline-flex items-center gap-1 rounded-full bg-cream-deep/80 px-2 py-0.5 text-[11px] text-espresso-soft"
                >
                  {who}
                  <span className="font-mono text-[10px] font-semibold text-caramel-deep">
                    {count}
                  </span>
                </span>
              ))}
            </div>
          ) : null}
          {loading ? (
            <div className="space-y-2">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="h-14 animate-pulse rounded-xl bg-cream-deep/60"
                />
              ))}
            </div>
          ) : (
            <TodayList
              entries={todayEntries}
              now={now}
              onDelete={(entry) => void removeEntry(entry)}
            />
          )}
        </div>

        <div className="rounded-2xl border border-latte/70 bg-card/70 p-4">
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-sm font-semibold text-espresso">
              Histórico por dia
            </h2>
            <button
              type="button"
              onClick={exportCsv}
              disabled={entries.length === 0}
              className="inline-flex items-center gap-1 rounded-lg border border-latte px-2 py-1 text-[11px] font-medium text-mocha transition hover:border-caramel/60 hover:bg-cream disabled:opacity-40"
            >
              <DownloadIcon size={12} /> Exportar CSV
            </button>
          </div>
          {loading ? (
            <div className="space-y-2">
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-10 animate-pulse rounded-xl bg-cream-deep/60"
                />
              ))}
            </div>
          ) : (
            <HistoryList
              groups={dayGroups}
              onDelete={(entry) => void removeEntry(entry)}
            />
          )}
        </div>
      </section>

      <section className="mt-4">
        <ExtensionCard siteUrl={siteUrl} />
      </section>

      <footer className="mt-6 flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted">
        <p className="inline-flex items-center gap-1.5">
          {storageKind === "redis" ? (
            <>
              <CloudIcon size={13} /> Histórico compartilhado via Redis
            </>
          ) : (
            <>
              <DeviceIcon size={13} /> Histórico local (este navegador)
            </>
          )}
        </p>
        <p className="flex items-center gap-2">
          <a
            href="/privacidade"
            className="font-medium text-mocha hover:text-caramel-deep hover:underline"
          >
            Política de privacidade
          </a>
          <span aria-hidden>·</span>
          <span>Next.js na Vercel</span>
        </p>
      </footer>

      {/* Toast ---------------------------------------------------- */}
      {mounted && toast ? (
        <div className="animate-pop fixed inset-x-0 bottom-5 z-50 flex justify-center px-4">
          <div
            role="status"
            className={`flex max-w-md items-center gap-2.5 rounded-2xl px-4 py-3 text-sm shadow-2xl ${
              toast.kind === "success"
                ? "bg-espresso text-cream"
                : "bg-red-900 text-white"
            }`}
          >
            {toast.kind === "success" ? (
              <CupIcon size={16} className="shrink-0" />
            ) : (
              <WarningIcon size={16} className="shrink-0" />
            )}
            <p className="flex-1">{toast.text}</p>
            {toast.undoId ? (
              <button
                type="button"
                onClick={() => {
                  const entry = entries.find((item) => item.id === toast.undoId);
                  setToast(null);
                  if (entry) void removeEntry(entry);
                }}
                className="rounded-lg bg-white/15 px-2 py-1 text-xs font-semibold transition hover:bg-white/25"
              >
                Desfazer
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => setToast(null)}
              aria-label="Fechar aviso"
              className="rounded-lg p-1 text-cream/60 transition hover:text-cream"
            >
              <CloseIcon />
            </button>
          </div>
        </div>
      ) : null}
    </main>
  );
}
