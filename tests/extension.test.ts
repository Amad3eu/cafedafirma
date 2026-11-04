/**
 * Garante que a extensão está consistente:
 * - Firefox é uma cópia de Chrome (só o manifest difere);
 * - as versões (chrome, firefox e package.json) batem;
 * - os scripts têm sintaxe válida;
 * - as chaves que importam do manifest existem.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dirname, "..");
const read = (rel: string) => readFileSync(join(root, rel), "utf8");
const manifest = (b: string) => JSON.parse(read(`extension/${b}/manifest.json`));

const SHARED = [
  "background.js",
  "popup.html",
  "popup.css",
  "popup.js",
  "options.html",
  "options.css",
  "options.js",
];

describe("extensão", () => {
  it("firefox espelha chrome nos arquivos compartilhados", () => {
    for (const file of SHARED) {
      assert.equal(
        read(`extension/firefox/${file}`),
        read(`extension/chrome/${file}`),
        `${file} divergiu — rode npm run build:ext`,
      );
    }
  });

  it("versões iguais em chrome, firefox e package.json", () => {
    const pkg = JSON.parse(read("package.json"));
    assert.equal(manifest("chrome").version, pkg.version);
    assert.equal(manifest("firefox").version, pkg.version);
  });

  it("scripts com sintaxe válida", () => {
    for (const b of ["chrome", "firefox"]) {
      for (const f of ["background.js", "popup.js", "options.js"]) {
        assert.doesNotThrow(() => new Function(read(`extension/${b}/${f}`)), `${b}/${f}`);
      }
    }
  });

  it("manifests MV3 com permissões, comandos e background certos", () => {
    for (const b of ["chrome", "firefox"] as const) {
      const m = manifest(b);
      assert.equal(m.manifest_version, 3);
      assert.ok(m.action?.default_popup);
      for (const p of ["storage", "notifications", "alarms", "contextMenus"]) {
        assert.ok(m.permissions.includes(p), `${b}: permissão ${p}`);
      }
      assert.deepEqual(Object.keys(m.commands), ["registrar-cafe", "tomei-cafe", "abrir-painel"]);
      assert.ok(m.icons?.["128"]);
      if (b === "chrome") assert.ok(m.background?.service_worker);
      if (b === "firefox") {
        assert.ok(Array.isArray(m.background?.scripts));
        assert.ok(m.browser_specific_settings?.gecko?.id);
      }
    }
  });

  it("popup e background usam a mesma API de xícaras", () => {
    const popup = read("extension/chrome/popup.js");
    const background = read("extension/chrome/background.js");
    for (const src of [popup, background]) {
      assert.match(src, /\/api\/cups/);
      assert.match(src, /method: "PATCH"/);
    }
    assert.match(popup, /cups=1/, "popup lê feitas e xícaras numa requisição só");
  });
});
