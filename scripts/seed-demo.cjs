/**
 * Gera dados de demonstração (apenas modo local/dev):
 *   data/entries.json  -> feitas (quando o café foi passado)
 *   data/cups.json     -> xícaras tomadas, ligadas à feita, com notas
 *
 * Uso: node scripts/seed-demo.cjs [--clear]
 */
const fs = require("node:fs");
const path = require("node:path");

const dir = path.join(process.cwd(), "data");
const entriesFile = path.join(dir, "entries.json");
const cupsFile = path.join(dir, "cups.json");
fs.mkdirSync(dir, { recursive: true });

if (process.argv.includes("--clear")) {
  fs.writeFileSync(entriesFile, "[]\n");
  fs.writeFileSync(cupsFile, "[]\n");
  console.log("dados de demonstração removidos");
  process.exit(0);
}

// quem faz café e quão bom costuma ser (média alvo das notas)
const brewers = [
  ["Ana", 4.4],
  ["Bruno", 3.2],
  ["Fernanda", 4.8],
  ["Rafa", 3.8],
  ["Júlia", 4.1],
  ["Diego", 2.9],
];
const drinkers = ["Ana", "Bruno", "Fernanda", "Rafa", "Júlia", "Diego", "Caio", "Lívia"];
const patterns = [
  [8, 15],
  [10, 30],
  [13, 40],
  [15, 20],
  [16, 50],
  [9, 5],
  [11, 10],
];

function uuid() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function pick(list) {
  return list[Math.floor(Math.random() * list.length)];
}

/** nota 1..5 em torno de uma média, com um pouco de ruído */
function ratingAround(mean) {
  const noise = (Math.random() + Math.random() - 1) * 1.6;
  return Math.max(1, Math.min(5, Math.round(mean + noise)));
}

const entries = [];
const cups = [];
const now = new Date();

for (let daysAgo = 20; daysAgo >= 0; daysAgo--) {
  const base = new Date(now);
  base.setDate(base.getDate() - daysAgo);

  const weekDay = base.getDay();
  const isWeekend = weekDay === 0 || weekDay === 6;
  if (isWeekend && Math.random() > 0.25) continue;

  let brews = Math.max(2, Math.min(6, Math.round(3 + (Math.random() * 3 - 1.2))));
  if (daysAgo === 0) brews = 3;

  const used = new Set();
  for (let i = 0; i < brews; i++) {
    const pattern = patterns[i % patterns.length];
    const jitter = Math.floor(Math.random() * 35) - 17;
    let hour = pattern[0];
    let minute = pattern[1] + jitter;
    if (minute < 0) {
      minute += 60;
      hour -= 1;
    }
    if (minute > 59) {
      minute -= 60;
      hour += 1;
    }

    const stamp = new Date(base);
    stamp.setHours(hour, minute, Math.floor(Math.random() * 50), 0);
    if (daysAgo === 0 && stamp.getTime() > now.getTime() - 90 * 60 * 1000) {
      // garante que o "último café de hoje" já passou do intervalo de aviso
      stamp.setTime(now.getTime() - (120 + i * 55) * 60 * 1000);
    }
    if (daysAgo === 0 && stamp.getTime() > now.getTime()) continue;

    const key = `${stamp.getHours()}:${stamp.getMinutes()}`;
    if (used.has(key)) continue;
    used.add(key);

    const [who, quality] = pick(brewers);
    const brew = { id: uuid(), ts: stamp.getTime(), who };
    entries.push(brew);

    // 1 a 4 pessoas tomam dessa feita nos 90 min seguintes; ~75% dão nota
    const takers = [...drinkers].sort(() => Math.random() - 0.5).slice(0, 1 + Math.floor(Math.random() * 4));
    for (const drinker of takers) {
      const ts = brew.ts + (5 + Math.floor(Math.random() * 85)) * 60 * 1000;
      if (ts > now.getTime()) continue;
      const cup = { id: uuid(), ts, who: drinker, brewId: brew.id };
      if (Math.random() < 0.75) cup.rating = ratingAround(quality);
      cups.push(cup);
    }
  }
}

entries.sort((a, b) => a.ts - b.ts);
cups.sort((a, b) => a.ts - b.ts);
fs.writeFileSync(entriesFile, `${JSON.stringify(entries, null, 2)}\n`);
fs.writeFileSync(cupsFile, `${JSON.stringify(cups, null, 2)}\n`);
console.log(
  `gerados ${entries.length} feitas em ${entriesFile} e ${cups.length} xícaras em ${cupsFile}`,
);
