import { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";

// Scopes needed:
// - gmail.readonly: read the GC's inbox to parse subcontractor/permit/bid emails
// - calendar.events: create pre-bid meetings and other events
// NOTE: these are sensitive/restricted Google scopes. The OAuth consent
// screen must go through Google's verification process before this can be
// used by anyone other than approved test users. See README.
const GOOGLE_SCOPES = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/calendar.events",
].join(" ");

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
      authorization: {
        params: {
          scope: GOOGLE_SCOPES,
          access_type: "offline", // required to get a refresh_token
          prompt: "consent", // forces refresh_token on every re-auth
        },
      },
    }),
  ],
  session: { strategy: "database" },
  callbacks: {
    // IMPORTANT: NextAuth's Prisma adapter only writes tokens to the Account
    // table the very first time an account links. On every later sign-in,
    // Google issues a brand-new refresh_token (because of prompt: "consent"
    // above), but without this callback that fresh token is silently
    // discarded and the old, now-expired one stays in the database forever
    // — which is exactly what caused the recurring invalid_grant errors.
    // Upserting here makes every sign-in actually replace the stored token.
    async signIn({ user, account }) {
      if (account?.provider === "google") {
        await prisma.account.upsert({
          where: {
            provider_providerAccountId: {
              provider: account.provider,
              providerAccountId: account.providerAccountId,
            },
          },
          create: {
            userId: user.id,
            type: account.type,
            provider: account.provider,
            providerAccountId: account.providerAccountId,
            refresh_token: account.refresh_token,
            access_token: account.access_token,
            expires_at: account.expires_at,
            token_type: account.token_type,
            scope: account.scope,
            id_token: account.id_token,
            session_state: account.session_state as string | undefined,
          },
          update: {
            // Only overwrite refresh_token when Google actually sent a new
            // one — Google omits it on some re-auths, and we don't want to
            // null out a still-valid token in that case.
            ...(account.refresh_token ? { refresh_token: account.refresh_token } : {}),
            access_token: account.access_token,
            expires_at: account.expires_at,
            token_type: account.token_type,
            scope: account.scope,
            id_token: account.id_token,
          },
        });
        await prisma.user
          .update({
            where: { id: user.id },
            data: { googleConnected: true },
          })
          .catch(() => {});
      }
      return true;
    },
    async session({ session, user }) {
      if (session.user) {
        (session.user as { id?: string }).id = user.id;
      }
      return session;
    },
  },
};
