import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { classifyProjectType } from "@/lib/bid-classify";
import { browserHeaders } from "@/lib/scrape-fetch";

export const maxDuration = 60;

const LIST_URL = "https://www.miamidade.gov/apps/isd/StratProc/Home/CurrentSolicitationsList";
const DETAILS_BASE = "https://www.miamidade.gov/apps/isd/StratProc/Home/SolicitationDetails";

interface SolicitationRow {
  solicitationNumber: string;
  solicitationType: string;
  title: string;
  openingDate: string;
  postedDate: string;
}

/**
 * The "Construction Solicitations" page itself is a client-rendered
 * DataTable — the static HTML always says "No data to show right now"
 * because the real rows are fetched by the page's own JS after load. This
 * scraper hits that same underlying JSON endpoint directly (found via the
 * browser's network tab: CurrentSolicitationsList) instead of parsing HTML
 * that will never contain the data server-side.
 */
export async function POST() {
  try {
    const res = await fetch(LIST_URL, {
      headers: browserHeaders({ Accept: "application/json" }),
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: `Fetch failed: ${res.status} ${res.statusText}` },
        { status: 502 }
      );
    }

    const rows: SolicitationRow[] = await res.json();

    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({
        ok: true,
        created: 0,
        skipped: 0,
        note: "No construction solicitations currently posted.",
      });
    }

    let created = 0;
    let skipped = 0;

    for (const row of rows) {
      const externalId = row.solicitationNumber;
      if (!externalId || !row.title) continue;

      const existing = await prisma.bid.findUnique({
        where: { source_externalId: { source: "MIAMI_DADE", externalId } },
      });
      if (existing) {
        skipped++;
        continue;
      }

      const projectType = await classifyProjectType(row.title, row.solicitationType);
      const url = `${DETAILS_BASE}?solNumber=${encodeURIComponent(externalId)}`;

      await prisma.bid.create({
        data: {
          source: "MIAMI_DADE",
          externalId,
          title: row.title,
          agency: "Miami-Dade County",
          projectType,
          openingDate: parseDateSafe(row.openingDate),
          postedDate: parseDateSafe(row.postedDate),
          url,
          rawText: `${externalId} | ${row.solicitationType} | ${row.title} | ${row.openingDate} | ${row.postedDate}`,
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
