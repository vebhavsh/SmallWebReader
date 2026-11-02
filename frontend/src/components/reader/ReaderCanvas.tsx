import React, { useMemo, useState, useEffect } from 'react';
import DOMPurify from 'dompurify';
import { Article } from '../../types/article';
import { ArticleHeader } from './ArticleHeader';
import { isBookmarked, addBookmark, removeBookmark, addHistoryEntry, isArticleRead, setArticleRead } from '../../utils/storage';
import { getCachedArticle } from '../../utils/offlineStore';

export interface ReaderCanvasProps {
  article: Article;
  onNotify?: (msg: string, type?: 'success' | 'error' | 'info') => void;
  /**
   * Called once per unique article URL per session to record reading stats.
   * The parent is responsible for deduplication — this component simply fires
   * the callback whenever article.url changes.
   */
  onArticleRead?: (url: string, wordCount: number, readingTimeMinutes: number) => void;
}

export const ReaderCanvas: React.FC<ReaderCanvasProps> = ({ article, onNotify, onArticleRead }) => {
  const [bookmarked, setBookmarked] = useState(false);
  const [isRead, setIsRead] = useState(false);
  const [isCachedOffline, setIsCachedOffline] = useState(false);

  useEffect(() => {
    setBookmarked(isBookmarked(article.url));
    setIsRead(isArticleRead(article.url));
    void getCachedArticle(article.url)
      .then((cached) => setIsCachedOffline(Boolean(cached)))
      .catch(() => setIsCachedOffline(false));
    // Record in history (addHistoryEntry already deduplicates by URL)
    addHistoryEntry({
      url: article.url,
      title: article.title,
      siteName: article.siteName,
    });
    // Delegate stat recording to the parent so deduplication lives in one place.
    // Only record verified reading sessions when textual content exists.
    // Use 0 rather than fictional fallbacks when real values are unavailable.
    if (article.content && article.content.trim()) {
      onArticleRead?.(article.url, article.wordCount ?? 0, article.readingTimeMinutes ?? 0);
    }
  }, [article.url]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleReadStatus = () => {
    const nextReadStatus = !isRead;
    setArticleRead(article.url, nextReadStatus);
    setIsRead(nextReadStatus);
    onNotify?.(nextReadStatus ? 'Marked as read on this device.' : 'Marked as unread on this device.', 'info');
  };

  const toggleBookmark = () => {
    if (bookmarked) {
      removeBookmark(article.url);
      setBookmarked(false);
      onNotify?.('Removed from library bookmarks.', 'info');
    } else {
      addBookmark({
        url: article.url,
        title: article.title,
        byline: article.byline,
        siteName: article.siteName,
        excerpt: article.excerpt,
      });
      setBookmarked(true);
      onNotify?.('Saved to your personal library!', 'success');
    }
  };

  const handleExportMarkdown = () => {
    // Generate clean markdown from article
    const md = `# ${article.title}\n\n${article.byline ? `By ${article.byline}\n\n` : ''}${article.excerpt ? `> ${article.excerpt}\n\n` : ''}${article.content.replace(/<[^>]*>/g, '').trim()}\n\n---\n*Source: ${article.url}*`;
    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${article.title.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 40)}.md`;
    a.click();
    URL.revokeObjectURL(url);
    onNotify?.('Exported article as Markdown file.', 'success');
  };

  const handleCopyText = async () => {
    try {
      const plain = article.content.replace(/<[^>]*>/g, '').trim();
      await navigator.clipboard.writeText(`${article.title}\n\n${plain}`);
      onNotify?.('Article text copied to clipboard.', 'success');
    } catch {
      onNotify?.('Unable to copy text to clipboard.', 'error');
    }
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: article.title,
          url: article.url,
        });
      } catch {
        // User cancelled share
      }
    } else {
      await handleCopyText();
    }
  };

  // Defensive HTML sanitization via DOMPurify
  const sanitizedContent = useMemo(() => {
    if (!article.content || !article.content.trim()) return '';

    let formatted = article.content;
    // If the content is plain text (no HTML tags), format paragraphs for clean reader typography
    if (!/<[a-z][\s\S]*>/i.test(formatted)) {
      formatted = formatted
        .split(/\n\s*\n/)
        .map((p) => p.trim())
        .filter(Boolean)
        .map((p) => `<p>${p.replace(/\n/g, '<br />')}</p>`)
        .join('');
    }

    const cleanHtml = DOMPurify.sanitize(formatted, {
      ALLOWED_TAGS: [
        'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
        'blockquote', 'ul', 'ol', 'li', 'strong', 'em', 'b', 'i', 'u',
        'a', 'img', 'figure', 'figcaption', 'pre', 'code', 'hr', 'br',
        'table', 'caption', 'thead', 'tbody', 'tr', 'th', 'td', 'span', 'section', 'div',
      ],
      ALLOWED_ATTR: ['href', 'src', 'alt', 'title', 'class', 'target', 'rel'],
      ADD_ATTR: ['target', 'rel'],
      FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form', 'input'],
      FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover'],
    });

    const parsed = new DOMParser().parseFromString(cleanHtml, 'text/html');
    parsed.querySelectorAll('a[href], img[src]').forEach((element) => {
      const attribute = element.tagName.toLowerCase() === 'img' ? 'src' : 'href';
      const rawUrl = element.getAttribute(attribute);
      try {
        const url = new URL(rawUrl || '', article.url);
        if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
          if (element.tagName.toLowerCase() === 'img') element.remove();
          else element.removeAttribute(attribute);
          return;
        }
        element.setAttribute(attribute, url.href);
      } catch {
        if (element.tagName.toLowerCase() === 'img') element.remove();
        else element.removeAttribute(attribute);
      }
    });
    return parsed.body.innerHTML;
  }, [article.content]);

  return (
    <article className="reader-canvas">
      {/* Action Toolbar above Article */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'flex-end',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '0.5rem',
          marginBottom: '1.5rem',
        }}
      >
        {isCachedOffline && (
          <span aria-label="Available offline" style={{ marginRight: 'auto', padding: '0.35rem 0.6rem', borderRadius: 'var(--radius-full)', background: 'var(--accent-surface)', color: 'var(--text-secondary)', fontSize: '0.75rem', fontWeight: 600 }}>
            Available offline
          </span>
        )}
        <button
          type="button"
          onClick={toggleReadStatus}
          aria-label={isRead ? 'Mark article unread' : 'Mark article read'}
          style={{
            padding: '0.4rem 0.75rem',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border-subtle)',
            backgroundColor: 'var(--bg-surface)',
            color: 'var(--text-secondary)',
            fontSize: '0.82rem',
            cursor: 'pointer',
          }}
        >
          {isRead ? 'Mark unread' : 'Mark read'}
        </button>
        <button
          onClick={toggleBookmark}
          aria-label={bookmarked ? 'Remove bookmark' : 'Save bookmark'}
          style={{
            padding: '0.4rem 0.75rem',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border-subtle)',
            backgroundColor: bookmarked ? 'var(--accent)' : 'var(--bg-surface)',
            color: bookmarked ? 'var(--accent-text)' : 'var(--text-secondary)',
            fontSize: '0.82rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.35rem',
            cursor: 'pointer',
          }}
        >
          <span>{bookmarked ? '★' : '☆'}</span>
          <span>{bookmarked ? 'Saved' : 'Bookmark'}</span>
        </button>

        <button
          onClick={handleExportMarkdown}
          title="Export article as clean Markdown"
          style={{
            padding: '0.4rem 0.75rem',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border-subtle)',
            backgroundColor: 'var(--bg-surface)',
            color: 'var(--text-secondary)',
            fontSize: '0.82rem',
            cursor: 'pointer',
          }}
        >
          Export .MD
        </button>

        <button
          onClick={handleCopyText}
          title="Copy article text"
          style={{
            padding: '0.4rem 0.75rem',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border-subtle)',
            backgroundColor: 'var(--bg-surface)',
            color: 'var(--text-secondary)',
            fontSize: '0.82rem',
            cursor: 'pointer',
          }}
        >
          Copy Text
        </button>

        <button
          onClick={handleShare}
          title="Share article link"
          style={{
            padding: '0.4rem 0.75rem',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border-subtle)',
            backgroundColor: 'var(--bg-surface)',
            color: 'var(--text-secondary)',
            fontSize: '0.82rem',
            cursor: 'pointer',
          }}
        >
          Share
        </button>
      </div>

      <ArticleHeader article={article} />

      {/* Sanitized Content Body */}
      {sanitizedContent ? (
        <div
          className="reader-prose"
          dangerouslySetInnerHTML={{ __html: sanitizedContent }}
        />
      ) : (
        <div
          style={{
            padding: '3rem 1.5rem',
            textAlign: 'center',
            color: 'var(--text-muted)',
            backgroundColor: 'var(--bg-surface-elevated)',
            borderRadius: 'var(--radius-md)',
          }}
        >
          {article.excerpt ? (
            <>
              <p style={{ fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Publisher summary</p>
              <p>{article.excerpt}</p>
            </>
          ) : (
            <p>No textual content could be extracted from this article.</p>
          )}
          <p style={{ marginTop: '0.5rem', fontSize: '0.88rem' }}>
            <a href={article.url} target="_blank" rel="noopener noreferrer">
              View original article on external site ↗
            </a>
          </p>
        </div>
      )}

      {/* Reader Footer Attribution */}
      <div
        style={{
          marginTop: '4rem',
          paddingTop: '2rem',
          borderTop: '1px solid var(--border-subtle)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
          fontSize: '0.85rem',
          color: 'var(--text-muted)',
        }}
      >
        <span>End of article</span>
        <a
          href={article.url}
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: 'var(--text-secondary)' }}
        >
          Read original at {article.siteName || 'source'} ↗
        </a>
      </div>
    </article>
  );
};
