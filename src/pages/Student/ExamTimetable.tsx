import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/Layout/DashboardLayout';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar, BookOpen } from 'lucide-react';

export default function StudentExamTimetable() {
  const [entries, setEntries] = useState<any[]>([]);
  const [myCourses, setMyCourses] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    const { data: user } = await supabase.auth.getUser();
    const userId = user.user?.id;

    const [{ data: timetable }, { data: enrollments }] = await Promise.all([
      (supabase as any).from('exam_timetables').select('*').order('exam_date').order('time_slot'),
      userId ? supabase.from('student_enrollments').select('course_id, courses(name, subjects(code))').eq('student_id', userId) : Promise.resolve({ data: [] }),
    ]);

    setEntries(timetable || []);
    const codes = (enrollments || []).map((e: any) => e.courses?.subjects?.code?.toUpperCase()).filter(Boolean);
    setMyCourses(codes);
    setLoading(false);
  };

  const isMyExam = (code: string) => myCourses.some(c => code.toUpperCase().includes(c));
  const today = new Date();
  const isToday = (date: string) => new Date(date).toDateString() === today.toDateString();
  const isTomorrow = (date: string) => {
    const d = new Date(date);
    const tom = new Date(today);
    tom.setDate(tom.getDate() + 1);
    return d.toDateString() === tom.toDateString();
  };
  const isThisWeek = (date: string) => {
    const d = new Date(date);
    const endOfWeek = new Date(today);
    endOfWeek.setDate(today.getDate() + (7 - today.getDay()));
    return d >= today && d <= endOfWeek;
  };

  const myExams = entries.filter(e => isMyExam(e.course_code)).sort((a, b) => new Date(a.exam_date).getTime() - new Date(b.exam_date).getTime());

  const grouped = entries.reduce((acc: any, e: any) => {
    const key = `${e.day_label} – ${new Date(e.exam_date).toLocaleDateString('en-GB', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })}`;
    if (!acc[key]) acc[key] = { date: e.exam_date, morning: [], afternoon: [], evening: [] };
    acc[key][e.time_slot]?.push(e);
    return acc;
  }, {});

  const renderTable = (data: Record<string, any>) => (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="bg-primary text-primary-foreground">
            <th className="border p-2 text-left min-w-[180px]">Day &amp; Date</th>
            <th className="border p-2 text-left min-w-[200px]">Morning (8:00–11:00)</th>
            <th className="border p-2 text-left min-w-[200px]">Afternoon (11:30–14:30)</th>
            <th className="border p-2 text-left min-w-[200px]">Evening (15:00–17:00)</th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(data).map(([dayKey, slots]: [string, any]) => {
            const dayIsToday = isToday(slots.date);
            const dayIsTomorrow = isTomorrow(slots.date);
            return (
              <tr key={dayKey} className={`border-b ${dayIsToday ? 'bg-primary/10' : dayIsTomorrow ? 'bg-yellow-50 dark:bg-yellow-950/20' : 'hover:bg-muted/50'}`}>
                <td className="border p-2 font-medium">
                  {dayKey}
                  {dayIsToday && <Badge variant="destructive" className="ml-2 text-[10px]">TODAY</Badge>}
                  {dayIsTomorrow && <Badge variant="secondary" className="ml-2 text-[10px]">TOMORROW</Badge>}
                </td>
                {['morning', 'afternoon', 'evening'].map(slot => (
                  <td key={slot} className="border p-2">
                    {slots[slot]?.length > 0 ? (
                      <div className="space-y-1">
                        {slots[slot].map((e: any) => (
                          <div key={e.id} className={`rounded px-1 ${isMyExam(e.course_code) ? 'bg-primary/20 border border-primary font-bold' : ''}`}>
                            <span>{e.course_code}</span>
                            {e.venue && <span className="text-muted-foreground text-xs ml-1">({e.venue})</span>}
                            {isMyExam(e.course_code) && <Badge className="ml-1 text-[9px]">Your Exam</Badge>}
                          </div>
                        ))}
                      </div>
                    ) : <span className="text-muted-foreground text-xs">—</span>}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Exam Timetable</h1>
          <p className="text-muted-foreground">View your examination schedule</p>
        </div>

        {loading ? <p className="text-center text-muted-foreground">Loading...</p> : entries.length === 0 ? (
          <Card><CardContent className="text-center py-8"><Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-2" /><p className="text-muted-foreground">No exam timetable available yet.</p></CardContent></Card>
        ) : (
          <Tabs defaultValue="all">
            <TabsList className="w-full sm:w-auto">
              <TabsTrigger value="all">Full Timetable</TabsTrigger>
              <TabsTrigger value="my">My Exams ({myExams.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="all" className="mt-4">
              {renderTable(grouped)}
            </TabsContent>

            <TabsContent value="my" className="mt-4">
              {myExams.length === 0 ? (
                <Card><CardContent className="text-center py-8"><BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-2" /><p className="text-muted-foreground">No exams matched to your enrolled courses.</p></CardContent></Card>
              ) : (
                <div className="space-y-6">
                  {/* Upcoming exams cards */}
                  <Card>
                    <CardHeader><CardTitle className="flex items-center gap-2"><BookOpen className="h-5 w-5" /> Your Upcoming Exams</CardTitle></CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {myExams.map(e => {
                          const examDate = new Date(e.exam_date);
                          const isPast = examDate < today && !isToday(e.exam_date);
                          return (
                            <div key={e.id} className={`flex items-center justify-between p-3 rounded-lg border ${isToday(e.exam_date) ? 'border-primary bg-primary/10' : isTomorrow(e.exam_date) ? 'border-yellow-400 bg-yellow-50 dark:bg-yellow-950/20' : isPast ? 'opacity-50' : ''}`}>
                              <div>
                                <p className="font-bold">{e.course_code}</p>
                                <p className="text-sm text-muted-foreground">{e.day_label} – {examDate.toLocaleDateString('en-GB', { weekday: 'long', day: '2-digit', month: 'short', year: 'numeric' })}</p>
                                <p className="text-xs text-muted-foreground">{e.start_time} – {e.end_time}{e.venue ? ` | ${e.venue}` : ''}</p>
                              </div>
                              <div className="shrink-0">
                                {isToday(e.exam_date) && <Badge variant="destructive">TODAY</Badge>}
                                {isTomorrow(e.exam_date) && <Badge variant="secondary">TOMORROW</Badge>}
                                {isThisWeek(e.exam_date) && !isToday(e.exam_date) && !isTomorrow(e.exam_date) && <Badge variant="outline">This Week</Badge>}
                                {isPast && <Badge variant="secondary">Done</Badge>}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}
            </TabsContent>
          </Tabs>
        )}
      </div>
    </DashboardLayout>
  );
}
