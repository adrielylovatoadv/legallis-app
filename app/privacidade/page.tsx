import Link from "next/link";

export const metadata = { title: "Política de Privacidade — Legallis" };

export default function PrivacidadePage() {
  return (
    <div className="min-h-screen py-16 px-6" style={{ background: "var(--bg, #0f0f0f)", color: "var(--text, #f0f0f0)" }}>
      <div className="max-w-3xl mx-auto">
        <Link href="/cadastro" className="text-sm mb-8 inline-flex items-center gap-1.5" style={{ color: "var(--gold, #C9A84C)" }}>
          ← Voltar
        </Link>
        <h1 className="text-3xl font-semibold mb-2 mt-4" style={{ fontFamily: "serif" }}>Política de Privacidade</h1>
        <p className="text-sm mb-10" style={{ color: "var(--text3, #888)" }}>Última atualização: junho de 2025</p>

        <div className="space-y-8 text-sm leading-7" style={{ color: "var(--text2, #ccc)" }}>
          <section>
            <h2 className="font-semibold text-base mb-2" style={{ color: "var(--text, #f0f0f0)" }}>1. Dados Coletados</h2>
            <p>Coletamos: nome, e-mail, telefone e dados do escritório para criação da conta. Dados de processos, clientes e financeiro inseridos pelo próprio usuário.</p>
          </section>

          <section>
            <h2 className="font-semibold text-base mb-2" style={{ color: "var(--text, #f0f0f0)" }}>2. Uso dos Dados</h2>
            <p>Seus dados são utilizados exclusivamente para prestação do serviço Legallis: autenticação, armazenamento de informações jurídicas e comunicação sobre a conta (confirmações, renovações, alertas).</p>
          </section>

          <section>
            <h2 className="font-semibold text-base mb-2" style={{ color: "var(--text, #f0f0f0)" }}>3. Dados de Clientes</h2>
            <p>Informações sobre os clientes do seu escritório (incluindo CPF, contatos e credenciais de acesso a sistemas governamentais) são armazenadas de forma criptografada e acessíveis apenas ao titular da conta.</p>
          </section>

          <section>
            <h2 className="font-semibold text-base mb-2" style={{ color: "var(--text, #f0f0f0)" }}>4. Compartilhamento</h2>
            <p>Não vendemos nem compartilhamos seus dados com terceiros. O processamento de pagamentos é realizado pelo Stripe, sujeito à própria política de privacidade da empresa.</p>
          </section>

          <section>
            <h2 className="font-semibold text-base mb-2" style={{ color: "var(--text, #f0f0f0)" }}>5. Segurança</h2>
            <p>Utilizamos criptografia AES-256 para dados sensíveis, HTTPS em todas as comunicações e banco de dados seguro com acesso restrito.</p>
          </section>

          <section>
            <h2 className="font-semibold text-base mb-2" style={{ color: "var(--text, #f0f0f0)" }}>6. Seus Direitos (LGPD)</h2>
            <p>Conforme a Lei Geral de Proteção de Dados (Lei 13.709/2018), você tem direito a: acessar seus dados, corrigir informações incorretas, solicitar a exclusão da conta e dos dados. Envie solicitações para <a href="mailto:privacidade@legallis.app.br" style={{ color: "var(--gold, #C9A84C)" }}>privacidade@legallis.app.br</a>.</p>
          </section>

          <section>
            <h2 className="font-semibold text-base mb-2" style={{ color: "var(--text, #f0f0f0)" }}>7. Retenção de Dados</h2>
            <p>Após o cancelamento da conta, os dados ficam disponíveis por 1 dia para exportação e são excluídos permanentemente em seguida.</p>
          </section>

          <section>
            <h2 className="font-semibold text-base mb-2" style={{ color: "var(--text, #f0f0f0)" }}>8. Contato</h2>
            <p>Para questões de privacidade: <a href="mailto:privacidade@legallis.app.br" style={{ color: "var(--gold, #C9A84C)" }}>privacidade@legallis.app.br</a></p>
          </section>
        </div>
      </div>
    </div>
  );
}
