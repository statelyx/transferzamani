import { NextResponse } from "next/server";
import { listFotMobNews } from "@/lib/news/fotmob-news";
import { listSiteNews } from "@/lib/news/site-news";
import type { NewsCard } from "@/lib/news/twitter-news";
import { listNews, refreshTwitterNews } from "@/lib/news/twitter-news";

export const dynamic = "force-dynamic";

export async function GET() {
  const collected: NewsCard[] = [];
  const errors: Array<{ source: string; error: string }> = [];

  try {
    const refreshed = await refreshTwitterNews({ limitPerAccount: 2 });
    collected.push(...refreshed.news);
    errors.push(...refreshed.errors.map((item) => ({ source: `twitter:${item.account}`, error: item.error })));
  } catch (error) {
    console.warn("Twitter news refresh failed, falling back to cached/site news:", error);
    errors.push({ source: "twitter", error: error instanceof Error ? error.message : "Twitter news refresh failed." });
  }

  try {
    const siteNews = await listSiteNews(36);
    collected.push(...siteNews);
  } catch (error) {
    console.warn("Turkish site news fetch failed, falling back to FotMob news:", error);
    errors.push({ source: "site-rss", error: error instanceof Error ? error.message : "Site news fetch failed." });
  }

  try {
    const cachedTwitterNews = await listNews(36);
    collected.push(...cachedTwitterNews);
  } catch (error) {
    console.warn("Cached news fetch failed:", error);
    errors.push({ source: "twitter-cache", error: error instanceof Error ? error.message : "Cached news fetch failed." });
  }

  try {
    const fotMobNews = await listFotMobNews(36);
    collected.push(...fotMobNews);
  } catch (error) {
    console.warn("FotMob news fetch failed:", error);
    errors.push({ source: "fotmob", error: error instanceof Error ? error.message : "FotMob news fetch failed." });
  }

  const news = balanceSources(dedupeNews(collected), 1).slice(0, 36);

  return NextResponse.json({ source: news.length ? "mixed-football-news" : "empty", news, errors }, {
    headers: { "Cache-Control": "s-maxage=300, stale-while-revalidate=3600" }
  });
}

function dedupeNews(items: NewsCard[]) {
  const seen = new Set<string>();

  return items
    .filter((item) => {
      const key = normalizeKey(`${item.title}:${item.sourceUrl}`);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
}

function normalizeKey(value: string) {
  return value.toLocaleLowerCase("tr").replace(/\s+/g, " ").trim();
}

function balanceSources(items: NewsCard[], maxPerSourceRound: number) {
  const buckets = new Map<string, NewsCard[]>();

  for (const item of items) {
    const source = normalizeKey(item.sourceAccount || item.sourceName || "unknown");
    buckets.set(source, [...(buckets.get(source) || []), item]);
  }

  const sources = Array.from(buckets.keys());
  const balanced: NewsCard[] = [];
  let index = 0;

  while (balanced.length < items.length && sources.length) {
    const source = sources[index % sources.length];
    const bucket = buckets.get(source) || [];
    const chunk = bucket.splice(0, maxPerSourceRound);
    balanced.push(...chunk);

    if (!bucket.length) {
      buckets.delete(source);
      sources.splice(index % sources.length, 1);
      index = 0;
    } else {
      buckets.set(source, bucket);
      index += 1;
    }
  }

  return balanced;
}
