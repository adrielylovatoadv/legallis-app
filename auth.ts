import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";

const USERS = [
  { id: "1", name: "Adriely", email: "adriely@legallis", password: "lovato2024" },
  { id: "2", name: "Eduarda", email: "eduarda@legallis", password: "estevao2024" },
];

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Credentials({
      credentials: {
        email: { label: "Usuário", type: "text" },
        password: { label: "Senha", type: "password" },
      },
      async authorize(credentials) {
        const user = USERS.find(
          u => u.email === credentials.email && u.password === credentials.password
        );
        return user ?? null;
      },
    }),
  ],
  pages: { signIn: "/login" },
  callbacks: {
    authorized({ auth, request }) {
      const isLoggedIn = !!auth?.user;
      const isPublic = request.nextUrl.pathname.startsWith("/login");
      if (isPublic) return true;
      return isLoggedIn;
    },
  },
  session: { strategy: "jwt" },
});
