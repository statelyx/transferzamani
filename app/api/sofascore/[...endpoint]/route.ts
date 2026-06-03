import { NextRequest, NextResponse } from "next/server";
import { isSofaScoreEndpoint, SOFASCORE_ENDPOINTS } from "@/lib/sofascore/endpoints";
import { sofaScoreGet, SofaScoreApiError } from "@/lib/sofascore/client";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ endpoint: string[] }> }
) {
  const { endpoint: parts } = await params;
  const endpoint = parts.join("/");

  if (!isSofaScoreEndpoint(endpoint)) {
    return NextResponse.json(
      {
        error: "Desteklenmeyen SofaScore endpointi.",
        endpoint
      },
      { status: 404 }
    );
  }

  const config = SOFASCORE_ENDPOINTS[endpoint];
  if ("binary" in config && config.binary) {
    return NextResponse.json(
      {
        error: "Bu endpoint binary yanit donuyor. Ilgili image route kullanilmali.",
        endpoint
      },
      { status: 415 }
    );
  }

  try {
    const query = Object.fromEntries(request.nextUrl.searchParams.entries());
    const result = await sofaScoreGet<unknown>(endpoint, query);

    return NextResponse.json(result, {
      headers: {
        "Cache-Control": `s-maxage=${result.meta.ttl}, stale-while-revalidate=86400`
      }
    });
  } catch (error) {
    const status = error instanceof SofaScoreApiError && error.status ? error.status : 500;
    const message = error instanceof Error ? error.message : "SofaScore API istegi basarisiz.";

    return NextResponse.json(
      {
        error: message,
        endpoint
      },
      { status }
    );
  }
}
