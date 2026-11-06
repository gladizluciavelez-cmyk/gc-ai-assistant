import { NextRequest, NextResponse } from "next/server";
import { google, gmail_v1 } from "googleapis";
import { getOrgContext } from "@/lib/org";
import { getGoogleClientForUser } from "@/lib/google";
import { anthropic, CLAUDE_MODEL } from "@/lib/anthropic";
import { prisma } from "@/lib/prisma";

export const maxDuration = 60;

/**
 * One-time diagnostic: search the SIGNED-IN user's own Gmail (all of the last
 * year, not just what the app has synced), read the full text of emails that
 * look like bid outcomes, and have Claude say what each one is: awarded to us,
 * not awarded, awarded to someone else, post-award paperwork (notice to
 * proceed, PO, bond / insurance requests), submission receipt, and whether it
 * contains prices or points at an attached tabulation.
 *
 * Read-only. Nothing is saved. Reads only the viewer's own mailbox, using the
 * Gmail access they already granted. Open /api/bid-signals/deep while signed
 * in. It processes 30 emails per call; follow `nextPageUrl` for more.
 */

const PAGE_SIZE = 30;

// First error from the Claude step, reported in the response so failures are visible.
let firstClassifierError: string | null = null;

function decode(data: string) {
  return Buffer.from(data.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf-8");
}

function extractText(part?: gmail_v1.Schema$MessagePart): string {
  if (!part) return "";
  if (part.mimeType === "text/plain" && part.body?.data) return decode(part.body.data);
  if (part.parts) {
    const plain = part.parts.find((p) => p.mimeType === "text/plain" && p.body?.data);
    if (plain?.body?.data) return decode(plain.body.data);
    for (const p of part.parts) {
      const t = extractText(p);
      if (t) return t;
    }
  }
  if (part.mimeType === "text/html" && part.body?.data) {
    return decode(part.body.data).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
  }
  return "";
}

function attachmentNames(part?: gmail_v1.Schema$MessagePart, out: string[] = []): string[] {
  if (!part) return out;
  if (part.filename) out.push(part.filename);
  for (const p of part.parts ?? []) attachmentNames(p, out);
  return out;
}

const header = (msg: gmail_v1.Schema$Message, name: string) =>
  msg.payload?.headers?.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value ?? "";

const GENERIC_NAME_WORDS = new Set(["inc", "llc", "corp", "company", "services", "service", "engineering", "construction", "group", "contractors", "contracting", "builders", "the"]);

// How the company's price compares with the others, when the email lists them.
function benchmark(prices: Outcome["prices"], token: string) {
  if (!prices || !token) return null;
  const clean = prices.filter((p) => p && typeof p.amount === "number" && p.amount > 0 && typeof p.bidder === "string");
  if (clean.length < 2) return null;
  // Need at least two different companies, otherwise these are not competing bids
  // (e.g. two payments to the same contractor).
  if (new Set(clean.map((p) => p.bidder.toLowerCase().trim())).size < 2) return null;
  const sorted = [...clean].sort((a, b) => a.amount - b.amount);
  const idx = sorted.findIndex((p) => p.bidder.toLowerCase().includes(token));
  if (idx === -1) return null;
  const ours = sorted[idx].amount;
  if (idx === 0) {
    const next = sorted[1].amount;
    return { position: "lowest", ours, nextLowest: next, gap: Math.round((next - ours) * 100) / 100, gapPct: Math.round(((next - ours) / ours) * 10000) / 100, bidders: sorted.length };
  }
  const low = sorted[0];
  return { position: idx + 1, ours, lowestBidder: low.bidder, lowest: low.amount, over: Math.round((ours - low.amount) * 100) / 100, overPct: Math.round(((ours - low.amount) / low.amount) * 10000) / 100, bidders: sorted.length };
}

type Outcome = {
  outcomeType: string;
  project: string | null;
  agency: string | null;
  winner: string | null;
  weWon: boolean | null;
  pricesInBody: boolean;
  prices: Array<{ bidder: string; amount: number }> | null;
  pricesLikelyInAttachment: boolean;
  evidence: string | null;
};

async function classify(orgName: string, msg: {
  from: string;
  subject: string;
  date: string;
  attachments: string[];
  body: string;
}): Promise<Outcome | null> {
  const system = `You analyze one email for a general contractor (GC) company called "${orgName}" that bids on public projects.
Decide whether the email tells the outcome or status of a bid, quote or RFQ. Return ONLY a JSON object, no other text:
{
 "outcomeType": one of "AWARDED_TO_US" (the email says or shows our company was awarded, selected, lowest bidder, or placed on a pre-qualified list), "NOT_AWARDED_TO_US" (we lost, were not selected, or got a non-award notice), "AWARDED_TO_OTHER" (names another winner and not us), "CANCELLED", "POST_AWARD" (notice to proceed, purchase order, contract to sign, bond or insurance request that follows an award), "SUBMISSION" (receipt or confirmation of a bid we submitted), "OTHER_BID_RELATED", "NOT_BID_RELATED",
 "project": project name or number, or null,
 "agency": agency name, or null,
 "winner": winning company name if stated, or null,
 "weWon": true / false / null if unclear,
 "pricesInBody": true only if bid amounts appear in the email text,
 "prices": a JSON array of {"bidder": company name, "amount": number in dollars} for every bidder price listed in the email text, else null,
 "pricesLikelyInAttachment": true if an attachment is named like a tabulation, results or award, or the text refers to an attached tabulation,
 "evidence": under 20 words, paraphrased, why you chose this
}
Only use what is in the email. If unsure, use null or OTHER_BID_RELATED.`;
  try {
    const res = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 900,
      system,
      messages: [
        {
          role: "user",
          content: `From: ${msg.from}\nSubject: ${msg.subject}\nDate: ${msg.date}\nAttachments: ${msg.attachments.join(", ") || "none"}\n\nBody:\n${msg.body.slice(0, 5000)}`,
        },
      ],
    });
    const block = res.content[0];
    const txt = block && block.type === "text" ? block.text : "";
    if (txt.indexOf("{") === -1) {
      throw new Error(`No JSON in reply (stop_reason=${res.stop_reason}): ${txt.slice(0, 120)}`);
    }
    const json = txt.slice(txt.indexOf("{"), txt.lastIndexOf("}") + 1);
    return JSON.parse(json) as Outcome;
  } catch (err) {
    if (!firstClassifierError) {
      firstClassifierError = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
    }
    return null;
  }
}

export async function GET(req: NextRequest) {
  const ctx = await getOrgContext();
  if (!ctx) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  firstClassifierError = null;
  const org = await prisma.organization.findUnique({ where: { id: ctx.orgId }, select: { name: true } });
  const orgName = org?.name ?? "our company";
  const orgToken =
    orgName
      .toLowerCase()
      .replace(/[^a-z0-9 ]/g, " ")
      .split(/\s+/)
      .find((w) => w.length >= 4 && !GENERIC_NAME_WORDS.has(w)) ?? "";

  let gmail: gmail_v1.Gmail;
  try {
    gmail = google.gmail({ version: "v1", auth: await getGoogleClientForUser(ctx.userId) });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "No Google access" }, { status: 400 });
  }

  const terms = [
    "award", "awarded", '"notice of award"', '"intent to award"', '"non-award"', "tabulation",
    '"lowest bidder"', '"low bidder"', '"notice to proceed"', '"purchase order"', '"pre-qualified"',
    '"bid results"', '"bid tabulation"', '"certificate of insurance"', '"performance bond"',
    '"change of contractor"', "selected", '"as read"', "bidder", "RPQ", "ITQ", "EVN", '"bid opening"',
  ];
  const q = `newer_than:1y -category:promotions -category:social (${terms.join(" OR ")})`;

  const pageToken = req.nextUrl.searchParams.get("pageToken") ?? undefined;
  const list = await gmail.users.messages.list({ userId: "me", q, maxResults: PAGE_SIZE, pageToken });
  const ids = (list.data.messages ?? []).map((m) => m.id!).filter(Boolean);

  const items: Array<Record<string, unknown>> = [];
  for (let i = 0; i < ids.length; i += 8) {
    const batch = ids.slice(i, i + 8);
    const results = await Promise.all(
      batch.map(async (id) => {
        try {
          const full = await gmail.users.messages.get({ userId: "me", id, format: "full" });
          const msg = full.data;
          const meta = {
            from: header(msg, "From"),
            subject: header(msg, "Subject"),
            date: header(msg, "Date"),
            attachments: attachmentNames(msg.payload ?? undefined),
            body: extractText(msg.payload ?? undefined),
          };
          const outcome = (await classify(orgName, meta)) ?? (await classify(orgName, meta));
          return { meta, outcome };
        } catch {
          return null;
        }
      })
    );
    for (const r of results) {
      if (!r) continue;
      items.push({
        date: r.meta.date ? new Date(r.meta.date).toISOString().slice(0, 10) : null,
        from: r.meta.from,
        subject: r.meta.subject,
        attachments: r.meta.attachments,
        ...(r.outcome ?? { outcomeType: "UNCLASSIFIED" }),
        benchmark: benchmark(r.outcome?.prices ?? null, orgToken),
      });
    }
  }

  const relevant = items.filter((x) => x.outcomeType !== "NOT_BID_RELATED");
  const byOutcome: Record<string, number> = {};
  for (const x of items) byOutcome[String(x.outcomeType)] = (byOutcome[String(x.outcomeType)] ?? 0) + 1;

  const next = list.data.nextPageToken
    ? `${req.nextUrl.origin}/api/bid-signals/deep?pageToken=${encodeURIComponent(list.data.nextPageToken)}`
    : null;

  return NextResponse.json({
    scope: "Your own Gmail, last 12 months, emails matching award/outcome terms or your company name",
    searched: q,
    analyzedThisPage: items.length,
    classifierError: firstClassifierError,
    notBidRelated: items.length - relevant.length,
    byOutcome,
    weWonCount: relevant.filter((x) => x.weWon === true).length,
    emailsWithPricesInBody: relevant.filter((x) => x.pricesInBody === true).length,
    emailsWithPricesLikelyInAttachment: relevant.filter((x) => x.pricesLikelyInAttachment === true).length,
    nextPageUrl: next,
    items: relevant,
  });
}
