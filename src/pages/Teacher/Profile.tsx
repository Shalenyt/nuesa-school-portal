import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { User, Mail, Settings, Camera, BookOpen } from 'lucide-react';
import { PhotoUpload } from '@/components/Shared/PhotoUpload';
import { DashboardLayout } from '@/components/Layout/DashboardLayout';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

export default function TeacherProfile() {
  const { profile, user } = useAuth();
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    phone: '',
    address: '',
    staff_id: ''
  });
  const [courses, setCourses] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (profile) {
      setFormData({
        full_name: profile.full_name || '',
        email: user?.email || '',
        phone: profile.phone || '',
        address: profile.address || '',
        staff_id: profile.staff_id || ''
      });
      fetchCourses();
    }
  }, [profile, user]);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: formData.full_name,
          phone: formData.phone,
          address: formData.address,
          staff_id: formData.staff_id
        })
        .eq('id', profile?.id);

      if (error) throw error;

      toast({
        title: "Profile updated",
        description: "Your profile has been updated successfully.",
      });
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

  const handlePhotoUpdated = (newUrl: string) => {
    // Photo update is handled by the PhotoUpload component
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Teacher Profile</h1>
          <p className="text-muted-foreground">
            Manage your account information and view assigned courses
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
                currentPhotoUrl={profile?.profile_photo_url}
                onPhotoUpdated={handlePhotoUpdated}
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
                    <Label htmlFor="staff_id">Staff ID</Label>
                    <Input
                      id="staff_id"
                      value={formData.staff_id}
                      onChange={(e) => handleInputChange('staff_id', e.target.value)}
                      placeholder="Enter staff ID"
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
              Assigned Courses
            </CardTitle>
          </CardHeader>
          <CardContent>
            {courses.length > 0 ? (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {courses.map((course) => (
                  <div key={course.id} className="p-4 border rounded-lg">
                    <h3 className="font-semibold">{course.name}</h3>
                    <p className="text-sm text-muted-foreground">
                      {course.classes?.name} • {course.subjects?.name}
                    </p>
                    {course.description && (
                      <p className="text-sm mt-2">{course.description}</p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground">No courses assigned yet.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}