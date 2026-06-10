import { NextResponse } from "next/server";
import { getLiveFixtures } from "@/lib/football/live-fixtures";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const fixtures = await getLiveFixtures();
    return NextResponse.json(
      { fixtures, source: "free-football-api-data" },
      { headers: { "Cache-Control": "s-maxage=30, stale-while-revalidate=120" } }
    );
  } catch (error) {
    return NextResponse.json(
      {
        fixtures: [],
        source: "free-football-api-data",
        error: error instanceof Error ? error.message : "Canli fikstur alinamadi."
      },
      { status: 502, headers: { "Cache-Control": "s-maxage=30, stale-while-revalidate=120" } }
    );
  }
}
