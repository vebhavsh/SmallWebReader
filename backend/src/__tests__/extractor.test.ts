import fs from 'fs';
import path from 'path';
import { Readability } from '@mozilla/readability';
import { extractContent } from '../extractor';

const fixtures = path.join(__dirname, 'fixtures');
const readFixture = (name: string) => fs.readFileSync(path.join(fixtures, name), 'utf8');

describe('Readability article extraction', () => {
  it('retains semantic article structure and metadata while removing site clutter and unsafe markup', () => {
    const result = extractContent(
      readFixture('article-with-clutter.html'),
      'https://journal.example/articles/analysis/',
    );

    expect(result).not.toBeNull();
    expect(result?.title).toBe('A Real Publisher Article');
    expect(result?.byline).toBe('Alex Writer');
    expect(result?.excerpt).toContain('publisher-provided summary');
    expect(result?.publishedDate).toBe('2025-03-04T10:30:00.000Z');
    expect(result?.siteName).toBe('Example Journal');
    expect(result?.leadImageUrl).toBe('https://journal.example/articles/images/lead.jpg');
    expect(result?.content).toContain('<h2>Careful Analysis</h2>');
    expect(result?.content).toContain('<ul>');
    expect(result?.content).toContain('<blockquote>');
    expect(result?.content).toContain('<pre>');
    expect(result?.content).toContain('<table>');
    expect(result?.content).toContain('https://journal.example/articles/research');
    expect(result?.content).toContain('https://journal.example/articles/images/diagram.jpg');
    expect(result?.content).not.toMatch(/Skip to main content|Explore models|Gemini|Newsletter signup/);
    expect(result?.content).not.toMatch(/<script|onerror=|onclick=|javascript:/i);
  });

  it('uses a cleaned publisher article-content container when Readability cannot parse a page', () => {
    const parse = jest.spyOn(Readability.prototype, 'parse').mockReturnValue(null);
    let result: ReturnType<typeof extractContent>;
    try {
      result = extractContent(
        readFixture('publisher-fallback.html'),
        'https://publisher.example/features/custom/',
      );
    } finally {
      parse.mockRestore();
    }

    expect(result?.content).toContain('<h2>Second section</h2>');
    expect(result?.content).toContain('<ul>');
    expect(result?.content).not.toContain('Unrelated sidebar recommendation');
    expect(result?.content).not.toContain('Footer navigation');
  });

  it('recovers useful structure from malformed HTML', () => {
    const result = extractContent(
      readFixture('malformed-article.html'),
      'https://publisher.example/malformed',
    );

    expect(result?.content).toContain('Malformed but readable');
    expect(result?.content).toContain('final paragraph remains available');
    expect(result?.content).not.toContain('Unrelated footer content');
  });

  it('preserves long-form Project Gutenberg book text without page chrome', () => {
    const result = extractContent(
      readFixture('gutenberg-long-book.html'),
      'https://www.gutenberg.org/files/12345/12345-h/12345-h.htm',
    );

    expect(result?.content).toContain('The old house stood at the end of the lane');
    expect(result?.content).toContain('patient record of real human experience');
    expect(result?.content).not.toContain('Catalog · Donate');
    expect(result?.content).not.toContain('site footer');
  });

  it('fails cleanly for empty or navigation-only pages', () => {
    expect(extractContent('<html><body></body></html>', 'https://example.org/empty')).toBeNull();
    expect(extractContent(
      '<html><body><nav>Home About Contact Subscribe</nav></body></html>',
      'https://example.org/navigation',
    )).toBeNull();
  });
});
