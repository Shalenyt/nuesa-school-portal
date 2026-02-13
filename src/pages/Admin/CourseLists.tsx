import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, BookOpen, FileText } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { DashboardLayout } from '@/components/Layout/DashboardLayout';
import { useToast } from '@/hooks/use-toast';

export default function CourseLists() {
  const [courseLists, setCourseLists] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [courses, setCourses] = useState<any[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');
  const [selectedCourseList, setSelectedCourseList] = useState<any>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [courseListsData, classesData, subjectsData, coursesData] = await Promise.all([
        (supabase as any).from('course_lists').select(`
          *,
          classes(name),
          subjects(name)
        `).order('created_at', { ascending: false }),
        supabase.from('classes').select('*').order('name'),
        supabase.from('subjects').select('*').order('name'),
        supabase.from('courses').select(`
          *,
          classes(name),
          subjects(name)
        `).order('semester')
      ]);

      if (courseListsData.data) setCourseLists(courseListsData.data);
      if (classesData.data) setClasses(classesData.data);
      if (subjectsData.data) setSubjects(subjectsData.data);
      if (coursesData.data) setCourses(coursesData.data);
    } catch (error) {
      console.error('Error fetching data:', error);
    }
  };

  const getCoursesForSelection = () => {
    if (!selectedClass || !selectedSubject) return [];
    
    const filteredCourses = courses.filter(course => 
      course.class_id === selectedClass && course.subject_id === selectedSubject
    );

    // Sort by semester (First then Second) and then by credit unit
    return filteredCourses.sort((a, b) => {
      if (a.semester !== b.semester) {
        return a.semester === 'FIRST' ? -1 : 1;
      }
      return (a.credit_unit || 0) - (b.credit_unit || 0);
    });
  };

  const createCourseList = async () => {
    if (!selectedClass || !selectedSubject) {
      toast({
        title: "Error",
        description: "Please select both level and department.",
        variant: "destructive"
      });
      return;
    }

    const selectedCourses = getCoursesForSelection();
    if (selectedCourses.length === 0) {
      toast({
        title: "Error",
        description: "No courses found for this selection.",
        variant: "destructive"
      });
      return;
    }

    try {
      const { error } = await (supabase as any)
        .from('course_lists')
        .insert([{
          class_id: selectedClass,
          subject_id: selectedSubject,
          course_ids: selectedCourses.map(course => course.id)
        }]);

      if (error) throw error;

      toast({
        title: "Course list created",
        description: "Course list has been created successfully.",
      });

      setSelectedClass('');
      setSelectedSubject('');
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

  const deleteCourseList = async (courseListId: string) => {
    if (!confirm('Are you sure you want to delete this course list?')) return;

    try {
      const { error } = await (supabase as any)
        .from('course_lists')
        .delete()
        .eq('id', courseListId);

      if (error) throw error;

      toast({
        title: "Course list deleted",
        description: "Course list has been deleted successfully.",
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

  const selectedClassName = classes.find(c => c.id === selectedClass)?.name;
  const selectedSubjectName = subjects.find(s => s.id === selectedSubject)?.name;
  const availableCourses = getCoursesForSelection();

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Course Lists</h1>
            <p className="text-muted-foreground">
              Create and manage course lists for levels and departments
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
              </div>

              {selectedClass && selectedSubject && (
                <div className="space-y-4">
                  <h3 className="font-semibold">
                    Course Preview for {selectedClassName} - {selectedSubjectName}
                  </h3>
                  
                  {availableCourses.length > 0 ? (
                    <div className="space-y-2">
                      {['FIRST', 'SECOND'].map(semester => {
                        const semesterCourses = availableCourses.filter(course => course.semester === semester);
                        if (semesterCourses.length === 0) return null;
                        
                        return (
                          <div key={semester} className="space-y-2">
                            <h4 className="font-medium text-sm text-muted-foreground">
                              {semester} Semester
                            </h4>
                            {semesterCourses.map(course => (
                              <div key={course.id} className="flex justify-between items-center p-2 bg-muted rounded">
                                <span>{course.name}: {course.description}</span>
                                <span className="text-sm text-muted-foreground">
                                  {course.credit_unit} units
                                </span>
                              </div>
                            ))}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-muted-foreground">No courses available for this selection.</p>
                  )}
                </div>
              )}

              <div className="flex gap-2">
                <Button onClick={createCourseList} disabled={!selectedClass || !selectedSubject}>
                  Create
                </Button>
                <Button variant="outline" onClick={() => {
                  setIsCreating(false);
                  setSelectedClass('');
                  setSelectedSubject('');
                }}>
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {courseLists.map((courseList) => {
            const courseListCourses = courseList.course_ids?.map(id => courses.find(c => c.id === id)).filter(Boolean) || [];
            
            return (
              <Card 
                key={courseList.id}
                className="cursor-pointer hover:shadow-lg transition-shadow"
                onClick={() => setSelectedCourseList({ ...courseList, courses: courseListCourses })}
              >
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <FileText className="h-5 w-5" />
                        {courseList.classes?.name}
                      </CardTitle>
                      <div className="text-sm text-muted-foreground mt-1">
                        {courseList.subjects?.name}
                      </div>
                    </div>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteCourseList(courseList.id);
                      }}
                      className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                    >
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-sm text-muted-foreground">
                    {courseList.course_ids?.length || 0} courses in this list
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Course List Detail Modal */}
        <Dialog open={!!selectedCourseList} onOpenChange={() => setSelectedCourseList(null)}>
          <DialogContent className="max-w-2xl max-h-96 overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {selectedCourseList?.classes?.name} - {selectedCourseList?.subjects?.name}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {selectedCourseList?.courses && selectedCourseList.courses.length > 0 ? (
                ['FIRST', 'SECOND'].map(semester => {
                  const semesterCourses = selectedCourseList.courses.filter((c: any) => c.semester === semester);
                  if (semesterCourses.length === 0) return null;
                  
                  return (
                    <div key={semester} className="space-y-2">
                      <h3 className="font-semibold">{semester} Semester</h3>
                      <div className="space-y-2">
                        {semesterCourses.map((course: any) => (
                          <Card key={course.id} className="p-3">
                            <div className="flex justify-between items-start">
                              <div className="flex-1">
                                <p className="font-medium">{course.name}</p>
                                <p className="text-sm text-muted-foreground">{course.description}</p>
                              </div>
                              <div className="text-right">
                                <Badge variant="outline">{course.credit_unit} Units</Badge>
                              </div>
                            </div>
                          </Card>
                        ))}
                      </div>
                    </div>
                  );
                })
              ) : (
                <p className="text-muted-foreground">No courses in this list.</p>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}