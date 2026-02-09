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
import { Calendar, CheckCircle, Clock, MapPin, AlertTriangle } from 'lucide-react';

function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000; // Earth's radius in meters
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export default function StudentAttendance() {
  const { profile } = useAuth();
  const [activeSessions, setActiveSessions] = useState<any[]>([]);
  const [stats, setStats] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkingIn, setCheckingIn] = useState<string | null>(null);

  useEffect(() => {
    if (profile) {
      fetchActiveSessions();
      fetchAttendanceStats();
    }
  }, [profile]);

  const fetchActiveSessions = async () => {
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

  const checkIn = async (session: any) => {
    setCheckingIn(session.id);
    try {
      // Check if session has GPS requirement
      if (session.latitude && session.longitude) {
        const position = await getCurrentPosition();
        const studentLat = position.coords.latitude;
        const studentLon = position.coords.longitude;
        const distance = haversineDistance(session.latitude, session.longitude, studentLat, studentLon);
        const allowedRadius = session.allowed_radius_meters || 100;

        if (distance > allowedRadius) {
          toast({ 
            title: 'Too far from class', 
            description: `You are ${Math.round(distance)}m away. You must be within ${allowedRadius}m of the lecturer to mark attendance.`, 
            variant: 'destructive' 
          });
          setCheckingIn(null);
          return;
        }

        // Insert with GPS data
        const { error } = await (supabase as any)
          .from('attendance_records')
          .insert({ 
            session_id: session.id, 
            student_id: profile?.id,
            latitude: studentLat,
            longitude: studentLon,
            distance_meters: Math.round(distance)
          });
        
        if (error) {
          toast({ title: 'Error', description: error.message, variant: 'destructive' });
        } else {
          toast({ title: 'Success', description: `Attendance marked! You were ${Math.round(distance)}m from the lecturer.` });
          fetchActiveSessions();
          fetchAttendanceStats();
        }
      } else {
        // No GPS requirement - simple check-in
        const { error } = await (supabase as any)
          .from('attendance_records')
          .insert({ session_id: session.id, student_id: profile?.id });
        
        if (error) {
          toast({ title: 'Error', description: error.message, variant: 'destructive' });
        } else {
          toast({ title: 'Success', description: 'Attendance marked successfully!' });
          fetchActiveSessions();
          fetchAttendanceStats();
        }
      }
    } catch (err: any) {
      toast({ title: 'GPS Error', description: err.message || 'Could not get your location. Please enable GPS and try again.', variant: 'destructive' });
    } finally {
      setCheckingIn(null);
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
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span>{new Date(s.session_date).toLocaleDateString()}</span>
                      {s.latitude && (
                        <Badge variant="outline" className="text-xs"><MapPin className="h-3 w-3 mr-1" />GPS Required</Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    {s.checked_in ? (
                      <Badge variant="default" className="w-full justify-center py-2">
                        <CheckCircle className="h-4 w-4 mr-2" /> Checked In
                      </Badge>
                    ) : (
                      <Button className="w-full" onClick={() => checkIn(s)} disabled={checkingIn === s.id}>
                        {checkingIn === s.id ? (
                          <><MapPin className="h-4 w-4 mr-2 animate-pulse" /> Getting Location...</>
                        ) : (
                          <><Clock className="h-4 w-4 mr-2" /> Mark Attendance</>
                        )}
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
