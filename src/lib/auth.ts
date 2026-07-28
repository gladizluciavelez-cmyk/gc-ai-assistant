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
    async session({ session, user }) {
      if (session.user) {
        (session.user as { id?: string }).id = user.id;
      }
      return session;
    },
  },
  events: {
    async signIn({ account }) {
      if (account?.provider === "google") {
        await prisma.user
          .update({
            where: { id: account.userId },
            data: { googleConnected: true },
          })
          .catch(() => {});
      }
    },
  },
};
