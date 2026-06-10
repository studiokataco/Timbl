"use server"

/*
 * Server-side helpers for asset previews. Browsers can't fetch most third-
 * party HTML pages cross-origin to scrape `og:image`; doing it server-side
 * avoids CORS and keeps API keys (Canva, etc.) off the client.
 */
export async function fetchOgImage(url: string): Promise<{ ok: true; image: string } | { ok: false; error: string }> {
  try {
    const u = new URL(url)
    if (!/^https?:$/.test(u.protocol)) {
      return { ok: false, error: "Only http(s) URLs are supported" }
    }
    const res = await fetch(u.toString(), {
      redirect: "follow",
      headers: { "user-agent": "Mozilla/5.0 (compatible; Timbl/1.0)" },
      signal: AbortSignal.timeout(5000),
    })
    if (!res.ok) return { ok: false, error: `Upstream ${res.status}` }
    const html = await res.text()
    const match =
      html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ||
      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i)
    if (!match) return { ok: false, error: "No og:image found" }
    return { ok: true, image: new URL(match[1], u).toString() }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Fetch failed" }
  }
}
