import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useSchoolSettings } from '@/hooks/useSchoolSettings';
import { useThemeSync } from '@/hooks/useThemeSync';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { BookOpen, Loader2 } from 'lucide-react';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import oaustechLogo from '@/assets/oaustech-logo.png';
import { savePendingOtp } from '@/lib/otpFlow';

export default function Apply() {
  const [formData, setFormData] = useState({
    lastName: '',
    firstName: '',
    middleName: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: '',
    studentId: '',
    staffId: '',
    classId: '',
    subjectId: ''
  });
  const [loading, setLoading] = useState(false);
  const [classes, setClasses] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const { signUp } = useAuth();
  const { settings } = useSchoolSettings();
  const navigate = useNavigate();

  // Initialize theme sync
  useThemeSync();

  // Fetch classes and subjects on component mount
  useEffect(() => {
    fetchClassesAndSubjects();
  }, []);

  const fetchClassesAndSubjects = async () => {
    try {
      const [classesResponse, subjectsResponse] = await Promise.all([
        supabase.from('classes').select('*').order('name'),
        supabase.from('subjects').select('*').order('name')
      ]);

      if (classesResponse.data) {
        setClasses(classesResponse.data);
      }
      if (subjectsResponse.data) {
        setSubjects(subjectsResponse.data);
      }
    } catch (error) {
      console.error('Error fetching classes and subjects:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const stop = (title: string, description: string) => {
      toast({ title, description, variant: 'destructive' });
    };

    if (formData.password !== formData.confirmPassword) {
      stop('Passwords do not match', 'Type the same password in both boxes.');
      return;
    }

    if (!formData.role) {
      stop('Choose a role', 'Select whether you are a student or a lecturer.');
      return;
    }

    // Without these a student's account has no courses after approval
    if (formData.role === 'student' && (!formData.classId || !formData.subjectId)) {
      stop('Level and department needed', 'Select your level and department. You cannot change them yourself later.');
      return;
    }

    // One account per matric number, written the way it is on the ID card.
    // UTME students: 22/205CIE/123. Direct entry: 23D/205CHE/194 (letters after the year).
    const matric = formData.studentId.replace(/\s/g, '').toUpperCase();
    if (formData.role === 'student' && !/^\d{2}[A-Z]{0,3}\/\d{3}[A-Z]{3}\/\d{3,4}$/.test(matric)) {
      stop('Check your matric number', 'Type it exactly as on your ID card, for example 22/205CIE/123 or 23D/205CHE/194.');
      return;
    }

    setLoading(true);

    try {
      if (formData.role === 'student') {
        const { data: available } = await supabase.rpc('matric_available' as any, { p_student_id: matric });
        if (available === false) {
          stop('Matric number already registered', 'An account already uses this matric number. If it is yours, sign in or reset your password.');
          setLoading(false);
          return;
        }
      }

      const { error } = await signUp(formData.email.trim(), formData.password, {
        lastName: formData.lastName.trim(),
        firstName: formData.firstName.trim(),
        middleName: formData.middleName.trim(),
        fullName: [formData.lastName, formData.firstName, formData.middleName]
          .map((n) => n.trim())
          .filter(Boolean)
          .join(' '),
        role: formData.role,
        studentId: formData.role === 'student' ? matric : null,
        staffId: formData.role !== 'student' ? formData.staffId : null,
        classId: formData.role === 'student' ? formData.classId : null,
        subjectId: formData.role === 'student' ? formData.subjectId : null
      });
      if (!error) {
        // Code is on its way: open the code screen
        savePendingOtp({ purpose: 'signup', email: formData.email.trim(), back: '/auth/apply' });
        navigate('/auth/verify-code');
      }
    } catch (error) {
      console.error('Application error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background relative p-4">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <Link to="/" className="flex flex-col items-center justify-center gap-3 mb-4 no-underline hover:opacity-80 transition-opacity">
            <img 
              src={settings?.logo_url || oaustechLogo} 
              alt={`${settings?.school_name || 'NUESA'} Logo`} 
              className="h-28 w-28 sm:h-32 sm:w-32 object-contain" 
            />
            <h1 className="text-3xl font-black text-primary">
              {settings?.portal_name || 'NUESA Portal'}
            </h1>
          </Link>
          <p className="text-muted-foreground mt-2">Apply for access to the portal</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Application Form</CardTitle>
            <CardDescription>
              Fill out the form below to apply for access. Your application will be reviewed by an administrator.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="lastName">Last Name</Label>
                <Input
                  id="lastName"
                  value={formData.lastName}
                  onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                  required
                  placeholder="Enter your last name"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="firstName">First Name</Label>
                <Input
                  id="firstName"
                  value={formData.firstName}
                  onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                  required
                  placeholder="Enter your first name"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="middleName">Middle Name (optional)</Label>
                <Input
                  id="middleName"
                  value={formData.middleName}
                  onChange={(e) => setFormData({ ...formData, middleName: e.target.value })}
                  placeholder="Enter your middle name"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                  placeholder="Enter your email"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="role">Role</Label>
                <Select onValueChange={(value) => setFormData({ ...formData, role: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select your role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="student">Student</SelectItem>
                    <SelectItem value="teacher">Lecturer</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {formData.role === 'student' && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="studentId">Matric NO</Label>
                    <Input
                      id="studentId"
                      value={formData.studentId}
                      onChange={(e) => setFormData({ ...formData, studentId: e.target.value })}
                      required
                      placeholder="Enter your matric number"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="classId">Level</Label>
                    <Select onValueChange={(value) => setFormData({ ...formData, classId: value })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select your level" />
                      </SelectTrigger>
                      <SelectContent>
                        {classes.map((cls) => (
                          <SelectItem key={cls.id} value={cls.id}>
                            {cls.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="subjectId">Department</Label>
                    <Select onValueChange={(value) => setFormData({ ...formData, subjectId: value })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select your department" />
                      </SelectTrigger>
                      <SelectContent>
                        {subjects.map((subject) => (
                          <SelectItem key={subject.id} value={subject.id}>
                            {subject.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}

              {formData.role && formData.role !== 'student' && (
                <div className="space-y-2">
                  <Label htmlFor="staffId">Staff ID</Label>
                  <Input
                    id="staffId"
                    value={formData.staffId}
                    onChange={(e) => setFormData({ ...formData, staffId: e.target.value })}
                    required
                    placeholder="Enter your staff ID"
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <PasswordInput
                  id="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  required
                  placeholder="Create a password"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <PasswordInput
                  id="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                  required
                  placeholder="Confirm your password"
                />
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Submit Application
              </Button>
            </form>

            <div className="mt-6 text-center">
              <div className="text-sm text-muted-foreground">
                Already have an account?{' '}
                <Link to="/auth/login" className="text-primary hover:underline">
                  Sign in here
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}