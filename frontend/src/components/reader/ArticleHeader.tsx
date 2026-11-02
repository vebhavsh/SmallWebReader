import React from 'react';
import { Article } from '../../types/article';

export interface ArticleHeaderProps {
  article: Article;
}

export const ArticleHeader: React.FC<ArticleHeaderProps> = ({ article }) => {
  const formattedDate = article.publishedDate
    ? (() => {
        try {
          return new Date(article.publishedDate).toLocaleDateString(undefined, {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          });
        } catch {
          return null;
        }
      })()
    : null;

  let hostname = '';
  try {
    hostname = new URL(article.url).hostname;
  } catch {
    hostname = article.siteName || '';
  }

  let leadImageUrl: string | null = null;
  if (article.leadImageUrl) {
    try {
      const imageUrl = new URL(article.leadImageUrl, article.url);
      if (['http:', 'https:'].includes(imageUrl.protocol) && !imageUrl.username && !imageUrl.password) {
        leadImageUrl = imageUrl.href;
      }
    } catch {
      leadImageUrl = null;
    }
  }

  return (
    <header style={{ marginBottom: '2rem' }}>
      {/* Site / Origin metadata */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.6rem',
          fontSize: '0.82rem',
          color: 'var(--text-muted)',
          marginBottom: '0.75rem',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          fontWeight: 600,
        }}
      >
        <span>{article.siteName || hostname}</span>
        {formattedDate && <span>•</span>}
        {formattedDate && <span>{formattedDate}</span>}
      </div>

      {/* Main Title */}
      <h1
        style={{
          fontFamily: 'var(--font-serif)',
          fontSize: 'clamp(1.7rem, 5vw, 2.4rem)',
          fontWeight: 700,
          lineHeight: 1.25,
          color: 'var(--text-primary)',
          letterSpacing: '-0.02em',
          marginBottom: '1rem',
        }}
      >
        {article.title}
      </h1>

      {/* Excerpt / Subheading */}
      {article.excerpt && (
        <p
          style={{
            fontSize: '1.2rem',
            lineHeight: 1.5,
            color: 'var(--text-secondary)',
            marginBottom: '1.25rem',
            fontStyle: 'italic',
          }}
        >
          {article.excerpt}
        </p>
      )}

      {/* Byline & Reading Statistics */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1rem',
          paddingTop: '0.85rem',
          borderTop: '1px solid var(--border-subtle)',
          fontSize: '0.85rem',
          color: 'var(--text-secondary)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {article.byline && <span>By <strong>{article.byline}</strong></span>}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: 'var(--text-muted)' }}>
          {article.readingTimeMinutes && <span>{article.readingTimeMinutes} min read</span>}
          {article.wordCount && <span>({article.wordCount.toLocaleString()} words)</span>}
          <span>•</span>
          <a
            href={article.url}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: 'var(--text-secondary)' }}
            title="Open original website"
          >
            Original source ↗
          </a>
        </div>
      </div>

      {/* Lead Image if supplied */}
      {leadImageUrl && (
        <figure style={{ marginTop: '1.75rem', marginInline: 0 }}>
          <img
            src={leadImageUrl}
            alt={article.title}
            onError={(event) => {
              event.currentTarget.style.display = 'none';
            }}
            style={{
              width: '100%',
              maxHeight: '480px',
              objectFit: 'cover',
              borderRadius: 'var(--radius-md)',
            }}
          />
        </figure>
      )}
    </header>
  );
};
