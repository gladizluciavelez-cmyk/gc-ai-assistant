import { NextResponse } from "next/server";
import { scrapeBidnetAgency } from "@/lib/scrape-bidnet";

export const maxDuration = 60;

const URL = "https://www.bidnetdirect.com/florida/cityofmiamibeach";

export async function POST() {
  try {
    const result = await scrapeBidnetAgency({
      url: URL,
      source: "MIAMI_BEACH",
      agencyName: "City of Miami Beach",
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("Miami Beach scrape failed", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
