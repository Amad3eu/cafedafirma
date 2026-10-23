/* Café da Firma — opções */
const api = globalThis.browser ?? globalThis.chrome;
const DEFAULTS = {
  baseUrl: "",
  name: "",
  remindMin: 180,
  afternoonMin: 240,
  firstAt: 8,
  teamNotify: true,
  watchMin: 2,
  clickAction: "popup",
};

const el = (id) => document.getElementById(id);

function normalizeBase(url) {
  return String(url || "")
    .trim()
    .replace(/\/+$/, "");
}

function originPattern(baseUrl) {
  try {
    const parsed = new URL(baseUrl);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    return `${parsed.origin}/*`;
  } catch {
    return null;
  }
}

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

async function refreshGrantBanner() {
  const baseUrl = normalizeBase(el("baseUrl").value);
  const banner = el("grant");
  if (!baseUrl) {
    banner.hidden = true;
    return;
  }
  const granted = await hasHostAccess(baseUrl);
  banner.hidden = granted;
}

function setStatus(message, kind) {
  const box = el("status");
  box.textContent = message;
  box.className = `status ${kind}`;
  box.hidden = !message;
}

async function restore() {
  const stored = await api.storage.local.get(DEFAULTS);
  el("baseUrl").value = stored.baseUrl || "";
  el("name").value = stored.name || "";
  el("remindMin").value = String(stored.remindMin || DEFAULTS.remindMin);
  el("afternoonMin").value = String(stored.afternoonMin || DEFAULTS.afternoonMin);
  el("firstAt").value = String(
    Number.isFinite(Number(stored.firstAt)) ? Number(stored.firstAt) : DEFAULTS.firstAt,
  );
  el("teamNotify").value = stored.teamNotify === false ? "0" : "1";
  el("watchMin").value = String(stored.watchMin || DEFAULTS.watchMin);
  el("clickAction").value = stored.clickAction === "register" ? "register" : "popup";
  const base = normalizeBase(stored.baseUrl);
  if (base) el("open-site").href = base;
  await refreshGrantBanner();
}

el("form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const baseUrl = normalizeBase(el("baseUrl").value);
  if (!/^https?:\/\/.+/.test(baseUrl)) {
    setStatus("Informe um endereço começando com http:// ou https://", "bad");
    return;
  }
  await api.storage.local.set({
    baseUrl,
    name: el("name").value.trim().slice(0, 20),
    remindMin: Number(el("remindMin").value) || DEFAULTS.remindMin,
    afternoonMin: Number(el("afternoonMin").value) || DEFAULTS.afternoonMin,
    firstAt: Number(el("firstAt").value),
    teamNotify: el("teamNotify").value === "1",
    watchMin: Number(el("watchMin").value) || DEFAULTS.watchMin,
    clickAction: el("clickAction").value === "register" ? "register" : "popup",
  });

  // avisa o background para reagendar as verificações
  try {
    Promise.resolve(api.runtime.sendMessage({ type: "cafe:config" })).catch(
      () => {},
    );
  } catch {
    /* ignora */
  }
  el("open-site").href = baseUrl;
  setStatus("Configurações salvas ☕", "ok");
  await refreshGrantBanner();
});

el("test").addEventListener("click", async () => {
  const baseUrl = normalizeBase(el("baseUrl").value);
  if (!baseUrl) {
    setStatus("Preencha o endereço do site primeiro.", "bad");
    return;
  }
  setStatus("Testando…", "ok");
  try {
    const res = await fetch(`${baseUrl}/api/entries?days=30`, {
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const entries = Array.isArray(data.entries) ? data.entries : [];
    const today = new Date();
    const todayCount = entries.filter((entry) => {
      const d = new Date(entry.ts);
      return (
        d.getFullYear() === today.getFullYear() &&
        d.getMonth() === today.getMonth() &&
        d.getDate() === today.getDate()
      );
    }).length;
    const extra =
      data.storage === "redis"
        ? "histórico compartilhado"
        : "modo local (sem Redis no site)";
    setStatus(
      `Conectado! ${entries.length} registro(s) no período · ${todayCount} hoje · ${extra}`,
      "ok",
    );
  } catch {
    setStatus(
      "Não foi possível conectar. Confira o endereço e se o site está no ar.",
      "bad",
    );
  }
});

restore();

// Pedido de permissão tem de ocorrer no clique, sem await antes.
el("grant-btn").addEventListener("click", () => {
  const pattern = originPattern(normalizeBase(el("baseUrl").value));
  if (!pattern || !api.permissions?.request) {
    setStatus(
      "Abra about:addons → Café da Firma → Permissões e libere o acesso ao site.",
      "bad",
    );
    return;
  }
  api.permissions
    .request({ origins: [pattern] })
    .then((granted) => {
      if (granted) {
        setStatus("Acesso liberado! Agora clique em “Testar conexão”.", "ok");
        return refreshGrantBanner();
      }
      setStatus("Permissão não concedida — a extensão não vai conseguir acessar o site.", "bad");
    })
    .catch(() => {
      setStatus(
        "Não foi possível pedir a permissão. Use about:addons → Permissões.",
        "bad",
      );
    });
});

// Notificação de teste: ajuda a verificar se o sistema/navegador permite avisos.
el("test-notify").addEventListener("click", () => {
  if (!api.notifications?.create) {
    setStatus("Este navegador não expõe a API de notificações.", "bad");
    return;
  }
  const options = {
    type: "basic",
    iconUrl: "icons/icon-128.png",
    title: "Teste — Café da Firma ☕",
    message: "Se você está vendo isto, as notificações da extensão funcionam.",
    priority: 1,
  };
  try {
    api.notifications.create(`cafe-test-${Date.now()}`, options, () => {
      void api.runtime?.lastError;
    });
    setStatus(
      "Notificação enviada. Se nada aparecer, verifique as permissões de notificação do navegador e o modo “Não perturbe” do sistema.",
      "ok",
    );
  } catch {
    setStatus("Não foi possível enviar a notificação de teste.", "bad");
  }
});
