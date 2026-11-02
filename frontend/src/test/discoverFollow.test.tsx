import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { DiscoverView } from '../components/views/DiscoverView';
import { LibraryView } from '../components/views/LibraryView';
import { ThemeProvider } from '../components/theme/ThemeProvider';
import { readerApi } from '../services/api';
import { ApiResult, DiscoveryQueryResponse, PopularFeedsResponse } from '../types/article';
import { addBookmark, followFeed, getFollowedFeeds } from '../utils/storage';
import { clearRelatedFeedValidationCache } from '../services/feedService';

const sourceFeed = {
  feedUrl: 'https://reader.example/feed.xml',
  title: 'Reader Source',
  host: 'reader.example',
  source: 'manual' as const,
};

const recommendation = {
  canonicalUrl: 'https://publisher.example/atom.xml',
  host: 'publisher.example',
  title: 'Publisher Journal',
  reason: 'Frequently followed together with blogs in your feed list',
  supportCount: 7,
};

describe('Discover follow journey', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
    readerApi.queryRecommendations = undefined;
    readerApi.getPopularFeeds = undefined;
    readerApi.fetchProxy = undefined;
    clearRelatedFeedValidationCache();
  });

  it('opens the RSS channel homepage and keeps the RSS URL as the follow URL', async () => {
    const feedXml = '<rss><channel><title>Publisher Journal</title><link>https://publisher.example/</link></channel></rss>';
    readerApi.queryRecommendations = vi.fn(async (): Promise<ApiResult<DiscoveryQueryResponse>> => ({
      success: true,
      data: { recommendations: [recommendation], count: 1 },
    }));
    readerApi.fetchProxy = vi.fn(async (url) => ({
      success: true as const,
      data: url === recommendation.canonicalUrl
        ? { url, contentType: 'application/rss+xml', content: feedXml }
        : { url, contentType: 'text/html', content: '<html><body>Publisher</body></html>' },
    }));
    followFeed(sourceFeed);

    render(
      <ThemeProvider>
        <DiscoverView onSelectArticleUrl={vi.fn()} />
      </ThemeProvider>
    );
    fireEvent.click(screen.getByRole('button', { name: 'Related' }));

    const websiteLink = await screen.findByRole('link', { name: 'Open website ↗' });
    expect(websiteLink).toHaveAttribute('href', 'https://publisher.example/');
    expect(websiteLink).not.toHaveAttribute('href', recommendation.canonicalUrl);
    expect(readerApi.fetchProxy).toHaveBeenCalledWith(recommendation.canonicalUrl);

    fireEvent.click(screen.getByRole('button', { name: 'Follow' }));
    await waitFor(() => expect(getFollowedFeeds().map((feed) => feed.feedUrl)).toContain(recommendation.canonicalUrl));
    expect(getFollowedFeeds().find((feed) => feed.feedUrl === recommendation.canonicalUrl)?.feedUrl)
      .toBe('https://publisher.example/atom.xml');
  });

  it('uses the Atom alternate website for atom.xml recommendations', async () => {
    const atom = '<feed xmlns="http://www.w3.org/2005/Atom"><title>Publisher Journal</title><link rel="self" href="/atom.xml"/><link rel="alternate" href="/journal/"/></feed>';
    readerApi.queryRecommendations = vi.fn(async (): Promise<ApiResult<DiscoveryQueryResponse>> => ({
      success: true,
      data: { recommendations: [recommendation], count: 1 },
    }));
    readerApi.fetchProxy = vi.fn(async (url) => ({
      success: true as const,
      data: url === recommendation.canonicalUrl
        ? { url, contentType: 'application/atom+xml', content: atom }
        : { url, contentType: 'text/html', content: '<html><body>Publisher</body></html>' },
    }));
    followFeed(sourceFeed);

    render(
      <ThemeProvider>
        <DiscoverView onSelectArticleUrl={vi.fn()} />
      </ThemeProvider>
    );
    fireEvent.click(screen.getByRole('button', { name: 'Related' }));

    const websiteLink = await screen.findByRole('link', { name: 'Open website ↗' });
    expect(websiteLink).toHaveAttribute('href', 'https://publisher.example/journal/');
    expect(websiteLink).not.toHaveAttribute('href', 'https://publisher.example/atom.xml');
  });

  it('shows Website unavailable without replacing the valid subscription URL', async () => {
    const feedXml = '<rss><channel><title>Publisher Journal</title><item><title>A story</title></item></channel></rss>';
    readerApi.queryRecommendations = vi.fn(async (): Promise<ApiResult<DiscoveryQueryResponse>> => ({
      success: true,
      data: { recommendations: [recommendation], count: 1 },
    }));
    readerApi.fetchProxy = vi.fn(async (url) => ({
      success: true as const,
      data: { url, contentType: 'application/rss+xml', content: feedXml },
    }));
    followFeed(sourceFeed);

    render(
      <ThemeProvider>
        <DiscoverView onSelectArticleUrl={vi.fn()} />
      </ThemeProvider>
    );
    fireEvent.click(screen.getByRole('button', { name: 'Related' }));

    const unavailable = await screen.findByRole('button', { name: 'Website unavailable' });
    expect(unavailable).toBeDisabled();
    expect(screen.getByText('No publisher homepage could be verified from feed metadata.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Follow' })).toBeEnabled();
    expect(screen.queryByRole('link', { name: /feed source/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Open website ↗' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Follow' }));
    await waitFor(() => expect(getFollowedFeeds().map((feed) => feed.feedUrl)).toContain(recommendation.canonicalUrl));
  });

  it('does not expose raw XML or allow following a broken recommendation feed', async () => {
    const brokenRecommendation = {
      ...recommendation,
      canonicalUrl: 'https://feeds.feedburner.com/publisher.xml',
    };
    const query = vi.fn(async (): Promise<ApiResult<DiscoveryQueryResponse>> => ({
      success: true,
      data: { recommendations: [brokenRecommendation], count: 1 },
    }));
    readerApi.queryRecommendations = query;
    readerApi.fetchProxy = vi.fn(async (url) => ({
      success: true as const,
      data: { url, contentType: 'text/html', content: '<html><body>Not a feed</body></html>' },
    }));
    followFeed(sourceFeed);

    render(
      <ThemeProvider>
        <DiscoverView onSelectArticleUrl={vi.fn()} />
      </ThemeProvider>
    );
    fireEvent.click(screen.getByRole('button', { name: 'Related' }));

    await waitFor(() => expect(query).toHaveBeenCalledWith([sourceFeed.feedUrl], 10));
    expect(await screen.findByRole('heading', { name: brokenRecommendation.title! })).toBeInTheDocument();
    expect(await screen.findByText(/The publisher did not return a valid RSS or Atom feed/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Follow' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Website unavailable' })).toBeDisabled();
    expect(screen.queryByRole('link', { name: 'Open website ↗' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: brokenRecommendation.canonicalUrl })).not.toBeInTheDocument();
  });

  it('follows a related result, shows it in Library, and unfollows without deleting bookmarks', async () => {
    followFeed(sourceFeed);
    addBookmark({ url: 'https://article.example/story', title: 'Saved story' });
    const query = vi.fn(async (_feeds: string[], _limit = 20): Promise<ApiResult<DiscoveryQueryResponse>> => ({
      success: true,
      data: { recommendations: [recommendation], count: 1 },
    }));
    readerApi.queryRecommendations = query;
    readerApi.fetchProxy = vi.fn(async (url) => ({
      success: true as const,
      data: url === recommendation.canonicalUrl
        ? {
          url,
          contentType: 'application/atom+xml',
          content: '<feed xmlns="http://www.w3.org/2005/Atom"><title>Publisher</title><link rel="alternate" href="https://publisher.example/"/></feed>',
        }
        : { url, contentType: 'text/html', content: '<html><body>Publisher</body></html>' },
    }));

    const discover = render(
      <ThemeProvider>
        <DiscoverView onSelectArticleUrl={vi.fn()} />
      </ThemeProvider>
    );

    fireEvent.click(screen.getByRole('button', { name: 'Related' }));
    await waitFor(() => expect(query).toHaveBeenCalledWith([sourceFeed.feedUrl], 10));
    expect(await screen.findByText(recommendation.reason, { exact: false })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Follow' }));
    await waitFor(() => {
      expect(getFollowedFeeds().map((feed) => feed.feedUrl)).toContain(recommendation.canonicalUrl);
      expect(query).toHaveBeenLastCalledWith(
        expect.arrayContaining([sourceFeed.feedUrl, recommendation.canonicalUrl]),
        10
      );
    });
    expect(screen.queryByText(recommendation.title)).not.toBeInTheDocument();

    discover.unmount();
    render(
      <ThemeProvider>
        <LibraryView onSelectArticleUrl={vi.fn()} onNotify={vi.fn()} initialTab="following" />
      </ThemeProvider>
    );
    expect(screen.getByText(recommendation.title)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Unfollow Publisher Journal' }));
    await waitFor(() => {
      expect(getFollowedFeeds().map((feed) => feed.feedUrl)).not.toContain(recommendation.canonicalUrl);
    });
    expect(localStorage.getItem('swr_bookmarks_v1')).toContain('Saved story');
  });

  it('shows an honest empty Popular state instead of fabricated popularity counts', async () => {
    readerApi.getPopularFeeds = vi.fn(async (_limit = 20, _offset = 0): Promise<ApiResult<PopularFeedsResponse>> => ({
      success: true,
      data: {
        feeds: [],
        total: 0,
        limit: 20,
        offset: 0,
      },
    }));

    render(
      <ThemeProvider>
        <DiscoverView onSelectArticleUrl={vi.fn()} />
      </ThemeProvider>
    );
    fireEvent.click(screen.getByRole('button', { name: 'Popular' }));
    expect(await screen.findByText('No popular feeds recorded yet. You can be the first to contribute below.')).toBeInTheDocument();
    expect(screen.queryByText(/\b\d+\s+genuine opt-in aggregate contribution/)).not.toBeInTheDocument();
  });

  it('uses the verified official feed replacement for legacy Marginalian recommendations', async () => {
    const legacy = {
      ...recommendation,
      canonicalUrl: 'https://www.themarginalian.org/feed/',
      host: 'themarginalian.org',
      title: 'The Marginalian',
    };
    const officialFeed = 'https://feeds.feedburner.com/brainpickings/rss';
    readerApi.queryRecommendations = vi.fn(async (): Promise<ApiResult<DiscoveryQueryResponse>> => ({
      success: true,
      data: { recommendations: [legacy], count: 1 },
    }));
    readerApi.fetchProxy = vi.fn(async (url) => ({
      success: true as const,
      data: url === officialFeed
        ? { url, contentType: 'application/rss+xml', content: '<rss><channel><title>The Marginalian</title></channel></rss>' }
        : { url, contentType: 'text/html', content: '<html><body>The Marginalian</body></html>' },
    }));
    followFeed(sourceFeed);

    render(
      <ThemeProvider>
        <DiscoverView onSelectArticleUrl={vi.fn()} />
      </ThemeProvider>
    );
    fireEvent.click(screen.getByRole('button', { name: 'Related' }));

    expect(await screen.findByRole('link', { name: 'Open website ↗' })).toHaveAttribute(
      'href',
      'https://www.themarginalian.org/'
    );
    expect(readerApi.fetchProxy).toHaveBeenCalledWith(officialFeed);
    expect(readerApi.fetchProxy).not.toHaveBeenCalledWith(legacy.canonicalUrl);
    fireEvent.click(screen.getByRole('button', { name: 'Follow' }));
    await waitFor(() => expect(getFollowedFeeds().map((feed) => feed.feedUrl)).toContain(officialFeed));
  });

  it('shows Related API failures and retries against the followed feed URLs', async () => {
    const query = vi.fn(async (_feeds: string[], _limit = 20): Promise<ApiResult<DiscoveryQueryResponse>> => ({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Related recommendations are temporarily unavailable.' },
    }));
    readerApi.queryRecommendations = query;
    followFeed(sourceFeed);

    render(
      <ThemeProvider>
        <DiscoverView onSelectArticleUrl={vi.fn()} />
      </ThemeProvider>
    );
    fireEvent.click(screen.getByRole('button', { name: 'Related' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Related recommendations are temporarily unavailable.');
    expect(query).toHaveBeenCalledWith([sourceFeed.feedUrl], 10);
  });

  it('does not expose curated RSS URLs as website links or send samples to article extraction', async () => {
    const extractArticle = vi.fn();
    const selectArticle = vi.fn(extractArticle);
    render(
      <ThemeProvider>
        <DiscoverView onSelectArticleUrl={selectArticle} />
      </ThemeProvider>
    );

    expect(screen.queryByRole('link', { name: 'Open feed ↗' })).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getAllByText('Publisher website unavailable')).toHaveLength(4));
    expect(screen.queryByRole('link', { name: 'Open website ↗' })).not.toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('button', { name: 'Follow Feed' })[0]);
    expect(selectArticle).not.toHaveBeenCalled();
    expect(extractArticle).not.toHaveBeenCalled();
  });
});
