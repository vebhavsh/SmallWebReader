import { Readability } from '@mozilla/readability';
import { JSDOM } from 'jsdom';

export interface ExtractedContent {
  title: string | null;
  byline: string | null;
  excerpt: string | null;
  publishedDate: string | null;
  siteName: string | null;
  leadImageUrl: string | null;
  content: string;
}

const REMOVE_WITH_CONTENT = new Set([
  'nav',
  'header',
  'footer',
  'aside',
  'script',
  'style',
  'noscript',
  'template',
  'iframe',
  'object',
  'embed',
  'form',
  'input',
  'button',
  'svg',
  'canvas',
]);

const ALLOWED_TAGS = new Set([
  'a', 'blockquote', 'br', 'caption', 'code', 'dd', 'div', 'dl', 'dt', 'em',
  'figcaption', 'figure', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'hr', 'img',
  'li', 'ol', 'p', 'pre', 'section', 'strong', 'sub', 'sup', 'table', 'tbody',
  'td', 'th', 'thead', 'tr', 'u', 'ul',
]);

const FALLBACK_REMOVE_SELECTORS = [
  'nav',
  'header',
  'footer',
  'aside',
  'script',
  'style',
  'noscript',
  'template',
  'iframe',
  'object',
  'embed',
  'form',
  '[role="navigation"]',
  '[aria-label*="cookie" i]',
  '[class*="cookie" i]',
  '[id*="cookie" i]',
  '[class*="advert" i]',
  '[id*="advert" i]',
  '[class*="newsletter" i]',
  '[class*="sidebar" i]',
  '[class*="related" i]',
  '[class*="recommend" i]',
  '[class*="popup" i]',
];

function metaContent(document: Document, selectors: string[]): string | null {
  for (const selector of selectors) {
    const value = document.querySelector(selector)?.getAttribute('content')?.trim();
    if (value) return value;
  }
  return null;
}

function resolveSafeUrl(raw: string | null, baseUrl: string): string | null {
  if (!raw) return null;
  try {
    const url = new URL(raw, baseUrl);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return null;
    return url.href;
  } catch {
    return null;
  }
}

function sanitizeArticleHtml(html: string, baseUrl: string): string {
  const parsed = new JSDOM(`<body>${html}</body>`, { url: baseUrl });
  const body = parsed.window.document.body;
  body.querySelectorAll(FALLBACK_REMOVE_SELECTORS.join(',')).forEach((element) => element.remove());

  for (const element of Array.from(body.querySelectorAll('*'))) {
    const tag = element.tagName.toLowerCase();
    if (REMOVE_WITH_CONTENT.has(tag)) {
      element.remove();
      continue;
    }

    if (!ALLOWED_TAGS.has(tag)) {
      element.replaceWith(...Array.from(element.childNodes));
      continue;
    }

    for (const attribute of Array.from(element.attributes)) {
      const name = attribute.name.toLowerCase();
      if (name.startsWith('on') || !['href', 'src', 'alt', 'title', 'colspan', 'rowspan'].includes(name)) {
        element.removeAttribute(attribute.name);
      }
    }

    if (tag === 'a') {
      const href = resolveSafeUrl(element.getAttribute('href'), baseUrl);
      if (href) {
        element.setAttribute('href', href);
        element.setAttribute('rel', 'noopener noreferrer');
        element.setAttribute('target', '_blank');
      } else {
        element.removeAttribute('href');
      }
    }

    if (tag === 'img') {
      const src = resolveSafeUrl(element.getAttribute('src'), baseUrl);
      if (!src) {
        element.remove();
      } else {
        element.setAttribute('src', src);
      }
    }
  }

  const result = body.innerHTML.trim();
  parsed.window.close();
  return result;
}

function extractFallback(document: Document, articleUrl: string): string {
  const selectors = [
    'article',
    '[itemprop="articleBody"]',
    'main',
    '.article-content',
    '.article-body',
    '.post-content',
    '.entry-content',
    '.story-body',
    '#pg-main-content',
    '.chapter',
  ];

  for (const selector of selectors) {
    const candidate = document.querySelector(selector);
    if (!candidate) continue;

    const copy = candidate.cloneNode(true) as Element;
    copy.querySelectorAll(FALLBACK_REMOVE_SELECTORS.join(',')).forEach((element) => element.remove());
    const text = copy.textContent?.replace(/\s+/g, ' ').trim() || '';
    const blocks = copy.querySelectorAll('p, li, blockquote, pre').length;
    if (text.length >= 100 && (blocks >= 2 || text.length >= 500)) {
      return sanitizeArticleHtml(copy.innerHTML, articleUrl);
    }
  }

  const isGutenberg = /gutenberg/i.test(document.documentElement.innerHTML)
    || /gutenberg/i.test(document.title)
    || Boolean(document.querySelector('#pg-header, .pg-boilerplate'));
  if (isGutenberg) {
    const copy = document.body.cloneNode(true) as HTMLElement;
    copy.querySelectorAll(FALLBACK_REMOVE_SELECTORS.join(',')).forEach((element) => element.remove());
    const text = copy.textContent?.replace(/\s+/g, ' ').trim() || '';
    if (text.length >= 500) return sanitizeArticleHtml(copy.innerHTML, articleUrl);
  }

  return '';
}

function isUsefulArticle(content: string): boolean {
  if (!content) return false;
  const parsed = new JSDOM(`<body>${content}</body>`);
  const body = parsed.window.document.body;
  const text = body.textContent?.replace(/\s+/g, ' ').trim() || '';
  const blocks = body.querySelectorAll('p, li, blockquote, pre').length;
  parsed.window.close();
  return text.length >= 80 && (blocks > 0 || text.length >= 500);
}

export function extractContent(html: string, articleUrl: string): ExtractedContent | null {
  const dom = new JSDOM(html, { url: articleUrl });
  const document = dom.window.document;

  const publishedRaw = metaContent(document, [
    'meta[property="article:published_time"]',
    'meta[name="datePublished"]',
    'meta[itemprop="datePublished"]',
    'meta[name="date"]',
    'time[datetime]',
  ]) || document.querySelector('time[datetime]')?.getAttribute('datetime') || null;
  const publishedDate = publishedRaw && !Number.isNaN(Date.parse(publishedRaw))
    ? new Date(publishedRaw).toISOString()
    : null;
  const originalTitle = metaContent(document, ['meta[property="og:title"]']) || document.title.trim() || null;
  const byline = metaContent(document, [
    'meta[name="author"]',
    'meta[property="article:author"]',
    'meta[name="parsely-author"]',
  ]) || document.querySelector('[rel="author"]')?.textContent?.trim() || null;
  const excerpt = metaContent(document, [
    'meta[property="og:description"]',
    'meta[name="description"]',
  ]);
  const siteName = metaContent(document, ['meta[property="og:site_name"]']) || new URL(articleUrl).hostname;

  const readabilityDom = new JSDOM(html, { url: articleUrl });
  const parsed = new Readability(readabilityDom.window.document, { charThreshold: 80 }).parse();
  readabilityDom.window.close();
  const readableContent = parsed?.content
    ? sanitizeArticleHtml(parsed.content, articleUrl)
    : '';
  let content = isUsefulArticle(readableContent)
    ? readableContent
    : extractFallback(document, articleUrl);
  if (!isUsefulArticle(content)) content = '';

  const leadImageUrl = resolveSafeUrl(
    metaContent(document, ['meta[property="og:image"]']) || contentImage(content),
    articleUrl,
  );
  const title = parsed?.title?.trim() || originalTitle;
  const result: ExtractedContent | null = content ? {
    title,
    byline: parsed?.byline?.trim() || byline,
    excerpt: parsed?.excerpt?.trim() || excerpt,
    publishedDate,
    siteName: parsed?.siteName?.trim() || siteName,
    leadImageUrl,
    content,
  } : null;

  dom.window.close();
  return result;
}

function contentImage(content: string): string | null {
  const parsed = new JSDOM(`<body>${content}</body>`);
  const image = parsed.window.document.querySelector('img')?.getAttribute('src') || null;
  parsed.window.close();
  return image;
}
