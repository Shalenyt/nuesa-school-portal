import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/Layout/DashboardLayout';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';
import { notifyEnrolledStudents } from '@/lib/notifications';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Calendar, Users, CheckCircle, XCircle, MapPin, Trash2 } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';

export default function LecturerAttendance() {
  const { profile } = useAuth();
  const [courses, setCourses] = useState<any[]>([]);
  const [selectedCourse, setSelectedCourse] = useState('');
  const [sessions, setSessions] = useState<any[]>([]);
  const [selectedSession, setSelectedSession] = useState<any>(null);
  const [records, setRecords] = useState<any[]>([]);
  const [enrolledCount, setEnrolledCount] = useState(0);
  const [studentStats, setStudentStats] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [allowedRadius, setAllowedRadius] = useState('100');
  const [gpsLoading, setGpsLoading] = useState(false);
  const [useGps, setUseGps] = useState(true);

  useEffect(() => {
    if (profile) fetchCourses();
  }, [profile]);

  useEffect(() => {
    if (selectedCourse) {
      fetchSessions();
      fetchStudentStats();
    }
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

  const fetchStudentStats = async () => {
    if (!selectedCourse) return;
    // Get enrolled students
    const { data: enrollments } = await supabase
      .from('student_enrollments')
      .select('student_id, profiles!student_enrollments_student_id_fkey(full_name, student_id)')
      .eq('course_id', selectedCourse);

    if (!enrollments?.length) { setStudentStats([]); setEnrolledCount(0); return; }
    setEnrolledCount(enrollments.length);

    // Get all sessions for this course
    const { data: allSessions } = await (supabase as any)
      .from('attendance_sessions')
      .select('id')
      .eq('course_id', selectedCourse);

    const totalSessions = allSessions?.length || 0;
    if (totalSessions === 0) { setStudentStats([]); return; }

    const sessionIds = allSessions?.map((s: any) => s.id) || [];

    // Get attendance records for these sessions
    const { data: allRecords } = await (supabase as any)
      .from('attendance_records')
      .select('student_id')
      .in('session_id', sessionIds);

    // Count per student
    const countMap: Record<string, number> = {};
    (allRecords || []).forEach((r: any) => {
      countMap[r.student_id] = (countMap[r.student_id] || 0) + 1;
    });

    const stats = enrollments.map((e: any) => ({
      student_id: e.student_id,
      full_name: e.profiles?.full_name,
      matric_no: e.profiles?.student_id,
      attended: countMap[e.student_id] || 0,
      total: totalSessions,
      percentage: Math.round(((countMap[e.student_id] || 0) / totalSessions) * 100)
    }));

    setStudentStats(stats);
  };

  const getCurrentPosition = (): Promise<GeolocationPosition> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation is not supported by this browser.'));
        return;
      }
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      });
    });
  };

  const openSession = async () => {
    if (!selectedCourse) return;
    setGpsLoading(true);
    try {
      let latitude: number | null = null;
      let longitude: number | null = null;

      if (useGps) {
        const position = await getCurrentPosition();
        latitude = position.coords.latitude;
        longitude = position.coords.longitude;
      }

      const { error } = await (supabase as any)
        .from('attendance_sessions')
        .insert({
          course_id: selectedCourse,
          teacher_id: profile?.id,
          status: 'open',
          latitude,
          longitude,
          allowed_radius_meters: useGps ? (parseInt(allowedRadius) || 100) : null,
          attendance_type: useGps ? 'gps' : 'manual',
        });
      if (error) {
        toast({ title: 'Error', description: error.message, variant: 'destructive' });
      } else {
        toast({ title: 'Success', description: useGps ? 'Attendance session opened with GPS location.' : 'Manual attendance session opened.' });
        const course = courses.find(c => c.id === selectedCourse);
        const courseName = course?.name || course?.subjects?.name || 'Course';
        await notifyEnrolledStudents(selectedCourse, 'Attendance Open', `Attendance is now open for ${courseName}. Mark your attendance now!`, 'attendance');
        fetchSessions();
      }
    } catch (err: any) {
      toast({ title: useGps ? 'GPS Error' : 'Error', description: err.message || 'Could not open session.', variant: 'destructive' });
    } finally {
      setGpsLoading(false);
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

        <div className="flex flex-wrap items-end gap-4">
          <div className="space-y-1">
            <Label className="text-sm">Course</Label>
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
          </div>
          {selectedCourse && (
            <>
              <div className="flex items-center gap-2">
                <Switch checked={useGps} onCheckedChange={setUseGps} />
                <Label className="text-sm">{useGps ? 'GPS Attendance' : 'Manual Attendance'}</Label>
              </div>
              {useGps && (
                <div className="space-y-1">
                  <Label className="text-sm">Allowed Radius (meters)</Label>
                  <Input className="w-[140px]" type="number" value={allowedRadius} onChange={e => setAllowedRadius(e.target.value)} min="10" max="1000" />
                </div>
              )}
              <Button onClick={openSession} disabled={gpsLoading}>
                <MapPin className="h-4 w-4 mr-2" />
                {gpsLoading ? 'Opening...' : useGps ? 'Open Session (GPS)' : 'Open Session (Manual)'}
              </Button>
            </>
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
                  {selectedSession.latitude && (
                    <Badge variant="outline" className="ml-2"><MapPin className="h-3 w-3 mr-1" />GPS enabled</Badge>
                  )}
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
                        <div className="text-right text-sm text-muted-foreground">
                          <p>{new Date(r.checked_in_at).toLocaleTimeString()}</p>
                          {r.distance_meters !== null && r.distance_meters !== undefined && (
                            <p className="text-xs">{Math.round(r.distance_meters)}m away</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Sessions */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {sessions.map((s) => (
                <Card key={s.id}>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center justify-between">
                      {new Date(s.session_date).toLocaleDateString()}
                      <div className="flex items-center gap-1">
                        <Badge variant="outline" className="text-xs">
                          {s.attendance_type === 'manual' ? 'Manual' : 'GPS'}
                        </Badge>
                        <Badge variant={s.status === 'open' ? 'default' : 'secondary'}>
                          {s.status === 'open' ? 'Open' : 'Closed'}
                        </Badge>
                      </div>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="flex gap-2 flex-wrap">
                    <Button variant="outline" size="sm" onClick={() => viewRecords(s)}>
                      <Users className="h-4 w-4 mr-1" /> View Records
                    </Button>
                    {s.status === 'open' && (
                      <Button variant="destructive" size="sm" onClick={() => closeSession(s.id)}>
                        <XCircle className="h-4 w-4 mr-1" /> Close
                      </Button>
                    )}
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete this attendance session?</AlertDialogTitle>
                          <AlertDialogDescription>This will permanently remove the session and all student check-in records. This cannot be undone.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={async () => {
                            await (supabase as any).from('attendance_records').delete().eq('session_id', s.id);
                            await (supabase as any).from('attendance_sessions').delete().eq('id', s.id);
                            toast({ title: 'Deleted', description: 'Attendance session removed.' });
                            fetchSessions();
                            fetchStudentStats();
                          }}>Delete Permanently</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
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

            {/* Student attendance percentage */}
            {selectedCourse && studentStats.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Student Attendance Overview</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {studentStats.map((s) => (
                      <div key={s.student_id} className="flex items-center gap-4">
                        <div className="w-48 truncate">
                          <p className="font-medium text-sm">{s.full_name}</p>
                          <p className="text-xs text-muted-foreground">{s.matric_no}</p>
                        </div>
                        <div className="flex-1">
                          <Progress value={s.percentage} />
                        </div>
                        <span className="text-sm font-semibold w-16 text-right">{s.attended}/{s.total} ({s.percentage}%)</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
