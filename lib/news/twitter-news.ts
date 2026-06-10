import { twitterApiGet } from "@/lib/providers/twitter-api";
import { twitterFreeApiGet } from "@/lib/providers/twitter-free-api";
import { listSupabaseRows, writeSupabaseCache } from "@/lib/supabase/rest";

export type NewsCategory = "transfer" | "istatistik" | "haber";

export type NewsCard = {
  id: string;
  tweetId: string;
  category: NewsCategory;
  league: string;
  title: string;
  summary: string;
  sourceAccount: string;
  sourceName: string;
  sourceUrl: string;
  publishedAt: string;
  imageUrl: string | null;
};

type TimelineResponse = {
  timeline?: RawTweet[];
  pinned?: RawTweet;
};

type RawTweet = {
  tweet_id?: string;
  id_str?: string;
  screen_name?: string;
  name?: string;
  created_at?: string;
  text?: string;
  full_text?: string;
  media_url?: string;
  profile_image_url_https?: string;
  profile_image_url?: string;
  user?: {
    profile_image_url_https?: string;
    profile_image_url?: string;
  };
  media?: Array<{ media_url_https?: string; media_url?: string; url?: string }>;
  entities?: {
    media?: Array<{ media_url_https?: string; media_url?: string; url?: string }>;
  };
};

const TRACKED_ACCOUNTS = [
  "FabrizioRomano",
  "_samiyenhaber",
  "ertansuzgun",
  "xco1905",
  "altunterimos1",
  "AliNaciKucuk",
  "yagosabuncuoglu",
  "NicoSchira",
  "SuleymanRodop",
  "saruh5n",
  "emreekaaplan",
  "OptaCan"
];

export const TURKISH_NEWS_ACCOUNTS = [
  "_samiyenhaber",
  "ertansuzgun",
  "xco1905",
  "altunterimos1",
  "AliNaciKucuk",
  "yagosabuncuoglu",
  "SuleymanRodop",
  "saruh5n",
  "emreekaaplan",
  "OptaCan"
];

export async function listNews(limit = 24) {
  const rows = await listSupabaseRows<{ payload: NewsCard }>(
    "news_cache",
    "payload,published_at,updated_at",
    "published_at.desc",
    limit
  );

  return rows.map((row) => row.payload).filter(Boolean);
}

export async function refreshTwitterNews(options: { accounts?: string[]; limitPerAccount?: number; force?: boolean } = {}) {
  const accounts = options.accounts || TRACKED_ACCOUNTS;
  const limitPerAccount = options.limitPerAccount || 12;
  const news: NewsCard[] = [];
  const errors: Array<{ account: string; error: string }> = [];

  for (const account of accounts) {
    try {
      // 1. sira: ucretsiz (free) Twitter API
      const freeTweets = await fetchFreeApiTweets(account, limitPerAccount, options.force ?? false);

      if (freeTweets.length) {
        for (const tweet of freeTweets.slice(0, limitPerAccount)) {
          const card = normalizeTweet(tweet, account);
          if (!card) continue;
          news.push(card);
          await writeNewsCard(card);
        }
        continue;
      }

      // 2. sira: twitter-api45 (eski ucretli saglayici)
      const result = await twitterApiGet<TimelineResponse>(
        "timeline",
        { screenname: account, count: limitPerAccount },
        { force: options.force ?? false }
      );
      const tweets = [...(result.data.pinned ? [result.data.pinned] : []), ...(result.data.timeline || [])];

      for (const tweet of tweets.slice(0, limitPerAccount)) {
        const card = normalizeTweet(tweet, account);
        if (!card) continue;
        news.push(card);
        await writeNewsCard(card);
      }
    } catch (error) {
      errors.push({
        account,
        error: error instanceof Error ? error.message : "Twitter timeline alinamadi."
      });
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    accounts: accounts.length,
    insertedOrUpdated: news.length,
    errors,
    news
  };
}

// Ucretsiz Twitter/X free API'sinden hesap bazli tweet cekme.
// Free API farkli alan adlari donebildigi icin tolerant olarak normalize edilir.
async function fetchFreeApiTweets(account: string, count: number, force: boolean): Promise<RawTweet[]> {
  try {
    const filters = JSON.stringify({
      lang: "tr",
      fromTheseAccounts: [account],
      removeReplies: true
    });

    const result = await twitterFreeApiGet<unknown>(
      "search",
      {
        includeTimestamp: true,
        count,
        category: "Latest",
        filters
      },
      { force }
    );

    return mapFreeApiTweets(result.data, account);
  } catch {
    return [];
  }
}

function mapFreeApiTweets(data: unknown, account: string): RawTweet[] {
  const list = extractTweetArray(data);

  return list
    .map((entry) => mapFreeApiTweet(entry, account))
    .filter((tweet): tweet is RawTweet => Boolean(tweet));
}

function extractTweetArray(data: unknown): Record<string, unknown>[] {
  if (Array.isArray(data)) return data as Record<string, unknown>[];
  if (!data || typeof data !== "object") return [];

  const record = data as Record<string, unknown>;
  const candidates = [record.tweets, record.results, record.data, record.timeline, record.statuses];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate as Record<string, unknown>[];
  }

  return [];
}

function mapFreeApiTweet(entry: Record<string, unknown>, account: string): RawTweet | null {
  if (!entry || typeof entry !== "object") return null;

  const tweetId = String(
    entry.tweet_id || entry.id_str || entry.id || entry.tweetId || entry.rest_id || ""
  );
  const text = String(entry.full_text || entry.text || entry.content || entry.tweet || "");
  if (!tweetId || !text) return null;

  const user = (entry.user || entry.author || {}) as Record<string, unknown>;
  const media = extractMediaUrl(entry);

  return {
    tweet_id: tweetId,
    id_str: tweetId,
    screen_name: String(entry.screen_name || user.screen_name || user.username || account),
    name: String(entry.name || user.name || account),
    created_at: String(entry.created_at || entry.createdAt || entry.timestamp || ""),
    full_text: text,
    media_url: media || undefined,
    profile_image_url_https: String(
      user.profile_image_url_https || user.profile_image_url || entry.profile_image_url || ""
    ) || undefined
  };
}

function extractMediaUrl(entry: Record<string, unknown>): string | null {
  const media = (entry.media || entry.medias || entry.photos) as unknown;
  if (Array.isArray(media) && media.length) {
    const first = media[0] as Record<string, unknown>;
    return String(first.media_url_https || first.media_url || first.url || first.src || "") || null;
  }
  if (typeof entry.media_url === "string") return entry.media_url;
  if (typeof entry.image === "string") return entry.image;
  return null;
}

async function writeNewsCard(card: NewsCard) {
  await writeSupabaseCache("news_cache", {
    cache_key: card.id,
    tweet_id: card.tweetId,
    category: card.category,
    league_name: card.league,
    source_account: card.sourceAccount,
    source_url: card.sourceUrl,
    published_at: card.publishedAt,
    payload: card,
    source: "twitter-api45"
  });
}

function normalizeTweet(tweet: RawTweet, fallbackAccount: string): NewsCard | null {
  const tweetId = tweet.tweet_id || tweet.id_str;
  const rawText = cleanTweetText(tweet.full_text || tweet.text || "");
  if (!tweetId || !rawText) return null;

  const sourceAccount = tweet.screen_name || fallbackAccount;
  const category = categorizeTweet(rawText, sourceAccount);
  const league = inferLeague(rawText);
  const title = buildTurkishTitle(rawText, category);
  const publishedAt = parseTwitterDate(tweet.created_at);

  return {
    id: `twitter:${tweetId}`,
    tweetId,
    category,
    league,
    title,
    summary: translateFootballText(rawText).slice(0, 280),
    sourceAccount,
    sourceName: tweet.name || sourceAccount,
    sourceUrl: `https://x.com/${sourceAccount}/status/${tweetId}`,
    publishedAt,
    imageUrl: firstImage(tweet)
  };
}

function categorizeTweet(text: string, account: string): NewsCategory {
  const normalized = text.toLocaleLowerCase("tr");
  if (account.toLocaleLowerCase("tr") === "optacan") return "istatistik";
  if (/(transfer|imza|anlaştı|anlasma|agreement|deal|here we go|medical|bonservis|kiralık|loan|contract|sözleşme)/i.test(normalized)) {
    return "transfer";
  }
  return "haber";
}

function inferLeague(text: string) {
  const normalized = text.toLocaleLowerCase("tr");
  if (/galatasaray|fenerbahçe|fenerbahce|beşiktaş|besiktas|trabzonspor|süper lig|super lig/.test(normalized)) return "Super Lig";
  if (/premier league|arsenal|chelsea|liverpool|manchester/.test(normalized)) return "Premier League";
  if (/serie a|milan|juventus|inter|napoli/.test(normalized)) return "Serie A";
  if (/laliga|barcelona|real madrid|atletico/.test(normalized)) return "LaLiga";
  return "Genel";
}

function buildTurkishTitle(text: string, category: NewsCategory) {
  const translated = translateFootballText(text);
  const firstSentence = translated.split(/[.!?]\s/)[0] || translated;
  const prefix = category === "transfer" ? "Transfer" : category === "istatistik" ? "İstatistik" : "Gündem";
  return `${prefix}: ${firstSentence.slice(0, 96)}`;
}

function translateFootballText(text: string) {
  return text
    .replace(/Here we go/gi, "Anlasma tamam")
    .replace(/exclusive/gi, "Ozel haber")
    .replace(/deal agreed/gi, "Anlasma saglandi")
    .replace(/medical tests/gi, "saglik kontrolleri")
    .replace(/loan deal/gi, "kiralik transfer")
    .replace(/permanent deal/gi, "bonservisli transfer")
    .replace(/contract until/gi, "sozlesme su tarihe kadar")
    .replace(/understand/gi, "edinilen bilgiye gore")
    .replace(/official/gi, "resmi")
    .replace(/breaking/gi, "son dakika");
}

function cleanTweetText(text: string) {
  return text.replace(/\s+/g, " ").trim();
}

function parseTwitterDate(value?: string) {
  if (!value) return new Date().toISOString();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

function firstImage(tweet: RawTweet) {
  return (
    tweet.media_url ||
    tweet.media?.[0]?.media_url_https ||
    tweet.media?.[0]?.media_url ||
    tweet.entities?.media?.[0]?.media_url_https ||
    tweet.entities?.media?.[0]?.media_url ||
    null
  );
}
