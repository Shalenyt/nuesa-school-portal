import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, BookOpen, Users } from 'lucide-react';
import { DashboardLayout } from '@/components/Layout/DashboardLayout';
import { toast } from '@/hooks/use-toast';

export default function AdminCourseLists() {
  const [courseLists, setCourseLists] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [courses, setCourses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [classesData, subjectsData, courseListsData] = await Promise.all([
        supabase.from('classes').select('*').order('name'),
        supabase.from('subjects').select('*').order('name'),
        supabase.from('course_lists').select(`
          *,
          classes(name),
          subjects(name)
        `).order('created_at', { ascending: false })
      ]);

      if (classesData.data) setClasses(classesData.data);
      if (subjectsData.data) setSubjects(subjectsData.data);
      if (courseListsData.data) setCourseLists(courseListsData.data);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCoursesForSelection = async () => {
    if (!selectedClass || !selectedSubject) return;

    try {
      const { data, error } = await supabase
        .from('courses')
        .select('*')
        .eq('class_id', selectedClass)
        .eq('subject_id', selectedSubject)
        .order('semester')
        .order('credit_unit');

      if (error) throw error;
      setCourses(data || []);
    } catch (error) {
      console.error('Error fetching courses:', error);
    }
  };

  useEffect(() => {
    if (selectedClass && selectedSubject) {
      fetchCoursesForSelection();
    }
  }, [selectedClass, selectedSubject]);

  const createCourseList = async () => {
    if (!selectedClass || !selectedSubject || courses.length === 0) {
      toast({
        title: "Error",
        description: "Please select a level and department with available courses.",
        variant: "destructive"
      });
      return;
    }

    try {
      // Check if course list already exists
      const { data: existing } = await supabase
        .from('course_lists')
        .select('id')
        .eq('class_id', selectedClass)
        .eq('subject_id', selectedSubject)
        .single();

      if (existing) {
        toast({
          title: "Error",
          description: "Course list already exists for this level and department.",
          variant: "destructive"
        });
        return;
      }

      const { error } = await supabase
        .from('course_lists')
        .insert([{
          class_id: selectedClass,
          subject_id: selectedSubject,
          course_ids: courses.map(c => c.id)
        }]);

      if (error) throw error;

      toast({
        title: "Course list created",
        description: "Course list has been created successfully.",
      });

      setSelectedClass('');
      setSelectedSubject('');
      setCourses([]);
      setIsCreating(false);
      fetchData();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const deleteCourseList = async (id: string) => {
    try {
      const { error } = await supabase
        .from('course_lists')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Course list deleted",
        description: "Course list has been removed successfully.",
      });

      fetchData();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const groupCoursesBySemester = (courses: any[]) => {
    const firstSemester = courses.filter(c => c.semester === 'FIRST').sort((a, b) => a.credit_unit - b.credit_unit);
    const secondSemester = courses.filter(c => c.semester === 'SECOND').sort((a, b) => a.credit_unit - b.credit_unit);
    return { firstSemester, secondSemester };
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Course Lists</h1>
            <p className="text-muted-foreground">
              Create and manage course lists for different levels and departments
            </p>
          </div>
          <Button onClick={() => setIsCreating(true)}>
            <Plus className="h-4 w-4 mr-2" />
            New Course List
          </Button>
        </div>

        {isCreating && (
          <Card>
            <CardHeader>
              <CardTitle>Create New Course List</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <Select
                  value={selectedSubject}
                  onValueChange={setSelectedSubject}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select Department" />
                  </SelectTrigger>
                  <SelectContent>
                    {subjects.map((subject) => (
                      <SelectItem key={subject.id} value={subject.id}>{subject.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={selectedClass}
                  onValueChange={setSelectedClass}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select Level" />
                  </SelectTrigger>
                  <SelectContent>
                    {classes.map((cls) => (
                      <SelectItem key={cls.id} value={cls.id}>{cls.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedClass && selectedSubject && courses.length > 0 && (
                <div className="mt-4">
                  <h3 className="text-lg font-semibold mb-3">Available Courses</h3>
                  {(() => {
                    const { firstSemester, secondSemester } = groupCoursesBySemester(courses);
                    return (
                      <div className="space-y-4">
                        {firstSemester.length > 0 && (
                          <div>
                            <h4 className="font-medium text-primary mb-2">First Semester</h4>
                            <div className="grid gap-2">
                              {firstSemester.map((course) => (
                                <div key={course.id} className="flex justify-between items-center p-2 bg-muted rounded">
                                  <span>{course.name}: {course.description}</span>
                                  <span className="text-sm text-muted-foreground">{course.credit_unit} units</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        {secondSemester.length > 0 && (
                          <div>
                            <h4 className="font-medium text-primary mb-2">Second Semester</h4>
                            <div className="grid gap-2">
                              {secondSemester.map((course) => (
                                <div key={course.id} className="flex justify-between items-center p-2 bg-muted rounded">
                                  <span>{course.name}: {course.description}</span>
                                  <span className="text-sm text-muted-foreground">{course.credit_unit} units</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              )}

              <div className="flex gap-2">
                <Button onClick={createCourseList}>Create</Button>
                <Button variant="outline" onClick={() => setIsCreating(false)}>Cancel</Button>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {courseLists.map((courseList) => (
            <Card key={courseList.id}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <BookOpen className="h-5 w-5" />
                      {courseList.classes?.name}
                    </CardTitle>
                    <div className="text-sm text-muted-foreground mt-1">
                      {courseList.subjects?.name}
                    </div>
                  </div>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => deleteCourseList(courseList.id)}
                  >
                    ×
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2 text-sm">
                  <Users className="h-4 w-4" />
                  <span>{courseList.course_ids?.length || 0} courses</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
}