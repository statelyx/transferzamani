import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!/^\d+$/.test(id)) {
    return new Response(null, { status: 400 });
  }

  const response = await fetch(`https://images.fotmob.com/image_resources/playerimages/${id}.png`, {
    headers: {
      Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
      Referer: "https://www.fotmob.com/"
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
