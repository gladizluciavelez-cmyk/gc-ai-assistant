import { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";
import { createSoloOrg } from "@/lib/org-create";

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
  events: {
    // Every new sign-up becomes the owner of their own organization, so their
    // data is isolated from every other customer's.
    async createUser({ user }) {
      await createSoloOrg(user.id, user.name, user.email);
    },

    // IMPORTANT: NextAuth's Prisma adapter only writes tokens to the Account
    // table the very first time an account links. On every later sign-in,
    // Google issues a brand-new refresh_token (because of prompt: "consent"
    // above), but without this the fresh token is silently discarded and the
    // old, now-expired one stays in the database forever — which is exactly
    // what caused the recurring invalid_grant errors. Upserting here makes
    // every sign-in actually replace the stored token.
    //
    // This must be an *event*, not the signIn callback: the signIn callback
    // runs BEFORE the adapter creates a brand-new user, so user.id is not yet
    // a real User row and the Account insert violates Account_userId_fkey
    // (the error every new sign-up hit). Events run after user + account exist.
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
    },
  },
  callbacks: {
    async session({ session, user }) {
      if (session.user) {
        (session.user as { id?: string }).id = user.id;
      }
      return session;
    },
  },
};
