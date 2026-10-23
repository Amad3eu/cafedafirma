import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Política de privacidade · Café da Firma",
  description:
    "Como o Café da Firma (site e extensão) trata os dados: nenhuma coleta, nenhum rastreamento, nenhum anúncio.",
};

/**
 * E-mail de contato da política.
 * Pode ser trocado sem mexer no código: defina PRIVACY_CONTACT (ou
 * NEXT_PUBLIC_PRIVACY_CONTACT) nas variáveis de ambiente da Vercel.
 */
const CONTACT =
  process.env.PRIVACY_CONTACT ??
  process.env.NEXT_PUBLIC_PRIVACY_CONTACT ??
  "privacidade@cafedafirma.local";

export default function PrivacidadePage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10 sm:py-14">
      <Link
        href="/"
        className="text-xs font-medium text-caramel-deep hover:underline"
      >
        ← Voltar para o Café da Firma
      </Link>

      <h1 className="mt-4 text-2xl font-semibold tracking-tight sm:text-3xl">
        Política de privacidade
      </h1>
      <p className="mt-1 text-xs text-muted">
        Café da Firma — site e extensão para Chrome, Edge e Firefox · última
        atualização: 23/10/2026
      </p>

      <section className="mt-8 space-y-4 text-sm leading-relaxed text-espresso-soft">
        <div className="rounded-2xl border border-latte/70 bg-card/80 p-4">
          <p className="font-semibold text-espresso">Resumo em uma frase</p>
          <p className="mt-1">
            O Café da Firma <strong>não coleta, não vende e não compartilha</strong>{" "}
            dados pessoais, não usa rastreamento, anúncios ou analytics de
            terceiros. Tudo o que ele guarda são os registros de café que você
            mesmo cria.
          </p>
        </div>

        <h2 className="pt-2 text-base font-semibold text-espresso">
          1. Quais dados são tratados
        </h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong>Registro de café:</strong> data e hora do registro e,
            opcionalmente, o nome que você digitar como identificação.
          </li>
          <li>
            <strong>Preferências da extensão:</strong> endereço do site, seu
            nome, intervalos de aviso e frequência de verificação. Ficam no
            armazenamento local do seu navegador (<code>storage.local</code>).
          </li>
          <li>
            <strong>Nenhum dado sensível:</strong> não há coleta de e-mail,
            senha, localização, contatos, histórico de navegação, teclas
            digitadas ou conteúdo de páginas.
          </li>
        </ul>

        <h2 className="pt-2 text-base font-semibold text-espresso">
          2. Onde os dados ficam
        </h2>
        <p>
          Os registros de café são enviados para o servidor do próprio Café da
          Firma, hospedado na Vercel, e guardados em um banco de dados Redis
          (Upstash). A extensão e o site usam esse mesmo endereço, configurado
          por quem instala. Se o endereço não estiver configurado ou o servidor
          estiver indisponível, o site guarda os registros apenas no
          armazenamento local do navegador.
        </p>
        <p>
          O site é de uso interno de uma equipe: as pessoas com acesso ao
          endereço veem o histórico de cafés registrado por todas elas,
          incluindo o nome informado no registro.
        </p>

        <h2 className="pt-2 text-base font-semibold text-espresso">
          3. Para que os dados são usados
        </h2>
        <p>
          Exclusivamente para o funcionamento do recurso: mostrar o último café,
          o contador do dia, o histórico, os gráficos e enviar lembretes locais.
          Não há uso para publicidade, perfilamento, treinamento de modelos ou
          qualquer finalidade secundária.
        </p>

        <h2 className="pt-2 text-base font-semibold text-espresso">
          4. Permissões da extensão e por quê
        </h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <code>storage</code> — guardar suas preferências e o controle dos
            avisos já enviados.
          </li>
          <li>
            <code>notifications</code> — avisar quando o intervalo passar, no
            primeiro café do dia e quando um colega registrar um café.
          </li>
          <li>
            <code>alarms</code> — verificar novidades periodicamente (o
            navegador não permite temporizadores longos sem esse alarme).
          </li>
          <li>
            <code>contextMenus</code> — oferecer “Registrar café agora” no botão
            direito do ícone.
          </li>
          <li>
            <strong>Acesso a sites (<code>host_permissions</code>)</strong> — o
            endereço do Café da Firma é informado por você nas opções, por isso
            a permissão é ampla. A extensão só faz requisições para esse
            endereço; nenhuma outra página é lida ou modificada.
          </li>
        </ul>

        <h2 className="pt-2 text-base font-semibold text-espresso">
          5. Compartilhamento com terceiros
        </h2>
        <p>
          Nenhum dado é vendido, alugado ou compartilhado. Os únicos
          processadores envolvidos são os provedores de infraestrutura do
          próprio serviço (hospedagem na Vercel e banco de dados na Upstash), que
          apenas armazenam os registros.
        </p>

        <h2 className="pt-2 text-base font-semibold text-espresso">
          6. Retenção e exclusão
        </h2>
        <p>
          Os registros são mantidos por até 12 meses no servidor. Você pode
          apagar qualquer registro pelo próprio site (ícone ✕ na lista de cafés
          do dia ou no histórico) e limpar os dados locais removendo a extensão
          ou apagando os dados do site no navegador. Para solicitar a exclusão de
          todo o histórico, use o contato abaixo.
        </p>

        <h2 className="pt-2 text-base font-semibold text-espresso">
          7. Cookies e rastreamento
        </h2>
        <p>
          O Café da Firma não usa cookies de rastreamento, pixels, analytics de
          terceiros ou publicidade. O site usa apenas armazenamento local do
          navegador para suas preferências.
        </p>

        <h2 className="pt-2 text-base font-semibold text-espresso">
          8. Seus direitos (LGPD)
        </h2>
        <p>
          Nos termos da Lei 13.709/2018 (LGPD), você pode solicitar confirmação
          de tratamento, acesso, correção, portabilidade (o site já oferece
          exportação em CSV) e eliminação dos seus dados. Basta entrar em
          contato.
        </p>

        <h2 className="pt-2 text-base font-semibold text-espresso">
          9. Alterações e contato
        </h2>
        <p>
          Mudanças nesta política serão publicadas nesta mesma página, com a
          data de atualização. Dúvidas ou solicitações:{" "}
          <a
            className="font-medium text-caramel-deep hover:underline"
            href={`mailto:${CONTACT}`}
          >
            {CONTACT}
          </a>
          .
        </p>

        <hr className="my-8 border-latte" />

        <h2 className="text-base font-semibold text-espresso">
          Privacy policy (English summary)
        </h2>
        <p>
          Café da Firma does not collect, sell, or share personal data, and uses
          no tracking, ads, or third-party analytics. The extension stores your
          preferences (site URL, name, reminder intervals) in{" "}
          <code>storage.local</code> and sends only the coffee records you create
          to the site address you configure. Permissions are used solely for:
          storing preferences (<code>storage</code>), local reminders (
          <code>notifications</code>), periodic checks (<code>alarms</code>), the
          right-click menu (<code>contextMenus</code>), and HTTP requests to the
          configured site (<code>host_permissions</code>) — no other pages are
          read or modified. Records are kept for up to 12 months and can be
          deleted from the site or by contacting{" "}
          <a
            className="font-medium text-caramel-deep hover:underline"
            href={`mailto:${CONTACT}`}
          >
            {CONTACT}
          </a>
          .
        </p>
      </section>
    </main>
  );
}
