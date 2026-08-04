import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getCalendarClient } from "@/lib/google";
import { prisma } from "@/lib/prisma";

/**
 * Creates a Google Calendar event for the signed-in user.
 * Body: { title, description?, startISO, endISO?, location?, bidId?, emailId? }
 * If bidId is provided, the Bid row is marked addedToCalendar = true.
 * If emailId is provided (the "confirm this pre-bid meeting" flow), the
 * EmailRecord is marked addedToCalendar = true instead.
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json(
      { error: "Not authenticated. Sign in with Google first (calendar access requires it)." },
      { status: 401 }
    );
  }
  const userId = (session.user as { id: string }).id;

  const body = await req.json();
  const { title, description, startISO, endISO, location, bidId, emailId } = body as {
    title: string;
    description?: string;
    startISO: string;
    endISO?: string;
    location?: string;
    bidId?: string;
    emailId?: string;
  };

  if (!title || !startISO) {
    return NextResponse.json({ error: "title and startISO are required" }, { status: 400 });
  }

  const start = new Date(startISO);
  const end = endISO ? new Date(endISO) : new Date(start.getTime() + 60 * 60 * 1000); // default 1hr

  try {
    const calendar = await getCalendarClient(userId);

    const event = await calendar.events.insert({
      calendarId: "primary",
      requestBody: {
        summary: title,
        description,
        location,
        start: { dateTime: start.toISOString() },
        end: { dateTime: end.toISOString() },
        reminders: { useDefault: true },
      },
    });

    if (bidId) {
      await prisma.bid.update({
        where: { id: bidId },
        data: { addedToCalendar: true, preBidMeetingAt: start },
      });
    }

    if (emailId) {
      await prisma.emailRecord.update({
        where: { id: emailId },
        data: { addedToCalendar: true },
      });
    }

    return NextResponse.json({ ok: true, eventId: event.data.id, htmlLink: event.data.htmlLink });
  } catch (err) {
    console.error("Calendar event creation failed", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
