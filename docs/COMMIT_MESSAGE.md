# Mensagem de commit — Café da Firma

Escolha **uma** das opções abaixo. A recomendada é a **Opção A** (Conventional Commits,
com corpo explicando o que veio no projeto).

---

## ✅ Opção A — completa (recomendada)

```
feat: adiciona Café da Firma, app de registro das feitas de café

Site em Next.js 16 (App Router) + React 19 + Tailwind 4, pronto para deploy
na Vercel, com extensão para Chrome, Edge e Firefox.

Principais recursos:
- registro do café em um clique (com opção de informar um horário passado)
- aviso "hora de cadastrar a feita" quando o intervalo configurado passa
  (1h a 6h), com confirmação e desfazer
- cartão do último café com "há quanto tempo" e quem registrou
- lista dos cafés de hoje e histórico agrupado por dia (60 dias)
- gráficos de cafés por dia (14 dias) e por hora, com horário de pico
- métricas de hoje, últimos 7 dias, média por dia e pico
- exportação do histórico em CSV

Backend:
- API REST /api/entries (GET, POST, DELETE) com CORS liberado para a extensão
- persistência em Upstash Redis / Vercel KV via API REST (sem dependências)
- fallback em arquivo local (dev) e em localStorage no navegador,
  com aviso na interface quando não há banco configurado

Extensão (MV3):
- popup com último café, contadores e botão de registrar
- badge com o total de cafés do dia
- notificação quando o intervalo passa e página de opções

Outros:
- ícones gerados por script (sem dependências externas)
- scripts de seed de demonstração e de empacotamento da extensão
- README com passo a passo de deploy na Vercel e instalação da extensão
```

---

## ⚡ Opção B — curta (uma linha)

```
feat: adiciona Café da Firma, app de registro das feitas de café com aviso, histórico e gráficos
```

---

## 🧾 Opção C — em inglês (se preferir repo internacional)

```
feat: add Café da Firma, a coffee round tracker

- one-click coffee logging with optional manual time
- "time for coffee" reminder after a configurable interval (1h–6h)
- today log, day-by-day history (60 days) and CSV export
- per-day and per-hour charts plus key metrics
- REST API (/api/entries) backed by Upstash Redis / Vercel KV
  with local file and localStorage fallbacks
- MV3 browser extension for Chrome, Edge and Firefox (popup, badge, notifications)
- README with Vercel deploy and extension install steps
```

---

## 🚀 Comandos para publicar no GitHub

```bash
cd cafe-tracker

git init
git add .
git commit -F commit-message.txt        # usa a Opção A salva neste projeto
git branch -M main
git remote add origin https://github.com/SEU-USUARIO/cafe-da-firma.git
git push -u origin main
```

> Se preferir colar a mensagem na hora, use `git commit -m "..."` (Opção B) ou
> `git commit` e digite a Opção A no editor que abrir.

### Já tem um repositório criado no GitHub?

Se o repo foi criado com README/license, faça:

```bash
git init
git add .
git commit -F commit-message.txt
git branch -M main
git remote add origin https://github.com/SEU-USUARIO/cafe-da-firma.git
git pull --rebase origin main   # traz o README do GitHub (se existir)
git push -u origin main
```

### Antes de dar o push, confira

```bash
git status        # node_modules, .next, .env e data/entries.json devem estar ignorados
git log --oneline # deve mostrar 1 commit
```

Esses itens já estão no `.gitignore`: `node_modules`, `.next`, `.env*`,
`data/entries.json`, arquivos de build e `.vercel`.

---

## 📌 Depois, na Vercel

1. <https://vercel.com/new> → importe o repositório → **Deploy**.
2. **Storage → Create Database → Upstash Redis** e conecte ao projeto
   (para o histórico ser compartilhado com a equipe).
3. **Redeploy** para carregar as variáveis `UPSTASH_REDIS_REST_URL` e
   `UPSTASH_REDIS_REST_TOKEN`.

Sugestão de descrição curta para o repositório (campo *About*):

> ☕ Registre as feitas de café da firma em um clique, com aviso, histórico e gráficos. Next.js 16 + extensão de navegador.

Tópicos: `nextjs` `react` `typescript` `tailwindcss` `vercel` `browser-extension` `coffee`
