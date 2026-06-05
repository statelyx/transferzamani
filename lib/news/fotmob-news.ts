import { getLiveTransferRumors, type FotMobNewsItem } from "@/lib/football/transfers";
import type { NewsCard, NewsCategory } from "@/lib/news/twitter-news";

export async function listFotMobNews(limit = 24) {
  const payload = await getLiveTransferRumors();
  const news = (payload.news || []).map(normalizeFotMobNews).filter(Boolean) as NewsCard[];

  return news
    .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
    .slice(0, limit);
}

function normalizeFotMobNews(item: FotMobNewsItem): NewsCard | null {
  if (!item.id || !item.title) return null;

  const sourceUrl = item.page?.url?.startsWith("http")
    ? item.page.url
    : `https://www.fotmob.com${item.page?.url || ""}`;
  const publishedAt = parseFotMobDate(item.gmtTime);
  const category = categorizeFotMobTitle(item.title);

  return {
    id: `fotmob:${item.id}`,
    tweetId: item.id,
    category,
    league: inferLeague(item.title),
    title: buildTitle(item.title, category),
    summary: translateHeadline(item.title),
    sourceAccount: item.sourceStr || "FotMob",
    sourceName: item.sourceStr || "FotMob",
    sourceUrl,
    publishedAt,
    imageUrl: item.imageUrl || null
  };
}

function categorizeFotMobTitle(title: string): NewsCategory {
  const normalized = title.toLocaleLowerCase("tr");
  if (/(transfer|signing|agreement|deal|loan|contract|medical|rumour|rumor|advance|chasing)/.test(normalized)) {
    return "transfer";
  }
  if (/(ranked|stats|rating|goals|assists|xg|record)/.test(normalized)) {
    return "istatistik";
  }
  return "haber";
}

function buildTitle(title: string, category: NewsCategory) {
  const prefix = category === "transfer" ? "Transfer" : category === "istatistik" ? "Istatistik" : "Gundem";
  return `${prefix}: ${translateHeadline(title)}`.slice(0, 120);
}

function translateHeadline(title: string) {
  return title
    .replace(/transfer rumors?:?/gi, "Transfer iddiası:")
    .replace(/transfer-report/gi, "transfer raporu")
    .replace(/transfer report/gi, "transfer raporu")
    .replace(/man utd/gi, "Manchester United")
    .replace(/real madrid/gi, "Real Madrid")
    .replace(/advance on/gi, "girişimini hızlandırdı:")
    .replace(/chasing/gi, "takip ediyor:")
    .replace(/four more signings/gi, "dört yeni imza")
    .replace(/after/gi, "sonrası")
    .replace(/agreement/gi, "anlaşması")
    .replace(/ranked/gi, "sıralaması")
    .replace(/the 10 most expensive/gi, "En pahalı 10")
    .replace(/manager appointments of all time/gi, "teknik direktör hamlesi")
    .replace(/all time/gi, "tüm zamanlar")
    .replace(/signing/gi, "imza")
    .replace(/signings/gi, "imzalar")
    .replace(/contract/gi, "kontrat")
    .replace(/deal/gi, "anlaşma")
    .replace(/loan/gi, "kiralık")
    .replace(/medical/gi, "sağlık kontrolü")
    .replace(/\s+/g, " ")
    .trim();
}

function inferLeague(title: string) {
  const normalized = title.toLocaleLowerCase("tr");
  if (/galatasaray|fenerbahce|fenerbahçe|besiktas|beşiktaş|trabzonspor|super lig|süper lig/.test(normalized)) return "Super Lig";
  if (/premier league|man utd|manchester|arsenal|chelsea|liverpool|tottenham/.test(normalized)) return "Premier League";
  if (/real madrid|barcelona|atletico|laliga/.test(normalized)) return "LaLiga";
  if (/juventus|inter|milan|napoli|serie a/.test(normalized)) return "Serie A";
  return "Genel";
}

function parseFotMobDate(value?: string) {
  if (!value) return new Date().toISOString();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}
