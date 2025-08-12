import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Users, Search, Mail, Phone, BookOpen } from 'lucide-react';
import { DashboardLayout } from '@/components/Layout/DashboardLayout';
import { useAuth } from '@/hooks/useAuth';

export default function ViewStudents() {
  const { profile } = useAuth();
  const [students, setStudents] = useState<any[]>([]);
  const [courses, setCourses] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [levels, setLevels] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCourse, setSelectedCourse] = useState('all');
  const [selectedDepartment, setSelectedDepartment] = useState('all');
  const [selectedLevel, setSelectedLevel] = useState('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, [profile]);

  const fetchData = async () => {
    try {
      // Fetch teacher's courses
      const { data: coursesData, error: coursesError } = await supabase
        .from('courses')
        .select(`
          *,
          classes(name, grade_level),
          subjects(name)
        `)
        .eq('teacher_id', profile?.id);

      if (coursesError) throw coursesError;
      setCourses(coursesData || []);

      // Fetch all departments and levels for filtering
      const [{ data: departmentsData }, { data: levelsData }] = await Promise.all([
        supabase.from('subjects').select('id, name'),
        supabase.from('classes').select('id, name, grade_level')
      ]);
      
      setDepartments(departmentsData || []);
      setLevels(levelsData || []);

      // Fetch students based on course lists that match teacher's courses
      const courseIds = coursesData?.map(course => course.id) || [];
      
      if (courseIds.length > 0) {
        // Get all course lists that contain these course IDs
        const { data: courseListsData, error: courseListsError } = await supabase
          .from('course_lists')
          .select(`
            *,
            classes(name, grade_level),
            subjects(name)
          `);

        if (courseListsError) throw courseListsError;

        // Filter course lists that have courses taught by this teacher
        const relevantCourseLists = courseListsData?.filter(courseList => 
          courseList.course_ids?.some((id: string) => courseIds.includes(id))
        ) || [];

        if (relevantCourseLists.length > 0) {
          // Get students from these course lists
          const classIds = relevantCourseLists.map(cl => cl.class_id);
          const subjectIds = relevantCourseLists.map(cl => cl.subject_id);

          const { data: studentsData, error: studentsError } = await supabase
            .from('profiles')
            .select(`
              id,
              full_name,
              student_id,
              email,
              phone,
              status,
              level_id,
              department_id,
              classes:level_id(name, grade_level),
              subjects:department_id(name)
            `)
            .eq('role', 'student')
            .eq('status', 'approved')
            .in('level_id', classIds)
            .in('department_id', subjectIds);

          if (studentsError) throw studentsError;

          // Map students to courses they're enrolled in
          const studentsWithCourses = studentsData?.map(student => {
            const studentCourseList = relevantCourseLists.find(cl => 
              cl.class_id === student.level_id && cl.subject_id === student.department_id
            );
            const studentCourses = coursesData?.filter(course => 
              studentCourseList?.course_ids?.includes(course.id)
            ) || [];

            return {
              ...student,
              courses: studentCourses
            };
          }) || [];

          setStudents(studentsWithCourses);
        }
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredStudents = students.filter(student => {
    const matchesSearch = student?.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         student?.student_id?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesCourse = selectedCourse === 'all' || 
                         student.courses?.some((course: any) => course.id === selectedCourse);
    
    const matchesDepartment = selectedDepartment === 'all' || 
                             student.department_id === selectedDepartment;
    
    const matchesLevel = selectedLevel === 'all' || 
                        student.level_id === selectedLevel;
    
    return matchesSearch && matchesCourse && matchesDepartment && matchesLevel;
  });

  // Group students by course for better organization
  const studentsByCourse = filteredStudents.reduce((acc, student) => {
    student.courses?.forEach((course: any) => {
      if (!acc[course.id]) {
        acc[course.id] = {
          course: course,
          students: []
        };
      }
      acc[course.id].students.push(student);
    });
    return acc;
  }, {} as any);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">View Students</h1>
          <p className="text-muted-foreground">
            View students enrolled in your courses
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="h-5 w-5" />
              Search and Filter
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name or student ID"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <select
                value={selectedCourse}
                onChange={(e) => setSelectedCourse(e.target.value)}
                className="px-3 py-2 border rounded-md bg-background"
              >
                <option value="all">All Courses</option>
                {courses.map((course) => (
                  <option key={course.id} value={course.id}>
                    {course.name} ({course.classes?.name} - {course.subjects?.name})
                  </option>
                ))}
              </select>
              <select
                value={selectedDepartment}
                onChange={(e) => setSelectedDepartment(e.target.value)}
                className="px-3 py-2 border rounded-md bg-background"
              >
                <option value="all">All Departments</option>
                {departments.map((dept) => (
                  <option key={dept.id} value={dept.id}>
                    {dept.name}
                  </option>
                ))}
              </select>
              <select
                value={selectedLevel}
                onChange={(e) => setSelectedLevel(e.target.value)}
                className="px-3 py-2 border rounded-md bg-background"
              >
                <option value="all">All Levels</option>
                {levels.map((level) => (
                  <option key={level.id} value={level.id}>
                    {level.name} (Grade {level.grade_level})
                  </option>
                ))}
              </select>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          {Object.values(studentsByCourse).map((courseGroup: any) => (
            <Card key={courseGroup.course?.id}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BookOpen className="h-5 w-5" />
                  {courseGroup.course?.name}
                  <Badge variant="secondary">{courseGroup.students.length} students</Badge>
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  {courseGroup.course?.classes?.name} (Grade {courseGroup.course?.classes?.grade_level}) • {courseGroup.course?.subjects?.name}
                </p>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {courseGroup.students.map((student: any) => (
                    <div key={student.id} className="p-4 border rounded-lg">
                      <div className="flex items-start gap-3">
                        <Avatar>
                          <AvatarImage src="" alt={student.full_name} />
                          <AvatarFallback>
                            {student.full_name?.charAt(0)?.toUpperCase() || 'S'}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium truncate">{student.full_name}</h3>
                          <p className="text-sm text-muted-foreground">ID: {student.student_id}</p>
                          <p className="text-sm text-muted-foreground">
                            {student.classes?.name} (Grade {student.classes?.grade_level}) • {student.subjects?.name}
                          </p>
                          {student.email && (
                            <div className="flex items-center gap-1 mt-1">
                              <Mail className="h-3 w-3" />
                              <span className="text-xs text-muted-foreground truncate">
                                {student.email}
                              </span>
                            </div>
                          )}
                          {student.phone && (
                            <div className="flex items-center gap-1 mt-1">
                              <Phone className="h-3 w-3" />
                              <span className="text-xs text-muted-foreground">
                                {student.phone}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                {courseGroup.students.length === 0 && (
                  <p className="text-center text-muted-foreground py-8">
                    No students enrolled in this course yet.
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {Object.keys(studentsByCourse).length === 0 && !loading && (
          <Card>
            <CardContent className="text-center py-8">
              <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No students found.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}