# Changelog

Todas as mudanças relevantes do site e da extensão. O número de versão é o mesmo
para os dois (`package.json` e `extension/*/manifest.json`).

## [1.7.0] — 2026-11-04

### Novo
- **Tomei um café** — cada pessoa registra as xícaras que tomou no dia. O site
  mostra "você: 2 de 4", a equipe inteira ("quem tomou") e o total do dia.
- **Nota do café** — depois de uma xícara, o app pergunta "como estava o café?"
  (1 a 5 estrelas). A nota fica ligada à **feita** que estava no bule naquele
  momento, então dá para saber se o café daquele período estava bom.
- **Meta diária de xícaras** — configurável (sem meta, 2 a 8). Medidor no site
  e no popup; aviso discreto ao passar da meta.
- **Ranking da firma** — quem faz o melhor café (média das notas, mínimo de
  3 avaliações), quem mais fez café nos últimos 30 dias e a nota por período
  do dia (manhã, almoço, tarde, noite).
- **Gráfico de feitas × xícaras por dia** — barras agrupadas com legenda, em
  paleta validada para daltonismo.
- **Extensão 1.7** — botão "Tomei um café" no popup com estrelas para avaliar,
  atalho `Alt+Shift+T`, item no menu do botão direito e notificação com
  botões 👍/👎 para dar a nota sem abrir nada. Métricas do popup: feitas,
  xícaras, você e nota.
- **API** — `GET /api/entries?cups=1` traz feitas e xícaras em uma única
  leitura (pipeline no Redis); nova rota `/api/cups` (GET, POST, PATCH, DELETE).
- **Site instalável** — `manifest.webmanifest` para "Adicionar à tela inicial".
- **Testes automatizados** — `npm test` cobre formatação, estatísticas, helpers
  da API e a consistência da extensão (Chrome × Firefox, versões, manifests).
- Link para o repositório no rodapé do site, na política de privacidade, nas
  opções e no popup da extensão.

### Mudado
- `lib/store.ts` virou genérico: as duas coleções (feitas e xícaras) usam o
  mesmo código de Redis/arquivo.
- Exportação CSV agora inclui xícaras e notas (coluna `tipo`).
- Migração do modo local importa também as xícaras, mantendo o vínculo com a
  feita.
- `scripts/build-ext.sh` sincroniza `extension/chrome` → `extension/firefox`
  antes de empacotar e funciona sem o binário `zip` (usa `python3`).
- CI roda em Node 22, executa os testes e falha se o Firefox divergir do Chrome.
- `/api/health` passou a reportar `totalCups` e `visibleCups`.
- `package.json` com `repository`, `homepage`, `bugs`, `engines` e scripts
  `typecheck`, `test` e `check`.

### Removido
- `commit-message.txt` na raiz (duplicava `docs/COMMIT_MESSAGE.md`).

## [1.6.0] — 2026-10-30
- Popup da extensão com sistema de espaçamento 4 px, cartões unificados e chips da equipe.
- Importação para o histórico compartilhado dos cafés salvos no navegador antes de conectar o banco.
- Endpoint `/api/health` para diagnosticar a persistência; verificação pós-registro; notificação de teste.

## [1.4.0] — 2026-10-28
- Nome do usuário pedido na primeira abertura (extensão) e destacado no site.

## [1.3.0] — 2026-10-27
- Registrar sem abrir nada: clique no ícone, menu do botão direito e atalhos de teclado.

## [1.2.0] — 2026-10-26
- Avisos da extensão: primeiro café do dia, intervalos de manhã/tarde e "colega fez café".
- Detecção automática das variáveis do Redis (`KV_*`, `UPSTASH_*`, prefixos customizados).

## [1.0.0] — 2026-10-23
- Primeira versão: registro em um clique, aviso de intervalo, histórico, gráficos, CSV, extensão Chrome/Edge/Firefox e deploy na Vercel.
