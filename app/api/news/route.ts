import { NextResponse } from "next/server";
import { listFotMobNews } from "@/lib/news/fotmob-news";
import { listNews, refreshTwitterNews } from "@/lib/news/twitter-news";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const fotMobNews = await listFotMobNews(24);

    if (fotMobNews.length) {
      return NextResponse.json({ source: "fotmob", news: fotMobNews }, {
        headers: { "Cache-Control": "s-maxage=300, stale-while-revalidate=3600" }
      });
    }
  } catch (error) {
    console.warn("FotMob news fetch failed, falling back to cached/twitter news:", error);
  }

  const news = await listNews(24);

  if (news.length) {
    return NextResponse.json({ source: "supabase", news }, {
      headers: { "Cache-Control": "s-maxage=300, stale-while-revalidate=3600" }
    });
  }

  const refreshed = await refreshTwitterNews({ limitPerAccount: 4 });
  return NextResponse.json({ source: "twitter-api45", news: refreshed.news, errors: refreshed.errors }, {
    headers: { "Cache-Control": "s-maxage=300, stale-while-revalidate=3600" }
  });
}
