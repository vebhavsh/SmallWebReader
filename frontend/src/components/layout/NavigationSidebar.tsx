import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AppView } from '../../types/article';
import { slideFromLeft, fadeIn } from '../../utils/animations';
import { useTheme } from '../theme/ThemeProvider';

export interface NavigationSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  currentView: AppView;
  onNavigate: (view: AppView) => void;
  onOpenProfile: () => void;
  hasActiveArticle: boolean;
}

interface NavItemDef {
  view: AppView;
  label: string;
  icon: string;
  badge?: string;
}

export const NavigationSidebar: React.FC<NavigationSidebarProps> = ({
  isOpen,
  onClose,
  currentView,
  onNavigate,
  onOpenProfile,
  hasActiveArticle,
}) => {
  const { currentThemeConfig } = useTheme();

  const sections: { category: string; items: NavItemDef[] }[] = [
    {
      category: 'Overview',
      items: [
        { view: 'dashboard', label: 'Dashboard', icon: '🏠' },
        {
          view: hasActiveArticle ? 'reader' : 'landing',
          label: 'Read an Article',
          icon: '📖',
          badge: hasActiveArticle ? 'Active' : undefined,
        },
        { view: 'discover', label: 'Discover', icon: '🧭' },
      ],
    },
    {
      category: 'My Collection',
      items: [
        { view: 'library', label: 'My Library', icon: '📚' },
        { view: 'bookmarks', label: 'Bookmarks', icon: '🔖' },
        { view: 'history', label: 'Reading History', icon: '⏱️' },
      ],
    },
    {
      category: 'Personal Space',
      items: [
        { view: 'stats', label: 'Reading Statistics', icon: '📊' },
        { view: 'profile', label: 'Profile', icon: '👤' },
        { view: 'settings', label: 'Settings', icon: '⚙️' },
      ],
    },
  ];

  const handleItemClick = (view: AppView) => {
    onNavigate(view);
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex' }}
          role="dialog"
          aria-modal="true"
          aria-label="Navigation Menu"
        >
          {/* Backdrop */}
          <motion.div
            {...fadeIn}
            onClick={onClose}
            style={{
              position: 'fixed',
              inset: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.45)',
              backdropFilter: 'blur(4px)',
            }}
          />

          {/* Drawer Content */}
          <motion.nav
            {...slideFromLeft}
            style={{
              position: 'relative',
              width: '300px',
              maxWidth: '85vw',
              height: '100%',
              backgroundColor: 'var(--bg-surface)',
              borderRight: '1px solid var(--border-subtle)',
              boxShadow: 'var(--shadow-lg)',
              padding: '1.5rem 1.25rem',
              display: 'flex',
              flexDirection: 'column',
              zIndex: 201,
              overflowY: 'auto',
            }}
          >
            {/* Header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '1.5rem',
                paddingBottom: '0.75rem',
                borderBottom: '1px solid var(--border-subtle)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '1.3rem' }}>📖</span>
                <div>
                  <span
                    style={{
                      fontFamily: 'var(--font-serif)',
                      fontSize: '1.15rem',
                      fontWeight: 700,
                      color: 'var(--text-primary)',
                      display: 'block',
                      lineHeight: 1.2,
                    }}
                  >
                    SmallWebReader
                  </span>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    Distraction-Free Sanctuary
                  </span>
                </div>
              </div>

              <button
                onClick={onClose}
                aria-label="Close navigation"
                style={{
                  color: 'var(--text-muted)',
                  fontSize: '1.35rem',
                  lineHeight: 1,
                  padding: '0.3rem',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                &times;
              </button>
            </div>

            {/* Navigation Groups */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', flex: 1 }}>
              {sections.map((sec) => (
                <div key={sec.category}>
                  <div
                    style={{
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                      color: 'var(--text-muted)',
                      padding: '0 0.75rem 0.4rem',
                    }}
                  >
                    {sec.category}
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    {sec.items.map((item) => {
                      const isActive =
                        currentView === item.view ||
                        (item.view === 'landing' && currentView === 'landing') ||
                        (item.view === 'reader' && (currentView === 'reader' || currentView === 'landing'));

                      return (
                        <button
                          key={item.label}
                          onClick={() => handleItemClick(item.view)}
                          aria-current={isActive ? 'page' : undefined}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '0.65rem 0.85rem',
                            borderRadius: 'var(--radius-md)',
                            backgroundColor: isActive ? 'var(--accent)' : 'transparent',
                            color: isActive ? 'var(--accent-text)' : 'var(--text-primary)',
                            fontWeight: isActive ? 600 : 500,
                            fontSize: '0.9rem',
                            textAlign: 'left',
                            border: 'none',
                            cursor: 'pointer',
                            transition: `all ${currentThemeConfig.animation.transitionDuration}`,
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <span style={{ fontSize: '1.1rem', lineHeight: 1 }}>{item.icon}</span>
                            <span>{item.label}</span>
                          </div>

                          {item.badge && (
                            <span
                              style={{
                                fontSize: '0.68rem',
                                padding: '0.15rem 0.45rem',
                                borderRadius: 'var(--radius-full)',
                                backgroundColor: isActive ? 'rgba(255, 255, 255, 0.2)' : 'var(--accent-surface)',
                                color: isActive ? 'var(--accent-text)' : 'var(--text-secondary)',
                                fontWeight: 600,
                              }}
                            >
                              {item.badge}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            {/* Account / Profile trigger footer */}
            <div
              style={{
                borderTop: '1px solid var(--border-subtle)',
                paddingTop: '1rem',
                marginTop: '1rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.6rem',
              }}
            >
              <button
                onClick={() => {
                  onClose();
                  onOpenProfile();
                }}
                aria-label="View local profile preferences"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  padding: '0.7rem 0.85rem',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--bg-surface-elevated)',
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--text-primary)',
                  fontSize: '0.85rem',
                  fontWeight: 500,
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <span style={{ fontSize: '1.3rem' }}>👤</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {localStorage.getItem('swr_user_name') || 'Guest Reader'}
                  </div>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    No account • local reading data
                  </span>
                </div>
              </button>

              <div
                style={{
                  fontSize: '0.72rem',
                  color: 'var(--text-muted)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '0 0.25rem',
                }}
              >
                <span>Theme: {currentThemeConfig.name}</span>
                <span>WCAG AA</span>
              </div>
            </div>
          </motion.nav>
        </div>
      )}
    </AnimatePresence>
  );
};
