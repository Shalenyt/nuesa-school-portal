import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BookOpen, Plus, Trash2, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { DashboardLayout } from '@/components/Layout/DashboardLayout';
import { toast } from '@/hooks/use-toast';

export default function AdminCourses() {
  const [courses, setCourses] = useState<any[]>([]);
  const [filteredCourses, setFilteredCourses] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [teachers, setTeachers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [filterClass, setFilterClass] = useState('all');
  const [filterSubject, setFilterSubject] = useState('all');
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

  useEffect(() => {
    applyFilters();
  }, [courses, filterClass, filterSubject]);

  const applyFilters = () => {
    let result = courses;
    if (filterClass && filterClass !== 'all') {
      result = result.filter(c => c.class_id === filterClass);
    }
    if (filterSubject && filterSubject !== 'all') {
      result = result.filter(c => c.subject_id === filterSubject);
    }
    setFilteredCourses(result);
  };

  const fetchData = async () => {
    try {
      const [coursesData, classesData, subjectsData, teachersData] = await Promise.all([
        supabase.from('courses').select(`
          *,
          classes(name),
          subjects(name, code),
          profiles(full_name)
        `).order('created_at', { ascending: false }),
        supabase.from('classes').select('*').order('name'),
        supabase.from('subjects').select('*').order('name'),
        supabase.from('profiles').select('id, full_name').eq('role', 'teacher').eq('status', 'approved')
      ]);

      setCourses(coursesData.data || []);
      setClasses(classesData.data || []);
      setSubjects(subjectsData.data || []);
      setTeachers(teachersData.data || []);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const createCourse = async () => {
    if (!newCourse.name.trim() || !newCourse.class_id || !newCourse.subject_id || !newCourse.teacher_id || !newCourse.semester) {
      toast({ title: "Error", description: "Please fill in all required fields.", variant: "destructive" });
      return;
    }

    try {
      const { error } = await supabase.from('courses').insert([{
        name: newCourse.name.trim(),
        description: newCourse.description.trim() || null,
        class_id: newCourse.class_id,
        subject_id: newCourse.subject_id,
        teacher_id: newCourse.teacher_id,
        semester: newCourse.semester,
        academic_year: newCourse.academic_year,
        credit_unit: newCourse.credit_unit
      }]);

      if (error) throw error;
      toast({ title: "Course created", description: "New course has been created successfully." });
      setNewCourse({ name: '', description: '', class_id: '', subject_id: '', teacher_id: '', semester: '', academic_year: new Date().getFullYear().toString(), credit_unit: 1 });
      setIsCreating(false);
      fetchData();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const deleteCourse = async (id: string) => {
    try {
      const { error } = await supabase.from('courses').delete().eq('id', id);
      if (error) throw error;
      toast({ title: "Course deleted", description: "Course has been removed successfully." });
      fetchData();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  if (loading) {
    return <DashboardLayout><div className="text-center py-8">Loading courses...</div></DashboardLayout>;
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Courses</h1>
            <p className="text-muted-foreground">Manage courses and assign lecturers</p>
          </div>
          <Button onClick={() => setIsCreating(true)}>
            <Plus className="h-4 w-4 mr-2" />
            New Course
          </Button>
        </div>

        {/* Filters */}
        <div className="grid gap-4 md:grid-cols-2">
          <Select value={filterClass} onValueChange={setFilterClass}>
            <SelectTrigger>
              <SelectValue placeholder="Filter by Level" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Levels</SelectItem>
              {classes.map((cls) => (
                <SelectItem key={cls.id} value={cls.id}>{cls.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterSubject} onValueChange={setFilterSubject}>
            <SelectTrigger>
              <SelectValue placeholder="Filter by Department" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Departments</SelectItem>
              {subjects.map((subject) => (
                <SelectItem key={subject.id} value={subject.id}>{subject.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {isCreating && (
          <Card>
            <CardHeader><CardTitle>Create New Course</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <Input placeholder="Course Code (e.g., MTH 101)" value={newCourse.name} onChange={(e) => setNewCourse(prev => ({ ...prev, name: e.target.value }))} />
              <Textarea placeholder="Course Title / Description" value={newCourse.description} onChange={(e) => setNewCourse(prev => ({ ...prev, description: e.target.value }))} rows={3} />
              <div className="grid gap-4 md:grid-cols-2">
                <Select value={newCourse.subject_id} onValueChange={(value) => setNewCourse(prev => ({ ...prev, subject_id: value }))}>
                  <SelectTrigger><SelectValue placeholder="Select Department" /></SelectTrigger>
                  <SelectContent>
                    {subjects.map((s) => (<SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>))}
                  </SelectContent>
                </Select>
                <Select value={newCourse.class_id} onValueChange={(value) => setNewCourse(prev => ({ ...prev, class_id: value }))}>
                  <SelectTrigger><SelectValue placeholder="Select Level" /></SelectTrigger>
                  <SelectContent>
                    {classes.map((c) => (<SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                <Select value={newCourse.semester || ''} onValueChange={(value) => setNewCourse(prev => ({ ...prev, semester: value }))}>
                  <SelectTrigger><SelectValue placeholder="Select Semester" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="FIRST">FIRST</SelectItem>
                    <SelectItem value="SECOND">SECOND</SelectItem>
                  </SelectContent>
                </Select>
                <Input placeholder="Credit Unit" type="number" min="1" max="6" value={newCourse.credit_unit || ''} onChange={(e) => setNewCourse(prev => ({ ...prev, credit_unit: parseInt(e.target.value) || 1 }))} />
                <Select value={newCourse.teacher_id} onValueChange={(value) => setNewCourse(prev => ({ ...prev, teacher_id: value }))}>
                  <SelectTrigger><SelectValue placeholder="Select lecturer" /></SelectTrigger>
                  <SelectContent>
                    {teachers.map((t) => (<SelectItem key={t.id} value={t.id}>{t.full_name}</SelectItem>))}
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

        {filteredCourses.length === 0 ? (
          <Card><CardContent className="pt-6 text-center text-muted-foreground">No courses found. {courses.length > 0 ? 'Try adjusting your filters.' : 'Create your first course.'}</CardContent></Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-4">
            {filteredCourses.map((course) => (
              <Card key={course.id}>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div className="min-w-0 flex-1">
                      <CardTitle className="flex items-center gap-2 text-base">
                        <BookOpen className="h-5 w-5 shrink-0" />
                        <span className="truncate">{course.name || 'Untitled'}</span>
                      </CardTitle>
                      <div className="text-sm text-muted-foreground mt-1">
                        {course.classes?.name || 'N/A'} • {course.subjects?.name || 'N/A'}
                      </div>
                    </div>
                    <Button variant="destructive" size="sm" onClick={() => deleteCourse(course.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {course.description && (
                    <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{course.description}</p>
                  )}
                  <div className="flex flex-wrap gap-2 mb-3">
                    {course.semester && <Badge variant="secondary">{course.semester} Semester</Badge>}
                    <Badge variant="outline">{course.credit_unit || 1} Credit{(course.credit_unit || 1) > 1 ? 's' : ''}</Badge>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Users className="h-4 w-4" />
                    <span className="truncate">Lecturer: {course.profiles?.full_name || 'Unassigned'}</span>
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
