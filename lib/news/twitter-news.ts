import { twitterApiGet } from "@/lib/providers/twitter-api";
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
    imageUrl: firstImage(tweet, sourceAccount)
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

function firstImage(tweet: RawTweet, sourceAccount: string) {
  return (
    tweet.media_url ||
    tweet.media?.[0]?.media_url_https ||
    tweet.media?.[0]?.media_url ||
    tweet.entities?.media?.[0]?.media_url_https ||
    tweet.entities?.media?.[0]?.media_url ||
    tweet.user?.profile_image_url_https ||
    tweet.user?.profile_image_url ||
    tweet.profile_image_url_https ||
    tweet.profile_image_url ||
    `https://unavatar.io/x/${sourceAccount}`
  );
}
