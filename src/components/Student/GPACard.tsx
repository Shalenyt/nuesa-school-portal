import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { GraduationCap } from 'lucide-react';
import { calculateStudentGPA, type GPAResult } from '@/lib/gpa';

export function GPACard({ studentId }: { studentId?: string }) {
  const { profile } = useAuth();
  const [result, setResult] = useState<GPAResult | null>(null);
  const [loading, setLoading] = useState(true);

  const id = studentId || profile?.id;

  useEffect(() => {
    if (id) {
      calculateStudentGPA(id).then(r => { setResult(r); setLoading(false); }).catch(() => setLoading(false));
    }
  }, [id]);

  const getGpaColor = (gpa: number) => {
    if (gpa >= 4.5) return 'text-green-600';
    if (gpa >= 3.5) return 'text-blue-600';
    if (gpa >= 2.5) return 'text-yellow-600';
    return 'text-red-600';
  };

  if (loading || !result || result.courseGrades.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <GraduationCap className="h-5 w-5" />
          GPA Summary
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Current CGPA</p>
            <p className={`text-3xl font-bold ${getGpaColor(result.gpa)}`}>{result.gpa.toFixed(2)}</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-muted-foreground">Courses</p>
            <p className="text-xl font-semibold">{result.courseGrades.length}</p>
          </div>
        </div>
        <div className="space-y-2 max-h-40 overflow-y-auto">
          {result.courseGrades.map((g, i) => (
            <div key={i} className="flex items-center justify-between text-sm py-1 border-b last:border-0">
              <span className="truncate flex-1">{g.courseName}</span>
              <div className="flex items-center gap-2 ml-2">
                <Badge variant="outline" className="text-xs">{g.creditUnit} CU</Badge>
                <Badge variant={g.gradePoint >= 3 ? 'default' : 'destructive'} className="min-w-[28px] justify-center">
                  {g.letterGrade}
                </Badge>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
