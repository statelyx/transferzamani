import { rapidProviderRequest } from "./rapidapi-provider";

export const TWITTER_API_ENDPOINTS = {
  "user-info": { path: "/user.php", ttl: 3_600 },
  timeline: { path: "/timeline.php", ttl: 300 },
  following: { path: "/following.php", ttl: 3_600 },
  followers: { path: "/followers.php", ttl: 3_600 },
  "tweet-info": { path: "/tweet.php", ttl: 300 },
  affiliates: { path: "/affiliates.php", ttl: 3_600 },
  media: { path: "/media.php", ttl: 900 },
  retweets: { path: "/retweets.php", ttl: 900 },
  trends: { path: "/trends.php", ttl: 300 },
  search: { path: "/search.php", ttl: 300 },
  replies: { path: "/replies.php", ttl: 300 },
  thread: { path: "/tweet_thread.php", ttl: 300 },
  "latest-replies": { path: "/latest_replies.php", ttl: 300 },
  "community-info": { path: "/community_info.php", ttl: 3_600 }
} as const;

export type TwitterApiEndpoint = keyof typeof TWITTER_API_ENDPOINTS;

const twitterProvider = {
  id: "twitter-api45",
  hostEnv: "TWITTER_API_RAPIDAPI_HOST",
  defaultHost: "twitter-api45.p.rapidapi.com",
  rateLimitEnv: "TWITTER_API_RATE_LIMIT_MS",
  defaultRateLimitMs: 900,
  endpoints: TWITTER_API_ENDPOINTS
};

export function isTwitterApiEndpoint(value: string): value is TwitterApiEndpoint {
  return value in TWITTER_API_ENDPOINTS;
}

export async function twitterApiGet<T>(
  endpoint: TwitterApiEndpoint,
  params: Record<string, string | number | boolean | null | undefined> = {},
  options: { force?: boolean } = {}
) {
  return rapidProviderRequest<T>(twitterProvider, endpoint, params, options);
}
