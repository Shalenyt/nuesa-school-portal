import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Check, Eye, Link2, Share2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { BlogLayout } from './BlogLayout';
import { CategoryBadge, Cover, EmptyState, Markdown, Post, PostCard, fetchPosts, longDate, readingTime, useBlogData, useTitle } from './shared';

const db = supabase as any;

export default function BlogArticle() {
  const { slug = '' } = useParams();
  const [copied, setCopied] = useState(false);
  const post = useBlogData<Post>(() => db.from('blog_posts').select('*').eq('slug', slug).eq('published', true).maybeSingle(), [slug]);
  const p = post.data;
  const related = useBlogData<Post[]>(() => fetchPosts({ category: p?.category, limit: 4 }), [p?.category]);
  useTitle(p?.title || 'Article');

  useEffect(() => {
    if (!slug) return;
    const key = `nuesa_viewed_${slug}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, '1');
    } catch { /* ignore */ }
    db.rpc('blog_count_view', { p_slug: slug }).then(() => undefined);
  }, [slug]);

  const share = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) { await navigator.share({ title: p?.title, url }); return; }
      await navigator.clipboard.writeText(url);
      setCopied(true); setTimeout(() => setCopied(false), 1800);
    } catch { /* cancelled */ }
  };

  if (!post.loading && !p) {
    return <BlogLayout><div className="mx-auto max-w-3xl px-4 py-20"><EmptyState>This article could not be found. <Link to="/articles" className="text-primary underline">Browse all articles</Link></EmptyState></div></BlogLayout>;
  }

  return (
    <BlogLayout>
      {p && (
        <article>
          <div className="mx-auto max-w-3xl px-4 pt-8 sm:px-6">
            <Link to="/articles" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary"><ArrowLeft className="h-4 w-4" /> All articles</Link>
            <div className="mt-6 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <CategoryBadge category={p.category} />
              <span>{longDate(p.published_at)}</span>
              <span>·</span><span>{readingTime(p.content)} min read</span>
              <span className="inline-flex items-center gap-1"><Eye className="h-3.5 w-3.5" />{p.views}</span>
            </div>
            <h1 className="mt-4 text-3xl font-extrabold leading-tight tracking-tight sm:text-5xl">{p.title}</h1>
            {p.excerpt && <p className="mt-4 text-lg text-muted-foreground sm:text-xl">{p.excerpt}</p>}
            <div className="mt-6 flex items-center justify-between border-y py-3">
              <p className="text-sm"><span className="text-muted-foreground">By </span><span className="font-semibold">{p.author_name}</span></p>
              <button onClick={share} className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium hover:border-primary hover:text-primary">
                {copied ? <><Check className="h-4 w-4" /> Link copied</> : <>{typeof navigator !== 'undefined' && (navigator as any).share ? <Share2 className="h-4 w-4" /> : <Link2 className="h-4 w-4" />} Share</>}
              </button>
            </div>
          </div>
          {p.cover_url && (
            <div className="mx-auto mt-8 max-w-5xl px-4 sm:px-6">
              <div className="aspect-[16/8] overflow-hidden rounded-3xl"><Cover src={p.cover_url} category={p.category} /></div>
            </div>
          )}
          <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6"><Markdown text={p.content} /></div>
        </article>
      )}
      {(related.data || []).filter((r) => r.id !== p?.id).length > 0 && (
        <section className="mx-auto mt-6 max-w-7xl px-4 sm:px-6">
          <h2 className="mb-5 text-2xl font-bold">Keep reading</h2>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {(related.data || []).filter((r) => r.id !== p?.id).slice(0, 3).map((r) => <PostCard key={r.id} post={r} />)}
          </div>
        </section>
      )}
    </BlogLayout>
  );
}
