/**
 * Gera dados de demonstração em data/entries.json (apenas modo local/dev).
 * Uso: node scripts/seed-demo.cjs [--clear]
 */
const fs = require("node:fs");
const path = require("node:path");

const file = path.join(process.cwd(), "data", "entries.json");
fs.mkdirSync(path.dirname(file), { recursive: true });

if (process.argv.includes("--clear")) {
  fs.writeFileSync(file, "[]\n");
  console.log("dados de demonstração removidos");
  process.exit(0);
}

const people = ["Ana", "Bruno", "Fernanda", "Rafa", "Júlia", "Diego"];
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

const entries = [];
const now = new Date();

for (let daysAgo = 20; daysAgo >= 0; daysAgo--) {
  const base = new Date(now);
  base.setDate(base.getDate() - daysAgo);

  const weekDay = base.getDay();
  const isWeekend = weekDay === 0 || weekDay === 6;
  if (isWeekend && Math.random() > 0.25) continue;

  let cups = Math.max(2, Math.min(6, Math.round(3 + (Math.random() * 3 - 1.2))));
  if (daysAgo === 0) {
    cups = 3;
  }

  const used = new Set();
  for (let i = 0; i < cups; i++) {
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

    entries.push({
      id: uuid(),
      ts: stamp.getTime(),
      who: people[Math.floor(Math.random() * people.length)],
    });
  }
}

entries.sort((a, b) => a.ts - b.ts);
fs.writeFileSync(file, `${JSON.stringify(entries, null, 2)}\n`);
console.log(`gerados ${entries.length} registros de demonstração em ${file}`);
