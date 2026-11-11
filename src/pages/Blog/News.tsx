import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Loader2, RefreshCw, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { BlogLayout } from './BlogLayout';
import { CATEGORIES } from './content';
import { EmptyState, NewsItem, NewsRow, fetchBlogState, fetchNews, timeAgo, useBlogData, useTitle } from './shared';

const NEWS_CATS = ['nse', 'coren', 'nuesa', 'uniabuja', 'engineering', 'students'];
const PAGE = 30;

export default function BlogNews() {
  useTitle('Engineering news');
  const [params, setParams] = useSearchParams();
  const cat = params.get('c') || '';
  const [q, setQ] = useState(params.get('q') || '');
  const [items, setItems] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [more, setMore] = useState(false);
  const [done, setDone] = useState(false);
  const state = useBlogData<{ last_fetch_at: string | null }>(() => fetchBlogState());

  const load = async (offset: number) => {
    const { data } = await fetchNews({ category: cat || undefined, search: params.get('q') || undefined, limit: PAGE, offset });
    const rows = (data || []) as NewsItem[];
    setDone(rows.length < PAGE);
    return rows;
  };

  useEffect(() => {
    setLoading(true);
    load(0).then((rows) => { setItems(rows); setLoading(false); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cat, params.get('q')]);

  const setCat = (c: string) => { const p = new URLSearchParams(params); c ? p.set('c', c) : p.delete('c'); setParams(p); };

  // Group by day
  const groups: Record<string, NewsItem[]> = {};
  items.forEach((n) => {
    const d = n.published_at ? new Date(n.published_at) : new Date();
    const today = new Date(); const yest = new Date(Date.now() - 86400000);
    const label = d.toDateString() === today.toDateString() ? 'Today' : d.toDateString() === yest.toDateString() ? 'Yesterday'
      : d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
    (groups[label] ||= []).push(n);
  });

  return (
    <BlogLayout>
      <section className="border-b bg-muted/40">
        <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
          <h1 className="text-4xl font-extrabold tracking-tight">Engineering news</h1>
          <p className="mt-2 max-w-2xl text-muted-foreground">Headlines about NSE, COREN, NUESA and Nigerian engineering, collected automatically from trusted outlets every two hours. Tap a story to read it at its source.</p>
          {state.data?.last_fetch_at && (
            <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-background px-3 py-1 text-xs text-muted-foreground shadow-sm"><RefreshCw className="h-3 w-3" /> Last checked {timeAgo(state.data.last_fetch_at)}</p>
          )}
          <form onSubmit={(e) => { e.preventDefault(); const p = new URLSearchParams(params); q.trim() ? p.set('q', q.trim()) : p.delete('q'); setParams(p); }} className="relative mt-6 max-w-xl">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search headlines or sources" aria-label="Search headlines"
              className="h-11 w-full rounded-full border bg-background pl-9 pr-4 text-sm outline-none focus:border-primary" />
          </form>
          <div className="mt-4 flex flex-wrap gap-2">
            {['', ...NEWS_CATS].map((c) => (
              <button key={c || 'all'} onClick={() => setCat(c)}
                className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition ${cat === c ? 'border-primary bg-primary text-primary-foreground' : 'bg-background hover:border-primary/50'}`}>
                {c ? CATEGORIES[c]?.label : 'All'}
              </button>
            ))}
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : items.length === 0 ? (
          <EmptyState>No headlines match yet. Try another filter or check back soon.</EmptyState>
        ) : (
          <div className="space-y-8">
            {Object.entries(groups).map(([label, list]) => (
              <div key={label}>
                <p className="mb-2 px-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">{label}</p>
                <div className="divide-y rounded-2xl border bg-card">{list.map((n) => <NewsRow key={n.id} item={n} />)}</div>
              </div>
            ))}
            {!done && (
              <div className="flex justify-center">
                <Button variant="outline" className="rounded-full" disabled={more}
                  onClick={async () => { setMore(true); const rows = await load(items.length); setItems((x) => [...x, ...rows]); setMore(false); }}>
                  {more && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Load more
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </BlogLayout>
  );
}
