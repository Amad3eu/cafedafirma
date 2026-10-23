/* Café da Firma — service worker (Chrome/Edge) e event page (Firefox) */
const api = globalThis.browser ?? globalThis.chrome;
const isFirefox = typeof globalThis.browser !== "undefined";

const ALARM = "cafe-check";

const DEFAULTS = {
  baseUrl: "",
  name: "",
  remindMin: 180, // lembrete da manhã (antes das 13h)
  afternoonMin: 240, // lembrete da tarde (a partir das 13h)
  firstAt: 8, // avisa "primeiro café do dia" a partir desta hora (-1 = desligado)
  watchMin: 2, // intervalo de verificação (também usado p/ atividade da equipe)
  teamNotify: true, // avisar quando um colega registra café
  clickAction: "popup", // "popup" = abrir painel | "register" = registrar direto
  lastNotified: 0, // último lembrete de intervalo
  lastFirstDay: "", // dia em que o aviso de primeiro café já foi enviado
  lastTeamTs: 0, // maior timestamp já notificado (equipe)
};

function normalizeBase(url) {
  return String(url || "").trim().replace(/\/+$/, "");
}

async function getConfig() {
  const stored = await api.storage.local.get(DEFAULTS);
  return {
    baseUrl: normalizeBase(stored.baseUrl),
    name: stored.name || "",
    remindMin: Number(stored.remindMin) || DEFAULTS.remindMin,
    afternoonMin: Number(stored.afternoonMin) || DEFAULTS.afternoonMin,
    firstAt: Number.isFinite(Number(stored.firstAt))
      ? Number(stored.firstAt)
      : DEFAULTS.firstAt,
    watchMin: Math.max(1, Number(stored.watchMin) || DEFAULTS.watchMin),
    teamNotify: stored.teamNotify !== false,
    clickAction: stored.clickAction === "register" ? "register" : "popup",
    lastNotified: Number(stored.lastNotified) || 0,
    lastFirstDay: stored.lastFirstDay || "",
    lastTeamTs: Number(stored.lastTeamTs) || 0,
  };
}

async function fetchEntries(baseUrl, days = 2) {
  const res = await fetch(`${baseUrl}/api/entries?days=${days}`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return Array.isArray(data.entries) ? data.entries : [];
}

async function postCoffee(config) {
  const res = await fetch(`${config.baseUrl}/api/entries`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ who: config.name || undefined }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return data?.entry ?? null;
}

/* ----------------------------- utilidades ----------------------------- */

function pad(n) {
  return String(n).padStart(2, "0");
}

function timeLabel(ts) {
  const d = new Date(ts);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
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

function dayKey(ts) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
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
    /* namespace diferente em alguns navegadores */
  }
}

/** Cria notificação com botão "Registrar café" (quando suportado). */
function notify(id, title, message, options = {}) {
  const { withButton = false, onClickUrl = null } = options;
  const payload = {
    type: "basic",
    iconUrl: "icons/icon-128.png",
    title,
    message,
    priority: 1,
  };

  if (withButton) {
    payload.buttons = [{ title: "☕ Registrar café agora" }];
  }

  try {
    const done = () => {
      if (onClickUrl) {
        api.storage.local.set({ lastClickUrl: onClickUrl });
      }
    };
    if (isFirefox) {
      api.notifications.create(id, payload).then(done, done);
    } else {
      api.notifications.create(id, payload, () => {
        void api.runtime.lastError;
        done();
      });
    }
  } catch {
    /* sem permissão de notificação */
  }
}

function notifyRegistered(entry, name) {
  const suffix = name ? ` — ${name}` : "";
  notify(
    `cafe-ok-${entry?.ts ?? Date.now()}`,
    "Café registrado ☕",
    `Feita registrada às ${timeLabel(entry?.ts ?? Date.now())}${suffix}.`,
  );
}

async function quickRegister() {
  const config = await getConfig();
  if (!config.baseUrl) {
    notify("cafe-erro", "Configure o site", "Abra as opções da extensão.");
    return;
  }
  try {
    const entry = await postCoffee(config);
    notifyRegistered(entry, config.name);
    await check();
  } catch {
    notify(
      `cafe-erro-${Date.now()}`,
      "Não deu para registrar",
      "Verifique a conexão ou o endereço do site nas opções.",
    );
  }
}

/* ------------------------------- regras ------------------------------- */

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

  const updates = {};

  /* 1) primeiro café do dia ------------------------------------------- */
  const todayKey = dayKey(now);
  const hour = new Date(now).getHours();
  if (
    config.firstAt >= 0 &&
    today.length === 0 &&
    hour >= config.firstAt &&
    config.lastFirstDay !== todayKey
  ) {
    notify(
      `cafe-first-${todayKey}`,
      "Bom dia! ☕",
      "Nenhum café registrado hoje ainda. Bora cadastrar a primeira feita?",
      { withButton: true },
    );
    updates.lastFirstDay = todayKey;
  }

  /* 2) lembrete de intervalo (manhã x tarde) --------------------------- */
  const last = entries.reduce(
    (acc, entry) => (!acc || entry.ts > acc.ts ? entry : acc),
    null,
  );

  if (last && sameDay(last.ts, now)) {
    const effective = hour >= 13 ? config.afternoonMin : config.remindMin;
    const since = now - last.ts;

    if (since >= effective * 60_000 && now - config.lastNotified >= effective * 60_000) {
      const when = hour >= 13 ? "da tarde" : "do dia";
      notify(
        `cafe-reminder-${now}`,
        "Hora do café ☕",
        `Última feita foi às ${timeLabel(last.ts)}, já faz mais de ${duration(
          effective,
        )} (intervalo ${when}). Registrar agora?`,
        { withButton: true },
      );
      updates.lastNotified = now;
    }
  }

  /* 3) atividade da equipe ("Amadeu fez café") ------------------------- */
  if (config.teamNotify) {
    const baseline =
      config.lastTeamTs > 0 ? config.lastTeamTs : now - 60 * 60 * 1000;
    const novos = today
      .filter((entry) => entry.ts > baseline)
      .sort((a, b) => a.ts - b.ts);

    const deOutros = novos.filter(
      (entry) =>
        entry.who && entry.who.toLowerCase() !== (config.name || "").toLowerCase(),
    );

    for (const entry of deOutros.slice(-2)) {
      notify(
        `cafe-team-${entry.id || entry.ts}`,
        `${entry.who} fez café ☕`,
        `Registrado às ${timeLabel(entry.ts)}. Já são ${today.length} hoje na firma.`,
      );
    }

    if (novos.length > 0) {
      updates.lastTeamTs = novos[novos.length - 1].ts;
    }
  }

  if (Object.keys(updates).length > 0) {
    await api.storage.local.set(updates);
  }
}

/** Decide se o clique no ícone abre o painel ou registra o café. */
async function syncActionBehavior(config) {
  const cfg = config ?? (await getConfig());
  try {
    if (api.action?.setPopup) {
      await api.action.setPopup({
        popup: cfg.clickAction === "register" ? "" : "popup.html",
      });
    }
  } catch {
    /* alguns navegadores exigem chamada síncrona */
  }
}

function openPanel() {
  if (api.action?.openPopup) {
    try {
      Promise.resolve(api.action.openPopup()).catch(() => {});
      return;
    } catch {
      /* segue para a janela */
    }
  }
  try {
    api.windows.create({
      url: "popup.html",
      type: "popup",
      width: 380,
      height: 660,
    });
  } catch {
    /* ignora */
  }
}

function setupContextMenu() {
  if (!api.contextMenus?.create) return;
  const create = () => {
    const base = { id: "", title: "", contexts: ["action"] };
    const items = [
      { id: "cafe-register", title: "☕ Registrar café agora" },
      { id: "cafe-panel", title: "Abrir painel" },
      { id: "cafe-options", title: "Configurar" },
    ];
    try {
      api.contextMenus.removeAll(() => {
        void api.runtime.lastError;
        for (const item of items) {
          try {
            api.contextMenus.create(
              { ...base, ...item },
              () => void api.runtime.lastError,
            );
          } catch {
            /* item duplicado */
          }
        }
      });
    } catch {
      /* navegador sem menu de contexto na ação */
    }
  };
  create();
}

async function scheduleAlarms() {
  const config = await getConfig();
  const period = Math.max(1, config.watchMin);
  await api.alarms.clear(ALARM);
  api.alarms.create(ALARM, { periodInMinutes: period, delayInMinutes: 1 });
}

/* ------------------------------- eventos ------------------------------- */

api.runtime.onInstalled.addListener(async () => {
  const stored = await api.storage.local.get(Object.keys(DEFAULTS));
  const patch = {};
  for (const [key, value] of Object.entries(DEFAULTS)) {
    if (stored[key] === undefined) patch[key] = value;
  }
  // não notifica sobre cafés antigos na primeira execução
  if (!stored.lastTeamTs) patch.lastTeamTs = Date.now();
  if (Object.keys(patch).length > 0) await api.storage.local.set(patch);
  setupContextMenu();
  await syncActionBehavior();
  await scheduleAlarms();
});

api.runtime.onStartup.addListener(() => {
  setupContextMenu();
  void syncActionBehavior();
  void scheduleAlarms();
});

api.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM) void check();
});

api.notifications.onButtonClicked.addListener((notificationId) => {
  if (/^cafe-(reminder|first|team)/.test(String(notificationId))) {
    void quickRegister();
  }
});

api.contextMenus?.onClicked.addListener((info) => {
  if (info.menuItemId === "cafe-register") void quickRegister();
  if (info.menuItemId === "cafe-panel") openPanel();
  if (info.menuItemId === "cafe-options" && api.runtime.openOptionsPage) {
    api.runtime.openOptionsPage();
  }
});

api.commands?.onCommand.addListener((command) => {
  if (command === "registrar-cafe") void quickRegister();
  if (command === "abrir-painel") openPanel();
});

api.action?.onClicked.addListener(() => {
  // só dispara quando o popup está desligado (clique = registrar)
  void (async () => {
    const config = await getConfig();
    if (config.clickAction === "register") await quickRegister();
    else openPanel();
  })();
});

api.notifications.onClicked.addListener(async (notificationId) => {
  const config = await getConfig();
  if (String(notificationId).startsWith("cafe-") && config.baseUrl) {
    api.tabs.create({ url: config.baseUrl });
  }
  try {
    api.notifications.clear(notificationId);
  } catch {
    /* ignora */
  }
});

// Popup pede atualização imediata do badge/atividade; opções pedem reagendamento.
api.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "cafe:refresh") {
    check().finally(() => {
      if (typeof sendResponse === "function") sendResponse({ ok: true });
    });
    return true;
  }
  if (message?.type === "cafe:config") {
    Promise.all([syncActionBehavior(), scheduleAlarms()]).finally(() => {
      if (typeof sendResponse === "function") sendResponse({ ok: true });
    });
    return true;
  }
  return undefined;
});

// roda uma vez ao acordar o worker (garante menu/comportamento mesmo sem onInstalled)
void setupContextMenu();
void syncActionBehavior();
void scheduleAlarms();
void check();
