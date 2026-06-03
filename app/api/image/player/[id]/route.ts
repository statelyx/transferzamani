import { NextRequest } from "next/server";
import { sofaScoreBinary } from "@/lib/sofascore/client";

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!/^\d+$/.test(id)) {
    return new Response(null, { status: 400 });
  }

  try {
    const image = await sofaScoreBinary("players/get-image", { playerId: id });

    return new Response(image.body, {
      headers: {
        "Cache-Control": "public, max-age=86400",
        "Content-Type": image.contentType
      }
    });
  } catch {
    const source = `https://img.sofascore.com/api/v1/player/${id}/image`;
    const response = await fetch(source, {
      headers: {
        Accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
        Referer: "https://www.sofascore.com/",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125 Safari/537.36"
      },
      next: {
        revalidate: 86_400
      }
    });

    if (!response.ok) {
      return new Response(null, { status: 404 });
    }

    return new Response(await response.arrayBuffer(), {
      headers: {
        "Cache-Control": "public, max-age=86400",
        "Content-Type": response.headers.get("content-type") || "image/png"
      }
    });
  }
}
