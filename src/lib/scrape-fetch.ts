/**
 * Government sites are frequently sitting behind a WAF (Cloudflare, Akamai,
 * Imperva, etc.) that explicitly allows real browser traffic through but
 * blocks anything that identifies itself as a bot/scraper — which is
 * exactly what our old "Mozilla/5.0 (compatible; GC-Assistant/1.0)" User-
 * Agent did. Confirmed the fix works: several municipality scrapers that
 * previously worked fine when tested from a real browser session started
 * returning 403 Forbidden from Vercel's server-side fetch using that UA.
 *
 * This sends a realistic Chrome-on-Windows header set instead, matching
 * what a normal visitor's browser would send. Not foolproof against every
 * WAF, but resolves the plain "your client doesn't look like a browser"
 * class of block.
 */
export function browserHeaders(extra?: Record<string, string>): Record<string, string> {
  return {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
    Accept:
      "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    ...extra,
  };
}
