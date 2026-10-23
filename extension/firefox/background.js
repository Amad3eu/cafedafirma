/* Café da Firma — service worker / event page */
const api = globalThis.browser ?? globalThis.chrome;
const isFirefox = typeof globalThis.browser !== "undefined";
const DEFAULTS = { baseUrl: "", name: "", remindMin: 180 };
const ALARM = "cafe-check";

function normalizeBase(url) {
  return String(url || "")
    .trim()
    .replace(/\/+$/, "");
}

async function getConfig() {
  const stored = await api.storage.local.get(DEFAULTS);
  return {
    baseUrl: normalizeBase(stored.baseUrl),
    name: stored.name || "",
    remindMin: Number(stored.remindMin) || DEFAULTS.remindMin,
    lastNotified: Number(stored.lastNotified) || 0,
  };
}

async function fetchEntries(baseUrl) {
  const res = await fetch(`${baseUrl}/api/entries?days=7`, { cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return Array.isArray(data.entries) ? data.entries : [];
}

function sameDay(a, b) {
  const da = new Date(a);
  const db = new Date(b);
  return (
    da.getFullYear() === db.getFullYear() &&
    da.getMonth() === db.getMonth() &&
    da.getDate() === db.getDate()
  );
}

function pad(n) {
  return String(n).padStart(2, "0");
}

function timeLabel(ts) {
  const d = new Date(ts);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function duration(minutes) {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h${pad(m)}`;
}

function setBadge(text) {
  try {
    if (api.action?.setBadgeText) api.action.setBadgeText({ text });
    if (api.action?.setBadgeBackgroundColor) {
      api.action.setBadgeBackgroundColor({ color: "#b4693a" });
    }
  } catch {
    /* alguns navegadores exigem outro namespace */
  }
}

function notify(id, title, message) {
  const options = {
    type: "basic",
    iconUrl: "icons/icon-128.png",
    title,
    message,
    priority: 1,
  };
  try {
    if (isFirefox) {
      api.notifications.create(id, options);
    } else {
      api.notifications.create(id, options, () => void api.runtime.lastError);
    }
  } catch {
    /* ignora */
  }
}

async function check() {
  const config = await getConfig();
  if (!config.baseUrl) {
    setBadge("");
    return;
  }

  let entries = [];
  try {
    entries = await fetchEntries(config.baseUrl);
  } catch {
    setBadge("!");
    return;
  }

  const now = Date.now();
  const today = entries.filter((entry) => sameDay(entry.ts, now));
  setBadge(today.length > 0 ? String(today.length) : "");

  const last = entries.reduce(
    (acc, entry) => (!acc || entry.ts > acc.ts ? entry : acc),
    null,
  );
  if (!last || !sameDay(last.ts, now)) return;

  const since = now - last.ts;
  const interval = config.remindMin * 60000;
  if (since < interval) return;

  // não repetir o aviso antes de passar o mesmo intervalo
  if (now - config.lastNotified < interval) return;

  notify(
    `cafe-reminder-${now}`,
    "Hora do café ☕",
    `Última feita foi às ${timeLabel(last.ts)}, já faz mais de ${duration(
      config.remindMin,
    )}. Cadastre a nova feita no Café da Firma!`,
  );
  await api.storage.local.set({ lastNotified: now });
}

api.runtime.onInstalled.addListener(async () => {
  const stored = await api.storage.local.get(Object.keys(DEFAULTS));
  const patch = {};
  for (const [key, value] of Object.entries(DEFAULTS)) {
    if (stored[key] === undefined) patch[key] = value;
  }
  if (Object.keys(patch).length > 0) await api.storage.local.set(patch);
  api.alarms.create(ALARM, { periodInMinutes: 5 });
});

api.runtime.onStartup.addListener(() => {
  api.alarms.create(ALARM, { periodInMinutes: 5 });
});

api.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM) void check();
});

api.notifications.onClicked.addListener(async (notificationId) => {
  if (!String(notificationId).startsWith("cafe-")) return;
  const config = await getConfig();
  if (config.baseUrl) api.tabs.create({ url: config.baseUrl });
  try {
    api.notifications.clear(notificationId);
  } catch {
    /* ignora */
  }
});

// roda uma vez ao acordar o worker
void check();
