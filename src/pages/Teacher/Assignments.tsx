import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ClipboardList, Plus, Calendar, Users, Trash2 } from 'lucide-react';
import { DashboardLayout } from '@/components/Layout/DashboardLayout';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';

export default function TeacherAssignments() {
  const { profile } = useAuth();
  const [assignments, setAssignments] = useState<any[]>([]);
  const [courses, setCourses] = useState<any[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [newAssignment, setNewAssignment] = useState({
    title: '',
    description: '',
    course_id: '',
    due_date: '',
    max_points: 100
  });

  useEffect(() => {
    fetchCourses();
    fetchAssignments();
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

  const fetchAssignments = async () => {
    try {
      const { data, error } = await supabase
        .from('assignments')
        .select(`
          *,
          courses(name, classes(name), subjects(name))
        `)
        .eq('created_by', profile?.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAssignments(data || []);
    } catch (error) {
      console.error('Error fetching assignments:', error);
    }
  };

  const createAssignment = async () => {
    if (!newAssignment.title.trim() || !newAssignment.course_id || !newAssignment.due_date) {
      toast({
        title: "Error",
        description: "Please fill in all required fields.",
        variant: "destructive"
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('assignments')
        .insert([{
          title: newAssignment.title.trim(),
          description: newAssignment.description.trim(),
          course_id: newAssignment.course_id,
          due_date: newAssignment.due_date,
          max_points: newAssignment.max_points,
          created_by: profile?.id
        }]);

      if (error) throw error;

      toast({
        title: "Assignment created",
        description: "Assignment has been published to students.",
      });

      setNewAssignment({ title: '', description: '', course_id: '', due_date: '', max_points: 100 });
      setIsCreating(false);
      fetchAssignments();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const deleteAssignment = async (id: string) => {
    try {
      const { error } = await supabase
        .from('assignments')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Assignment deleted",
        description: "Assignment has been removed successfully.",
      });

      fetchAssignments();
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
            <h1 className="text-3xl font-bold tracking-tight">Assignments</h1>
            <p className="text-muted-foreground">
              Create and manage assignments for your courses
            </p>
          </div>
          <Button onClick={() => setIsCreating(true)}>
            <Plus className="h-4 w-4 mr-2" />
            New Assignment
          </Button>
        </div>

        {isCreating && (
          <Card>
            <CardHeader>
              <CardTitle>Create New Assignment</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Input
                placeholder="Assignment title"
                value={newAssignment.title}
                onChange={(e) => setNewAssignment(prev => ({ ...prev, title: e.target.value }))}
              />
              <Textarea
                placeholder="Assignment description"
                value={newAssignment.description}
                onChange={(e) => setNewAssignment(prev => ({ ...prev, description: e.target.value }))}
                rows={4}
              />
              <div className="grid gap-4 md:grid-cols-3">
                <Select
                  value={newAssignment.course_id}
                  onValueChange={(value) => setNewAssignment(prev => ({ ...prev, course_id: value }))}
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
                <Input
                  type="datetime-local"
                  value={newAssignment.due_date}
                  onChange={(e) => setNewAssignment(prev => ({ ...prev, due_date: e.target.value }))}
                />
                <Input
                  type="number"
                  placeholder="Max points"
                  value={newAssignment.max_points}
                  onChange={(e) => setNewAssignment(prev => ({ ...prev, max_points: parseInt(e.target.value) }))}
                />
              </div>
              <div className="flex gap-2">
                <Button onClick={createAssignment}>Create Assignment</Button>
                <Button variant="outline" onClick={() => setIsCreating(false)}>Cancel</Button>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="space-y-4">
          {assignments.map((assignment) => (
            <Card key={assignment.id}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <ClipboardList className="h-5 w-5" />
                      {assignment.title}
                    </CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">
                      {assignment.courses?.name} • {assignment.courses?.classes?.name} - {assignment.courses?.subjects?.name}
                    </p>
                  </div>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => deleteAssignment(assignment.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {assignment.description && (
                  <p className="text-muted-foreground mb-4">{assignment.description}</p>
                )}
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Calendar className="h-4 w-4" />
                    Due: {new Date(assignment.due_date).toLocaleString()}
                  </div>
                  <div className="flex items-center gap-1">
                    <Users className="h-4 w-4" />
                    Max Points: {assignment.max_points}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
}