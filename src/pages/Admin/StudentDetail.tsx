import { useEffect, useState } from 'react';
import { useSearchParams, useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/Layout/DashboardLayout';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { User, AlertTriangle, Trash2 } from 'lucide-react';

interface CourseInfo {
  id: string;
  name: string;
  credit_unit: number | null;
  semester: string | null;
  department_name: string;
  level_name: string;
}

interface StudentDetailData {
  id: string;
  full_name: string;
  student_id: string;
  email: string;
  phone?: string;
  status: string;
  profile_photo_url?: string;
  level_name: string;
  department_name: string;
  gpa: number;
  attendance_percentage: number;
  courses: CourseInfo[];
  quiz_avg: number;
  assignment_avg: number;
}

export default function StudentDetail() {
  const [searchParams] = useSearchParams();
  const { id: paramId } = useParams();
  const navigate = useNavigate();
  const [student, setStudent] = useState<StudentDetailData | null>(null);
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
      // Fetch profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('id, full_name, student_id, email, phone, status, profile_photo_url, level_id, department_id, classes:level_id(name), subjects:department_id(name)')
        .eq('id', studentId)
        .maybeSingle();

      if (!profile) { setLoading(false); return; }

      // Fetch enrolled courses
      const { data: enrollments } = await supabase
        .from('student_enrollments')
        .select('course_id, courses:course_id(id, name, credit_unit, semester, subjects:subject_id(name), classes:class_id(name))')
        .eq('student_id', studentId);

      const courses: CourseInfo[] = (enrollments || []).map((e: any) => ({
        id: e.courses?.id || '',
        name: e.courses?.name || 'Unnamed',
        credit_unit: e.courses?.credit_unit,
        semester: e.courses?.semester,
        department_name: e.courses?.subjects?.name || '',
        level_name: e.courses?.classes?.name || '',
      }));

      // Fetch quiz scores
      const { data: quizSubs } = await supabase
        .from('quiz_submissions')
        .select('score')
        .eq('student_id', studentId);

      const quizScores = (quizSubs || []).filter((q: any) => q.score !== null);
      const quizAvg = quizScores.length > 0
        ? quizScores.reduce((a: number, b: any) => a + (b.score || 0), 0) / quizScores.length
        : 0;

      // Fetch assignment grades
      const { data: assignSubs } = await supabase
        .from('assignment_submissions')
        .select('grade')
        .eq('student_id', studentId);

      const assignGrades = (assignSubs || []).filter((a: any) => a.grade !== null);
      const assignAvg = assignGrades.length > 0
        ? assignGrades.reduce((a: number, b: any) => a + (b.grade || 0), 0) / assignGrades.length
        : 0;

      // Fetch attendance
      const courseIds = courses.map(c => c.id).filter(Boolean);
      let attendPct = 0;
      if (courseIds.length > 0) {
        const { data: sessions } = await supabase
          .from('attendance_sessions')
          .select('id')
          .in('course_id', courseIds);

        const totalSessions = sessions?.length || 0;

        if (totalSessions > 0) {
          const { data: records } = await supabase
            .from('attendance_records')
            .select('id')
            .eq('student_id', studentId)
            .in('session_id', (sessions || []).map((s: any) => s.id));

          attendPct = Math.round(((records?.length || 0) / totalSessions) * 100);
        }
      }

      // GPA: convert quiz avg to 5.0 scale
      const gpa = quizAvg > 0 ? Math.min(5.0, (quizAvg / 100) * 5) : 0;

      setStudent({
        id: profile.id,
        full_name: profile.full_name,
        student_id: profile.student_id || 'N/A',
        email: profile.email,
        phone: profile.phone || undefined,
        status: profile.status,
        profile_photo_url: profile.profile_photo_url || undefined,
        level_name: (profile.classes as any)?.name || 'N/A',
        department_name: (profile.subjects as any)?.name || 'N/A',
        gpa,
        attendance_percentage: attendPct,
        courses,
        quiz_avg: quizAvg,
        assignment_avg: assignAvg,
      });
    } catch (err) {
      console.error('Error fetching student:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSuspend = async () => {
    if (!studentId) return;
    await supabase.from('profiles').update({ status: 'rejected' }).eq('id', studentId);
    setStudent(prev => prev ? { ...prev, status: 'rejected' } : null);
    setShowSuspend(false);
  };

  const handleDelete = async () => {
    if (!studentId) return;
    await supabase.from('profiles').delete().eq('id', studentId);
    navigate('/admin/manage-users');
  };

  if (loading) return <DashboardLayout><div className="text-center py-8">Loading...</div></DashboardLayout>;
  if (!student) return <DashboardLayout><div className="text-center text-muted-foreground py-8">User not found</div></DashboardLayout>;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <Button variant="outline" onClick={() => navigate(-1)}>← Back</Button>

        {/* Profile Card */}
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

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">GPA</CardTitle></CardHeader>
            <CardContent><p className="text-3xl font-bold">{student.gpa.toFixed(2)}/5.0</p></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Attendance</CardTitle></CardHeader>
            <CardContent><p className="text-3xl font-bold">{student.attendance_percentage}%</p></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Quiz Avg</CardTitle></CardHeader>
            <CardContent><p className="text-3xl font-bold">{student.quiz_avg.toFixed(1)}%</p></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Courses</CardTitle></CardHeader>
            <CardContent><p className="text-3xl font-bold">{student.courses.length}</p></CardContent>
          </Card>
        </div>

        {/* Enrolled Courses */}
        <Card>
          <CardHeader><CardTitle>Enrolled Courses</CardTitle></CardHeader>
          <CardContent>
            {student.courses.length > 0 ? (
              <div className="space-y-2">
                {student.courses.map((course) => (
                  <div key={course.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <p className="font-medium text-sm">{course.name}</p>
                      <p className="text-xs text-muted-foreground">{course.department_name} • {course.level_name}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {course.credit_unit && <Badge variant="outline">{course.credit_unit} CU</Badge>}
                      {course.semester && <Badge variant="secondary">{course.semester}</Badge>}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground">No courses enrolled</p>
            )}
          </CardContent>
        </Card>

        {/* Account Actions */}
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="text-destructive flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" /> Account Actions
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button variant="outline" className="w-full border-destructive text-destructive hover:bg-destructive/10" onClick={() => setShowSuspend(true)}>
              Suspend Account
            </Button>
            <Button variant="destructive" className="w-full" onClick={() => setShowDelete(true)}>
              <Trash2 className="h-4 w-4 mr-2" /> Delete Account
            </Button>
          </CardContent>
        </Card>

        {/* Dialogs */}
        <AlertDialog open={showSuspend} onOpenChange={setShowSuspend}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Suspend Account?</AlertDialogTitle>
              <AlertDialogDescription>This will suspend {student.full_name}'s account.</AlertDialogDescription>
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
              <AlertDialogDescription>This will permanently delete {student.full_name}'s account. This cannot be undone.</AlertDialogDescription>
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
