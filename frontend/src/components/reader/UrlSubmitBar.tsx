import React, { useState } from 'react';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { validateArticleUrl } from '../../utils/urlValidator';
import { isFixtureModeEnabled } from '../../services/api';
import { SAMPLE_ARTICLES } from '../../services/fixtures/sampleArticles';

export interface UrlSubmitBarProps {
  onSubmit: (url: string) => void;
  isLoading?: boolean;
  initialUrl?: string;
}

export const UrlSubmitBar: React.FC<UrlSubmitBarProps> = ({
  onSubmit,
  isLoading = false,
  initialUrl = '',
}) => {
  const [url, setUrl] = useState(initialUrl);
  const [error, setError] = useState<string | undefined>();
  const isFixture = isFixtureModeEnabled();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const validation = validateArticleUrl(url);

    if (!validation.isValid) {
      setError(validation.errorMessage);
      return;
    }

    setError(undefined);
    onSubmit(validation.sanitizedUrl || url.trim());
  };

  const handleSampleClick = (sampleUrl: string) => {
    setUrl(sampleUrl);
    setError(undefined);
    onSubmit(sampleUrl);
  };

  return (
    <div style={{ width: '100%', maxWidth: '680px', margin: '0 auto' }}>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'flex-start' }}>
          <div style={{ flex: 1 }}>
            <Input
              type="text"
              placeholder="Paste any article link (e.g., https://example.com/essay)"
              value={url}
              onChange={(e) => {
                setUrl(e.target.value);
                if (error) setError(undefined);
              }}
              onClear={() => {
                setUrl('');
                setError(undefined);
              }}
              errorMessage={error}
              disabled={isLoading}
              aria-label="Article Web Address"
              autoFocus
            />
          </div>
          <Button type="submit" variant="primary" size="md" isLoading={isLoading} disabled={!url.trim()}>
            Read Article
          </Button>
        </div>

        {/* Quick sample link pills */}
        {isFixture && (
          <div style={{ marginTop: '0.75rem' }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.35rem' }}>
              Demo samples — read locally from fixtures; no article is fetched:
            </span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
              {Object.entries(SAMPLE_ARTICLES).map(([sampleUrl, article]) => (
                <button
                  key={sampleUrl}
                  type="button"
                  onClick={() => handleSampleClick(sampleUrl)}
                  disabled={isLoading}
                  style={{
                    fontSize: '0.78rem',
                    padding: '0.25rem 0.6rem',
                    borderRadius: 'var(--radius-full)',
                    backgroundColor: 'var(--bg-surface-elevated)',
                    color: 'var(--text-secondary)',
                    border: '1px solid var(--border-subtle)',
                    transition: 'all var(--transition-fast)',
                  }}
                  title={article.title}
                >
                  {article.title.length > 28 ? `${article.title.substring(0, 28)}…` : article.title}
                </button>
              ))}
            </div>
          </div>
        )}
      </form>
    </div>
  );
};
