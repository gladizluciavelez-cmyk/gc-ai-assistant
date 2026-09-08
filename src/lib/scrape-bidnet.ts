import * as cheerio from "cheerio";
import { prisma } from "@/lib/prisma";
import { classifyProjectType } from "@/lib/bid-classify";
import { browserHeaders } from "@/lib/scrape-fetch";
import type { BidSource } from "@prisma/client";

/**
 * Shared parser for BidNet Direct agency pages (bidnetdirect.com/florida/...)
 * — used by both City of Miami and City of Miami Beach, which run on the
 * same platform/template. Confirmed via live DOM inspection: each open
 * solicitation is a <tr> inside table.sol-table, with .sol-num (bid number),
 * .sol-title a (title + link), and .dates-col (published/closing dates as
 * plain text like "Published 09/02/2026 Closing 10/02/2026").
 *
 * Note: BidNet shows a "Page 1 of 2" control on agencies with >25 open
 * solicitations, but all rows on the current page are already present in
 * the raw server HTML (confirmed: the visible "26 Open Solicitations"
 * count matched the raw HTML's .sol-num count exactly) — page 2 itself is
 * fetched via a JS-driven AJAX call we're not following, so an agency with
 * more than ~25 open solicitations will only have its first page scraped.
 */
export async function scrapeBidnetAgency(params: {
  url: string;
  source: BidSource;
  agencyName: string;
}) {
  const { url, source, agencyName } = params;

  const res = await fetch(url, { headers: browserHeaders() });
  if (!res.ok) {
    throw new Error(`Fetch failed: ${res.status} ${res.statusText}`);
  }

  const html = await res.text();
  const $ = cheerio.load(html);

  const rows = $("table.sol-table tbody tr");
  if (rows.length === 0) {
    return { created: 0, skipped: 0, note: "No open solicitations currently posted." };
  }

  let created = 0;
  let skipped = 0;

  for (const row of rows.toArray()) {
    const externalId = $(row).find(".sol-num").first().text().trim();
    const titleLink = $(row).find(".sol-title a").first();
    const title = titleLink.text().trim();
    const href = titleLink.attr("href");
    if (!externalId || !title || !href) continue;

    const existing = await prisma.bid.findUnique({
      where: { source_externalId: { source, externalId } },
    });
    if (existing) {
      skipped++;
      continue;
    }

    const bidUrl = new URL(href, url).toString();
    const datesText = $(row).find(".dates-col").text().replace(/\s+/g, " ").trim();
    const publishedMatch = datesText.match(/Published\s+([\d/]+)/i);
    const closingMatch = datesText.match(/Closing\s+([\d/]+)/i);

    const projectType = await classifyProjectType(title);

    await prisma.bid.create({
      data: {
        source,
        externalId,
        title,
        agency: agencyName,
        projectType,
        postedDate: parseDateSafe(publishedMatch?.[1]),
        openingDate: parseDateSafe(closingMatch?.[1]),
        url: bidUrl,
        rawText: `${externalId} | ${title} | ${datesText}`,
      },
    });
    created++;
  }

  return { created, skipped };
}

function parseDateSafe(raw?: string) {
  if (!raw) return undefined;
  const d = new Date(raw);
  return isNaN(d.getTime()) ? undefined : d;
}
