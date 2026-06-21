import Link from "next/link";

export const metadata = { title: "Termos de Uso — Legallis" };

export default function TermosPage() {
  return (
    <div className="min-h-screen py-16 px-6" style={{ background: "var(--bg, #0f0f0f)", color: "var(--text, #f0f0f0)" }}>
      <div className="max-w-3xl mx-auto">
        <Link href="/cadastro" className="text-sm mb-8 inline-flex items-center gap-1.5" style={{ color: "var(--gold, #C9A84C)" }}>
          ← Voltar
        </Link>
        <h1 className="text-3xl font-semibold mb-2 mt-4" style={{ fontFamily: "serif" }}>Termos de Uso</h1>
        <p className="text-sm mb-10" style={{ color: "var(--text3, #888)" }}>Última atualização: junho de 2025</p>

        <div className="space-y-8 text-sm leading-7" style={{ color: "var(--text2, #ccc)" }}>
          <section>
            <h2 className="font-semibold text-base mb-2" style={{ color: "var(--text, #f0f0f0)" }}>1. Aceitação dos Termos</h2>
            <p>Ao criar uma conta ou utilizar o Legallis, você concorda com estes Termos de Uso. Caso não concorde, não utilize a plataforma.</p>
          </section>

          <section>
            <h2 className="font-semibold text-base mb-2" style={{ color: "var(--text, #f0f0f0)" }}>2. Descrição do Serviço</h2>
            <p>O Legallis é uma plataforma de gestão jurídica destinada a advogados e escritórios de advocacia, oferecendo controle processual, gestão financeira e calculadora jurídica.</p>
          </section>

          <section>
            <h2 className="font-semibold text-base mb-2" style={{ color: "var(--text, #f0f0f0)" }}>3. Cadastro e Conta</h2>
            <p>Você é responsável pela veracidade das informações fornecidas no cadastro e pela segurança de suas credenciais de acesso. O compartilhamento de conta não é permitido.</p>
          </section>

          <section>
            <h2 className="font-semibold text-base mb-2" style={{ color: "var(--text, #f0f0f0)" }}>4. Planos e Pagamento</h2>
            <p>Os planos pagos são cobrados mensalmente via Stripe. O cancelamento pode ser realizado a qualquer momento pelo portal de faturamento, sem multa. Não há reembolso de períodos já pagos.</p>
          </section>

          <section>
            <h2 className="font-semibold text-base mb-2" style={{ color: "var(--text, #f0f0f0)" }}>5. Período de Teste</h2>
            <p>O plano Básico oferece 4 dias de teste gratuito. Nenhum dado de cartão é solicitado durante o período de teste. Ao término, o acesso é suspenso até a contratação de um plano.</p>
          </section>

          <section>
            <h2 className="font-semibold text-base mb-2" style={{ color: "var(--text, #f0f0f0)" }}>6. Dados e Privacidade</h2>
            <p>Seus dados são armazenados com segurança e não são compartilhados com terceiros, exceto conforme necessário para a prestação do serviço. Consulte nossa{" "}
              <Link href="/privacidade" style={{ color: "var(--gold, #C9A84C)" }}>Política de Privacidade</Link>.
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-base mb-2" style={{ color: "var(--text, #f0f0f0)" }}>7. Limitação de Responsabilidade</h2>
            <p>O Legallis é uma ferramenta de apoio à gestão. Não nos responsabilizamos por decisões tomadas com base nas informações geridas pela plataforma. O uso é de responsabilidade exclusiva do usuário.</p>
          </section>

          <section>
            <h2 className="font-semibold text-base mb-2" style={{ color: "var(--text, #f0f0f0)" }}>8. Alterações</h2>
            <p>Podemos atualizar estes termos a qualquer momento. Usuários serão notificados por e-mail em caso de mudanças relevantes.</p>
          </section>

          <section>
            <h2 className="font-semibold text-base mb-2" style={{ color: "var(--text, #f0f0f0)" }}>9. Contato</h2>
            <p>Dúvidas sobre estes termos: <a href="mailto:suporte@legallis.app.br" style={{ color: "var(--gold, #C9A84C)" }}>suporte@legallis.app.br</a></p>
          </section>
        </div>
      </div>
    </div>
  );
}
