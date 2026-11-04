/* Café da Firma — popup (Chrome/Edge e Firefox) */
const api = globalThis.browser ?? globalThis.chrome;
const DEFAULTS = { baseUrl: "", name: "", remindMin: 180, cupGoal: 4, pendingRate: null };
const RATING_LABELS = { 1: "ruim", 2: "fraco", 3: "ok", 4: "bom", 5: "ótimo" };
/** por quanto tempo a pergunta "como estava?" fica disponível depois da xícara */
const RATE_WINDOW_MS = 30 * 60 * 1000;

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
    cupGoal: Number.isFinite(Number(stored.cupGoal)) ? Number(stored.cupGoal) : DEFAULTS.cupGoal,
    pendingRate:
      stored.pendingRate && typeof stored.pendingRate === "object" ? stored.pendingRate : null,
  };
}

/** Uma única requisição traz feitas e xícaras (`cups=1`). */
async function fetchHistory(baseUrl) {
  const res = await fetch(`${baseUrl}/api/entries?days=30&cups=1`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return {
    entries: Array.isArray(data.entries) ? data.entries : [],
    // servidor antigo (sem /api/cups) não manda `cups`: a parte de consumo some
    cups: Array.isArray(data.cups) ? data.cups : null,
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

function sameName(a, b) {
  const na = String(a || "").trim().toLowerCase();
  return na.length > 0 && na === String(b || "").trim().toLowerCase();
}

function ratingText(avg) {
  return avg === null ? "—" : avg.toFixed(1).replace(".", ",");
}

/** xícaras + nota média por feita (chave = id da feita) */
function statsByBrew(cups) {
  const map = new Map();
  for (const cup of cups) {
    if (!cup.brewId) continue;
    const slot = map.get(cup.brewId) || { cups: 0, sum: 0, ratings: 0 };
    slot.cups += 1;
    if (cup.rating) {
      slot.sum += cup.rating;
      slot.ratings += 1;
    }
    map.set(cup.brewId, slot);
  }
  for (const slot of map.values()) slot.avg = slot.ratings ? slot.sum / slot.ratings : null;
  return map;
}

/**
 * Rodízio justo (mesma conta do site, lib/stats.ts): quem tomou mais xícaras
 * do que as próprias feitas renderam vai para a frente da fila.
 */
function nextBrewer(entries, cups) {
  if (entries.length === 0) return null;
  const ids = new Set(entries.map((entry) => entry.id));
  const linked = cups.filter((cup) => cup.brewId && ids.has(cup.brewId)).length;
  const perBrew = Math.max(1, linked / entries.length);

  const people = new Map();
  const slot = (who) => {
    const key = String(who || "").trim().toLowerCase();
    if (!key) return null;
    if (!people.has(key)) {
      people.set(key, { who: String(who).trim(), brews: 0, cups: 0, lastBrewTs: null });
    }
    return people.get(key);
  };
  for (const entry of entries) {
    const item = slot(entry.who);
    if (!item) continue;
    item.brews += 1;
    if (item.lastBrewTs === null || entry.ts > item.lastBrewTs) item.lastBrewTs = entry.ts;
  }
  for (const cup of cups) {
    const item = slot(cup.who);
    if (item) item.cups += 1;
  }
  const list = [...people.values()].map((item) => ({
    ...item,
    debt: item.cups - item.brews * perBrew,
  }));
  list.sort(
    (a, b) =>
      b.debt - a.debt ||
      (a.lastBrewTs ?? -Infinity) - (b.lastBrewTs ?? -Infinity) ||
      a.who.localeCompare(b.who),
  );
  return list.find((item) => item.debt > 0.5) || null;
}

function showError(message) {
  const box = el("error");
  box.textContent = message;
  box.hidden = !message;
}

function flash(message) {
  const box = el("flash");
  box.textContent = message;
  box.hidden = false;
  setTimeout(() => {
    box.hidden = true;
  }, 4000);
}

const ICON_CUP =
  '<svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 10h12v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5v-5Z"/><path d="M16 11h2.2a2.8 2.8 0 0 1 0 5.6H16"/></svg>';
const ICON_MUG =
  '<svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 8h11v8.5A3.5 3.5 0 0 1 12.5 20h-4A3.5 3.5 0 0 1 5 16.5V8Z"/><path d="M16 10h1.8a2.6 2.6 0 0 1 0 5.2H16"/></svg>';

const TEAM_ROWS = 4;
const LIST_ROWS = 3;

function numberCell(kind, value) {
  const span = document.createElement("span");
  span.className = `n n--${kind}${value === 0 ? " zero" : ""}`;
  const icon = document.createElement("span");
  icon.innerHTML = kind === "brews" ? ICON_CUP : ICON_MUG;
  span.append(icon.firstChild, document.createTextNode(String(value)));
  return span;
}

/** Equipe hoje: uma linha por pessoa com feitas e xícaras. */
function renderTeam(brews, cups) {
  const people = new Map();
  const slot = (who) => {
    const key = String(who || "").trim() || "sem nome";
    if (!people.has(key)) people.set(key, { who: key, brews: 0, cups: 0 });
    return people.get(key);
  };
  for (const entry of brews) slot(entry.who).brews += 1;
  for (const cup of cups) slot(cup.who).cups += 1;

  const rows = [...people.values()].sort(
    (a, b) => b.brews - a.brews || b.cups - a.cups || a.who.localeCompare(b.who),
  );
  const box = el("team-list");
  box.textContent = "";
  el("team-cols").hidden = rows.length === 0;
  if (rows.length === 0) {
    const li = document.createElement("li");
    li.className = "empty";
    li.textContent = "ninguém registrou café hoje ainda";
    box.append(li);
    return;
  }
  for (const row of rows.slice(0, TEAM_ROWS)) {
    const li = document.createElement("li");
    const who = document.createElement("span");
    who.className = "who";
    who.textContent = row.who;
    li.append(who, numberCell("brews", row.brews), numberCell("cups", row.cups));
    li.title = `${row.who}: fez ${row.brews}, tomou ${row.cups}`;
    box.append(li);
  }
  if (rows.length > TEAM_ROWS) {
    const li = document.createElement("li");
    li.className = "more";
    const rest = rows.length - TEAM_ROWS;
    li.textContent = `+ ${rest} ${rest === 1 ? "pessoa" : "pessoas"} — veja no site`;
    box.append(li);
  }
}

function skeletonRows(box, count) {
  box.textContent = "";
  for (let i = 0; i < count; i++) {
    const li = document.createElement("li");
    li.className = "skeleton-row";
    const bar = document.createElement("span");
    bar.className = "skeleton";
    li.append(bar);
    box.append(li);
  }
}

let currentConfig = { ...DEFAULTS };
let currentEntries = [];
let currentCups = [];

function render(entries, cups, storage) {
  const now = Date.now();
  const hasCups = cups !== null;
  const cupList = cups || [];
  const today = entries.filter((entry) => sameDay(entry.ts, now));
  const todayCups = cupList.filter((cup) => sameDay(cup.ts, now));
  const myCups = todayCups.filter((cup) => sameName(cup.who, currentConfig.name));
  const brewStats = statsByBrew(cupList);
  const last = entries.reduce(
    (acc, entry) => (!acc || entry.ts > acc.ts ? entry : acc),
    null,
  );

  // métricas
  el("today-count").textContent = String(today.length);
  el("cups-count").textContent = hasCups ? String(todayCups.length) : "—";
  el("my-cups").textContent = hasCups
    ? currentConfig.cupGoal > 0
      ? `${myCups.length}/${currentConfig.cupGoal}`
      : String(myCups.length)
    : "—";
  const rated = todayCups.filter((cup) => cup.rating);
  const todayAvg = rated.length
    ? rated.reduce((sum, cup) => sum + cup.rating, 0) / rated.length
    : null;
  el("today-rating").textContent = ratingText(todayAvg);
  el("today-rating").title = rated.length
    ? `${rated.length} avaliação(ões) hoje`
    : "sem avaliações hoje";

  // último café (nota da feita na mesma linha)
  if (last) {
    const wasToday = sameDay(last.ts, now);
    el("last-label").textContent = wasToday ? "Último café de hoje" : "Último café registrado";
    el("last-time").textContent = timeLabel(last.ts);
    const stats = brewStats.get(last.id);
    const parts = [relative(last.ts)];
    if (last.who) parts.push(last.who);
    if (stats && stats.avg !== null) parts.push(`★ ${ratingText(stats.avg)} (${stats.ratings})`);
    else if (stats && stats.cups > 0) parts.push(`${stats.cups} xíc.`);
    el("last-meta").textContent = parts.join(" · ");
  } else {
    el("last-label").textContent = "Último café";
    el("last-time").textContent = "--:--";
    el("last-meta").textContent = "nenhum registro ainda";
  }

  // sugestão de rodízio (últimos 30 dias) como pílula no bloco escuro
  const next = hasCups ? nextBrewer(entries, cupList) : null;
  const pill = el("next-brewer");
  if (next) {
    pill.textContent = "";
    pill.append(document.createTextNode("Próximo café: "));
    const who = document.createElement("strong");
    who.textContent = sameName(next.who, currentConfig.name) ? "você" : next.who;
    pill.append(who);
    pill.title = `${next.who} tomou ${next.cups} e fez ${next.brews} nos últimos 30 dias`;
    el("hero-foot").hidden = false;
  } else {
    el("hero-foot").hidden = true;
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

  // consumo: o botão só existe se o site sabe de xícaras; "você" avisa a meta
  el("drink").hidden = !hasCups;
  const goal = currentConfig.cupGoal;
  const over = hasCups && goal > 0 && myCups.length > goal;
  el("my-cups").parentElement.classList.toggle("stat--over", over);
  el("my-cups").title = over
    ? `Acima da meta de ${goal} xícaras`
    : goal > 0
      ? `Meta: ${goal} xícaras por dia`
      : "";

  // equipe hoje
  renderTeam(today, hasCups ? todayCups : []);

  // lista de hoje: 3 visíveis, o resto atrás de "ver todos"
  const list = el("list");
  list.textContent = "";
  list.classList.remove("list--all");
  const recent = [...today].reverse();
  el("today-card").hidden = recent.length === 0;
  recent.forEach((entry, index) => {
    const li = document.createElement("li");
    if (index >= LIST_ROWS) li.className = "extra";
    const time = document.createElement("span");
    time.className = "time";
    time.textContent = timeLabel(entry.ts);
    const meta = document.createElement("span");
    meta.className = "meta";
    meta.textContent = `${relative(entry.ts)}${entry.who ? ` · ${entry.who}` : ""}`;
    li.append(time, meta);
    const stats = brewStats.get(entry.id);
    if (stats && stats.cups > 0) {
      const badge = document.createElement("span");
      badge.className = "brew-stats";
      badge.textContent =
        `${stats.cups} xíc.` + (stats.avg !== null ? ` · ★ ${ratingText(stats.avg)}` : "");
      badge.title = `${stats.cups} xícara(s) desta feita · ${stats.ratings} avaliada(s)`;
      li.append(badge);
    }
    list.appendChild(li);
  });
  const more = el("list-more");
  more.hidden = recent.length <= LIST_ROWS;
  more.textContent = `ver todos (${recent.length})`;

  renderRateCard(cupList, entries);

  showError(
    storage === "none"
      ? "O site está em modo local, então a extensão não vê os mesmos dados. Configure o Redis no projeto (veja o README)."
      : "",
  );
}

/** Mostra "Como estava o café?" para a xícara recém-registrada (até 30 min). */
function renderRateCard(cups, entries) {
  const card = el("rate-card");
  const pending = currentConfig.pendingRate;
  if (!pending || !pending.id || Date.now() > Number(pending.until || 0)) {
    card.hidden = true;
    return;
  }
  const cup = cups.find((item) => item.id === pending.id);
  if (!cup) {
    card.hidden = true;
    return;
  }
  const brew = cup.brewId ? entries.find((entry) => entry.id === cup.brewId) : null;
  el("rate-brew").textContent = brew
    ? `(feita das ${timeLabel(brew.ts)}${brew.who ? ` por ${brew.who}` : ""})`
    : "";
  paintStars(cup.rating || 0);
  card.hidden = false;
}

function paintStars(value) {
  for (const button of el("stars").querySelectorAll("button")) {
    const rating = Number(button.dataset.rating);
    const on = rating <= value;
    button.classList.toggle("on", on);
    button.textContent = on ? "★" : "☆";
    button.setAttribute("aria-checked", rating === value ? "true" : "false");
  }
  el("stars-label").textContent = value ? RATING_LABELS[value] : "toque numa estrela";
}

async function load() {
  showError("");
  const config = await getConfig();
  currentConfig = config;

  const dateText = new Date().toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
  });
  el("today-date").textContent = dateText.charAt(0).toUpperCase() + dateText.slice(1);

  if (!config.baseUrl) {
    el("setup").hidden = false;
    el("content").hidden = true;
    el("grant").hidden = true;
    el("namebox").hidden = true;
    return;
  }

  // pede o nome na primeira vez (é o que identifica os cafés na equipe)
  const needName = !config.name.trim();
  el("namebox").hidden = !needName;
  if (needName) {
    el("name-input").value = "";
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

  // esqueleto: mantém a altura enquanto os dados não chegam
  if (currentEntries.length === 0) {
    skeletonRows(el("team-list"), 3);
    skeletonRows(el("list"), 3);
    el("team-cols").hidden = true;
    el("today-card").hidden = false;
    el("list-more").hidden = true;
  }

  try {
    const { entries, cups, storage } = await fetchHistory(config.baseUrl);
    currentEntries = entries;
    currentCups = cups || [];
    render(entries, cups, storage);

    // atualiza o badge do ícone na hora em que o popup abre
    try {
      Promise.resolve(api.runtime.sendMessage({ type: "cafe:refresh" })).catch(() => {});
    } catch {
      /* navegador sem runtime.sendMessage disponível */
    }
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    showError(
      /Failed to fetch|NetworkError|CORS/i.test(detail)
        ? "Sem acesso ao site. Clique em “Permitir acesso” (ou confira o endereço nas configurações)."
        : `Não foi possível falar com o site (${detail}). Confira o endereço nas configurações.`,
    );
  }
}

function requireName() {
  if (currentConfig.name.trim()) return true;
  el("namebox").hidden = false;
  el("name-input").focus();
  showError("Defina seu nome antes de registrar — é o que aparece para a equipe.");
  return false;
}

function networkMessage(error, fallback) {
  const detail = error instanceof Error ? error.message : String(error);
  return /Failed to fetch|NetworkError|CORS/i.test(detail)
    ? "Sem acesso ao site. Clique em “Permitir acesso” e tente de novo."
    : `${fallback} (${detail}).`;
}

async function register() {
  if (!requireName()) return;
  const button = el("register");
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
    flash(`Café registrado às ${timeLabel(ts)} ☕`);
    await load();
  } catch (error) {
    showError(networkMessage(error, "Não deu para registrar agora"));
  } finally {
    button.disabled = false;
    button.textContent = "☕ Registrar café agora";
  }
}

/** "Tomei um café": grava a xícara (o servidor liga à feita ativa) e pede a nota. */
async function drink() {
  if (!requireName()) return;
  const button = el("drink");
  button.disabled = true;
  try {
    const res = await fetch(`${currentConfig.baseUrl}/api/cups`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ who: currentConfig.name }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const cup = data?.cup;
    if (!cup) throw new Error("sem banco no site");
    await api.storage.local.set({
      pendingRate: { id: cup.id, until: Date.now() + RATE_WINDOW_MS },
    });
    flash(`Xícara registrada às ${timeLabel(cup.ts)} — como estava o café?`);
    await load();
    el("rate-card").scrollIntoView({ block: "nearest" });
  } catch (error) {
    showError(networkMessage(error, "Não deu para registrar a xícara"));
  } finally {
    button.disabled = false;
  }
}

async function rate(rating) {
  const pending = currentConfig.pendingRate;
  if (!pending?.id) return;
  const current = currentCups.find((cup) => cup.id === pending.id);
  // clicar na nota atual limpa a nota
  const next = current && current.rating === rating ? null : rating;
  paintStars(next || 0);
  try {
    const res = await fetch(
      `${currentConfig.baseUrl}/api/cups?id=${encodeURIComponent(pending.id)}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating: next }),
      },
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    if (next) {
      flash(`Nota ${next} (${RATING_LABELS[next]}) registrada. Valeu!`);
      // avaliou: some com a pergunta
      await api.storage.local.set({ pendingRate: null });
    }
    await load();
  } catch (error) {
    showError(networkMessage(error, "Não deu para salvar a nota"));
  }
}

el("register").addEventListener("click", register);
el("drink").addEventListener("click", drink);
el("stars").addEventListener("click", (event) => {
  const button = event.target.closest("button[data-rating]");
  if (button) void rate(Number(button.dataset.rating));
});
el("refresh").addEventListener("click", () => load());
el("list-more").addEventListener("click", () => {
  const list = el("list");
  const all = list.classList.toggle("list--all");
  const total = list.querySelectorAll("li").length;
  el("list-more").textContent = all ? "ver menos" : `ver todos (${total})`;
});
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

async function saveNameFromPopup() {
  const value = el("name-input").value.trim().slice(0, 20);
  if (!value) {
    showError("Digite um nome para continuar.");
    return;
  }
  await api.storage.local.set({ name: value });
  showError("");
  el("namebox").hidden = true;
  await load();
}

el("name-save").addEventListener("click", saveNameFromPopup);
el("name-input").addEventListener("keydown", (event) => {
  if (event.key === "Enter") void saveNameFromPopup();
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
