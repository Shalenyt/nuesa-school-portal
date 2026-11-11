import { Link, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { ArrowRight, CalendarDays, MapPin, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { BlogLayout } from './BlogLayout';
import { DISCIPLINES, IMAGES, LOGOS, REGISTRATION_STEPS } from './content';
import {
  BlogEvent, Cover, EmptyState, Leader, LeaderCard, NewsItem, NewsRow, Post, PostCard, SectionHeader, SkeletonCards,
  CategoryBadge, fetchBlogState, fetchEvents, fetchLeaders, fetchNews, fetchPosts, longDate, readingTime, timeAgo, useBlogData, useTitle,
} from './shared';

export default function BlogHome() {
  useTitle('');
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const posts = useBlogData<Post[]>(() => fetchPosts({ limit: 7 }));
  const news = useBlogData<NewsItem[]>(() => fetchNews({ limit: 9 }));
  const leaders = useBlogData<Leader[]>(() => fetchLeaders());
  const events = useBlogData<BlogEvent[]>(() => fetchEvents(true));
  const state = useBlogData<{ last_fetch_at: string | null }>(() => fetchBlogState());

  const all = posts.data || [];
  const featured = all.find((p) => p.featured) || all[0];
  const rest = all.filter((p) => p.id !== featured?.id).slice(0, 6);
  const nsePresident = (leaders.data || []).find((l) => l.body === 'NSE' && /president/i.test(l.role) && !/deputy|vice|past/i.test(l.role));
  const corenPresident = (leaders.data || []).find((l) => l.body === 'COREN');
  const nextEvents = (events.data || []).slice(0, 3);

  return (
    <BlogLayout>
      {/* Hero */}
      <section className="border-b bg-background">
        <div className="mx-auto grid max-w-7xl items-center gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[1.1fr_1fr] lg:py-14">
          <div className="space-y-5">
            <p className="text-sm font-semibold uppercase tracking-wider text-primary">NUESA, University of Abuja chapter</p>
            <h1 className="text-4xl font-extrabold leading-[1.08] tracking-tight sm:text-5xl">
              Engineering news and student life at UniAbuja
            </h1>
            <p className="max-w-xl text-lg text-muted-foreground">
              What NSE and COREN are doing, what is happening in our Faculty, and the things every engineering student in Nigeria should know.
            </p>
            <form onSubmit={(e) => { e.preventDefault(); if (q.trim()) navigate(`/search?q=${encodeURIComponent(q.trim())}`); }} className="relative max-w-xl">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search NSE, COREN, SIWES, civil engineering" aria-label="Search the blog"
                className="w-full rounded-2xl border bg-card py-3.5 pl-12 pr-28 text-base outline-none focus:border-primary" />
              <Button type="submit" className="absolute right-2 top-1/2 -translate-y-1/2 rounded-xl">Search</Button>
            </form>
            <div className="flex flex-wrap gap-3">
              <Button size="lg" className="rounded-full" onClick={() => navigate('/auth/login')}>Log in to the Student Portal <ArrowRight className="ml-1 h-4 w-4" /></Button>
              <Button size="lg" variant="outline" className="rounded-full" onClick={() => navigate('/auth/apply')}>Apply for an account</Button>
            </div>
          </div>
          <figure className="overflow-hidden rounded-3xl border bg-card">
            <img src={IMAGES.hero} alt="Faculty of Engineering building, University of Abuja" className="aspect-[4/3] w-full object-cover" />
            <figcaption className="px-4 py-2.5 text-xs text-muted-foreground">Faculty of Engineering, University of Abuja</figcaption>
          </figure>
        </div>
      </section>

      {/* Quick facts */}
      <section className="border-b bg-muted/40">
        <div className="mx-auto grid max-w-7xl grid-cols-2 divide-x divide-y px-4 sm:px-6 md:grid-cols-4 md:divide-y-0">
          {[
            { k: '7', v: 'departments in our Faculty' },
            { k: '1958', v: 'year NSE was founded' },
            { k: '93', v: 'NSE branches across Nigeria' },
            { k: '2 hrs', v: 'how often the news refreshes' },
          ].map(({ k, v }) => (
            <div key={v} className="px-4 py-6 text-center">
              <p className="text-3xl font-extrabold text-primary">{k}</p>
              <p className="mt-1 text-sm text-muted-foreground">{v}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="mx-auto mt-12 max-w-7xl space-y-16 px-4 sm:px-6">
        {/* Featured + articles */}
        <section>
          <SectionHeader title="From NUESA" subtitle="Articles, guides and stories from our chapter" to="/articles" />
          {posts.loading ? <SkeletonCards /> : !featured ? (
            <EmptyState>No articles yet. Admins can write the first one from Blog in the dashboard.</EmptyState>
          ) : (
            <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
              <Link to={`/articles/${featured.slug}`} className="group relative overflow-hidden rounded-3xl border">
                <div className="h-[380px] sm:h-auto sm:aspect-[16/9] lg:aspect-auto lg:h-full lg:min-h-[420px]">
                  <Cover src={featured.cover_url} category={featured.category} label={false} className="transition duration-700 group-hover:scale-105" />
                </div>
                <div className="absolute inset-x-0 bottom-0 h-3/4 bg-gradient-to-t from-black/80 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 space-y-3 p-5 text-white sm:p-7">
                  <div className="flex items-center gap-2 text-xs"><CategoryBadge category={featured.category} /><span className="opacity-80">{longDate(featured.published_at)}</span></div>
                  <h3 className="text-2xl font-extrabold leading-tight sm:text-3xl">{featured.title}</h3>
                  {featured.excerpt && <p className="line-clamp-2 max-w-2xl text-sm opacity-85 sm:text-base">{featured.excerpt}</p>}
                  <p className="text-xs opacity-75">{featured.author_name} · {readingTime(featured.content)} min read</p>
                </div>
              </Link>
              <div className="grid gap-4">
                {rest.slice(0, 3).map((p) => (
                  <Link key={p.id} to={`/articles/${p.slug}`} className="group flex gap-4 rounded-2xl border bg-card p-3 transition hover:shadow-md">
                    <div className="h-24 w-28 shrink-0 overflow-hidden rounded-xl sm:w-36"><Cover src={p.cover_url} category={p.category} /></div>
                    <div className="min-w-0 py-1">
                      <CategoryBadge category={p.category} />
                      <p className="mt-1.5 line-clamp-2 font-bold leading-snug group-hover:text-primary">{p.title}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{longDate(p.published_at)}</p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}
          {rest.length > 3 && <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{rest.slice(3).map((p) => <PostCard key={p.id} post={p} />)}</div>}
        </section>

        {/* News grid */}
        <section>
          <SectionHeader title="Engineering news" subtitle={`From NSE, COREN and Nigerian newspapers${state.data?.last_fetch_at ? `. Last checked ${timeAgo(state.data.last_fetch_at)}` : ''}`} to="/news" />
          <div className="grid gap-1 rounded-3xl border bg-card p-2 sm:grid-cols-2 lg:grid-cols-3">
            {(news.data || []).slice(0, 9).map((n) => <NewsRow key={n.id} item={n} compact />)}
            {!news.loading && !(news.data || []).length && <div className="col-span-full"><EmptyState>No headlines yet.</EmptyState></div>}
          </div>
        </section>

        {/* Leadership spotlight */}
        <section>
          <SectionHeader title="Who leads Nigerian engineering" subtitle="The people at the head of the profession today" to="/leadership" linkLabel="All leaders" />
          <div className="mb-4 flex items-center gap-4">
            <img src={LOGOS.NSE} alt="NSE logo" className="h-12 w-12 rounded-xl border bg-white object-contain p-1" />
            <img src={LOGOS.COREN} alt="COREN logo" className="h-12 w-12 rounded-xl border bg-white object-contain p-1" />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {nsePresident && <LeaderCard leader={{ ...nsePresident, role: `NSE · ${nsePresident.role}` }} />}
            {corenPresident && <LeaderCard leader={{ ...corenPresident, role: `COREN · ${corenPresident.role}` }} />}
          </div>
        </section>

        {/* Disciplines */}
        <section>
          <SectionHeader title="Engineering at UniAbuja" subtitle="Seven departments in the Faculty of Engineering" to="/engineering" linkLabel="All disciplines" />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {DISCIPLINES.filter((d) => d.atUniAbuja).map((d) => (
              <Link key={d.slug} to={`/engineering/${d.slug}`} className="group overflow-hidden rounded-2xl border bg-card transition hover:-translate-y-0.5 hover:shadow-md">
                <div className="aspect-[4/3] overflow-hidden bg-muted"><img src={d.image} alt="" loading="lazy" className="h-full w-full object-cover transition duration-500 group-hover:scale-105" /></div>
                <div className="p-3 sm:p-4">
                  <p className="font-bold leading-snug group-hover:text-primary">{d.name}</p>
                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{d.summary}</p>
                </div>
              </Link>
            ))}
            <Link to="/engineering" className="flex flex-col items-center justify-center gap-1 rounded-2xl border border-dashed p-4 text-center text-sm font-semibold text-primary hover:bg-primary/5">
              More disciplines <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </section>

        {/* Path to registration */}
        <section>
          <SectionHeader title="From student to Engr." subtitle="The six steps to becoming a registered engineer in Nigeria" to="/resources" linkLabel="Read more" />
          <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
            {REGISTRATION_STEPS.map((step, i) => (
              <li key={step.title} className="relative rounded-2xl border bg-card p-4">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">{i + 1}</span>
                <p className="mt-3 font-bold leading-snug">{step.title}</p>
                {i < REGISTRATION_STEPS.length - 1 && <ArrowRight className="absolute right-3 top-5 hidden h-4 w-4 text-muted-foreground lg:block" />}
              </li>
            ))}
          </ol>
        </section>

        {/* Events */}
        <section>
          <SectionHeader title="Upcoming events" to="/events" />
          {nextEvents.length ? (
            <div className="grid gap-4 md:grid-cols-3">
              {nextEvents.map((e) => (
                <div key={e.id} className="flex gap-4 rounded-2xl border bg-card p-4">
                  <div className="flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-2xl bg-primary text-primary-foreground">
                    <span className="text-xl font-extrabold leading-none">{new Date(e.starts_at).getDate()}</span>
                    <span className="text-[11px] font-semibold uppercase">{new Date(e.starts_at).toLocaleString('en-GB', { month: 'short' })}</span>
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold leading-snug">{e.title}</p>
                    <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground"><CalendarDays className="h-3.5 w-3.5" />{new Date(e.starts_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</p>
                    {e.location && <p className="flex items-center gap-1 text-xs text-muted-foreground"><MapPin className="h-3.5 w-3.5" />{e.location}</p>}
                  </div>
                </div>
              ))}
            </div>
          ) : <EmptyState>No upcoming events right now.</EmptyState>}
        </section>

        {/* Portal CTA */}
        <section className="grid overflow-hidden rounded-3xl border bg-card md:grid-cols-[1fr_1.2fr]">
          <img src={IMAGES.student} alt="Engineering student at work" loading="lazy" className="h-56 w-full object-cover md:h-full" />
          <div className="space-y-4 p-6 sm:p-10">
            <h2 className="text-3xl font-extrabold tracking-tight">Studying engineering at UniAbuja?</h2>
            <p className="max-w-xl text-muted-foreground">Your courses, timetable, assignments, results, dues and elections are all in the NUESA Student Portal.</p>
            <div className="flex flex-wrap gap-3">
              <Button size="lg" className="rounded-full" onClick={() => navigate('/auth/login')}>Log in</Button>
              <Button size="lg" variant="outline" className="rounded-full" onClick={() => navigate('/auth/apply')}>Apply</Button>
            </div>
          </div>
        </section>
      </div>
    </BlogLayout>
  );
}
