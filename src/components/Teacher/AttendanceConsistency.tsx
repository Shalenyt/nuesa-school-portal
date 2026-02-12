import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Users } from 'lucide-react';

interface StudentAttendance {
  name: string;
  studentId: string;
  percentage: number;
  attended: number;
  total: number;
}

export function AttendanceConsistency() {
  const { profile } = useAuth();
  const [students, setStudents] = useState<StudentAttendance[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (profile) fetchData();
  }, [profile]);

  const fetchData = async () => {
    try {
      const { data: sessions } = await (supabase as any)
        .from('attendance_sessions')
        .select('id, course_id')
        .eq('teacher_id', profile!.id);

      if (!sessions?.length) { setLoading(false); return; }

      const sessionIds = sessions.map((s: any) => s.id);
      const courseIds = [...new Set(sessions.map((s: any) => s.course_id))];

      const { data: enrollments } = await supabase
        .from('student_enrollments')
        .select('student_id, profiles!student_enrollments_student_id_fkey(full_name, student_id)')
        .in('course_id', courseIds as string[]);

      if (!enrollments?.length) { setLoading(false); return; }

      const { data: records } = await (supabase as any)
        .from('attendance_records')
        .select('student_id, session_id')
        .in('session_id', sessionIds);

      const studentMap = new Map<string, StudentAttendance>();
      const totalSessions = sessionIds.length;

      for (const e of enrollments) {
        const sid = e.student_id;
        if (studentMap.has(sid)) continue;
        const attended = (records || []).filter((r: any) => r.student_id === sid).length;
        studentMap.set(sid, {
          name: (e as any).profiles?.full_name || 'Unknown',
          studentId: (e as any).profiles?.student_id || '',
          percentage: Math.round((attended / totalSessions) * 100),
          attended,
          total: totalSessions,
        });
      }

      const sorted = Array.from(studentMap.values()).sort((a, b) => a.percentage - b.percentage);
      setStudents(sorted.slice(0, 10));
    } catch (err) {
      console.error('Error fetching attendance consistency:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading || students.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Attendance Consistency
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 max-h-72 overflow-y-auto">
        {students.map((s, i) => (
          <div key={i} className="space-y-1">
            <div className="flex justify-between text-sm">
              <span className="truncate">{s.name} <span className="text-muted-foreground">({s.studentId})</span></span>
              <div className="flex items-center gap-2">
                <span className="font-medium">{s.percentage}%</span>
                {s.percentage < 75 && <Badge variant="destructive" className="text-[10px] px-1">Low</Badge>}
              </div>
            </div>
            <Progress value={s.percentage} className={`h-2 ${s.percentage < 75 ? '[&>div]:bg-destructive' : ''}`} />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
