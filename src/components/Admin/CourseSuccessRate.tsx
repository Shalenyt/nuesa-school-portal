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
      const { data: allCourses } = await supabase.from('courses').select('id, name, subjects(name)');
      if (!allCourses?.length) { setLoading(false); return; }

      const rates: CourseRate[] = [];
      for (const c of allCourses) {
        const { data: subs } = await supabase
          .from('assignment_submissions')
          .select('grade, assignments!inner(max_points, course_id)')
          .eq('assignments.course_id', c.id)
          .not('grade', 'is', null);

        if (!subs?.length) continue;

        const passed = subs.filter((s: any) => ((s.grade || 0) / ((s as any).assignments?.max_points || 100)) * 100 >= 50).length;
        rates.push({
          name: c.name || (c as any).subjects?.name || 'Course',
          passRate: Math.round((passed / subs.length) * 100),
          total: subs.length,
        });
      }

      rates.sort((a, b) => a.passRate - b.passRate);
      setCourses(rates);
    } catch (err) {
      console.error('Error fetching course success rates:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading || courses.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BookOpen className="h-5 w-5" />
          Course Success Rates
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 max-h-72 overflow-y-auto">
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
