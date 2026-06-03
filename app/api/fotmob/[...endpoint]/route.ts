import { NextRequest, NextResponse } from "next/server";
import { fotMobGet, FotMobApiError } from "@/lib/fotmob/client";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ endpoint: string[] }> }
) {
  const { endpoint: parts } = await params;
  const endpoint = parts.join("/");

  try {
    const query = Object.fromEntries(request.nextUrl.searchParams.entries());
    const result = await fotMobGet<unknown>(endpoint, query);

    return NextResponse.json(result, {
      headers: {
        "Cache-Control": `s-maxage=${result.meta.ttl}, stale-while-revalidate=86400`
      }
    });
  } catch (error) {
    const status = error instanceof FotMobApiError && error.status ? error.status : 500;
    const message = error instanceof Error ? error.message : "FotMob API istegi basarisiz.";

    return NextResponse.json(
      {
        error: message,
        endpoint
      },
      { status }
    );
  }
}
