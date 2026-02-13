import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BookOpen, Users, FileText, ClipboardList } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DashboardLayout } from '@/components/Layout/DashboardLayout';
import { useAuth } from '@/hooks/useAuth';

export default function TeacherCourses() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [courses, setCourses] = useState<any[]>([]);
  const [courseStats, setCourseStats] = useState<any>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCourses();
  }, [profile]);

  const fetchCourses = async () => {
    try {
      const { data: coursesData, error: coursesError } = await supabase
        .from('courses')
        .select(`
          *,
          classes(name),
          subjects(name)
        `)
        .eq('teacher_id', profile?.id);

      if (coursesError) throw coursesError;
      setCourses(coursesData || []);

      // Fetch stats for each course
      const stats: any = {};
      for (const course of coursesData || []) {
        // Get enrollment count
        const { count: enrollmentCount } = await supabase
          .from('student_enrollments')
          .select('*', { count: 'exact', head: true })
          .eq('course_id', course.id);

        // Get materials count
        const { count: materialsCount } = await supabase
          .from('materials')
          .select('*', { count: 'exact', head: true })
          .eq('course_id', course.id);

        // Get assignments count
        const { count: assignmentsCount } = await supabase
          .from('assignments')
          .select('*', { count: 'exact', head: true })
          .eq('course_id', course.id);

        stats[course.id] = {
          enrollments: enrollmentCount || 0,
          materials: materialsCount || 0,
          assignments: assignmentsCount || 0
        };
      }
      setCourseStats(stats);
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
            Overview of courses you're lecturing
          </p>
        </div>

        {courses.length > 0 ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {courses.map((course) => {
              const stats = courseStats[course.id] || { enrollments: 0, materials: 0, assignments: 0 };
              
              return (
                <Card key={course.id} className="hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <BookOpen className="h-5 w-5" />
                      {course.name}
                    </CardTitle>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="secondary">{course.classes?.name}</Badge>
                      <Badge variant="outline">{course.subjects?.name}</Badge>
                      {course.semester && (
                        <Badge variant="secondary">{course.semester} Sem</Badge>
                      )}
                      {course.credit_unit && (
                        <Badge variant="outline">{course.credit_unit} Credit{course.credit_unit > 1 ? 's' : ''}</Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {course.description && (
                      <p className="text-sm text-muted-foreground">
                        {course.description}
                      </p>
                    )}
                    
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex flex-col items-center h-auto py-2 gap-1 hover:bg-accent"
                        onClick={() => navigate(`/teacher/view-students?course=${course.id}`)}
                      >
                        <Users className="h-4 w-4 text-primary" />
                        <div className="text-lg font-semibold text-sm">{stats.enrollments}</div>
                        <div className="text-xs text-muted-foreground">Students</div>
                      </Button>
                      
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex flex-col items-center h-auto py-2 gap-1 hover:bg-accent"
                        onClick={() => navigate(`/teacher/upload-materials?course=${course.id}`)}
                      >
                        <FileText className="h-4 w-4 text-accent" />
                        <div className="text-lg font-semibold text-sm">{stats.materials}</div>
                        <div className="text-xs text-muted-foreground">Materials</div>
                      </Button>
                      
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex flex-col items-center h-auto py-2 gap-1 hover:bg-accent"
                        onClick={() => navigate(`/teacher/assignments?course=${course.id}`)}
                      >
                        <ClipboardList className="h-4 w-4 text-secondary" />
                        <div className="text-lg font-semibold text-sm">{stats.assignments}</div>
                        <div className="text-xs text-muted-foreground">Assignments</div>
                      </Button>
                    </div>
                    
                    <div className="pt-2 border-t">
                      <div className="text-xs text-muted-foreground">
                        Created: {new Date(course.created_at).toLocaleDateString()}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <Card>
            <CardContent className="text-center py-8">
              <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No courses assigned yet.</p>
              <p className="text-sm text-muted-foreground mt-2">
                Contact your administrator to get assigned to courses.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}