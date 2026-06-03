import { fotMobGet } from "@/lib/fotmob/client";
import { readSupabaseCache, writeSupabaseCache } from "@/lib/supabase/rest";

const TRANSFERS_CACHE_TABLE = "transfers_cache";
const TRENDING_NEWS_KEY = "trending_news";

export interface FotMobNewsItem {
  id: string;
  imageUrl: string;
  title: string;
  gmtTime: string;
  sourceStr: string;
  sourceIconUrl?: string;
  page: {
    url: string;
  };
}

export interface CombinedTransfersPayload {
  news: FotMobNewsItem[];
  transfers: any[];
}

export async function getLiveTransferRumors(options: { force?: boolean } = {}): Promise<CombinedTransfersPayload> {
  if (!options.force) {
    try {
      const cached = await readSupabaseCache<CombinedTransfersPayload>(
        TRANSFERS_CACHE_TABLE,
        TRENDING_NEWS_KEY
      );
      if (cached && (cached.news || cached.transfers)) {
        return {
          news: cached.news || [],
          transfers: cached.transfers || []
        };
      }
    } catch (dbError) {
      console.warn("Supabase transfers cache read failed, using local/network fallback:", dbError);
    }
  }

  return refreshLiveTransferRumors();
}

export async function refreshLiveTransferRumors(): Promise<CombinedTransfersPayload> {
  let news: FotMobNewsItem[] = [];
  let transfers: any[] = [];

  // Fetch trending news and transfers in parallel
  try {
    const [newsResult, transfersResult] = await Promise.allSettled([
      fotMobGet<{ items: FotMobNewsItem[] }>("api/v1/news/trending", {}, { force: true }),
      fotMobGet<{ transfers: any[] }>("api/v1/transfers", {}, { force: true })
    ]);

    if (newsResult.status === "fulfilled") {
      news = newsResult.value.data.items || [];
    } else {
      console.warn("FotMob news fetch failed in cron/refresh:", newsResult.reason);
    }

    if (transfersResult.status === "fulfilled") {
      transfers = transfersResult.value.data.transfers || [];
    } else {
      console.warn("FotMob transfers fetch failed in cron/refresh:", transfersResult.reason);
    }
  } catch (error) {
    console.error("Error fetching FotMob data:", error);
  }

  const payload: CombinedTransfersPayload = { news, transfers };

  // Cache to Supabase
  try {
    await writeSupabaseCache(TRANSFERS_CACHE_TABLE, {
      cache_key: TRENDING_NEWS_KEY,
      payload
    });
  } catch (dbError) {
    console.warn("Supabase transfers cache write failed:", dbError);
  }

  return payload;
}
