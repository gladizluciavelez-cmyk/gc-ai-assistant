import { NextResponse } from "next/server";

export const maxDuration = 60;

/**
 * Fans out to every municipality-specific scraper and aggregates the
 * results into one response, so the dashboard only needs a single button
 * ("Scrape Miami-Dade municipalities") instead of one per city. Each
 * individual scraper stays a standalone route (still directly callable, and
 * still what the daily cron hits) — this just wraps them together for the
 * on-demand button.
 */
const SCRAPERS: { label: string; path: string }[] = [
  { label: "Miami-Dade County", path: "/api/scrape/miami-dade" },
  { label: "Hialeah Gardens", path: "/api/scrape/hialeah-gardens" },
  { label: "Doral", path: "/api/scrape/doral" },
  { label: "Miami Springs", path: "/api/scrape/miami-springs" },
  { label: "Miami Shores", path: "/api/scrape/miami-shores" },
  { label: "City of Miami", path: "/api/scrape/miami" },
  { label: "Miami Beach", path: "/api/scrape/miami-beach" },
  { label: "North Miami", path: "/api/scrape/north-miami" },
  { label: "Bay Harbor Islands", path: "/api/scrape/bay-harbor-islands" },
  { label: "Opa-locka", path: "/api/scrape/opa-locka" },
  { label: "Florida City", path: "/api/scrape/florida-city" },
  { label: "Surfside", path: "/api/scrape/surfside" },
  { label: "Cutler Bay", path: "/api/scrape/cutler-bay" },
];

export async function POST(req: Request) {
  const baseUrl = new URL(req.url).origin;

  const results: Record<string, unknown> = {};
  let totalCreated = 0;
  let totalSkipped = 0;
  const errors: string[] = [];

  for (const scraper of SCRAPERS) {
    try {
      const res = await fetch(`${baseUrl}${scraper.path}`, { method: "POST" });
      const rawText = await res.text();
      let data: { created?: number; skipped?: number; error?: string; note?: string } = {};
      try {
        data = rawText ? JSON.parse(rawText) : {};
      } catch {
        data = { error: rawText || `Empty response (status ${res.status})` };
      }

      results[scraper.label] = data;

      if (!res.ok || data.error) {
        errors.push(`${scraper.label}: ${data.error ?? "failed"}`);
      } else {
        totalCreated += data.created ?? 0;
        totalSkipped += data.skipped ?? 0;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      results[scraper.label] = { error: message };
      errors.push(`${scraper.label}: ${message}`);
    }
  }

  return NextResponse.json({
    ok: errors.length === 0,
    created: totalCreated,
    skipped: totalSkipped,
    note: errors.length > 0 ? `Issues: ${errors.join("; ")}` : undefined,
    byMunicipality: results,
  });
}
