import { useEffect, useState } from 'react';
import { useSearchParams, useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/Layout/DashboardLayout';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { SignedAvatarImage } from '@/components/Shared/UserAvatar';
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

interface UserDetailData {
  id: string;
  full_name: string;
  student_id: string | null;
  staff_id: string | null;
  email: string;
  phone?: string;
  status: string;
  role: string;
  profile_photo_url?: string;
  level_name: string;
  department_name: string;
  // Student metrics
  gpa: number;
  attendance_percentage: number;
  quiz_avg: number;
  assignment_avg: number;
  courses: CourseInfo[];
  // Lecturer metrics
  courses_teaching: CourseInfo[];
  total_students: number;
  assignments_given: number;
  submissions_received: number;
}

export default function StudentDetail() {
  const [searchParams] = useSearchParams();
  const { id: paramId } = useParams();
  const navigate = useNavigate();
  const [userData, setUserData] = useState<UserDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showSuspend, setShowSuspend] = useState(false);
  const [showDelete, setShowDelete] = useState(false);

  const userId = paramId || searchParams.get('id');

  useEffect(() => {
    if (userId) fetchUser();
  }, [userId]);

  const fetchUser = async () => {
    if (!userId) return;
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('id, full_name, student_id, staff_id, email, phone, status, role, profile_photo_url, level_id, department_id, classes:level_id(name), subjects:department_id(name)')
        .eq('id', userId)
        .maybeSingle();

      if (!profile) { setLoading(false); return; }

      const isLecturer = profile.role === 'teacher';

      if (isLecturer) {
        await fetchLecturerData(profile);
      } else {
        await fetchStudentData(profile);
      }
    } catch (err) {
      console.error('Error fetching user:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchLecturerData = async (profile: any) => {
    // Fetch courses this lecturer teaches
    const { data: coursesData } = await supabase
      .from('courses')
      .select('id, name, credit_unit, semester, subjects:subject_id(name), classes:class_id(name)')
      .eq('teacher_id', profile.id);

    const coursesTeaching: CourseInfo[] = (coursesData || []).map((c: any) => ({
      id: c.id, name: c.name || 'Unnamed', credit_unit: c.credit_unit,
      semester: c.semester, department_name: c.subjects?.name || '', level_name: c.classes?.name || '',
    }));

    const courseIds = coursesTeaching.map(c => c.id).filter(Boolean);

    let totalStudents = 0;
    let assignmentsGiven = 0;
    let submissionsReceived = 0;

    if (courseIds.length > 0) {
      const [enrollRes, assignRes, subRes] = await Promise.all([
        supabase.from('student_enrollments').select('id', { count: 'exact', head: true }).in('course_id', courseIds),
        supabase.from('assignments').select('id', { count: 'exact', head: true }).eq('created_by', profile.id),
        supabase.from('assignment_submissions').select('id, assignments!inner(created_by)', { count: 'exact', head: true }).eq('assignments.created_by', profile.id),
      ]);
      totalStudents = enrollRes.count || 0;
      assignmentsGiven = assignRes.count || 0;
      submissionsReceived = subRes.count || 0;
    }

    setUserData({
      id: profile.id, full_name: profile.full_name, student_id: profile.student_id,
      staff_id: profile.staff_id, email: profile.email, phone: profile.phone || undefined,
      status: profile.status, role: profile.role, profile_photo_url: profile.profile_photo_url || undefined,
      level_name: (profile.classes as any)?.name || 'N/A',
      department_name: (profile.subjects as any)?.name || 'N/A',
      gpa: 0, attendance_percentage: 0, quiz_avg: 0, assignment_avg: 0, courses: [],
      courses_teaching: coursesTeaching, total_students: totalStudents,
      assignments_given: assignmentsGiven, submissions_received: submissionsReceived,
    });
  };

  const fetchStudentData = async (profile: any) => {
    const { data: enrollments } = await supabase
      .from('student_enrollments')
      .select('course_id, courses:course_id(id, name, credit_unit, semester, subjects:subject_id(name), classes:class_id(name))')
      .eq('student_id', profile.id);

    const courses: CourseInfo[] = (enrollments || []).map((e: any) => ({
      id: e.courses?.id || '', name: e.courses?.name || 'Unnamed', credit_unit: e.courses?.credit_unit,
      semester: e.courses?.semester, department_name: e.courses?.subjects?.name || '', level_name: e.courses?.classes?.name || '',
    }));

    const [{ data: quizSubs }, { data: assignSubs }] = await Promise.all([
      supabase.from('quiz_submissions').select('score').eq('student_id', profile.id),
      supabase.from('assignment_submissions').select('grade').eq('student_id', profile.id),
    ]);

    const quizScores = (quizSubs || []).filter((q: any) => q.score !== null);
    const quizAvg = quizScores.length > 0 ? quizScores.reduce((a: number, b: any) => a + (b.score || 0), 0) / quizScores.length : 0;
    const assignGrades = (assignSubs || []).filter((a: any) => a.grade !== null);
    const assignAvg = assignGrades.length > 0 ? assignGrades.reduce((a: number, b: any) => a + (b.grade || 0), 0) / assignGrades.length : 0;

    const courseIds = courses.map(c => c.id).filter(Boolean);
    let attendPct = 0;
    if (courseIds.length > 0) {
      const { data: sessions } = await supabase.from('attendance_sessions').select('id').in('course_id', courseIds);
      const totalSessions = sessions?.length || 0;
      if (totalSessions > 0) {
        const { data: records } = await supabase.from('attendance_records').select('id').eq('student_id', profile.id).in('session_id', (sessions || []).map((s: any) => s.id));
        attendPct = Math.round(((records?.length || 0) / totalSessions) * 100);
      }
    }

    const gpa = quizAvg > 0 ? Math.min(5.0, (quizAvg / 100) * 5) : 0;

    setUserData({
      id: profile.id, full_name: profile.full_name, student_id: profile.student_id,
      staff_id: profile.staff_id, email: profile.email, phone: profile.phone || undefined,
      status: profile.status, role: profile.role, profile_photo_url: profile.profile_photo_url || undefined,
      level_name: (profile.classes as any)?.name || 'N/A',
      department_name: (profile.subjects as any)?.name || 'N/A',
      gpa, attendance_percentage: attendPct, courses, quiz_avg: quizAvg, assignment_avg: assignAvg,
      courses_teaching: [], total_students: 0, assignments_given: 0, submissions_received: 0,
    });
  };

  const handleSuspend = async () => {
    if (!userId) return;
    await supabase.from('profiles').update({ status: 'rejected' }).eq('id', userId);
    setUserData(prev => prev ? { ...prev, status: 'rejected' } : null);
    setShowSuspend(false);
  };

  const handleDelete = async () => {
    if (!userId) return;
    await supabase.from('profiles').delete().eq('id', userId);
    navigate('/admin/manage-users');
  };

  if (loading) return <DashboardLayout><div className="text-center py-8">Loading...</div></DashboardLayout>;
  if (!userData) return <DashboardLayout><div className="text-center text-muted-foreground py-8">User not found</div></DashboardLayout>;

  const isLecturer = userData.role === 'teacher';

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <Button variant="outline" onClick={() => navigate(-1)}>← Back</Button>

        {/* Profile Card */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row gap-6">
              <Avatar className="h-32 w-32">
                <SignedAvatarImage src={userData.profile_photo_url} />
                <AvatarFallback><User className="h-16 w-16" /></AvatarFallback>
              </Avatar>
              <div className="flex-1 space-y-4">
                <div>
                  <h1 className="text-3xl font-bold">{userData.full_name}</h1>
                  <p className="text-muted-foreground">
                    {isLecturer ? `Staff ID: ${userData.staff_id || 'N/A'}` : `Matric: ${userData.student_id || 'N/A'}`}
                  </p>
                  <div className="flex gap-2 mt-2">
                    <Badge variant={userData.status === 'approved' ? 'default' : 'destructive'}>
                      {userData.status === 'approved' ? 'Active' : userData.status}
                    </Badge>
                    <Badge variant="outline" className="capitalize">{userData.role === 'teacher' ? 'Lecturer' : userData.role}</Badge>
                  </div>
                </div>
                <div className="grid gap-2">
                  <p className="text-sm"><strong>Email:</strong> {userData.email}</p>
                  {userData.phone && <p className="text-sm"><strong>Phone:</strong> {userData.phone}</p>}
                  <p className="text-sm"><strong>Level:</strong> {userData.level_name}</p>
                  <p className="text-sm"><strong>Department:</strong> {userData.department_name}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Stats Cards - Role-based */}
        {isLecturer ? (
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Courses Teaching</CardTitle></CardHeader>
              <CardContent><p className="text-3xl font-bold">{userData.courses_teaching.length}</p></CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Total Students</CardTitle></CardHeader>
              <CardContent><p className="text-3xl font-bold">{userData.total_students}</p></CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Assignments Given</CardTitle></CardHeader>
              <CardContent><p className="text-3xl font-bold">{userData.assignments_given}</p></CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Submissions Received</CardTitle></CardHeader>
              <CardContent><p className="text-3xl font-bold">{userData.submissions_received}</p></CardContent>
            </Card>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">GPA</CardTitle></CardHeader>
              <CardContent><p className="text-3xl font-bold">{userData.gpa.toFixed(2)}/5.0</p></CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Attendance</CardTitle></CardHeader>
              <CardContent><p className="text-3xl font-bold">{userData.attendance_percentage}%</p></CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Quiz Avg</CardTitle></CardHeader>
              <CardContent><p className="text-3xl font-bold">{userData.quiz_avg.toFixed(1)}%</p></CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Courses</CardTitle></CardHeader>
              <CardContent><p className="text-3xl font-bold">{userData.courses.length}</p></CardContent>
            </Card>
          </div>
        )}

        {/* Courses Section */}
        <Card>
          <CardHeader><CardTitle>{isLecturer ? 'Courses Teaching' : 'Enrolled Courses'}</CardTitle></CardHeader>
          <CardContent>
            {(() => {
              const courseList = isLecturer ? userData.courses_teaching : userData.courses;
              return courseList.length > 0 ? (
                <div className="space-y-2">
                  {courseList.map((course) => (
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
                <p className="text-muted-foreground">No courses {isLecturer ? 'assigned' : 'enrolled'}</p>
              );
            })()}
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

        <AlertDialog open={showSuspend} onOpenChange={setShowSuspend}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Suspend Account?</AlertDialogTitle>
              <AlertDialogDescription>This will suspend {userData.full_name}'s account.</AlertDialogDescription>
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
              <AlertDialogDescription>This will permanently delete {userData.full_name}'s account. This cannot be undone.</AlertDialogDescription>
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
