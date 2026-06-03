import { NextRequest, NextResponse } from "next/server";
import { footballServiceGet, isFootballServiceEndpoint } from "@/lib/providers/footballservice";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ endpoint: string }> }
) {
  const { endpoint } = await params;

  if (!isFootballServiceEndpoint(endpoint)) {
    return NextResponse.json({ error: "Desteklenmeyen FootballService endpointi.", endpoint }, { status: 404 });
  }

  try {
    const query = Object.fromEntries(request.nextUrl.searchParams.entries());
    const result = await footballServiceGet(endpoint, query);
    return NextResponse.json(result, {
      headers: { "Cache-Control": "s-maxage=300, stale-while-revalidate=86400" }
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "FootballService istegi basarisiz.", endpoint },
      { status: 500 }
    );
  }
}
