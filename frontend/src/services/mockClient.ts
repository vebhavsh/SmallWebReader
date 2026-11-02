import {
  Article,
  ApiResult,
  ReaderApiClient,
  FetchResponse,
  PopularFeedsResponse,
  DiscoveryQueryResponse,
  DiscoverySubmitResponse,
} from '../types/article';
import { SAMPLE_ARTICLES } from './fixtures/sampleArticles';
import { calculateReadingTime } from '../utils/readingTime';

/**
 * MockApiClient
 * Used solely in local development when VITE_USE_DEV_FIXTURES=true.
 * Provides rich deterministic fixtures for testing reader layouts, fonts, and controls.
 */
export class MockApiClient implements ReaderApiClient {
  async extractArticle(url: string): Promise<ApiResult<Article>> {
    // Simulate brief network latency for realistic loading feedback
    await new Promise((resolve) => setTimeout(resolve, 600));

    // Normalize URL for matching
    const cleanUrl = url.trim().replace(/\/$/, '');

    // Check exact or partial match in fixtures
    const matchKey = Object.keys(SAMPLE_ARTICLES).find(
      (key) => key === cleanUrl || cleanUrl.includes(key.replace(/^https?:\/\//, ''))
    );

    if (matchKey) {
      return {
        success: true,
        data: SAMPLE_ARTICLES[matchKey],
      };
    }

    // If an arbitrary URL is tested in fixture mode, generate a dynamic fixture so the developer can inspect formatting
    try {
      const parsed = new URL(url.startsWith('http') ? url : `https://${url}`);
      const domain = parsed.hostname;
      const pathTitle = parsed.pathname
        .replace(/[-_/]/g, ' ')
        .trim() || 'Simulated Web Document';
      const formattedTitle = pathTitle
        .split(' ')
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');

      const content = `
        <p class="lead">This is a simulated article extracted from <strong>${domain}</strong> using the SmallWebReader development fixture engine.</p>
        <h2>Extracted Article Section</h2>
        <p>In live mode, this content will be parsed by the backend extraction service on Laptop 2 via the confirmed API endpoint.</p>
        <p>Notice how paragraphs, blockquotes, and headings retain proportional typographic scales across all reader themes.</p>
        <blockquote>
          "A reader lives a thousand lives before he dies. The man who never reads lives only one." — George R.R. Martin
        </blockquote>
        <p>This development fixture allows thorough validation of typography scaling, theme toggles, and line-width adjustments prior to cross-laptop integration.</p>
      `;

      const { wordCount, readingTimeMinutes } = calculateReadingTime(content);

      const generatedArticle: Article = {
        url,
        title: formattedTitle,
        byline: `Reader Bot (${domain})`,
        publishedDate: new Date().toISOString(),
        siteName: domain,
        excerpt: `Extracted readable text from ${domain}.`,
        readingTimeMinutes,
        wordCount,
        content,
      };

      return {
        success: true,
        data: generatedArticle,
      };
    } catch {
      return {
        success: false,
        error: {
          code: 'FIXTURE_NOT_FOUND',
          message: `No fixture found for URL: ${url}`,
          status: 404,
        },
      };
    }
  }

  async checkHealth(): Promise<{ status: 'ok' }> {
    return { status: 'ok' };
  }

  async fetchProxy(url: string): Promise<ApiResult<FetchResponse>> {
    return {
      success: true,
      data: {
        url,
        contentType: 'application/rss+xml',
        content: `<?xml version="1.0" encoding="utf-8"?><rss version="2.0"><channel><title>Mock Feed</title><link>${url}</link><description>Mock RSS Feed</description></channel></rss>`,
      },
    };
  }

  async getPopularFeeds(limit = 20, offset = 0): Promise<ApiResult<PopularFeedsResponse>> {
    return {
      success: true,
      data: {
        feeds: [],
        total: 0,
        limit,
        offset,
      },
    };
  }

  async queryRecommendations(_feeds: string[], limit = 20): Promise<ApiResult<DiscoveryQueryResponse>> {
    const mockRecs = [
      {
        canonicalUrl: 'https://simonwillison.net/atom/everything/',
        host: 'simonwillison.net',
        title: 'Simon Willison',
        reason: 'Demo directory entry; not based on reader co-occurrence.',
        supportCount: 0,
      },
      {
        canonicalUrl: 'https://drewdevault.com/blog/index.xml',
        host: 'drewdevault.com',
        title: 'Drew DeVault',
        reason: 'Demo directory entry; not based on reader co-occurrence.',
        supportCount: 0,
      },
    ];
    return {
      success: true,
      data: {
        recommendations: mockRecs.slice(0, limit),
        count: mockRecs.length,
      },
    };
  }

  async submitContribution(feeds: string[], consent: boolean): Promise<ApiResult<DiscoverySubmitResponse>> {
    if (!consent) {
      return {
        success: false,
        error: {
          code: 'CONSENT_REQUIRED',
          message: 'Contribution requires explicit user consent.',
          status: 403,
        },
      };
    }
    return {
      success: true,
      data: {
        status: 'accepted',
        feedsProcessed: feeds.length,
        pairsUpdated: (feeds.length * (feeds.length - 1)) / 2,
      },
    };
  }
}
