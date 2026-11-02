import React, { useEffect, useState } from 'react';
import { useTheme } from '../theme/ThemeProvider';
import { THEME_CONFIGS, ThemeConfig } from '../../theme/themeConfig';
import { FontFamily } from '../../types/article';
import { soundtrackEngine } from '../../services/soundtrackService';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { clearCachedArticles, listCachedArticles } from '../../utils/offlineStore';
import { getDiscoveryConsent, setDiscoveryConsent } from '../../utils/storage';

export interface SettingsViewProps {
  onNotify?: (msg: string, type?: 'success' | 'error' | 'info') => void;
  onRestartOnboarding?: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({ onNotify, onRestartOnboarding }) => {
  const {
    settings,
    updateSettings,
    currentThemeConfig,
    animationSettings,
    updateAnimationSettings,
    soundtrackSettings,
    updateSoundtrackSettings,
    isReducedMotion,
  } = useTheme();

  const [isConfirmClearOpen, setIsConfirmClearOpen] = useState(false);
  const [discoveryConsent, setDiscoveryConsentState] = useState(getDiscoveryConsent);
  const [cachedArticleCount, setCachedArticleCount] = useState<number | null>(null);

  useEffect(() => {
    void listCachedArticles()
      .then((articles) => setCachedArticleCount(articles.length))
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : 'Unknown cache error.';
        onNotify?.(`Could not read the offline cache: ${message}`, 'error');
      });
  }, [onNotify]);

  const handleClearOfflineCache = async () => {
    try {
      await clearCachedArticles();
      setCachedArticleCount(0);
      onNotify?.('Offline article cache cleared. Bookmarks, feed subscriptions and reading history were kept.', 'success');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown offline cache error.';
      onNotify?.(`Could not clear offline articles: ${message}`, 'error');
    }
  };

  const handleClearAllData = async () => {
    try {
      await clearCachedArticles();
      localStorage.clear();
      setIsConfirmClearOpen(false);
      onNotify?.('Local reading data, followed feeds, preferences, and cached articles were cleared.', 'info');
      setTimeout(() => window.location.reload(), 800);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown local data storage error.';
      onNotify?.(`Could not clear all local data: ${message}`, 'error');
    }
  };

  const handleExportData = async () => {
    try {
      const data = {
        profile: localStorage.getItem('swr_user_profile_v1'),
        bookmarks: localStorage.getItem('swr_bookmarks_v1'),
        history: localStorage.getItem('swr_history_v1'),
        dailyStats: localStorage.getItem('swr_daily_stats_v1'),
        goals: localStorage.getItem('swr_goals_v1'),
        followedFeeds: localStorage.getItem('swr_followed_feeds_v1'),
        feedArticles: localStorage.getItem('swr_feed_articles_v1'),
        readArticles: localStorage.getItem('swr_read_articles_v1'),
        cachedArticles: await listCachedArticles(),
        exportedAt: new Date().toISOString(),
      };
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `smallwebreader-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      onNotify?.('Local data exported successfully as JSON.', 'success');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown local data export error.';
      onNotify?.(`Could not export local data: ${message}`, 'error');
    }
  };

  return (
    <div style={{ maxWidth: '880px', margin: '0 auto', padding: '3rem 1.5rem', width: '100%' }}>
      {/* Header */}
      <div style={{ marginBottom: '2.5rem' }}>
        <span style={{ fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.05em' }}>
          System Configuration
        </span>
        <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '2.2rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
          Settings & Preferences
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', marginTop: '0.35rem' }}>
          Personalize typography, motion, atmosphere, privacy, and local browser storage.
        </p>
      </div>

      {/* Section 1: Visual Theme Selection */}
      <div
        style={{
          padding: '1.75rem',
          borderRadius: 'var(--radius-lg)',
          backgroundColor: 'var(--bg-surface)',
          border: '1px solid var(--border-subtle)',
          boxShadow: 'var(--shadow-sm)',
          marginBottom: '2rem',
        }}
      >
        <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.35rem' }}>
          Visual Theme
        </h3>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
          Each theme carries a distinct palette, typography scale, border treatment, and particle atmosphere.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.85rem' }}>
          {Object.values(THEME_CONFIGS).map((t: ThemeConfig) => {
            const isSelected = t.id === currentThemeConfig.id;
            return (
              <button
                key={t.id}
                onClick={() => {
                  updateSettings({ theme: t.id });
                  onNotify?.(`Applied "${t.name}" theme.`, 'info');
                }}
                style={{
                  padding: '1rem',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: t.colors.bgSurface,
                  border: isSelected ? `2px solid ${t.colors.accent}` : '1px solid var(--border-subtle)',
                  boxShadow: isSelected ? 'var(--shadow-md)' : 'none',
                  textAlign: 'left',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.5rem',
                  position: 'relative',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <span style={{ width: '14px', height: '14px', borderRadius: '50%', backgroundColor: t.colors.accent, display: 'inline-block' }} />
                    <span style={{ width: '14px', height: '14px', borderRadius: '50%', backgroundColor: t.colors.bgPage, border: '1px solid #ccc', display: 'inline-block' }} />
                  </div>
                  {isSelected && (
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: t.colors.accent }}>Active</span>
                  )}
                </div>

                <div style={{ fontWeight: 600, fontSize: '0.9rem', color: t.colors.textPrimary }}>
                  {t.name}
                </div>
                <div style={{ fontSize: '0.72rem', color: t.colors.textMuted, lineHeight: 1.3 }}>
                  {t.tagline}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Section 2: Reading Typography */}
      <div
        style={{
          padding: '1.75rem',
          borderRadius: 'var(--radius-lg)',
          backgroundColor: 'var(--bg-surface)',
          border: '1px solid var(--border-subtle)',
          boxShadow: 'var(--shadow-sm)',
          marginBottom: '2rem',
        }}
      >
        <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.35rem' }}>
          Reading Canvas Typography
        </h3>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
          Calibrate typefaces and spacing to achieve zero eye-strain during extended reading.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem' }}>
          {/* Font Family */}
          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
              Font Family
            </label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              {(['serif', 'sans', 'mono'] as FontFamily[]).map((f) => (
                <button
                  key={f}
                  onClick={() => updateSettings({ fontFamily: f })}
                  style={{
                    flex: 1,
                    padding: '0.55rem',
                    borderRadius: 'var(--radius-sm)',
                    backgroundColor: settings.fontFamily === f ? 'var(--accent)' : 'var(--bg-surface-elevated)',
                    color: settings.fontFamily === f ? 'var(--accent-text)' : 'var(--text-primary)',
                    border: '1px solid var(--border-subtle)',
                    fontWeight: 600,
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                    textTransform: 'capitalize',
                  }}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          {/* Font Size */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <label style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)' }}>Font Size</label>
              <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{settings.fontSizePx}px</span>
            </div>
            <input
              type="range"
              min="14"
              max="26"
              step="1"
              value={settings.fontSizePx}
              onChange={(e) => updateSettings({ fontSizePx: parseInt(e.target.value) })}
              style={{ width: '100%', cursor: 'pointer' }}
            />
          </div>

          {/* Line Height */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <label style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)' }}>Line Height</label>
              <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{settings.lineHeightRatio.toFixed(2)}</span>
            </div>
            <input
              type="range"
              min="1.4"
              max="2.2"
              step="0.05"
              value={settings.lineHeightRatio}
              onChange={(e) => updateSettings({ lineHeightRatio: parseFloat(e.target.value) })}
              style={{ width: '100%', cursor: 'pointer' }}
            />
          </div>

          {/* Content Width */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <label style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)' }}>Content Width</label>
              <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{settings.contentWidthPx}px</span>
            </div>
            <input
              type="range"
              min="580"
              max="900"
              step="20"
              value={settings.contentWidthPx}
              onChange={(e) => updateSettings({ contentWidthPx: parseInt(e.target.value) })}
              style={{ width: '100%', cursor: 'pointer' }}
            />
          </div>
        </div>
      </div>

      {/* Section 3: Motion & Atmosphere */}
      <div
        style={{
          padding: '1.75rem',
          borderRadius: 'var(--radius-lg)',
          backgroundColor: 'var(--bg-surface)',
          border: '1px solid var(--border-subtle)',
          boxShadow: 'var(--shadow-sm)',
          marginBottom: '2rem',
        }}
      >
        <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.35rem' }}>
          Motion & Sound Atmosphere
        </h3>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
          Control particle animations, page transitions, and procedural ambient synthesis.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Reduced Motion Toggle */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)' }}>Reduced Motion</div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                Minimizes particle drifts, entrance fades, and layout animations (WCAG AA).
              </div>
            </div>
            <button
              onClick={() => {
                const nextPref = animationSettings.reducedMotion === 'reduce' ? 'auto' : 'reduce';
                updateAnimationSettings({ reducedMotion: nextPref });
              }}
              style={{
                padding: '0.45rem 0.85rem',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: isReducedMotion ? 'var(--accent)' : 'var(--bg-surface-elevated)',
                color: isReducedMotion ? 'var(--accent-text)' : 'var(--text-primary)',
                border: '1px solid var(--border-subtle)',
                fontWeight: 600,
                fontSize: '0.82rem',
                cursor: 'pointer',
              }}
            >
              {isReducedMotion ? 'Reduced Motion: ON' : 'Reduced Motion: OFF'}
            </button>
          </div>

          {/* Background Visual Effects Toggle */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)' }}>Theme Background Particles</div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                Renders drifting sakura, leaves, dust, or orbs matching the active theme.
              </div>
            </div>
            <button
              onClick={() => updateAnimationSettings({ bgEffectsEnabled: !animationSettings.bgEffectsEnabled })}
              style={{
                padding: '0.45rem 0.85rem',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: animationSettings.bgEffectsEnabled ? 'var(--accent)' : 'var(--bg-surface-elevated)',
                color: animationSettings.bgEffectsEnabled ? 'var(--accent-text)' : 'var(--text-primary)',
                border: '1px solid var(--border-subtle)',
                fontWeight: 600,
                fontSize: '0.82rem',
                cursor: 'pointer',
              }}
            >
              {animationSettings.bgEffectsEnabled ? 'Enabled' : 'Disabled'}
            </button>
          </div>

          {/* Soundtrack Controls */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)' }}>Ambient Soundtrack</div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                Current sound: {currentThemeConfig.soundtrack.title}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <button
                onClick={() => {
                  if (soundtrackEngine.getState().isPlaying) {
                    soundtrackEngine.stop();
                    updateSoundtrackSettings({ enabled: false });
                  } else {
                    soundtrackEngine.play();
                    updateSoundtrackSettings({ enabled: true });
                  }
                }}
                style={{
                  padding: '0.45rem 0.85rem',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: soundtrackSettings.enabled ? 'var(--accent)' : 'var(--bg-surface-elevated)',
                  color: soundtrackSettings.enabled ? 'var(--accent-text)' : 'var(--text-primary)',
                  border: '1px solid var(--border-subtle)',
                  fontWeight: 600,
                  fontSize: '0.82rem',
                  cursor: 'pointer',
                }}
              >
                {soundtrackSettings.enabled ? 'Soundtrack: ON' : 'Soundtrack: OFF'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Section 4: Privacy, Data & Cloud Integration */}
      <div
        style={{
          padding: '1.75rem',
          borderRadius: 'var(--radius-lg)',
          backgroundColor: 'var(--bg-surface)',
          border: '1px solid var(--border-subtle)',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.35rem' }}>
          Privacy, Storage & Cloud Status
        </h3>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
          SmallWebReader operates locally by default.           No account is required. Reading history, bookmarks, preferences, subscriptions and article caches are stored in this browser.
        </p>

        {/* Cloud Status Notice */}
        <div
          style={{
            padding: '1rem',
            borderRadius: 'var(--radius-md)',
            backgroundColor: 'var(--bg-surface-elevated)',
            border: '1px dashed var(--border-subtle)',
            marginBottom: '1.5rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
          }}
        >
          <span style={{ fontSize: '1.5rem' }}>☁️</span>
          <div>
            <div style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--text-primary)' }}>
              Cloud Sync: Disabled (Local Mode)
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              Public URLs are sent to the configured API only when you request article/feed fetching or related discovery. Reading history and bookmarks are not sent; discovery contribution is a separate opt-in action.
            </div>
          </div>
        </div>

        <div style={{ marginBottom: '1.5rem', padding: '1rem', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
          <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.65rem', color: 'var(--text-primary)', fontSize: '0.88rem', fontWeight: 600 }}>
            <input
              type="checkbox"
              checked={discoveryConsent}
              onChange={(event) => {
                const consent = event.target.checked;
                setDiscoveryConsentState(consent);
                setDiscoveryConsent(consent);
                onNotify?.(consent ? 'Discovery contribution opt-in enabled. No data is sent until you submit a contribution.' : 'Discovery contribution opt-in disabled.', 'info');
              }}
            />
            <span>Allow opt-in aggregate discovery contributions</span>
          </label>
          <p style={{ margin: '0.5rem 0 0 1.55rem', color: 'var(--text-muted)', fontSize: '0.78rem' }}>
            Enabling this only records your choice in this browser. Feed lists are sent only when you submit a contribution in Discover; no reading history, article content, or persistent reader ID is sent.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', marginBottom: '1.5rem', padding: '1rem', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
          <div>
            <div style={{ color: 'var(--text-primary)', fontSize: '0.88rem', fontWeight: 600 }}>Offline article cache</div>
            <p style={{ marginTop: '0.25rem', color: 'var(--text-muted)', fontSize: '0.78rem' }}>
              {cachedArticleCount === null ? 'Checking this device…' : `${cachedArticleCount} cached article${cachedArticleCount === 1 ? '' : 's'} stored in IndexedDB.`}
            </p>
          </div>
          <Button variant="secondary" onClick={() => void handleClearOfflineCache()} disabled={cachedArticleCount === 0}>
            Clear offline cache
          </Button>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <Button variant="secondary" onClick={handleExportData}>
            Export Local Data (JSON)
          </Button>

          {onRestartOnboarding && (
            <Button variant="secondary" onClick={onRestartOnboarding}>
              Re-run Onboarding Tour
            </Button>
          )}

          <button
            onClick={() => setIsConfirmClearOpen(true)}
            style={{
              padding: '0.55rem 1rem',
              borderRadius: 'var(--radius-md)',
              backgroundColor: '#DC2626',
              color: '#FFFFFF',
              border: 'none',
              fontWeight: 600,
              fontSize: '0.88rem',
              cursor: 'pointer',
            }}
          >
            Clear All Local Data
          </button>
        </div>
      </div>

      {/* Confirmation Modal */}
      <Modal
        isOpen={isConfirmClearOpen}
        onClose={() => setIsConfirmClearOpen(false)}
        title="Reset All Local Data?"
      >
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem', lineHeight: 1.5, marginBottom: '1.5rem' }}>
          This will remove followed feeds, feed posts, bookmarks, reading history, read state, preferences, statistics, and cached article content from this browser. The app shell may remain cached for offline startup.
        </p>

        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
          <Button variant="secondary" onClick={() => setIsConfirmClearOpen(false)}>
            Cancel
          </Button>
          <button
            onClick={handleClearAllData}
            style={{
              padding: '0.55rem 1.25rem',
              borderRadius: 'var(--radius-sm)',
              backgroundColor: '#DC2626',
              color: '#FFFFFF',
              border: 'none',
              fontWeight: 600,
              fontSize: '0.88rem',
              cursor: 'pointer',
            }}
          >
            Yes, Clear Everything
          </button>
        </div>
      </Modal>
    </div>
  );
};
