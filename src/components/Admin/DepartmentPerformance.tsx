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
      // One query for every graded submission, grouped by department here.
      // This used to make two requests per department.
      const { data: subs } = await (supabase as any)
        .from('assignment_submissions')
        .select('grade, assignments!inner(max_points, courses!inner(subject_id, subjects(name)))')
        .not('grade', 'is', null);

      const byDept = new Map<string, { name: string; scores: number[] }>();
      for (const s of subs || []) {
        const course = s.assignments?.courses;
        if (!course?.subject_id) continue;
        const pct = ((s.grade || 0) / (s.assignments?.max_points || 100)) * 100;
        const entry = byDept.get(course.subject_id) || { name: course.subjects?.name || 'Department', scores: [] };
        entry.scores.push(pct);
        byDept.set(course.subject_id, entry);
      }

      setData([...byDept.values()].map(({ name, scores }) => ({
        name: name.replace(/ ENGINEERING$/i, '').substring(0, 15),
        avgScore: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
        passRate: Math.round((scores.filter((x) => x >= 50).length / scores.length) * 100),
      })));
    } catch (err) {
      console.error('Error fetching department performance:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building2 className="h-5 w-5" />
          Department Performance
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Loading...</p>
        ) : data.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">No graded assignments yet. Department averages will show here once lecturers grade work.</p>
        ) : (
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={data}>
            <XAxis dataKey="name" fontSize={11} />
            <YAxis domain={[0, 100]} fontSize={11} />
            <Tooltip />
            <Bar dataKey="avgScore" fill="hsl(var(--primary))" name="Avg Score %" radius={[4, 4, 0, 0]} />
            <Bar dataKey="passRate" fill="hsl(var(--primary) / 0.5)" name="Pass Rate %" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
