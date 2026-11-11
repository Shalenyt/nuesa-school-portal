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
    <Link to={`/engineering/${d.slug}`} className="group flex overflow-hidden rounded-2xl border bg-card transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md">
      <div className="w-32 shrink-0 overflow-hidden bg-muted sm:w-40"><img src={d.image} alt="" loading="lazy" className="h-full w-full object-cover transition duration-500 group-hover:scale-105" /></div>
      <div className="min-w-0 p-4">
        <div className="flex items-start justify-between gap-2">
          <p className="text-lg font-bold leading-snug group-hover:text-primary">{d.name}</p>
          {d.logo && <img src={d.logo} alt="" className="h-9 w-9 shrink-0 rounded-lg border bg-white object-contain p-0.5" />}
        </div>
        <p className="mt-1 text-sm text-muted-foreground">{d.summary}</p>
      </div>
    </Link>
  );
  return (
    <BlogLayout>
      <section className="border-b bg-muted/40">
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
      <section className="border-b bg-background">
        <div className="mx-auto max-w-5xl px-4 pt-8 sm:px-6">
          <Link to="/engineering" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary"><ArrowLeft className="h-4 w-4" /> All disciplines</Link>
          <div className="mt-5 flex items-start gap-4">
            {d.logo && <img src={d.logo} alt="" className="h-16 w-16 shrink-0 rounded-2xl border bg-white object-contain p-1" />}
            <div>
              <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">{d.name}</h1>
              {d.atUniAbuja && <span className="mt-3 inline-block rounded-full bg-primary/10 px-3 py-1 text-sm font-semibold text-primary">Offered at the University of Abuja</span>}
            </div>
          </div>
          <p className="mt-4 max-w-2xl text-lg text-muted-foreground">{d.summary}</p>
          <div className="mt-6 aspect-[16/7] overflow-hidden rounded-t-3xl bg-muted"><img src={d.image} alt={d.name} className="h-full w-full object-cover" /></div>
        </div>
      </section>
      <div className="mx-auto max-w-5xl space-y-8 px-4 py-10 sm:px-6">
        <div className="grid gap-4 md:grid-cols-3">
          <List icon={Wrench} title="What you work on" items={d.work} />
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
