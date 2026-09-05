import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator,
} from '@/components/ui/command';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { BookOpen, FileText, ClipboardList, MessageSquare, LifeBuoy, Search, Loader2, Clock } from 'lucide-react';

interface Result {
  id: string;
  title: string;
  subtitle?: string | null;
  url: string;
}

interface Results {
  courses: Result[];
  materials: Result[];
  assignments: Result[];
  quizzes: Result[];
  announcements: Result[];
  tickets: Result[];
}

const EMPTY: Results = { courses: [], materials: [], assignments: [], quizzes: [], announcements: [], tickets: [] };
const RECENT_KEY = 'nuesa.recentSearches';

export function GlobalSearch() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<Results>(EMPTY);
  const [recent, setRecent] = useState<string[]>([]);
  const requestId = useRef(0);

  const role = profile?.role === 'teacher' ? 'teacher' : profile?.role === 'admin' ? 'admin' : 'student';

  useEffect(() => {
    try {
      const saved = localStorage.getItem(RECENT_KEY);
      if (saved) setRecent(JSON.parse(saved));
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const runSearch = useCallback(async (value: string) => {
    const q = value.trim();
    if (q.length < 2) {
      setResults(EMPTY);
      setLoading(false);
      return;
    }
    const current = ++requestId.current;
    setLoading(true);
    const like = `%${q}%`;

    // Every query runs with the signed-in user's own permissions, so results
    // are automatically limited to what this person is allowed to see.
    const [courses, materials, assignments, quizzes, announcements, tickets] = await Promise.all([
      supabase.from('courses').select('id, name, description, semester').or(`name.ilike.${like},description.ilike.${like}`).limit(5),
      supabase.from('materials').select('id, title, description').or(`title.ilike.${like},description.ilike.${like}`).limit(5),
      supabase.from('assignments').select('id, title, description').or(`title.ilike.${like},description.ilike.${like}`).limit(5),
      supabase.from('quizzes').select('id, title, description').or(`title.ilike.${like},description.ilike.${like}`).limit(5),
      supabase.from('announcements').select('id, title, content').or(`title.ilike.${like},content.ilike.${like}`).limit(5),
      supabase.from('support_tickets').select('id, ticket_number, subject, status').or(`subject.ilike.${like},description.ilike.${like}`).limit(5),
    ]);

    if (current !== requestId.current) return;

    setResults({
      courses: (courses.data ?? []).map((c) => ({
        id: c.id, title: c.name ?? 'Course', subtitle: c.semester, url: `/${role}/courses`,
      })),
      materials: (materials.data ?? []).map((m) => ({
        id: m.id, title: m.title, subtitle: m.description,
        url: role === 'student' ? '/student/view-materials' : '/teacher/upload-materials',
      })),
      assignments: (assignments.data ?? []).map((a) => ({
        id: a.id, title: a.title, subtitle: a.description,
        url: role === 'student' ? '/student/submit-assignment' : '/teacher/assignments',
      })),
      quizzes: (quizzes.data ?? []).map((q2) => ({
        id: q2.id, title: q2.title, subtitle: q2.description, url: `/${role}/quizzes`,
      })),
      announcements: (announcements.data ?? []).map((a) => ({
        id: a.id, title: a.title, subtitle: a.content?.slice(0, 80),
        url: role === 'student' ? '/student/notifications' : `/${role}/announcements`,
      })),
      tickets: (tickets.data ?? []).map((t) => ({
        id: t.id, title: `#${t.ticket_number} — ${t.subject}`, subtitle: t.status.replace(/_/g, ' '),
        url: role === 'student' ? '/student/support' : '/admin/support',
      })),
    });
    setLoading(false);
  }, [role]);

  useEffect(() => {
    const t = setTimeout(() => runSearch(term), 250);
    return () => clearTimeout(t);
  }, [term, runSearch]);

  const select = (result: Result) => {
    const next = [term.trim(), ...recent.filter((r) => r !== term.trim())].filter(Boolean).slice(0, 5);
    setRecent(next);
    try { localStorage.setItem(RECENT_KEY, JSON.stringify(next)); } catch { /* ignore */ }
    setOpen(false);
    setTerm('');
    navigate(result.url);
  };

  const groups: Array<{ key: keyof Results; label: string; icon: typeof BookOpen }> = [
    { key: 'courses', label: 'Courses', icon: BookOpen },
    { key: 'materials', label: 'Materials', icon: FileText },
    { key: 'assignments', label: 'Assignments', icon: ClipboardList },
    { key: 'quizzes', label: 'Quizzes', icon: BookOpen },
    { key: 'announcements', label: 'Announcements', icon: MessageSquare },
    { key: 'tickets', label: 'Support tickets', icon: LifeBuoy },
  ];

  const hasResults = groups.some((g) => results[g.key].length > 0);

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="gap-2 px-2 sm:px-3 text-muted-foreground border-theme-border/60 hover:bg-theme-light hover:text-theme focus-visible:ring-theme"
        aria-label="Search the portal"
      >
        <Search className="h-4 w-4 text-theme" />
        <span className="hidden md:inline">Search</span>
        <kbd className="hidden lg:inline pointer-events-none rounded border bg-muted px-1.5 text-[10px] font-medium">
          ⌘K
        </kbd>
      </Button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput
          placeholder="Search courses, materials, assignments, announcements…"
          value={term}
          onValueChange={setTerm}
        />
        <CommandList>
          {loading && (
            <div className="flex items-center gap-2 px-4 py-6 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Searching…
            </div>
          )}

          {!loading && term.trim().length < 2 && (
            recent.length > 0 ? (
              <CommandGroup heading="Recent searches">
                {recent.map((r) => (
                  <CommandItem key={r} value={r} onSelect={() => setTerm(r)}>
                    <Clock className="mr-2 h-4 w-4 text-muted-foreground" /> {r}
                  </CommandItem>
                ))}
              </CommandGroup>
            ) : (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                Type at least two letters to search across the portal.
              </div>
            )
          )}

          {!loading && term.trim().length >= 2 && !hasResults && (
            <CommandEmpty>
              Nothing found for “{term.trim()}”. Try a course code, a title, or fewer words.
            </CommandEmpty>
          )}

          {!loading && groups.map((group, index) => (
            results[group.key].length > 0 && (
              <div key={group.key}>
                {index > 0 && <CommandSeparator />}
                <CommandGroup heading={group.label}>
                  {results[group.key].map((r) => (
                    <CommandItem key={r.id} value={`${group.key}-${r.id}-${r.title}`} onSelect={() => select(r)}>
                      <group.icon className="mr-2 h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="truncate">{r.title}</span>
                      {r.subtitle && (
                        <span className="ml-2 truncate text-xs text-muted-foreground">{r.subtitle}</span>
                      )}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </div>
            )
          ))}
        </CommandList>
      </CommandDialog>
    </>
  );
}
