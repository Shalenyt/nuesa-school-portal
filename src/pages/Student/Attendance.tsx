import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/Layout/DashboardLayout';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar, CheckCircle, Clock } from 'lucide-react';

export default function StudentAttendance() {
  const { profile } = useAuth();
  const [activeSessions, setActiveSessions] = useState<any[]>([]);
  const [stats, setStats] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (profile) {
      fetchActiveSessions();
      fetchAttendanceStats();
    }
  }, [profile]);

  const fetchActiveSessions = async () => {
    // Get open sessions for enrolled courses
    const { data: enrollments } = await supabase
      .from('student_enrollments')
      .select('course_id')
      .eq('student_id', profile?.id);

    if (!enrollments?.length) { setLoading(false); return; }

    const courseIds = enrollments.map(e => e.course_id);
    const { data } = await (supabase as any)
      .from('attendance_sessions')
      .select('*, courses(name, subjects(name, code))')
      .in('course_id', courseIds)
      .eq('status', 'open')
      .order('created_at', { ascending: false });

    // Check which sessions student already checked into
    const sessions = data || [];
    for (const s of sessions) {
      const { data: record } = await (supabase as any)
        .from('attendance_records')
        .select('id')
        .eq('session_id', s.id)
        .eq('student_id', profile?.id)
        .maybeSingle();
      s.checked_in = !!record;
    }

    setActiveSessions(sessions);
    setLoading(false);
  };

  const fetchAttendanceStats = async () => {
    const { data: enrollments } = await supabase
      .from('student_enrollments')
      .select('course_id, courses(name, subjects(name, code))')
      .eq('student_id', profile?.id);

    if (!enrollments?.length) return;

    const courseStats = [];
    for (const e of enrollments) {
      const { count: totalSessions } = await (supabase as any)
        .from('attendance_sessions')
        .select('id', { count: 'exact', head: true })
        .eq('course_id', e.course_id);

      const { count: attended } = await (supabase as any)
        .from('attendance_records')
        .select('id', { count: 'exact', head: true })
        .eq('student_id', profile?.id)
        .in('session_id', 
          (await (supabase as any)
            .from('attendance_sessions')
            .select('id')
            .eq('course_id', e.course_id)).data?.map((s: any) => s.id) || []
        );

      courseStats.push({
        course_id: e.course_id,
        course_name: (e as any).courses?.name || (e as any).courses?.subjects?.name,
        total: totalSessions || 0,
        attended: attended || 0,
        percentage: totalSessions ? Math.round((attended || 0) / totalSessions * 100) : 0
      });
    }
    setStats(courseStats);
  };

  const checkIn = async (sessionId: string) => {
    const { error } = await (supabase as any)
      .from('attendance_records')
      .insert({ session_id: sessionId, student_id: profile?.id });
    
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Success', description: 'Attendance marked successfully!' });
      fetchActiveSessions();
      fetchAttendanceStats();
    }
  };

  if (loading) return <DashboardLayout><div className="text-center">Loading...</div></DashboardLayout>;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Attendance</h1>
          <p className="text-muted-foreground">Mark your attendance and view your records</p>
        </div>

        <Tabs defaultValue="active" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="active">
              Active Sessions {activeSessions.filter(s => !s.checked_in).length > 0 && (
                <Badge variant="secondary" className="ml-2">{activeSessions.filter(s => !s.checked_in).length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="history">Attendance History</TabsTrigger>
          </TabsList>

          <TabsContent value="active">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {activeSessions.map((s) => (
                <Card key={s.id}>
                  <CardHeader>
                    <CardTitle className="text-base">
                      {s.courses?.name || s.courses?.subjects?.name}
                    </CardTitle>
                    <p className="text-sm text-muted-foreground">
                      {new Date(s.session_date).toLocaleDateString()}
                    </p>
                  </CardHeader>
                  <CardContent>
                    {s.checked_in ? (
                      <Badge variant="default" className="w-full justify-center py-2">
                        <CheckCircle className="h-4 w-4 mr-2" /> Checked In
                      </Badge>
                    ) : (
                      <Button className="w-full" onClick={() => checkIn(s.id)}>
                        <Clock className="h-4 w-4 mr-2" /> Mark Attendance
                      </Button>
                    )}
                  </CardContent>
                </Card>
              ))}
              {activeSessions.length === 0 && (
                <Card>
                  <CardContent className="text-center py-8">
                    <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">No active attendance sessions.</p>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          <TabsContent value="history">
            <div className="grid gap-4 md:grid-cols-2">
              {stats.map((s) => (
                <Card key={s.course_id}>
                  <CardHeader>
                    <CardTitle className="text-base">{s.course_name}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex justify-between text-sm">
                      <span>Attended: {s.attended} / {s.total} classes</span>
                      <span className="font-semibold">{s.percentage}%</span>
                    </div>
                    <Progress value={s.percentage} />
                  </CardContent>
                </Card>
              ))}
              {stats.length === 0 && (
                <Card>
                  <CardContent className="text-center py-8">
                    <p className="text-muted-foreground">No attendance data yet.</p>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
