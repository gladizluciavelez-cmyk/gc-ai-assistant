import { NextResponse } from "next/server";
import { scrapeCivicPlusBids } from "@/lib/scrape-civicplus-bids";

export const maxDuration = 60;

const URL = "https://www.floridacityfl.gov/bids.aspx";

export async function POST() {
  try {
    const result = await scrapeCivicPlusBids({
      pageUrl: URL,
      source: "FLORIDA_CITY",
      agencyName: "City of Florida City",
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("Florida City scrape failed", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
