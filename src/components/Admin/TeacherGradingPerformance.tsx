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

export function TeacherGradingPerformance() {
  const [teachers, setTeachers] = useState<TeacherPerf[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const { data: teacherProfiles } = await supabase
        .from('profiles')
        .select('id, full_name')
        .eq('role', 'teacher')
        .eq('status', 'approved');

      if (!teacherProfiles?.length) { setLoading(false); return; }

      const perfs: TeacherPerf[] = [];
      for (const t of teacherProfiles) {
        const { data: subs } = await supabase
          .from('assignment_submissions')
          .select('grade, graded_at, submitted_at, assignments!inner(max_points, courses!inner(teacher_id))')
          .eq('assignments.courses.teacher_id', t.id)
          .not('grade', 'is', null);

        if (!subs?.length) continue;

        const scores = subs.map((s: any) => ((s.grade || 0) / ((s as any).assignments?.max_points || 100)) * 100);
        const avgScore = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);

        // Calculate turnaround time
        const turnarounds = subs
          .filter((s: any) => s.graded_at && s.submitted_at)
          .map((s: any) => (new Date(s.graded_at).getTime() - new Date(s.submitted_at).getTime()) / (1000 * 60 * 60 * 24));

        const avgDays = turnarounds.length > 0 ? Math.round(turnarounds.reduce((a, b) => a + b, 0) / turnarounds.length) : 0;

        perfs.push({
          name: t.full_name,
          avgClassScore: avgScore,
          totalGraded: subs.length,
          avgTurnaround: `${avgDays}d`,
        });
      }

      perfs.sort((a, b) => b.avgClassScore - a.avgClassScore);
      setTeachers(perfs);
    } catch (err) {
      console.error('Error fetching teacher grading performance:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading || teachers.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Teacher Grading Performance
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3 max-h-72 overflow-y-auto">
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
