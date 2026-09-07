import { NextResponse } from "next/server";
import * as cheerio from "cheerio";
import { prisma } from "@/lib/prisma";
import { classifyProjectType } from "@/lib/bid-classify";

export const maxDuration = 60;

const PAGE_URL = "https://www.msvfl.gov/CurrentSolicitations";

/**
 * Miami Shores runs EvoGov. The "Current Solicitations list" section is
 * server-rendered inside a .evo_grid_faq_section_wrapper block — confirmed
 * live, currently empty (each entry template renders as an HTML comment
 * with nothing between them when there's no active solicitation). We match
 * on the section's heading text rather than its auto-generated wrapper ID
 * (e.g. "faq19838wrapper"), since that ID looks like it could change
 * between deploys.
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

    let wrapper: ReturnType<typeof $> | null = null;
    $(".evo_grid_faq_section_wrapper").each((_, el) => {
      const heading = $(el).find(".evo_faq_section_title_heading").first().text();
      if (/current solicitations/i.test(heading)) {
        wrapper = $(el);
      }
    });

    if (!wrapper) {
      return NextResponse.json({
        ok: true,
        created: 0,
        skipped: 0,
        note: "Couldn't find the Current Solicitations section on the page.",
      });
    }

    const entries = (wrapper as ReturnType<typeof $>).find("a");
    if (entries.length === 0) {
      return NextResponse.json({
        ok: true,
        created: 0,
        skipped: 0,
        note: "No current solicitations posted.",
      });
    }

    let created = 0;
    let skipped = 0;

    for (const el of entries.toArray()) {
      const title = $(el).text().trim();
      const href = $(el).attr("href");
      if (!title || !href) continue;

      const url = new URL(href, PAGE_URL).toString();
      const externalId = url;

      const existing = await prisma.bid.findUnique({
        where: { source_externalId: { source: "MIAMI_SHORES", externalId } },
      });
      if (existing) {
        skipped++;
        continue;
      }

      const projectType = await classifyProjectType(title);

      await prisma.bid.create({
        data: {
          source: "MIAMI_SHORES",
          externalId,
          title,
          agency: "Miami Shores Village",
          projectType,
          url,
          rawText: title,
        },
      });
      created++;
    }

    return NextResponse.json({ ok: true, created, skipped });
  } catch (err) {
    console.error("Miami Shores scrape failed", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
