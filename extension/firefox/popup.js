/* Café da Firma — popup (Chrome/Edge e Firefox) */
const api = globalThis.browser ?? globalThis.chrome;
const DEFAULTS = { baseUrl: "", name: "", remindMin: 180 };

const el = (id) => document.getElementById(id);

function normalizeBase(url) {
  return String(url || "")
    .trim()
    .replace(/\/+$/, "");
}

/** "https://site.com/*" a partir da URL base configurada. */
function originPattern(baseUrl) {
  try {
    const parsed = new URL(baseUrl);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    return `${parsed.origin}/*`;
  } catch {
    return null;
  }
}

/**
 * Firefox (MV3) NÃO concede permissões de host na instalação — nem em add-on
 * temporário. Sem isso, qualquer fetch para o site falha como CORS.
 */
async function hasHostAccess(baseUrl) {
  const pattern = originPattern(baseUrl);
  if (!pattern) return false;
  if (!api.permissions?.contains) return true;
  try {
    return await api.permissions.contains({ origins: [pattern] });
  } catch {
    return true;
  }
}

async function getConfig() {
  const stored = await api.storage.local.get(DEFAULTS);
  return {
    baseUrl: normalizeBase(stored.baseUrl),
    name: stored.name || "",
    remindMin: Number(stored.remindMin) || DEFAULTS.remindMin,
  };
}

async function fetchHistory(baseUrl) {
  const res = await fetch(`${baseUrl}/api/entries?days=30`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return {
    entries: Array.isArray(data.entries) ? data.entries : [],
    storage: data.storage || "unknown",
  };
}

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

function relative(ts) {
  const minutes = Math.floor((Date.now() - ts) / 60000);
  if (minutes < 1) return "agora";
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours < 24) return rest === 0 ? `há ${hours} h` : `há ${hours} h ${rest} min`;
  const days = Math.floor(hours / 24);
  return days === 1 ? "ontem" : `há ${days} dias`;
}

function duration(minutes) {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h${pad(m)}`;
}

function showError(message) {
  const box = el("error");
  box.textContent = message;
  box.hidden = !message;
}

let currentConfig = { ...DEFAULTS };

function render(entries, storage) {
  const now = Date.now();
  const today = entries.filter((entry) => sameDay(entry.ts, now));
  const week = entries.filter((entry) => entry.ts >= now - 7 * 86400000);
  const last = entries.reduce(
    (acc, entry) => (!acc || entry.ts > acc.ts ? entry : acc),
    null,
  );

  el("today-count").textContent = String(today.length);
  el("week-count").textContent = String(week.length);
  el("avg").textContent = (week.length / 7).toFixed(1).replace(".", ",");

  if (last) {
    const wasToday = sameDay(last.ts, now);
    el("last-label").textContent = wasToday
      ? "Último café de hoje"
      : "Último café registrado";
    el("last-time").textContent = timeLabel(last.ts);
    el("last-meta").textContent = `${relative(last.ts)}${last.who ? ` · ${last.who}` : ""}`;
  } else {
    el("last-label").textContent = "Último café";
    el("last-time").textContent = "--:--";
    el("last-meta").textContent = "nenhum registro ainda";
  }

  // aviso de "hora de cadastrar a feita"
  const reminder = el("reminder");
  const sinceMs = last ? now - last.ts : 0;
  const due = last && sameDay(last.ts, now) && sinceMs > currentConfig.remindMin * 60000;
  if (due) {
    el("reminder-text").textContent = `Já passou de ${duration(
      currentConfig.remindMin,
    )} desde as ${timeLabel(last.ts)}. Cadastre a feita do café!`;
    reminder.hidden = false;
  } else {
    reminder.hidden = true;
  }

  const list = el("list");
  list.textContent = "";
  const recent = [...today].reverse().slice(0, 6);
  if (recent.length === 0) {
    const li = document.createElement("li");
    li.className = "empty";
    li.textContent = "Nenhum café hoje ainda";
    list.appendChild(li);
  } else {
    for (const entry of recent) {
      const li = document.createElement("li");
      const time = document.createElement("span");
      time.className = "time";
      time.textContent = timeLabel(entry.ts);
      const meta = document.createElement("span");
      meta.textContent = `${relative(entry.ts)}${entry.who ? ` · ${entry.who}` : ""}`;
      li.append(time, meta);
      list.appendChild(li);
    }
  }

  showError(
    storage === "none"
      ? "O site está em modo local, então a extensão não vê os mesmos dados. Configure o Redis no projeto (veja o README)."
      : "",
  );
}

async function load() {
  const config = await getConfig();
  currentConfig = config;

  const dateText = new Date().toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
  });
  el("today-date").textContent =
    dateText.charAt(0).toUpperCase() + dateText.slice(1);

  if (!config.baseUrl) {
    el("setup").hidden = false;
    el("content").hidden = true;
    el("grant").hidden = true;
    return;
  }

  el("setup").hidden = true;
  el("open-site").href = config.baseUrl;

  // Firefox: sem permissão de host o fetch falha como CORS
  const granted = await hasHostAccess(config.baseUrl);
  if (!granted) {
    el("grant").hidden = false;
    el("content").hidden = true;
    showError("");
    return;
  }
  el("grant").hidden = true;
  el("content").hidden = false;

  try {
    const { entries, storage } = await fetchHistory(config.baseUrl);
    render(entries, storage);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    showError(
      /Failed to fetch|NetworkError|CORS/i.test(detail)
        ? "Sem acesso ao site. Clique em “Permitir acesso” (ou confira o endereço nas configurações)."
        : `Não foi possível falar com o site (${detail}). Confira o endereço nas configurações.`,
    );
  }
}

async function register() {
  const button = el("register");
  const flash = el("flash");
  button.disabled = true;
  button.textContent = "Registrando…";
  try {
    const res = await fetch(`${currentConfig.baseUrl}/api/entries`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ who: currentConfig.name || undefined }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const ts = data?.entry?.ts ?? Date.now();
    flash.textContent = `Café registrado às ${timeLabel(ts)} ☕`;
    flash.hidden = false;
    setTimeout(() => {
      flash.hidden = true;
    }, 4000);
    await load();
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    showError(
      /Failed to fetch|NetworkError|CORS/i.test(detail)
        ? "Sem acesso ao site. Clique em “Permitir acesso” e tente de novo."
        : `Não deu para registrar agora (${detail}).`,
    );
  } finally {
    button.disabled = false;
    button.textContent = "☕ Registrar café agora";
  }
}

el("register").addEventListener("click", register);
el("refresh").addEventListener("click", () => load());
el("open-options").addEventListener("click", () => {
  if (api.runtime.openOptionsPage) api.runtime.openOptionsPage();
});
el("setup-save").addEventListener("click", async () => {
  const value = normalizeBase(el("setup-url").value);
  if (!value) return;
  await api.storage.local.set({ baseUrl: value });
  await load();
});
el("setup-url").addEventListener("keydown", (event) => {
  if (event.key === "Enter") el("setup-save").click();
});

/**
 * Pedido de permissão: precisa acontecer DENTRO do clique e sem `await` antes,
 * senão o navegador descarta o gesto do usuário.
 */
el("grant-btn").addEventListener("click", () => {
  const pattern = originPattern(currentConfig.baseUrl);
  if (!pattern || !api.permissions?.request) {
    showError(
      "Abra as configurações e libere o acesso ao site em Permissões (about:addons).",
    );
    return;
  }
  api.permissions
    .request({ origins: [pattern] })
    .then((granted) => {
      if (granted) {
        showError("");
        return load();
      }
      showError(
        "Permissão não concedida. Sem ela a extensão não consegue falar com o site.",
      );
    })
    .catch(() => {
      showError(
        "Não foi possível pedir a permissão. Abra about:addons → Café da Firma → Permissões.",
      );
    });
});

load();
