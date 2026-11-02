/**
 * SmallWebReader — Core Domain Types
 * Clean separation of article representation, reader settings, and API result models.
 */

export interface Article {
  url: string;
  title: string;
  byline?: string | null;
  publishedDate?: string | null;
  content: string;
  contentType?: 'html' | 'text' | 'markdown';
  excerpt?: string | null;
  readingTimeMinutes?: number;
  wordCount?: number;
  leadImageUrl?: string | null;
  siteName?: string | null;
}

export type ThemeId =
  | 'editorial-zen'
  | 'japanese-minimal'
  | 'academia'
  | 'dark-mono'
  | 'nature'
  | 'cyberpunk'
  | 'anime'
  | 'minimalist'
  | 'experimental';

export type FontFamily = 'serif' | 'sans' | 'mono';

export interface ReaderSettings {
  theme: ThemeId;
  fontFamily: FontFamily;
  fontSizePx: number;
  contentWidthPx: number;
  lineHeightRatio: number;
}

export interface ApiError {
  code: string;
  message: string;
  status?: number;
}

export type ApiResult<T> =
  | { success: true; data: T }
  | { success: false; error: ApiError };

export interface FetchResponse {
  url: string;
  contentType: string;
  content: string;
}

export interface PopularFeed {
  canonicalUrl: string;
  host: string;
  title: string | null;
  websiteUrl?: string | null;
  aggregateCount: number;
  isSeed: boolean;
}

export interface PopularFeedsResponse {
  feeds: PopularFeed[];
  total: number;
  limit: number;
  offset: number;
}

export interface RecommendationItem {
  canonicalUrl: string;
  host: string;
  title: string | null;
  reason: string;
  supportCount: number;
  websiteUrl?: string | null;
}

export interface DiscoveryQueryResponse {
  recommendations: RecommendationItem[];
  count: number;
}

export interface DiscoverySubmitResponse {
  status: string;
  feedsProcessed: number;
  pairsUpdated: number;
}

export interface ReaderApiClient {
  extractArticle(url: string): Promise<ApiResult<Article>>;
  checkHealth?(): Promise<{ status: 'ok' | 'unreachable' }>;
  fetchProxy?(url: string): Promise<ApiResult<FetchResponse>>;
  getPopularFeeds?(limit?: number, offset?: number): Promise<ApiResult<PopularFeedsResponse>>;
  queryRecommendations?(feeds: string[], limit?: number): Promise<ApiResult<DiscoveryQueryResponse>>;
  submitContribution?(feeds: string[], consent: boolean): Promise<ApiResult<DiscoverySubmitResponse>>;
}

/* -------------------------------------------------------------------------
   Bookmark & History (Local Guest Persistence)
   ------------------------------------------------------------------------- */

export interface Bookmark {
  id: string;
  url: string;
  title: string;
  byline?: string | null;
  siteName?: string | null;
  excerpt?: string | null;
  savedAt: string; // ISO 8601
  readProgress?: number; // 0-100
  genre?: string;
  readingTimeMinutes?: number;
}

export interface FollowedFeed {
  feedUrl: string;
  homepageUrl?: string | null;
  title?: string | null;
  host?: string | null;
  followedAt: string;
  source?: 'popular' | 'recommendation' | 'curated' | 'manual';
}

export interface FeedArticle {
  feedUrl: string;
  url: string;
  title: string;
  siteName: string;
  excerpt?: string;
  publishedAt?: string | null;
  fetchedAt: string;
}

export interface HistoryEntry {
  id: string;
  url: string;
  title: string;
  siteName?: string | null;
  visitedAt: string; // ISO 8601
  readProgress?: number;
  readingTimeSpent?: number; // seconds
  readingTimeMinutes?: number;
  thumbnailUrl?: string | null;
  genre?: string;
}

/* -------------------------------------------------------------------------
   Reading Stats (Local Guest Persistence)
   ------------------------------------------------------------------------- */

export interface DailyReadingStats {
  date: string; // YYYY-MM-DD
  articlesRead: number;
  minutesRead: number;
  wordsRead: number;
}

export interface ReadingGoal {
  dailyArticles: number;
  dailyMinutes: number;
  weeklyArticles?: number;
  streakTarget?: number;
}

/* -------------------------------------------------------------------------
   Navigation & UI State
   ------------------------------------------------------------------------- */

export type AppView =
  | 'landing'
  | 'dashboard'
  | 'reader'
  | 'library'
  | 'bookmarks'
  | 'history'
  | 'stats'
  | 'discover'
  | 'settings'
  | 'profile';

export interface Toast {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
  duration?: number;
}

/* -------------------------------------------------------------------------
   First-Time Onboarding & User Profile Types
   ------------------------------------------------------------------------- */

export type ReadingGenre =
  | 'Technology'
  | 'Science'
  | 'Business'
  | 'Finance'
  | 'Psychology'
  | 'History'
  | 'Philosophy'
  | 'Literature'
  | 'Education'
  | 'News'
  | 'Design'
  | 'Entertainment'
  | 'Lifestyle'
  | 'Other';

export type ReadingStyle =
  | 'casual'
  | 'deep-focus'
  | 'academic'
  | 'quick'
  | 'night';

export interface UserProfile {
  displayName: string;
  username: string;
  avatar: string; // Avatar emoji or icon code
  preferredGenres: ReadingGenre[];
  readingStyle: ReadingStyle;
  preferredTheme: ThemeId;
  soundtrack: string;
  readingGoal: ReadingGoal;
  accountType: 'guest' | 'signed_in';
}
