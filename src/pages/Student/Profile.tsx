import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { User, Mail, Settings, Camera, BookOpen } from 'lucide-react';
import { DashboardLayout } from '@/components/Layout/DashboardLayout';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { PhotoUpload } from '@/components/Shared/PhotoUpload';

export default function StudentProfile() {
  const { profile, user } = useAuth();
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    phone: '',
    address: '',
    student_id: '',
    department_id: '',
    level_id: ''
  });
  const [courses, setCourses] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchClassesAndSubjects();
    if (profile) {
      setFormData({
        full_name: profile.full_name || '',
        email: user?.email || '',
        phone: profile.phone || '',
        address: profile.address || '',
        student_id: profile.student_id || '',
        department_id: profile.department_id || '',
        level_id: profile.level_id || ''
      });
      fetchCourses();
    }
  }, [profile, user]);

  const fetchClassesAndSubjects = async () => {
    try {
      const [classesData, subjectsData] = await Promise.all([
        supabase.from('classes').select('*').order('name'),
        supabase.from('subjects').select('*').order('name')
      ]);
      
      if (classesData.data) setClasses(classesData.data);
      if (subjectsData.data) setSubjects(subjectsData.data);
    } catch (error) {
      console.error('Error fetching classes and subjects:', error);
    }
  };

  const fetchCourses = async () => {
    try {
      // First check if student has department and level set
      if (!profile?.department_id || !profile?.level_id) {
        setCourses([]);
        return;
      }

      // Get courses from course lists based on student's department and level
      const { data: courseListData, error: courseListError } = await supabase
        .from('course_lists')
        .select('course_ids')
        .eq('class_id', profile.level_id)
        .eq('subject_id', profile.department_id)
        .maybeSingle();

      if (courseListError || !courseListData?.course_ids) {
        setCourses([]);
        return;
      }

      // Get course details
      const { data: coursesData, error: coursesError } = await supabase
        .from('courses')
        .select(`
          id,
          name,
          description,
          semester,
          credit_unit,
          subjects(name),
          classes(name),
          profiles(full_name)
        `)
        .in('id', courseListData.course_ids);

      if (coursesError) throw coursesError;
      setCourses(coursesData || []);

      // Auto-enroll student in these courses if not already enrolled
      await autoEnrollStudent(courseListData.course_ids);
    } catch (error) {
      console.error('Error fetching courses:', error);
    }
  };

  const autoEnrollStudent = async (courseIds: string[]) => {
    try {
      // Check which courses student is not enrolled in
      const { data: existingEnrollments } = await supabase
        .from('student_enrollments')
        .select('course_id')
        .eq('student_id', profile?.id);

      const enrolledCourseIds = existingEnrollments?.map(e => e.course_id) || [];
      const newCourseIds = courseIds.filter(id => !enrolledCourseIds.includes(id));

      if (newCourseIds.length > 0) {
        const enrollments = newCourseIds.map(courseId => ({
          student_id: profile?.id,
          course_id: courseId
        }));

        await supabase
          .from('student_enrollments')
          .insert(enrollments);
      }
    } catch (error) {
      console.error('Error auto-enrolling student:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: formData.full_name,
          phone: formData.phone,
          address: formData.address
        })
        .eq('id', profile?.id);

      if (error) throw error;

      toast({
        title: "Profile updated",
        description: "Your profile has been updated successfully.",
      });
      
      // Refetch courses after updating department/level
      await fetchCourses();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Student Profile</h1>
          <p className="text-muted-foreground">
            Manage your personal information and view enrolled courses
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Profile Picture
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <PhotoUpload 
                currentPhotoUrl={profile?.profile_photo_url || ''}
                onPhotoUpdated={(newUrl) => {
                  // Photo will be updated in the profile via PhotoUpload component
                }}
              />
            </CardContent>
          </Card>

          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Personal Information
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="full_name">Full Name</Label>
                    <Input
                      id="full_name"
                      value={formData.full_name}
                      onChange={(e) => handleInputChange('full_name', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="student_id">Student ID</Label>
                    <Input
                      id="student_id"
                      value={formData.student_id}
                      disabled
                      className="bg-muted"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      disabled
                      className="bg-muted"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone</Label>
                    <Input
                      id="phone"
                      value={formData.phone}
                      onChange={(e) => handleInputChange('phone', e.target.value)}
                    />
                  </div>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="level">Level</Label>
                    <Input
                      id="level"
                      value={classes.find(cls => cls.id === formData.level_id)?.name || 'Not set'}
                      disabled
                      className="bg-muted"
                    />
                    <p className="text-xs text-muted-foreground">
                      Level is set from your application and cannot be changed here.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="department">Department</Label>
                    <Input
                      id="department"
                      value={subjects.find(subject => subject.id === formData.department_id)?.name || 'Not set'}
                      disabled
                      className="bg-muted"
                    />
                    <p className="text-xs text-muted-foreground">
                      Department is set from your application and cannot be changed here.
                    </p>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="address">Address</Label>
                  <Input
                    id="address"
                    value={formData.address}
                    onChange={(e) => handleInputChange('address', e.target.value)}
                  />
                </div>
                <Button type="submit" disabled={loading}>
                  {loading ? 'Updating...' : 'Update Profile'}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5" />
              Enrolled Courses
            </CardTitle>
          </CardHeader>
          <CardContent>
            {courses.length > 0 ? (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {courses.map((course, index) => (
                  <div key={index} className="p-4 border rounded-lg">
                    <h3 className="font-semibold">{course.name}</h3>
                    <p className="text-sm text-muted-foreground">
                      {course.classes?.name} • {course.subjects?.name}
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Teacher: {course.profiles?.full_name}
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {course.semester} Semester • {course.credit_unit} units
                    </p>
                    {course.description && (
                      <p className="text-xs text-muted-foreground mt-2">{course.description}</p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-muted-foreground">
                  {!formData.department_id || !formData.level_id 
                    ? "Please select your department and level to see your courses." 
                    : "No courses available for your department and level yet."}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}