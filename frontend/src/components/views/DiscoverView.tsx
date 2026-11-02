import React, { useState, useEffect, useRef } from 'react';
import { UserProfile, ReadingGenre, PopularFeed, RecommendationItem, FollowedFeed } from '../../types/article';
import { getUserProfile, getFollowedFeeds, followFeed, unfollowFeed, getDiscoveryConsent, setDiscoveryConsent } from '../../utils/storage';
import { useTheme } from '../theme/ThemeProvider';
import { readerApi } from '../../services/api';
import { RelatedFeedValidation, refreshFollowedFeeds, validateRelatedFeed } from '../../services/feedService';

export interface DiscoverViewProps {
  onSelectArticleUrl: (url: string) => void;
  onNotify?: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

interface CuratedFeed {
  url: string;
  homepageUrl: string;
  title: string;
  siteName: string;
  description: string;
  genre: ReadingGenre;
}

const CURATED_LIST: CuratedFeed[] = [
  {
    url: 'https://simonwillison.net/atom/everything/',
    homepageUrl: 'https://simonwillison.net/',
    title: "Simon Willison's Weblog",
    siteName: 'simonwillison.net',
    description: 'Simon Willison’s public Atom feed. Follow to load the latest posts from the publisher.',
    genre: 'Technology',
  },
  {
    url: 'https://jvns.ca/atom.xml',
    homepageUrl: 'https://jvns.ca/',
    title: "Julia Evans' Blog",
    siteName: 'jvns.ca',
    description: 'Julia Evans’ public Atom feed. Follow to load the latest posts from the publisher.',
    genre: 'Technology',
  },
  {
    url: 'https://www.quantamagazine.org/feed/',
    homepageUrl: 'https://www.quantamagazine.org/',
    title: 'Quanta Magazine',
    siteName: 'quantamagazine.org',
    description: 'Quanta Magazine’s public feed for mathematics, physics, and life sciences.',
    genre: 'Science',
  },
  {
    url: 'https://aeon.co/feed.rss',
    homepageUrl: 'https://aeon.co/',
    title: 'Aeon',
    siteName: 'aeon.co',
    description: 'Aeon’s public feed of essays on philosophy, science, psychology, and society.',
    genre: 'Philosophy',
  },
];

const VERIFIED_FEED_REPLACEMENTS: Record<string, { feedUrl: string; websiteUrl: string }> = {
  'https://www.themarginalian.org/feed/': {
    feedUrl: 'https://feeds.feedburner.com/brainpickings/rss',
    websiteUrl: 'https://www.themarginalian.org/',
  },
  'https://increment.com/feed/': {
    feedUrl: 'https://increment.com/feed.xml',
    websiteUrl: 'https://increment.com/',
  },
};

function normalizeRecommendation(item: RecommendationItem): RecommendationItem {
  const replacement = VERIFIED_FEED_REPLACEMENTS[item.canonicalUrl];
  if (!replacement) return item;
  return {
    ...item,
    canonicalUrl: replacement.feedUrl,
    websiteUrl: replacement.websiteUrl,
  };
}

export const DiscoverView: React.FC<DiscoverViewProps> = ({ onSelectArticleUrl, onNotify }) => {
  const { currentThemeConfig } = useTheme();
  const [profile, setProfile] = useState<UserProfile>(() => getUserProfile());
  const [activeTab, setActiveTab] = useState<'curated' | 'popular' | 'related'>('curated');
  const [selectedGenre, setSelectedGenre] = useState<string>('All');
  const [customUrl, setCustomUrl] = useState('');

  const [popularFeeds, setPopularFeeds] = useState<PopularFeed[]>([]);
  const [isLoadingPopular, setIsLoadingPopular] = useState(false);
  const [popularError, setPopularError] = useState<string | null>(null);

  const [queryInput, setQueryInput] = useState('');
  const [recommendations, setRecommendations] = useState<RecommendationItem[]>([]);
  const [feedValidations, setFeedValidations] = useState<Record<string, RelatedFeedValidation | undefined>>({});
  const recommendationRequestId = useRef(0);
  const [isLoadingRecs, setIsLoadingRecs] = useState(false);
  const [recsError, setRecsError] = useState<string | null>(null);

  const [followedFeeds, setFollowedFeeds] = useState<FollowedFeed[]>([]);
  const [consentGiven, setConsentGiven] = useState(getDiscoveryConsent);
  const [submitFeedsInput, setSubmitFeedsInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<string | null>(null);

  useEffect(() => {
    setProfile(getUserProfile());
    setFollowedFeeds(getFollowedFeeds());
  }, []);

  useEffect(() => {
    if (activeTab === 'popular') {
      void loadPopularFeeds();
    } else if (activeTab === 'related') {
      void loadRecommendations(getFollowedFeeds().map((feed) => feed.feedUrl));
    }
  }, [activeTab]);

  useEffect(() => {
    let cancelled = false;
    const feeds = activeTab === 'curated'
      ? CURATED_LIST.map((feed) => ({ feedUrl: feed.url, homepageUrl: feed.homepageUrl }))
      : activeTab === 'popular'
        ? popularFeeds.map((feed) => ({ feedUrl: feed.canonicalUrl, homepageUrl: feed.websiteUrl }))
        : [];
    if (feeds.length === 0) return;
    void Promise.all(feeds.map(async (feed) => {
      try {
        return [feed.feedUrl, await validateRelatedFeed(feed.feedUrl, feed.homepageUrl)] as const;
      } catch (error) {
        return [feed.feedUrl, {
          feedValid: false,
          homepageUrl: null,
          reason: error instanceof Error ? `Publisher could not be verified: ${error.message}` : 'Publisher could not be verified.',
        }] as const;
      }
    })).then((entries) => {
      if (!cancelled) setFeedValidations((current) => ({ ...current, ...Object.fromEntries(entries) }));
    });
    return () => { cancelled = true; };
  }, [activeTab, popularFeeds]);

  const loadPopularFeeds = async () => {
    if (!readerApi.getPopularFeeds) {
      setPopularError('Popular feeds are unavailable in the configured API client.');
      return;
    }
    setIsLoadingPopular(true);
    setPopularError(null);
    try {
      const res = await readerApi.getPopularFeeds(20, 0);
      if (res.success) {
        const deduped = res.data.feeds.filter(
          (feed, index, arr) => arr.findIndex((item) => item.canonicalUrl === feed.canonicalUrl) === index
        );
        setPopularFeeds(deduped);
      } else {
        setPopularError(res.error.message);
      }
    } catch {
      setPopularError('Could not connect to discovery service.');
    } finally {
      setIsLoadingPopular(false);
    }
  };

  const loadRecommendations = async (feedsToQuery: string[]) => {
    const requestId = ++recommendationRequestId.current;
    if (!readerApi.queryRecommendations) {
      setRecommendations([]);
      setFeedValidations({});
      setRecsError('Related recommendations are unavailable in the configured API client.');
      return;
    }
    if (feedsToQuery.length === 0) {
      setRecommendations([]);
      setFeedValidations({});
      setRecsError(null);
      return;
    }

    setIsLoadingRecs(true);
    setRecsError(null);
    try {
      const res = await readerApi.queryRecommendations(feedsToQuery, 10);
      if (res.success) {
        const followedUrls = new Set(getFollowedFeeds().flatMap((feed) => [
          feed.feedUrl,
          VERIFIED_FEED_REPLACEMENTS[feed.feedUrl]?.feedUrl || feed.feedUrl,
        ]));
        const nextRecommendations = res.data.recommendations
          .map(normalizeRecommendation)
          .filter((item, index, list) => !followedUrls.has(item.canonicalUrl)
            && list.findIndex((other) => normalizeRecommendation(other).canonicalUrl === item.canonicalUrl) === index);
        setRecommendations(nextRecommendations);
        setFeedValidations({});
        void Promise.all(nextRecommendations.map(async (item) => {
          try {
            return [item.canonicalUrl, await validateRelatedFeed(item.canonicalUrl, item.websiteUrl)] as const;
          } catch (error) {
            return [item.canonicalUrl, {
              feedValid: false,
              homepageUrl: null,
              reason: error instanceof Error ? `Feed could not be verified: ${error.message}` : 'Feed could not be verified.',
            }] as const;
          }
        })).then((entries) => {
          if (recommendationRequestId.current === requestId) {
            setFeedValidations(Object.fromEntries(entries));
          }
        });
      } else {
        setRecommendations([]);
        setFeedValidations({});
        setRecsError(res.error.message);
      }
    } catch {
      setRecommendations([]);
      setFeedValidations({});
      setRecsError('Failed to query recommendations.');
    } finally {
      setIsLoadingRecs(false);
    }
  };

  const handleQueryRecommendations = async (e: React.FormEvent) => {
    e.preventDefault();
    const feedsToQuery = queryInput.trim()
      ? queryInput.split(/[\n,]+/).map((value) => value.trim()).filter(Boolean)
      : getFollowedFeeds().map((feed) => feed.feedUrl);
    await loadRecommendations(feedsToQuery);
  };

  const handleFollow = (
    feed: { canonicalUrl: string; title: string | null; host: string },
    source: 'popular' | 'recommendation' | 'curated',
    isValidated = true,
  ) => {
    if (source === 'recommendation' && !isValidated) return;
    const entry = followFeed({
      feedUrl: feed.canonicalUrl,
      homepageUrl: feedValidations[feed.canonicalUrl]?.homepageUrl,
      title: feed.title || feed.host,
      host: feed.host,
      source,
    });
    const updated = getFollowedFeeds();
    setFollowedFeeds(updated);
    setRecommendations((current) => current.filter((item) => item.canonicalUrl !== entry.feedUrl));
    setFeedValidations((current) => {
      const next = { ...current };
      delete next[entry.feedUrl];
      return next;
    });
    onNotify?.(`Following ${entry.title || entry.host || entry.feedUrl}.`, 'success');
    void refreshFollowedFeeds([entry]).then((result) => {
      if (result.failed.length > 0) {
        onNotify?.(`Following is saved locally, but this feed could not be refreshed: ${result.failed.join(' ')}`, 'error');
      }
    });
    if (activeTab === 'related') void loadRecommendations(updated.map((item) => item.feedUrl));
    if (activeTab === 'popular') void loadPopularFeeds();
  };

  const handleUnfollow = (feed: { canonicalUrl: string; title: string | null; host: string }) => {
    unfollowFeed(feed.canonicalUrl);
    const updated = getFollowedFeeds();
    setFollowedFeeds(updated);
    onNotify?.(`Unfollowed ${feed.title || feed.host}.`, 'info');
    if (activeTab === 'related') void loadRecommendations(updated.map((item) => item.feedUrl));
    if (activeTab === 'popular') void loadPopularFeeds();
  };

  const handleSubmitContribution = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!readerApi.submitContribution) return;

    if (!consentGiven) {
      if (onNotify) onNotify('Explicit consent is required to contribute.', 'error');
      return;
    }

    let feedsToSubmit: string[] = [];
    if (submitFeedsInput.trim()) {
      feedsToSubmit = submitFeedsInput.split(/[\n,]+/).map((s) => s.trim()).filter(Boolean);
    } else {
      feedsToSubmit = getFollowedFeeds().map((feed) => feed.feedUrl).slice(0, 10);
    }

    if (feedsToSubmit.length === 0) {
      setSubmitResult('Please enter at least one feed URL to contribute.');
      return;
    }

    setIsSubmitting(true);
    setSubmitResult(null);
    try {
      const res = await readerApi.submitContribution(feedsToSubmit, true);
      if (res.success) {
        const msg = `Accepted! Processed ${res.data.feedsProcessed} feeds and updated ${res.data.pairsUpdated} relationships anonymously.`;
        setSubmitResult(msg);
        if (onNotify) onNotify(msg, 'success');
        setSubmitFeedsInput('');
      } else {
        setSubmitResult(`Submission failed: ${res.error.message}`);
        if (onNotify) onNotify(res.error.message, 'error');
      }
    } catch {
      setSubmitResult('Submission failed due to a network error.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const genres = ['All', 'Technology', 'Design', 'Philosophy', 'Literature', 'Science'];

  const filteredFeeds = CURATED_LIST.filter((article) => {
    if (selectedGenre === 'All') return true;
    return article.genre === selectedGenre;
  });

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (customUrl.trim()) {
      onSelectArticleUrl(customUrl.trim());
    }
  };

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: '3rem 1.5rem', width: '100%' }}>
      <div style={{ marginBottom: '2.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
          <span style={{ fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.05em' }}>
            Curated Directory
          </span>
          <span
            style={{
              fontSize: '0.7rem',
              padding: '0.15rem 0.5rem',
              borderRadius: 'var(--radius-full)',
              backgroundColor: 'var(--accent-surface)',
              color: 'var(--text-secondary)',
              fontWeight: 600,
            }}
          >
            Public RSS / Atom feeds
          </span>
        </div>

        <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '2.2rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
          Discover the Small Web
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', marginTop: '0.35rem' }}>
          Quiet, thoughtful essays and articles from the independent web. No sensational algorithmic feeds.
        </p>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '0.45rem' }}>
          These are real publisher feeds, not sample articles. Follow a feed to fetch its current posts through the safe feed service.
        </p>
      </div>

      <div
        style={{
          padding: '1.5rem',
          borderRadius: 'var(--radius-lg)',
          backgroundColor: 'var(--bg-surface)',
          border: '1px solid var(--border-subtle)',
          boxShadow: 'var(--shadow-sm)',
          marginBottom: '2.5rem',
        }}
      >
        <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.35rem' }}>
          Read Any Web Article Instantly
        </h3>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
          Paste any external article link to strip all clutter and read with your current theme.
        </p>

        <form onSubmit={handleCustomSubmit} style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
          <input
            type="url"
            placeholder="https://example.com/essay-or-article"
            value={customUrl}
            onChange={(e) => setCustomUrl(e.target.value)}
            required
            style={{
              flex: 1,
              minWidth: '240px',
              padding: '0.65rem 1rem',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-subtle)',
              backgroundColor: 'var(--bg-page)',
              color: 'var(--text-primary)',
              fontSize: '0.9rem',
            }}
          />
          <button
            type="submit"
            style={{
              padding: '0.65rem 1.4rem',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--accent)',
              color: 'var(--accent-text)',
              border: 'none',
              fontWeight: 600,
              fontSize: '0.9rem',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            Extract & Read 📖
          </button>
        </form>
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.75rem', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.5rem', flexWrap: 'wrap' }}>
        <button
          onClick={() => setActiveTab('curated')}
          style={{
            padding: '0.5rem 1rem',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'curated' ? '2px solid var(--accent)' : '2px solid transparent',
            color: activeTab === 'curated' ? 'var(--text-primary)' : 'var(--text-muted)',
            fontWeight: activeTab === 'curated' ? 600 : 500,
            fontSize: '0.95rem',
            cursor: 'pointer',
          }}
        >
          Curated
        </button>
        <button
          onClick={() => setActiveTab('popular')}
          style={{
            padding: '0.5rem 1rem',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'popular' ? '2px solid var(--accent)' : '2px solid transparent',
            color: activeTab === 'popular' ? 'var(--text-primary)' : 'var(--text-muted)',
            fontWeight: activeTab === 'popular' ? 600 : 500,
            fontSize: '0.95rem',
            cursor: 'pointer',
          }}
        >
          Popular
        </button>
        <button
          onClick={() => setActiveTab('related')}
          style={{
            padding: '0.5rem 1rem',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'related' ? '2px solid var(--accent)' : '2px solid transparent',
            color: activeTab === 'related' ? 'var(--text-primary)' : 'var(--text-muted)',
            fontWeight: activeTab === 'related' ? 600 : 500,
            fontSize: '0.95rem',
            cursor: 'pointer',
          }}
        >
          Related
        </button>
      </div>

      {activeTab === 'curated' && (
        <>
          <div style={{ marginBottom: '1.5rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {genres.map((genre) => {
              const isSelected = selectedGenre === genre;
              const isUserInterest = profile.preferredGenres?.includes(genre as ReadingGenre);
              return (
                <button
                  key={genre}
                  onClick={() => setSelectedGenre(genre)}
                  style={{
                    padding: '0.45rem 0.85rem',
                    borderRadius: 'var(--radius-full)',
                    backgroundColor: isSelected ? 'var(--accent)' : 'var(--bg-surface)',
                    color: isSelected ? 'var(--accent-text)' : 'var(--text-secondary)',
                    border: '1px solid var(--border-subtle)',
                    fontSize: '0.84rem',
                    fontWeight: isSelected ? 600 : 500,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    transition: 'all var(--transition-fast)',
                  }}
                >
                  <span>{genre}</span>
                  {isUserInterest && genre !== 'All' && <span title="Matches your profile interests">✨</span>}
                </button>
              );
            })}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem' }}>
            {filteredFeeds.map((feed) => {
              const isUserGenre = profile.preferredGenres?.includes(feed.genre);
              const isFollowing = followedFeeds.some((item) => item.feedUrl === feed.url);
              return (
                <div
                  key={feed.url}
                  style={{
                    padding: '1.5rem',
                    borderRadius: 'var(--radius-lg)',
                    backgroundColor: 'var(--bg-surface)',
                    border: '1px solid var(--border-subtle)',
                    boxShadow: 'var(--shadow-sm)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    transition: `transform ${currentThemeConfig.animation.transitionDuration}`,
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', gap: '0.5rem' }}>
                      <span
                        style={{
                          fontSize: '0.72rem',
                          fontWeight: 600,
                          padding: '0.2rem 0.55rem',
                          borderRadius: 'var(--radius-sm)',
                          backgroundColor: 'var(--accent-surface)',
                          color: 'var(--accent)',
                        }}
                      >
                        {feed.genre}
                      </span>

                      {isUserGenre && (
                        <span style={{ fontSize: '0.7rem', color: 'var(--accent)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                          <span>✨</span> Matches your interests
                        </span>
                      )}
                    </div>

                    <h3
                      style={{
                        fontFamily: 'var(--font-serif)',
                        fontSize: '1.2rem',
                        fontWeight: 700,
                        color: 'var(--text-primary)',
                        marginBottom: '0.5rem',
                        lineHeight: 1.35,
                      }}
                    >
                      {feed.title}
                    </h3>

                    <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
                      {feed.siteName}
                    </p>

                    <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: '1.25rem' }}>
                      {feed.description}
                    </p>
                  </div>

                  <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                      Public feed · posts are loaded when followed
                    </span>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      {feedValidations[feed.url]?.homepageUrl ? (
                        <a href={feedValidations[feed.url]?.homepageUrl || undefined} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                          Open website ↗
                        </a>
                      ) : (
                        <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                          {feedValidations[feed.url] ? 'Publisher website unavailable' : 'Checking publisher website…'}
                        </span>
                      )}
                      <button
                        onClick={() => isFollowing
                          ? handleUnfollow({ canonicalUrl: feed.url, title: feed.title, host: feed.siteName })
                          : handleFollow({ canonicalUrl: feed.url, title: feed.title, host: feed.siteName }, 'curated')}
                        style={{
                          padding: '0.45rem 0.85rem',
                          borderRadius: 'var(--radius-md)',
                          backgroundColor: 'var(--accent)',
                          color: 'var(--accent-text)',
                          border: 'none',
                          fontWeight: 600,
                          fontSize: '0.82rem',
                          cursor: 'pointer',
                        }}
                      >
                        {isFollowing ? 'Unfollow' : 'Follow Feed'}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {activeTab === 'popular' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          <div style={{ padding: '1.5rem', borderRadius: 'var(--radius-lg)', backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div>
                <h2 style={{ fontSize: '1.2rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>Popular Small Web Feeds</h2>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: '0.25rem 0 0' }}>
                  Counts represent genuine opt-in aggregate contributions. Seed/directory entries are not treated as popularity results.
                </p>
              </div>
              <button onClick={loadPopularFeeds} disabled={isLoadingPopular} style={{ padding: '0.4rem 0.8rem', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--bg-page)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)', fontSize: '0.8rem', cursor: 'pointer' }}>
                {isLoadingPopular ? 'Refreshing…' : '↻ Refresh'}
              </button>
            </div>

            {popularError && (
              <div role="alert" style={{ color: 'var(--danger, #e53e3e)', fontSize: '0.85rem', marginBottom: '0.75rem' }}>
                <p>{popularError}</p>
                <button onClick={loadPopularFeeds} disabled={isLoadingPopular} style={{ marginTop: '0.4rem', padding: '0.35rem 0.7rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)', background: 'var(--bg-page)', color: 'var(--text-primary)', cursor: 'pointer' }}>
                  Try again
                </button>
              </div>
            )}

            {isLoadingPopular && popularFeeds.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Loading popular feeds…</p>
            ) : popularFeeds.length === 0 && !popularError ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No popular feeds recorded yet. You can be the first to contribute below.</p>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem' }}>
                {popularFeeds.map((feed) => {
                  const isFollowing = followedFeeds.some((item) => item.feedUrl === feed.canonicalUrl);
                  return (
                    <div key={feed.canonicalUrl} style={{ padding: '1rem', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--bg-page)', border: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '0.75rem' }}>
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--accent)' }}>{feed.host}</span>
                          {feed.isSeed && (
                            <span style={{ fontSize: '0.65rem', padding: '0.1rem 0.4rem', borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--accent-surface)', color: 'var(--accent)', fontWeight: 600 }}>Seed directory entry</span>
                          )}
                        </div>
                        <h4 style={{ fontSize: '0.95rem', fontWeight: 600, margin: '0 0 0.25rem', color: 'var(--text-primary)' }}>{feed.title || feed.host}</h4>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          {feed.aggregateCount > 0
                            ? `${feed.aggregateCount} genuine opt-in aggregate contribution${feed.aggregateCount === 1 ? '' : 's'}`
                            : 'No genuine aggregate popularity data.'}
                        </span>
                      </div>

                      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                        {feedValidations[feed.canonicalUrl]?.homepageUrl ? (
                          <a href={feedValidations[feed.canonicalUrl]?.homepageUrl || undefined} target="_blank" rel="noopener noreferrer" style={{ padding: '0.35rem 0.7rem', borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--bg-surface)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)', fontSize: '0.78rem', fontWeight: 600, textDecoration: 'none' }}>
                            Open website ↗
                          </a>
                        ) : (
                          <span style={{ padding: '0.35rem 0.7rem', color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                            {feedValidations[feed.canonicalUrl] ? 'Publisher website unavailable' : 'Checking publisher website…'}
                          </span>
                        )}
                        <button
                          onClick={() => isFollowing
                            ? handleUnfollow({ canonicalUrl: feed.canonicalUrl, title: feed.title, host: feed.host })
                            : handleFollow({ canonicalUrl: feed.canonicalUrl, title: feed.title, host: feed.host }, 'popular')}
                          style={{ padding: '0.35rem 0.7rem', borderRadius: 'var(--radius-sm)', backgroundColor: isFollowing ? 'var(--bg-surface)' : 'var(--accent-surface)', color: isFollowing ? 'var(--text-primary)' : 'var(--accent)', border: '1px solid var(--border-subtle)', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer' }}
                        >
                          {isFollowing ? 'Unfollow' : 'Follow'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'related' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          <div style={{ padding: '1.5rem', borderRadius: 'var(--radius-lg)', backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 0.25rem' }}>Find Related Feeds</h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>The feed URLs you follow (or enter below) are sent to the backend for related suggestions. Bookmarks and reading history are not sent. Minimum support k=3 is required for specific co-occurrence reasons; directory fallbacks are labeled as such.</p>

            <form onSubmit={handleQueryRecommendations} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <input type="text" aria-label="Optional feed URLs for related discovery" placeholder="Optional: enter feed URLs separated by commas" value={queryInput} onChange={(e) => setQueryInput(e.target.value)} style={{ padding: '0.65rem 1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', backgroundColor: 'var(--bg-page)', color: 'var(--text-primary)', fontSize: '0.9rem' }} />
              <button type="submit" disabled={isLoadingRecs} style={{ alignSelf: 'flex-start', padding: '0.55rem 1.2rem', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--accent)', color: 'var(--accent-text)', border: 'none', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer' }}>
                {isLoadingRecs ? 'Loading recommendations…' : 'Refresh related feeds'}
              </button>
            </form>

            {isLoadingRecs && recommendations.length === 0 && (
              <p role="status" style={{ marginTop: '0.75rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>Loading related feeds…</p>
            )}
            {recsError && (
              <div role="alert" style={{ marginTop: '0.75rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                <p>{recsError}</p>
                <button type="button" onClick={() => void loadRecommendations(
                  queryInput.trim()
                    ? queryInput.split(/[\n,]+/).map((value) => value.trim()).filter(Boolean)
                    : getFollowedFeeds().map((feed) => feed.feedUrl)
                )} disabled={isLoadingRecs} style={{ marginTop: '0.4rem', padding: '0.35rem 0.7rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)', background: 'var(--bg-page)', color: 'var(--text-primary)', cursor: 'pointer' }}>
                  Try again
                </button>
              </div>
            )}

            {!isLoadingRecs && followedFeeds.length === 0 && !queryInput.trim() && (
              <div style={{ marginTop: '1rem', padding: '1rem', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--bg-page)', color: 'var(--text-secondary)' }}>
                <p>Follow a feed first to get related recommendations. Your bookmarks and reading history are not sent to discovery.</p>
                <button type="button" onClick={() => setActiveTab('popular')} style={{ marginTop: '0.75rem', padding: '0.45rem 0.8rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)', background: 'var(--accent)', color: 'var(--accent-text)', cursor: 'pointer' }}>
                  Browse popular directory
                </button>
              </div>
            )}

            {recommendations.length > 0 && (
              <div style={{ marginTop: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {recommendations.map((rec) => {
                  const isDirectoryFallback = rec.reason.includes('seed directory') || rec.reason.includes('Demo directory entry');
                  const directoryLabel = rec.reason.includes('seed directory') ? 'Curated directory fallback' : 'Demo directory fallback';
                  const validation = feedValidations[rec.canonicalUrl];
                  const websiteUrl = validation?.homepageUrl;
                  const feedIsValid = validation?.feedValid === true;
                  return (
                    <div key={rec.canonicalUrl} style={{ padding: '0.85rem 1.1rem', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--bg-page)', border: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                      <div>
                        <h4 style={{ margin: '0 0 0.2rem', fontSize: '0.92rem', color: 'var(--text-primary)' }}>{rec.title || rec.host}</h4>
                        {isDirectoryFallback && (
                          <span style={{ display: 'inline-block', marginBottom: '0.2rem', padding: '0.1rem 0.4rem', borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--accent-surface)', color: 'var(--accent)', fontSize: '0.65rem', fontWeight: 700 }}>
                            {directoryLabel}
                          </span>
                        )}
                        <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          {rec.reason} {!isDirectoryFallback && rec.supportCount > 0 ? `(aggregate support: ${rec.supportCount})` : ''}
                        </p>
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                        {websiteUrl ? (
                          <a href={websiteUrl} target="_blank" rel="noopener noreferrer" style={{ padding: '0.35rem 0.75rem', borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--bg-surface)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)', fontSize: '0.78rem', fontWeight: 600, textDecoration: 'none' }}>
                            Open website ↗
                          </a>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                            <button type="button" disabled style={{ padding: '0.35rem 0.75rem', borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--bg-surface)', color: 'var(--text-muted)', border: '1px solid var(--border-subtle)', fontSize: '0.78rem', fontWeight: 600, cursor: 'not-allowed', opacity: 0.75 }}>
                              {validation ? 'Website unavailable' : 'Checking website…'}
                            </button>
                            <span style={{ maxWidth: '18rem', color: 'var(--text-muted)', fontSize: '0.68rem' }}>
                              {validation?.reason || 'The feed and publisher website are being verified.'}
                            </span>
                          </div>
                        )}
                        <button
                          type="button"
                          onClick={() => handleFollow(rec, 'recommendation', feedIsValid)}
                          disabled={!feedIsValid}
                          title={!feedIsValid ? validation?.reason || 'Wait for feed verification before following.' : undefined}
                          style={{ padding: '0.35rem 0.75rem', borderRadius: 'var(--radius-sm)', backgroundColor: feedIsValid ? 'var(--accent-surface)' : 'var(--bg-surface)', color: feedIsValid ? 'var(--accent)' : 'var(--text-muted)', border: '1px solid var(--border-subtle)', fontSize: '0.78rem', fontWeight: 600, cursor: feedIsValid ? 'pointer' : 'not-allowed', opacity: feedIsValid ? 1 : 0.7 }}
                        >
                          Follow
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            {!isLoadingRecs && followedFeeds.length > 0 && recommendations.length === 0 && !recsError && (
              <p style={{ marginTop: '1rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                No unfollowed recommendations are available for the feeds you follow yet.
              </p>
            )}
          </div>

          <div style={{ padding: '1.5rem', borderRadius: 'var(--radius-lg)', backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 0.25rem' }}>Contribute to the Independent Web Graph</h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>Contribution is opt-in. The selected feed URLs are sent to the backend and reduced to aggregate counts; bookmarks and reading history are not submitted. Hosting and network providers may process standard connection metadata.</p>

            <form onSubmit={handleSubmitContribution} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <input type="text" placeholder="Optional feed URLs (blank uses feeds you follow)" value={submitFeedsInput} onChange={(e) => setSubmitFeedsInput(e.target.value)} style={{ padding: '0.65rem 1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', backgroundColor: 'var(--bg-page)', color: 'var(--text-primary)', fontSize: '0.9rem' }} />

              <label style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '0.85rem', color: 'var(--text-primary)', cursor: 'pointer' }}>
                <input type="checkbox" checked={consentGiven} onChange={(e) => {
                  setConsentGiven(e.target.checked);
                  setDiscoveryConsent(e.target.checked);
                }} />
                <span>I opt in to sending my selected feed list for aggregate discovery contributions. Change this setting any time in Settings.</span>
              </label>

              <button type="submit" disabled={!consentGiven || isSubmitting} style={{ alignSelf: 'flex-start', padding: '0.55rem 1.2rem', borderRadius: 'var(--radius-md)', backgroundColor: consentGiven ? 'var(--accent)' : 'var(--bg-surface)', color: consentGiven ? 'var(--accent-text)' : 'var(--text-muted)', border: '1px solid var(--border-subtle)', fontWeight: 600, fontSize: '0.85rem', cursor: consentGiven ? 'pointer' : 'not-allowed', opacity: consentGiven ? 1 : 0.6 }}>
                {isSubmitting ? 'Submitting…' : 'Contribute Anonymously'}
              </button>
            </form>

            {submitResult && <p style={{ marginTop: '0.75rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{submitResult}</p>}
          </div>
        </div>
      )}

      <div style={{ textAlign: 'center', marginTop: '2.5rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
        Your follows are saved in this browser. Reading history and article cache stay local; discovery contribution is a separate opt-in action.
      </div>
    </div>
  );
};
