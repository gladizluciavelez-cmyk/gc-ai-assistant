import { NextResponse } from "next/server";
import { getOrgContext } from "@/lib/org";
import { emailVisibility } from "@/lib/visibility";
import { prisma } from "@/lib/prisma";

/**
 * Read-only feasibility report: of the bids that show up in the signed-in
 * user's visible emails, how many have a detectable *submission* and a
 * detectable *result* (award / not selected / bid tabulation) in their email?
 *
 * Open /api/bid-signals in the browser while signed in. It only looks at
 * emails the viewer is allowed to see (same rules as Recent Emails), and only
 * at subject + snippet + summary — full bodies and attachments are not stored,
 * so every number here is a LOWER BOUND on what a body-reading classifier
 * could find.
 */

const RESULT_RE =
  /(notice of (intent to )?award|intent to award|recommend(ation|ed)? (of |for )?award|award recommendation|bid award|contract award|award of (the )?(contract|bid)|awarded|not (been )?selected|unsuccessful|regret to inform|bid tabulation|tabulation|bid results?|(lowest|low)( (priced?|responsive|responsible|qualified))? bidder|bid opening results?|non-award)/i;
// Words that should not be used to recognise the user's own company in an email.
const GENERIC_NAME_WORDS = new Set(["inc", "llc", "corp", "company", "services", "service", "engineering", "construction", "group", "contractors", "contracting", "the"]);
const SUBMIT_RE =
  /(bid|proposal) (submission|submitted|receipt|received)|submission (receipt|confirmation)|confirmation of (your )?(bid|submission)|(attached|enclosed) (is|are) (our|my|the) (bid|proposal)|please find (our|my|the attached) (bid|proposal)/i;
const MONEY_RE = /\$\s?\d[\d,]*(\.\d+)?/;

type Row = {
  id: string;
  from: string;
  subject: string;
  snippet: string | null;
  summary: string | null;
  category: string;
  bidProjectNumber: string | null;
  receivedAt: Date;
};

const pct = (n: number, d: number) => (d === 0 ? null : Math.round((n / d) * 100));
const sample = (rows: Row[]) =>
  rows.slice(0, 10).map((r) => ({
    date: r.receivedAt.toISOString().slice(0, 10),
    from: r.from,
    subject: r.subject,
  }));

export async function GET() {
  const ctx = await getOrgContext();
  if (!ctx) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const me = await prisma.user.findUnique({ where: { id: ctx.userId }, select: { email: true } });
  const myEmail = me?.email?.toLowerCase() ?? "";

  const rows: Row[] = await prisma.emailRecord.findMany({
    where: emailVisibility(ctx),
    orderBy: { receivedAt: "desc" },
    take: 5000,
    select: {
      id: true,
      from: true,
      subject: true,
      snippet: true,
      summary: true,
      category: true,
      bidProjectNumber: true,
      receivedAt: true,
    },
  });

  // The company's own name, so we can spot award emails that name it as the
  // winner instead of saying "you won".
  const org = await prisma.organization.findUnique({ where: { id: ctx.orgId }, select: { name: true } });
  const orgToken =
    (org?.name ?? "")
      .toLowerCase()
      .replace(/[^a-z0-9 ]/g, " ")
      .split(/\s+/)
      .find((w) => w.length >= 4 && !GENERIC_NAME_WORDS.has(w)) ?? "";

  const text = (r: Row) => `${r.subject} ${r.snippet ?? ""} ${r.summary ?? ""}`;
  const namesUs = (r: Row) => orgToken !== "" && text(r).toLowerCase().includes(orgToken);
  const sentByMe = (r: Row) => myEmail !== "" && r.from.toLowerCase().includes(myEmail);

  const byCategory: Record<string, number> = {};
  for (const r of rows) byCategory[r.category] = (byCategory[r.category] ?? 0) + 1;

  const resultEmails = rows.filter((r) => RESULT_RE.test(text(r)));
  const submitEmails = rows.filter(
    (r) => SUBMIT_RE.test(text(r)) || (sentByMe(r) && /\b(bid|proposal)\b/i.test(r.subject))
  );

  // Distinct bids = BID_INVITE emails that carry a parsed project number.
  const bids = new Map<string, Row>();
  for (const r of rows) {
    const key = r.bidProjectNumber?.trim().toLowerCase();
    if (r.category === "BID_INVITE" && key && !bids.has(key)) bids.set(key, r);
  }

  let withSubmission = 0;
  let withResult = 0;
  let withPrice = 0;
  for (const key of Array.from(bids.keys())) {
    const mentions = (r: Row) => text(r).toLowerCase().includes(key);
    const sub = submitEmails.some(mentions);
    const res = resultEmails.filter(mentions);
    if (sub) withSubmission++;
    if (res.length > 0) withResult++;
    if (res.some((r) => MONEY_RE.test(text(r)))) withPrice++;
  }

  const totalBids = bids.size;
  return NextResponse.json({
    scope: "Emails visible to you (subject + snippet + summary only)",
    caveat:
      "Lower bound: bodies and PDF attachments are not stored, so a classifier that reads full emails would find more.",
    totalEmails: rows.length,
    byCategory,
    distinctBidsWithProjectNumber: totalBids,
    bidsWithDetectableSubmission: { count: withSubmission, pct: pct(withSubmission, totalBids) },
    bidsWithDetectableResult: { count: withResult, pct: pct(withResult, totalBids) },
    bidsWithPriceInResultEmail: { count: withPrice, pct: pct(withPrice, totalBids) },
    companyNameUsedForMatching: orgToken || "(none found)",
    resultEmailsNamingYourCompany: {
      note: "Result-style emails (award, lowest bidder, tabulation, non-award) that mention your company name, so likely wins or placements",
      count: resultEmails.filter(namesUs).length,
      examples: sample(resultEmails.filter(namesUs)),
    },
    emailsMentioningYourCompanyFromOthers: {
      note: "Emails from others that mention your company name (any topic) so you can spot ones that show prices",
      count: rows.filter((r) => namesUs(r) && !sentByMe(r)).length,
      examples: sample(rows.filter((r) => namesUs(r) && !sentByMe(r))),
    },
    resultLikeEmails: { count: resultEmails.length, examples: sample(resultEmails) },
    submissionLikeEmails: { count: submitEmails.length, examples: sample(submitEmails) },
  });
}
