import { NextResponse } from "next/server";
import { freeLiveFootballGet } from "@/lib/providers/free-live-football";
import { footballServiceGet } from "@/lib/providers/footballservice";
import { getFotMobLeagueTeams } from "@/lib/fotmob/league-teams";
import { sofaScoreGet } from "@/lib/sofascore/client";

export const dynamic = "force-dynamic";

type ProviderHealth = {
  ok: boolean;
  status: "ok" | "limited" | "error";
  source?: string;
  message?: string;
};

export async function GET() {
  const [freeLiveFootball, fotmob, footballservice, sofascore] = await Promise.all([
    checkProvider("free-live-football", async () => {
      const result = await freeLiveFootballGet<unknown>("popular-leagues", {}, { force: true });
      return { source: result.source };
    }),
    checkProvider("fotmob", async () => {
      const teams = await getFotMobLeagueTeams("super-lig");
      return { source: "fotmob", count: teams.length };
    }),
    checkProvider("footballservice", async () => {
      const result = await footballServiceGet<unknown>("search", { q: "galatasaray" }, { force: true });
      return { source: result.source };
    }),
    checkProvider("sofascore", async () => {
      const result = await sofaScoreGet<unknown>("search", { q: "Galatasaray" }, { ttl: 60, force: true });
      return { source: result.meta.cache };
    })
  ]);

  return NextResponse.json({
    checkedAt: new Date().toISOString(),
    priority: ["free-live-football", "fotmob", "footballservice", "sofascore"],
    providers: {
      freeLiveFootball,
      fotmob,
      footballservice,
      sofascore
    }
  });
}

async function checkProvider(
  name: string,
  run: () => Promise<{ source?: string; count?: number }>
): Promise<ProviderHealth> {
  try {
    const result = await run();
    return {
      ok: true,
      status: "ok",
      source: result.source,
      message: typeof result.count === "number" ? `${result.count} kayit okundu.` : `${name} aktif.`
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : `${name} saglik testi basarisiz.`;
    return {
      ok: false,
      status: /429|quota|limit/i.test(message) ? "limited" : "error",
      message
    };
  }
}
