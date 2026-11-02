import React, { Suspense, lazy, useState, useEffect, useCallback, useRef } from 'react';
import { ThemeProvider, useTheme } from './components/theme/ThemeProvider';
import { Header } from './components/layout/Header';
import { Footer } from './components/layout/Footer';
import { NavigationSidebar } from './components/layout/NavigationSidebar';
import { MobileBottomNav } from './components/layout/MobileBottomNav';
import { ProfileAuthModal } from './components/views/ProfileAuthModal';
import { WelcomeHeroScreen } from './components/onboarding/WelcomeHeroScreen';
import { OnboardingWizard } from './components/onboarding/OnboardingWizard';
import { ReadingControls } from './components/reader/ReadingControls';
import { ReadingProgressBar } from './components/reader/ReadingProgressBar';
import { LoadingIndicator } from './components/ui/LoadingIndicator';
import { ErrorBanner } from './components/ui/ErrorBanner';
import { ToastContainer } from './components/ui/ToastContainer';
import { ThemeBackgroundCanvas } from './components/theme/ThemeBackgroundCanvas';
import { ThemePreviewBanner } from './components/theme/ThemePreviewBanner';
import { SoundtrackDock } from './components/theme/SoundtrackDock';
import { readerApi } from './services/api';
import { Article, ApiError, AppView, Toast, UserProfile } from './types/article';
import { saveCachedArticle, getCachedArticle } from './utils/offlineStore';
import {
  isOnboardingCompleted,
  setOnboardingCompleted,
  getUserProfile,
  recordArticleRead,
  getFeedArticles,
} from './utils/storage';

const LandingView = lazy(() => import('./components/views/LandingView').then((module) => ({ default: module.LandingView })));
const DashboardView = lazy(() => import('./components/views/DashboardView').then((module) => ({ default: module.DashboardView })));
const LibraryView = lazy(() => import('./components/views/LibraryView').then((module) => ({ default: module.LibraryView })));
const BookmarksView = lazy(() => import('./components/views/BookmarksView').then((module) => ({ default: module.BookmarksView })));
const HistoryView = lazy(() => import('./components/views/HistoryView').then((module) => ({ default: module.HistoryView })));
const StatsView = lazy(() => import('./components/views/StatsView').then((module) => ({ default: module.StatsView })));
const DiscoverView = lazy(() => import('./components/views/DiscoverView').then((module) => ({ default: module.DiscoverView })));
const SettingsView = lazy(() => import('./components/views/SettingsView').then((module) => ({ default: module.SettingsView })));
const ProfileView = lazy(() => import('./components/views/ProfileView').then((module) => ({ default: module.ProfileView })));
const ReaderCanvas = lazy(() => import('./components/reader/ReaderCanvas').then((module) => ({ default: module.ReaderCanvas })));

const MainAppContent: React.FC = () => {
  // First-time visitor state
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState<boolean>(() =>
    isOnboardingCompleted()
  );
  const [isOnboardingWizardOpen, setIsOnboardingWizardOpen] = useState<boolean>(false);

  // Initial view: Dashboard if onboarded, landing otherwise
  const [currentView, setCurrentView] = useState<AppView>(() =>
    isOnboardingCompleted() ? 'dashboard' : 'landing'
  );
  const [currentUrl, setCurrentUrl] = useState<string>('');
  const [article, setArticle] = useState<Article | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<ApiError | null>(null);

  // Modals & Panels
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isControlsOpen, setIsControlsOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  // User Profile
  const [profile, setProfile] = useState<UserProfile>(() => getUserProfile());

  // Toast notifications
  const [toasts, setToasts] = useState<Toast[]>([]);

  const { toggleFocusMode, updateSettings } = useTheme();

  const addToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = `${Date.now()}-${Math.random()}`;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  /**
   * Tracks which article URLs have already been counted in this browser session.
   * A Set<string> in a ref resets when the page is refreshed (correct: a new
   * session) but persists across view transitions and component remounts (also
   * correct: we should not double-count the same article in one session).
   */
  const recordedUrlsRef = useRef<Set<string>>(new Set());

  /**
   * Called by ReaderCanvas each time article.url changes.
   * Deduplicates: the first open of a URL records stats; subsequent re-opens
   * (including retries, back-navigation, or React remounts) are ignored.
   */
  const handleArticleRead = useCallback(
    (url: string, wordCount: number, readingTimeMinutes: number) => {
      if (!recordedUrlsRef.current.has(url)) {
        recordedUrlsRef.current.add(url);
        // Use 0 rather than fabricated defaults when values are genuinely unknown.
        recordArticleRead(wordCount || 0, readingTimeMinutes || 0, url);
      }
    },
    []
  );

  const dismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Synchronize active theme from profile on load
  useEffect(() => {
    const p = getUserProfile();
    setProfile(p);
    if (p.preferredTheme) {
      updateSettings({ theme: p.preferredTheme });
    }
  }, [hasCompletedOnboarding, updateSettings]);

  const handleStartOnboarding = () => {
    setIsOnboardingWizardOpen(true);
  };

  const handleExploreAsGuest = () => {
    setOnboardingCompleted(true);
    setHasCompletedOnboarding(true);
    setIsOnboardingWizardOpen(false);
    setCurrentView('dashboard');
    addToast('Welcome to SmallWebReader! Enjoy your reading space.', 'success');
  };

  const handleCompleteOnboarding = () => {
    setOnboardingCompleted(true);
    setHasCompletedOnboarding(true);
    setIsOnboardingWizardOpen(false);
    const updated = getUserProfile();
    setProfile(updated);
    setCurrentView('dashboard');
    addToast(`Your reading space is ready, ${updated.displayName}!`, 'success');
  };

  const handleRestartOnboarding = () => {
    setHasCompletedOnboarding(false);
    setIsOnboardingWizardOpen(false);
    setArticle(null);
    setCurrentView('landing');
  };

  const handleFetchArticle = async (url: string) => {
    setCurrentUrl(url);
    setIsLoading(true);
    setError(null);
    setCurrentView('reader');

    try {
      const result = await readerApi.extractArticle(url);
      if (result.success) {
        setArticle(result.data);
        try {
          await saveCachedArticle({
            url: result.data.url,
            title: result.data.title,
            content: result.data.content,
            excerpt: result.data.excerpt,
            byline: result.data.byline,
            siteName: result.data.siteName,
            publishedDate: result.data.publishedDate,
            fetchedAt: new Date().toISOString(),
            readingTimeMinutes: result.data.readingTimeMinutes,
            wordCount: result.data.wordCount,
          });
        } catch (cacheError) {
          const message = cacheError instanceof Error ? cacheError.message : 'Unknown offline cache error.';
          addToast(`Article loaded, but could not save an offline copy: ${message}`, 'error');
        }
        addToast(`Extracted "${result.data.title.slice(0, 30)}…"`, 'success');
      } else {
        let cached = null;
        try {
          cached = await getCachedArticle(url);
        } catch (cacheError) {
          const message = cacheError instanceof Error ? cacheError.message : 'Unknown offline cache error.';
          addToast(`Could not check the offline article cache: ${message}`, 'error');
        }
        if (cached) {
          setArticle({
            url: cached.url,
            title: cached.title,
            content: cached.content,
            excerpt: cached.excerpt,
            byline: cached.byline,
            siteName: cached.siteName,
            publishedDate: cached.publishedDate,
            readingTimeMinutes: cached.readingTimeMinutes,
            wordCount: cached.wordCount,
          });
          setError(null);
          addToast('Loaded cached article from your offline library.', 'info');
        } else {
          const feedItem = getFeedArticles().find((item) => item.url === url);
          if (feedItem?.excerpt) {
            setArticle({
              url: feedItem.url,
              title: feedItem.title,
              siteName: feedItem.siteName,
              excerpt: feedItem.excerpt,
              content: feedItem.excerpt,
              contentType: 'text',
              publishedDate: feedItem.publishedAt,
            });
            setError(null);
            addToast('Full extraction was unavailable; showing the publisher-provided feed summary.', 'info');
          } else {
            setError(result.error);
            setArticle(null);
            addToast(result.error.message, 'error');
          }
        }
      }
    } catch (err: unknown) {
      let cached = null;
      try {
        cached = await getCachedArticle(url);
      } catch (cacheError) {
        const message = cacheError instanceof Error ? cacheError.message : 'Unknown offline cache error.';
        addToast(`Could not check the offline article cache: ${message}`, 'error');
      }
      if (cached) {
        setArticle({
          url: cached.url,
          title: cached.title,
          content: cached.content,
          excerpt: cached.excerpt,
          byline: cached.byline,
          siteName: cached.siteName,
          publishedDate: cached.publishedDate,
          readingTimeMinutes: cached.readingTimeMinutes,
          wordCount: cached.wordCount,
        });
        setError(null);
        addToast('Loaded cached article from your offline library.', 'info');
      } else {
        const feedItem = getFeedArticles().find((item) => item.url === url);
        if (feedItem?.excerpt) {
          setArticle({
            url: feedItem.url,
            title: feedItem.title,
            siteName: feedItem.siteName,
            excerpt: feedItem.excerpt,
            content: feedItem.excerpt,
            contentType: 'text',
            publishedDate: feedItem.publishedAt,
          });
          setError(null);
          addToast('Network unavailable; showing the publisher-provided feed summary.', 'info');
        } else {
          const errObj = {
            code: 'UNEXPECTED_ERROR',
            message: err instanceof Error ? err.message : 'An unexpected error occurred while fetching the article.',
          };
          setError(errObj);
          setArticle(null);
          addToast(errObj.message, 'error');
        }
      }
    } finally {
      setIsLoading(false);
    }
  };

  const navigateToView = useCallback((view: AppView) => {
    setCurrentView(view);
    setIsSidebarOpen(false);
    setIsControlsOpen(false);
  }, []);

  const handleReset = () => {
    setArticle(null);
    setError(null);
    setCurrentUrl('');
    setIsControlsOpen(false);
    navigateToView('dashboard');
  };

  // Keyboard shortcut listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }
      if (e.key === 'f' || e.key === 'F') {
        toggleFocusMode();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleFocusMode]);

  /* -------------------------------------------------------------------------
     Condition 1: First-time visitor who hasn't completed onboarding
     ------------------------------------------------------------------------- */
  if (!hasCompletedOnboarding) {
    if (isOnboardingWizardOpen) {
      return (
        <>
          <ThemeBackgroundCanvas />
          <OnboardingWizard
            onComplete={handleCompleteOnboarding}
            onSkipToGuest={handleExploreAsGuest}
          />
          <ToastContainer toasts={toasts} onDismiss={dismissToast} />
        </>
      );
    }

    return (
      <>
        <ThemeBackgroundCanvas />
        <WelcomeHeroScreen
          onStartOnboarding={handleStartOnboarding}
          onExploreAsGuest={handleExploreAsGuest}
        />
        <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      </>
    );
  }

  /* -------------------------------------------------------------------------
     Condition 2: Standard Application Shell for Returning Users
     ------------------------------------------------------------------------- */
  return (
    <div className="app-container" style={{ position: 'relative', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <ThemeBackgroundCanvas />
      <ReadingProgressBar />

      <Header
        onReset={handleReset}
        onToggleSidebar={() => setIsSidebarOpen((prev) => !prev)}
        onToggleControls={() => setIsControlsOpen((prev) => !prev)}
        onOpenProfile={() => setIsProfileOpen(true)}
        onNavigate={navigateToView}
        currentView={currentView}
        showControlsButton={true}
        profile={profile}
        notificationsCount={toasts.length}
        onSearch={() => setCurrentView('library')}
      />

      <NavigationSidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        currentView={currentView}
        onNavigate={navigateToView}
        onOpenProfile={() => setIsProfileOpen(true)}
        hasActiveArticle={!!article}
      />

      <ReadingControls
        isOpen={isControlsOpen}
        onClose={() => setIsControlsOpen(false)}
      />

      <ProfileAuthModal
        isOpen={isProfileOpen}
        onClose={() => {
          setIsProfileOpen(false);
          setProfile(getUserProfile());
        }}
        onNotify={addToast}
        onRestartOnboarding={handleRestartOnboarding}
      />

      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      <main className="main-content" id="main-content" style={{ flex: 1 }}>
        {/* Loading Spinner / Skeleton */}
        {isLoading && <LoadingIndicator message={`Extracting ${currentUrl || 'article'}...`} />}

        {/* Error Banner */}
        {error && !isLoading && (
          <div style={{ padding: '2rem 1.5rem', maxWidth: '780px', margin: '0 auto', width: '100%' }}>
            <ErrorBanner
              title="Extraction Failed"
              message={error.message}
              code={error.code}
              onRetry={() => currentUrl && handleFetchArticle(currentUrl)}
              onDismiss={() => setError(null)}
            />
          </div>
        )}

        <Suspense fallback={<LoadingIndicator message="Opening your reading space..." />}>
        {/* View 1: Landing Page (Direct URL Input) */}
        {currentView === 'landing' && !isLoading && (
          <LandingView
            onSubmitUrl={handleFetchArticle}
            isLoading={isLoading}
            onOpenOnboarding={() => setIsOnboardingWizardOpen(true)}
          />
        )}

        {/* View 2: Dashboard View */}
        {currentView === 'dashboard' && !isLoading && (
          <DashboardView
            onStartReading={() => setCurrentView('landing')}
            onSelectArticleUrl={handleFetchArticle}
            onNavigateToView={navigateToView}
            onNotify={addToast}
          />
        )}

        {/* View 3: Core Reader View */}
        {currentView === 'reader' && !isLoading && (
          article ? (
            <div>
              <div
                style={{
                  maxWidth: 'var(--reader-max-width)',
                  margin: '1.5rem auto 0',
                  padding: '0 1.5rem',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <button
                  onClick={handleReset}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    fontSize: '0.88rem',
                    color: 'var(--text-secondary)',
                    padding: '0.4rem 0.75rem',
                    borderRadius: 'var(--radius-sm)',
                    backgroundColor: 'var(--bg-surface-elevated)',
                    border: '1px solid var(--border-subtle)',
                    cursor: 'pointer',
                  }}
                >
                  ← Read Another Article
                </button>
              </div>

              <ReaderCanvas article={article} onNotify={addToast} onArticleRead={handleArticleRead} />
            </div>
          ) : (
            <LandingView
              onSubmitUrl={handleFetchArticle}
              isLoading={isLoading}
              onOpenOnboarding={() => setIsOnboardingWizardOpen(true)}
            />
          )
        )}

        {/* View 4: Personal Library */}
        {currentView === 'library' && (
          <LibraryView
            onSelectArticleUrl={(url) => handleFetchArticle(url)}
            onNotify={addToast}
            initialTab="following"
          />
        )}

        {/* View 5: Dedicated Bookmarks */}
        {currentView === 'bookmarks' && (
          <BookmarksView
            onSelectArticleUrl={(url) => handleFetchArticle(url)}
            onNotify={addToast}
          />
        )}

        {/* View 6: Reading History */}
        {currentView === 'history' && (
          <HistoryView
            onSelectArticleUrl={(url) => handleFetchArticle(url)}
            onNotify={addToast}
          />
        )}

        {/* View 7: Reading Statistics & Analytics */}
        {currentView === 'stats' && <StatsView onNotify={addToast} />}

        {/* View 8: Discover Section */}
        {currentView === 'discover' && (
          <DiscoverView
            onSelectArticleUrl={(url) => handleFetchArticle(url)}
            onNotify={addToast}
          />
        )}

        {/* View 9: Settings Page */}
        {currentView === 'settings' && (
          <SettingsView
            onNotify={addToast}
            onRestartOnboarding={handleRestartOnboarding}
          />
        )}

        {/* View 10: Profile Page */}
        {currentView === 'profile' && (
          <ProfileView
            onOpenEditModal={() => setIsProfileOpen(true)}
            onNavigateToView={navigateToView}
            onNotify={addToast}
          />
        )}
        </Suspense>
      </main>

      <MobileBottomNav
        currentView={currentView}
        onNavigate={navigateToView}
        onToggleMenu={() => setIsSidebarOpen(true)}
      />

      <ThemePreviewBanner />
      <SoundtrackDock />

      <Footer />
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <ThemeProvider>
      <MainAppContent />
    </ThemeProvider>
  );
};
