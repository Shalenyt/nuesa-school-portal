import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useState } from 'react';
import { CalendarDays, ExternalLink, MapPin, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { BlogLayout } from './BlogLayout';
import { DISCIPLINES, FAQS, REGISTRATION_STEPS, USEFUL_LINKS } from './content';
import {
  BlogEvent, EmptyState, NewsItem, NewsRow, Post, PostCard, fetchEvents, fetchNews, fetchPosts, longDate, useBlogData, useTitle,
} from './shared';

function PageHero({ title, text }: { title: string; text: string }) {
  return (
    <section className="border-b bg-gradient-to-b from-primary/10 to-transparent">
      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <h1 className="text-4xl font-extrabold tracking-tight">{title}</h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">{text}</p>
      </div>
    </section>
  );
}

export function BlogAbout() {
  useTitle('About NUESA');
  const navigate = useNavigate();
  return (
    <BlogLayout>
      <PageHero title="About NUESA" text="The Nigerian Universities Engineering Students' Association, University of Abuja chapter." />
      <div className="mx-auto max-w-5xl space-y-12 px-4 py-10 sm:px-6">
        <section className="grid gap-6 md:grid-cols-2">
          <div className="space-y-4 text-[17px] leading-relaxed">
            <p><strong>NUESA</strong> brings together engineering students across Nigerian universities. Every university with an engineering faculty has a chapter, and the chapters meet under a national body.</p>
            <p>Our chapter represents students of the <strong>Faculty of Engineering, University of Abuja</strong>. We organise academic support, career talks, industrial visits, technical competitions, social events and elections, and we speak for engineering students within the university.</p>
            <p>This site is our public home: news from across Nigerian engineering, articles from the chapter, and the <strong>NUESA Student Portal</strong>, where students manage courses, timetables, assignments, results, dues and voting.</p>
          </div>
          <div className="space-y-3 rounded-3xl border bg-card p-6">
            <p className="font-bold">How the pieces fit together</p>
            {[
              ['NUESA', 'Students. Our association, with a chapter in each university.'],
              ['NSE', 'Engineers. The Nigerian Society of Engineers, the professional body, founded in 1958.'],
              ['COREN', 'The regulator. Registers engineering practitioners and accredits programmes.'],
              ['NUC', 'Approves universities and degree programmes.'],
            ].map(([k, v]) => (
              <div key={k} className="flex gap-3"><span className="w-16 shrink-0 font-bold text-primary">{k}</span><span className="text-sm text-muted-foreground">{v}</span></div>
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-bold">Our departments</h2>
          <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
            {DISCIPLINES.filter((d) => d.atUniAbuja).map((d) => (
              <Link key={d.slug} to={`/engineering/${d.slug}`} className="rounded-2xl border bg-card p-4 text-center transition hover:border-primary/40 hover:shadow-md">
                <div className="text-3xl">{d.icon}</div><p className="mt-2 text-sm font-semibold">{d.name}</p>
              </Link>
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-bold">Questions</h2>
          <Accordion type="single" collapsible className="mt-3 rounded-2xl border bg-card px-4">
            {FAQS.map((f, i) => (
              <AccordionItem key={i} value={`f${i}`} className={i === FAQS.length - 1 ? 'border-b-0' : ''}>
                <AccordionTrigger className="text-left">{f.q}</AccordionTrigger>
                <AccordionContent className="text-muted-foreground">{f.a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </section>

        <section className="flex flex-col items-start justify-between gap-4 rounded-3xl bg-primary/10 p-6 sm:flex-row sm:items-center">
          <div><p className="text-lg font-bold">Ready to use the Student Portal?</p><p className="text-sm text-muted-foreground">Apply with your matric number, verify your email and wait for approval.</p></div>
          <div className="flex gap-2"><Button className="rounded-full" onClick={() => navigate('/auth/apply')}>Apply</Button><Button variant="outline" className="rounded-full" onClick={() => navigate('/auth/login')}>Log in</Button></div>
        </section>
      </div>
    </BlogLayout>
  );
}

export function BlogResources() {
  useTitle('Resources');
  return (
    <BlogLayout>
      <PageHero title="Resources" text="From your first year to the title Engr.: the path to becoming a registered engineer in Nigeria, plus useful links." />
      <div className="mx-auto max-w-5xl space-y-12 px-4 py-10 sm:px-6">
        <section>
          <h2 className="text-2xl font-bold">Becoming a registered engineer</h2>
          <ol className="mt-6 space-y-0">
            {REGISTRATION_STEPS.map((s, i) => (
              <li key={s.title} className="relative flex gap-4 pb-8 last:pb-0">
                {i < REGISTRATION_STEPS.length - 1 && <span className="absolute left-5 top-11 h-[calc(100%-2.75rem)] w-px bg-border" />}
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">{i + 1}</span>
                <div className="pt-1.5"><p className="font-bold">{s.title}</p><p className="mt-1 text-muted-foreground">{s.text}</p></div>
              </li>
            ))}
          </ol>
          <p className="mt-6 text-sm text-muted-foreground">Requirements change from time to time. Always confirm current rules with NSE and COREN.</p>
        </section>

        <section>
          <h2 className="text-2xl font-bold">Useful links</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {USEFUL_LINKS.map((l) => (
              <a key={l.url} href={l.url} target="_blank" rel="noopener noreferrer" className="group flex items-center justify-between gap-3 rounded-2xl border bg-card p-4 transition hover:border-primary/40 hover:shadow-md">
                <div><p className="font-semibold group-hover:text-primary">{l.label}</p><p className="text-sm text-muted-foreground">{l.note}</p></div>
                <ExternalLink className="h-4 w-4 shrink-0 text-muted-foreground" />
              </a>
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-bold">Student portal help</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {[
              ['Create an account', 'Apply with your matric number, department and level, then type the 6 digit code from your email.', '/auth/apply'],
              ['Forgot your password', 'Get a 6 digit code by email and set a new password.', '/auth/forgot-password'],
              ['Log in', 'Students, lecturers and admins sign in here.', '/auth/login'],
            ].map(([t, d, to]) => (
              <Link key={t} to={to} className="rounded-2xl border bg-card p-4 transition hover:border-primary/40 hover:shadow-md">
                <p className="font-semibold">{t}</p><p className="mt-1 text-sm text-muted-foreground">{d}</p>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </BlogLayout>
  );
}

export function BlogEvents() {
  useTitle('Events');
  const upcoming = useBlogData<BlogEvent[]>(() => fetchEvents(true));
  const Item = ({ e }: { e: BlogEvent }) => {
    const d = new Date(e.starts_at);
    return (
      <div className="flex gap-4 rounded-2xl border bg-card p-5">
        <div className="flex h-20 w-20 shrink-0 flex-col items-center justify-center rounded-2xl bg-primary text-primary-foreground">
          <span className="text-2xl font-extrabold leading-none">{d.getDate()}</span>
          <span className="text-xs font-semibold uppercase">{d.toLocaleString('en-GB', { month: 'short' })} {d.getFullYear()}</span>
        </div>
        <div className="min-w-0">
          <p className="text-lg font-bold">{e.title}</p>
          <p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground"><CalendarDays className="h-4 w-4" />{d.toLocaleDateString('en-GB', { weekday: 'long' })}, {d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</p>
          {e.location && <p className="flex items-center gap-1 text-sm text-muted-foreground"><MapPin className="h-4 w-4" />{e.location}</p>}
          {e.description && <p className="mt-2 text-sm">{e.description}</p>}
          {e.link && <a href={e.link} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-primary">Details <ExternalLink className="h-3.5 w-3.5" /></a>}
        </div>
      </div>
    );
  };
  return (
    <BlogLayout>
      <PageHero title="Events" text="Elections, seminars, industrial visits, competitions and social events from NUESA UniAbuja." />
      <div className="mx-auto max-w-4xl space-y-4 px-4 py-10 sm:px-6">
        {upcoming.loading ? null : (upcoming.data || []).length ? (upcoming.data || []).map((e) => <Item key={e.id} e={e} />) : <EmptyState>No upcoming events right now.</EmptyState>}
      </div>
    </BlogLayout>
  );
}

export function BlogSearch() {
  const [params, setParams] = useSearchParams();
  const term = params.get('q') || '';
  const [q, setQ] = useState(term);
  useTitle(term ? `Search: ${term}` : 'Search');
  const safe = term.replace(/[%,()]/g, ' ').trim();
  const posts = useBlogData<Post[]>(() => (safe ? fetchPosts({ search: safe, limit: 12 }) : Promise.resolve({ data: [] })), [safe]);
  const news = useBlogData<NewsItem[]>(() => (safe ? fetchNews({ search: safe, limit: 30 }) : Promise.resolve({ data: [] })), [safe]);

  return (
    <BlogLayout>
      <section className="border-b bg-gradient-to-b from-primary/10 to-transparent">
        <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
          <h1 className="text-3xl font-extrabold tracking-tight">Search</h1>
          <form onSubmit={(e) => { e.preventDefault(); setParams(q.trim() ? { q: q.trim() } : {}); }} className="relative mt-4 max-w-xl">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search news and articles" aria-label="Search"
              className="h-11 w-full rounded-full border bg-background pl-9 pr-4 text-sm outline-none focus:border-primary" />
          </form>
        </div>
      </section>
      <div className="mx-auto max-w-5xl space-y-10 px-4 py-8 sm:px-6">
        {!safe ? <EmptyState>Type something to search.</EmptyState> : (
          <>
            <section>
              <h2 className="mb-4 text-xl font-bold">Articles <span className="text-muted-foreground">({(posts.data || []).length})</span></h2>
              {(posts.data || []).length ? <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">{(posts.data || []).map((p) => <PostCard key={p.id} post={p} />)}</div> : <EmptyState>No articles match "{term}".</EmptyState>}
            </section>
            <section>
              <h2 className="mb-4 text-xl font-bold">News <span className="text-muted-foreground">({(news.data || []).length})</span></h2>
              {(news.data || []).length ? <div className="divide-y rounded-2xl border bg-card">{(news.data || []).map((n) => <NewsRow key={n.id} item={n} />)}</div> : <EmptyState>No headlines match "{term}".</EmptyState>}
            </section>
          </>
        )}
      </div>
    </BlogLayout>
  );
}

export { longDate };
