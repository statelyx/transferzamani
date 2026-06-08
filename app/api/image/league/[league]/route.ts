import { NextRequest } from "next/server";
import { FOTMOB_LEAGUE_IDS } from "@/lib/fotmob/league-teams";

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ league: string }> }
) {
  const { league } = await params;
  const leagueId = FOTMOB_LEAGUE_IDS[decodeURIComponent(league || "")];

  if (!leagueId) {
    return new Response(null, { status: 404 });
  }

  const response = await fetch(`https://images.fotmob.com/image_resources/logo/leaguelogo/${leagueId}.png`, {
    next: {
      revalidate: 86_400
    }
  });

  if (!response.ok) {
    return new Response(null, { status: response.status });
  }

  return new Response(await response.arrayBuffer(), {
    headers: {
      "Cache-Control": "public, max-age=86400",
      "Content-Type": response.headers.get("content-type") || "image/png"
    }
  });
}
