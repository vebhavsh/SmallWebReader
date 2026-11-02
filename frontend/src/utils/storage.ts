/**
 * SmallWebReader — Local Storage Persistence for Guest Features
 * Bookmarks, history, reading stats, preferences, and onboarding state.
 * All data stays in the browser. No backend calls.
 */

import {
  Bookmark,
  FollowedFeed,
  HistoryEntry,
  DailyReadingStats,
  FeedArticle,
  ReadingGoal,
  UserProfile,
} from '../types/article';

const KEYS = {
  bookmarks: 'swr_bookmarks_v1',
  history: 'swr_history_v1',
  stats: 'swr_daily_stats_v1',
  goals: 'swr_goals_v1',
  streakAnchor: 'swr_streak_anchor_v1',
  onboardingCompleted: 'swr_onboarding_completed_v1',
  userProfile: 'swr_user_profile_v1',
  readUrlsToday: 'swr_read_urls_today_v1',
  followedFeeds: 'swr_followed_feeds_v1',
  feedArticles: 'swr_feed_articles_v1',
  readArticles: 'swr_read_articles_v1',
  discoveryConsent: 'swr_discovery_consent_v1',
} as const;

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function write<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage quota exceeded or unavailable
  }
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/* -------------------------------------------------------------------------
   Onboarding State & User Profile
   ------------------------------------------------------------------------- */

export const DEFAULT_USER_PROFILE: UserProfile = {
  displayName: 'Guest Reader',
  username: 'guest_reader',
  avatar: '📚',
  preferredGenres: ['Technology', 'Literature', 'Philosophy'],
  readingStyle: 'deep-focus',
  preferredTheme: 'editorial-zen',
  soundtrack: 'Zen Flute & Gentle Rain',
  readingGoal: { dailyArticles: 3, dailyMinutes: 30 },
  accountType: 'guest',
};

export function isOnboardingCompleted(): boolean {
  return read<boolean>(KEYS.onboardingCompleted, false);
}

export function setOnboardingCompleted(completed: boolean): void {
  write(KEYS.onboardingCompleted, completed);
}

export function getUserProfile(): UserProfile {
  return read<UserProfile>(KEYS.userProfile, DEFAULT_USER_PROFILE);
}

export function saveUserProfile(updates: Partial<UserProfile>): UserProfile {
  const current = getUserProfile();
  const updated: UserProfile = { ...current, ...updates };
  write(KEYS.userProfile, updated);
  // Also synchronize legacy username/goals if needed
  if (updates.displayName) {
    try {
      localStorage.setItem('swr_user_name', updates.displayName);
    } catch {
      // Ignore
    }
  }
  if (updates.readingGoal) {
    setReadingGoal(updates.readingGoal);
  }
  return updated;
}

export function resetOnboardingPreferences(): void {
  write(KEYS.onboardingCompleted, false);
  write(KEYS.userProfile, DEFAULT_USER_PROFILE);
}

/* -------------------------------------------------------------------------
   Bookmarks
   ------------------------------------------------------------------------- */

export function getBookmarks(): Bookmark[] {
  return read<Bookmark[]>(KEYS.bookmarks, []);
}

export function addBookmark(bookmark: Omit<Bookmark, 'id' | 'savedAt'>): Bookmark {
  const items = getBookmarks();
  const existing = items.find((b) => b.url === bookmark.url);
  if (existing) return existing;

  const entry: Bookmark = {
    ...bookmark,
    id: generateId(),
    savedAt: new Date().toISOString(),
  };
  items.unshift(entry);
  write(KEYS.bookmarks, items.slice(0, 500));
  return entry;
}

export function removeBookmark(url: string): void {
  const items = getBookmarks().filter((b) => b.url !== url);
  write(KEYS.bookmarks, items);
}

export function isBookmarked(url: string): boolean {
  return getBookmarks().some((b) => b.url === url);
}

/* -------------------------------------------------------------------------
   Followed Feeds (Local Discovery Subscriptions)
   ------------------------------------------------------------------------- */

export function getFollowedFeeds(): FollowedFeed[] {
  const stored = read<Array<FollowedFeed & { url?: string }>>(KEYS.followedFeeds, []);
  return stored.flatMap((item) => {
    const feedUrl = item.feedUrl || item.url;
    if (!feedUrl) return [];
    const feed = { ...item };
    delete feed.url;
    return [{ ...feed, feedUrl, homepageUrl: item.homepageUrl || null }];
  });
}

export function isFollowingFeed(feedUrl: string): boolean {
  return getFollowedFeeds().some((feed) => feed.feedUrl === feedUrl);
}

export function followFeed(feed: { feedUrl: string; homepageUrl?: string | null; title?: string | null; host?: string | null; source?: 'popular' | 'recommendation' | 'curated' | 'manual' }): FollowedFeed {
  const items = getFollowedFeeds();
  const existing = items.find((item) => item.feedUrl === feed.feedUrl);
  if (existing) {
    if (feed.homepageUrl && existing.homepageUrl !== feed.homepageUrl) {
      return updateFollowedFeedHomepage(feed.feedUrl, feed.homepageUrl) || existing;
    }
    return existing;
  }

  const entry: FollowedFeed = {
    ...feed,
    homepageUrl: feed.homepageUrl || null,
    followedAt: new Date().toISOString(),
  };
  items.unshift(entry);
  write(KEYS.followedFeeds, items.slice(0, 500));
  return entry;
}

export function updateFollowedFeedHomepage(feedUrl: string, homepageUrl: string): FollowedFeed | undefined {
  try {
    const parsed = new URL(homepageUrl);
    if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) return undefined;
  } catch {
    return undefined;
  }
  const items = getFollowedFeeds();
  const updated = items.map((feed) => feed.feedUrl === feedUrl ? { ...feed, homepageUrl } : feed);
  const result = updated.find((feed) => feed.feedUrl === feedUrl);
  if (result) write(KEYS.followedFeeds, updated);
  return result;
}

export function unfollowFeed(feedUrl: string): void {
  const items = getFollowedFeeds().filter((feed) => feed.feedUrl !== feedUrl);
  write(KEYS.followedFeeds, items);
}

export function getFeedArticles(): FeedArticle[] {
  return read<FeedArticle[]>(KEYS.feedArticles, []).sort((a, b) => {
    const dateA = a.publishedAt ? new Date(a.publishedAt).getTime() : new Date(a.fetchedAt).getTime();
    const dateB = b.publishedAt ? new Date(b.publishedAt).getTime() : new Date(b.fetchedAt).getTime();
    return dateB - dateA;
  });
}

export function saveFeedArticles(articles: FeedArticle[]): void {
  const existing = new Map(getFeedArticles().map((article) => [article.url, article]));
  for (const article of articles) {
    existing.set(article.url, article);
  }
  write(KEYS.feedArticles, [...existing.values()].slice(0, 2000));
}

export function isArticleRead(url: string): boolean {
  return read<string[]>(KEYS.readArticles, []).includes(url);
}

export function setArticleRead(url: string, isRead: boolean): void {
  const readUrls = new Set(read<string[]>(KEYS.readArticles, []));
  if (isRead) {
    readUrls.add(url);
  } else {
    readUrls.delete(url);
  }
  write(KEYS.readArticles, [...readUrls]);
}

export function getUnreadFeedArticles(): FeedArticle[] {
  const readUrls = new Set(read<string[]>(KEYS.readArticles, []));
  return getFeedArticles().filter((article) => !readUrls.has(article.url));
}

export function getDiscoveryConsent(): boolean {
  return read<boolean>(KEYS.discoveryConsent, false);
}

export function setDiscoveryConsent(consent: boolean): void {
  write(KEYS.discoveryConsent, consent);
}

/* -------------------------------------------------------------------------
   Reading History
   ------------------------------------------------------------------------- */

export function getHistory(): HistoryEntry[] {
  return read<HistoryEntry[]>(KEYS.history, []);
}

export function addHistoryEntry(entry: Omit<HistoryEntry, 'id' | 'visitedAt'>): HistoryEntry {
  const items = getHistory();
  const filtered = items.filter((h) => h.url !== entry.url);

  const newEntry: HistoryEntry = {
    ...entry,
    id: generateId(),
    visitedAt: new Date().toISOString(),
  };
  filtered.unshift(newEntry);
  write(KEYS.history, filtered.slice(0, 1000));
  return newEntry;
}

export function clearHistory(): void {
  write(KEYS.history, []);
}

/* -------------------------------------------------------------------------
   Daily Stats
   ------------------------------------------------------------------------- */

export function getDailyStats(): DailyReadingStats[] {
  return read<DailyReadingStats[]>(KEYS.stats, []);
}

export function getTodayStats(): DailyReadingStats {
  const all = getDailyStats();
  const today = todayKey();
  return all.find((s) => s.date === today) || { date: today, articlesRead: 0, minutesRead: 0, wordsRead: 0 };
}

export function getTodayReadUrls(): string[] {
  const data = read<{ date: string; urls: string[] }>(KEYS.readUrlsToday, { date: todayKey(), urls: [] });
  if (data.date !== todayKey()) {
    return [];
  }
  return data.urls || [];
}

export function isArticleReadToday(url: string): boolean {
  return getTodayReadUrls().includes(url);
}

export function recordArticleRead(wordCount: number, minutesRead: number, url?: string): boolean {
  if (url) {
    const readUrls = getTodayReadUrls();
    if (readUrls.includes(url)) {
      return false; // Already recorded this article URL today — deduplicate
    }
    const updatedUrls = [...readUrls, url];
    write(KEYS.readUrlsToday, { date: todayKey(), urls: updatedUrls });
  }

  const all = getDailyStats();
  const today = todayKey();
  const idx = all.findIndex((s) => s.date === today);

  if (idx >= 0) {
    all[idx].articlesRead += 1;
    all[idx].minutesRead += minutesRead;
    all[idx].wordsRead += wordCount;
  } else {
    all.unshift({ date: today, articlesRead: 1, minutesRead, wordsRead: wordCount });
  }
  write(KEYS.stats, all.slice(0, 365));
  write(KEYS.streakAnchor, today);
  return true;
}

export function getCurrentStreak(): number {
  const stats = getDailyStats();
  if (stats.length === 0) return 0;

  let streak = 0;
  const now = new Date();

  for (let i = 0; i < 365; i++) {
    const checkDate = new Date(now);
    checkDate.setDate(now.getDate() - i);
    const key = checkDate.toISOString().slice(0, 10);

    const found = stats.find((s) => s.date === key && s.articlesRead > 0);
    if (found) {
      streak++;
    } else if (i > 0) {
      break;
    } else {
      break;
    }
  }
  return streak;
}

/* -------------------------------------------------------------------------
   Goals
   ------------------------------------------------------------------------- */

export function getReadingGoal(): ReadingGoal {
  const goal = read<ReadingGoal>(KEYS.goals, {
    dailyArticles: 3,
    dailyMinutes: 30,
    weeklyArticles: 15,
    streakTarget: 7,
  });
  return {
    dailyArticles: goal.dailyArticles ?? 3,
    dailyMinutes: goal.dailyMinutes ?? 30,
    weeklyArticles: goal.weeklyArticles ?? 15,
    streakTarget: goal.streakTarget ?? 7,
  };
}

export function setReadingGoal(goal: ReadingGoal): void {
  write(KEYS.goals, goal);
}
