import { NextResponse } from "next/server";
import * as cheerio from "cheerio";
import { prisma } from "@/lib/prisma";
import { classifyProjectType } from "@/lib/bid-classify";

export const maxDuration = 60;

const SOURCE_URL = "https://www.miamidade.gov/apps/ISD/stratproc/Home/CurrentSolicitations";

/**
 * Miami-Dade's "Construction Solicitations" page is public, static
 * server-rendered HTML with no login wall and no robots.txt restriction
 * (checked manually — Disallow rules only cover /private/ and auth flows).
 *
 * We deliberately parse the table generically (find the table whose header
 * row mentions "Solicitation") rather than hardcoding CSS classes, since
 * ASP.NET-rendered markup tends to use auto-generated class names that can
 * change between deploys.
 */
export async function POST() {
  try {
    const res = await fetch(SOURCE_URL, {
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

    // Find the table whose header row contains "Solicitation"
    let table: ReturnType<typeof $> | null = null;
    $("table").each((_, el) => {
      const headerText = $(el).find("th").first().parent().text();
      if (/solicitation/i.test(headerText)) {
        table = $(el);
      }
    });

    if (!table) {
      return NextResponse.json({
        ok: true,
        created: 0,
        note: "No solicitations table found — likely means the page currently shows 'No data to show right now'.",
      });
    }

    const rows = (table as ReturnType<typeof $>).find("tbody tr");
    let created = 0;
    let skipped = 0;

    for (const row of rows.toArray()) {
      const cells = $(row).find("td").map((_, td) => $(td).text().trim()).get();
      if (cells.length < 3) continue;

      const [externalId, , title, openingDateRaw, postedDateRaw] = cells;
      const link = $(row).find("a").first().attr("href");
      const url = link
        ? new URL(link, "https://www.miamidade.gov").toString()
        : SOURCE_URL;

      const existing = await prisma.bid.findUnique({
        where: { source_externalId: { source: "MIAMI_DADE", externalId } },
      });
      if (existing) {
        skipped++;
        continue;
      }

      const projectType = await classifyProjectType(title);

      await prisma.bid.create({
        data: {
          source: "MIAMI_DADE",
          externalId,
          title,
          agency: "Miami-Dade County",
          projectType,
          openingDate: parseDateSafe(openingDateRaw),
          postedDate: parseDateSafe(postedDateRaw),
          url,
          rawText: cells.join(" | "),
        },
      });
      created++;
    }

    return NextResponse.json({ ok: true, created, skipped });
  } catch (err) {
    console.error("Miami-Dade scrape failed", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}

function parseDateSafe(raw?: string) {
  if (!raw) return undefined;
  const d = new Date(raw);
  return isNaN(d.getTime()) ? undefined : d;
}
