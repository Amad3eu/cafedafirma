/* Café da Firma — opções */
const api = globalThis.browser ?? globalThis.chrome;
const DEFAULTS = { baseUrl: "", name: "", remindMin: 180 };

const el = (id) => document.getElementById(id);

function normalizeBase(url) {
  return String(url || "")
    .trim()
    .replace(/\/+$/, "");
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
  const base = normalizeBase(stored.baseUrl);
  if (base) el("open-site").href = base;
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
  });
  el("open-site").href = baseUrl;
  setStatus("Configurações salvas ☕", "ok");
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
