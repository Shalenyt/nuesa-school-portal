import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BookOpen, Plus, Edit2, Trash2, Users } from 'lucide-react';
import { DashboardLayout } from '@/components/Layout/DashboardLayout';
import { toast } from '@/hooks/use-toast';

export default function AdminCourses() {
  const [courses, setCourses] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [teachers, setTeachers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [newCourse, setNewCourse] = useState({
    name: '',
    description: '',
    class_id: '',
    subject_id: '',
    teacher_id: '',
    semester: '',
    academic_year: new Date().getFullYear().toString(),
    credit_unit: 1
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [coursesData, classesData, subjectsData, teachersData] = await Promise.all([
        supabase.from('courses').select(`
          *,
          classes(name),
          subjects(name),
          profiles(full_name)
        `).order('created_at', { ascending: false }),
        supabase.from('classes').select('*').order('name'),
        supabase.from('subjects').select('*').order('name'),
        supabase.from('profiles').select('id, full_name').eq('role', 'teacher').eq('status', 'approved')
      ]);

      if (coursesData.data) setCourses(coursesData.data);
      if (classesData.data) setClasses(classesData.data);
      if (subjectsData.data) setSubjects(subjectsData.data);
      if (teachersData.data) setTeachers(teachersData.data);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const createCourse = async () => {
    if (!newCourse.name.trim() || !newCourse.description.trim() || !newCourse.class_id || !newCourse.subject_id || !newCourse.teacher_id || !newCourse.semester || !newCourse.credit_unit) {
      toast({
        title: "Error",
        description: "Please fill in all required fields.",
        variant: "destructive"
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('courses')
        .insert([{
          name: newCourse.name.trim(),
          description: newCourse.description.trim(),
          class_id: newCourse.class_id,
          subject_id: newCourse.subject_id,
          teacher_id: newCourse.teacher_id,
          semester: newCourse.semester,
          academic_year: newCourse.academic_year,
          credit_unit: newCourse.credit_unit
        }]);

      if (error) throw error;

      toast({
        title: "Course created",
        description: "New course has been created successfully.",
      });

      setNewCourse({ name: '', description: '', class_id: '', subject_id: '', teacher_id: '', semester: '', academic_year: new Date().getFullYear().toString(), credit_unit: 1 });
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

  const deleteCourse = async (id: string) => {
    try {
      const { error } = await supabase
        .from('courses')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Course deleted",
        description: "Course has been removed successfully.",
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

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Courses</h1>
            <p className="text-muted-foreground">
              Manage courses and assign teachers
            </p>
          </div>
          <Button onClick={() => setIsCreating(true)}>
            <Plus className="h-4 w-4 mr-2" />
            New Course
          </Button>
        </div>

        {isCreating && (
          <Card>
            <CardHeader>
              <CardTitle>Create New Course</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Input
                placeholder="Course Code (e.g., MTH 101)"
                value={newCourse.name}
                onChange={(e) => setNewCourse(prev => ({ ...prev, name: e.target.value }))}
              />
              <Textarea
                placeholder="Course Title"
                value={newCourse.description}
                onChange={(e) => setNewCourse(prev => ({ ...prev, description: e.target.value }))}
                rows={3}
              />
              <div className="grid gap-4 md:grid-cols-2">
                <Select
                  value={newCourse.subject_id}
                  onValueChange={(value) => setNewCourse(prev => ({ ...prev, subject_id: value }))}
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
                  value={newCourse.class_id}
                  onValueChange={(value) => setNewCourse(prev => ({ ...prev, class_id: value }))}
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
              <div className="grid gap-4 md:grid-cols-3">
                <Select
                  value={newCourse.semester || ''}
                  onValueChange={(value) => setNewCourse(prev => ({ ...prev, semester: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select Semester" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="FIRST">FIRST</SelectItem>
                    <SelectItem value="SECOND">SECOND</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  placeholder="Credit Unit"
                  type="number"
                  min="1"
                  max="6"
                  value={newCourse.credit_unit || ''}
                  onChange={(e) => setNewCourse(prev => ({ ...prev, credit_unit: parseInt(e.target.value) }))}
                />
                <Select
                  value={newCourse.teacher_id}
                  onValueChange={(value) => setNewCourse(prev => ({ ...prev, teacher_id: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select teacher" />
                  </SelectTrigger>
                  <SelectContent>
                    {teachers.map((teacher) => (
                      <SelectItem key={teacher.id} value={teacher.id}>{teacher.full_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2">
                <Button onClick={createCourse}>Create</Button>
                <Button variant="outline" onClick={() => setIsCreating(false)}>Cancel</Button>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {courses.map((course) => (
            <Card key={course.id}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <BookOpen className="h-5 w-5" />
                      {course.name}
                    </CardTitle>
                    <div className="text-sm text-muted-foreground mt-1">
                      {course.classes?.name} • {course.subjects?.name}
                    </div>
                  </div>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => deleteCourse(course.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {course.description && (
                  <p className="text-sm text-muted-foreground mb-3">
                    {course.description}
                  </p>
                )}
                <div className="flex flex-wrap gap-2 mb-3">
                  {course.semester && (
                    <Badge variant="secondary">{course.semester} Semester</Badge>
                  )}
                  {course.credit_unit && (
                    <Badge variant="outline">{course.credit_unit} Credit{course.credit_unit > 1 ? 's' : ''}</Badge>
                  )}
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Users className="h-4 w-4" />
                  <span>Teacher: {course.profiles?.full_name}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
}