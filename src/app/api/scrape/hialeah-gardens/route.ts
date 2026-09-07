import { NextResponse } from "next/server";
import * as cheerio from "cheerio";
import { prisma } from "@/lib/prisma";
import { classifyProjectType } from "@/lib/bid-classify";

export const maxDuration = 60;

const PAGE_URL = "https://www.cityofhialeahgardens.com/departments/finance/bids-proposals";

/**
 * Hialeah Gardens runs on Granicus, which server-renders this page directly
 * (unlike Miami-Dade's page, which is client-rendered) — confirmed by
 * inspecting the live DOM: the "RFP Posts" box's .box_content either holds
 * real <a> links or a "No results found." placeholder, both present in the
 * raw HTML with no JS needed.
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

    const box = $(".rfp_box .box_content");
    if (box.length === 0 || box.find(".empty_box").length > 0) {
      return NextResponse.json({
        ok: true,
        created: 0,
        skipped: 0,
        note: "No bids/proposals currently posted.",
      });
    }

    let created = 0;
    let skipped = 0;

    for (const el of box.find("a").toArray()) {
      const title = $(el).text().trim();
      const href = $(el).attr("href");
      if (!title || !href) continue;

      const url = new URL(href, PAGE_URL).toString();
      const externalId = url; // no separate bid number shown here — the detail URL is the stable identifier

      const existing = await prisma.bid.findUnique({
        where: { source_externalId: { source: "HIALEAH_GARDENS", externalId } },
      });
      if (existing) {
        skipped++;
        continue;
      }

      const projectType = await classifyProjectType(title);

      await prisma.bid.create({
        data: {
          source: "HIALEAH_GARDENS",
          externalId,
          title,
          agency: "City of Hialeah Gardens",
          projectType,
          url,
          rawText: title,
        },
      });
      created++;
    }

    return NextResponse.json({ ok: true, created, skipped });
  } catch (err) {
    console.error("Hialeah Gardens scrape failed", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
