import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { authConfig } from "./auth.config";

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        email: { label: "Usuário", type: "text" },
        password: { label: "Senha", type: "password" },
      },
      async authorize(credentials) {
        const { getUserByEmailAsync } = await import("@/lib/users");
        const user = await getUserByEmailAsync(credentials.email as string);
        if (!user) return null;
        const passwordMatch = user.password.startsWith("$2")
          ? await bcrypt.compare(credentials.password as string, user.password)
          : user.password === credentials.password;
        if (!passwordMatch) return null;
        if (user.isActive === false) return null;
        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          plan: user.plan,
          subscriptionStatus: user.subscriptionStatus ?? "active",
          trialEndsAt: user.trialEndsAt,
          theme: user.theme,
          isActive: user.isActive ?? true,
          tenantId: user.tenantId ?? `t_${user.id}`,
          sexo: user.sexo,
        };
      },
    }),
  ],
});
