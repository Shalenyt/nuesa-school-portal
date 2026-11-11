import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Briefcase, CheckCircle2, Landmark, Wrench } from 'lucide-react';
import { BlogLayout } from './BlogLayout';
import { DISCIPLINES } from './content';
import { EmptyState, NewsItem, NewsRow, fetchNews, useBlogData, useTitle } from './shared';

export function BlogEngineering() {
  useTitle('Engineering disciplines');
  const uni = DISCIPLINES.filter((d) => d.atUniAbuja);
  const others = DISCIPLINES.filter((d) => !d.atUniAbuja);
  const Card = ({ d }: { d: (typeof DISCIPLINES)[number] }) => (
    <Link to={`/engineering/${d.slug}`} className="group flex gap-4 rounded-2xl border bg-card p-5 transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md">
      <div className="text-4xl">{d.icon}</div>
      <div>
        <p className="text-lg font-bold group-hover:text-primary">{d.name}</p>
        <p className="mt-1 text-sm text-muted-foreground">{d.summary}</p>
      </div>
    </Link>
  );
  return (
    <BlogLayout>
      <section className="border-b bg-gradient-to-b from-primary/10 to-transparent">
        <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
          <h1 className="text-4xl font-extrabold tracking-tight">Engineering disciplines</h1>
          <p className="mt-2 max-w-2xl text-muted-foreground">What each branch of engineering does, where its graduates work in Nigeria, and the professional bodies that support it.</p>
        </div>
      </section>
      <div className="mx-auto max-w-6xl space-y-12 px-4 py-10 sm:px-6">
        <section>
          <h2 className="text-2xl font-bold">Offered at the University of Abuja</h2>
          <p className="mt-1 text-muted-foreground">The seven departments of the Faculty of Engineering.</p>
          <div className="mt-5 grid gap-4 md:grid-cols-2">{uni.map((d) => <Card key={d.slug} d={d} />)}</div>
        </section>
        <section>
          <h2 className="text-2xl font-bold">Other disciplines in Nigerian universities</h2>
          <div className="mt-5 grid gap-4 md:grid-cols-2">{others.map((d) => <Card key={d.slug} d={d} />)}</div>
        </section>
      </div>
    </BlogLayout>
  );
}

export function BlogDiscipline() {
  const { slug = '' } = useParams();
  const d = DISCIPLINES.find((x) => x.slug === slug);
  useTitle(d?.name || 'Discipline');
  const keyword = d ? d.name.split(' ')[0] : '';
  const news = useBlogData<NewsItem[]>(() => fetchNews({ search: keyword, limit: 6 }), [keyword]);

  if (!d) return <BlogLayout><div className="mx-auto max-w-3xl px-4 py-20"><EmptyState>Discipline not found. <Link to="/engineering" className="text-primary underline">See all disciplines</Link></EmptyState></div></BlogLayout>;

  const List = ({ icon: Icon, title, items }: { icon: any; title: string; items: string[] }) => (
    <div className="rounded-2xl border bg-card p-5">
      <p className="mb-3 flex items-center gap-2 font-bold"><Icon className="h-5 w-5 text-primary" />{title}</p>
      <ul className="space-y-2">{items.map((i) => <li key={i} className="flex gap-2 text-sm"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />{i}</li>)}</ul>
    </div>
  );

  return (
    <BlogLayout>
      <section className="border-b bg-gradient-to-br from-emerald-900 to-teal-700 text-white">
        <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
          <Link to="/engineering" className="inline-flex items-center gap-1 text-sm text-emerald-100/80 hover:text-white"><ArrowLeft className="h-4 w-4" /> All disciplines</Link>
          <div className="mt-6 text-6xl">{d.icon}</div>
          <h1 className="mt-4 text-4xl font-extrabold tracking-tight sm:text-5xl">{d.name}</h1>
          <p className="mt-3 max-w-2xl text-lg text-emerald-50/90">{d.summary}</p>
          {d.atUniAbuja && <span className="mt-4 inline-block rounded-full bg-white/15 px-3 py-1 text-sm font-semibold">Offered at the University of Abuja</span>}
        </div>
      </section>
      <div className="mx-auto max-w-5xl space-y-8 px-4 py-10 sm:px-6">
        <div className="grid gap-4 md:grid-cols-3">
          <List icon={Wrench} title="What you'll work on" items={d.work} />
          <List icon={Briefcase} title="Where graduates work" items={d.careers} />
          <List icon={Landmark} title="Professional bodies" items={d.bodies} />
        </div>
        {(news.data || []).length > 0 && (
          <section>
            <h2 className="mb-3 text-xl font-bold">In the news</h2>
            <div className="divide-y rounded-2xl border bg-card">{(news.data || []).map((n) => <NewsRow key={n.id} item={n} />)}</div>
          </section>
        )}
      </div>
    </BlogLayout>
  );
}
