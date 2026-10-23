"use client";

import { DownloadIcon, PuzzleIcon } from "./Icons";

export default function ExtensionCard({ siteUrl }: { siteUrl: string }) {
  return (
    <div className="rounded-2xl border border-latte/70 bg-card/80 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-semibold text-espresso">
            <PuzzleIcon size={15} className="text-caramel" />
            Extensão para o navegador
          </h2>
          <p className="mt-1 max-w-lg text-xs text-muted">
            Registre a feita do café sem abrir o site, direto do ícone na barra
            do Chrome, Edge ou Firefox. A extensão também avisa por notificação
            quando o intervalo passa.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a
            href="/extensao-cafe-chrome.zip"
            download
            className="inline-flex items-center gap-1.5 rounded-xl bg-espresso px-3.5 py-2 text-xs font-semibold text-cream transition hover:bg-espresso-soft"
          >
            <DownloadIcon size={14} /> Chrome / Edge
          </a>
          <a
            href="/extensao-cafe-firefox.zip"
            download
            className="inline-flex items-center gap-1.5 rounded-xl border border-espresso/20 bg-cream px-3.5 py-2 text-xs font-semibold text-espresso transition hover:bg-cream-deep"
          >
            <DownloadIcon size={14} /> Firefox
          </a>
        </div>
      </div>

      <details className="group mt-3">
        <summary className="cursor-pointer list-none text-xs font-medium text-caramel-deep hover:underline">
          Como instalar
        </summary>
        <div className="mt-2 grid gap-3 text-xs text-mocha sm:grid-cols-2">
          <div className="rounded-xl bg-cream/70 p-3">
            <p className="font-semibold text-espresso">Chrome / Edge</p>
            <ol className="mt-1 list-decimal space-y-0.5 pl-4">
              <li>Baixe e descompacte o .zip</li>
              <li>
                Abra <code>chrome://extensions</code>
              </li>
              <li>Ative o “Modo do desenvolvedor”</li>
              <li>Clique em “Carregar sem compactação” e escolha a pasta</li>
              <li>Abra as opções da extensão e cole o endereço do site</li>
            </ol>
          </div>
          <div className="rounded-xl bg-cream/70 p-3">
            <p className="font-semibold text-espresso">Firefox</p>
            <ol className="mt-1 list-decimal space-y-0.5 pl-4">
              <li>Baixe o .zip do Firefox</li>
              <li>
                Abra <code>about:debugging#/runtime/this-firefox</code>
              </li>
              <li>“Carregar complemento temporário”</li>
              <li>
                Selecione o arquivo <code>manifest.json</code>
              </li>
              <li>Nas opções, cole o endereço do site</li>
            </ol>
          </div>
        </div>
        <p className="mt-2 text-[11px] text-muted">
          Endereço deste site:{" "}
          <code className="rounded bg-cream-deep px-1 py-0.5">{siteUrl}</code>
        </p>
      </details>
    </div>
  );
}
