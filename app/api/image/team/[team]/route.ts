import { NextRequest } from "next/server";
import { resolveFotMobTeamFromLeague } from "@/lib/fotmob/league-teams";
import { resolveFotMobTeamId } from "@/lib/fotmob/team-squad";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ team: string }> }
) {
  const { team } = await params;
  const teamName = decodeURIComponent(team || "").trim();
  const league = request.nextUrl.searchParams.get("league") || "global";

  if (!teamName) {
    return new Response(null, { status: 400 });
  }

  const resolved = await resolveFotMobTeamFromLeague(teamName, league).catch(() => null);
  const teamId = resolved?.id || resolveFotMobTeamId(teamName);

  if (!teamId) {
    return new Response(null, { status: 404 });
  }

  const response = await fetch(`https://images.fotmob.com/image_resources/logo/teamlogo/${teamId}.png`, {
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
