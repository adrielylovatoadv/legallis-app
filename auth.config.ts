import type { NextAuthConfig } from "next-auth";

declare module "next-auth" {
  interface User {
    role?: string;
    plan?: string;
  }
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      role: string;
      plan: string;
    };
  }
}

export const authConfig = {
  pages: { signIn: "/login" },
  callbacks: {
    authorized({ auth, request }) {
      const isLoggedIn = !!auth?.user;
      const pub = ["/login", "/esqueci-senha", "/redefinir-senha", "/cadastro", "/bem-vindo"];
      const isPublic = pub.some(p => request.nextUrl.pathname.startsWith(p));
      if (isPublic) return true;
      return isLoggedIn;
    },
    async jwt({ token, user }) {
      if (user) {
        token.role = user.role;
        token.plan = user.plan;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub!;
        session.user.role = (token.role as string) ?? "user";
        session.user.plan = (token.plan as string) ?? "basic";
      }
      return session;
    },
  },
  providers: [],
  session: { strategy: "jwt" as const, maxAge: 30 * 24 * 60 * 60 },
} satisfies NextAuthConfig;
