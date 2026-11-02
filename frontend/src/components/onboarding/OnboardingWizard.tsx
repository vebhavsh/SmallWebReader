import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  ThemeId,
  ReadingGenre,
  ReadingStyle,
  UserProfile,
} from '../../types/article';
import { useTheme } from '../theme/ThemeProvider';
import {
  fadeInUp,
  buttonHover,
  cardHover,
  staggerContainer,
  staggerItem,
} from '../../utils/animations';
import { saveUserProfile, setOnboardingCompleted } from '../../utils/storage';

export interface OnboardingWizardProps {
  onComplete: () => void;
  onSkipToGuest: () => void;
}

export const GENRES: { id: ReadingGenre; label: string; icon: string }[] = [
  { id: 'Technology', label: 'Technology', icon: '💻' },
  { id: 'Science', label: 'Science', icon: '🔬' },
  { id: 'Business', label: 'Business', icon: '📈' },
  { id: 'Finance', label: 'Finance', icon: '🪙' },
  { id: 'Psychology', label: 'Psychology', icon: '🧠' },
  { id: 'History', label: 'History', icon: '🏛️' },
  { id: 'Philosophy', label: 'Philosophy', icon: '💭' },
  { id: 'Literature', label: 'Literature', icon: '📚' },
  { id: 'Education', label: 'Education', icon: '🎓' },
  { id: 'News', label: 'News', icon: '📰' },
  { id: 'Design', label: 'Design', icon: '🎨' },
  { id: 'Entertainment', label: 'Entertainment', icon: '🎬' },
  { id: 'Lifestyle', label: 'Lifestyle', icon: '☕' },
  { id: 'Other', label: 'Other', icon: '✨' },
];

export const READING_STYLES: { id: ReadingStyle; label: string; icon: string; desc: string }[] = [
  {
    id: 'casual',
    label: 'Casual Reading',
    icon: '🛋️',
    desc: 'Relaxed pacing with generous margins and easy font scaling.',
  },
  {
    id: 'deep-focus',
    label: 'Deep Focus',
    icon: '🎯',
    desc: 'Distraction-free typography, subdued contrast, and focused line measures.',
  },
  {
    id: 'academic',
    label: 'Academic Reading',
    icon: '📖',
    desc: 'Dense layouts, classical serifs, and high-clarity heading hierarchies.',
  },
  {
    id: 'quick',
    label: 'Quick Reading',
    icon: '⚡',
    desc: 'Compact line heights and rapid scanning typography with sans-serif clarity.',
  },
  {
    id: 'night',
    label: 'Night Reading',
    icon: '🌙',
    desc: 'Ultra-low eye strain dark slate backgrounds and subdued luminance.',
  },
];

import { THEME_CONFIGS } from '../../theme/themeConfig';

export interface ThemeMeta {
  id: ThemeId;
  name: string;
  bg: string;
  surface: string;
  accent: string;
  text: string;
  fontName: string;
  fontStack: string;
  soundtrack: string;
  animationStyle: string;
  sampleHeadline: string;
  sampleExcerpt: string;
}

export const THEMES_META: ThemeMeta[] = Object.values(THEME_CONFIGS).map((t) => ({
  id: t.id,
  name: t.name,
  bg: t.colors.bgPage,
  surface: t.colors.bgSurface,
  accent: t.colors.accent,
  text: t.colors.textPrimary,
  fontName: t.typography.fontSerif,
  fontStack: t.typography.bodyFamily,
  soundtrack: t.soundtrack.title,
  animationStyle: t.animation.name,
  sampleHeadline: t.sampleHeadline,
  sampleExcerpt: t.sampleExcerpt,
}));

const AVATAR_OPTIONS = ['📚', '🍵', '🦉', '🌿', '⚡', '✒️', '🪐', '🌊'];

export const OnboardingWizard: React.FC<OnboardingWizardProps> = ({
  onComplete,
  onSkipToGuest,
}) => {
  const { updateSettings } = useTheme();

  const [step, setStep] = useState<number>(1);
  const totalSteps = 6;

  // State collected across steps
  const [selectedGenres, setSelectedGenres] = useState<ReadingGenre[]>([
    'Technology',
    'Literature',
    'Philosophy',
  ]);
  const [selectedStyle, setSelectedStyle] = useState<ReadingStyle>('deep-focus');
  const [selectedTheme, setSelectedTheme] = useState<ThemeId>('editorial-zen');
  const [selectedSoundtrack, setSelectedSoundtrack] = useState<string>('Zen Flute & Gentle Rain');
  const [displayName, setDisplayName] = useState<string>('Guest Reader');
  const [username, setUsername] = useState<string>('guest_reader');
  const [avatar, setAvatar] = useState<string>('📚');
  const [dailyMinutes, setDailyMinutes] = useState<number>(30);
  const [dailyArticles, setDailyArticles] = useState<number>(3);

  // When theme changes in step 4, apply preview in real-time
  const handleSelectTheme = (themeMeta: ThemeMeta) => {
    setSelectedTheme(themeMeta.id);
    setSelectedSoundtrack(themeMeta.soundtrack);
    updateSettings({ theme: themeMeta.id });
  };

  const toggleGenre = (genre: ReadingGenre) => {
    if (selectedGenres.includes(genre)) {
      if (selectedGenres.length > 1) {
        setSelectedGenres(selectedGenres.filter((g) => g !== genre));
      }
    } else {
      setSelectedGenres([...selectedGenres, genre]);
    }
  };

  const handleNext = () => {
    if (step < totalSteps) {
      setStep((prev) => prev + 1);
    } else {
      handleFinalSubmit();
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep((prev) => prev - 1);
    }
  };

  const handleFinalSubmit = () => {
    const finalProfile: UserProfile = {
      displayName: displayName.trim() || 'Guest Reader',
      username: username.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_') || 'guest_reader',
      avatar,
      preferredGenres: selectedGenres,
      readingStyle: selectedStyle,
      preferredTheme: selectedTheme,
      soundtrack: selectedSoundtrack,
      readingGoal: { dailyArticles, dailyMinutes },
      accountType: 'guest',
    };

    saveUserProfile(finalProfile);
    setOnboardingCompleted(true);
    updateSettings({ theme: selectedTheme });
    onComplete();
  };

  const progressPercent = Math.round((step / totalSteps) * 100);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        backgroundColor: 'var(--bg-page)',
        color: 'var(--text-primary)',
        display: 'flex',
        flexDirection: 'column',
        overflowY: 'auto',
        transition: 'background-color var(--transition-normal), color var(--transition-normal)',
      }}
    >
      {/* Top Header with Progress Bar */}
      <header
        style={{
          padding: '1.25rem 2rem',
          borderBottom: '1px solid var(--border-subtle)',
          backgroundColor: 'var(--bg-surface)',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.75rem',
          position: 'sticky',
          top: 0,
          zIndex: 50,
        }}
      >
        <div style={{ maxWidth: '900px', margin: '0 auto', width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <span style={{ fontSize: '1.4rem' }}>📖</span>
            <span style={{ fontFamily: 'var(--font-serif)', fontSize: '1.15rem', fontWeight: 700 }}>
              SmallWebReader
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)' }}>
              Step {step} of {totalSteps}
            </span>
            <button
              onClick={onSkipToGuest}
              style={{
                fontSize: '0.82rem',
                color: 'var(--text-secondary)',
                textDecoration: 'underline',
                cursor: 'pointer',
              }}
            >
              Skip Setup
            </button>
          </div>
        </div>

        {/* Animated Progress Bar */}
        <div style={{ maxWidth: '900px', margin: '0 auto', width: '100%', height: '4px', backgroundColor: 'var(--bg-surface-elevated)', borderRadius: '999px', overflow: 'hidden' }}>
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${progressPercent}%` }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            style={{ height: '100%', backgroundColor: 'var(--accent)' }}
          />
        </div>
      </header>

      {/* Main Wizard Container */}
      <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '2.5rem 1.5rem 4rem' }}>
        <div style={{ maxWidth: '780px', width: '100%' }}>
          {/* STEP 1: WELCOME & HOW IT WORKS */}
            {step === 1 && (
              <motion.div
                key="step-1"
                {...fadeInUp}
                style={{ textAlign: 'center' }}
              >
                <span style={{ fontSize: '0.85rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)', display: 'block', marginBottom: '0.75rem' }}>
                  Welcome to Distraction-Free Reading
                </span>
                <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '2.6rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '1rem', lineHeight: 1.2 }}>
                  How SmallWebReader Works
                </h2>
                <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem', maxWidth: '560px', margin: '0 auto 2.5rem', lineHeight: 1.6 }}>
                  We strip the aggressive clutter from the modern web so you can engage with long-form ideas in serene comfort.
                </p>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem', textAlign: 'left', marginBottom: '2.5rem' }}>
                  <div style={{ padding: '1.5rem', borderRadius: 'var(--radius-lg)', backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', boxShadow: 'var(--shadow-sm)' }}>
                    <div style={{ width: '36px', height: '36px', borderRadius: '50%', backgroundColor: 'var(--accent)', color: 'var(--accent-text)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, marginBottom: '0.85rem' }}>1</div>
                    <h3 style={{ fontSize: '1.05rem', fontWeight: 600, marginBottom: '0.35rem' }}>Paste Any URL</h3>
                    <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                      Drop in any web essay, news article, or technical document link.
                    </p>
                  </div>

                  <div style={{ padding: '1.5rem', borderRadius: 'var(--radius-lg)', backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', boxShadow: 'var(--shadow-sm)' }}>
                    <div style={{ width: '36px', height: '36px', borderRadius: '50%', backgroundColor: 'var(--accent)', color: 'var(--accent-text)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, marginBottom: '0.85rem' }}>2</div>
                    <h3 style={{ fontSize: '1.05rem', fontWeight: 600, marginBottom: '0.35rem' }}>Sanitize & Clean</h3>
                    <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                      Popups, trackers, and noisy ads vanish through defense-in-depth sanitization.
                    </p>
                  </div>

                  <div style={{ padding: '1.5rem', borderRadius: 'var(--radius-lg)', backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', boxShadow: 'var(--shadow-sm)' }}>
                    <div style={{ width: '36px', height: '36px', borderRadius: '50%', backgroundColor: 'var(--accent)', color: 'var(--accent-text)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, marginBottom: '0.85rem' }}>3</div>
                    <h3 style={{ fontSize: '1.05rem', fontWeight: 600, marginBottom: '0.35rem' }}>Custom Reading</h3>
                    <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                      Experience your prose in 8 dynamic themes with fine-tuned font scaling and soundscapes.
                    </p>
                  </div>
                </div>
              </motion.div>
            )}

            {/* STEP 2: READING PREFERENCES / GENRES */}
            {step === 2 && (
              <motion.div
                key="step-2"
                {...fadeInUp}
              >
                <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)' }}>
                    Preferences
                  </span>
                  <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '2.2rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '0.35rem' }}>
                    What do you enjoy reading?
                  </h2>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', marginTop: '0.5rem' }}>
                    Select all topics that interest you. We use this to curate your personal reading space.
                  </p>
                </div>

                <motion.div
                  variants={staggerContainer}
                  initial="initial"
                  animate="animate"
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
                    gap: '0.85rem',
                    marginBottom: '2rem',
                  }}
                >
                  {GENRES.map((genre) => {
                    const isSelected = selectedGenres.includes(genre.id);
                    return (
                      <motion.button
                        key={genre.id}
                        variants={staggerItem}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => toggleGenre(genre.id)}
                        type="button"
                        aria-pressed={isSelected}
                        style={{
                          padding: '0.85rem 1rem',
                          borderRadius: 'var(--radius-md)',
                          backgroundColor: isSelected ? 'var(--accent)' : 'var(--bg-surface)',
                          color: isSelected ? 'var(--accent-text)' : 'var(--text-primary)',
                          border: isSelected ? '2px solid var(--accent)' : '1px solid var(--border-subtle)',
                          boxShadow: isSelected ? 'var(--shadow-md)' : 'var(--shadow-sm)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.6rem',
                          fontSize: '0.92rem',
                          fontWeight: isSelected ? 600 : 500,
                          cursor: 'pointer',
                          transition: 'all var(--transition-fast)',
                          textAlign: 'left',
                        }}
                      >
                        <span style={{ fontSize: '1.25rem' }}>{genre.icon}</span>
                        <span style={{ flex: 1 }}>{genre.label}</span>
                        {isSelected && <span style={{ fontSize: '0.85rem', fontWeight: 700 }}>✓</span>}
                      </motion.button>
                    );
                  })}
                </motion.div>
              </motion.div>
            )}

            {/* STEP 3: READING STYLE */}
            {step === 3 && (
              <motion.div
                key="step-3"
                {...fadeInUp}
              >
                <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)' }}>
                    Reading Pace
                  </span>
                  <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '2.2rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '0.35rem' }}>
                    What is your primary reading style?
                  </h2>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', marginTop: '0.5rem' }}>
                    This configures optimal line heights, column widths, and focus modes.
                  </p>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', marginBottom: '2rem' }}>
                  {READING_STYLES.map((style) => {
                    const isSelected = selectedStyle === style.id;
                    return (
                      <motion.button
                        key={style.id}
                        whileHover={{ y: -2 }}
                        whileTap={{ scale: 0.99 }}
                        onClick={() => setSelectedStyle(style.id)}
                        type="button"
                        style={{
                          padding: '1.25rem 1.5rem',
                          borderRadius: 'var(--radius-lg)',
                          backgroundColor: isSelected ? 'var(--bg-surface)' : 'var(--bg-surface)',
                          border: isSelected ? '2px solid var(--border-focus)' : '1px solid var(--border-subtle)',
                          boxShadow: isSelected ? 'var(--shadow-md)' : 'var(--shadow-sm)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '1.25rem',
                          textAlign: 'left',
                          cursor: 'pointer',
                          transition: 'all var(--transition-fast)',
                        }}
                      >
                        <span style={{ fontSize: '2rem' }}>{style.icon}</span>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <h3 style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                              {style.label}
                            </h3>
                            {isSelected && (
                              <span style={{ fontSize: '0.72rem', fontWeight: 700, padding: '0.1rem 0.5rem', borderRadius: '999px', backgroundColor: 'var(--accent)', color: 'var(--accent-text)' }}>
                                SELECTED
                              </span>
                            )}
                          </div>
                          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.2rem', lineHeight: 1.4 }}>
                            {style.desc}
                          </p>
                        </div>
                      </motion.button>
                    );
                  })}
                </div>
              </motion.div>
            )}

            {/* STEP 4: THEME SELECTION WITH COMPREHENSIVE PREVIEWS */}
            {step === 4 && (
              <motion.div
                key="step-4"
                {...fadeInUp}
              >
                <div style={{ textAlign: 'center', marginBottom: '1.75rem' }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)' }}>
                    Aesthetic Canvas
                  </span>
                  <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '2.2rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '0.35rem' }}>
                    Choose your default theme
                  </h2>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', marginTop: '0.4rem' }}>
                    Click any theme to preview its colors, typography, sample reading card, and ambient soundtrack.
                  </p>
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
                    gap: '1.15rem',
                    marginBottom: '2rem',
                    maxHeight: '440px',
                    overflowY: 'auto',
                    padding: '0.5rem',
                  }}
                >
                  {THEMES_META.map((t) => {
                    const isSelected = selectedTheme === t.id;
                    return (
                      <motion.div
                        key={t.id}
                        {...cardHover}
                        onClick={() => handleSelectTheme(t)}
                        style={{
                          padding: '1.25rem',
                          borderRadius: 'var(--radius-lg)',
                          backgroundColor: t.bg,
                          color: t.text,
                          border: isSelected ? `2.5px solid ${t.accent}` : '1px solid var(--border-subtle)',
                          boxShadow: isSelected ? 'var(--shadow-md)' : 'var(--shadow-sm)',
                          cursor: 'pointer',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '0.85rem',
                          position: 'relative',
                        }}
                      >
                        {/* Header with Title and Selection Tag */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontWeight: 700, fontSize: '1.1rem' }}>{t.name}</span>
                          {isSelected && (
                            <span style={{ fontSize: '0.72rem', fontWeight: 700, padding: '0.15rem 0.5rem', borderRadius: '999px', backgroundColor: t.accent, color: t.bg }}>
                              ACTIVE PREVIEW
                            </span>
                          )}
                        </div>

                        {/* Sample Mini Reading Card */}
                        <div
                          style={{
                            padding: '0.85rem',
                            borderRadius: 'var(--radius-md)',
                            backgroundColor: t.surface,
                            border: `1px solid ${t.accent}25`,
                            fontFamily: t.fontStack,
                          }}
                        >
                          <h4 style={{ fontSize: '0.92rem', fontWeight: 600, color: t.text, marginBottom: '0.3rem', lineHeight: 1.3 }}>
                            {t.sampleHeadline}
                          </h4>
                          <p style={{ fontSize: '0.78rem', color: `${t.text}CC`, lineHeight: 1.4 }}>
                            {t.sampleExcerpt}
                          </p>
                        </div>

                        {/* Theme Attributes Strip */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', fontSize: '0.75rem', opacity: 0.9 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <span style={{ fontWeight: 600 }}>🎵 Soundtrack:</span>
                            <span>{t.soundtrack}</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <span style={{ fontWeight: 600 }}>✨ Motion:</span>
                            <span>{t.animationStyle}</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <span style={{ fontWeight: 600 }}>🔤 Font:</span>
                            <span>{t.fontName}</span>
                          </div>
                        </div>

                        {/* Palette Chips */}
                        <div style={{ display: 'flex', gap: '0.35rem', marginTop: '0.2rem' }}>
                          <span title="Background" style={{ width: '16px', height: '16px', borderRadius: '50%', backgroundColor: t.bg, border: '1px solid rgba(0,0,0,0.15)' }} />
                          <span title="Surface" style={{ width: '16px', height: '16px', borderRadius: '50%', backgroundColor: t.surface, border: '1px solid rgba(0,0,0,0.15)' }} />
                          <span title="Accent" style={{ width: '16px', height: '16px', borderRadius: '50%', backgroundColor: t.accent }} />
                          <span title="Typography" style={{ width: '16px', height: '16px', borderRadius: '50%', backgroundColor: t.text }} />
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </motion.div>
            )}

            {/* STEP 5: PROFILE & GOALS */}
            {step === 5 && (
              <motion.div
                key="step-5"
                {...fadeInUp}
              >
                <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)' }}>
                    Identity
                  </span>
                  <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '2.2rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '0.35rem' }}>
                    Personalize your reader profile
                  </h2>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', marginTop: '0.4rem' }}>
                    Configure your display details and daily reading habit goals.
                  </p>
                </div>

                <div
                  style={{
                    backgroundColor: 'var(--bg-surface)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-lg)',
                    padding: '2rem',
                    boxShadow: 'var(--shadow-sm)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '1.5rem',
                    marginBottom: '2rem',
                  }}
                >
                  {/* Avatar Picker */}
                  <div>
                    <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.5rem' }}>
                      Choose Reader Avatar
                    </label>
                    <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
                      {AVATAR_OPTIONS.map((av) => (
                        <button
                          key={av}
                          type="button"
                          onClick={() => setAvatar(av)}
                          style={{
                            width: '46px',
                            height: '46px',
                            fontSize: '1.5rem',
                            borderRadius: '50%',
                            backgroundColor: avatar === av ? 'var(--accent)' : 'var(--bg-surface-elevated)',
                            border: avatar === av ? '2px solid var(--border-focus)' : '1px solid var(--border-subtle)',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'all var(--transition-fast)',
                          }}
                        >
                          {av}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Name & Username Inputs */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
                    <div>
                      <label htmlFor="onboarding-display-name" style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.35rem' }}>
                        Display Name
                      </label>
                      <input
                        id="onboarding-display-name"
                        type="text"
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        placeholder="Elena Vance"
                        style={{
                          width: '100%',
                          padding: '0.75rem 1rem',
                          borderRadius: 'var(--radius-md)',
                          border: '1px solid var(--border-subtle)',
                          backgroundColor: 'var(--bg-surface-elevated)',
                          color: 'var(--text-primary)',
                          fontSize: '0.95rem',
                        }}
                      />
                    </div>
                    <div>
                      <label htmlFor="onboarding-username" style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.35rem' }}>
                        Username
                      </label>
                      <input
                        id="onboarding-username"
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder="elena_vance"
                        style={{
                          width: '100%',
                          padding: '0.75rem 1rem',
                          borderRadius: 'var(--radius-md)',
                          border: '1px solid var(--border-subtle)',
                          backgroundColor: 'var(--bg-surface-elevated)',
                          color: 'var(--text-primary)',
                          fontSize: '0.95rem',
                        }}
                      />
                    </div>
                  </div>

                  {/* Daily Reading Goals */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                        <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                          Daily Minutes Goal
                        </label>
                        <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--accent)' }}>{dailyMinutes} mins</span>
                      </div>
                      <input
                        type="range"
                        min="10"
                        max="120"
                        step="5"
                        value={dailyMinutes}
                        onChange={(e) => setDailyMinutes(Number(e.target.value))}
                        style={{ width: '100%', accentColor: 'var(--accent)', cursor: 'pointer' }}
                      />
                    </div>

                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                        <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                          Daily Article Goal
                        </label>
                        <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--accent)' }}>{dailyArticles} articles</span>
                      </div>
                      <input
                        type="range"
                        min="1"
                        max="10"
                        step="1"
                        value={dailyArticles}
                        onChange={(e) => setDailyArticles(Number(e.target.value))}
                        style={{ width: '100%', accentColor: 'var(--accent)', cursor: 'pointer' }}
                      />
                    </div>
                  </div>

                  {/* Guest Mode Indicator */}
                  <div
                    style={{
                      padding: '0.85rem 1rem',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: 'var(--accent-surface)',
                      color: 'var(--text-secondary)',
                      fontSize: '0.82rem',
                      lineHeight: 1.5,
                      border: '1px solid var(--border-subtle)',
                    }}
                  >
                    <strong>Local Guest Profile:</strong> Preferences and reading data are stored in this browser; no account is required. Public URLs are sent to the configured API only when you request fetching or discovery. Sharing feed lists for aggregate discovery is opt-in.
                  </div>
                </div>
              </motion.div>
            )}

            {/* STEP 6: FINISH & CONFIRMATION */}
            {step === 6 && (
              <motion.div
                key="step-6"
                {...fadeInUp}
                style={{ textAlign: 'center' }}
              >
                {/* Success Checkmark Animation */}
                <motion.div
                  initial={{ scale: 0, rotate: -30 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: 'spring', damping: 12, stiffness: 200 }}
                  style={{
                    width: '72px',
                    height: '72px',
                    borderRadius: '50%',
                    backgroundColor: 'var(--accent)',
                    color: 'var(--accent-text)',
                    fontSize: '2.4rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 1.5rem',
                    boxShadow: 'var(--shadow-md)',
                  }}
                >
                  ✓
                </motion.div>

                <span style={{ fontSize: '0.85rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)' }}>
                  Setup Complete
                </span>
                <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '2.5rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '0.4rem', marginBottom: '0.85rem' }}>
                  Your reading space is ready, {displayName}.
                </h2>
                <p style={{ color: 'var(--text-secondary)', fontSize: '1.05rem', maxWidth: '520px', margin: '0 auto 2.5rem', lineHeight: 1.6 }}>
                  We’ve configured your personal environment with your chosen aesthetics and pacing. You can now read in uninterrupted peace.
                </p>

                {/* Summary Configuration Card */}
                <div
                  style={{
                    maxWidth: '480px',
                    margin: '0 auto 2.5rem',
                    padding: '1.5rem',
                    borderRadius: 'var(--radius-lg)',
                    backgroundColor: 'var(--bg-surface)',
                    border: '1px solid var(--border-subtle)',
                    boxShadow: 'var(--shadow-sm)',
                    textAlign: 'left',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.85rem',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.5rem' }}>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Reader</span>
                    <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>{avatar} {displayName} (@{username})</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.5rem' }}>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Active Theme</span>
                    <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>{THEMES_META.find((t) => t.id === selectedTheme)?.name || selectedTheme}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.5rem' }}>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Soundtrack</span>
                    <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>{selectedSoundtrack}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.5rem' }}>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Pace</span>
                    <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>{READING_STYLES.find((s) => s.id === selectedStyle)?.label}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Daily Goal</span>
                    <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>{dailyArticles} articles ({dailyMinutes} mins)</span>
                  </div>
                </div>
              </motion.div>
            )}

          {/* Navigation Controls (Back / Next) */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginTop: '1.5rem',
              paddingTop: '1.25rem',
              borderTop: '1px solid var(--border-subtle)',
            }}
          >
            {step > 1 ? (
              <button
                type="button"
                onClick={handleBack}
                style={{
                  padding: '0.65rem 1.25rem',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--bg-surface)',
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--text-primary)',
                  fontSize: '0.92rem',
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
              >
                ← Back
              </button>
            ) : (
              <div />
            )}

            <motion.button
              {...buttonHover}
              type="button"
              onClick={handleNext}
              style={{
                padding: '0.75rem 1.6rem',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--accent)',
                color: 'var(--accent-text)',
                fontSize: '0.95rem',
                fontWeight: 600,
                cursor: 'pointer',
                border: 'none',
                boxShadow: 'var(--shadow-sm)',
              }}
            >
              {step === totalSteps ? 'Enter My Reading Space →' : 'Continue →'}
            </motion.button>
          </div>
        </div>
      </div>
    </div>
  );
};
