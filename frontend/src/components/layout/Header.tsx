import React, { useState, useRef, useEffect } from 'react';
import { isFixtureModeEnabled } from '../../services/api';
import { AppView, UserProfile, ThemeId } from '../../types/article';
import { useTheme } from '../theme/ThemeProvider';
import { THEME_CONFIGS } from '../../theme/themeConfig';
import { soundtrackEngine } from '../../services/soundtrackService';

export interface HeaderProps {
  onReset?: () => void;
  onToggleSidebar: () => void;
  onToggleControls?: () => void;
  onOpenProfile: () => void;
  onNavigate?: (view: AppView) => void;
  currentView: AppView;
  showControlsButton?: boolean;
  profile?: UserProfile;
  notificationsCount?: number;
  onSearch?: (query: string) => void;
}

export const Header: React.FC<HeaderProps> = ({
  onReset,
  onToggleSidebar,
  onToggleControls,
  onOpenProfile,
  onNavigate,
  currentView,
  showControlsButton = true,
  profile,
  notificationsCount = 0,
  onSearch,
}) => {
  const isFixture = isFixtureModeEnabled();
  const { currentThemeConfig, updateSettings, updateSoundtrackSettings } = useTheme();

  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);

  const [isThemeMenuOpen, setIsThemeMenuOpen] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [isPlayingSoundtrack, setIsPlayingSoundtrack] = useState(() => soundtrackEngine.getState().isPlaying);

  const themeMenuRef = useRef<HTMLDivElement>(null);
  const profileMenuRef = useRef<HTMLDivElement>(null);

  // Sync soundtrack state
  useEffect(() => {
    const unsub = soundtrackEngine.subscribe((state) => {
      setIsPlayingSoundtrack(state.isPlaying);
    });
    return unsub;
  }, []);

  useEffect(() => {
    const updateStatus = () => setIsOnline(navigator.onLine);
    window.addEventListener('online', updateStatus);
    window.addEventListener('offline', updateStatus);
    return () => {
      window.removeEventListener('online', updateStatus);
      window.removeEventListener('offline', updateStatus);
    };
  }, []);

  // Close menus on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (themeMenuRef.current && !themeMenuRef.current.contains(e.target as Node)) {
        setIsThemeMenuOpen(false);
      }
      if (profileMenuRef.current && !profileMenuRef.current.contains(e.target as Node)) {
        setIsProfileMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const viewTitles: Record<AppView, string> = {
    landing: 'Home',
    dashboard: 'Dashboard',
    reader: 'Reader',
    library: 'Personal Library',
    bookmarks: 'Bookmarks',
    history: 'Reading History',
    stats: 'Reading Statistics',
    discover: 'Discover',
    settings: 'Settings',
    profile: 'Profile',
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (onSearch) {
      onSearch(searchInput);
    } else if (onNavigate) {
      onNavigate('library');
    }
  };

  const handleToggleSoundtrack = () => {
    if (isPlayingSoundtrack) {
      soundtrackEngine.stop();
      updateSoundtrackSettings({ enabled: false });
    } else {
      soundtrackEngine.play();
      updateSoundtrackSettings({ enabled: true });
    }
  };

  const handleSelectTheme = (themeId: ThemeId) => {
    updateSettings({ theme: themeId });
    setIsThemeMenuOpen(false);
  };

  return (
    <header
      className="app-header-nav"
      style={{
        borderBottom: '1px solid var(--border-subtle)',
        backgroundColor: 'var(--bg-page)',
        padding: '0.75rem 1.25rem',
        position: 'sticky',
        top: 0,
        zIndex: 50,
        backdropFilter: 'blur(10px)',
        transition: 'background-color var(--transition-normal), border-color var(--transition-normal)',
      }}
    >
      <div
        style={{
          maxWidth: '1180px',
          margin: '0 auto',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1rem',
        }}
      >
        {/* Left Side: Drawer Toggle, Logo, Breadcrumb */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          {/* Drawer Hamburger */}
          <button
            onClick={onToggleSidebar}
            aria-label="Open navigation menu"
            style={{
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              gap: '4px',
              width: '32px',
              height: '32px',
              padding: '5px',
              borderRadius: 'var(--radius-sm)',
              backgroundColor: 'transparent',
              border: 'none',
              color: 'var(--text-primary)',
              cursor: 'pointer',
            }}
          >
            <span style={{ width: '18px', height: '2px', backgroundColor: 'currentColor', borderRadius: '1px' }} />
            <span style={{ width: '14px', height: '2px', backgroundColor: 'currentColor', borderRadius: '1px' }} />
            <span style={{ width: '18px', height: '2px', backgroundColor: 'currentColor', borderRadius: '1px' }} />
          </button>

          {/* Logo / Brand */}
          <button
            onClick={onReset}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.45rem',
              textAlign: 'left',
              color: 'var(--text-primary)',
              cursor: 'pointer',
              backgroundColor: 'transparent',
              border: 'none',
              padding: 0,
            }}
            aria-label="SmallWebReader Home"
          >
            <span
              style={{
                fontFamily: 'var(--font-serif)',
                fontSize: '1.25rem',
                fontWeight: 700,
                letterSpacing: '-0.02em',
              }}
              className="header-brand-name"
            >
              SmallWebReader
            </span>
          </button>

          {currentView !== 'landing' && (
            <span
              style={{
                fontSize: '0.8rem',
                color: 'var(--text-muted)',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
              }}
              className="header-breadcrumb"
            >
              <span>/</span>
              <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>
                {viewTitles[currentView] || 'Reader'}
              </span>
            </span>
          )}

          {isFixture && (
            <span
              style={{
                fontSize: '0.68rem',
                padding: '0.15rem 0.5rem',
                borderRadius: 'var(--radius-full)',
                backgroundColor: 'var(--accent-surface)',
                color: 'var(--text-secondary)',
                fontWeight: 600,
                border: '1px solid var(--border-subtle)',
              }}
              className="header-fixture-badge"
              title="Development fixtures enabled (VITE_USE_DEV_FIXTURES=true)"
            >
              Fixtures
            </span>
          )}

          <span
            style={{
              fontSize: '0.68rem',
              padding: '0.18rem 0.5rem',
              borderRadius: 'var(--radius-full)',
              backgroundColor: isOnline ? 'rgba(34, 197, 94, 0.12)' : 'rgba(248, 113, 113, 0.12)',
              color: isOnline ? '#15803d' : '#b91c1c',
              fontWeight: 700,
              border: '1px solid var(--border-subtle)',
            }}
            className="header-online-status"
            aria-label={isOnline ? 'Online' : 'Offline'}
            title={isOnline ? 'Online' : 'Offline'}
          >
            {isOnline ? 'Online' : 'Offline'}
          </span>
        </div>

        {/* Center: Search Bar (Desktop / Tablet) */}
        <div style={{ flex: 1, maxWidth: '340px', display: 'none' }} className="header-search-container">
          <form onSubmit={handleSearchSubmit} style={{ position: 'relative', width: '100%' }}>
            <input
              type="text"
              placeholder="Search library & articles..."
              value={searchInput}
              onChange={(e) => {
                setSearchInput(e.target.value);
                if (onSearch) onSearch(e.target.value);
              }}
              style={{
                width: '100%',
                padding: '0.45rem 0.85rem 0.45rem 2.1rem',
                borderRadius: 'var(--radius-full)',
                border: '1px solid var(--border-subtle)',
                backgroundColor: 'var(--bg-surface)',
                color: 'var(--text-primary)',
                fontSize: '0.82rem',
                outline: 'none',
                transition: 'border-color var(--transition-fast)',
              }}
            />
            <span
              style={{
                position: 'absolute',
                left: '0.75rem',
                top: '50%',
                transform: 'translateY(-50%)',
                fontSize: '0.82rem',
                color: 'var(--text-muted)',
              }}
            >
              🔍
            </span>
          </form>
        </div>

        {/* Right Side: Quick Actions, Theme, Soundtrack, Notifications, Profile */}
        <div className="header-actions" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {/* Quick Soundtrack Toggle */}
          <button
            onClick={handleToggleSoundtrack}
            aria-label={isPlayingSoundtrack ? 'Pause atmosphere soundtrack' : 'Play atmosphere soundtrack'}
            title={`Soundtrack: ${currentThemeConfig.soundtrack.title} (${isPlayingSoundtrack ? 'Playing' : 'Muted'})`}
            className="header-soundtrack-toggle"
            style={{
              padding: '0.4rem 0.65rem',
              borderRadius: 'var(--radius-md)',
              backgroundColor: isPlayingSoundtrack ? 'var(--accent-surface)' : 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
              color: isPlayingSoundtrack ? 'var(--accent)' : 'var(--text-muted)',
              fontSize: '0.82rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
              cursor: 'pointer',
              transition: 'all var(--transition-fast)',
            }}
          >
            <span>{isPlayingSoundtrack ? '🔊' : '🔈'}</span>
            <span style={{ display: 'none', fontWeight: 500 }} className="desktop-header-label">
              {isPlayingSoundtrack ? 'Playing' : 'Sound'}
            </span>
          </button>

          {/* Theme Switcher Dropdown */}
          <div ref={themeMenuRef} style={{ position: 'relative' }} className="header-theme-switcher">
            <button
              onClick={() => setIsThemeMenuOpen((prev) => !prev)}
              aria-label="Switch visual theme"
              aria-expanded={isThemeMenuOpen}
              style={{
                padding: '0.4rem 0.65rem',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--bg-surface)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-primary)',
                fontSize: '0.82rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
                cursor: 'pointer',
                transition: 'all var(--transition-fast)',
              }}
            >
              <span>🎨</span>
              <span className="header-action-label" style={{ fontSize: '0.8rem', fontWeight: 500 }}>
                {currentThemeConfig.name}
              </span>
            </button>

            {isThemeMenuOpen && (
              <div
                style={{
                  position: 'absolute',
                  right: 0,
                  top: 'calc(100% + 0.4rem)',
                  width: '240px',
                  backgroundColor: 'var(--bg-surface)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-lg)',
                  boxShadow: 'var(--shadow-lg)',
                  padding: '0.5rem',
                  zIndex: 210,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.2rem',
                }}
              >
                <div style={{ padding: '0.4rem 0.5rem', fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  Visual Themes
                </div>
                {Object.values(THEME_CONFIGS).map((t) => {
                  const isSelected = t.id === currentThemeConfig.id;
                  return (
                    <button
                      key={t.id}
                      onClick={() => handleSelectTheme(t.id)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '0.45rem 0.65rem',
                        borderRadius: 'var(--radius-sm)',
                        backgroundColor: isSelected ? 'var(--accent-surface)' : 'transparent',
                        color: isSelected ? 'var(--accent)' : 'var(--text-primary)',
                        fontWeight: isSelected ? 600 : 400,
                        fontSize: '0.82rem',
                        border: 'none',
                        textAlign: 'left',
                        cursor: 'pointer',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span
                          style={{
                            width: '12px',
                            height: '12px',
                            borderRadius: '50%',
                            backgroundColor: t.colors.accent,
                            display: 'inline-block',
                            border: '1px solid rgba(0,0,0,0.1)',
                          }}
                        />
                        <span>{t.name}</span>
                      </div>
                      {isSelected && <span>✓</span>}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Reading Controls Trigger (Aa) */}
          {showControlsButton && (
            <button
              onClick={onToggleControls}
              aria-label="Toggle reader typography & theme settings"
              style={{
                padding: '0.4rem 0.65rem',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--bg-surface)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-primary)',
                fontSize: '0.85rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
                cursor: 'pointer',
                transition: 'all var(--transition-fast)',
              }}
            >
              <span style={{ fontWeight: 700 }}>Aa</span>
              <span className="header-action-label" style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Appearance</span>
            </button>
          )}

          {/* Notifications Indicator */}
          {notificationsCount > 0 && (
            <div
              title={`${notificationsCount} active notifications`}
              style={{
                padding: '0.4rem 0.5rem',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--accent-surface)',
                color: 'var(--accent)',
                fontSize: '0.8rem',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '0.25rem',
              }}
            >
              <span>🔔</span>
              <span>{notificationsCount}</span>
            </div>
          )}

          {/* Profile Avatar Dropdown */}
          <div ref={profileMenuRef} style={{ position: 'relative' }} className="header-profile-menu">
            <button
              onClick={() => setIsProfileMenuOpen((prev) => !prev)}
              aria-label={`Account and preferences (${profile?.displayName || 'Guest'})`}
              aria-expanded={isProfileMenuOpen}
              style={{
                padding: '0.35rem 0.65rem',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--bg-surface)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-secondary)',
                fontSize: '0.85rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
                cursor: 'pointer',
              }}
            >
              <span>{profile?.avatar || '👤'}</span>
              <span
                style={{
                  display: 'inline',
                  maxWidth: '100px',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  fontWeight: 500,
                  fontSize: '0.82rem',
                }}
                className="header-profile-name"
              >
                {profile?.displayName || 'Guest'}
              </span>
              <span className="header-profile-caret" style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>▾</span>
            </button>

            {isProfileMenuOpen && (
              <div
                style={{
                  position: 'absolute',
                  right: 0,
                  top: 'calc(100% + 0.4rem)',
                  width: '210px',
                  backgroundColor: 'var(--bg-surface)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-lg)',
                  boxShadow: 'var(--shadow-lg)',
                  padding: '0.5rem',
                  zIndex: 210,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.25rem',
                }}
              >
                <div style={{ padding: '0.5rem 0.65rem', borderBottom: '1px solid var(--border-subtle)' }}>
                  <div style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--text-primary)' }}>
                    {profile?.displayName || 'Guest Reader'}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    @{profile?.username || 'guest_reader'} • Local Profile
                  </div>
                </div>

                <button
                  onClick={() => {
                    setIsProfileMenuOpen(false);
                    if (onNavigate) onNavigate('profile');
                    else onOpenProfile();
                  }}
                  style={{
                    padding: '0.5rem 0.65rem',
                    borderRadius: 'var(--radius-sm)',
                    backgroundColor: 'transparent',
                    border: 'none',
                    textAlign: 'left',
                    fontSize: '0.85rem',
                    color: 'var(--text-primary)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    cursor: 'pointer',
                  }}
                >
                  <span>👤</span>
                  <span>View Profile</span>
                </button>

                <button
                  onClick={() => {
                    setIsProfileMenuOpen(false);
                    if (onNavigate) onNavigate('settings');
                    else onToggleControls?.();
                  }}
                  style={{
                    padding: '0.5rem 0.65rem',
                    borderRadius: 'var(--radius-sm)',
                    backgroundColor: 'transparent',
                    border: 'none',
                    textAlign: 'left',
                    fontSize: '0.85rem',
                    color: 'var(--text-primary)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    cursor: 'pointer',
                  }}
                >
                  <span>⚙️</span>
                  <span>Settings & Preferences</span>
                </button>

                <button
                  onClick={() => {
                    setIsProfileMenuOpen(false);
                    onOpenProfile();
                  }}
                  style={{
                    padding: '0.5rem 0.65rem',
                    borderRadius: 'var(--radius-sm)',
                    backgroundColor: 'transparent',
                    border: 'none',
                    textAlign: 'left',
                    fontSize: '0.85rem',
                    color: 'var(--text-primary)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    cursor: 'pointer',
                  }}
                >
                  <span>✏️</span>
                  <span>Edit Profile</span>
                </button>

                <div style={{ borderTop: '1px solid var(--border-subtle)', margin: '0.2rem 0' }} />

                <div style={{ padding: '0.3rem 0.65rem', fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                  Guest Mode • Zero Cloud Telemetry
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
