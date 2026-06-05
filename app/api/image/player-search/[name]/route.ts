import { NextRequest } from "next/server";
import { freeLiveFootballSearchPlayers } from "@/lib/providers/free-live-football";

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  const { name } = await params;
  const query = decodeURIComponent(name || "").trim();

  if (query.length < 2) {
    return new Response(null, { status: 400 });
  }

  try {
    const search = await freeLiveFootballSearchPlayers(query);
    const normalizedQuery = normalize(query);
    const player = search.suggestions
      .filter((item) => item.type === "player" && item.id && item.name && !item.isCoach)
      .sort((a, b) => {
        const aExact = normalize(a.name || "") === normalizedQuery ? 1 : 0;
        const bExact = normalize(b.name || "") === normalizedQuery ? 1 : 0;
        if (aExact !== bExact) return bExact - aExact;
        return Number(b.score || 0) - Number(a.score || 0);
      })[0];

    if (!player?.id) {
      return new Response(null, { status: 404 });
    }

    const source = `https://images.fotmob.com/image_resources/playerimages/${player.id}.png`;
    const response = await fetch(source, {
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
  } catch {
    return new Response(null, { status: 404 });
  }
}

function normalize(value: string) {
  return value
    .toLocaleLowerCase("tr")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}
