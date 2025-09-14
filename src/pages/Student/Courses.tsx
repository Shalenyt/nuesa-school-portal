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

      // Get user profile to check department and level
      const { data: profile } = await supabase
        .from('profiles')
        .select('department_id, level_id')
        .eq('id', userId)
        .maybeSingle();

      if (!profile?.department_id || !profile?.level_id) {
        console.log('Student profile missing department or level');
        setCourses([]);
        setLoading(false);
        return;
      }

      // Get courses from course lists based on student's department and level
      const { data: courseListData } = await supabase
        .from('course_lists')
        .select('course_ids')
        .eq('class_id', profile.level_id)
        .eq('subject_id', profile.department_id)
        .maybeSingle();

      if (!courseListData?.course_ids) {
        console.log('No course list found for student level/department');
        setCourses([]);
        setLoading(false);
        return;
      }

      // Auto-enroll student in these courses if not already enrolled
      await autoEnrollStudent(userId, courseListData.course_ids);

      // Get course details
      const { data: coursesData } = await supabase
        .from('courses')
        .select(`
          id,
          name,
          description,
          classes(name),
          subjects(name, code),
          profiles(full_name)
        `)
        .in('id', courseListData.course_ids);

      if (!coursesData) {
        setCourses([]);
        setLoading(false);
        return;
      }

      // Sort courses by name
      const sortedCourses = coursesData.sort((a, b) => 
        (a.name || '').localeCompare(b.name || '')
      );

      setCourses(sortedCourses);
    } catch (error) {
      console.error('Error fetching courses:', error);
    } finally {
      setLoading(false);
    }
  };

  const autoEnrollStudent = async (studentId: string, courseIds: string[]) => {
    try {
      // Check which courses student is not enrolled in
      const { data: existingEnrollments } = await supabase
        .from('student_enrollments')
        .select('course_id')
        .eq('student_id', studentId);

      const enrolledCourseIds = existingEnrollments?.map(e => e.course_id) || [];
      const newCourseIds = courseIds.filter(id => !enrolledCourseIds.includes(id));

      if (newCourseIds.length > 0) {
        const enrollments = newCourseIds.map(courseId => ({
          student_id: studentId,
          course_id: courseId
        }));

        const { error } = await supabase
          .from('student_enrollments')
          .insert(enrollments);

        if (error) {
          console.error('Error auto-enrolling student:', error);
        } else {
          console.log(`Auto-enrolled student in ${newCourseIds.length} new courses`);
        }
      }
    } catch (error) {
      console.error('Error in auto-enrollment:', error);
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
                <h3 className="mt-2 text-sm font-semibold text-foreground">No courses available</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Please update your department and level in your profile to see available courses.
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