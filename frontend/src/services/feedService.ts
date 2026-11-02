import { ApiResult, FeedArticle, FetchResponse, FollowedFeed } from '../types/article';
import { readerApi } from './api';
import { saveFeedArticles } from '../utils/storage';

interface ParsedFeed {
  title: string;
  articles: FeedArticle[];
}

export interface RelatedFeedValidation {
  feedValid: boolean;
  homepageUrl: string | null;
  reason: string;
}

const relatedFeedValidationCache = new Map<string, Promise<RelatedFeedValidation>>();

function getText(parent: ParentNode, selector: string): string {
  return parent.querySelector(selector)?.textContent?.trim() || '';
}

function publicHttpUrl(rawUrl: string, baseUrl: string): string | null {
  try {
    const url = new URL(rawUrl, baseUrl);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return null;
    return url.href;
  } catch {
    return null;
  }
}

function articleUrl(rawUrl: string, feedUrl: string): string | null {
  return publicHttpUrl(rawUrl, feedUrl);
}

export function parseFeedWebsiteUrl(content: string, feedUrl: string): string | null {
  const safeFeedUrl = publicHttpUrl(feedUrl, feedUrl);
  if (!safeFeedUrl) return null;
  const document = new DOMParser().parseFromString(content, 'application/xml');
  if (document.querySelector('parsererror')) return null;

  const root = document.documentElement;
  const rootName = root.localName.toLowerCase();
  if (rootName === 'feed') {
    const alternateLink = Array.from(root.children).find((child) => {
      if (child.localName.toLowerCase() !== 'link') return false;
      const rel = child.getAttribute('rel')?.trim().toLowerCase();
      const type = child.getAttribute('type')?.trim().toLowerCase();
      return (!rel || rel === 'alternate')
        && (!type || type === 'text/html' || type === 'application/xhtml+xml');
    });
    const href = alternateLink?.getAttribute('href');
    const homepage = href ? articleUrl(href, safeFeedUrl) : null;
    return homepage && homepage !== safeFeedUrl ? homepage : null;
  }

  if (rootName !== 'rss' && rootName !== 'rdf') return null;
  const channel = Array.from(document.getElementsByTagName('*'))
    .find((element) => element.localName.toLowerCase() === 'channel');
  if (!channel) return null;

  const channelLinks = Array.from(channel.children)
    .filter((child) => child.localName.toLowerCase() === 'link');
  const channelLink = channelLinks.find((link) => !link.hasAttribute('href'))?.textContent?.trim();
  const channelHomepage = channelLink ? articleUrl(channelLink, safeFeedUrl) : null;
  if (channelHomepage && channelHomepage !== safeFeedUrl) return channelHomepage;
  const alternateLink = channelLinks.find((link) => {
    const rel = link.getAttribute('rel')?.trim().toLowerCase();
    const type = link.getAttribute('type')?.trim().toLowerCase();
    return link.hasAttribute('href')
      && (!rel || rel === 'alternate')
      && (!type || type === 'text/html' || type === 'application/xhtml+xml');
  });
  const alternateHomepage = alternateLink?.getAttribute('href');
  if (alternateHomepage) {
    const safeAlternateHomepage = articleUrl(alternateHomepage, safeFeedUrl);
    if (safeAlternateHomepage && safeAlternateHomepage !== safeFeedUrl) return safeAlternateHomepage;
  }

  const image = Array.from(channel.children)
    .find((child) => child.localName.toLowerCase() === 'image');
  const imageLink = image && Array.from(image.children)
    .find((child) => child.localName.toLowerCase() === 'link')
    ?.textContent?.trim();
  const homepage = imageLink ? articleUrl(imageLink, safeFeedUrl) : null;
  return homepage && homepage !== safeFeedUrl ? homepage : null;
}

function validFeedDocument(content: string, contentType: string): boolean {
  if (/text\/html|application\/json/i.test(contentType)) return false;
  if (!/xml|rss|atom/i.test(contentType)) return false;
  const document = new DOMParser().parseFromString(content, 'application/xml');
  if (document.querySelector('parsererror')) return false;
  const rootName = document.documentElement.localName.toLowerCase();
  if (rootName === 'feed') return true;
  if (rootName === 'rss') {
    return Array.from(document.getElementsByTagName('*'))
      .some((element) => element.localName.toLowerCase() === 'channel');
  }
  if (rootName === 'rdf') {
    return Array.from(document.getElementsByTagName('*'))
      .some((element) => element.localName.toLowerCase() === 'channel');
  }
  return false;
}

function isThirdPartyFeedHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/\.$/, '');
  return [
    'feedburner.com',
    'feedproxy.google.com',
    'rss.app',
    'follow.it',
    'feedblitz.com',
  ].some((domain) => host === domain || host.endsWith(`.${domain}`));
}

async function fetchVerifiedHomepage(candidate: string, feedUrl: string): Promise<string | null> {
  const safeCandidate = publicHttpUrl(candidate, feedUrl);
  if (!safeCandidate || safeCandidate === new URL(feedUrl).href || !readerApi.fetchProxy) return null;
  const result = await readerApi.fetchProxy(safeCandidate);
  if (!result.success || !/^https?:\/\//i.test(result.data.url)) return null;
  const contentType = result.data.contentType.split(';', 1)[0].trim().toLowerCase();
  if (contentType !== 'text/html' && contentType !== 'application/xhtml+xml') return null;
  const finalUrl = publicHttpUrl(result.data.url, safeCandidate);
  return finalUrl && finalUrl !== new URL(feedUrl).href ? finalUrl : null;
}

async function resolveRelatedFeed(feedUrl: string, storedHomepageUrl?: string | null): Promise<RelatedFeedValidation> {
  if (!readerApi.fetchProxy) {
    return { feedValid: false, homepageUrl: null, reason: 'The safe feed service is unavailable.' };
  }

  const safeFeedUrl = publicHttpUrl(feedUrl, feedUrl);
  if (!safeFeedUrl) {
    return { feedValid: false, homepageUrl: null, reason: 'This feed URL is not a valid public HTTP or HTTPS address.' };
  }

  let feedContent: string | null = null;
  let feedValid = false;
  let feedFailure = 'The publisher did not return a valid RSS or Atom feed.';
  let feedResult: ApiResult<FetchResponse>;
  try {
    feedResult = await readerApi.fetchProxy(safeFeedUrl);
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'network request failed';
    feedFailure = `Feed could not be verified: ${reason}`;
    feedResult = { success: false, error: { code: 'FETCH_FAILED', message: reason } };
  }
  if (feedResult.success && validFeedDocument(feedResult.data.content, feedResult.data.contentType)) {
    feedContent = feedResult.data.content;
    feedValid = true;
  } else if (!feedResult.success) {
    feedFailure = `Feed could not be verified: ${feedResult.error.message}`;
  }

  const parsedHomepageUrl = feedContent ? parseFeedWebsiteUrl(feedContent, safeFeedUrl) : null;
  const canonicalHomepageUrl = safeFeedUrl === 'https://feeds.bbci.co.uk/news/rss.xml'
    && parsedHomepageUrl === 'https://www.bbc.co.uk/news'
    ? 'https://www.bbc.com/news'
    : null;
  const candidates = [
    canonicalHomepageUrl,
    parsedHomepageUrl,
    storedHomepageUrl ? publicHttpUrl(storedHomepageUrl, safeFeedUrl) : null,
  ];
  const parsedFeedUrl = new URL(safeFeedUrl);
  if (!isThirdPartyFeedHost(parsedFeedUrl.hostname)) {
    candidates.push(`${parsedFeedUrl.origin}/`);
  }

  for (const candidate of [...new Set(candidates.filter((url): url is string => Boolean(url)))]) {
    try {
      const homepageUrl = await fetchVerifiedHomepage(candidate, safeFeedUrl);
      if (homepageUrl) {
        return {
          feedValid,
          homepageUrl,
          reason: feedValid ? '' : `${feedFailure} The publisher website is verified separately.`,
        };
      }
    } catch {
      // Try the next independently verified publisher metadata candidate.
    }
  }

  return feedValid
    ? { feedValid: true, homepageUrl: null, reason: 'No publisher homepage could be verified from feed metadata.' }
    : { feedValid: false, homepageUrl: null, reason: `${feedFailure} No publisher homepage could be verified.` };
}

export function validateRelatedFeed(
  feedUrl: string,
  storedHomepageUrl?: string | null,
): Promise<RelatedFeedValidation> {
  const key = `${feedUrl}\n${storedHomepageUrl || ''}`;
  const cached = relatedFeedValidationCache.get(key);
  if (cached) return cached;

  const validation = resolveRelatedFeed(feedUrl, storedHomepageUrl);
  relatedFeedValidationCache.set(key, validation);
  return validation;
}

export function clearRelatedFeedValidationCache(): void {
  relatedFeedValidationCache.clear();
}

export async function fetchFeedWebsiteUrl(feedUrl: string): Promise<string | null> {
  const result = await validateRelatedFeed(feedUrl);
  return result.homepageUrl;
}

function plainText(value: string): string {
  const parsed = new DOMParser().parseFromString(value, 'text/html');
  return parsed.body.textContent?.replace(/\s+/g, ' ').trim() || '';
}

function parseFeed(content: string, feedUrl: string): ParsedFeed | null {
  const document = new DOMParser().parseFromString(content, 'application/xml');
  if (document.querySelector('parsererror')) return null;

  const rootName = document.documentElement.localName.toLowerCase();
  if (!['rss', 'feed', 'rdf'].includes(rootName)) return null;

  const channel = document.querySelector('channel') || document;
  const title = getText(channel, 'title') || new URL(feedUrl).hostname;
  const entries = Array.from(document.querySelectorAll('item, entry'));
  const fetchedAt = new Date().toISOString();
  const articles = entries.flatMap((entry): FeedArticle[] => {
    const linkNode = entry.querySelector('link[rel="alternate"][href], link[href]') || entry.querySelector('link');
    const rawLink = linkNode?.getAttribute('href') || linkNode?.textContent?.trim() || getText(entry, 'guid');
    const url = rawLink ? articleUrl(rawLink, feedUrl) : null;
    const entryTitle = getText(entry, 'title');
    if (!url || !entryTitle) return [];

    const summary = getText(entry, 'description, summary, content');
    const rawDate = getText(entry, 'pubDate, published, updated, date');
    const parsedDate = rawDate ? new Date(rawDate) : null;

    return [{
      feedUrl,
      url,
      title: entryTitle,
      siteName: title,
      excerpt: summary ? plainText(summary) : undefined,
      publishedAt: parsedDate && !Number.isNaN(parsedDate.getTime()) ? parsedDate.toISOString() : null,
      fetchedAt,
    }];
  });

  return { title, articles };
}

function discoveryLinks(content: string, pageUrl: string): string[] {
  const document = new DOMParser().parseFromString(content, 'text/html');
  const advertised = Array.from(document.querySelectorAll('link[rel~="alternate"][href]'))
    .filter((link) => /rss|atom|xml/i.test(link.getAttribute('type') || ''))
    .map((link) => articleUrl(link.getAttribute('href') || '', pageUrl))
    .filter((url): url is string => Boolean(url));
  const origin = new URL(pageUrl).origin;
  const conventional = [
    '/feed',
    '/feed/',
    '/feed.xml',
    '/rss',
    '/rss.xml',
    '/atom.xml',
    '/index.xml',
    '/feeds/all.atom.xml',
  ];
  return [...new Set([...advertised, ...conventional.map((path) => `${origin}${path}`)])].slice(0, 10);
}

async function fetchProxyContent(url: string): Promise<string> {
  if (!readerApi.fetchProxy) {
    throw new Error('The configured API client does not support safe feed fetching.');
  }
  const result = await readerApi.fetchProxy(url);
  if (!result.success) throw new Error(result.error.message);
  return result.data.content;
}

export async function discoverAndFetchFeed(siteUrl: string): Promise<{ feedUrl: string; title: string; articles: FeedArticle[] }> {
  let pageUrl: string;
  try {
    const parsed = new URL(siteUrl);
    if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) {
      throw new Error('Enter a public HTTP or HTTPS blog or feed URL.');
    }
    pageUrl = parsed.href;
  } catch (error) {
    if (error instanceof Error && error.message === 'Enter a public HTTP or HTTPS blog or feed URL.') throw error;
    throw new Error('Enter a valid public blog or feed URL.');
  }

  const pageContent = await fetchProxyContent(pageUrl);
  const directFeed = parseFeed(pageContent, pageUrl);
  if (directFeed) {
    saveFeedArticles(directFeed.articles);
    return { feedUrl: pageUrl, title: directFeed.title, articles: directFeed.articles };
  }

  const links = discoveryLinks(pageContent, pageUrl);
  if (links.length === 0) {
    throw new Error('No RSS or Atom feed was advertised by this page.');
  }

  let lastError = 'The page advertised feeds, but none contained a valid RSS or Atom document.';
  for (const feedUrl of links) {
    try {
      const parsed = parseFeed(await fetchProxyContent(feedUrl), feedUrl);
      if (parsed) {
        saveFeedArticles(parsed.articles);
        return { feedUrl, title: parsed.title, articles: parsed.articles };
      }
    } catch (error) {
      lastError = error instanceof Error ? error.message : lastError;
    }
  }
  throw new Error(lastError);
}

export async function refreshFollowedFeeds(feeds: FollowedFeed[]): Promise<{ fetched: number; failed: string[] }> {
  const failed: string[] = [];
  let fetched = 0;
  const boundedFeeds = feeds.slice(0, 20);
  const results = await Promise.all(boundedFeeds.map(async (feed) => {
    try {
      const content = await fetchProxyContent(feed.feedUrl);
      const parsed = parseFeed(content, feed.feedUrl);
      if (!parsed) throw new Error('Feed did not return valid RSS or Atom content.');
      saveFeedArticles(parsed.articles);
      return { feed: feed.title || feed.host || feed.feedUrl, count: parsed.articles.length };
    } catch (error) {
      return {
        feed: feed.title || feed.host || feed.feedUrl,
        error: error instanceof Error ? error.message : 'Unknown feed error',
      };
    }
  }));

  for (const result of results) {
    if ('error' in result) failed.push(`${result.feed}: ${result.error}`);
    else fetched += result.count;
  }
  return { fetched, failed };
}
