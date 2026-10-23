import { redisCommand, redisConfig, redisConfigured } from "@/lib/redis";
import type { CoffeeEntry } from "@/lib/types";
import { listEntries, storageKind } from "@/lib/store";

export const dynamic = "force-dynamic";

const REDIS_KEY = "cafe:entries";

/**
 * Diagnóstico do armazenamento — não expõe segredos.
 * Mostra qual variável de ambiente foi detectada, o host, quantos cafés existem
 * e faz um teste de escrita + leitura para provar que o banco aceita gravação.
 */
export async function GET() {
  const urlVar =
    Object.keys(process.env).find(
      (key) =>
        /_URL$/.test(key) &&
        /upstash|redis/i.test(process.env[key] ?? "") &&
        Object.keys(process.env).some((token) => {
          const base = key.replace(/_URL$/, "");
          return token === `${base}_TOKEN` || token === `${base}_REST_API_TOKEN`;
        }),
    ) ?? null;

  const config = redisConfig();
  const kind = storageKind();

  const report: Record<string, unknown> = {
    storage: kind,
    detectedUrlVar: urlVar,
    host: config ? safeHost(config.url) : null,
    roundTrip: null,
    total: null,
    recent: [] as Pick<CoffeeEntry, "ts" | "who">[],
    error: null as string | null,
  };

  if (!redisConfigured()) {
    report.error = "Nenhuma variável de Redis encontrada no ambiente.";
    return Response.json(report, { headers: { "Cache-Control": "no-store" } });
  }

  try {
    // 1) quantos registros existem hoje
    report.total = await redisCommand<number>(["ZCARD", REDIS_KEY]);

    // 2) teste de ida e volta (grava, lê e apaga uma chave temporária)
    const probeKey = "cafe:health";
    const value = `${Date.now()}`;
    await redisCommand(["SET", probeKey, value, "EX", 60]);
    const readBack = await redisCommand<string>(["GET", probeKey]);
    await redisCommand(["DEL", probeKey]);
    report.roundTrip = readBack === value;

    // 3) últimos registros gravados
    const raw = await redisCommand<string[]>(["ZRANGE", REDIS_KEY, -3, -1]);
    const parsedRecent: { ts: number; who?: string }[] = [];
    for (const item of raw ?? []) {
      try {
        const parsed = JSON.parse(item) as CoffeeEntry;
        parsedRecent.push({ ts: parsed.ts, who: parsed.who });
      } catch {
        /* item inválido, ignora */
      }
    }
    report.recent = parsedRecent;
  } catch (error) {
    report.error = error instanceof Error ? error.message : String(error);
  }

  // confirma que a leitura usada pelo app enxerga os dados
  try {
    const entries = await listEntries(Date.now() - 400 * 24 * 60 * 60 * 1000);
    report.visibleToApp = entries.length;
  } catch {
    report.visibleToApp = null;
  }

  return Response.json(report, { headers: { "Cache-Control": "no-store" } });
}

function safeHost(url: string): string | null {
  try {
    return new URL(url).host;
  } catch {
    return null;
  }
}
