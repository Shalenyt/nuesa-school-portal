import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BookOpen, Users, Calendar, GraduationCap } from 'lucide-react';
import { DashboardLayout } from '@/components/Layout/DashboardLayout';

export default function StudentCourses() {
  const [courses, setCourses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCourses();
  }, []);

  const fetchCourses = async () => {
    try {
      const { data: user } = await supabase.auth.getUser();
      const userId = user.user?.id;

      if (!userId) {
        setCourses([]);
        setLoading(false);
        return;
      }

      // Get student enrollments and related course data
      const { data: enrollments } = await supabase
        .from('student_enrollments')
        .select(`
          course_id,
          courses(
            id,
            name,
            description,
            classes(name),
            subjects(name, code),
            profiles(full_name)
          )
        `)
        .eq('student_id', userId);

      if (!enrollments) {
        setCourses([]);
        setLoading(false);
        return;
      }

      // Extract courses from enrollments
      const coursesData = enrollments
        .map(enrollment => enrollment.courses)
        .filter(course => course !== null)
        .sort((a, b) => {
          // Sort by name
          return (a.name || '').localeCompare(b.name || '');
        });

      setCourses(coursesData);
    } catch (error) {
      console.error('Error fetching courses:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">My Courses</h1>
          <p className="text-muted-foreground">
            Courses you are enrolled in
          </p>
        </div>

        {loading ? (
          <div className="text-center">Loading courses...</div>
        ) : courses.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <BookOpen className="mx-auto h-12 w-12 text-muted-foreground" />
                <h3 className="mt-2 text-sm font-semibold text-foreground">No courses enrolled</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  You are not enrolled in any courses yet. Contact your administrator for enrollment.
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {courses.map((course) => (
              <Card key={course.id} className="hover:shadow-md transition-shadow">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BookOpen className="h-5 w-5" />
                    {course.name}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {course.description && (
                    <p className="text-sm text-muted-foreground">
                      {course.description}
                    </p>
                  )}
                  
                  <div className="space-y-2">
                    {course.subjects && (
                      <div className="flex items-center gap-2 text-sm">
                        <GraduationCap className="h-4 w-4" />
                        <span>{course.subjects.name} ({course.subjects.code})</span>
                      </div>
                    )}
                    
                    {course.classes && (
                      <div className="flex items-center gap-2 text-sm">
                        <Users className="h-4 w-4" />
                        <span>{course.classes.name}</span>
                      </div>
                    )}
                    
                    <div className="flex items-center gap-2 text-sm">
                      <Users className="h-4 w-4" />
                      <span>Instructor: {course.profiles?.full_name || 'Pending'}</span>
                    </div>
                    
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}