import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/Layout/DashboardLayout';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar } from 'lucide-react';

export default function TeacherExamTimetable() {
  const { profile } = useAuth();
  const [entries, setEntries] = useState<any[]>([]);
  const [myCourses, setMyCourses] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (profile) fetchData();
  }, [profile]);

  const fetchData = async () => {
    const [{ data: timetable }, { data: courses }] = await Promise.all([
      (supabase as any).from('exam_timetables').select('*').order('exam_date').order('time_slot'),
      supabase.from('courses').select('id, name, subjects(code)').eq('teacher_id', profile?.id),
    ]);
    setEntries(timetable || []);
    const codes = (courses || []).map((c: any) => c.subjects?.code?.toUpperCase()).filter(Boolean);
    setMyCourses(codes);
    setLoading(false);
  };

  const isMyExam = (code: string) => myCourses.some(c => code.toUpperCase().includes(c));
  const isToday = (date: string) => new Date(date).toDateString() === new Date().toDateString();

  const grouped = entries.reduce((acc: any, e: any) => {
    const key = `${e.day_label} – ${new Date(e.exam_date).toLocaleDateString('en-GB', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })}`;
    if (!acc[key]) acc[key] = { date: e.exam_date, morning: [], afternoon: [], evening: [] };
    acc[key][e.time_slot]?.push(e);
    return acc;
  }, {});

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Exam Timetable</h1>
          <p className="text-muted-foreground">View examination schedule. Your courses are highlighted.</p>
        </div>

        {loading ? <p className="text-center text-muted-foreground">Loading...</p> : Object.keys(grouped).length === 0 ? (
          <Card><CardContent className="text-center py-8"><Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-2" /><p className="text-muted-foreground">No exam timetable available.</p></CardContent></Card>
        ) : (
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
                {Object.entries(grouped).map(([dayKey, slots]: [string, any]) => (
                  <tr key={dayKey} className={`border-b ${isToday(slots.date) ? 'bg-primary/10 font-semibold' : 'hover:bg-muted/50'}`}>
                    <td className="border p-2 font-medium">
                      {dayKey}
                      {isToday(slots.date) && <Badge variant="destructive" className="ml-2 text-[10px]">TODAY</Badge>}
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
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
