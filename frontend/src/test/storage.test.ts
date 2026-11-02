import { describe, it, expect, beforeEach } from 'vitest';
import {
  getBookmarks,
  addBookmark,
  removeBookmark,
  isBookmarked,
  getHistory,
  addHistoryEntry,
  clearHistory,
  getTodayStats,
  recordArticleRead,
  getCurrentStreak,
  getReadingGoal,
  setReadingGoal,
  isArticleReadToday,
  getTodayReadUrls,
  saveFeedArticles,
  getFeedArticles,
  getUnreadFeedArticles,
  setArticleRead,
  getFollowedFeeds,
  followFeed,
  isFollowingFeed,
  unfollowFeed,
} from '../utils/storage';

describe('Local Storage Guest Persistence', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('Bookmarks', () => {
    it('saves and retrieves bookmarks', () => {
      expect(getBookmarks()).toEqual([]);

      const item = addBookmark({
        url: 'https://example.com/art1',
        title: 'Article 1',
        siteName: 'Example',
      });

      expect(item.id).toBeDefined();
      expect(item.savedAt).toBeDefined();
      expect(isBookmarked('https://example.com/art1')).toBe(true);
      expect(getBookmarks().length).toBe(1);
    });

    it('prevents duplicate bookmarks for same URL', () => {
      addBookmark({ url: 'https://example.com/dup', title: 'First' });
      addBookmark({ url: 'https://example.com/dup', title: 'Second' });

      expect(getBookmarks().length).toBe(1);
    });

    it('removes bookmark by URL', () => {
      addBookmark({ url: 'https://example.com/del', title: 'Delete Me' });
      expect(isBookmarked('https://example.com/del')).toBe(true);

      removeBookmark('https://example.com/del');
      expect(isBookmarked('https://example.com/del')).toBe(false);
      expect(getBookmarks().length).toBe(0);
    });
  });

  describe('Reading History', () => {
    it('records and clears history entries', () => {
      expect(getHistory()).toEqual([]);

      addHistoryEntry({ url: 'https://example.com/hist1', title: 'History 1' });
      addHistoryEntry({ url: 'https://example.com/hist2', title: 'History 2' });

      const list = getHistory();
      expect(list.length).toBe(2);
      expect(list[0].title).toBe('History 2'); // Most recent at top

      clearHistory();
      expect(getHistory()).toEqual([]);
    });

    describe('Feed timeline and local read state', () => {
      it('migrates legacy followed URL data into separate feed and homepage fields', () => {
        localStorage.setItem('swr_followed_feeds_v1', JSON.stringify([{
          url: 'https://publisher.example/rss.xml',
          title: 'Publisher',
          followedAt: '2026-10-20T10:00:00.000Z',
        }]));

        expect(getFollowedFeeds()).toEqual([{
          feedUrl: 'https://publisher.example/rss.xml',
          homepageUrl: null,
          title: 'Publisher',
          followedAt: '2026-10-20T10:00:00.000Z',
        }]);
        expect(isFollowingFeed('https://publisher.example/rss.xml')).toBe(true);
      });

      it('preserves the feed URL for follow and unfollow while storing homepage separately', () => {
        const feed = followFeed({
          feedUrl: 'https://publisher.example/rss.xml',
          homepageUrl: 'https://publisher.example/',
          title: 'Publisher',
        });

        expect(feed.feedUrl).toBe('https://publisher.example/rss.xml');
        expect(feed.homepageUrl).toBe('https://publisher.example/');
        expect(isFollowingFeed(feed.feedUrl)).toBe(true);
        unfollowFeed(feed.feedUrl);
        expect(getFollowedFeeds()).toEqual([]);
      });

      it('persists feed posts and read/unread state locally', () => {
        saveFeedArticles([{
          feedUrl: 'https://blog.example/feed.xml',
          url: 'https://blog.example/post',
          title: 'A new post',
          siteName: 'Example Blog',
          publishedAt: '2026-10-20T10:00:00.000Z',
          fetchedAt: '2026-10-20T10:05:00.000Z',
        }]);

        expect(getFeedArticles()).toHaveLength(1);
        expect(getUnreadFeedArticles()).toHaveLength(1);
        setArticleRead('https://blog.example/post', true);
        expect(getUnreadFeedArticles()).toHaveLength(0);
        setArticleRead('https://blog.example/post', false);
        expect(getUnreadFeedArticles()).toHaveLength(1);
      });
    });
  });

  describe('Reading Stats & Goals', () => {
    it('records article read and updates today stats', () => {
      recordArticleRead(800, 4);
      const today = getTodayStats();

      expect(today.articlesRead).toBe(1);
      expect(today.wordsRead).toBe(800);
      expect(today.minutesRead).toBe(4);

      recordArticleRead(400, 2);
      const updated = getTodayStats();
      expect(updated.articlesRead).toBe(2);
      expect(updated.wordsRead).toBe(1200);
      expect(updated.minutesRead).toBe(6);
    });

    it('deduplicates articles by URL so opening/resuming the same article does not increment counts', () => {
      const url = 'https://example.com/unique-read';
      expect(isArticleReadToday(url)).toBe(false);

      const firstResult = recordArticleRead(600, 3, url);
      expect(firstResult).toBe(true);
      expect(isArticleReadToday(url)).toBe(true);
      expect(getTodayReadUrls()).toContain(url);

      const statsAfterFirst = getTodayStats();
      expect(statsAfterFirst.articlesRead).toBe(1);
      expect(statsAfterFirst.wordsRead).toBe(600);
      expect(statsAfterFirst.minutesRead).toBe(3);

      // Simulating user re-opening, refreshing, or resuming the same article URL
      const secondResult = recordArticleRead(600, 3, url);
      expect(secondResult).toBe(false);

      const statsAfterSecond = getTodayStats();
      expect(statsAfterSecond.articlesRead).toBe(1); // Still 1, NOT 2
      expect(statsAfterSecond.wordsRead).toBe(600);  // Unchanged
      expect(statsAfterSecond.minutesRead).toBe(3); // Unchanged
    });

    it('calculates current streak', () => {
      expect(getCurrentStreak()).toBe(0);
      recordArticleRead(500, 3);
      expect(getCurrentStreak()).toBe(1);
    });

    it('manages reading goals', () => {
      const defaultGoal = getReadingGoal();
      expect(defaultGoal.dailyArticles).toBe(3);

      setReadingGoal({ dailyArticles: 5, dailyMinutes: 45 });
      expect(getReadingGoal().dailyArticles).toBe(5);
      expect(getReadingGoal().dailyMinutes).toBe(45);
    });
  });
});
