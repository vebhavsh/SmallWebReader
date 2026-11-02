import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clearRelatedFeedValidationCache, discoverAndFetchFeed, parseFeedWebsiteUrl, refreshFollowedFeeds, validateRelatedFeed } from '../services/feedService';
import { readerApi } from '../services/api';
import { ApiResult, FetchResponse } from '../types/article';
import { getFeedArticles } from '../utils/storage';

describe('feed discovery and parsing', () => {
  beforeEach(() => {
    localStorage.clear();
    readerApi.fetchProxy = undefined;
    clearRelatedFeedValidationCache();
  });

  it('resolves an RSS channel homepage separately from its feed URL', () => {
    const feedUrl = 'https://publisher.example/rss.xml';
    const xml = '<rss><channel><title>Publisher</title><link>https://publisher.example/home</link></channel></rss>';

    expect(parseFeedWebsiteUrl(xml, feedUrl)).toBe('https://publisher.example/home');
    expect(parseFeedWebsiteUrl(xml, feedUrl)).not.toBe(feedUrl);
  });

  it('uses the Atom alternate website link rather than the atom.xml self link', () => {
    const feedUrl = 'https://publisher.example/atom.xml';
    const atom = '<feed xmlns="http://www.w3.org/2005/Atom"><title>Publisher</title><link rel="self" href="/atom.xml"/><link rel="alternate" href="/"/></feed>';

    expect(parseFeedWebsiteUrl(atom, feedUrl)).toBe('https://publisher.example/');
    expect(parseFeedWebsiteUrl(atom, feedUrl)).not.toBe(feedUrl);
  });

  it('rejects unsafe website metadata and returns no guessed homepage when metadata is missing', () => {
    const feedUrl = 'https://publisher.example/atom.xml';
    const unsafe = '<feed xmlns="http://www.w3.org/2005/Atom"><link rel="alternate" href="javascript:alert(1)"/></feed>';
    const missing = '<rss><channel><title>Publisher</title><item><title>A story</title></item></channel></rss>';

    expect(parseFeedWebsiteUrl(unsafe, feedUrl)).toBeNull();
    expect(parseFeedWebsiteUrl(missing, feedUrl)).toBeNull();
  });

  it('verifies RSS homepage HTML while retaining the RSS URL as the feed URL', async () => {
    const feedUrl = 'https://publisher.example/rss.xml';
    const feedXml = '<rss><channel><title>Publisher</title><link>https://publisher.example/home</link></channel></rss>';
    readerApi.fetchProxy = vi.fn(async (url): Promise<ApiResult<FetchResponse>> => ({
      success: true,
      data: url === feedUrl
        ? { url, contentType: 'application/rss+xml', content: feedXml }
        : { url, contentType: 'text/html; charset=utf-8', content: '<html><body>Publisher</body></html>' },
    }));

    const result = await validateRelatedFeed(feedUrl);
    expect(result).toEqual({ feedValid: true, homepageUrl: 'https://publisher.example/home', reason: '' });
    expect(readerApi.fetchProxy).toHaveBeenCalledWith(feedUrl);
    expect(readerApi.fetchProxy).toHaveBeenCalledWith('https://publisher.example/home');
  });

  it('uses the verified canonical BBC News homepage advertised for the BBC feed', async () => {
    const feedUrl = 'https://feeds.bbci.co.uk/news/rss.xml';
    const homepageUrl = 'https://www.bbc.com/news';
    readerApi.fetchProxy = vi.fn(async (url): Promise<ApiResult<FetchResponse>> => ({
      success: true,
      data: url === feedUrl
        ? {
          url,
          contentType: 'application/rss+xml',
          content: '<rss><channel><title>BBC News</title><link>https://www.bbc.co.uk/news</link></channel></rss>',
        }
        : { url, contentType: 'text/html', content: '<html><body>BBC News</body></html>' },
    }));

    const result = await validateRelatedFeed(feedUrl);

    expect(result.homepageUrl).toBe(homepageUrl);
    expect(readerApi.fetchProxy).toHaveBeenCalledWith(feedUrl);
    expect(readerApi.fetchProxy).toHaveBeenCalledWith(homepageUrl);
  });

  it('uses Atom alternate metadata rather than atom.xml and rejects non-HTML destinations', async () => {
    const feedUrl = 'https://publisher.example/atom.xml';
    const atom = '<feed xmlns="http://www.w3.org/2005/Atom"><title>Publisher</title><link rel="self" href="/atom.xml"/><link rel="alternate" type="text/html" href="/"/></feed>';
    readerApi.fetchProxy = vi.fn(async (url): Promise<ApiResult<FetchResponse>> => ({
      success: true,
      data: url === feedUrl
        ? { url, contentType: 'application/atom+xml', content: atom }
        : { url, contentType: 'application/atom+xml', content: atom },
    }));

    const result = await validateRelatedFeed(feedUrl);
    expect(result.feedValid).toBe(true);
    expect(result.homepageUrl).toBeNull();
    expect(readerApi.fetchProxy).toHaveBeenNthCalledWith(1, feedUrl);
    expect(readerApi.fetchProxy).toHaveBeenCalledWith('https://publisher.example/');
  });

  it('does not guess the origin homepage for a third-party feed host', async () => {
    const feedUrl = 'https://feeds.feedburner.com/example/publisher';
    const xml = '<rss><channel><title>Publisher</title><item><title>A story</title></item></channel></rss>';
    const fetchProxy = vi.fn(async (url): Promise<ApiResult<FetchResponse>> => ({
      success: true,
      data: { url, contentType: 'application/rss+xml', content: xml },
    }));
    readerApi.fetchProxy = fetchProxy;

    const result = await validateRelatedFeed(feedUrl);
    expect(result).toMatchObject({ feedValid: true, homepageUrl: null });
    expect(fetchProxy).toHaveBeenCalledTimes(1);
    expect(fetchProxy).not.toHaveBeenCalledWith('https://feeds.feedburner.com/');
  });

  it('uses stored publisher metadata for a third-party feed only after verifying it serves HTML', async () => {
    const feedUrl = 'https://feeds.feedburner.com/example/publisher';
    const homepageUrl = 'https://publisher.example/';
    const xml = '<rss><channel><title>Publisher</title></channel></rss>';
    readerApi.fetchProxy = vi.fn(async (url): Promise<ApiResult<FetchResponse>> => ({
      success: true,
      data: url === feedUrl
        ? { url, contentType: 'application/rss+xml', content: xml }
        : { url, contentType: 'text/html', content: '<html><body>Publisher</body></html>' },
    }));

    const result = await validateRelatedFeed(feedUrl, homepageUrl);
    expect(result.homepageUrl).toBe(homepageUrl);
    expect(readerApi.fetchProxy).toHaveBeenCalledWith(homepageUrl);
  });

  it('does not use unsafe homepage metadata and rejects broken feeds', async () => {
    const unsafeFeedUrl = 'https://feeds.feedburner.com/example/unsafe';
    const unsafeXml = '<rss><channel><link>javascript:alert(1)</link></channel></rss>';
    const brokenFeedUrl = 'https://publisher.example/broken.xml';
    readerApi.fetchProxy = vi.fn(async (url): Promise<ApiResult<FetchResponse>> => ({
      success: true,
      data: url === unsafeFeedUrl
        ? { url, contentType: 'application/rss+xml', content: unsafeXml }
        : { url, contentType: 'text/html', content: '<html>Not a feed</html>' },
    }));

    const unsafe = await validateRelatedFeed(unsafeFeedUrl, 'javascript:alert(1)');
    expect(unsafe).toMatchObject({ feedValid: true, homepageUrl: null });
    const broken = await validateRelatedFeed(brokenFeedUrl);
    expect(broken.feedValid).toBe(false);
    expect(broken.homepageUrl).not.toBe(brokenFeedUrl);
  });

  it('keeps a separately verified publisher homepage available when its feed is broken', async () => {
    const feedUrl = 'https://publisher.example/rss.xml';
    readerApi.fetchProxy = vi.fn(async (url): Promise<ApiResult<FetchResponse>> => ({
      success: true,
      data: { url, contentType: 'text/html', content: '<html><body>Publisher</body></html>' },
    }));

    const result = await validateRelatedFeed(feedUrl);
    expect(result.feedValid).toBe(false);
    expect(result.homepageUrl).toBe('https://publisher.example/');
    expect(result.reason).toContain('The publisher website is verified separately.');
  });

  it('refreshes followed feeds using feedUrl rather than the publisher homepage', async () => {
    const feedUrl = 'https://feeds.bbci.co.uk/news/rss.xml';
    const refresh = vi.fn(async (url: string): Promise<ApiResult<FetchResponse>> => ({
      success: true,
      data: {
        url,
        contentType: 'application/rss+xml',
        content: '<rss><channel><title>BBC News</title><item><title>World news</title><link>https://www.bbc.com/news/articles/example</link></item></channel></rss>',
      },
    }));
    readerApi.fetchProxy = refresh;

    const result = await refreshFollowedFeeds([{
      feedUrl,
      homepageUrl: 'https://www.bbc.com/news',
      title: 'BBC News',
      followedAt: '2026-11-02T00:00:00.000Z',
    }]);

    expect(result).toEqual({ fetched: 1, failed: [] });
    expect(refresh).toHaveBeenCalledWith(feedUrl);
    expect(refresh).not.toHaveBeenCalledWith('https://www.bbc.com/news');
    expect(getFeedArticles()[0].feedUrl).toBe(feedUrl);
  });

  it('discovers and parses RSS links from a public blog page', async () => {
    const fetchProxy = vi.fn(async (url: string): Promise<ApiResult<FetchResponse>> => ({
      success: true,
      data: {
        url,
        contentType: url.endsWith('/feed.xml') ? 'application/rss+xml' : 'text/html',
        content: url.endsWith('/feed.xml')
          ? '<?xml version="1.0"?><rss version="2.0"><channel><title>Field Notes</title><item><title>A real post</title><link>https://blog.example/posts/one</link><description><![CDATA[<p>A <strong>short</strong> excerpt.</p>]]></description><pubDate>Tue, 20 Oct 2026 10:00:00 GMT</pubDate></item></channel></rss>'
          : '<html><head><link rel="alternate" type="application/rss+xml" href="/feed.xml"></head></html>',
      },
    }));
    readerApi.fetchProxy = fetchProxy;

    const result = await discoverAndFetchFeed('https://blog.example/');

    expect(result.feedUrl).toBe('https://blog.example/feed.xml');
    expect(result.title).toBe('Field Notes');
    expect(result.articles).toHaveLength(1);
    expect(result.articles[0].url).toBe('https://blog.example/posts/one');
    expect(result.articles[0].excerpt).toBe('A short excerpt.');
    expect(getFeedArticles()).toHaveLength(1);
  });

  it('parses Atom entry links and rejects pages without an advertised feed', async () => {
    const atom = '<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom"><title>Atom Notes</title><entry><title>Atom post</title><link rel="alternate" href="https://atom.example/posts/one"/><summary>Plain summary</summary><updated>2026-10-20T10:00:00Z</updated></entry></feed>';
    readerApi.fetchProxy = vi.fn(async (url: string): Promise<ApiResult<FetchResponse>> => ({
      success: true,
      data: {
        url,
        contentType: url.endsWith('/atom.xml') ? 'application/atom+xml' : 'text/html',
        content: url.endsWith('/atom.xml') ? atom : '<html><head><link rel="alternate" type="application/atom+xml" href="/atom.xml"></head></html>',
      },
    }));

    const atomResult = await discoverAndFetchFeed('https://atom.example/');
    expect(atomResult.articles[0].title).toBe('Atom post');
    expect(atomResult.articles[0].url).toBe('https://atom.example/posts/one');

    readerApi.fetchProxy = vi.fn(async (url: string): Promise<ApiResult<FetchResponse>> => ({
      success: true,
      data: { url, contentType: 'text/html', content: '<html><body>No feed link</body></html>' },
    }));
    await expect(discoverAndFetchFeed('https://no-feed.example')).rejects.toThrow('none contained a valid RSS or Atom');
  });

  it('tries conventional feed locations when a blog does not advertise an alternate link', async () => {
    const fetchProxy = vi.fn(async (url: string): Promise<ApiResult<FetchResponse>> => ({
      success: true,
      data: {
        url,
        contentType: url.endsWith('/feed') ? 'application/rss+xml' : 'text/html',
        content: url.endsWith('/feed')
          ? '<rss><channel><title>Common Path Blog</title><item><title>One post</title><link>https://common.example/post</link></item></channel></rss>'
          : '<html><body>No alternate link tag.</body></html>',
      },
    }));
    readerApi.fetchProxy = fetchProxy;

    const result = await discoverAndFetchFeed('https://common.example');
    expect(result.feedUrl).toBe('https://common.example/feed');
    expect(result.articles).toHaveLength(1);
    expect(fetchProxy).toHaveBeenCalledWith('https://common.example/feed');
  });
});
