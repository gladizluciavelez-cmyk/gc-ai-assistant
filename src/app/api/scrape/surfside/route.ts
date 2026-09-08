import { NextResponse } from "next/server";
import * as cheerio from "cheerio";
import { prisma } from "@/lib/prisma";
import { classifyProjectType } from "@/lib/bid-classify";
import { browserHeaders } from "@/lib/scrape-fetch";

export const maxDuration = 60;

const PAGE_URL = "https://www.townofsurfsidefl.gov/departments-services/finance/bids-and-rfps";

/**
 * Surfside runs Sitefinity. Each solicitation is grouped under an
 * .sfmediaFieldTitle heading (e.g. "RFP 2026-05") followed by a
 * ul.download-list of document links (notices, addenda, bid-opening lists,
 * etc.) — confirmed via live DOM inspection. There's no single canonical
 * detail page per solicitation, so the bid's own URL points at the first
 * (usually most descriptive) document link instead.
 */
export async function POST() {
  try {
    const res = await fetch(PAGE_URL, { headers: browserHeaders() });

    if (!res.ok) {
      return NextResponse.json(
        { error: `Fetch failed: ${res.status} ${res.statusText}` },
        { status: 502 }
      );
    }

    const html = await res.text();
    const $ = cheerio.load(html);

    const headings = $(".sfmediaFieldTitle");
    if (headings.length === 0) {
      return NextResponse.json({
        ok: true,
        created: 0,
        skipped: 0,
        note: "No solicitation sections found on the page.",
      });
    }

    let created = 0;
    let skipped = 0;

    for (const heading of headings.toArray()) {
      const title = $(heading).text().trim();
      if (!title) continue;

      // Solicitation number is the leading token, e.g. "RFP 2026-05" or "ITB 2026-02".
      const numberMatch = title.match(/^([A-Z]+\s*\d{4}-\d+)/);
      const externalId = numberMatch ? numberMatch[1].replace(/\s+/g, " ") : title;

      const existing = await prisma.bid.findUnique({
        where: { source_externalId: { source: "SURFSIDE", externalId } },
      });
      if (existing) {
        skipped++;
        continue;
      }

      // Documents live in the ul.download-list immediately following the heading.
      const docList = $(heading).next("ul.download-list");
      const firstDoc = docList.find("a.download-title").first();
      const url = firstDoc.attr("href")
        ? new URL(firstDoc.attr("href")!, PAGE_URL).toString()
        : PAGE_URL;
      const docTitles = docList
        .find("a.download-title")
        .map((_, a) => $(a).text().trim())
        .get()
        .join(" | ");

      const projectType = await classifyProjectType(title, docTitles.slice(0, 400));

      await prisma.bid.create({
        data: {
          source: "SURFSIDE",
          externalId,
          title,
          agency: "Town of Surfside",
          projectType,
          url,
          rawText: `${title} | ${docTitles.slice(0, 500)}`,
        },
      });
      created++;
    }

    return NextResponse.json({ ok: true, created, skipped });
  } catch (err) {
    console.error("Surfside scrape failed", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
