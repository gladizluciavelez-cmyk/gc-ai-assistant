import { NextResponse } from "next/server";
import * as cheerio from "cheerio";
import { prisma } from "@/lib/prisma";
import { classifyProjectType } from "@/lib/bid-classify";
import { browserHeaders } from "@/lib/scrape-fetch";

export const maxDuration = 60;

const PAGE_URL = "https://www.cutlerbay-fl.gov/rfps?field_bid_rfp_status_value_1=All";

/**
 * Cutler Bay runs Drupal 7 with a "view-rfps" Views table (not the row-div
 * layout Miami Springs uses) — confirmed via live DOM inspection. Each
 * solicitation is a <tr> in table.views-table with columns for title/link,
 * closing date, status, and files. We query with status=All so
 * closed/awarded bids aren't hidden by the default "open" filter.
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

    if ($(".view-rfps .view-empty").length > 0) {
      return NextResponse.json({ ok: true, created: 0, skipped: 0 });
    }

    const rows = $(".view-rfps table.views-table tbody tr");
    if (rows.length === 0) {
      return NextResponse.json({
        ok: true,
        created: 0,
        skipped: 0,
        note: "No RFP table rows found on the page.",
      });
    }

    let created = 0;
    let skipped = 0;

    for (const row of rows.toArray()) {
      const $row = $(row);
      const titleLink = $row.find("td.views-field-title a").first();
      const title = titleLink.text().trim();
      if (!title) continue;

      const href = titleLink.attr("href");
      const url = href ? new URL(href, PAGE_URL).toString() : PAGE_URL;
      const externalId = href ? href : title;

      const existing = await prisma.bid.findUnique({
        where: { source_externalId: { source: "CUTLER_BAY", externalId } },
      });
      if (existing) {
        skipped++;
        continue;
      }

      const closingDate = $row
        .find("td.views-field-field-bid-rfp-due-date")
        .text()
        .trim();
      const status = $row
        .find("td.views-field-field-bid-rfp-status")
        .text()
        .trim();

      const rawText = [title, status && `Status: ${status}`, closingDate && `Closing: ${closingDate}`]
        .filter(Boolean)
        .join(" | ");

      const projectType = await classifyProjectType(title, rawText.slice(0, 400));

      await prisma.bid.create({
        data: {
          source: "CUTLER_BAY",
          externalId,
          title,
          agency: "Town of Cutler Bay",
          projectType,
          url,
          rawText: rawText.slice(0, 500),
        },
      });
      created++;
    }

    return NextResponse.json({ ok: true, created, skipped });
  } catch (err) {
    console.error("Cutler Bay scrape failed", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
