import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/Layout/DashboardLayout';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { calculateStudentGPA } from '@/lib/gpa';
import { getDeadlineStatus } from '@/lib/deadline';
import { DeadlineBadge, DeadlineLegend } from '@/components/Shared/DeadlineBadge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  AlertCircle,
  Bell,
  BookOpen,
  CalendarDays,
  CreditCard,
  FileText,
  GraduationCap,
  Megaphone,
  RefreshCw,
  Upload,
  MessageCircle,
  ClipboardList,
} from 'lucide-react';

interface DeadlineItem {
  id: string;
  title: string;
  courseName: string;
  dueDate: string;
  kind: 'Assignment' | 'Quiz';
  href: string;
}

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function greeting(d = new Date()) {
  const h = d.getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

const QUICK_ACTIONS = [
  { label: 'Courses', to: '/student/courses', icon: BookOpen },
  { label: 'Results', to: '/student/view-results', icon: GraduationCap },
  { label: 'Assignments', to: '/student/submit-assignment', icon: Upload },
  { label: 'Timetable', to: '/student/timetable', icon: CalendarDays },
  { label: 'Materials', to: '/student/view-materials', icon: FileText },
  { label: 'Quizzes', to: '/student/quizzes', icon: ClipboardList },
  { label: 'Payments', to: '/student/payments', icon: CreditCard },
  { label: 'Support', to: '/student/feedback', icon: MessageCircle },
];

export default function StudentDashboard() {
  const { profile } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [errored, setErrored] = useState(false);

  const [gpa, setGpa] = useState<number | null>(null);
  const [semester, setSemester] = useState<string | null>(null);
  const [courseCount, setCourseCount] = useState(0);
  const [totalUnits, setTotalUnits] = useState(0);
  const [completedUnits, setCompletedUnits] = useState(0);
  const [todayClasses, setTodayClasses] = useState<any[]>([]);
  const [deadlines, setDeadlines] = useState<DeadlineItem[]>([]);
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [outstanding, setOutstanding] = useState<{ title: string; amount: number; due: string | null } | null>(null);

  const load = async () => {
    if (!profile?.id) return;
    setLoading(true);
    setErrored(false);
    try {
      const { data: enrollments } = await supabase
        .from('student_enrollments')
        .select('course_id, courses(id, name, credit_unit, semester, subjects(name, code))')
        .eq('student_id', profile.id);

      const courseIds = (enrollments || []).map((e: any) => e.course_id).filter(Boolean);
      setCourseCount(courseIds.length);
      setTotalUnits(
        (enrollments || []).reduce((sum: number, e: any) => sum + (e.courses?.credit_unit || 0), 0),
      );

      const dow = new Date().getDay();

      const [
        semesterRes,
        timetableRes,
        assignmentsRes,
        quizzesRes,
        submissionsRes,
        quizSubsRes,
        annRes,
        notifRes,
        paymentsRes,
        paidRes,
      ] = await Promise.all([
        supabase.from('semester_config').select('name').eq('is_active', true).maybeSingle(),
        courseIds.length
          ? supabase
              .from('timetable')
              .select('id, start_time, end_time, room, course_id, courses(name, subjects(code, name))')
              .in('course_id', courseIds)
              .eq('day_of_week', dow)
              .order('start_time')
          : Promise.resolve({ data: [] as any[] }),
        courseIds.length
          ? supabase
              .from('assignments')
              .select('id, title, due_date, course_id, courses(name, subjects(code, name))')
              .in('course_id', courseIds)
              .not('due_date', 'is', null)
          : Promise.resolve({ data: [] as any[] }),
        courseIds.length
          ? supabase
              .from('quizzes')
              .select('id, title, status, created_at, course_id, courses(name, subjects(code, name))')
              .in('course_id', courseIds)
              .eq('status', 'published')
          : Promise.resolve({ data: [] as any[] }),
        supabase.from('assignment_submissions').select('assignment_id').eq('student_id', profile.id),
        supabase.from('quiz_submissions').select('quiz_id').eq('student_id', profile.id),
        supabase
          .from('announcements')
          .select('id, title, content, type, is_pinned, created_at')
          .order('is_pinned', { ascending: false })
          .order('created_at', { ascending: false })
          .limit(4),
        supabase
          .from('notifications')
          .select('id, title, message, type, is_read, created_at')
          .eq('user_id', profile.id)
          .order('created_at', { ascending: false })
          .limit(4),
        supabase
          .from('payments')
          .select('id, title, amount, due_date')
          .order('due_date', { ascending: true }),
        supabase.from('payment_records').select('payment_id, status').eq('student_id', profile.id),
      ]);

      setSemester((semesterRes as any)?.data?.name ?? null);
      setTodayClasses((timetableRes as any)?.data || []);

      const submittedIds = new Set(((submissionsRes as any)?.data || []).map((s: any) => s.assignment_id));
      const quizDone = new Set(((quizSubsRes as any)?.data || []).map((s: any) => s.quiz_id));

      const items: DeadlineItem[] = ((assignmentsRes as any)?.data || [])
        .filter((a: any) => !submittedIds.has(a.id))
        .map((a: any) => ({
          id: a.id,
          title: a.title,
          courseName: a.courses?.subjects?.code || a.courses?.name || 'Course',
          dueDate: a.due_date,
          kind: 'Assignment' as const,
          href: '/student/submit-assignment',
        }));

      ((quizzesRes as any)?.data || [])
        .filter((q: any) => !quizDone.has(q.id))
        .forEach((q: any) => {
          items.push({
            id: q.id,
            title: q.title,
            courseName: q.courses?.subjects?.code || q.courses?.name || 'Course',
            dueDate: q.created_at,
            kind: 'Quiz',
            href: '/student/quizzes',
          });
        });

      items.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
      setDeadlines(items.filter((i) => i.kind === 'Assignment').slice(0, 5));

      setAnnouncements(((annRes as any)?.data || []).slice(0, 3));
      const notifs = (notifRes as any)?.data || [];
      setNotifications(notifs);
      setUnreadCount(notifs.filter((n: any) => !n.is_read).length);

      const paidIds = new Set(
        (((paidRes as any)?.data || []) as any[])
          .filter((r) => r.status === 'success' || r.status === 'successful' || r.status === 'completed')
          .map((r) => r.payment_id),
      );
      const nextPayment = (((paymentsRes as any)?.data || []) as any[]).find((p) => !paidIds.has(p.id));
      setOutstanding(
        nextPayment
          ? { title: nextPayment.title, amount: Number(nextPayment.amount || 0), due: nextPayment.due_date }
          : null,
      );

      try {
        const result = await calculateStudentGPA(profile.id);
        setGpa(result.gpa);
        setCompletedUnits(result.totalCredits);
      } catch {
        setGpa(null);
      }
    } catch (e) {
      console.error('[Dashboard] load failed', e);
      setErrored(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id]);

  const firstName = useMemo(
    () => (profile?.full_name || '').trim().split(' ')[0] || 'there',
    [profile?.full_name],
  );

  const urgentDeadline = deadlines.find((d) => {
    const s = getDeadlineStatus(d.dueDate);
    return s && (s.level === 'critical' || s.level === 'soon' || s.level === 'overdue');
  });

  const outstandingOverdue = !!(
    outstanding?.due && getDeadlineStatus(outstanding.due)?.level === 'overdue'
  );

  const hasToday =
    todayClasses.length > 0 || !!urgentDeadline || !!outstanding || unreadCount > 0;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
              {greeting()}, <span className="text-theme">{firstName}</span>.
            </h1>
            <p className="text-sm text-muted-foreground">Here's what you have coming up today.</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={load}
            disabled={loading}
            aria-label="Refresh dashboard"
            className="border-theme-border/60 text-theme hover:bg-theme-light hover:text-theme focus-visible:ring-theme"
          >
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
            <span className="ml-2 hidden sm:inline">Refresh</span>
          </Button>
        </header>

        {errored && (
          <Card className="border-destructive/40">
            <CardContent className="flex flex-wrap items-center gap-3 p-4">
              <AlertCircle className="h-4 w-4 text-destructive" />
              <p className="text-sm">Something went wrong loading your dashboard.</p>
              <Button size="sm" variant="outline" onClick={load}>
                Try again
              </Button>
            </CardContent>
          </Card>
        )}

        {loading ? (
          <div className="space-y-4">
            <Skeleton className="h-28 w-full" />
            <div className="grid gap-4 md:grid-cols-2">
              <Skeleton className="h-56 w-full" />
              <Skeleton className="h-56 w-full" />
            </div>
          </div>
        ) : (
          <>
            {/* Today's overview */}
            <Card className="overflow-hidden border-theme-border/40">
              <div className="h-1 w-full bg-theme" aria-hidden="true" />
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <CalendarDays className="h-4 w-4 text-theme" aria-hidden="true" />
                  Today · {DAYS[new Date().getDay()]}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {!hasToday && (
                  <p className="text-sm text-muted-foreground">
                    Nothing scheduled today. Enjoy the breathing room.
                  </p>
                )}

                {urgentDeadline && (
                  <Link
                    to={urgentDeadline.href}
                    className={cn(
                      'flex items-center justify-between gap-3 rounded-md border border-l-2 bg-card p-3 transition-colors hover:bg-accent',
                      getDeadlineStatus(urgentDeadline.dueDate)?.accentClass,
                    )}
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{urgentDeadline.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {urgentDeadline.kind} · {urgentDeadline.courseName}
                      </p>
                    </div>
                    <DeadlineBadge dueDate={urgentDeadline.dueDate} />
                  </Link>
                )}

                {todayClasses.map((c) => (
                  <div
                    key={c.id}
                    className="flex items-center justify-between gap-3 rounded-md border border-l-2 border-l-theme bg-theme-light/50 p-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {c.courses?.subjects?.code || c.courses?.name || 'Class'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {c.room ? `Room ${c.room}` : 'Venue TBA'}
                      </p>
                    </div>
                    <span className="whitespace-nowrap rounded-full bg-theme-muted px-2 py-0.5 text-xs font-medium text-theme">
                      {String(c.start_time).slice(0, 5)} – {String(c.end_time).slice(0, 5)}
                    </span>
                  </div>
                ))}

                {outstanding && (
                  <Link
                    to="/student/payments"
                    className={cn(
                      'flex items-center justify-between gap-3 rounded-md border border-l-2 p-3 transition-colors',
                      outstandingOverdue
                        ? 'border-destructive/40 border-l-destructive bg-destructive/5 hover:bg-destructive/10'
                        : 'border-l-theme hover:bg-theme-light',
                    )}
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{outstanding.title}</p>
                      <p className={cn('text-xs', outstandingOverdue ? 'font-medium text-destructive' : 'text-muted-foreground')}>
                        {outstandingOverdue ? 'Overdue payment' : 'Outstanding payment'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={cn('text-sm font-semibold', outstandingOverdue && 'text-destructive')}>
                        ₦{outstanding.amount.toLocaleString()}
                      </span>
                      {outstanding.due && <DeadlineBadge dueDate={outstanding.due} />}
                    </div>
                  </Link>
                )}
              </CardContent>
            </Card>

            {/* Academic snapshot */}
            <Card className="border-theme-border/40">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <GraduationCap className="h-4 w-4 text-theme" aria-hidden="true" />
                  Academic snapshot
                </CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                  {[
                    { label: 'GPA', value: gpa != null ? gpa.toFixed(2) : '—' },
                    { label: 'Semester', value: semester || '—' },
                    { label: 'Courses', value: String(courseCount) },
                    { label: 'Registered units', value: String(totalUnits) },
                    { label: 'Graded units', value: String(completedUnits) },
                  ].map((m) => (
                    <div
                      key={m.label}
                      className="rounded-md border border-theme-border/40 bg-theme-light/40 p-3"
                    >
                      <dt className="text-xs text-muted-foreground">{m.label}</dt>
                      <dd className="truncate text-lg font-semibold text-theme">{m.value}</dd>
                    </div>
                  ))}
                </dl>
              </CardContent>
            </Card>

            <div className="grid gap-4 lg:grid-cols-2">
              {/* Deadlines */}
              <Card className="border-theme-border/40">
                <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <ClipboardList className="h-4 w-4 text-theme" aria-hidden="true" />
                    Upcoming deadlines
                  </CardTitle>
                  <DeadlineLegend />
                </CardHeader>
                <CardContent className="space-y-2">
                  {deadlines.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No upcoming deadlines.</p>
                  ) : (
                    deadlines.map((d) => {
                      const status = getDeadlineStatus(d.dueDate);
                      return (
                        <Link
                          key={`${d.kind}-${d.id}`}
                          to={d.href}
                          className={cn(
                            'flex items-center justify-between gap-3 rounded-md border border-l-2 p-3 transition-colors hover:bg-accent',
                            status?.accentClass,
                          )}
                        >
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">{d.title}</p>
                            <p className="text-xs text-muted-foreground">
                              {d.kind} · {d.courseName}
                            </p>
                          </div>
                          <DeadlineBadge dueDate={d.dueDate} />
                        </Link>
                      );
                    })
                  )}
                  <Button variant="ghost" size="sm" className="w-full text-theme hover:bg-theme-light hover:text-theme" asChild>
                    <Link to="/student/submit-assignment">View all assignments</Link>
                  </Button>
                </CardContent>
              </Card>

              {/* Announcements */}
              <Card className="border-theme-border/40">
                <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Megaphone className="h-4 w-4 text-theme" aria-hidden="true" />
                    Recent announcements
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {announcements.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No recent announcements.</p>
                  ) : (
                    announcements.map((a) => (
                      <div
                        key={a.id}
                        className={cn(
                          'rounded-md border border-l-2 p-3',
                          a.type === 'urgent'
                            ? 'border-destructive/40 border-l-destructive bg-destructive/5'
                            : 'border-l-theme bg-theme-light/40',
                        )}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="truncate text-sm font-medium">{a.title}</p>
                          {a.type === 'urgent' && (
                            <Badge variant="destructive" className="shrink-0 text-[10px]">
                              Urgent
                            </Badge>
                          )}
                        </div>
                        <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{a.content}</p>
                        <p className="mt-1 text-[11px] text-muted-foreground">{timeAgo(a.created_at)}</p>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Notifications */}
            <Card className="border-theme-border/40">
              <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Bell className="h-4 w-4 text-theme" aria-hidden="true" />
                  Notifications
                  {unreadCount > 0 && (
                    <Badge className="border-theme-border/50 bg-theme-muted text-[10px] text-theme hover:bg-theme-muted">
                      {unreadCount} unread
                    </Badge>
                  )}
                </CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-theme hover:bg-theme-light hover:text-theme"
                  onClick={() => navigate('/student/notifications')}
                >
                  View all
                </Button>
              </CardHeader>
              <CardContent className="space-y-2">
                {notifications.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No recent notifications.</p>
                ) : (
                  notifications.map((n) => (
                    <div
                      key={n.id}
                      className={cn(
                        'flex items-start justify-between gap-3 rounded-md border p-3',
                        !n.is_read && 'border-l-2 border-l-theme bg-theme-light/60',
                      )}
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{n.title}</p>
                        <p className="line-clamp-1 text-xs text-muted-foreground">{n.message}</p>
                      </div>
                      <span className="whitespace-nowrap text-[11px] text-muted-foreground">
                        {timeAgo(n.created_at)}
                      </span>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            {/* Quick actions */}
            <Card className="border-theme-border/40">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Quick actions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {QUICK_ACTIONS.map((a) => (
                    <Link
                      key={a.to}
                      to={a.to}
                      className="flex min-h-[64px] flex-col items-center justify-center gap-1.5 rounded-md border p-3 text-center text-xs font-medium transition-colors hover:border-theme-border hover:bg-theme-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-theme"
                    >
                      <a.icon className="h-4 w-4 text-theme" aria-hidden="true" />
                      {a.label}
                    </Link>
                  ))}
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
