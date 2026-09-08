import { NextResponse } from "next/server";
import { scrapeCivicPlusBids } from "@/lib/scrape-civicplus-bids";

export const maxDuration = 60;

const URL = "https://www.bayharborislands-fl.gov/Bids.aspx?CatID=17";

export async function POST() {
  try {
    const result = await scrapeCivicPlusBids({
      pageUrl: URL,
      source: "BAY_HARBOR_ISLANDS",
      agencyName: "Town of Bay Harbor Islands",
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("Bay Harbor Islands scrape failed", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
