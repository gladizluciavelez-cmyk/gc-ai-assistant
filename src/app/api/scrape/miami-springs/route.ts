import { NextResponse } from "next/server";
import * as cheerio from "cheerio";
import { prisma } from "@/lib/prisma";
import { classifyProjectType } from "@/lib/bid-classify";

export const maxDuration = 60;

const PAGE_URL = "https://www.miamisprings-fl.gov/rfps";

/**
 * Miami Springs runs Drupal (a "Bids and RFPs" Views listing —
 * .view-bids-and-rfps, with .view-empty shown when there's nothing and
 * .views-row entries when populated). The page itself is server-rendered,
 * BUT the site sits behind Cloudflare's bot-check ("Just a moment...")
 * intermittently — confirmed by hitting it twice and getting the challenge
 * page once, real content the next time. A plain server-side fetch can't
 * solve that challenge, so this explicitly detects it and reports a clear
 * error instead of silently parsing 0 results from a challenge page.
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

    if (/just a moment|checking your browser|cf-browser-verification/i.test(html)) {
      return NextResponse.json(
        {
          error:
            "Miami Springs' site is behind a bot-check page right now and blocked this scrape. Try again later.",
        },
        { status: 503 }
      );
    }

    const $ = cheerio.load(html);
    const view = $(".view-bids-and-rfps");

    if (view.length === 0 || view.find(".view-empty").length > 0) {
      return NextResponse.json({
        ok: true,
        created: 0,
        skipped: 0,
        note: "No bids or RFPs currently posted.",
      });
    }

    let created = 0;
    let skipped = 0;

    for (const row of view.find(".views-row").toArray()) {
      const link = $(row).find("a").first();
      const title = link.text().trim();
      const href = link.attr("href");
      if (!title || !href) continue;

      const url = new URL(href, PAGE_URL).toString();
      const externalId = url;

      const existing = await prisma.bid.findUnique({
        where: { source_externalId: { source: "MIAMI_SPRINGS", externalId } },
      });
      if (existing) {
        skipped++;
        continue;
      }

      const projectType = await classifyProjectType(title);

      await prisma.bid.create({
        data: {
          source: "MIAMI_SPRINGS",
          externalId,
          title,
          agency: "City of Miami Springs",
          projectType,
          url,
          rawText: title,
        },
      });
      created++;
    }

    return NextResponse.json({ ok: true, created, skipped });
  } catch (err) {
    console.error("Miami Springs scrape failed", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
