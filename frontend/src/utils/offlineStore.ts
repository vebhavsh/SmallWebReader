export interface CachedArticleRecord {
  url: string;
  title: string;
  content: string;
  excerpt?: string | null;
  byline?: string | null;
  siteName?: string | null;
  publishedDate?: string | null;
  fetchedAt: string;
  readingTimeMinutes?: number;
  wordCount?: number;
}

const DB_NAME = 'smallwebreader-offline';
const DB_VERSION = 1;
const STORE_NAME = 'cached-articles';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) {
      reject(new Error('IndexedDB is not available in this browser.'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'url' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Failed to open IndexedDB.'));
  });
}

export async function saveCachedArticle(article: CachedArticleRecord): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.put(article);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error ?? new Error('Failed to save article to cache.'));
  });
}

export async function getCachedArticle(url: string): Promise<CachedArticleRecord | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.get(url);
    req.onsuccess = () => resolve((req.result as CachedArticleRecord | undefined) ?? null);
    req.onerror = () => reject(req.error ?? new Error('Failed to get cached article.'));
  });
}

export async function listCachedArticles(): Promise<CachedArticleRecord[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.getAll();
    req.onsuccess = () => resolve((req.result as CachedArticleRecord[]) ?? []);
    req.onerror = () => reject(req.error ?? new Error('Failed to list cached articles.'));
  });
}

export async function clearCachedArticles(): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.clear();
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error ?? new Error('Failed to clear cached articles.'));
  });
}
