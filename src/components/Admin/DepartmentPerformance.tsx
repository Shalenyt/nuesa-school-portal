import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { Building2 } from 'lucide-react';

export function DepartmentPerformance() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const { data: subjects } = await supabase.from('subjects').select('id, name');
      if (!subjects?.length) { setLoading(false); return; }

      const chartData = [];
      for (const dept of subjects) {
        const { data: courses } = await supabase.from('courses').select('id').eq('subject_id', dept.id);
        if (!courses?.length) continue;

        const courseIds = courses.map(c => c.id);
        const { data: subs } = await supabase
          .from('assignment_submissions')
          .select('grade, assignments!inner(max_points, course_id)')
          .in('assignments.course_id', courseIds)
          .not('grade', 'is', null);

        if (!subs?.length) continue;

        const scores = subs.map((s: any) => ((s.grade || 0) / ((s as any).assignments?.max_points || 100)) * 100);
        const avg = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
        const passRate = Math.round((scores.filter(s => s >= 50).length / scores.length) * 100);

        chartData.push({
          name: dept.name.substring(0, 15),
          avgScore: avg,
          passRate,
        });
      }

      setData(chartData);
    } catch (err) {
      console.error('Error fetching department performance:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading || data.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building2 className="h-5 w-5" />
          Department Performance
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={data}>
            <XAxis dataKey="name" fontSize={11} />
            <YAxis domain={[0, 100]} fontSize={11} />
            <Tooltip />
            <Bar dataKey="avgScore" fill="hsl(var(--primary))" name="Avg Score %" radius={[4, 4, 0, 0]} />
            <Bar dataKey="passRate" fill="hsl(var(--primary) / 0.5)" name="Pass Rate %" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
