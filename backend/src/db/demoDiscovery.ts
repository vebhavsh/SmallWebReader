export interface DemoFeed {
  canonicalUrl: string;
  host: string;
  title: string;
  reason: string;
  supportCount: number;
  isSeed: boolean;
  aggregateCount: number;
  websiteUrl: string | null;
}

export const DEMO_DISCOVERY_FEEDS: DemoFeed[] = [
  {
    canonicalUrl: 'https://feeds.feedburner.com/brainpickings/rss',
    host: 'themarginalian.org',
    title: 'The Marginalian',
    reason: 'Demo directory entry; not based on reader co-occurrence.',
    supportCount: 0,
    isSeed: true,
    aggregateCount: 0,
    websiteUrl: 'https://www.themarginalian.org/',
  },
  {
    canonicalUrl: 'https://daringfireball.net/feeds/main',
    host: 'daringfireball.net',
    title: "Daring Fireball",
    reason: 'Demo directory entry; not based on reader co-occurrence.',
    supportCount: 0,
    isSeed: true,
    aggregateCount: 0,
    websiteUrl: 'https://daringfireball.net/',
  },
  {
    canonicalUrl: 'https://simonwillison.net/atom/everything/',
    host: 'simonwillison.net',
    title: "Simon Willison's Weblog",
    reason: 'Demo directory entry; not based on reader co-occurrence.',
    supportCount: 0,
    isSeed: true,
    aggregateCount: 0,
    websiteUrl: 'https://simonwillison.net/',
  },
  {
    canonicalUrl: 'https://jvns.ca/atom.xml',
    host: 'jvns.ca',
    title: "Julia Evans' Blog",
    reason: 'Demo directory entry; not based on reader co-occurrence.',
    supportCount: 0,
    isSeed: true,
    aggregateCount: 0,
    websiteUrl: 'https://jvns.ca/',
  },
  {
    canonicalUrl: 'https://danluu.com/atom.xml',
    host: 'danluu.com',
    title: "Dan Luu's Blog",
    reason: 'Demo directory entry; not based on reader co-occurrence.',
    supportCount: 0,
    isSeed: true,
    aggregateCount: 0,
    websiteUrl: 'https://danluu.com/',
  },
  {
    canonicalUrl: 'https://increment.com/feed.xml',
    host: 'increment.com',
    title: 'Increment',
    reason: 'Demo directory entry; not based on reader co-occurrence.',
    supportCount: 0,
    isSeed: true,
    aggregateCount: 0,
    websiteUrl: 'https://increment.com/',
  },
  {
    canonicalUrl: 'https://css-tricks.com/feed/',
    host: 'css-tricks.com',
    title: 'CSS-Tricks',
    reason: 'Demo directory entry; not based on reader co-occurrence.',
    supportCount: 0,
    isSeed: true,
    aggregateCount: 0,
    websiteUrl: 'https://css-tricks.com/',
  },
  {
    canonicalUrl: 'https://www.oldeuropeanculture.com/feed/',
    host: 'oldeuropeanculture.com',
    title: 'Old European Culture',
    reason: 'Curated independent recommendation from the seed directory.',
    supportCount: 0,
    isSeed: true,
    aggregateCount: 0,
    websiteUrl: null,
  },
  {
    canonicalUrl: 'https://www.wilwheaton.net/feed/',
    host: 'wilwheaton.net',
    title: 'Wil Wheaton',
    reason: 'Curated independent recommendation from the seed directory.',
    supportCount: 0,
    isSeed: true,
    aggregateCount: 0,
    websiteUrl: 'https://wilwheaton.net/',
  },
  {
    canonicalUrl: 'https://www.aaronsw.com/2002/feeds/atom.xml',
    host: 'aaronsw.com',
    title: 'Aaron Swartz Archive',
    reason: 'Curated independent recommendation from the seed directory.',
    supportCount: 0,
    isSeed: true,
    aggregateCount: 0,
    websiteUrl: null,
  },
];

export function isDemoDiscoveryEnabled(): boolean {
  return process.env.USE_DEMO_DISCOVERY === 'true';
}

export function getDemoPopularFeeds(limit = 20): { feeds: DemoFeed[]; total: number } {
  return {
    feeds: [],
    total: 0,
  };
}

export function getDemoRecommendations(inputUrls: string[], limit = 10): DemoFeed[] {
  const normalized = new Set(inputUrls.map((url) => url.toLowerCase()));
  const selected = DEMO_DISCOVERY_FEEDS.filter((feed) => !normalized.has(feed.canonicalUrl.toLowerCase()));
  return selected.slice(0, limit).map((feed) => ({
    ...feed,
    reason: feed.reason,
  }));
}
