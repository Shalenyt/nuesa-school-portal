import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/Layout/DashboardLayout';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';
import { notifyEnrolledStudents } from '@/lib/notifications';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar, Users, CheckCircle, XCircle } from 'lucide-react';

export default function TeacherAttendance() {
  const { profile } = useAuth();
  const [courses, setCourses] = useState<any[]>([]);
  const [selectedCourse, setSelectedCourse] = useState('');
  const [sessions, setSessions] = useState<any[]>([]);
  const [selectedSession, setSelectedSession] = useState<any>(null);
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (profile) fetchCourses();
  }, [profile]);

  useEffect(() => {
    if (selectedCourse) fetchSessions();
  }, [selectedCourse]);

  const fetchCourses = async () => {
    const { data } = await supabase
      .from('courses')
      .select('id, name, subjects(name, code), classes(name)')
      .eq('teacher_id', profile?.id);
    setCourses(data || []);
    setLoading(false);
  };

  const fetchSessions = async () => {
    const { data } = await (supabase as any)
      .from('attendance_sessions')
      .select('*')
      .eq('course_id', selectedCourse)
      .order('session_date', { ascending: false });
    setSessions(data || []);
  };

  const openSession = async () => {
    if (!selectedCourse) return;
    const { error } = await (supabase as any)
      .from('attendance_sessions')
      .insert({
        course_id: selectedCourse,
        teacher_id: profile?.id,
        status: 'open'
      });
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Success', description: 'Attendance session opened.' });
      const course = courses.find(c => c.id === selectedCourse);
      const courseName = course?.name || course?.subjects?.name || 'Course';
      await notifyEnrolledStudents(selectedCourse, 'Attendance Open', `Attendance is now open for ${courseName}. Mark your attendance now!`, 'attendance');
      fetchSessions();
    }
  };

  const closeSession = async (sessionId: string) => {
    const { error } = await (supabase as any)
      .from('attendance_sessions')
      .update({ status: 'closed' })
      .eq('id', sessionId);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Success', description: 'Attendance session closed.' });
      const session = sessions.find(s => s.id === sessionId);
      if (session) {
        await notifyEnrolledStudents(session.course_id, 'Attendance Closed', 'Attendance session has been closed.', 'attendance');
      }
      fetchSessions();
    }
  };

  const viewRecords = async (session: any) => {
    setSelectedSession(session);
    const { data } = await (supabase as any)
      .from('attendance_records')
      .select('*, profiles!attendance_records_student_id_fkey(full_name, student_id)')
      .eq('session_id', session.id)
      .order('checked_in_at', { ascending: true });
    setRecords(data || []);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Attendance Management</h1>
          <p className="text-muted-foreground">Open, close, and track attendance for your courses</p>
        </div>

        <div className="flex items-center gap-4">
          <Select value={selectedCourse} onValueChange={setSelectedCourse}>
            <SelectTrigger className="w-[300px]">
              <SelectValue placeholder="Select a course" />
            </SelectTrigger>
            <SelectContent>
              {courses.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name || c.subjects?.name} ({c.classes?.name})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedCourse && (
            <Button onClick={openSession}>
              <Calendar className="h-4 w-4 mr-2" />
              Open New Session
            </Button>
          )}
        </div>

        {selectedSession ? (
          <div className="space-y-4">
            <Button variant="outline" onClick={() => setSelectedSession(null)}>
              ← Back to Sessions
            </Button>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Attendance for {new Date(selectedSession.session_date).toLocaleDateString()}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {records.length === 0 ? (
                  <p className="text-muted-foreground text-center py-4">No students checked in yet.</p>
                ) : (
                  <div className="space-y-2">
                    {records.map((r) => (
                      <div key={r.id} className="flex items-center justify-between p-3 rounded-lg border">
                        <div>
                          <p className="font-medium">{r.profiles?.full_name}</p>
                          <p className="text-sm text-muted-foreground">ID: {r.profiles?.student_id}</p>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {new Date(r.checked_in_at).toLocaleTimeString()}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {sessions.map((s) => (
              <Card key={s.id}>
                <CardHeader>
                  <CardTitle className="text-base flex items-center justify-between">
                    {new Date(s.session_date).toLocaleDateString()}
                    <Badge variant={s.status === 'open' ? 'default' : 'secondary'}>
                      {s.status === 'open' ? 'Open' : 'Closed'}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => viewRecords(s)}>
                    <Users className="h-4 w-4 mr-1" /> View Records
                  </Button>
                  {s.status === 'open' && (
                    <Button variant="destructive" size="sm" onClick={() => closeSession(s.id)}>
                      <XCircle className="h-4 w-4 mr-1" /> Close
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))}
            {sessions.length === 0 && selectedCourse && (
              <Card>
                <CardContent className="text-center py-8">
                  <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">No attendance sessions yet.</p>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
