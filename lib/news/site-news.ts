import type { NewsCard, NewsCategory } from "@/lib/news/twitter-news";

type SiteSource = {
  id: string;
  name: string;
  url: string;
  baseUrl: string;
};

const SITE_SOURCES: SiteSource[] = [
  {
    id: "fotomac-futbol",
    name: "Fotomac",
    url: "https://www.fotomac.com.tr/rss/futbol.xml",
    baseUrl: "https://www.fotomac.com.tr"
  },
  {
    id: "fotomac-gundem",
    name: "Fotomac",
    url: "https://www.fotomac.com.tr/rss/anasayfa.xml",
    baseUrl: "https://www.fotomac.com.tr"
  },
  {
    id: "hurriyet-spor",
    name: "Hurriyet Spor",
    url: "https://www.hurriyet.com.tr/rss/spor",
    baseUrl: "https://www.hurriyet.com.tr"
  },
  {
    id: "sabah-spor",
    name: "Sabah Spor",
    url: "https://www.sabah.com.tr/rss/spor.xml",
    baseUrl: "https://www.sabah.com.tr"
  }
];

export async function listSiteNews(limit = 24) {
  const results = await Promise.allSettled(SITE_SOURCES.map((source) => fetchSiteSource(source)));
  const news = results.flatMap((result) => result.status === "fulfilled" ? result.value : []);
  const seen = new Set<string>();

  return news
    .filter((item) => {
      const key = `${item.title.toLocaleLowerCase("tr")}:${item.sourceUrl}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
    .slice(0, limit);
}

async function fetchSiteSource(source: SiteSource): Promise<NewsCard[]> {
  const response = await fetch(source.url, {
    headers: {
      "Accept": "application/rss+xml, application/xml, text/xml",
      "User-Agent": "TransferZamani/1.0 Turkish football news reader"
    },
    cache: "no-store",
    signal: AbortSignal.timeout(8000)
  });

  if (!response.ok) return [];

  const xml = await response.text();
  if (!xml.trim()) return [];

  return parseItems(xml)
    .map((item) => normalizeSiteItem(item, source))
    .filter(Boolean) as NewsCard[];
}

function parseItems(xml: string) {
  const blocks = xml.match(/<item[\s\S]*?<\/item>/gi) || [];

  return blocks.map((block) => ({
    title: readTag(block, "title"),
    link: readTag(block, "link") || readTag(block, "guid"),
    description: readTag(block, "description") || readTag(block, "content:encoded"),
    pubDate: readTag(block, "pubDate"),
    imageUrl:
      readAttr(block, "enclosure", "url") ||
      readAttr(block, "media:content", "url") ||
      readAttr(block, "media:thumbnail", "url") ||
      extractImageFromHtml(readTag(block, "description") || readTag(block, "content:encoded"))
  }));
}

function normalizeSiteItem(
  item: ReturnType<typeof parseItems>[number],
  source: SiteSource
): NewsCard | null {
  const title = decodeText(item.title);
  const link = toAbsoluteUrl(decodeText(item.link), source.baseUrl);
  const summary = decodeText(item.description).slice(0, 280);

  if (!title || !link) return null;

  const published = new Date(decodeText(item.pubDate));
  const publishedAt = Number.isNaN(published.getTime()) ? new Date().toISOString() : published.toISOString();
  const imageUrl = item.imageUrl ? toAbsoluteUrl(decodeText(item.imageUrl), source.baseUrl) : null;
  const category = categorizeSiteNews(`${title} ${summary}`);

  return {
    id: `site:${source.id}:${hashText(link || title)}`,
    tweetId: `site:${hashText(link || title)}`,
    category,
    league: inferLeague(`${title} ${summary}`),
    title: buildTitle(title, category),
    summary,
    sourceAccount: source.name,
    sourceName: source.name,
    sourceUrl: link,
    publishedAt,
    imageUrl
  };
}

function readTag(block: string, tag: string) {
  const escaped = escapeRegExp(tag);
  const match = block.match(new RegExp(`<${escaped}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${escaped}>`, "i"));
  return match?.[1] || "";
}

function readAttr(block: string, tag: string, attr: string) {
  const escapedTag = escapeRegExp(tag);
  const escapedAttr = escapeRegExp(attr);
  const match = block.match(new RegExp(`<${escapedTag}[^>]*\\s${escapedAttr}=["']([^"']+)["'][^>]*>`, "i"));
  return match?.[1] || "";
}

function extractImageFromHtml(html: string) {
  const match = html.match(/<img[^>]+src=["']([^"']+)["']/i);
  return match?.[1] || "";
}

function decodeText(value: string) {
  return stripCdata(value)
    .replace(/<[^>]+>/g, " ")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([a-f0-9]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)))
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&apos;|&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function stripCdata(value: string) {
  return value.replace(/^<!\[CDATA\[/, "").replace(/\]\]>$/, "");
}

function toAbsoluteUrl(value: string, baseUrl: string) {
  if (!value) return "";
  try {
    return new URL(value, baseUrl).toString();
  } catch {
    return value;
  }
}

function categorizeSiteNews(text: string): NewsCategory {
  const normalized = text.toLocaleLowerCase("tr");
  if (/(transfer|imza|anlaş|bonservis|kiralık|sözleşme|görüşme|teklif)/i.test(normalized)) return "transfer";
  if (/(istatistik|rekor|oran|veri|xg|asist|gol kral)/i.test(normalized)) return "istatistik";
  return "haber";
}

function inferLeague(text: string) {
  const normalized = text.toLocaleLowerCase("tr");
  if (/(galatasaray|fenerbahçe|fenerbahce|beşiktaş|besiktas|trabzonspor|süper lig|super lig|başakşehir|basaksehir)/.test(normalized)) {
    return "Super Lig";
  }
  if (/(premier league|arsenal|chelsea|liverpool|manchester)/.test(normalized)) return "Premier League";
  if (/(serie a|milan|juventus|inter|napoli)/.test(normalized)) return "Serie A";
  if (/(laliga|barcelona|real madrid|atletico)/.test(normalized)) return "LaLiga";
  return "Genel";
}

function buildTitle(title: string, category: NewsCategory) {
  const prefix = category === "transfer" ? "Transfer" : category === "istatistik" ? "Istatistik" : "Haber";
  return title.toLocaleLowerCase("tr").startsWith(prefix.toLocaleLowerCase("tr"))
    ? title.slice(0, 120)
    : `${prefix}: ${title.slice(0, 108)}`;
}

function hashText(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash << 5) - hash + value.charCodeAt(index)) | 0;
  }
  return Math.abs(hash).toString(36);
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
