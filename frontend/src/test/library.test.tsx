import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { LibraryView } from '../components/views/LibraryView';
import { addBookmark, followFeed, saveFeedArticles } from '../utils/storage';
import { readerApi } from '../services/api';
import { clearRelatedFeedValidationCache } from '../services/feedService';
import { ApiResult, FetchResponse } from '../types/article';

describe('LibraryView', () => {
  beforeEach(() => {
    localStorage.clear();
    readerApi.fetchProxy = undefined;
    clearRelatedFeedValidationCache();
  });

  it('renders empty library state when no bookmarks exist', async () => {
    render(<LibraryView onSelectArticleUrl={vi.fn()} onNotify={vi.fn()} />);
    await waitFor(() => expect(screen.getByText('Your library is empty')).toBeInTheDocument());
  });

  it('renders saved bookmarks and filters by search query', async () => {
    addBookmark({
      url: 'https://example.com/essay',
      title: 'Deep Focus Essay',
      siteName: 'Focus Weekly',
      excerpt: 'Notes on focus.',
    });
    addBookmark({
      url: 'https://example.com/tech',
      title: 'JavaScript Evolution',
      siteName: 'Dev Digest',
      excerpt: 'JS trends.',
    });

    render(<LibraryView onSelectArticleUrl={vi.fn()} onNotify={vi.fn()} />);
    await waitFor(() => expect(screen.getByText('Deep Focus Essay')).toBeInTheDocument());

    expect(screen.getByText('Deep Focus Essay')).toBeInTheDocument();
    expect(screen.getByText('JavaScript Evolution')).toBeInTheDocument();

    // Test search filter
    const searchInput = screen.getByPlaceholderText('Search your library...');
    fireEvent.change(searchInput, { target: { value: 'Focus' } });

    expect(screen.getByText('Deep Focus Essay')).toBeInTheDocument();
    expect(screen.queryByText('JavaScript Evolution')).not.toBeInTheDocument();
  });

  it('shows verified BBC and Aeon websites, not their RSS URLs, and opens articles in the reader', async () => {
    const bbcFeedUrl = 'https://feeds.bbci.co.uk/news/rss.xml';
    const aeonFeedUrl = 'https://aeon.co/feed.rss';
    const bbcHomepage = 'https://www.bbc.com/news';
    const aeonHomepage = 'https://aeon.co/';
    followFeed({ feedUrl: bbcFeedUrl, title: 'BBC News', host: 'bbc.com' });
    followFeed({ feedUrl: aeonFeedUrl, title: 'Aeon', host: 'aeon.co' });
    saveFeedArticles([{
      feedUrl: bbcFeedUrl,
      url: 'https://www.bbc.com/news/articles/123',
      title: 'BBC story',
      siteName: 'BBC News',
      fetchedAt: '2026-11-02T00:00:00.000Z',
    }]);
    readerApi.fetchProxy = vi.fn(async (url): Promise<ApiResult<FetchResponse>> => ({
      success: true,
      data: url === bbcFeedUrl
        ? {
          url,
          contentType: 'application/rss+xml',
          content: '<rss><channel><title>BBC News</title><link>https://www.bbc.co.uk/news</link></channel></rss>',
        }
        : url === aeonFeedUrl
          ? {
            url,
            contentType: 'application/rss+xml',
            content: `<rss><channel><title>Aeon</title><link>${aeonHomepage}</link></channel></rss>`,
          }
          : { url, contentType: 'text/html', content: '<html><body>Publisher page</body></html>' },
    }));
    const onSelectArticleUrl = vi.fn();

    render(
      <LibraryView onSelectArticleUrl={onSelectArticleUrl} onNotify={vi.fn()} initialTab="following" />
    );

    await waitFor(() => {
      expect(screen.getAllByRole('link', { name: 'Open website ↗' })).toHaveLength(2);
    });
    const websiteLinks = screen.getAllByRole('link', { name: 'Open website ↗' });
    expect(websiteLinks.map((link) => link.getAttribute('href'))).toEqual([aeonHomepage, bbcHomepage]);
    expect(websiteLinks.some((link) => link.getAttribute('href') === bbcFeedUrl)).toBe(false);
    expect(websiteLinks.some((link) => link.getAttribute('href') === aeonFeedUrl)).toBe(false);

    fireEvent.click(screen.getByRole('button', { name: 'View articles from BBC News' }));
    fireEvent.click(await screen.findByRole('button', { name: 'BBC story' }));
    expect(onSelectArticleUrl).toHaveBeenCalledWith('https://www.bbc.com/news/articles/123');
    expect(readerApi.fetchProxy).toHaveBeenCalledWith(bbcFeedUrl);
    expect(readerApi.fetchProxy).toHaveBeenCalledWith(aeonFeedUrl);
  });

  it('shows an unavailable publisher state and never links a third-party RSS feed', async () => {
    const feedUrl = 'https://feeds.feedburner.com/publisher/news';
    followFeed({ feedUrl, title: 'Publisher', host: 'publisher.example' });
    readerApi.fetchProxy = vi.fn(async (url): Promise<ApiResult<FetchResponse>> => ({
      success: true,
      data: {
        url,
        contentType: 'application/rss+xml',
        content: '<rss><channel><title>Publisher</title><item><title>A story</title></item></channel></rss>',
      },
    }));

    render(
      <LibraryView onSelectArticleUrl={vi.fn()} onNotify={vi.fn()} initialTab="following" />
    );

    expect(await screen.findByText('Publisher website unavailable')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: feedUrl })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Open website ↗' })).not.toBeInTheDocument();
  });
});
