"use client";

import Image from "next/image";
import Link from "next/link";

export default function BemVindoPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4"
      style={{ background: "var(--bg)" }}>
      <div className="w-full max-w-sm text-center space-y-6">
        <div className="flex justify-center">
          <Image src="/logo.png" alt="Legallis" width={160} height={48} priority />
        </div>

        <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto"
          style={{ background: "rgba(201,168,76,0.15)" }}>
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"
            style={{ color: "var(--gold)" }}>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>

        <div className="rounded-2xl px-8 py-8 space-y-4"
          style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          <h1 className="font-serif text-2xl font-semibold" style={{ color: "var(--text)" }}>
            Pagamento confirmado!
          </h1>
          <p className="text-sm" style={{ color: "var(--text3)" }}>
            Sua assinatura foi ativada com sucesso. Faça login para acessar o sistema.
          </p>
          <Link href="https://app.legallis.app.br/login"
            className="block w-full py-3 rounded-xl font-semibold text-sm text-center"
            style={{ background: "var(--gold)", color: "#000" }}>
            Entrar no sistema →
          </Link>
        </div>
      </div>
    </div>
  );
}
