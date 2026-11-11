-- NUESA blog: the public front page of nuesa.org
--
-- blog_posts    articles written by admins (markdown), published or draft
-- blog_news     headlines collected automatically from the web (title, source,
--               link, date and the feed's short summary only; never full text)
-- blog_feeds    the searches the news collector runs
-- blog_leaders  leadership cards (NSE, COREN, NUESA, Faculty, chapter)
-- blog_events   upcoming events
-- blog_state    when news was last collected
--
-- Everyone (signed in or not) can read what is published; only admins write.
-- Public read rules must not call is_admin(): visitors may not run it.

CREATE TABLE IF NOT EXISTS public.blog_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  excerpt text,
  content text NOT NULL DEFAULT '',
  category text NOT NULL DEFAULT 'nuesa',
  cover_url text,
  author_name text NOT NULL DEFAULT 'NUESA Editorial',
  author_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  published boolean NOT NULL DEFAULT false,
  featured boolean NOT NULL DEFAULT false,
  published_at timestamptz,
  views integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS blog_posts_pub_idx ON public.blog_posts (published, published_at DESC);

CREATE TABLE IF NOT EXISTS public.blog_feeds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  query text NOT NULL,
  category text NOT NULL DEFAULT 'engineering',
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.blog_news (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  link text NOT NULL UNIQUE,
  title_key text,
  source text,
  source_url text,
  summary text,
  category text NOT NULL DEFAULT 'engineering',
  feed_id uuid REFERENCES public.blog_feeds (id) ON DELETE SET NULL,
  published_at timestamptz,
  hidden boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS blog_news_pub_idx ON public.blog_news (hidden, published_at DESC);
CREATE INDEX IF NOT EXISTS blog_news_title_key_idx ON public.blog_news (title_key);

CREATE TABLE IF NOT EXISTS public.blog_leaders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  body text NOT NULL,
  name text NOT NULL,
  role text NOT NULL,
  photo_url text,
  term text,
  bio text,
  source_url text,
  sort integer NOT NULL DEFAULT 100,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.blog_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  starts_at timestamptz NOT NULL,
  location text,
  description text,
  link text,
  published boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.blog_state (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  last_fetch_at timestamptz,
  last_fetch_added integer,
  last_fetch_error text
);
INSERT INTO public.blog_state (id) VALUES (true) ON CONFLICT DO NOTHING;

-- Access rules
ALTER TABLE public.blog_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blog_feeds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blog_news ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blog_leaders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blog_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blog_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone reads published posts" ON public.blog_posts FOR SELECT USING (published);
CREATE POLICY "Admins manage posts" ON public.blog_posts FOR ALL TO authenticated USING ((SELECT public.is_admin())) WITH CHECK ((SELECT public.is_admin()));

CREATE POLICY "Anyone reads visible news" ON public.blog_news FOR SELECT USING (NOT hidden);
CREATE POLICY "Admins manage news" ON public.blog_news FOR ALL TO authenticated USING ((SELECT public.is_admin())) WITH CHECK ((SELECT public.is_admin()));

CREATE POLICY "Admins manage feeds" ON public.blog_feeds FOR ALL TO authenticated USING ((SELECT public.is_admin())) WITH CHECK ((SELECT public.is_admin()));

CREATE POLICY "Anyone reads active leaders" ON public.blog_leaders FOR SELECT USING (active);
CREATE POLICY "Admins manage leaders" ON public.blog_leaders FOR ALL TO authenticated USING ((SELECT public.is_admin())) WITH CHECK ((SELECT public.is_admin()));

CREATE POLICY "Anyone reads published events" ON public.blog_events FOR SELECT USING (published);
CREATE POLICY "Admins manage events" ON public.blog_events FOR ALL TO authenticated USING ((SELECT public.is_admin())) WITH CHECK ((SELECT public.is_admin()));

CREATE POLICY "Anyone reads blog state" ON public.blog_state FOR SELECT USING (true);

GRANT SELECT ON public.blog_posts, public.blog_news, public.blog_leaders, public.blog_events, public.blog_state TO anon;

-- Article views, counted without letting visitors edit posts
CREATE OR REPLACE FUNCTION public.blog_count_view(p_slug text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE blog_posts SET views = views + 1 WHERE slug = p_slug AND published;
$$;
REVOKE ALL ON FUNCTION public.blog_count_view(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.blog_count_view(text) TO anon, authenticated;

-- Keep updated_at fresh
CREATE OR REPLACE FUNCTION public.blog_touch()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at := now();
  IF NEW.published AND NEW.published_at IS NULL THEN NEW.published_at := now(); END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS blog_posts_touch ON public.blog_posts;
CREATE TRIGGER blog_posts_touch BEFORE INSERT OR UPDATE ON public.blog_posts
FOR EACH ROW EXECUTE FUNCTION public.blog_touch();

-- Public bucket for article covers and leader photos (admins upload)
INSERT INTO storage.buckets (id, name, public) VALUES ('blog', 'blog', true) ON CONFLICT (id) DO NOTHING;
DROP POLICY IF EXISTS "Blog images are public" ON storage.objects;
CREATE POLICY "Blog images are public" ON storage.objects FOR SELECT USING (bucket_id = 'blog');
DROP POLICY IF EXISTS "Admins upload blog images" ON storage.objects;
CREATE POLICY "Admins upload blog images" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'blog' AND (SELECT public.is_admin()));
DROP POLICY IF EXISTS "Admins change blog images" ON storage.objects;
CREATE POLICY "Admins change blog images" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'blog' AND (SELECT public.is_admin()));
DROP POLICY IF EXISTS "Admins delete blog images" ON storage.objects;
CREATE POLICY "Admins delete blog images" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'blog' AND (SELECT public.is_admin()));

-- Searches the news collector runs (admins can change these on the Blog page)
INSERT INTO public.blog_feeds (name, query, category) VALUES
  ('NUESA', '"NUESA" OR "Nigerian Universities Engineering Students"', 'nuesa'),
  ('Nigerian Society of Engineers', '"Nigerian Society of Engineers"', 'nse'),
  ('COREN', 'COREN engineering regulation Nigeria', 'coren'),
  ('University of Abuja engineering', '"University of Abuja" engineering', 'uniabuja'),
  ('Engineering in Nigeria', 'engineering Nigeria infrastructure engineers', 'engineering'),
  ('Engineering students Nigeria', 'engineering students Nigeria university', 'students')
ON CONFLICT DO NOTHING;

-- Leadership (verified November 2026; admins can edit)
INSERT INTO public.blog_leaders (body, name, role, term, bio, source_url, sort) VALUES
  ('NSE', 'Engr. Ali Alimasuya Rabiu, FNSE', '35th President', 'From 1 January 2026', 'Civil engineer from Lafia, Nasarawa State, with over 30 years in public and private practice. Former NSE Kano Branch Chairman, three-term NSE Vice President and former COREN President (elected 2019).', 'https://nse.org.ng/about/meet-the-president/', 1),
  ('NSE', 'Engr. Valerie Ifueko Agberagba, FNSE', 'Deputy President', '2026 to 2027', NULL, 'https://nse.org.ng/2026-exco-members/', 2),
  ('NSE', 'Engr. (Dr.) Halimat S. C. Adediran, FNSE', 'Vice President, Engineering Technology and Innovation Management', '2026', NULL, 'https://nse.org.ng/2026-exco-members/', 3),
  ('NSE', 'Engr. Ben Osy Okoh, FNSE', 'Vice President, Corporate Services', '2026', NULL, 'https://nse.org.ng/2026-exco-members/', 4),
  ('NSE', 'Engr. Aluyah Dauda Okodugha, PhD, FNSE', 'Vice President, Professional Development', '2026', NULL, 'https://nse.org.ng/2026-exco-members/', 5),
  ('NSE', 'Engr. Rachel Serumun Ugye, FNSE', 'Vice President, Assets Management', '2026', NULL, 'https://nse.org.ng/2026-exco-members/', 6),
  ('NSE', 'Engr. Usman Tijjani, FNSE', 'Vice President, Membership Services', '2026', NULL, 'https://nse.org.ng/2026-exco-members/', 7),
  ('NSE', 'Engr. Margaret Aina Oguntala, FNSE', 'Immediate Past President', NULL, NULL, 'https://nse.org.ng/2026-exco-members/', 8),
  ('NSE', 'Engr. Ibrahim Aliyu Dustinma, FNSE', 'Executive Secretary', NULL, NULL, 'https://nse.org.ng/2026-exco-members/', 9),
  ('COREN', 'Engr. Prof. Sadiq Zubair Abubakar, FNSE, FAEng', 'President', NULL, 'Leads the Council for the Regulation of Engineering in Nigeria, the body that registers engineers, technologists, technicians and craftsmen and accredits engineering programmes.', 'https://coren.gov.ng/coren-president-engages-total-energies-in-strategic-visit-on-25th-february-2026/', 1);

-- Feed types: 'search' runs a news search (Bing News, Google News as backup);
-- 'rss' reads a site's own feed, optionally keeping only engineering stories.
ALTER TABLE public.blog_feeds ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'search' CHECK (kind IN ('search','rss'));
ALTER TABLE public.blog_feeds ADD COLUMN IF NOT EXISTS keyword_filter boolean NOT NULL DEFAULT false;
INSERT INTO public.blog_feeds (name, query, category, kind, keyword_filter) VALUES
  ('NSE website', 'https://nse.org.ng/feed/', 'nse', 'rss', false),
  ('COREN website', 'https://coren.gov.ng/feed/', 'coren', 'rss', false),
  ('The Guardian Nigeria', 'https://guardian.ng/feed/', 'engineering', 'rss', true),
  ('Vanguard', 'https://www.vanguardngr.com/feed/', 'engineering', 'rss', true),
  ('Punch', 'https://punchng.com/feed/', 'engineering', 'rss', true),
  ('Premium Times', 'https://www.premiumtimesng.com/feed', 'engineering', 'rss', true),
  ('News Agency of Nigeria', 'https://nannews.ng/feed/', 'engineering', 'rss', true),
  ('Daily Trust', 'https://dailytrust.com/feed/', 'engineering', 'rss', true);
