import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { AppView, DailyReadingStats, ReadingGoal, HistoryEntry, Bookmark, UserProfile, FeedArticle } from '../../types/article';
import {
  getDailyStats,
  getTodayStats,
  getCurrentStreak,
  getReadingGoal,
  getHistory,
  getBookmarks,
  getUserProfile,
  getFollowedFeeds,
  followFeed,
  getFeedArticles,
  getUnreadFeedArticles,
  isArticleRead,
} from '../../utils/storage';
import { useTheme } from '../theme/ThemeProvider';
import { discoverAndFetchFeed, refreshFollowedFeeds } from '../../services/feedService';
import { listCachedArticles } from '../../utils/offlineStore';

export interface DashboardViewProps {
  onStartReading?: () => void;
  onSelectArticleUrl?: (url: string) => void;
  onNavigateToView?: (view: AppView) => void;
  onNotify?: (message: string, type?: 'success' | 'error' | 'info') => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  onStartReading,
  onSelectArticleUrl,
  onNavigateToView,
  onNotify,
}) => {
  const { currentThemeConfig, isReducedMotion } = useTheme();

  const [stats, setStats] = useState<DailyReadingStats[]>([]);
  const [today, setToday] = useState<DailyReadingStats>({ date: '', articlesRead: 0, minutesRead: 0, wordsRead: 0 });
  const [streak, setStreak] = useState(0);
  const [goal, setGoal] = useState<ReadingGoal>({ dailyArticles: 3, dailyMinutes: 30, weeklyArticles: 15, streakTarget: 7 });
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [profile, setProfile] = useState<UserProfile>(() => getUserProfile());
  const [followedFeedCount, setFollowedFeedCount] = useState(0);
  const [feedArticles, setFeedArticles] = useState<FeedArticle[]>([]);
  const [unreadArticleCount, setUnreadArticleCount] = useState(0);
  const [cachedArticleCount, setCachedArticleCount] = useState(0);
  const [cacheError, setCacheError] = useState<string | null>(null);
  const [showAddBlog, setShowAddBlog] = useState(false);
  const [blogUrl, setBlogUrl] = useState('');
  const [isAddingBlog, setIsAddingBlog] = useState(false);
  const [feedMessage, setFeedMessage] = useState<string | null>(null);
  const [isRefreshingFeeds, setIsRefreshingFeeds] = useState(false);

  useEffect(() => {
    setStats(getDailyStats());
    setToday(getTodayStats());
    setStreak(getCurrentStreak());
    setGoal(getReadingGoal());
    setHistory(getHistory());
    setBookmarks(getBookmarks());
    setProfile(getUserProfile());
    setFollowedFeedCount(getFollowedFeeds().length);
    setFeedArticles(getFeedArticles());
    setUnreadArticleCount(getUnreadFeedArticles().length);
    void listCachedArticles()
      .then((articles) => setCachedArticleCount(articles.length))
      .catch(() => setCacheError('Cached article count is unavailable in this browser.'));
  }, []);

  const handleAddBlog = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsAddingBlog(true);
    setFeedMessage(null);
    try {
      const discovered = await discoverAndFetchFeed(blogUrl.trim());
      const host = new URL(discovered.feedUrl).hostname;
      const alreadyFollowing = getFollowedFeeds().some((feed) => feed.feedUrl === discovered.feedUrl);
      followFeed({
        feedUrl: discovered.feedUrl,
        title: discovered.title,
        host,
        source: 'manual',
      });
      setFollowedFeedCount(getFollowedFeeds().length);
      setFeedArticles(getFeedArticles());
      setUnreadArticleCount(getUnreadFeedArticles().length);
      setBlogUrl('');
      setShowAddBlog(false);
      const message = alreadyFollowing
        ? `You already follow ${discovered.title}; its feed was refreshed.`
        : `Following ${discovered.title}. Loaded ${discovered.articles.length} articles.`;
      setFeedMessage(message);
      onNotify?.(message, alreadyFollowing ? 'info' : 'success');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not discover this blog’s feed.';
      setFeedMessage(message);
      onNotify?.(message, 'error');
    } finally {
      setIsAddingBlog(false);
    }
  };

  const handleRefreshFeeds = async () => {
    const feeds = getFollowedFeeds();
    if (feeds.length === 0) {
      setFeedMessage('Follow a feed before refreshing your reading timeline.');
      return;
    }
    setIsRefreshingFeeds(true);
    setFeedMessage(null);
    try {
      const result = await refreshFollowedFeeds(feeds);
      setFeedArticles(getFeedArticles());
      setUnreadArticleCount(getUnreadFeedArticles().length);
      const summary = `${result.fetched} articles refreshed from ${feeds.length - result.failed.length} feeds.`;
      setFeedMessage(result.failed.length > 0 ? `${summary} ${result.failed.length} feed(s) could not be refreshed.` : summary);
      if (result.failed.length > 0) onNotify?.(`${summary} ${result.failed.join(' ')}`, 'error');
      else onNotify?.(summary, 'success');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not refresh followed feeds.';
      setFeedMessage(message);
      onNotify?.(message, 'error');
    } finally {
      setIsRefreshingFeeds(false);
    }
  };

  const totalArticles = stats.reduce((acc, s) => acc + s.articlesRead, 0);
  const totalMinutes = stats.reduce((acc, s) => acc + s.minutesRead, 0);
  const totalWords = stats.reduce((acc, s) => acc + s.wordsRead, 0);

  // Time-based greeting
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  // Past 7 days calculation
  const last7Days: { dateStr: string; label: string; count: number }[] = [];
  const now = new Date();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);
    const dayLabel = d.toLocaleDateString(undefined, { weekday: 'short' });
    const match = stats.find((s) => s.date === dateStr);
    last7Days.push({
      dateStr,
      label: dayLabel,
      count: match ? match.articlesRead : 0,
    });
  }

  const weeklyArticlesRead = last7Days.reduce((acc, d) => acc + d.count, 0);
  const weeklyGoalTarget = goal.weeklyArticles || (goal.dailyArticles * 5) || 15;
  const weeklyGoalPercent = Math.min(100, Math.round((weeklyArticlesRead / Math.max(1, weeklyGoalTarget)) * 100));

  const maxCount = Math.max(1, ...last7Days.map((d) => d.count));
  const goalProgress = Math.min(100, Math.round((today.articlesRead / Math.max(1, goal.dailyArticles)) * 100));

  // Recent 3 history entries for Continue Reading
  const continueReadingEntries = history.slice(0, 3);
  const timelineByUrl = new Map<string, { url: string; title: string; siteName?: string | null; date: string; source: 'feed' | 'history' }>();
  for (const item of feedArticles) {
    timelineByUrl.set(item.url, {
      url: item.url,
      title: item.title,
      siteName: item.siteName,
      date: item.publishedAt || item.fetchedAt,
      source: 'feed',
    });
  }
  for (const item of history) {
    const current = timelineByUrl.get(item.url);
    timelineByUrl.set(item.url, {
      url: item.url,
      title: item.title,
      siteName: item.siteName || current?.siteName,
      date: item.visitedAt,
      source: 'history',
    });
  }
  const timelineItems = [...timelineByUrl.values()]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 10);

  // Animation variants
  const containerVariants = isReducedMotion
    ? { hidden: {}, visible: {} }
    : {
        hidden: { opacity: 0 },
        visible: {
          opacity: 1,
          transition: { staggerChildren: 0.08, delayChildren: 0.05 },
        },
      };

  const itemVariants = isReducedMotion
    ? { hidden: {}, visible: {} }
    : {
        hidden: { opacity: 0, y: 12 },
        visible: { opacity: 1, y: 0, transition: { duration: 0.3 } },
      };

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '2.5rem 1.5rem', width: '100%' }}>
      {/* 1. Personalized Welcome Section */}
      <motion.div
        variants={itemVariants}
        initial="hidden"
        animate="visible"
        style={{
          marginBottom: '2.5rem',
          padding: '2rem',
          borderRadius: 'var(--radius-lg)',
          backgroundColor: 'var(--bg-surface)',
          border: '1px solid var(--border-subtle)',
          boxShadow: 'var(--shadow-sm)',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1.5rem',
        }}
      >
        <div style={{ flex: 1, minWidth: '260px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem' }}>
            <span style={{ fontSize: '1.2rem' }}>{profile.avatar || '✨'}</span>
            <span
              style={{
                fontSize: '0.82rem',
                fontWeight: 600,
                textTransform: 'uppercase',
                color: 'var(--text-muted)',
                letterSpacing: '0.05em',
              }}
            >
              {getGreeting()}, {profile.displayName || 'Reader'}
            </span>
          </div>

          <h1
            style={{
              fontFamily: 'var(--font-serif)',
              fontSize: '2.2rem',
              fontWeight: 700,
              color: 'var(--text-primary)',
              lineHeight: 1.2,
              marginBottom: '0.5rem',
            }}
          >
            Your next great read is waiting.
          </h1>

          <p style={{ color: 'var(--text-secondary)', fontSize: '0.96rem', margin: 0 }}>
            {totalArticles === 0
              ? 'Welcome to your private reading sanctuary. Paste any article URL to begin distraction-free reading.'
              : `You have completed ${totalArticles} ${totalArticles === 1 ? 'article' : 'articles'} so far. Today's goal: ${goal.dailyArticles} articles (${goal.dailyMinutes} min).`}
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => setShowAddBlog((visible) => !visible)}
            style={{ padding: '0.7rem 0.95rem', borderRadius: 'var(--radius-md)', background: 'var(--bg-surface)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)', fontWeight: 600, fontSize: '0.9rem', cursor: 'pointer' }}
          >
            + Add Blog
          </button>
          <button
            onClick={() => continueReadingEntries[0]
              ? onSelectArticleUrl?.(continueReadingEntries[0].url)
              : onStartReading?.()}
            style={{
              padding: '0.75rem 1.4rem',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--accent)',
              color: 'var(--accent-text)',
              fontWeight: 600,
              fontSize: '0.95rem',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              boxShadow: 'var(--shadow-sm)',
              transition: 'transform var(--transition-fast)',
            }}
          >
            <span>📖</span>
            <span>{continueReadingEntries[0] ? 'Continue Reading' : 'Read an Article'}</span>
          </button>
          <button
            type="button"
            onClick={() => onNavigateToView?.('discover')}
            style={{ padding: '0.7rem 0.95rem', borderRadius: 'var(--radius-md)', background: 'var(--accent-surface)', color: 'var(--accent)', border: '1px solid var(--border-subtle)', fontWeight: 600, fontSize: '0.9rem', cursor: 'pointer' }}
          >
            Discover
          </button>
        </div>
      </motion.div>

      {showAddBlog && (
        <form onSubmit={handleAddBlog} style={{ marginBottom: '1.5rem', padding: '1.25rem', borderRadius: 'var(--radius-lg)', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
          <label htmlFor="add-blog-url" style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-primary)', fontWeight: 600 }}>Add a blog or RSS/Atom feed</label>
          <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
            <input id="add-blog-url" type="url" required value={blogUrl} onChange={(event) => setBlogUrl(event.target.value)} placeholder="https://example.org" style={{ flex: '1 1 260px', minWidth: 0, padding: '0.65rem 0.8rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', background: 'var(--bg-page)', color: 'var(--text-primary)' }} />
            <button type="submit" disabled={isAddingBlog} style={{ padding: '0.65rem 1rem', borderRadius: 'var(--radius-md)', background: 'var(--accent)', color: 'var(--accent-text)', border: 0, fontWeight: 600, cursor: isAddingBlog ? 'wait' : 'pointer' }}>
              {isAddingBlog ? 'Finding feed…' : 'Discover feed'}
            </button>
          </div>
          <p style={{ marginTop: '0.55rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>The public page is checked for its RSS or Atom feed through the safe fetch API. Your subscription is saved on this device.</p>
        </form>
      )}
      {feedMessage && <p role="status" style={{ marginBottom: '1rem', color: 'var(--text-secondary)', fontSize: '0.88rem' }}>{feedMessage}</p>}

      <section aria-label="Reading home overview" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.8rem', marginBottom: '2rem' }}>
        {[
          { label: 'Followed blogs', value: followedFeedCount, icon: '◇' },
          { label: 'Unread articles', value: unreadArticleCount, icon: '○' },
          { label: 'Offline articles', value: cachedArticleCount, icon: '↓' },
        ].map((metric) => (
          <div key={metric.label} style={{ padding: '1rem 1.1rem', borderRadius: 'var(--radius-lg)', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 600 }}>
              <span>{metric.label}</span><span aria-hidden="true">{metric.icon}</span>
            </div>
            <div style={{ marginTop: '0.25rem', color: 'var(--text-primary)', fontSize: '1.8rem', fontWeight: 700 }}>{metric.value}</div>
          </div>
        ))}
      </section>
      {cacheError && <p role="alert" style={{ margin: '-1.5rem 0 1.5rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>{cacheError}</p>}

      {/* Heading for Personal Analytics (Maintains test compatibility) */}
      <div style={{ marginBottom: '1.25rem' }}>
        <span
          style={{
            fontSize: '0.8rem',
            fontWeight: 600,
            textTransform: 'uppercase',
            color: 'var(--text-muted)',
            letterSpacing: '0.05em',
          }}
        >
          Personal Analytics
        </span>
        <h2
          style={{
            fontFamily: 'var(--font-serif)',
            fontSize: '1.6rem',
            fontWeight: 700,
            color: 'var(--text-primary)',
            marginTop: '0.2rem',
          }}
        >
          Reading Dashboard
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
          Accurate metrics calculated from your real reading sessions. Zero tracking.
        </p>
      </div>

      {/* 2. Reading Overview Cards (5 Stat Cards) */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
          gap: '1rem',
          marginBottom: '2.5rem',
        }}
      >
        {/* Card 1: Total Articles */}
        <motion.div
          variants={itemVariants}
          style={{
            padding: '1.25rem',
            borderRadius: 'var(--radius-lg)',
            backgroundColor: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>Total Articles</span>
            <span style={{ fontSize: '1.1rem' }}>📚</span>
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '0.35rem' }}>
            {totalArticles}
          </div>
          <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
            {totalArticles === 0 ? 'No reads yet' : 'Articles extracted'}
          </span>
        </motion.div>

        {/* Card 2: Total Reading Time */}
        <motion.div
          variants={itemVariants}
          style={{
            padding: '1.25rem',
            borderRadius: 'var(--radius-lg)',
            backgroundColor: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>Time Read</span>
            <span style={{ fontSize: '1.1rem' }}>⏱️</span>
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '0.35rem' }}>
            {totalMinutes} <span style={{ fontSize: '0.95rem', fontWeight: 500, color: 'var(--text-muted)' }}>min</span>
          </div>
          <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
            {totalMinutes === 0 ? '0 minutes' : 'Estimated immersion'}
          </span>
        </motion.div>

        {/* Card 3: Words Read */}
        <motion.div
          variants={itemVariants}
          style={{
            padding: '1.25rem',
            borderRadius: 'var(--radius-lg)',
            backgroundColor: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>Words Read</span>
            <span style={{ fontSize: '1.1rem' }}>✍️</span>
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '0.35rem' }}>
            {totalWords >= 1000 ? `${(totalWords / 1000).toFixed(1)}k` : totalWords}
          </div>
          <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
            {totalWords === 0 ? 'Start reading' : 'Words absorbed'}
          </span>
        </motion.div>

        {/* Card 4: Bookmarked Articles */}
        <motion.div
          variants={itemVariants}
          style={{
            padding: '1.25rem',
            borderRadius: 'var(--radius-lg)',
            backgroundColor: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>Bookmarks</span>
            <span style={{ fontSize: '1.1rem' }}>🔖</span>
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '0.35rem' }}>
            {bookmarks.length}
          </div>
          <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>Saved in library</span>
        </motion.div>

        {/* Card 5: Daily Streak */}
        <motion.div
          variants={itemVariants}
          style={{
            padding: '1.25rem',
            borderRadius: 'var(--radius-lg)',
            backgroundColor: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>Daily Streak</span>
            <span style={{ fontSize: '1.1rem' }}>🔥</span>
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 700, color: streak > 0 ? '#F59E0B' : 'var(--text-primary)', marginTop: '0.35rem' }}>
            {streak} <span style={{ fontSize: '1.1rem' }}>🔥</span>
          </div>
          <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
            {streak === 0 ? 'Read today to start' : `${streak} consecutive days`}
          </span>
        </motion.div>
      </motion.div>

      {/* 3. Goal Progress & Weekly Target */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem', marginBottom: '2.5rem' }}>
        {/* Today's Goal Progress */}
        <div
          style={{
            padding: '1.5rem',
            borderRadius: 'var(--radius-lg)',
            backgroundColor: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <div>
              <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
                Today's Goal Progress
              </h3>
              <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                {today.articlesRead} of {goal.dailyArticles} articles read today
              </span>
            </div>
            <span style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--accent)' }}>{goalProgress}%</span>
          </div>

          <div
            style={{
              width: '100%',
              height: '8px',
              backgroundColor: 'var(--bg-surface-elevated)',
              borderRadius: 'var(--radius-full)',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                width: `${goalProgress}%`,
                height: '100%',
                backgroundColor: 'var(--accent)',
                transition: `width ${currentThemeConfig.animation.transitionDuration}`,
              }}
            />
          </div>
        </div>

        {/* Weekly Goal Progress */}
        <div
          style={{
            padding: '1.5rem',
            borderRadius: 'var(--radius-lg)',
            backgroundColor: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <div>
              <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
                Weekly Reading Goal
              </h3>
              <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                {weeklyArticlesRead} of {weeklyGoalTarget} articles this week
              </span>
            </div>
            <span style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--accent)' }}>{weeklyGoalPercent}%</span>
          </div>

          <div
            style={{
              width: '100%',
              height: '8px',
              backgroundColor: 'var(--bg-surface-elevated)',
              borderRadius: 'var(--radius-full)',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                width: `${weeklyGoalPercent}%`,
                height: '100%',
                backgroundColor: 'var(--accent)',
                transition: `width ${currentThemeConfig.animation.transitionDuration}`,
              }}
            />
          </div>
        </div>
      </div>

      {/* 4. Continue Reading Section */}
      <div style={{ marginBottom: '2.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <div>
            <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.35rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
              Continue Reading
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: 0 }}>
              Resume recently opened articles with your saved reading position.
            </p>
          </div>

          {history.length > 0 && onNavigateToView && (
            <button
              onClick={() => onNavigateToView('history')}
              style={{
                backgroundColor: 'transparent',
                border: 'none',
                color: 'var(--accent)',
                fontSize: '0.85rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              View Full History →
            </button>
          )}
        </div>

        {continueReadingEntries.length > 0 ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
            {continueReadingEntries.map((item) => {
              const progress = item.readProgress || 0;
              return (
                <div
                  key={item.id}
                  style={{
                    padding: '1.25rem',
                    borderRadius: 'var(--radius-lg)',
                    backgroundColor: 'var(--bg-surface)',
                    border: '1px solid var(--border-subtle)',
                    boxShadow: 'var(--shadow-sm)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                        {item.siteName || 'Web Article'}
                      </span>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                        {new Date(item.visitedAt).toLocaleDateString()}
                      </span>
                    </div>

                    <h4
                      onClick={() => onSelectArticleUrl?.(item.url)}
                      style={{
                        fontFamily: 'var(--font-serif)',
                        fontSize: '1.05rem',
                        fontWeight: 600,
                        color: 'var(--text-primary)',
                        marginBottom: '0.75rem',
                        cursor: 'pointer',
                        lineHeight: 1.35,
                      }}
                    >
                      {item.title}
                    </h4>
                  </div>

                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
                      <span>Progress</span>
                      <span>{progress > 0 ? `${progress}% read` : 'Just started'}</span>
                    </div>

                    <div style={{ width: '100%', height: '6px', backgroundColor: 'var(--bg-surface-elevated)', borderRadius: 'var(--radius-full)', overflow: 'hidden', marginBottom: '1rem' }}>
                      <div style={{ width: `${Math.max(5, progress)}%`, height: '100%', backgroundColor: 'var(--accent)' }} />
                    </div>

                    <button
                      onClick={() => onSelectArticleUrl?.(item.url)}
                      style={{
                        width: '100%',
                        padding: '0.5rem',
                        borderRadius: 'var(--radius-md)',
                        backgroundColor: 'var(--accent-surface)',
                        color: 'var(--accent)',
                        border: '1px solid var(--border-subtle)',
                        fontWeight: 600,
                        fontSize: '0.85rem',
                        cursor: 'pointer',
                      }}
                    >
                      Continue Reading →
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div
            style={{
              padding: '3rem 2rem',
              textAlign: 'center',
              backgroundColor: 'var(--bg-surface)',
              borderRadius: 'var(--radius-lg)',
              border: '1px dashed var(--border-subtle)',
            }}
          >
            <span style={{ fontSize: '2.4rem', display: 'block', marginBottom: '0.75rem' }}>📖</span>
            <h4 style={{ fontSize: '1.15rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.35rem' }}>
              No articles in progress
            </h4>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', maxWidth: '380px', margin: '0 auto 1.25rem' }}>
              When you open and read web articles, your reading progress is automatically remembered here.
            </p>
            <button
              onClick={() => onStartReading?.()}
              style={{
                padding: '0.6rem 1.25rem',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--accent)',
                color: 'var(--accent-text)',
                fontWeight: 600,
                fontSize: '0.88rem',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              Start Reading Now
            </button>
          </div>
        )}
      </div>

      <section aria-label="Recent reading timeline" style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap', marginBottom: '0.85rem' }}>
          <div>
            <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.35rem', color: 'var(--text-primary)' }}>Your reading timeline</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Feed posts and articles you opened, sorted by their latest available date.</p>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button type="button" onClick={() => setShowAddBlog(true)} style={{ padding: '0.45rem 0.75rem', borderRadius: 'var(--radius-sm)', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)', fontWeight: 600, cursor: 'pointer' }}>Add Blog</button>
            <button type="button" onClick={() => void handleRefreshFeeds()} disabled={isRefreshingFeeds || followedFeedCount === 0} style={{ padding: '0.45rem 0.75rem', borderRadius: 'var(--radius-sm)', background: 'var(--accent-surface)', border: '1px solid var(--border-subtle)', color: 'var(--accent)', fontWeight: 600, cursor: isRefreshingFeeds ? 'wait' : 'pointer' }}>
              {isRefreshingFeeds ? 'Refreshing…' : 'Refresh feeds'}
            </button>
          </div>
        </div>
        {timelineItems.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            {timelineItems.map((item) => {
              const isRead = isArticleRead(item.url);
              return (
                <article key={item.url} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap', padding: '0.9rem 1rem', borderRadius: 'var(--radius-md)', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                      <span>{item.siteName || 'Independent web'}</span>
                      <span>·</span>
                      <span>{new Date(item.date).toLocaleDateString()}</span>
                      <span>{isRead ? 'Read' : 'Unread'}</span>
                    </div>
                    <h3 style={{ marginTop: '0.25rem', color: 'var(--text-primary)', fontFamily: 'var(--font-serif)', fontSize: '1rem', overflowWrap: 'anywhere' }}>{item.title}</h3>
                  </div>
                  <button type="button" onClick={() => onSelectArticleUrl?.(item.url)} style={{ padding: '0.45rem 0.75rem', borderRadius: 'var(--radius-sm)', background: 'var(--accent)', color: 'var(--accent-text)', border: 0, fontWeight: 600, cursor: 'pointer' }}>
                    {item.source === 'history' ? 'Continue reading' : 'Open article'}
                  </button>
                </article>
              );
            })}
          </div>
        ) : (
          <div style={{ padding: '2rem 1.25rem', textAlign: 'center', borderRadius: 'var(--radius-lg)', background: 'var(--bg-surface)', border: '1px dashed var(--border-subtle)' }}>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>Your timeline is ready for independent writing.</p>
            <button type="button" onClick={() => setShowAddBlog(true)} style={{ padding: '0.55rem 0.9rem', borderRadius: 'var(--radius-md)', background: 'var(--accent)', color: 'var(--accent-text)', border: 0, fontWeight: 600, cursor: 'pointer' }}>Add your first blog</button>
          </div>
        )}
      </section>

      {/* 5. 7-Day Reading Chart */}
      <div
        style={{
          padding: '1.5rem',
          borderRadius: 'var(--radius-lg)',
          backgroundColor: 'var(--bg-surface)',
          border: '1px solid var(--border-subtle)',
          marginBottom: '2rem',
        }}
      >
        <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '1.25rem' }}>
          Weekly Reading Activity (Articles / Day)
        </h3>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', height: '140px', gap: '0.75rem', paddingTop: '1rem' }}>
          {last7Days.map((d) => {
            const heightPercent = Math.max(8, (d.count / maxCount) * 100);
            return (
              <div key={d.dateStr} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end', gap: '0.4rem' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: d.count > 0 ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                  {d.count}
                </span>
                <div
                  style={{
                    width: '100%',
                    maxWidth: '40px',
                    height: `${heightPercent}%`,
                    backgroundColor: d.count > 0 ? 'var(--accent)' : 'var(--bg-surface-elevated)',
                    borderRadius: 'var(--radius-sm) var(--radius-sm) 0 0',
                    transition: `height ${currentThemeConfig.animation.transitionDuration}`,
                  }}
                  title={`${d.count} articles read on ${d.dateStr}`}
                />
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{d.label}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
