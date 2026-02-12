import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Calendar } from 'lucide-react';

export function AttendanceChart() {
  const { profile } = useAuth();
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (profile) fetchData();
  }, [profile]);

  const fetchData = async () => {
    try {
      const { data: enrollments } = await supabase
        .from('student_enrollments')
        .select('course_id, courses(name, subjects(name))')
        .eq('student_id', profile!.id);

      if (!enrollments?.length) { setLoading(false); return; }

      const chartData = [];
      for (const e of enrollments) {
        const { count: total } = await (supabase as any)
          .from('attendance_sessions')
          .select('id', { count: 'exact', head: true })
          .eq('course_id', e.course_id);

        if (!total) continue;

        const sessions = await (supabase as any)
          .from('attendance_sessions')
          .select('id')
          .eq('course_id', e.course_id);

        const sessionIds = sessions.data?.map((s: any) => s.id) || [];

        const { count: attended } = await (supabase as any)
          .from('attendance_records')
          .select('id', { count: 'exact', head: true })
          .eq('student_id', profile!.id)
          .in('session_id', sessionIds);

        const pct = Math.round(((attended || 0) / total) * 100);
        chartData.push({
          name: (e as any).courses?.name?.substring(0, 12) || (e as any).courses?.subjects?.name?.substring(0, 12) || 'Course',
          percentage: pct,
          attended: attended || 0,
          total,
        });
      }

      setData(chartData);
    } catch (err) {
      console.error('Error fetching attendance chart data:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading || data.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Attendance Performance
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={data}>
            <XAxis dataKey="name" fontSize={11} />
            <YAxis domain={[0, 100]} fontSize={11} />
            <Tooltip formatter={(value: number) => [`${value}%`, 'Attendance']} />
            <Bar dataKey="percentage" radius={[4, 4, 0, 0]}>
              {data.map((entry, i) => (
                <Cell key={i} fill={entry.percentage >= 75 ? 'hsl(var(--primary))' : entry.percentage >= 50 ? 'hsl(45, 93%, 47%)' : 'hsl(0, 84%, 60%)'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
