import { NextRequest, NextResponse } from "next/server";
import { isTwitterApiEndpoint, twitterApiGet } from "@/lib/providers/twitter-api";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ endpoint: string }> }
) {
  const { endpoint } = await params;

  if (!isTwitterApiEndpoint(endpoint)) {
    return NextResponse.json({ error: "Desteklenmeyen Twitter API endpointi.", endpoint }, { status: 404 });
  }

  try {
    const query = Object.fromEntries(request.nextUrl.searchParams.entries());
    const result = await twitterApiGet(endpoint, query);
    return NextResponse.json(result, {
      headers: { "Cache-Control": "s-maxage=300, stale-while-revalidate=3600" }
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Twitter API istegi basarisiz.", endpoint },
      { status: 500 }
    );
  }
}
