import { NextResponse } from "next/server";
import { listNews, refreshTwitterNews } from "@/lib/news/twitter-news";

export const dynamic = "force-dynamic";

export async function GET() {
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
