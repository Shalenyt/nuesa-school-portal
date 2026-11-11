import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { DashboardLayout } from '@/components/Layout/DashboardLayout';
import { firstNameOf } from '@/lib/name';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { DeadlineBadge } from '@/components/Shared/DeadlineBadge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import {
  AlertCircle,
  BookOpen,
  CalendarDays,
  ClipboardCheck,
  ClipboardList,
  GraduationCap,
  Inbox,
  Megaphone,
  RefreshCw,
  Upload,
  UserCheck,
  Users,
} from 'lucide-react';

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

const hhmm = (t: string) => String(t).slice(0, 5);

const QUICK_ACTIONS = [
  { label: 'My Courses', to: '/teacher/courses', icon: BookOpen },
  { label: 'Class Schedule', to: '/teacher/class-schedule', icon: CalendarDays },
  { label: 'Attendance', to: '/teacher/attendance', icon: UserCheck },
  { label: 'Assignments', to: '/teacher/assignments', icon: ClipboardList },
  { label: 'Grade', to: '/teacher/grade-assignments', icon: ClipboardCheck },
  { label: 'Quizzes', to: '/teacher/quizzes', icon: GraduationCap },
  { label: 'Materials', to: '/teacher/upload-materials', icon: Upload },
  { label: 'Students', to: '/teacher/view-students', icon: Users },
];

type Activity = {
  id: string;
  kind: 'Assignment' | 'Quiz';
  studentName: string;
  title: string;
  courseCode: string;
  at: string;
  href: string;
};

export default function TeacherDashboard() {
  const { profile } = useAuth();
  const firstName = firstNameOf(profile, 'Lecturer');

  const [loading, setLoading] = useState(true);
  const [errored, setErrored] = useState(false);

  const [semester, setSemester] = useState<string | null>(null);
  const [courseCount, setCourseCount] = useState(0);
  const [studentCount, setStudentCount] = useState(0);
  const [toGrade, setToGrade] = useState(0);
  const [quizToday, setQuizToday] = useState(0);
  const [submittedToday, setSubmittedToday] = useState(0);
  const [todayClasses, setTodayClasses] = useState<any[]>([]);
  const [activity, setActivity] = useState<Activity[]>([]);
  const [upcoming, setUpcoming] = useState<any[]>([]);
  const [announcements, setAnnouncements] = useState<any[]>([]);

  const load = async () => {
    if (!profile?.id) return;
    setLoading(true);
    setErrored(false);
    try {
      const { data: courses, error: coursesError } = await supabase
        .from('courses')
        .select('id, name, description')
        .eq('teacher_id', profile.id);
      if (coursesError) throw coursesError;

      const courseIds = (courses || []).map((c) => c.id);
      const courseById = new Map((courses || []).map((c) => [c.id, c]));
      setCourseCount(courseIds.length);

      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);
      const nowIso = new Date().toISOString();
      const none = Promise.resolve({ data: [] as any[] });

      const [semesterRes, timetableRes, enrollRes, assignmentsRes, quizzesRes, annRes] = await Promise.all([
        supabase.from('semester_config').select('name').eq('is_active', true).maybeSingle(),
        courseIds.length
          ? supabase.from('timetable').select('id, course_id, start_time, end_time, room')
              .in('course_id', courseIds).eq('day_of_week', new Date().getDay()).order('start_time')
          : none,
        courseIds.length
          ? supabase.from('student_enrollments').select('student_id').in('course_id', courseIds)
          : none,
        courseIds.length
          ? supabase.from('assignments').select('id, title, due_date, course_id').in('course_id', courseIds)
          : none,
        courseIds.length
          ? supabase.from('quizzes').select('id, title, course_id').in('course_id', courseIds)
          : none,
        supabase.from('announcements').select('id, title, content, created_at')
          .order('is_pinned', { ascending: false }).order('created_at', { ascending: false }).limit(3),
      ]);

      setSemester((semesterRes as any)?.data?.name ?? null);
      setTodayClasses(((timetableRes as any).data || []).map((t: any) => ({ ...t, course: courseById.get(t.course_id) })));
      setStudentCount(new Set(((enrollRes as any).data || []).map((e: any) => e.student_id)).size);
      setAnnouncements((annRes as any).data || []);

      const assignments: any[] = (assignmentsRes as any).data || [];
      const quizzes: any[] = (quizzesRes as any).data || [];
      const assignmentById = new Map(assignments.map((a) => [a.id, a]));
      const quizById = new Map(quizzes.map((q) => [q.id, q]));

      setUpcoming(
        assignments
          .filter((a) => a.due_date && a.due_date >= nowIso)
          .sort((a, b) => a.due_date.localeCompare(b.due_date))
          .slice(0, 5)
          .map((a) => ({ ...a, courseCode: courseById.get(a.course_id)?.name || 'Course' })),
      );

      const [subsRes, quizSubsRes] = await Promise.all([
        assignments.length
          ? supabase.from('assignment_submissions')
              .select('id, assignment_id, grade, submitted_at, profiles!assignment_submissions_student_id_fkey(full_name)')
              .in('assignment_id', assignments.map((a) => a.id))
              .order('submitted_at', { ascending: false })
          : none,
        quizzes.length
          ? supabase.from('quiz_submissions')
              .select('id, quiz_id, submitted_at, profiles!quiz_submissions_student_id_fkey(full_name)')
              .in('quiz_id', quizzes.map((q) => q.id))
              .order('submitted_at', { ascending: false })
          : none,
      ]);

      const subs: any[] = (subsRes as any).data || [];
      const quizSubs: any[] = (quizSubsRes as any).data || [];
      const today = startOfToday.getTime();

      setToGrade(subs.filter((s) => s.grade === null).length);
      setSubmittedToday(subs.filter((s) => new Date(s.submitted_at).getTime() >= today).length);
      setQuizToday(quizSubs.filter((s) => new Date(s.submitted_at).getTime() >= today).length);

      const items: Activity[] = [
        ...subs.map((s) => {
          const a = assignmentById.get(s.assignment_id);
          return {
            id: `a-${s.id}`,
            kind: 'Assignment' as const,
            studentName: s.profiles?.full_name || 'A student',
            title: a?.title || 'Assignment',
            courseCode: courseById.get(a?.course_id)?.name || '',
            at: s.submitted_at,
            href: '/teacher/grade-assignments',
          };
        }),
        ...quizSubs.map((s) => {
          const q = quizById.get(s.quiz_id);
          return {
            id: `q-${s.id}`,
            kind: 'Quiz' as const,
            studentName: s.profiles?.full_name || 'A student',
            title: q?.title || 'Quiz',
            courseCode: courseById.get(q?.course_id)?.name || '',
            at: s.submitted_at,
            href: '/teacher/quizzes',
          };
        }),
      ].sort((x, y) => y.at.localeCompare(x.at)).slice(0, 6);
      setActivity(items);
    } catch (e) {
      console.error('Lecturer dashboard failed to load:', e);
      setErrored(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [profile?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const hasToday = todayClasses.length > 0 || toGrade > 0 || submittedToday > 0 || quizToday > 0;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
              {greeting()}, <span className="text-theme">{firstName}</span>.
            </h1>
            <p className="text-sm text-muted-foreground">Here's your teaching day at a glance.</p>
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
              <Button size="sm" variant="outline" onClick={load}>Try again</Button>
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
            {/* Today */}
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
                    {courseCount === 0
                      ? 'No courses assigned to you yet. Your classes and student activity will appear here once the admin assigns your courses.'
                      : 'No lectures today and nothing waiting for you.'}
                  </p>
                )}

                {todayClasses.map((c) => (
                  <div
                    key={c.id}
                    className="flex items-center justify-between gap-3 rounded-md border border-l-2 border-l-theme bg-theme-light/50 p-3"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{c.course?.name || 'Lecture'}</p>
                      {c.course?.description && <p className="text-sm text-muted-foreground">{c.course.description}</p>}
                      <p className="text-xs text-muted-foreground">{c.room || 'Venue TBA'}</p>
                    </div>
                    <span className="whitespace-nowrap rounded-full bg-theme-muted px-2 py-0.5 text-xs font-medium text-theme">
                      {hhmm(c.start_time)} to {hhmm(c.end_time)}
                    </span>
                  </div>
                ))}

                {toGrade > 0 && (
                  <Link
                    to="/teacher/grade-assignments"
                    className="flex items-center justify-between gap-3 rounded-md border border-l-2 border-l-theme p-3 transition-colors hover:bg-theme-light"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium">
                        {toGrade} assignment submission{toGrade === 1 ? '' : 's'} to grade
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {submittedToday > 0 ? `${submittedToday} submitted today` : 'Waiting for your marks'}
                      </p>
                    </div>
                    <ClipboardCheck className="h-4 w-4 shrink-0 text-theme" aria-hidden="true" />
                  </Link>
                )}

                {quizToday > 0 && (
                  <Link
                    to="/teacher/quizzes"
                    className="flex items-center justify-between gap-3 rounded-md border border-l-2 border-l-theme p-3 transition-colors hover:bg-theme-light"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium">
                        {quizToday} quiz attempt{quizToday === 1 ? '' : 's'} today
                      </p>
                      <p className="text-xs text-muted-foreground">Review submissions and release results</p>
                    </div>
                    <GraduationCap className="h-4 w-4 shrink-0 text-theme" aria-hidden="true" />
                  </Link>
                )}
              </CardContent>
            </Card>

            {/* Snapshot */}
            <Card className="border-theme-border/40">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <GraduationCap className="h-4 w-4 text-theme" aria-hidden="true" />
                  Teaching snapshot
                </CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                  {[
                    { label: 'Courses', value: String(courseCount) },
                    { label: 'Students', value: String(studentCount) },
                    { label: 'To grade', value: String(toGrade) },
                    { label: 'Quiz attempts today', value: String(quizToday) },
                    { label: 'Semester', value: semester || '-', wrap: true },
                  ].map((m) => (
                    <div key={m.label} className="rounded-md border border-theme-border/40 bg-theme-light/40 p-3">
                      <dt className="text-xs text-muted-foreground">{m.label}</dt>
                      <dd className={cn('font-semibold text-theme', m.wrap ? 'text-sm leading-snug' : 'truncate text-lg')}>
                        {m.value}
                      </dd>
                    </div>
                  ))}
                </dl>
              </CardContent>
            </Card>

            <div className="grid gap-4 lg:grid-cols-2">
              {/* Recent student activity */}
              <Card className="border-theme-border/40">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Inbox className="h-4 w-4 text-theme" aria-hidden="true" />
                    Recent submissions
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {activity.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No assignment or quiz submissions yet.</p>
                  ) : (
                    activity.map((a) => (
                      <Link
                        key={a.id}
                        to={a.href}
                        className="flex items-start justify-between gap-3 rounded-md border p-3 transition-colors hover:bg-theme-light"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-medium">{a.studentName}</p>
                          <p className="text-xs text-muted-foreground">
                            {a.kind} · {a.title}{a.courseCode ? ` · ${a.courseCode}` : ''}
                          </p>
                        </div>
                        <span className="whitespace-nowrap text-xs text-muted-foreground">{timeAgo(a.at)}</span>
                      </Link>
                    ))
                  )}
                </CardContent>
              </Card>

              {/* Upcoming deadlines for the lecturer's assignments */}
              <Card className="border-theme-border/40">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <ClipboardList className="h-4 w-4 text-theme" aria-hidden="true" />
                    Upcoming assignment deadlines
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {upcoming.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No upcoming deadlines.</p>
                  ) : (
                    upcoming.map((a) => (
                      <Link
                        key={a.id}
                        to="/teacher/assignments"
                        className="flex items-center justify-between gap-3 rounded-md border p-3 transition-colors hover:bg-theme-light"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-medium">{a.title}</p>
                          <p className="text-xs text-muted-foreground">{a.courseCode}</p>
                        </div>
                        <DeadlineBadge dueDate={a.due_date} />
                      </Link>
                    ))
                  )}
                  <Button asChild variant="link" className="h-auto w-full p-0 text-theme">
                    <Link to="/teacher/assignments">Manage assignments</Link>
                  </Button>
                </CardContent>
              </Card>
            </div>

            {/* Announcements */}
            <Card className="border-theme-border/40">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Megaphone className="h-4 w-4 text-theme" aria-hidden="true" />
                  Recent announcements
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {announcements.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No announcements yet.</p>
                ) : (
                  announcements.map((a) => (
                    <Link
                      key={a.id}
                      to="/teacher/announcements"
                      className="block rounded-md border border-l-2 border-l-theme p-3 transition-colors hover:bg-theme-light"
                    >
                      <p className="text-sm font-medium">{a.title}</p>
                      <p className="line-clamp-2 text-xs text-muted-foreground">{a.content}</p>
                      <p className="mt-1 text-[11px] text-muted-foreground">{new Date(a.created_at).toLocaleDateString()}</p>
                    </Link>
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
