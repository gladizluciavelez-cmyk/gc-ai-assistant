import { NextResponse } from "next/server";
import { scrapeBidnetAgency } from "@/lib/scrape-bidnet";

export const maxDuration = 60;

const URL = "https://www.bidnetdirect.com/florida/cityofmiami";

export async function POST() {
  try {
    const result = await scrapeBidnetAgency({
      url: URL,
      source: "MIAMI",
      agencyName: "City of Miami",
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("City of Miami scrape failed", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
