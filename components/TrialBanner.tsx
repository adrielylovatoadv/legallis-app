"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";

export default function TrialBanner() {
  const { data: session } = useSession();
  // Snapshot de "agora" só na montagem, não a cada render (Date.now() direto no corpo do
  // componente é uma função impura e o React não pode garantir resultado estável entre renders).
  const [now] = useState(() => Date.now());
  if (!session) return null;

  const status = session.user.subscriptionStatus;
  if (status !== "trial") return null;

  const trialEndsAt = session.user.trialEndsAt;
  if (!trialEndsAt) return null;

  const diff = new Date(trialEndsAt).getTime() - now;
  const daysLeft = Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  const expiryDate = new Date(trialEndsAt).toLocaleDateString("pt-BR");

  const isUrgent = daysLeft <= 1;

  return (
    <div
      className="flex items-center justify-between px-4 py-2.5 text-xs"
      style={{
        background: isUrgent ? "rgba(239,68,68,0.12)" : "rgba(201,168,76,0.1)",
        borderBottom: `1px solid ${isUrgent ? "rgba(239,68,68,0.3)" : "rgba(201,168,76,0.25)"}`,
      }}
    >
      <div className="flex items-center gap-2 flex-wrap">
        <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"
          style={{ color: isUrgent ? "#f87171" : "var(--gold)" }}>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span style={{ color: isUrgent ? "#f87171" : "var(--gold)" }}>
          {daysLeft === 0
            ? "Teste gratuito expira hoje!"
            : `Seu teste gratuito expira em ${daysLeft} dia${daysLeft !== 1 ? "s" : ""} · ${expiryDate}`}
        </span>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0 ml-4">
        <Link href="/assinar"
          className="px-3 py-1 rounded-md text-xs font-semibold transition-opacity hover:opacity-90"
          style={{ background: isUrgent ? "#ef4444" : "var(--gold)", color: "#000" }}>
          Assinar Agora
        </Link>
        <Link href="/assinar"
          className="px-2 py-1 rounded-md text-xs transition-opacity hover:opacity-80"
          style={{ color: "var(--text3)" }}>
          Ver Planos
        </Link>
      </div>
    </div>
  );
}
