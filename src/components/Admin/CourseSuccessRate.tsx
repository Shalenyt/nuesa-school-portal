import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { BookOpen } from 'lucide-react';

interface CourseRate {
  name: string;
  passRate: number;
  total: number;
}

export function CourseSuccessRate() {
  const [courses, setCourses] = useState<CourseRate[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      // One query instead of one request per course (484 requests in a row).
      const { data: subs } = await (supabase as any)
        .from('assignment_submissions')
        .select('grade, assignments!inner(max_points, course_id, courses(name))')
        .not('grade', 'is', null);

      const byCourse = new Map<string, { name: string; passed: number; total: number }>();
      for (const s of subs || []) {
        const a = s.assignments;
        if (!a?.course_id) continue;
        const entry = byCourse.get(a.course_id) || { name: a.courses?.name || 'Course', passed: 0, total: 0 };
        entry.total += 1;
        if (((s.grade || 0) / (a.max_points || 100)) * 100 >= 50) entry.passed += 1;
        byCourse.set(a.course_id, entry);
      }

      const rates: CourseRate[] = [...byCourse.values()].map((c) => ({
        name: c.name,
        passRate: Math.round((c.passed / c.total) * 100),
        total: c.total,
      }));
      rates.sort((a, b) => a.passRate - b.passRate);
      setCourses(rates);
    } catch (err) {
      console.error('Error fetching course success rates:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BookOpen className="h-5 w-5" />
          Course Success Rates
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 max-h-72 overflow-y-auto">
        {loading && <p className="py-8 text-center text-sm text-muted-foreground">Loading...</p>}
        {!loading && courses.length === 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">No graded assignments yet. Pass rates per course will show here.</p>
        )}
        {courses.map((c, i) => (
          <div key={i} className="space-y-1">
            <div className="flex justify-between text-sm">
              <span className="truncate flex-1">{c.name}</span>
              <div className="flex items-center gap-2">
                <span className="font-medium">{c.passRate}%</span>
                {c.passRate < 50 && <Badge variant="destructive" className="text-[10px] px-1">At Risk</Badge>}
              </div>
            </div>
            <Progress value={c.passRate} className={`h-2 ${c.passRate < 50 ? '[&>div]:bg-destructive' : ''}`} />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
