import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ReaderCanvas } from '../components/reader/ReaderCanvas';
import { Article } from '../types/article';
import { getTodayStats, recordArticleRead } from '../utils/storage';

describe('ReaderCanvas Sanitization & Rendering', () => {
  const sampleArticle: Article = {
    url: 'https://example.com/clean-read',
    title: 'Clean Distraction-Free Article',
    byline: 'Jane Doe',
    publishedDate: '2026-10-30T00:00:00Z',
    siteName: 'Example News',
    excerpt: 'An excerpt describing the article.',
    readingTimeMinutes: 3,
    wordCount: 450,
    content: `
      <p>Legitimate article paragraph.</p>
      <script>window.__malicious_injected_code = true;</script>
      <img src="https://example.com/valid.jpg" alt="Valid illustration" onerror="alert('xss')" />
      <blockquote>Important quotation.</blockquote>
    `,
  };

  it('renders article title, byline, and site name', () => {
    render(<ReaderCanvas article={sampleArticle} />);
    expect(screen.getByText('Clean Distraction-Free Article')).toBeInTheDocument();
    expect(screen.getByText('Jane Doe')).toBeInTheDocument();
    expect(screen.getByText('Example News')).toBeInTheDocument();
  });

  it('sanitizes malicious script tags and inline event handlers', () => {
    const { container } = render(<ReaderCanvas article={sampleArticle} />);
    // Script tag should be completely removed
    const scripts = container.querySelectorAll('script');
    expect(scripts.length).toBe(0);

    // img onerror attribute should be stripped
    const img = container.querySelector('img');
    expect(img).toBeInTheDocument();
    expect(img?.getAttribute('onerror')).toBeNull();
  });

  it('removes unsafe links and non-web image sources', () => {
    const unsafeArticle: Article = {
      ...sampleArticle,
      content: '<p><a href="javascript:alert(1)">Unsafe link</a></p><img src="data:image/svg+xml,<svg onload=alert(1)>" alt="unsafe">',
    };
    const { container } = render(<ReaderCanvas article={unsafeArticle} />);
    expect(container.querySelector('.reader-prose a')?.getAttribute('href')).toBeNull();
    expect(container.querySelector('.reader-prose img')).not.toBeInTheDocument();
  });

  it('handles empty content gracefully with fallback notice', () => {
    const emptyArticle: Article = {
      url: 'https://example.com/empty',
      title: 'Empty Article',
      content: '',
    };
    render(<ReaderCanvas article={emptyArticle} />);
    expect(screen.getByText(/No textual content could be extracted/i)).toBeInTheDocument();
  });

  it('formats plain-text extracted content with multiple paragraphs into readable paragraph elements', () => {
    const plainTextArticle: Article = {
      url: 'https://www.gutenberg.org/ebooks/1342',
      title: 'Pride and Prejudice by Jane Austen | Project Gutenberg',
      content: 'Pride and Prejudice is an 1813 novel by Jane Austen.\n\nIt follows the character development of Elizabeth Bennet.',
    };
    const { container } = render(<ReaderCanvas article={plainTextArticle} />);
    expect(screen.getByText(/Pride and Prejudice is an 1813 novel/i)).toBeInTheDocument();
    expect(screen.getByText(/It follows the character development/i)).toBeInTheDocument();
    const paragraphs = container.querySelectorAll('.reader-prose p');
    expect(paragraphs.length).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// Regression: Reading stat deduplication
// ---------------------------------------------------------------------------
describe('ReaderCanvas — onArticleRead deduplication contract', () => {
  const articleA: Article = {
    url: 'https://example.com/article-a',
    title: 'Article A',
    content: '<p>Content of article A.</p>',
    wordCount: 600,
    readingTimeMinutes: 3,
  };

  const articleB: Article = {
    url: 'https://example.com/article-b',
    title: 'Article B',
    content: '<p>Content of article B.</p>',
    wordCount: 400,
    readingTimeMinutes: 2,
  };

  it('fires onArticleRead once per mount with the correct url, wordCount, and readingTimeMinutes', () => {
    const spy = vi.fn();
    render(<ReaderCanvas article={articleA} onArticleRead={spy} />);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith(articleA.url, articleA.wordCount, articleA.readingTimeMinutes);
  });

  it('fires onArticleRead again on remount with the SAME article (deduplication is the parent\'s responsibility)', () => {
    // ReaderCanvas itself is stateless w.r.t. deduplication — it always fires
    // the callback. The parent (App.tsx) owns the Set<string> that gates recording.
    const spy = vi.fn();
    const { unmount } = render(<ReaderCanvas article={articleA} onArticleRead={spy} />);
    unmount();
    render(<ReaderCanvas article={articleA} onArticleRead={spy} />);
    // Called once per mount — App.tsx is responsible for discarding the second call.
    expect(spy).toHaveBeenCalledTimes(2);
    expect(spy).toHaveBeenNthCalledWith(1, articleA.url, articleA.wordCount, articleA.readingTimeMinutes);
    expect(spy).toHaveBeenNthCalledWith(2, articleA.url, articleA.wordCount, articleA.readingTimeMinutes);
  });

  it('does not fire onArticleRead when article has empty content (failed or empty extraction)', () => {
    const spy = vi.fn();
    const emptyArticle: Article = {
      url: 'https://example.com/empty-read',
      title: 'Empty Article',
      content: '',
      wordCount: 0,
      readingTimeMinutes: 0,
    };
    render(<ReaderCanvas article={emptyArticle} onArticleRead={spy} />);
    expect(spy).not.toHaveBeenCalled();
  });

  it('fires onArticleRead with 0/0 when wordCount and readingTimeMinutes are absent (no fictional fallbacks)', () => {
    const spy = vi.fn();
    const articleNoMeta: Article = {
      url: 'https://example.com/no-meta',
      title: 'No Metadata Article',
      content: '<p>Some content.</p>',
      // wordCount and readingTimeMinutes deliberately omitted
    };
    render(<ReaderCanvas article={articleNoMeta} onArticleRead={spy} />);
    expect(spy).toHaveBeenCalledWith(articleNoMeta.url, 0, 0);
  });

  it('fires onArticleRead with correct stats for each of two different articles', () => {
    const spy = vi.fn();
    const { unmount } = render(<ReaderCanvas article={articleA} onArticleRead={spy} />);
    unmount();
    render(<ReaderCanvas article={articleB} onArticleRead={spy} />);
    expect(spy).toHaveBeenCalledTimes(2);
    expect(spy).toHaveBeenNthCalledWith(1, articleA.url, 600, 3);
    expect(spy).toHaveBeenNthCalledWith(2, articleB.url, 400, 2);
  });
});

// ---------------------------------------------------------------------------
// Regression: App-level deduplication logic (mirrors what App.tsx does)
// ---------------------------------------------------------------------------
describe('App-level deduplication logic (unit-tested directly)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('counts each unique article URL only once, even if recordArticleRead is called twice for the same URL', () => {
    // Simulate what handleArticleRead does in App.tsx
    const recordedUrls = new Set<string>();

    function handleArticleRead(url: string, wordCount: number, readingTimeMinutes: number) {
      if (!recordedUrls.has(url)) {
        recordedUrls.add(url);
        recordArticleRead(wordCount || 0, readingTimeMinutes || 0);
      }
    }

    handleArticleRead('https://example.com/a', 500, 3);
    handleArticleRead('https://example.com/a', 500, 3); // duplicate — should be ignored
    handleArticleRead('https://example.com/b', 300, 2);

    const stats = getTodayStats();
    expect(stats.articlesRead).toBe(2);   // NOT 3
    expect(stats.wordsRead).toBe(800);
    expect(stats.minutesRead).toBe(5);
  });

  it('does not add any stats if wordCount and readingTimeMinutes are 0', () => {
    const recordedUrls = new Set<string>();

    function handleArticleRead(url: string, wordCount: number, readingTimeMinutes: number) {
      if (!recordedUrls.has(url)) {
        recordedUrls.add(url);
        recordArticleRead(wordCount || 0, readingTimeMinutes || 0);
      }
    }

    handleArticleRead('https://example.com/empty', 0, 0);
    const stats = getTodayStats();
    expect(stats.articlesRead).toBe(1);  // article still counted
    expect(stats.wordsRead).toBe(0);     // no fictitious 300-word default
    expect(stats.minutesRead).toBe(0);   // no fictitious 2-minute default
  });
});
