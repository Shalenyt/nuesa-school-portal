import { useSearchParams } from 'react-router-dom';
import { BlogLayout } from './BlogLayout';
import { CATEGORIES } from './content';
import { EmptyState, Post, PostCard, SkeletonCards, fetchPosts, useBlogData, useTitle } from './shared';

const POST_CATS = ['nuesa', 'uniabuja', 'nse', 'coren', 'guides', 'careers', 'events', 'opinion', 'engineering'];

export default function BlogArticles() {
  useTitle('Articles');
  const [params, setParams] = useSearchParams();
  const cat = params.get('c') || '';
  const posts = useBlogData<Post[]>(() => fetchPosts({ category: cat || undefined, limit: 60 }), [cat]);

  return (
    <BlogLayout>
      <section className="border-b bg-muted/40">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
          <h1 className="text-4xl font-extrabold tracking-tight">Articles</h1>
          <p className="mt-2 max-w-2xl text-muted-foreground">Guides, chapter news, interviews and opinion from NUESA, University of Abuja.</p>
          <div className="mt-5 flex flex-wrap gap-2">
            {['', ...POST_CATS].map((c) => (
              <button key={c || 'all'} onClick={() => { const p = new URLSearchParams(params); c ? p.set('c', c) : p.delete('c'); setParams(p); }}
                className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition ${cat === c ? 'border-primary bg-primary text-primary-foreground' : 'bg-background hover:border-primary/50'}`}>
                {c ? CATEGORIES[c]?.label : 'All'}
              </button>
            ))}
          </div>
        </div>
      </section>
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        {posts.loading ? <SkeletonCards n={6} /> : !(posts.data || []).length ? (
          <EmptyState>No articles in this category yet.</EmptyState>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">{(posts.data || []).map((p) => <PostCard key={p.id} post={p} />)}</div>
        )}
      </div>
    </BlogLayout>
  );
}
