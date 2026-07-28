import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getCalendarClient } from "@/lib/google";
import { prisma } from "@/lib/prisma";

/**
 * Creates a Google Calendar event for the signed-in user.
 * Body: { title, description?, startISO, endISO?, location?, bidId? }
 * If bidId is provided and the event is created successfully, the Bid
 * row is marked addedToCalendar = true so the dashboard doesn't re-offer it.
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
  const { title, description, startISO, endISO, location, bidId } = body as {
    title: string;
    description?: string;
    startISO: string;
    endISO?: string;
    location?: string;
    bidId?: string;
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

    return NextResponse.json({ ok: true, eventId: event.data.id, htmlLink: event.data.htmlLink });
  } catch (err) {
    console.error("Calendar event creation failed", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
