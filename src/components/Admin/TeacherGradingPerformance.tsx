import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Users } from 'lucide-react';

interface TeacherPerf {
  name: string;
  avgClassScore: number;
  totalGraded: number;
  avgTurnaround: string;
}

export function TeacherGradingPerformance({ refreshKey = 0 }: { refreshKey?: number }) {
  const [teachers, setTeachers] = useState<TeacherPerf[]>([]);
  const [loading, setLoading] = useState(true);

  // Refetches when the analytics page refreshes (every minute and on Refresh)
  useEffect(() => {
    fetchData();
  }, [refreshKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchData = async () => {
    try {
      const [{ data: teacherProfiles }, { data: subs }] = await Promise.all([
        supabase.from('profiles').select('id, full_name').eq('role', 'teacher').eq('status', 'approved'),
        (supabase as any)
          .from('assignment_submissions')
          .select('grade, graded_at, submitted_at, assignments!inner(max_points, courses!inner(teacher_id))')
          .not('grade', 'is', null),
      ]);

      const nameById = new Map((teacherProfiles || []).map((t: any) => [t.id, t.full_name]));
      const byTeacher = new Map<string, any[]>();
      for (const s of subs || []) {
        const tid = s.assignments?.courses?.teacher_id;
        if (!tid || !nameById.has(tid)) continue;
        byTeacher.set(tid, [...(byTeacher.get(tid) || []), s]);
      }

      const perfs: TeacherPerf[] = [...byTeacher.entries()].map(([tid, list]) => {
        const scores = list.map((s: any) => ((s.grade || 0) / (s.assignments?.max_points || 100)) * 100);
        const turnarounds = list
          .filter((s: any) => s.graded_at && s.submitted_at)
          .map((s: any) => (new Date(s.graded_at).getTime() - new Date(s.submitted_at).getTime()) / 86400000);
        const avgDays = turnarounds.length ? Math.round(turnarounds.reduce((a, b) => a + b, 0) / turnarounds.length) : 0;
        return {
          name: nameById.get(tid) as string,
          avgClassScore: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
          totalGraded: list.length,
          avgTurnaround: `${avgDays}d`,
        };
      });

      perfs.sort((a, b) => b.avgClassScore - a.avgClassScore);
      setTeachers(perfs);
    } catch (err) {
      console.error('Error fetching lecturer grading performance:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Lecturer Grading Performance
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3 max-h-72 overflow-y-auto">
          {loading && <p className="py-8 text-center text-sm text-muted-foreground">Loading...</p>}
          {!loading && teachers.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">No graded assignments yet. Each lecturer's average score and grading speed will show here.</p>
          )}
          {teachers.map((t, i) => (
            <div key={i} className="flex items-center justify-between p-2 border rounded-lg text-sm">
              <div>
                <p className="font-medium">{t.name}</p>
                <p className="text-xs text-muted-foreground">{t.totalGraded} graded • Avg turnaround: {t.avgTurnaround}</p>
              </div>
              <Badge variant={t.avgClassScore >= 60 ? 'default' : 'destructive'}>
                {t.avgClassScore}% avg
              </Badge>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
