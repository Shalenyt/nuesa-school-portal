import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Calendar, Clock, MapPin, BookOpen } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { DashboardLayout } from '@/components/Layout/DashboardLayout';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export default function StudentTimetable() {
  const [timetable, setTimetable] = useState<any[]>([]);
  const [enrolledCourseIds, setEnrolledCourseIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTimetable();
  }, []);

  const fetchTimetable = async () => {
    try {
      const { data: user } = await supabase.auth.getUser();
      const userId = user.user?.id;

      if (!userId) {
        setTimetable([]);
        setLoading(false);
        return;
      }

      // Fetch profile and enrollments in parallel
      const [profileRes, enrollRes] = await Promise.all([
        (supabase as any)
          .from('profiles')
          .select('department_id, level_id')
          .eq('id', userId)
          .maybeSingle(),
        supabase
          .from('student_enrollments')
          .select('course_id')
          .eq('student_id', userId),
      ]);

      const profile = profileRes.data;
      const enrolledIds = new Set<string>(
        (enrollRes.data || []).map((e: any) => e.course_id)
      );
      setEnrolledCourseIds(enrolledIds);

      if (!profile?.department_id || !profile?.level_id) {
        setTimetable([]);
        setLoading(false);
        return;
      }

      // Get courses from course lists based on student's department and level
      const { data: courseListData } = await (supabase as any)
        .from('course_lists')
        .select('course_ids')
        .eq('class_id', profile.level_id)
        .eq('subject_id', profile.department_id)
        .maybeSingle();

      if (!courseListData?.course_ids || courseListData.course_ids.length === 0) {
        setTimetable([]);
        setLoading(false);
        return;
      }

      // Get timetable for those courses
      const { data: timetableData } = await (supabase as any)
        .from('timetable')
        .select(`
          *,
          courses(
            id,
            name,
            subjects(name, code),
            profiles(full_name)
          )
        `)
        .in('course_id', courseListData.course_ids);

      const allTimetable = timetableData?.map((schedule: any) => ({
        ...schedule,
        courseName: schedule.courses?.name || schedule.courses?.subjects?.code || 'Course',
        courseCode: schedule.courses?.subjects?.code,
        subjectName: schedule.courses?.subjects?.name,
        teacherName: schedule.courses?.profiles?.full_name,
        isEnrolled: enrolledIds.has(schedule.course_id),
      })) || [];

      // Sort by day and time
      allTimetable.sort((a: any, b: any) => {
        if (a.day_of_week !== b.day_of_week) return a.day_of_week - b.day_of_week;
        return a.start_time.localeCompare(b.start_time);
      });

      setTimetable(allTimetable);
    } catch (error) {
      console.error('Error fetching timetable:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (time: string) => {
    return new Date(`1970-01-01T${time}`).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const groupByDay = (schedule: any[]) => {
    const grouped: { [key: number]: any[] } = {};
    schedule.forEach((item) => {
      if (!grouped[item.day_of_week]) grouped[item.day_of_week] = [];
      grouped[item.day_of_week].push(item);
    });
    return grouped;
  };

  const groupedTimetable = groupByDay(timetable);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">My Timetable</h1>
          <p className="text-muted-foreground">
            Your weekly class schedule — <span className="text-green-600 dark:text-green-400 font-semibold">green</span> courses are ones you're enrolled in
          </p>
        </div>

        {loading ? (
          <div className="text-center">Loading timetable...</div>
        ) : timetable.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <Calendar className="mx-auto h-12 w-12 text-muted-foreground" />
                <h3 className="mt-2 text-sm font-semibold text-foreground">No classes scheduled</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Please update your department and level in your profile, or no classes have been scheduled yet.
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {DAYS.map((day, index) => {
              const daySchedule = groupedTimetable[index + 1] || [];

              return (
                <Card key={day}>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Calendar className="h-5 w-5" />
                      {day}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {daySchedule.length === 0 ? (
                      <p className="text-muted-foreground">No classes scheduled</p>
                    ) : (
                      <div className="space-y-3">
                        {daySchedule.map((schedule: any) => (
                          <div
                            key={schedule.id}
                            className={`p-3 rounded-lg border-l-4 ${
                              schedule.isEnrolled
                                ? 'bg-green-50 dark:bg-green-950/30 border-l-green-500'
                                : 'bg-secondary border-l-transparent'
                            }`}
                          >
                            <div className="flex justify-between items-start">
                              <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                  <BookOpen className="h-4 w-4" />
                                  <span className={`font-medium ${schedule.isEnrolled ? 'text-green-700 dark:text-green-400' : ''}`}>
                                    {schedule.courseName}
                                  </span>
                                  {schedule.courseCode && (
                                    <Badge variant="outline" className={`text-xs ${schedule.isEnrolled ? 'border-green-500 text-green-700 dark:text-green-400' : ''}`}>
                                      {schedule.courseCode}
                                    </Badge>
                                  )}
                                  {schedule.isEnrolled && (
                                    <Badge className="bg-green-600 text-white text-[10px]">My Course</Badge>
                                  )}
                                </div>
                                {schedule.subjectName && schedule.subjectName !== schedule.courseName && (
                                  <p className="text-sm text-muted-foreground">{schedule.subjectName}</p>
                                )}
                                {schedule.teacherName && (
                                  <p className="text-sm text-muted-foreground">Instructor: {schedule.teacherName}</p>
                                )}
                                {schedule.room && (
                                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                                    <MapPin className="h-3 w-3" />
                                    {schedule.room}
                                  </div>
                                )}
                              </div>
                              <div className="text-right">
                                <div className="flex items-center gap-1 text-sm font-medium">
                                  <Clock className="h-3 w-3" />
                                  {formatTime(schedule.start_time)}
                                </div>
                                <div className="text-sm text-muted-foreground">
                                  to {formatTime(schedule.end_time)}
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
