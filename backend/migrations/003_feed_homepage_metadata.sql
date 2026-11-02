-- Keep publisher homepages separate from RSS/Atom subscription URLs.
ALTER TABLE canonical_feeds
  ADD COLUMN IF NOT EXISTS website_url TEXT;

-- Existing feed records remain intact; this only adds verified homepage metadata.
UPDATE canonical_feeds
SET website_url = CASE canonical_url
  WHEN 'https://www.themarginalian.org/feed/' THEN 'https://www.themarginalian.org/'
  WHEN 'https://daringfireball.net/feeds/main' THEN 'https://daringfireball.net/'
  WHEN 'https://simonwillison.net/atom/everything/' THEN 'https://simonwillison.net/'
  WHEN 'https://jvns.ca/atom.xml' THEN 'https://jvns.ca/'
  WHEN 'https://danluu.com/atom.xml' THEN 'https://danluu.com/'
  WHEN 'https://increment.com/feed/' THEN 'https://increment.com/'
  WHEN 'https://css-tricks.com/feed/' THEN 'https://css-tricks.com/'
  WHEN 'https://www.wilwheaton.net/feed/' THEN 'https://wilwheaton.net/'
  ELSE website_url
END
WHERE canonical_url IN (
  'https://www.themarginalian.org/feed/',
  'https://daringfireball.net/feeds/main',
  'https://simonwillison.net/atom/everything/',
  'https://jvns.ca/atom.xml',
  'https://danluu.com/atom.xml',
  'https://increment.com/feed/',
  'https://css-tricks.com/feed/',
  'https://www.wilwheaton.net/feed/'
);

-- Official replacements advertised by their publisher homepages. Existing feed
-- records and subscriptions are not deleted or rewritten.
INSERT INTO canonical_feeds (canonical_url, host, title, website_url, is_seed, eligible_at)
VALUES
  ('https://feeds.feedburner.com/brainpickings/rss', 'themarginalian.org', 'The Marginalian', 'https://www.themarginalian.org/', TRUE, NOW()),
  ('https://increment.com/feed.xml', 'increment.com', 'Increment', 'https://increment.com/', TRUE, NOW())
ON CONFLICT (canonical_url) DO UPDATE
SET host = EXCLUDED.host,
    title = EXCLUDED.title,
    website_url = EXCLUDED.website_url,
    is_seed = TRUE;
