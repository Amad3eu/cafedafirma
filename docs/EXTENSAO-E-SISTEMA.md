# 🧩 Extensão + como o sistema funciona

Este documento responde duas perguntas:

1. **Como transformar isso em extensão?** → já está feito; aqui está como instalar e publicar.
2. **Como o sistema funciona e ele está completo?** → arquitetura, fluxos e checklist honesto.

---

## 1. A extensão já existe no projeto

```
extension/
├─ chrome/     # manifest MV3 para Chrome e Edge
│  ├─ manifest.json
│  ├─ popup.html / popup.css / popup.js      # janela do ícone
│  ├─ options.html / options.css / options.js # configurações
│  ├─ background.js                           # badge + notificações
│  └─ icons/icon-16/32/48/128.png
└─ firefox/    # mesmos arquivos, manifest MV3 para o Gecko (id + strict_min_version)
```

E os pacotes prontos ficam em `public/`:

- `public/extensao-cafe-chrome.zip` (Chrome, Edge, Brave, Opera)
- `public/extensao-cafe-firefox.zip` (Firefox)

Eles são gerados por `npm run build:ext` e também são baixados pelo próprio site (card "Extensão para o navegador").

### O que a extensão faz

| Recurso | Detalhe |
| --- | --- |
| Popup | Último café + "há quanto tempo", cafés de hoje, 7 dias, média/dia, lista dos cafés do dia |
| Aviso | Banner laranja quando passou do intervalo configurado (1h–6h) |
| Botão | "Registrar café agora" (um clique, usa o nome configurado) |
| Badge | Número de cafés do dia no ícone da barra |
| Notificação | A cada 5 min o service worker confere; se passou do intervalo, dispara notificação do SO (clicar abre o site) |
| Opções | Endereço do site, seu nome, intervalo do aviso e botão "Testar conexão" |

---

## 2. Instalar agora (uso interno, 2 minutos por pessoa)

### Chrome / Edge
1. Baixe `extensao-cafe-chrome.zip` e **descompacte** em uma pasta fixa.
2. Abra `chrome://extensions` (ou `edge://extensions`).
3. Ative **Modo do desenvolvedor**.
4. **Carregar sem compactação** → escolha a pasta descompactada.
5. Clique no ícone ☕ → **⚙** → cole a URL da Vercel → **Salvar** → **Testar conexão**.

> Se o Chrome reclamar que a extensão "desaparece" ao reiniciar: ela permanece instalada; só o aviso de modo desenvolvedor aparece. Uso interno = totalmente ok.

### Firefox
1. Baixe `extensao-cafe-firefox.zip` e descompacte.
2. Abra `about:debugging#/runtime/this-firefox`.
3. **Carregar complemento temporário** → selecione o `manifest.json`.
4. Nas opções, cole a URL e salve.

> No Firefox esse modo é **temporário** (some ao fechar o navegador) e exige recarregar. Para uso fixo: publique na AMO (passo 3).

#### ⚠️ Firefox: é preciso liberar o acesso ao site

No Firefox com Manifest V3, **permissões de host não são concedidas na instalação** (nem em add-on temporário). Sem elas, o `fetch` para o site falha como erro de CORS e o popup fica vazio. A extensão detecta isso e mostra o aviso **“Falta liberar o acesso ao site”** com o botão **Permitir acesso** — clique e autorize no diálogo do Firefox.

Se preferir pelo menu: `about:addons` → **Café da Firma** → **Permissões** → ligar o acesso ao site. A mesma verificação aparece na página de opções, acima do botão “Testar conexão”.

Testado com `web-ext lint` (Mozilla): **0 erros, 0 avisos**.

---

## 3. Publicar nas lojas (público ou link não listado)

### Chrome Web Store
1. Conta de desenvolvedor: <https://chrome.google.com/webstore/devconsole> — taxa **única de US$ 5**.
2. **New item** → envie `extensao-cafe-chrome.zip` (o `manifest.json` precisa estar na raiz do zip — nosso script já faz isso).
3. Preencha a ficha: nome, descrição curta/longa, categoria (Productivity), idioma (Português do Brasil), ícone 128px (já temos) e **pelo menos 1 screenshot 1280×800** (ou 640×400).
4. **Visibility**: `Public`, `Unlisted` (só por link) ou `Private` (só e-mails/domínio da empresa — ideal aqui).
5. Justificativa de permissões (vai pedir):
   - `storage` → guardar URL do site, nome e intervalo.
   - `notifications` → avisar quando passar do intervalo.
   - `alarms` → verificação periódica (5 min).
   - `host_permissions: http/https` → o usuário informa a URL do próprio site nas opções, por isso o escopo amplo.
6. Envie para revisão (geralmente de algumas horas a poucos dias).

### Microsoft Edge Add-ons
Reaproveita o **mesmo zip** do Chrome: <https://partner.microsoft.com/dashboard/microsoftedge/>. Gratuito.

### Firefox (AMO)
1. <https://addons.mozilla.org/developers/> → **Submit a New Add-on**.
2. Envie `extensao-cafe-firefox.zip` (versão "On your own" / não listado também é possível).
3. O manifest já traz `browser_specific_settings.gecko.id` e `strict_min_version` — troque o id `cafe-da-firma@extensao.local` por algo seu antes de publicar, ex.: `cafe-da-firma@amad3eu.dev`.
4. Revisão costuma ser rápida para extensões simples como essa.

### Antes de publicar, ajuste
- [ ] `"version"` no `manifest.json` (hoje `1.0.0`) — sempre incremente.
- [ ] `"id"` do Gecko no Firefox.
- [ ] Nome/descrição na ficha da loja (sugestão abaixo).
- [ ] Screenshots 1280×800 do popup e das opções.
- [ ] Política de privacidade (as lojas pedem quando há permissões amplas): a extensão **não coleta dados**, só faz requisições para a URL que o usuário configura e guarda preferências em `storage.local`.

**Descrição sugerida (curta):**
> Registre a feita do café em um clique direto da barra do navegador. Avisa quando passou do intervalo, mostra o último café e o contador do dia.

---

## 4. Como o sistema funciona (resumo)

```
┌──────────────────────────┐        ┌──────────────────────────┐
│  Navegador da equipe     │        │  Extensão (MV3)          │
│  site na Vercel          │        │  popup + badge + notif.  │
└───────────┬──────────────┘        └───────────┬──────────────┘
            │ fetch (JSON)                      │ fetch (JSON, CORS *)
            ▼                                   ▼
        ┌─────────────────────────────────────────────┐
        │  Next.js 16 na Vercel                       │
        │  GET  /api/entries?days=N                   │
        │  POST /api/entries   { ts?, who? }          │
        │  DELETE /api/entries?id=...                 │
        └───────────────┬─────────────────────────────┘
                        │ lib/store.ts escolhe o modo
        ┌───────────────┴───────────────┐
        ▼                               ▼
┌──────────────────┐          ┌────────────────────────┐
│ Upstash Redis    │   ou     │ arquivo local (dev)    │
│ (produção,       │          │ data/entries.json      │
│ compartilhado)   │          └────────────────────────┘
└──────────────────┘                       ou
                                 ┌────────────────────────┐
                                 │ localStorage (fallback │
                                 │ no navegador, sem DB)  │
                                 └────────────────────────┘
```

### Fluxos principais

1. **Registrar café** — botão → `POST /api/entries` com `ts` (agora) e `who` (nome salvo). A API valida (máx. 60 dias no passado), cria `id` (uuid) e grava como item de um **sorted set** no Redis (`score = timestamp`), o que já mantém a ordem e permite consultas por período.
2. **Aviso de "hora do café"** — o front compara `agora - últimoCafé` com o intervalo escolhido (padrão 3h, salvo em `localStorage`). Passou → banner + botão "Registrar agora". A extensão faz a mesma conta e dispara **notificação do sistema** a cada 5 min.
3. **Histórico e gráficos** — um único `GET /api/entries?days=60` alimenta: cartão do último café, lista de hoje, histórico agrupado por dia (com "hoje/ontem/21/10"), gráfico por dia (14 dias), gráfico por hora do dia, pico, média e CSV. Tudo calculado no cliente, sem novas chamadas.
4. **Modo sem banco** — se `UPSTASH_REDIS_REST_*` não existe, a API responde `storage: "none"` e o app passa a usar `localStorage`, mostrando o selo "só neste navegador". É degradação limpa, não erro.
5. **Multiusuário e sincronização** — em modo Redis todo mundo vê o mesmo histórico. O site revalida ao voltar o foco na aba/janela e a cada **20 s com a aba visível** (sem consultar em segundo plano, para economizar comandos do Redis). Há também o botão **“atualizado HH:MM”** no cabeçalho, que força uma busca na hora — clique nele no celular/desktop para trazer os cafés registrados em outro dispositivo.

### Onde cada coisa vive

| Camada | Arquivo |
| --- | --- |
| API REST | `app/api/entries/route.ts` |
| Regra de persistência (Redis → arquivo → nenhum) | `lib/store.ts` |
| Cliente Redis (só `fetch`, sem dependência) | `lib/redis.ts` |
| Estado, avisos, gráficos, ações | `components/CoffeeApp.tsx` |
| Fallback de navegador + preferências | `lib/client-store.ts` |
| Formatação de datas/horas ("há 2 h") | `lib/format.ts` |

---

## 5. "Ele é completo?"

**Para o uso que você descreveu — registrar a feita, avisar e mostrar histórico com gráficos — sim, está completo e funcionando em produção.** Build, lint e testes de fluxo (registrar, desfazer, aviso, fallback offline, popup da extensão) passaram.

O que **já está pronto**:
- registrar em 1 clique + horário manual retroativo
- aviso interno e notificação na extensão
- último café, hoje, histórico de 60 dias, exclusão com desfazer
- 2 gráficos + 4 métricas + exportação CSV
- histórico compartilhado (Redis) **ou** local, com aviso claro na tela
- API com CORS para a extensão
- extensão Chrome/Edge/Firefox com badge e notificação
- deploy na Vercel e README de instalação

O que **não tem** (e não estava no pedido):
| Lacuna | Impacto | Esforço para adicionar |
| --- | --- | --- |
| Login / controle de acesso | quem tem o link registra e vê tudo | médio (NextAuth, Clerk ou token na URL) |
| Contas por pessoa | "quem" é só um nome digitado, sem validação | médio (junto com o login) |
| Notificação fora do navegador (WhatsApp/Slack/e-mail) | o aviso só aparece com o site/aba aberta | médio (cron da Vercel + webhook) |
| Testes automatizados | confiança vem de testes manuais | médio |
| PWA instalável / offline de verdade | hoje funciona offline só em modo localStorage | baixo/médio |
| Edição de registros (hoje só criar/excluir) | pequeno incômodo | baixo |
| Ranking mensal, tipos de café | “nice to have” | baixo |

Ou seja: **MVP de produção completo para uma equipe pequena**. As três lacunas que valem investir, se o uso crescer, são **login**, **aviso por WhatsApp/Slack** e **testes**.

---

## 6. Checklist pós-deploy

- [ ] Variáveis `UPSTASH_REDIS_REST_URL` e `UPSTASH_REDIS_REST_TOKEN` criadas e **Redeploy** feito
- [ ] Selo no topo do site mostrando **"compartilhado"** (e não "só neste navegador")
- [ ] Registrar 1 café de teste e conferir que aparece em outro navegador/celular
- [ ] Instalar a extensão, colar a URL em ⚙ e clicar em **Testar conexão**
- [ ] Testar o aviso: nas opções, coloque 1h e veja a notificação (ou registre um café com horário de 2h atrás)

---

## 7. Diagnóstico: "registrei o café e não aparece"

Abra no navegador:

```
https://SEU-SITE.vercel.app/api/health
```

O retorno mostra (sem expor token):

| Campo | O que significa |
| --- | --- |
| `storage` | `redis` (compartilhado), `file` (dev) ou `none` (modo local no navegador) |
| `detectedUrlVar` | qual variável de ambiente o app encontrou (ex.: `KV_REST_API_URL`, `STORAGE_URL`) |
| `host` | host do banco (ex.: `xxx.upstash.io`) |
| `roundTrip` | `true` = o banco aceitou **escrita e leitura** |
| `total` | quantos registros existem na chave `cafe:entries` |
| `recent` | os 3 últimos registros gravados |
| `visibleToApp` | quantos o app consegue ler pelo caminho normal |
| `error` | mensagem de erro do Redis, se houver |

Leitura do resultado:

- `storage: "none"` → as variáveis não existem no deploy atual. Faça **Redeploy**.
- `roundTrip: false` ou `error` com 401/403 → token errado (ou é o `..._READ_ONLY_TOKEN`).
- `total > 0` mas `visibleToApp: 0` → dados gravados com chave/filtro diferentes.
- `total: 0` → o POST não está chegando ao banco; teste manualmente:

```bash
curl -X POST https://SEU-SITE.vercel.app/api/entries \
  -H 'Content-Type: application/json' -d '{"who":"teste"}'

curl -s "https://SEU-SITE.vercel.app/api/entries?days=1"
```

### Por que a extensão não notifica

A notificação só dispara quando **existe um café de hoje** e o intervalo configurado passou. Sem dados (`total: 0`), não há o que avisar. Para testar o aviso em si: abra as opções da extensão → **Testar notificação**.
