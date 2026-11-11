import { BlogLayout } from './BlogLayout';
import { LOGOS } from './content';
import { EmptyState, Leader, LeaderCard, fetchLeaders, useBlogData, useTitle } from './shared';

const BODIES: { key: string; title: string; about: string }[] = [
  { key: 'NUESA UniAbuja', title: 'NUESA, University of Abuja chapter', about: 'The student executives who run our chapter.' },
  { key: 'Faculty', title: 'Faculty of Engineering, University of Abuja', about: 'Dean, heads of department and staff advisers.' },
  { key: 'NUESA National', title: 'NUESA National', about: 'The national executive of the Nigerian Universities Engineering Students\' Association.' },
  { key: 'NSE', title: 'Nigerian Society of Engineers (NSE)', about: 'The professional body for engineers in Nigeria, founded in 1958, with 93 branches and 25 divisions. These are the 2026 national officers.' },
  { key: 'NSE Abuja', title: 'NSE Abuja Branch', about: 'The NSE branch closest to our campus.' },
  { key: 'COREN', title: 'Council for the Regulation of Engineering in Nigeria (COREN)', about: 'The government regulator that registers engineering practitioners and accredits engineering programmes.' },
];

export default function BlogLeadership() {
  useTitle('Leadership');
  const leaders = useBlogData<Leader[]>(() => fetchLeaders());
  const all = leaders.data || [];
  const known = new Set(BODIES.map((b) => b.key));
  const extra = Array.from(new Set(all.map((l) => l.body).filter((b) => !known.has(b))));
  const sections = [...BODIES, ...extra.map((k) => ({ key: k, title: k, about: '' }))]
    .map((b) => ({ ...b, people: all.filter((l) => l.body === b.key) }))
    .filter((b) => b.people.length > 0);

  return (
    <BlogLayout>
      <section className="border-b bg-muted/40">
        <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
          <h1 className="text-4xl font-extrabold tracking-tight">Leadership</h1>
          <p className="mt-2 max-w-2xl text-muted-foreground">The people leading Nigerian engineering, from the national professional bodies to our own chapter. Each entry links to where we got it.</p>
        </div>
      </section>
      <div className="mx-auto max-w-6xl space-y-12 px-4 py-10 sm:px-6">
        {leaders.loading ? null : sections.length === 0 ? <EmptyState>Leadership details are being added.</EmptyState> : sections.map((s) => (
          <section key={s.key}>
            <div className="flex items-center gap-3">
              {LOGOS[s.key] && <img src={LOGOS[s.key]} alt="" className="h-12 w-12 shrink-0 rounded-xl border bg-white object-contain p-1" />}
              <h2 className="text-2xl font-bold">{s.title}</h2>
            </div>
            {s.about && <p className="mt-1 text-muted-foreground">{s.about}</p>}
            <div className="mt-5 grid gap-4 md:grid-cols-2">{s.people.map((l) => <LeaderCard key={l.id} leader={l} />)}</div>
          </section>
        ))}
      </div>
    </BlogLayout>
  );
}
