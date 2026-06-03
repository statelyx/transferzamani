import { NextResponse } from "next/server";
import { getGalatasarayPayload } from "@/lib/sofasport";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const payload = await getGalatasarayPayload();

    return NextResponse.json(payload, {
      headers: {
        "Cache-Control": "s-maxage=1800, stale-while-revalidate=86400"
      }
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Galatasaray verisi alınamadı.";

    return NextResponse.json(
      {
        error: message
      },
      {
        status: 500
      }
    );
  }
}
