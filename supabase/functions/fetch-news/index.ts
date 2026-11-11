// Collects engineering news for the NUESA blog.
//
// Runs on a schedule (pg_cron) and is also nudged by blog visitors. For each
// enabled row in blog_feeds it either runs a news search (Bing News, with
// Google News as a backup) or reads a site's own RSS feed (NSE, COREN, major
// Nigerian papers, keeping only engineering stories). It stores the headline,
// source, date, link and the feed's short teaser; readers open the full story
// at its source. Runs at most every 30 minutes unless an admin forces it.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const MIN_GAP_MS = 30 * 60 * 1000;
const MAX_AGE_DAYS = 60;
const PER_FEED = 20;

const decode = (s: string) =>
  s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
const strip = (s: string) => decode(s).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
const tag = (xml: string, name: string) => {
  const m = xml.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, "i"));
  return m ? m[1] : "";
};
const titleKey = (t: string) => t.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().slice(0, 90);

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const db = createClient(supabaseUrl, serviceKey);

  try {
    // Admins can force a refresh from the Blog manager
    let force = false;
    const auth = req.headers.get("Authorization");
    if (auth?.startsWith("Bearer ") && !auth.includes(anonKey)) {
      const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: auth } } });
      const { data } = await userClient.auth.getUser();
      if (data.user) {
        const { data: p } = await db.from("profiles").select("role, status").eq("id", data.user.id).single();
        force = p?.role === "admin" && p?.status === "approved";
      }
    }

    const { data: state } = await db.from("blog_state").select("*").eq("id", true).single();
    if (!force && state?.last_fetch_at && Date.now() - new Date(state.last_fetch_at).getTime() < MIN_GAP_MS) {
      return json({ skipped: "recent", last_fetch_at: state.last_fetch_at });
    }
    // Claim this run first so simultaneous visitors don't all fetch
    await db.from("blog_state").update({ last_fetch_at: new Date().toISOString() }).eq("id", true);

    const { data: feeds } = await db.from("blog_feeds").select("*").eq("enabled", true);
    const cutoff = Date.now() - MAX_AGE_DAYS * 86400000;
    const rows: Record<string, unknown>[] = [];
    const errors: string[] = [];

    // Engineering stories only, for general news feeds
    const ENG = /\b(engineer(s|ing)?|NSE|COREN|NUESA|University of Abuja|UniAbuja)\b/i;
    const classify = (text: string, fallback: string) =>
      /\bNUESA\b|engineering students/i.test(text) ? "nuesa"
      : /\bCOREN\b/i.test(text) ? "coren"
      : /\bNSE\b|Nigerian Society of Engineers/i.test(text) ? "nse"
      : /University of Abuja|UniAbuja/i.test(text) ? "uniabuja"
      : fallback;
    const realLink = (l: string) => {
      // Bing wraps links: ...apiclick.aspx?...&url=https%3a%2f%2f...
      const m = l.match(/[?&]url=([^&]+)/i);
      if (m && /bing\.com/i.test(l)) { try { return decodeURIComponent(m[1]); } catch { return l; } }
      return l;
    };
    const host = (u: string) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return null; } };

    const getXml = async (url: string) => {
      const res = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; NUESAPortalNews/1.0; +https://www.nuesa.org)",
          "Accept": "application/rss+xml, application/xml, text/xml, */*",
        },
        signal: AbortSignal.timeout(12000),
      });
      if (!res.ok) throw new Error(String(res.status));
      return await res.text();
    };

    const results = await Promise.allSettled((feeds || []).map(async (feed) => {
      let xml = "";
      let via = "";
      if (feed.kind === "rss") {
        xml = await getXml(feed.query);
        via = "rss";
      } else {
        try {
          xml = await getXml(`https://www.bing.com/news/search?q=${encodeURIComponent(feed.query)}&format=rss&setlang=en-GB&cc=NG`);
          via = "bing";
        } catch {
          xml = await getXml(`https://news.google.com/rss/search?q=${encodeURIComponent(feed.query)}&hl=en-NG&gl=NG&ceid=NG:en`);
          via = "google";
        }
      }
      const out: Record<string, unknown>[] = [];
      const items = xml.split(/<item[\s>]/i).slice(1).slice(0, feed.kind === "rss" ? 40 : PER_FEED);
      for (const raw of items) {
        const item = raw.split(/<\/item>/i)[0];
        let sourceName = strip(tag(item, "source")) || strip(tag(item, "News:Source"));
        let sourceUrl = (item.match(/<source[^>]*url="([^"]+)"/i) || [])[1] || null;
        let title = strip(tag(item, "title"));
        if (sourceName && title.endsWith(` - ${sourceName}`)) title = title.slice(0, -(sourceName.length + 3));
        const link = realLink(strip(tag(item, "link")) || strip(tag(item, "guid")));
        const pub = new Date(strip(tag(item, "pubDate")) || strip(tag(item, "dc:date")));
        if (!title || !/^https?:/i.test(link) || isNaN(pub.getTime()) || pub.getTime() < cutoff) continue;
        let summary = strip(tag(item, "description"));
        if (summary.startsWith(title) || summary.length < 40) summary = "";
        summary = summary.replace(/\s*(The post .*appeared first on.*|Read more.*|\[…\]|\[&#8230;\]|…)$/i, "").trim();
        const text = `${title} ${summary}`;
        if (feed.keyword_filter && !ENG.test(text)) continue;
        if (feed.kind === "rss") { sourceName = feed.name; sourceUrl = sourceUrl || `https://${host(feed.query)}`; }
        if (!sourceName) sourceName = host(link) || "";
        out.push({
          title: title.slice(0, 300),
          link,
          title_key: titleKey(title),
          source: sourceName || null,
          source_url: sourceUrl || (host(link) ? `https://${host(link)}` : null),
          summary: summary ? (summary.length > 220 ? summary.slice(0, 217).replace(/\s+\S*$/, "") + "…" : summary) : null,
          category: feed.kind === "rss" && feed.keyword_filter ? classify(text, feed.category) : feed.category,
          feed_id: feed.id,
          published_at: pub.toISOString(),
        });
      }
      return { feed: feed.name, via, rows: out };
    }));

    results.forEach((r, i) => {
      if (r.status === "fulfilled") rows.push(...r.value.rows);
      else errors.push(`${(feeds || [])[i]?.name}: ${(r.reason as Error)?.message || r.reason}`);
    });

    // Same story from two searches: keep the first
    const seen = new Set<string>();
    const unique = rows.filter((r) => {
      const k = r.title_key as string;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });

    let added = 0;
    if (unique.length) {
      // Stories already stored (by headline) in the last few months
      const { data: existing } = await db
        .from("blog_news")
        .select("title_key")
        .gte("published_at", new Date(cutoff - 30 * 86400000).toISOString());
      const haveKey = new Set((existing || []).map((e) => e.title_key));
      const fresh = unique.filter((r) => !haveKey.has(r.title_key));
      if (fresh.length) {
        const { data: inserted, error } = await db
          .from("blog_news")
          .upsert(fresh, { onConflict: "link", ignoreDuplicates: true })
          .select("id");
        if (error) errors.push(`insert: ${error.message}`);
        else added = inserted?.length ?? 0;
      }
    }

    // Keep the table tidy
    await db.from("blog_news").delete().lt("published_at", new Date(Date.now() - 180 * 86400000).toISOString());

    await db.from("blog_state").update({
      last_fetch_at: new Date().toISOString(),
      last_fetch_added: added,
      last_fetch_error: errors.length ? errors.join("; ").slice(0, 500) : null,
    }).eq("id", true);

    return json({ added, checked: unique.length, errors });
  } catch (error) {
    console.error("fetch-news failed:", error);
    await db.from("blog_state").update({ last_fetch_error: String((error as Error).message).slice(0, 500) }).eq("id", true);
    return json({ error: "Internal server error" }, 500);
  }
});
