import { NextResponse } from "next/server";
import * as cheerio from "cheerio";
import { prisma } from "@/lib/prisma";
import { classifyProjectType } from "@/lib/bid-classify";

export const maxDuration = 60;

const PAGE_URL =
  "https://www.cityofdoral.com/Departments/Procurement-and-Asset-Management-Department/Active-Solicitations-2025";

/**
 * Doral's "Active Solicitations" page server-renders each solicitation as an
 * accordion item (.accordion-list-item-container), with the bid number
 * embedded at the start of the title (e.g. "2025-27 RFP Pre-Construction...")
 * — confirmed via live DOM inspection. No separate opening/closing date
 * field on this page; dates live inside the linked PDF documents.
 */
export async function POST() {
  try {
    const res = await fetch(PAGE_URL, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; GC-Assistant/1.0)" },
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: `Fetch failed: ${res.status} ${res.statusText}` },
        { status: 502 }
      );
    }

    const html = await res.text();
    const $ = cheerio.load(html);

    const items = $(".accordion-list-item-container");
    if (items.length === 0) {
      return NextResponse.json({
        ok: true,
        created: 0,
        skipped: 0,
        note: "No active solicitations found on the page.",
      });
    }

    let created = 0;
    let skipped = 0;

    for (const el of items.toArray()) {
      const title = $(el).find(".item-text").first().text().trim();
      if (!title) continue;

      // Bid number is the leading token of the title, e.g. "2025-27" in
      // "2025-27 RFP Pre-Construction...". Falls back to the full title if
      // the format doesn't match (still unique enough to dedup on).
      const numberMatch = title.match(/^(\d{4}-\d+)/);
      const externalId = numberMatch ? numberMatch[1] : title;

      const existing = await prisma.bid.findUnique({
        where: { source_externalId: { source: "DORAL", externalId } },
      });
      if (existing) {
        skipped++;
        continue;
      }

      const firstDocLink = $(el).find("a.document").first().attr("href");
      const url = firstDocLink ? new URL(firstDocLink, PAGE_URL).toString() : PAGE_URL;
      const description = $(el).find(".oc-wysiwyg-container-panel-content").first().text().trim();

      const projectType = await classifyProjectType(title, description.slice(0, 500));

      await prisma.bid.create({
        data: {
          source: "DORAL",
          externalId,
          title,
          agency: "City of Doral",
          projectType,
          url,
          rawText: `${title} | ${description.slice(0, 500)}`,
        },
      });
      created++;
    }

    return NextResponse.json({ ok: true, created, skipped });
  } catch (err) {
    console.error("Doral scrape failed", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
