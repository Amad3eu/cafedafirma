"use client";

import { formatRating, sameName, type BrewDebt } from "@/lib/stats";
import { CupIcon, MugIcon, UserIcon } from "./Icons";

type Props = {
  days: number;
  ranking: BrewDebt[];
  /** quantas xícaras uma feita rende, em média, no período */
  perBrew: number;
  /** nome de quem está vendo, para dizer "é a sua vez" */
  name: string;
};

function cupsLabel(n: number): string {
  return `${n} ${n === 1 ? "xícara" : "xícaras"}`;
}

function brewsLabel(n: number): string {
  return `${n} ${n === 1 ? "café" : "cafés"}`;
}

function debtLabel(debt: number): string {
  const rounded = Math.round(Math.abs(debt));
  return rounded === 0 ? "quite" : debt > 0 ? `deve ${cupsLabel(rounded)}` : `${cupsLabel(rounded)} de crédito`;
}

/**
 * Rodízio justo: quem tomou mais xícaras do que as próprias feitas renderam
 * vai para a frente da fila. Usa feitas × xícaras dos últimos `days` dias.
 */
export default function NextBrewerCard({ days, ranking, perBrew, name }: Props) {
  const queue = ranking.filter((item) => item.debt > 0.5);
  const top = queue[0] ?? null;
  const generous = [...ranking].filter((item) => item.debt < -0.5).sort((a, b) => a.debt - b.debt)[0] ?? null;
  const isMe = top ? sameName(top.who, name) : false;

  return (
    <section className="rounded-2xl border border-latte/70 bg-card/70 p-4">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-espresso">
          <CupIcon size={15} className="text-caramel" />
          Quem faz o próximo?
        </h2>
        <span className="text-[11px] text-muted">últimos {days} dias</span>
      </div>

      {ranking.length === 0 ? (
        <p className="text-xs text-muted">
          Assim que a equipe registrar feitas e xícaras com nome, o app sugere de quem é a vez.
        </p>
      ) : top ? (
        <div
          className={`rounded-xl border px-3 py-3 ${
            isMe
              ? "border-caramel/50 bg-gradient-to-r from-caramel/15 to-caramel/5"
              : "border-latte/70 bg-cream/60"
          }`}
        >
          <p className="text-[10px] font-medium tracking-wide text-muted uppercase">
            sugestão de rodízio
          </p>
          <p className="mt-0.5 text-lg leading-tight font-semibold text-espresso">
            {isMe ? `É a sua vez, ${top.who}!` : `É a vez de ${top.who}`}
          </p>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-mocha">
            <span className="inline-flex items-center gap-1">
              <MugIcon size={12} className="text-cups" /> tomou {cupsLabel(top.cups)}
            </span>
            <span className="inline-flex items-center gap-1">
              <CupIcon size={12} className="text-caramel" /> fez {brewsLabel(top.brews)}
            </span>
            <span className="font-medium text-caramel-deep">{debtLabel(top.debt)}</span>
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-emerald-600/25 bg-emerald-600/10 px-3 py-3 text-xs text-emerald-900">
          <p className="font-semibold">Está todo mundo quite.</p>
          <p className="mt-0.5">Ninguém tomou mais do que fez no período. Vale a ordem de quem fez café há mais tempo.</p>
        </div>
      )}

      {queue.length > 1 ? (
        <ol className="mt-3 space-y-1">
          {queue.slice(1, 5).map((item, index) => (
            <li key={item.who} className="flex items-center gap-2 text-xs">
              <span className="w-5 text-center font-mono text-[10px] text-muted">{index + 2}.</span>
              <span className="min-w-0 flex-1 truncate font-medium text-espresso">
                {item.who}
                {sameName(item.who, name) ? <span className="text-muted"> (você)</span> : null}
              </span>
              <span className="text-muted">
                tomou {item.cups} · fez {item.brews}
              </span>
              <span className="w-24 text-right font-mono text-[11px] text-caramel-deep">{debtLabel(item.debt)}</span>
            </li>
          ))}
        </ol>
      ) : null}

      {generous ? (
        <p className="mt-3 inline-flex items-center gap-1 text-[11px] text-muted">
          <UserIcon size={11} />
          Quem mais segura a firma: <strong className="text-espresso">{generous.who}</strong>
          <span>
            (fez {generous.brews}, tomou {generous.cups})
          </span>
        </p>
      ) : null}

      <p className="mt-2 text-[10px] text-muted">
        Cada feita rende {formatRating(perBrew)} xícaras em média no período. Quem toma mais do que as próprias
        feitas renderam sobe na fila; empate vai para quem fez café há mais tempo.
      </p>
    </section>
  );
}
