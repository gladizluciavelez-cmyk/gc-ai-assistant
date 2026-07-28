import { NextResponse } from "next/server";

export const maxDuration = 60;

/**
 * STUB — DemandStar is NOT wired up yet. Notes from evaluating the site:
 *
 * 1. network.demandstar.com's robots.txt allows crawling (no blanket
 *    Disallow), unlike bidnetdirect.com which explicitly blocks AI bots.
 *    So there's no policy blocker here.
 *
 * 2. BUT the actual bid browser (www.demandstar.com/app/browse-bids/...)
 *    is a client-side JS app — a plain fetch returns "You need to enable
 *    JavaScript to run this app." It cannot be scraped with cheerio/fetch
 *    like the Miami-Dade page. It needs a real browser to render it.
 *
 * 3. Full solicitation details likely require a free DemandStar account
 *    (there's a prominent Login/Register flow gating most content).
 *    Before building this out, confirm: does the GC already have a
 *    DemandStar account? If so, does DemandStar email bid-match
 *    notifications? If yes, the simpler and more robust path is parsing
 *    those notification emails via the existing /api/gmail/sync pipeline
 *    instead of scraping the site at all.
 *
 * To implement this as a real scraper:
 *  - Use playwright-core with a remote/serverless Chromium (Vercel
 *    functions can't bundle a full browser). Options: Browserless.io,
 *    Vercel's own headless browser add-on, or @sparticuz/chromium as a
 *    Lambda-compatible Chromium binary.
 *  - Store DEMANDSTAR_EMAIL / DEMANDSTAR_PASSWORD as env vars if login
 *    is required, and log in via the Playwright page before navigating
 *    to the bid list — noting the real security tradeoff of storing those
 *    credentials.
 *  - This will need re-verification periodically: JS-rendered pages break
 *    scrapers whenever the site's frontend changes, more often than static
 *    HTML tables like Miami-Dade's.
 */
export async function POST() {
  return NextResponse.json(
    {
      ok: false,
      error:
        "DemandStar scraping isn't implemented yet — see comments in this file. " +
        "Needs a decision: headless-browser scraping vs. parsing DemandStar's " +
        "email notifications via Gmail sync.",
    },
    { status: 501 }
  );
}
