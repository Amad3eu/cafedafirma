# Publicação nas lojas — textos e checklist

Arquivos prontos:

| Arquivo | Uso |
| --- | --- |
| `screenshot-1-1280x800.png` | 1ª captura (registro em 1 clique) |
| `screenshot-2-1280x800.png` | 2ª captura (avisos inteligentes) |
| `screenshot-3-1280x800.png` | 3ª captura (site + histórico da equipe) |
| `../public/extensao-cafe-chrome.zip` | envio para Chrome Web Store e Edge Add-ons |
| `../public/extensao-cafe-firefox.zip` | envio para Firefox AMO |

---

## Nome, descrição e categoria

**Nome (45 caracteres máx.):**
```
Café da Firma — registro de café
```

**Descrição curta (132 caracteres máx. no Chrome):**
```
Registre a feita do café em 1 clique pelo ícone do navegador. Avisa quando passar do intervalo e mostra quem já fez café hoje.
```

**Descrição longa:**
```
Café da Firma é o jeito mais rápido de registrar as feitas de café da equipe.

Um clique no ícone do navegador grava o horário — sem abrir aba, sem planilha e sem esquecer de anotar.

O QUE ELE FAZ
• Registro em 1 clique (clique no ícone, botão do popup, menu do botão direito ou Alt+Shift+C)
• Contador do dia, há quanto tempo foi o último café e quem já fez hoje
• Aviso quando o intervalo passa, com botão “Registrar café agora” na própria notificação
• Lembrete do primeiro café do dia
• Aviso quando um colega registra café (ex.: “Amadeu fez café”)
• Intervalos separados para manhã e tarde
• Tudo sincronizado com o site Café da Firma, com histórico e gráficos

PRIVACIDADE
Não coleta dados pessoais, não usa rastreamento, anúncios ou analytics de terceiros. As preferências ficam no seu navegador e apenas os registros de café que você cria são enviados ao endereço do site que você configurar.
Política completa: https://cafedafirma.vercel.app/privacidade

CONFIGURAÇÃO
Na primeira vez, abra as opções da extensão e informe o endereço do seu Café da Firma (ex.: https://cafedafirma.vercel.app) e o seu nome.
```

**Categoria:** Productivity (Chrome/Edge) · Alarme e produtividade (Firefox)

**Idioma principal:** Português (Brasil)

**Site / suporte:** https://cafedafirma.vercel.app — https://cafedafirma.vercel.app/privacidade

---

## Justificativa das permissões (o formulário pede)

| Permissão | Justificativa para colar |
| --- | --- |
| `storage` | Guarda as preferências do usuário (endereço do site, nome, intervalos) e o controle dos avisos já enviados. |
| `notifications` | Envia avisos locais de intervalo, primeiro café do dia e atividade da equipe. |
| `alarms` | Agenda a verificação periódica (a cada 1–5 minutos) usada pelos avisos; o navegador não permite timers longos em segundo plano sem esse alarme. |
| `contextMenus` | Oferece “Registrar café agora / Abrir painel / Configurar” no botão direito do ícone. |
| `host_permissions` (http/https) | O endereço do servidor do Café da Firma é definido pelo próprio usuário nas opções, por isso o escopo é amplo. A extensão só faz requisições HTTP para esse endereço (GET /api/entries e POST /api/entries); não lê nem modifica páginas. |

**Single purpose (Chrome):**
```
Registrar e acompanhar as feitas de café da equipe em um clique.
```

**Remote code:** nenhum código remoto é baixado ou executado (Use of remote code = No).

---

## Checklist de envio

### Chrome Web Store
- [ ] Conta de desenvolvedor (taxa única de US$ 5)
- [ ] `extensao-cafe-chrome.zip` (manifest na raiz)
- [ ] 3 screenshots 1280×800
- [ ] Ícone 128×128 (já está no zip)
- [ ] Descrições curta e longa + justificativa de permissões
- [ ] Privacy policy URL: `https://cafedafirma.vercel.app/privacidade`
- [ ] Visibilidade: **Unlisted** (só por link) ou **Private** (e-mails/domínio da empresa)

### Microsoft Edge Add-ons
- [ ] Mesmo zip do Chrome · gratuito · mesmos textos e screenshots

### Firefox (AMO)
- [ ] `extensao-cafe-firefox.zip`
- [ ] Trocar `browser_specific_settings.gecko.id` (`cafe-da-firma@extensao.local`) por um id próprio, ex.: `cafe-da-firma@seudominio.com`
- [ ] Screenshots 1280×800 e descrições
- [ ] Data collection: “none” (já declarado no manifest)
- [ ] Versão listada ou “On your own” (não listado)

---

## Depois de publicar

1. Divulgue o link da loja para a equipe e peça para preencherem **o próprio nome** nas opções.
2. Sempre que atualizar a extensão, suba a `version` no `manifest.json` e rode `npm run build:ext`.
