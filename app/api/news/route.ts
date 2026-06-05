import { NextResponse } from "next/server";
import { listFotMobNews } from "@/lib/news/fotmob-news";
import { listSiteNews } from "@/lib/news/site-news";
import { listNews, refreshTwitterNews, TURKISH_NEWS_ACCOUNTS } from "@/lib/news/twitter-news";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const refreshed = await refreshTwitterNews({ accounts: TURKISH_NEWS_ACCOUNTS, limitPerAccount: 3 });

    if (refreshed.news.length) {
      return NextResponse.json({ source: "twitter-api45", news: refreshed.news, errors: refreshed.errors }, {
        headers: { "Cache-Control": "s-maxage=300, stale-while-revalidate=3600" }
      });
    }
  } catch (error) {
    console.warn("Twitter news refresh failed, falling back to cached/site news:", error);
  }

  try {
    const siteNews = await listSiteNews(24);

    if (siteNews.length) {
      return NextResponse.json({ source: "turkish-site-rss", news: siteNews }, {
        headers: { "Cache-Control": "s-maxage=300, stale-while-revalidate=3600" }
      });
    }
  } catch (error) {
    console.warn("Turkish site news fetch failed, falling back to FotMob news:", error);
  }

  const cachedTwitterNews = await listNews(24);

  if (cachedTwitterNews.length) {
    const turkishCachedNews = cachedTwitterNews.filter((item) => TURKISH_NEWS_ACCOUNTS.includes(item.sourceAccount));

    if (turkishCachedNews.length) {
      return NextResponse.json({ source: "twitter-cache", news: turkishCachedNews }, {
        headers: { "Cache-Control": "s-maxage=300, stale-while-revalidate=3600" }
      });
    }
  }

  try {
    const fotMobNews = await listFotMobNews(24);

    if (fotMobNews.length) {
      return NextResponse.json({ source: "fotmob", news: fotMobNews }, {
        headers: { "Cache-Control": "s-maxage=300, stale-while-revalidate=3600" }
      });
    }
  } catch (error) {
    console.warn("FotMob news fetch failed:", error);
  }

  return NextResponse.json({ source: "empty", news: [] }, {
    headers: { "Cache-Control": "s-maxage=300, stale-while-revalidate=3600" }
  });
}
