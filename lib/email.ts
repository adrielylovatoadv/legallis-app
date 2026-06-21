const APP_URL = process.env.NEXTAUTH_URL ?? "https://app.legallis.app.br";
const FROM = "Legallis <noreply@legallis.app.br>";

async function send(to: string, subject: string, html: string) {
  // Avoid sending to internal @legallis emails in dev
  const recipient = to.includes("@legallis") ? (process.env.DEV_EMAIL ?? "noreply@legallis.app.br") : to;

  if (!process.env.RESEND_API_KEY) {
    console.log(`[Email dev] To: ${recipient}\nSubject: ${subject}`);
    return;
  }
  const { Resend } = await import("resend");
  const resend = new Resend(process.env.RESEND_API_KEY);
  try {
    await resend.emails.send({ from: FROM, to: recipient, subject, html });
  } catch (err) {
    console.error("[Email] Erro ao enviar:", err);
  }
}

const base = (content: string) => `
<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><style>
  body { font-family: Inter, sans-serif; background:#0F0F0F; color:#F0EDE8; margin:0; padding:0; }
  .container { max-width:560px; margin:40px auto; padding:32px; background:#1A1A1A; border:1px solid #2A2A2A; border-radius:16px; }
  .logo { font-size:22px; font-weight:700; color:#C9A84C; margin-bottom:24px; }
  h1 { font-size:20px; margin:0 0 16px; }
  p { font-size:14px; line-height:1.6; color:#A0A0A0; margin:8px 0; }
  a.btn { display:inline-block; margin-top:20px; padding:12px 28px; background:#C9A84C; color:#000; font-weight:600; border-radius:10px; text-decoration:none; font-size:14px; }
  .footer { margin-top:32px; font-size:12px; color:#666; text-align:center; }
</style></head>
<body><div class="container">
  <div class="logo">LEGALLIS</div>
  ${content}
  <div class="footer">LEGALLIS · Gestão Jurídica &amp; Financeira</div>
</div></body>
</html>`;

export async function sendWelcomeTrial(name: string, email: string, trialEndsAt: string) {
  const expiry = new Date(trialEndsAt).toLocaleDateString("pt-BR");
  await send(email, "Bem-vindo ao Legallis! Seu teste gratuito começou.", base(`
    <h1>Olá, ${name}! 👋</h1>
    <p>Sua conta foi criada e seu <strong>teste gratuito de 4 dias</strong> já está ativo.</p>
    <p>Você tem acesso completo ao sistema até <strong>${expiry}</strong>.</p>
    <p>Explore o Controle Processual, a Calculadora Jurídica e todos os recursos disponíveis.</p>
    <a class="btn" href="${APP_URL}/dashboard">Acessar o sistema →</a>
    <p style="margin-top:20px">Após o período de teste, escolha um plano para continuar com seus dados.</p>
  `));
}

export async function sendWelcomePaid(name: string, email: string, plan: string) {
  const planLabels: Record<string, string> = { basic: "Básico", pro: "Pro", profissional: "Profissional" };
  await send(email, "Assinatura confirmada — Legallis", base(`
    <h1>Bem-vindo ao Legallis, ${name}!</h1>
    <p>Sua assinatura do plano <strong>${planLabels[plan] ?? plan}</strong> foi ativada com sucesso.</p>
    <p>Todos os recursos do seu plano já estão disponíveis.</p>
    <a class="btn" href="${APP_URL}/dashboard">Acessar o sistema →</a>
  `));
}

export async function sendTrialExpiringSoon(name: string, email: string, daysLeft: number, trialEndsAt: string) {
  const expiry = new Date(trialEndsAt).toLocaleDateString("pt-BR");
  const urgency = daysLeft === 0 ? "expira hoje" : `expira em ${daysLeft} dia${daysLeft !== 1 ? "s" : ""}`;
  await send(email, `Seu teste gratuito ${urgency} — Legallis`, base(`
    <h1>Atenção, ${name}!</h1>
    <p>Seu <strong>teste gratuito ${urgency}</strong> (${expiry}).</p>
    <p>Para continuar usando o Legallis e manter seus dados, escolha um plano agora.</p>
    <p>Seus dados ficam salvos por 1 dia após o vencimento.</p>
    <a class="btn" href="${APP_URL}/assinar">Ver planos →</a>
  `));
}

export async function sendPasswordReset(email: string, resetUrl: string) {
  await send(email, "Redefinição de senha — Legallis", base(`
    <h1>Redefinir senha</h1>
    <p>Você solicitou a redefinição de senha para sua conta no Legallis.</p>
    <p>Clique no botão abaixo para criar uma nova senha (válido por 1 hora):</p>
    <a class="btn" href="${resetUrl}">Redefinir senha →</a>
    <p style="margin-top:16px">Se você não solicitou, ignore este e-mail.</p>
  `));
}
