import { useEffect, useState } from 'react';
import { useSearchParams, useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/Layout/DashboardLayout';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { User, AlertTriangle, Trash2 } from 'lucide-react';

interface StudentDetail {
  id: string;
  full_name: string;
  student_id: string;
  email: string;
  phone?: string;
  status: string;
  profile_photo_url?: string;
  level_name?: string;
  department_name?: string;
  gpa?: number;
  attendance_percentage?: number;
  courses?: string[];
}

export default function StudentDetail() {
  const [searchParams] = useSearchParams();
  const { id: paramId } = useParams();
  const navigate = useNavigate();
  const [student, setStudent] = useState<StudentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [showSuspend, setShowSuspend] = useState(false);
  const [showDelete, setShowDelete] = useState(false);

  const studentId = paramId || searchParams.get('id');

  useEffect(() => {
    if (studentId) fetchStudent();
  }, [studentId]);

  const fetchStudent = async () => {
    if (!studentId) return;
    try {
      const { data } = await supabase
        .from('profiles')
        .select(`
          id,
          full_name,
          student_id,
          email,
          phone,
          status,
          profile_photo_url,
          level_id,
          department_id,
          classes:level_id(name),
          subjects:department_id(name)
        `)
        .eq('id', studentId)
        .eq('role', 'student')
        .maybeSingle();

      if (data) {
        // Mock GPA calculation (from quiz scores)
        const { data: quizzes } = await supabase
          .from('quiz_submissions')
          .select('score')
          .eq('student_id', studentId);

        const avgScore = quizzes && quizzes.length > 0
          ? quizzes.reduce((a, b) => a + (b.score || 0), 0) / quizzes.length
          : 0;

        setStudent({
          id: data.id,
          full_name: data.full_name,
          student_id: data.student_id || 'N/A',
          email: data.email,
          phone: data.phone || undefined,
          status: data.status,
          profile_photo_url: data.profile_photo_url || undefined,
          level_name: (data.classes as any)?.name || 'N/A',
          department_name: (data.subjects as any)?.name || 'N/A',
          gpa: avgScore > 0 ? Math.min(5.0, (avgScore / 100) * 5) : 0,
          attendance_percentage: 85, // Mock data
          courses: ['MTH101', 'PHY101'], // Mock data
        });
      }
    } catch (err) {
      console.error('Error fetching student:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSuspend = async () => {
    if (!studentId) return;
    try {
      await supabase.from('profiles').update({ status: 'rejected' }).eq('id', studentId);
      setStudent(prev => prev ? { ...prev, status: 'rejected' } : null);
      setShowSuspend(false);
    } catch (err) {
      console.error('Error suspending student:', err);
    }
  };

  const handleDelete = async () => {
    if (!studentId) return;
    try {
      await supabase.from('profiles').delete().eq('id', studentId);
      navigate('/admin/manage-users');
    } catch (err) {
      console.error('Error deleting student:', err);
    }
  };

  if (loading) return <DashboardLayout><div className="text-center">Loading...</div></DashboardLayout>;
  if (!student) return <DashboardLayout><div className="text-center text-muted-foreground">Student not found</div></DashboardLayout>;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <Button variant="outline" onClick={() => navigate(-1)}>← Back</Button>

        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row gap-6">
              <Avatar className="h-32 w-32">
                <AvatarImage src={student.profile_photo_url} />
                <AvatarFallback><User className="h-16 w-16" /></AvatarFallback>
              </Avatar>
              <div className="flex-1 space-y-4">
                <div>
                  <h1 className="text-3xl font-bold">{student.full_name}</h1>
                  <p className="text-muted-foreground">Matric: {student.student_id}</p>
                  <Badge variant={student.status === 'approved' ? 'default' : 'destructive'} className="mt-2">
                    {student.status === 'approved' ? 'Active' : student.status}
                  </Badge>
                </div>
                <div className="grid gap-2">
                  <p className="text-sm"><strong>Email:</strong> {student.email}</p>
                  {student.phone && <p className="text-sm"><strong>Phone:</strong> {student.phone}</p>}
                  <p className="text-sm"><strong>Level:</strong> {student.level_name}</p>
                  <p className="text-sm"><strong>Department:</strong> {student.department_name}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">GPA</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{(student.gpa || 0).toFixed(2)}/5.0</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Attendance</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{student.attendance_percentage}%</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Courses</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{student.courses?.length || 0}</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Enrolled Courses</CardTitle>
          </CardHeader>
          <CardContent>
            {student.courses && student.courses.length > 0 ? (
              <ul className="space-y-2">
                {student.courses.map((course, idx) => (
                  <li key={idx} className="flex items-center gap-2 p-2 border rounded">
                    <Badge variant="secondary">{course}</Badge>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted-foreground">No courses enrolled</p>
            )}
          </CardContent>
        </Card>

        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="text-destructive flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Account Actions
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button
              variant="outline"
              className="w-full border-destructive text-destructive hover:bg-destructive/10"
              onClick={() => setShowSuspend(true)}
            >
              Suspend Account
            </Button>
            <Button
              variant="destructive"
              className="w-full"
              onClick={() => setShowDelete(true)}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete Account
            </Button>
          </CardContent>
        </Card>

        <AlertDialog open={showSuspend} onOpenChange={setShowSuspend}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Suspend Account?</AlertDialogTitle>
              <AlertDialogDescription>
                This will suspend {student.full_name}'s account. They won't be able to access the portal.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="flex gap-3 justify-end">
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleSuspend}>Suspend</AlertDialogAction>
            </div>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={showDelete} onOpenChange={setShowDelete}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Account?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete {student.full_name}'s account and all associated data. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="flex gap-3 justify-end">
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
            </div>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </DashboardLayout>
  );
}
