import { Fragment, ReactNode, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { formatDistanceToNowStrict } from 'date-fns';
import { ArrowRight, ExternalLink, Newspaper } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { categoryColor, categoryLabel } from './content';

const db = supabase as any;

export interface Post {
  id: string; slug: string; title: string; excerpt: string | null; content: string; category: string;
  cover_url: string | null; author_name: string; published_at: string | null; featured: boolean; views: number;
}
export interface NewsItem {
  id: string; title: string; link: string; source: string | null; source_url: string | null;
  summary: string | null; category: string; published_at: string | null;
}
export interface Leader {
  id: string; body: string; name: string; role: string; photo_url: string | null; term: string | null;
  bio: string | null; source_url: string | null; sort: number;
}
export interface BlogEvent {
  id: string; title: string; starts_at: string; location: string | null; description: string | null; link: string | null;
}

/* ---------- data ---------- */

export function useBlogData<T>(load: () => Promise<{ data: T | null }>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let alive = true;
    setLoading(true);
    load().then(({ data }) => { if (alive) { setData(data); setLoading(false); } }).catch(() => alive && setLoading(false));
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return { data, loading };
}

export const fetchPosts = (opts: { category?: string; limit?: number; search?: string } = {}) => {
  let q = db.from('blog_posts').select('id, slug, title, excerpt, content, category, cover_url, author_name, published_at, featured, views')
    .eq('published', true).order('published_at', { ascending: false }).limit(opts.limit ?? 50);
  if (opts.category) q = q.eq('category', opts.category);
  if (opts.search) q = q.or(`title.ilike.%${opts.search}%,excerpt.ilike.%${opts.search}%,content.ilike.%${opts.search}%`);
  return q;
};
export const fetchNews = (opts: { category?: string; limit?: number; search?: string; offset?: number } = {}) => {
  const limit = opts.limit ?? 30;
  let q = db.from('blog_news').select('id, title, link, source, source_url, summary, category, published_at')
    .eq('hidden', false).order('published_at', { ascending: false }).range(opts.offset ?? 0, (opts.offset ?? 0) + limit - 1);
  if (opts.category) q = q.eq('category', opts.category);
  if (opts.search) q = q.or(`title.ilike.%${opts.search}%,source.ilike.%${opts.search}%`);
  return q;
};
export const fetchLeaders = () => db.from('blog_leaders').select('*').eq('active', true).order('sort');
export const fetchEvents = (upcomingOnly = true) => {
  let q = db.from('blog_events').select('*').eq('published', true).order('starts_at');
  if (upcomingOnly) q = q.gte('starts_at', new Date(Date.now() - 86400000).toISOString());
  return q;
};
export const fetchBlogState = () => db.from('blog_state').select('last_fetch_at').eq('id', true).maybeSingle();

/** Ask the server to look for new headlines (it ignores us if it checked recently). */
let nudged = false;
export function nudgeNewsRefresh() {
  if (nudged) return;
  nudged = true;
  supabase.functions.invoke('fetch-news', { body: {} }).catch(() => undefined);
}

/* ---------- helpers ---------- */

export const timeAgo = (iso?: string | null) =>
  iso ? `${formatDistanceToNowStrict(new Date(iso))} ago` : '';
export const longDate = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : '';
export const readingTime = (text: string) => Math.max(1, Math.round(text.split(/\s+/).length / 200));

export function useTitle(title: string) {
  useEffect(() => {
    document.title = title ? `${title} · NUESA UniAbuja` : 'NUESA UniAbuja · Engineering news and student portal';
  }, [title]);
}

const safeUrl = (u: string) => /^(https?:\/\/|\/|mailto:)/i.test(u) ? u : '#';

/** Small, safe markdown: headings, lists, quotes, bold, italic, links, code. No raw HTML. */
export function Markdown({ text }: { text: string }) {
  const inline = (s: string, key: string): ReactNode[] => {
    const out: ReactNode[] = [];
    const re = /(\*\*([^*]+)\*\*|\*([^*]+)\*|`([^`]+)`|\[([^\]]+)\]\(([^)\s]+)\))/g;
    let last = 0; let m: RegExpExecArray | null; let i = 0;
    while ((m = re.exec(s))) {
      if (m.index > last) out.push(s.slice(last, m.index));
      const k = `${key}-${i++}`;
      if (m[2]) out.push(<strong key={k}>{m[2]}</strong>);
      else if (m[3]) out.push(<em key={k}>{m[3]}</em>);
      else if (m[4]) out.push(<code key={k} className="rounded bg-muted px-1 py-0.5 text-[0.9em]">{m[4]}</code>);
      else if (m[5]) {
        const href = safeUrl(m[6]);
        const ext = /^https?:/i.test(href);
        out.push(<a key={k} href={href} className="font-medium text-primary underline underline-offset-2" {...(ext ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>{m[5]}</a>);
      }
      last = m.index + m[0].length;
    }
    if (last < s.length) out.push(s.slice(last));
    return out;
  };

  const lines = text.replace(/\r/g, '').split('\n');
  const blocks: ReactNode[] = [];
  let i = 0; let b = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }
    const key = `b${b++}`;
    const h = /^(#{1,3})\s+(.*)$/.exec(line);
    if (h) {
      const lvl = h[1].length;
      const cls = lvl === 1 ? 'mt-8 text-2xl font-bold' : lvl === 2 ? 'mt-8 text-xl font-bold' : 'mt-6 text-lg font-semibold';
      blocks.push(lvl === 1 ? <h2 key={key} className={cls}>{inline(h[2], key)}</h2> : lvl === 2 ? <h3 key={key} className={cls}>{inline(h[2], key)}</h3> : <h4 key={key} className={cls}>{inline(h[2], key)}</h4>);
      i++; continue;
    }
    if (/^\s*[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) items.push(lines[i++].replace(/^\s*[-*]\s+/, ''));
      blocks.push(<ul key={key} className="my-4 list-disc space-y-1.5 pl-6">{items.map((t, j) => <li key={j}>{inline(t, `${key}-${j}`)}</li>)}</ul>);
      continue;
    }
    if (/^\s*\d+[.)]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+[.)]\s+/.test(lines[i])) items.push(lines[i++].replace(/^\s*\d+[.)]\s+/, ''));
      blocks.push(<ol key={key} className="my-4 list-decimal space-y-1.5 pl-6">{items.map((t, j) => <li key={j}>{inline(t, `${key}-${j}`)}</li>)}</ol>);
      continue;
    }
    if (/^>\s?/.test(line)) {
      const q: string[] = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) q.push(lines[i++].replace(/^>\s?/, ''));
      blocks.push(<blockquote key={key} className="my-6 border-l-4 border-primary bg-primary/5 py-2 pl-4 italic">{inline(q.join(' '), key)}</blockquote>);
      continue;
    }
    const para: string[] = [];
    while (i < lines.length && lines[i].trim() && !/^(#{1,3}\s|\s*[-*]\s|\s*\d+[.)]\s|>)/.test(lines[i])) para.push(lines[i++]);
    blocks.push(<p key={key} className="my-4 leading-relaxed">{inline(para.join(' '), key)}</p>);
  }
  return <div className="text-[17px] text-foreground/90">{blocks.map((bk, j) => <Fragment key={j}>{bk}</Fragment>)}</div>;
}

/* ---------- pieces ---------- */

export function CategoryBadge({ category }: { category?: string | null }) {
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-white ${categoryColor(category)}`}>{categoryLabel(category)}</span>;
}

export function SectionHeader({ title, subtitle, to, linkLabel = 'See all' }: { title: string; subtitle?: string; to?: string; linkLabel?: string }) {
  return (
    <div className="mb-5 flex items-end justify-between gap-4">
      <div>
        <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">{title}</h2>
        {subtitle && <p className="mt-1 text-muted-foreground">{subtitle}</p>}
      </div>
      {to && (
        <Link to={to} className="hidden shrink-0 items-center gap-1 text-sm font-semibold text-primary hover:underline sm:inline-flex">
          {linkLabel} <ArrowRight className="h-4 w-4" />
        </Link>
      )}
    </div>
  );
}

/** Cover image, or a branded pattern when there is none */
export function Cover({ src, category, className = '', label = true }: { src?: string | null; category?: string | null; className?: string; label?: boolean }) {
  if (src) return <img src={src} alt="" loading="lazy" className={`h-full w-full object-cover ${className}`} />;
  return (
    <div className={`relative flex h-full w-full items-center justify-center overflow-hidden bg-gradient-to-br from-emerald-700 via-emerald-600 to-teal-500 ${className}`}>
      <div className="absolute inset-0 opacity-20 [background-image:radial-gradient(circle_at_1px_1px,white_1px,transparent_0)] [background-size:18px_18px]" />
      {label && <span className="relative text-sm font-bold uppercase tracking-[0.2em] text-white/90">{categoryLabel(category)}</span>}
    </div>
  );
}

export function PostCard({ post, large = false }: { post: Post; large?: boolean }) {
  return (
    <Link to={`/articles/${post.slug}`} className="group flex flex-col overflow-hidden rounded-2xl border bg-card transition hover:-translate-y-0.5 hover:shadow-lg">
      <div className={`${large ? 'aspect-[16/9]' : 'aspect-[16/10]'} overflow-hidden`}>
        <Cover src={post.cover_url} category={post.category} className="transition duration-500 group-hover:scale-105" />
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4 sm:p-5">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <CategoryBadge category={post.category} />
          <span>{longDate(post.published_at)}</span>
        </div>
        <h3 className={`${large ? 'text-xl sm:text-2xl' : 'text-lg'} font-bold leading-snug group-hover:text-primary`}>{post.title}</h3>
        {post.excerpt && <p className="line-clamp-3 text-sm text-muted-foreground">{post.excerpt}</p>}
        <p className="mt-auto pt-2 text-xs text-muted-foreground">{post.author_name} · {readingTime(post.content)} min read</p>
      </div>
    </Link>
  );
}

export function NewsRow({ item, compact = false }: { item: NewsItem; compact?: boolean }) {
  return (
    <a href={item.link} target="_blank" rel="noopener noreferrer" className="group flex gap-3 rounded-xl p-3 transition hover:bg-muted/60">
      <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Newspaper className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className={`${compact ? 'line-clamp-2 text-sm' : 'text-[15px]'} font-semibold leading-snug group-hover:text-primary`}>{item.title}</p>
        {!compact && item.summary && <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{item.summary}</p>}
        <p className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
          {item.source && <span className="font-medium">{item.source}</span>}
          <span>{timeAgo(item.published_at)}</span>
          <span className="inline-flex items-center gap-0.5 opacity-0 transition group-hover:opacity-100">Read <ExternalLink className="h-3 w-3" /></span>
        </p>
      </div>
    </a>
  );
}

export function LeaderCard({ leader }: { leader: Leader }) {
  const initials = leader.name.replace(/^(Engr\.|Prof\.|Dr\.|\(Dr\.\)|\s)+/g, '').split(/\s+/).slice(0, 2).map((w) => w[0]).join('');
  return (
    <div className="flex gap-4 rounded-2xl border bg-card p-4">
      {leader.photo_url ? (
        <img src={leader.photo_url} alt={leader.name} className="h-16 w-16 shrink-0 rounded-2xl object-cover" />
      ) : (
        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-500 text-lg font-bold text-white">{initials}</div>
      )}
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-wide text-primary">{leader.role}</p>
        <p className="font-bold leading-snug">{leader.name}</p>
        {leader.term && <p className="text-xs text-muted-foreground">{leader.term}</p>}
        {leader.bio && <p className="mt-1.5 text-sm text-muted-foreground">{leader.bio}</p>}
        {leader.source_url && <a href={leader.source_url} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary">Source <ExternalLink className="h-3 w-3" /></a>}
      </div>
    </div>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <div className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">{children}</div>;
}

export function SkeletonCards({ n = 3 }: { n?: number }) {
  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: n }).map((_, i) => (
        <div key={i} className="overflow-hidden rounded-2xl border">
          <div className="aspect-[16/10] animate-pulse bg-muted" />
          <div className="space-y-2 p-4"><div className="h-4 w-1/3 animate-pulse rounded bg-muted" /><div className="h-5 w-full animate-pulse rounded bg-muted" /></div>
        </div>
      ))}
    </div>
  );
}
