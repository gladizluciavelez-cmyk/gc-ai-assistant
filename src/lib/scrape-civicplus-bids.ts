import * as cheerio from "cheerio";
import { prisma } from "@/lib/prisma";
import { classifyProjectType } from "@/lib/bid-classify";
import { browserHeaders } from "@/lib/scrape-fetch";
import type { BidSource } from "@prisma/client";

/**
 * Shared parser for CivicPlus's "Bid Postings" module (bids.aspx), used by
 * North Miami, Bay Harbor Islands, Opa-locka, Florida City, and many other
 * CivicPlus-hosted municipal sites — confirmed identical structure across
 * all of them via live DOM inspection: each bid is a
 * .listItemsRow.bid div containing .bidTitle (title link + "Bid No." text +
 * scope description) and .bidStatus (open/closed + closing date). The
 * bidID query param on each title link is a stable, page-independent ID.
 */
export async function scrapeCivicPlusBids(params: {
  pageUrl: string;
  source: BidSource;
  agencyName: string;
}) {
  const { pageUrl, source, agencyName } = params;

  const res = await fetch(pageUrl, { headers: browserHeaders() });
  if (!res.ok) {
    throw new Error(`Fetch failed: ${res.status} ${res.statusText}`);
  }

  const html = await res.text();
  const $ = cheerio.load(html);

  const rows = $(".listItemsRow.bid");
  if (rows.length === 0) {
    return { created: 0, skipped: 0, note: "No bid postings currently open." };
  }

  let created = 0;
  let skipped = 0;

  for (const row of rows.toArray()) {
    const titleEl = $(row).find(".bidTitle a").first();
    const title = titleEl.text().trim();
    const href = titleEl.attr("href");
    if (!title || !href) continue;

    const bidUrl = new URL(href, pageUrl).toString();
    const bidIdMatch = href.match(/bidID=(\d+)/);
    const externalId = bidIdMatch ? bidIdMatch[1] : bidUrl;

    const existing = await prisma.bid.findUnique({
      where: { source_externalId: { source, externalId } },
    });
    if (existing) {
      skipped++;
      continue;
    }

    // "Bid No. IFB No. 22-25-26" -> "IFB No. 22-25-26"
    const bidNoMatch = $(row).find(".bidTitle").text().match(/Bid No\.\s*([^\n]+)/);
    const scopeText = $(row).find(".bidTitle span").last().text().trim();

    const projectType = await classifyProjectType(title, scopeText.slice(0, 400));

    await prisma.bid.create({
      data: {
        source,
        externalId,
        title,
        agency: agencyName,
        projectType,
        url: bidUrl,
        rawText: `${bidNoMatch?.[1] ?? ""} | ${title} | ${scopeText.slice(0, 400)}`,
      },
    });
    created++;
  }

  return { created, skipped };
}
