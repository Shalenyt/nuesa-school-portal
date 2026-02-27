import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar, Clock, MapPin, Plus, Trash2 } from 'lucide-react';
import { DashboardLayout } from '@/components/Layout/DashboardLayout';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { notifyEnrolledStudents } from '@/lib/notifications';

const DAYS_OF_WEEK = [
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
  { value: 0, label: 'Sunday' }
];

export default function TeacherClassSchedule() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [schedules, setSchedules] = useState<any[]>([]);
  const [courses, setCourses] = useState<any[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [newSchedule, setNewSchedule] = useState({
    course_id: '',
    day_of_week: '',
    start_time: '',
    end_time: '',
    room: ''
  });

  useEffect(() => {
    fetchCourses();
    fetchSchedules();
  }, [profile]);

  const fetchCourses = async () => {
    try {
      const { data, error } = await supabase
        .from('courses')
        .select(`
          *,
          classes(name),
          subjects(name)
        `)
        .eq('teacher_id', profile?.id);

      if (error) throw error;
      setCourses(data || []);
    } catch (error) {
      console.error('Error fetching courses:', error);
    }
  };

  const fetchSchedules = async () => {
    try {
      const { data, error } = await supabase
        .from('timetable')
        .select(`
          *,
          courses!inner(
            name,
            classes(name),
            subjects(name),
            teacher_id
          )
        `)
        .eq('courses.teacher_id', profile?.id)
        .order('day_of_week')
        .order('start_time');

      if (error) throw error;
      setSchedules(data || []);
    } catch (error) {
      console.error('Error fetching schedules:', error);
    }
  };

  const checkConflict = async (courseId: string, dayOfWeek: number, startTime: string, endTime: string) => {
    try {
      const { data: course } = await supabase
        .from('courses')
        .select('class_id, subject_id')
        .eq('id', courseId)
        .single();

      if (!course) return false;

      const { data: existingSchedules } = await supabase
        .from('timetable')
        .select(`
          *,
          courses(class_id, subject_id)
        `)
        .eq('day_of_week', dayOfWeek)
        .eq('courses.class_id', course.class_id)
        .eq('courses.subject_id', course.subject_id);

      if (!existingSchedules) return false;

      return existingSchedules.some((schedule) => {
        const existingStart = schedule.start_time;
        const existingEnd = schedule.end_time;
        
        return (
          (startTime >= existingStart && startTime < existingEnd) ||
          (endTime > existingStart && endTime <= existingEnd) ||
          (startTime <= existingStart && endTime >= existingEnd)
        );
      });
    } catch (error) {
      console.error('Error checking conflict:', error);
      return false;
    }
  };

  const createSchedule = async () => {
    if (!newSchedule.course_id || !newSchedule.day_of_week || !newSchedule.start_time || !newSchedule.end_time) {
      toast({
        title: "Error",
        description: "Please fill in all required fields.",
        variant: "destructive"
      });
      return;
    }

    if (newSchedule.start_time >= newSchedule.end_time) {
      toast({
        title: "Error",
        description: "End time must be after start time.",
        variant: "destructive"
      });
      return;
    }

    const hasConflict = await checkConflict(
      newSchedule.course_id,
      parseInt(newSchedule.day_of_week),
      newSchedule.start_time,
      newSchedule.end_time
    );

    if (hasConflict) {
      toast({
        title: "Schedule Conflict",
        description: "This time slot is already taken for the same department and level.",
        variant: "destructive"
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('timetable')
        .insert([{
          course_id: newSchedule.course_id,
          day_of_week: parseInt(newSchedule.day_of_week),
          start_time: newSchedule.start_time,
          end_time: newSchedule.end_time,
          room: newSchedule.room.trim()
        }]);

      if (error) throw error;

      // Notify enrolled students
      const course = courses.find(c => c.id === newSchedule.course_id);
      const dayLabel = DAYS_OF_WEEK.find(d => d.value === parseInt(newSchedule.day_of_week))?.label || '';
      await notifyEnrolledStudents(
        newSchedule.course_id,
        'New Class Schedule',
        `${course?.name || 'A course'} has been scheduled for ${dayLabel} ${newSchedule.start_time} - ${newSchedule.end_time}${newSchedule.room.trim() ? ` in ${newSchedule.room.trim()}` : ''}.`,
        'schedule'
      );

      toast({
        title: "Schedule created",
        description: "Class schedule has been added successfully.",
      });

      setNewSchedule({ course_id: '', day_of_week: '', start_time: '', end_time: '', room: '' });
      setIsCreating(false);
      fetchSchedules();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const deleteSchedule = async (id: string) => {
    console.log('Attempting to delete schedule with ID:', id);
    
    try {
      // First check if the schedule exists and belongs to this teacher
      const { data: scheduleCheck, error: checkError } = await supabase
        .from('timetable')
        .select(`
          *,
          courses!inner(teacher_id)
        `)
        .eq('id', id)
        .eq('courses.teacher_id', profile?.id)
        .single();

      console.log('Schedule check result:', scheduleCheck, checkError);

      if (checkError) {
        console.error('Error checking schedule:', checkError);
        throw new Error('Schedule not found or you do not have permission to delete it');
      }

      const { data, error } = await supabase
        .from('timetable')
        .delete()
        .eq('id', id)
        .select();

      console.log('Delete result:', data, error);

      if (error) throw error;

      toast({
        title: "Schedule deleted",
        description: "Class schedule has been removed successfully.",
      });

      fetchSchedules();
    } catch (error: any) {
      console.error('Delete schedule error:', error);
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const getDayLabel = (dayOfWeek: number) => {
    return DAYS_OF_WEEK.find(d => d.value === dayOfWeek)?.label || 'Unknown';
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Class Schedule</h1>
            <p className="text-muted-foreground">
              Schedule classes for your courses
            </p>
          </div>
          <Button onClick={() => setIsCreating(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Schedule Class
          </Button>
        </div>

        {isCreating && (
          <Card>
            <CardHeader>
              <CardTitle>Schedule New Class</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Select
                value={newSchedule.course_id}
                onValueChange={(value) => setNewSchedule(prev => ({ ...prev, course_id: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select course" />
                </SelectTrigger>
                <SelectContent>
                  {courses.map((course) => (
                    <SelectItem key={course.id} value={course.id}>
                      {course.name} ({course.classes?.name} - {course.subjects?.name})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="grid gap-4 md:grid-cols-2">
                <Select
                  value={newSchedule.day_of_week}
                  onValueChange={(value) => setNewSchedule(prev => ({ ...prev, day_of_week: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select day" />
                  </SelectTrigger>
                  <SelectContent>
                    {DAYS_OF_WEEK.map((day) => (
                      <SelectItem key={day.value} value={day.value.toString()}>
                        {day.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  placeholder="Room (optional)"
                  value={newSchedule.room}
                  onChange={(e) => setNewSchedule(prev => ({ ...prev, room: e.target.value }))}
                />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <Input
                  type="time"
                  value={newSchedule.start_time}
                  onChange={(e) => setNewSchedule(prev => ({ ...prev, start_time: e.target.value }))}
                />
                <Input
                  type="time"
                  value={newSchedule.end_time}
                  onChange={(e) => setNewSchedule(prev => ({ ...prev, end_time: e.target.value }))}
                />
              </div>
              <div className="flex gap-2">
                <Button onClick={createSchedule}>Schedule Class</Button>
                <Button variant="outline" onClick={() => setIsCreating(false)}>Cancel</Button>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="space-y-4">
          {schedules.map((schedule) => (
            <Card key={schedule.id}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Calendar className="h-5 w-5" />
                      {schedule.courses?.name}
                    </CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">
                      {schedule.courses?.classes?.name} - {schedule.courses?.subjects?.name}
                    </p>
                  </div>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => deleteSchedule(schedule.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Calendar className="h-4 w-4" />
                    {getDayLabel(schedule.day_of_week)}
                  </div>
                  <div className="flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    {schedule.start_time} - {schedule.end_time}
                  </div>
                  {schedule.room && (
                    <div className="flex items-center gap-1">
                      <MapPin className="h-4 w-4" />
                      {schedule.room}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
}