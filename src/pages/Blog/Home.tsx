import { Link, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { ArrowRight, CalendarDays, GraduationCap, MapPin, Newspaper, Search, ShieldCheck, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { BlogLayout } from './BlogLayout';
import { DISCIPLINES } from './content';
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
      <section className="relative overflow-hidden border-b bg-gradient-to-br from-emerald-950 via-emerald-900 to-teal-800 text-white">
        <div className="absolute inset-0 opacity-[0.12] [background-image:linear-gradient(white_1px,transparent_1px),linear-gradient(90deg,white_1px,transparent_1px)] [background-size:44px_44px]" />
        <div className="absolute -right-24 -top-24 h-80 w-80 rounded-full bg-emerald-400/20 blur-3xl" />
        <div className="relative mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[1.2fr_1fr] lg:py-20">
          <div className="space-y-6">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider">
              <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-300" /> NUESA · University of Abuja
            </span>
            <h1 className="text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
              The pulse of <span className="text-emerald-300">Nigerian engineering</span>.
            </h1>
            <p className="max-w-xl text-lg text-emerald-50/85">
              News from NSE, COREN and across the industry, stories from our Faculty, and everything an engineering student in Nigeria needs to know.
            </p>
            <form onSubmit={(e) => { e.preventDefault(); if (q.trim()) navigate(`/search?q=${encodeURIComponent(q.trim())}`); }} className="relative max-w-xl">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-emerald-900/50" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search NSE, COREN, civil engineering, SIWES…" aria-label="Search the blog"
                className="h-13 w-full rounded-2xl border-0 bg-white py-4 pl-12 pr-28 text-base text-slate-900 shadow-xl outline-none ring-emerald-300 focus:ring-4" />
              <Button type="submit" className="absolute right-2 top-1/2 -translate-y-1/2 rounded-xl">Search</Button>
            </form>
            <div className="flex flex-wrap gap-3 pt-1">
              <Button size="lg" variant="secondary" className="rounded-full" onClick={() => navigate('/auth/login')}>Log in to the Student Portal <ArrowRight className="ml-1 h-4 w-4" /></Button>
              <Button size="lg" variant="ghost" className="rounded-full text-white hover:bg-white/10 hover:text-white" onClick={() => navigate('/auth/apply')}>Apply for an account</Button>
            </div>
          </div>

          {/* Live headlines panel */}
          <div className="rounded-3xl border border-white/15 bg-white/10 p-4 backdrop-blur sm:p-5">
            <div className="mb-2 flex items-center justify-between px-1">
              <p className="flex items-center gap-2 text-sm font-semibold"><Newspaper className="h-4 w-4" /> Latest headlines</p>
              {state.data?.last_fetch_at && <p className="text-xs text-emerald-100/70">Updated {timeAgo(state.data.last_fetch_at)}</p>}
            </div>
            <div className="divide-y divide-white/10">
              {(news.data || []).slice(0, 5).map((n) => (
                <a key={n.id} href={n.link} target="_blank" rel="noopener noreferrer" className="block rounded-xl px-2 py-3 transition hover:bg-white/10">
                  <p className="line-clamp-2 text-[15px] font-semibold leading-snug">{n.title}</p>
                  <p className="mt-1 text-xs text-emerald-100/70">{n.source} · {timeAgo(n.published_at)}</p>
                </a>
              ))}
              {!news.loading && !(news.data || []).length && <p className="px-2 py-6 text-sm text-emerald-100/80">Headlines are on their way. Check back shortly.</p>}
            </div>
            <Link to="/news" className="mt-2 flex items-center justify-center gap-1 rounded-xl py-2 text-sm font-semibold hover:bg-white/10">All news <ArrowRight className="h-4 w-4" /></Link>
          </div>
        </div>
      </section>

      {/* Quick stats */}
      <section className="mx-auto -mt-px max-w-7xl px-4 sm:px-6">
        <div className="grid grid-cols-2 gap-3 py-8 md:grid-cols-4">
          {[
            { icon: GraduationCap, k: '7', v: 'Engineering departments' },
            { icon: Users, k: '93', v: 'NSE branches nationwide' },
            { icon: ShieldCheck, k: 'COREN', v: 'Regulates engineering practice' },
            { icon: Newspaper, k: 'Live', v: 'News updated every 2 hours' },
          ].map(({ icon: Icon, k, v }) => (
            <div key={v} className="flex items-center gap-3 rounded-2xl border bg-card p-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><Icon className="h-5 w-5" /></div>
              <div><p className="text-xl font-extrabold leading-none">{k}</p><p className="mt-1 text-xs text-muted-foreground">{v}</p></div>
            </div>
          ))}
        </div>
      </section>

      <div className="mx-auto max-w-7xl space-y-16 px-4 sm:px-6">
        {/* Featured + articles */}
        <section>
          <SectionHeader title="From NUESA" subtitle="Articles, guides and stories from our chapter" to="/articles" />
          {posts.loading ? <SkeletonCards /> : !featured ? (
            <EmptyState>No articles yet. Admins can write the first one from Blog in the dashboard.</EmptyState>
          ) : (
            <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
              <Link to={`/articles/${featured.slug}`} className="group relative overflow-hidden rounded-3xl border">
                <div className="aspect-[16/11] sm:aspect-[16/9] lg:aspect-auto lg:h-full lg:min-h-[420px]">
                  <Cover src={featured.cover_url} category={featured.category} className="transition duration-700 group-hover:scale-105" />
                </div>
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />
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
          <SectionHeader title="Engineering news" subtitle="Collected automatically from NSE, COREN and Nigerian news outlets" to="/news" />
          <div className="grid gap-1 rounded-3xl border bg-card p-2 sm:grid-cols-2 lg:grid-cols-3">
            {(news.data || []).slice(0, 9).map((n) => <NewsRow key={n.id} item={n} compact />)}
            {!news.loading && !(news.data || []).length && <div className="col-span-full"><EmptyState>No headlines yet.</EmptyState></div>}
          </div>
        </section>

        {/* Leadership spotlight */}
        <section>
          <SectionHeader title="Who leads Nigerian engineering" subtitle="The people at the head of the profession today" to="/leadership" linkLabel="All leaders" />
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
              <Link key={d.slug} to={`/engineering/${d.slug}`} className="group rounded-2xl border bg-card p-4 transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md">
                <div className="text-3xl">{d.icon}</div>
                <p className="mt-3 font-bold leading-snug group-hover:text-primary">{d.name}</p>
                <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{d.summary}</p>
              </Link>
            ))}
            <Link to="/engineering" className="flex flex-col items-center justify-center gap-1 rounded-2xl border border-dashed p-4 text-center text-sm font-semibold text-primary hover:bg-primary/5">
              More disciplines <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
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
        <section className="overflow-hidden rounded-3xl bg-gradient-to-r from-emerald-700 to-teal-600 p-8 text-white sm:p-12">
          <div className="grid items-center gap-6 md:grid-cols-[1.5fr_1fr]">
            <div>
              <h2 className="text-3xl font-extrabold tracking-tight">Engineering student at UniAbuja?</h2>
              <p className="mt-2 max-w-xl text-emerald-50/90">Your courses, timetable, assignments, results, dues and elections all live in the NUESA Student Portal.</p>
            </div>
            <div className="flex flex-wrap gap-3 md:justify-end">
              <Button size="lg" variant="secondary" className="rounded-full" onClick={() => navigate('/auth/login')}>Log in</Button>
              <Button size="lg" variant="outline" className="rounded-full border-white/40 bg-transparent text-white hover:bg-white/10 hover:text-white" onClick={() => navigate('/auth/apply')}>Apply</Button>
            </div>
          </div>
        </section>
      </div>
    </BlogLayout>
  );
}
