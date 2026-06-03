import { NextRequest, NextResponse } from "next/server";
import { refreshTwitterNews } from "@/lib/news/twitter-news";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");

  if (secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized cron request." }, { status: 401 });
  }

  const result = await refreshTwitterNews({ limitPerAccount: 8 });
  return NextResponse.json(result);
}
