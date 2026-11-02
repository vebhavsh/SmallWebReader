-- Demo seed data for development discovery mode.
-- Seed rows are directory metadata only; this migration does not create popularity or co-occurrence counts.
-- Synthetic seed records must never be treated as genuine reader activity.

INSERT INTO canonical_feeds (canonical_url, host, title, is_seed, eligible_at)
VALUES
  ('https://www.themarginalian.org/feed/', 'themarginalian.org', 'The Marginalian', TRUE, NOW()),
  ('https://daringfireball.net/feeds/main', 'daringfireball.net', 'Daring Fireball', TRUE, NOW()),
  ('https://simonwillison.net/atom/everything/', 'simonwillison.net', 'Simon Willison''s Weblog', TRUE, NOW()),
  ('https://jvns.ca/atom.xml', 'jvns.ca', 'Julia Evans'' Blog', TRUE, NOW()),
  ('https://danluu.com/atom.xml', 'danluu.com', 'Dan Luu''s Blog', TRUE, NOW()),
  ('https://increment.com/feed/', 'increment.com', 'Increment', TRUE, NOW()),
  ('https://css-tricks.com/feed/', 'css-tricks.com', 'CSS-Tricks', TRUE, NOW()),
  ('https://www.oldeuropeanculture.com/feed/', 'oldeuropeanculture.com', 'Old European Culture', TRUE, NOW()),
  ('https://www.wilwheaton.net/feed/', 'wilwheaton.net', 'Wil Wheaton', TRUE, NOW()),
  ('https://www.aaronsw.com/2002/feeds/atom.xml', 'aaronsw.com', 'Aaron Swartz Archive', TRUE, NOW())
ON CONFLICT (canonical_url) DO NOTHING;
