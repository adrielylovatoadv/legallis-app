import type { NextAuthConfig } from "next-auth";
import type { SubscriptionStatus } from "./lib/users";

declare module "next-auth" {
  interface User {
    role?: string;
    plan?: string;
    subscriptionStatus?: SubscriptionStatus;
    trialEndsAt?: string;
    theme?: string;
    isActive?: boolean;
    tenantId?: string;
    sexo?: string;
  }
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      role: string;
      plan: string;
      subscriptionStatus: SubscriptionStatus;
      trialEndsAt?: string;
      theme?: string;
      tenantId: string;
      sexo?: string;
    };
  }
}

const PUBLIC_PATHS = [
  "/login",
  "/esqueci-senha",
  "/redefinir-senha",
  "/cadastro",
  "/bem-vindo",
  "/assinar",
  "/termos",
  "/privacidade",
];

export const authConfig = {
  pages: { signIn: "/login" },
  callbacks: {
    authorized({ auth, request }) {
      const isLoggedIn = !!auth?.user;
      const pathname = request.nextUrl.pathname;
      const isPublic = PUBLIC_PATHS.some(p => pathname.startsWith(p));

      if (isPublic) return true;
      if (!isLoggedIn) return false;

      // Check trial expiry (using info in JWT)
      const status = (auth?.user as { subscriptionStatus?: string })?.subscriptionStatus;
      const trialEndsAt = (auth?.user as { trialEndsAt?: string })?.trialEndsAt;

      if (status === "trial" && trialEndsAt) {
        const expired = new Date(trialEndsAt) < new Date();
        if (expired && !pathname.startsWith("/assinar") && !pathname.startsWith("/api")) {
          return Response.redirect(new URL("/assinar", request.url));
        }
      }

      if (status === "expired" || status === "cancelled") {
        if (!pathname.startsWith("/assinar") && !pathname.startsWith("/api")) {
          return Response.redirect(new URL("/assinar", request.url));
        }
      }

      // Master panel only for plan=admin
      if (pathname.startsWith("/master")) {
        const plan = (auth?.user as { plan?: string })?.plan;
        if (plan !== "admin") {
          return Response.redirect(new URL("/dashboard", request.url));
        }
      }

      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        token.role = user.role;
        token.plan = user.plan;
        token.subscriptionStatus = user.subscriptionStatus;
        token.trialEndsAt = user.trialEndsAt;
        token.theme = user.theme;
        token.isActive = user.isActive;
        token.tenantId = user.tenantId;
        token.sexo = user.sexo;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub!;
        session.user.role = (token.role as string) ?? "user";
        session.user.plan = (token.plan as string) ?? "basic";
        session.user.subscriptionStatus = (token.subscriptionStatus as SubscriptionStatus) ?? "active";
        session.user.trialEndsAt = token.trialEndsAt as string | undefined;
        session.user.theme = token.theme as string | undefined;
        session.user.tenantId = (token.tenantId as string) ?? `t_${token.sub}`;
        session.user.sexo = token.sexo as string | undefined;
      }
      return session;
    },
  },
  providers: [],
  session: { strategy: "jwt" as const, maxAge: 30 * 24 * 60 * 60 },
} satisfies NextAuthConfig;
