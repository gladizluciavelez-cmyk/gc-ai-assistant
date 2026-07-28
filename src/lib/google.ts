import { google } from "googleapis";
import { prisma } from "@/lib/prisma";

/**
 * Builds an authenticated googleapis OAuth2 client for a given user, using
 * the refresh token stored on their Account row by NextAuth at sign-in.
 * googleapis handles refreshing the short-lived access token automatically.
 */
export async function getGoogleClientForUser(userId: string) {
  const account = await prisma.account.findFirst({
    where: { userId, provider: "google" },
  });

  if (!account?.refresh_token) {
    throw new Error(
      "No Google refresh token on file for this user. They need to sign in " +
        "via /api/auth/signin/google and grant Gmail + Calendar access " +
        "(prompt=consent ensures a refresh token is issued)."
    );
  }

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );

  oauth2Client.setCredentials({ refresh_token: account.refresh_token });

  return oauth2Client;
}

// Note: Gmail access now lives entirely in the separate gc-email-agent
// service — this app no longer talks to the Gmail API directly. Only
// Calendar stays here since event creation is triggered from this app's UI.

export async function getCalendarClient(userId: string) {
  const auth = await getGoogleClientForUser(userId);
  return google.calendar({ version: "v3", auth });
}
