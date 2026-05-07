import type { NextAuthOptions } from "next-auth";
import GithubProvider from "next-auth/providers/github";
import GoogleProvider from "next-auth/providers/google";

export const authOptions: NextAuthOptions = {
  providers: [
    GithubProvider({
      clientId: process.env.GITHUB_ID!,
      clientSecret: process.env.GITHUB_SECRET!,
    }),
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  session: { strategy: "jwt" },
  callbacks: {
    jwt({ token, account }) {
      // Attach a stable, provider-scoped player ID on first sign-in
      if (account) {
        token.playerId = `${account.provider}_${account.providerAccountId}`;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.playerId as string;
      }
      return session;
    },
  },
  pages: {
    signIn: "/",   // redirect back to home on sign-in, not /auth/signin
  },
};
