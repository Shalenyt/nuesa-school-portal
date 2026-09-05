import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useSchoolSettings } from '@/hooks/useSchoolSettings';
import { useThemeSync } from '@/hooks/useThemeSync';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { BookOpen, Loader2, CheckCircle2, Mail, ShieldCheck } from 'lucide-react';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
} from '@/components/ui/alert-dialog';
import oaustechLogo from '@/assets/oaustech-logo.png';

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
  const [showSuccess, setShowSuccess] = useState(false);
  const [classes, setClasses] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [cooldown, setCooldown] = useState(0);
  const [resending, setResending] = useState(false);
  const { signUp } = useAuth();
  const { settings } = useSchoolSettings();

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const handleResend = async () => {
    if (cooldown > 0 || !formData.email) return;
    setResending(true);
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: formData.email,
      options: { emailRedirectTo: 'https://www.nuesa.org/auth/success' },
    });
    setResending(false);
    if (error) {
      toast({
        title: 'Could not resend',
        description: error.message.toLowerCase().includes('rate')
          ? 'Please wait a moment before requesting another email.'
          : "We couldn't resend the verification email right now. Please try again shortly.",
        variant: 'destructive',
      });
      return;
    }
    setCooldown(60);
    toast({ title: 'Verification email sent', description: `We sent a new link to ${formData.email}.` });
  };

  
  // Initialize theme sync
  useThemeSync();

  // Fetch classes and subjects on component mount
  useEffect(() => {
    fetchClassesAndSubjects();
  }, []);

  useEffect(() => {
    if (formData.role === 'student') {
      console.log('Student role selected, classes:', classes.length, 'subjects:', subjects.length);
    }
  }, [formData.role, classes, subjects]);

  const fetchClassesAndSubjects = async () => {
    try {
      console.log('Fetching classes and subjects...');
      
      const [classesResponse, subjectsResponse] = await Promise.all([
        supabase.from('classes').select('*').order('name'),
        supabase.from('subjects').select('*').order('name')
      ]);

      console.log('Classes response:', classesResponse);
      console.log('Subjects response:', subjectsResponse);

      if (classesResponse.data) {
        setClasses(classesResponse.data);
        console.log('Classes set:', classesResponse.data);
      }
      if (subjectsResponse.data) {
        setSubjects(subjectsResponse.data);
        console.log('Subjects set:', subjectsResponse.data);
      }
    } catch (error) {
      console.error('Error fetching classes and subjects:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (formData.password !== formData.confirmPassword) {
      alert('Passwords do not match');
      return;
    }

    if (!formData.role) {
      alert('Please select a role');
      return;
    }

    setLoading(true);

    try {
      const { error } = await signUp(formData.email, formData.password, {
        lastName: formData.lastName.trim(),
        firstName: formData.firstName.trim(),
        middleName: formData.middleName.trim(),
        fullName: [formData.lastName, formData.firstName, formData.middleName]
          .map((n) => n.trim())
          .filter(Boolean)
          .join(' '),
        role: formData.role,
        studentId: formData.role === 'student' ? formData.studentId : null,
        staffId: formData.role !== 'student' ? formData.staffId : null,
        classId: formData.role === 'student' ? formData.classId : null,
        subjectId: formData.role === 'student' ? formData.subjectId : null
      });
      if (!error) {
        setShowSuccess(true);
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
          <Link to="/" className="flex items-center justify-center gap-3 mb-4 no-underline hover:opacity-80 transition-opacity">
            <img 
              src={settings?.logo_url || oaustechLogo} 
              alt={`${settings?.school_name || 'NUESA'} Logo`} 
              className="h-12 w-12 object-contain" 
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
                    <SelectItem value="admin">Administrator</SelectItem>
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
      <AlertDialog open={showSuccess} onOpenChange={setShowSuccess}>
        <AlertDialogContent className="max-w-md text-center">
          <AlertDialogHeader className="flex flex-col items-center gap-3">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
              <CheckCircle2 className="h-9 w-9 text-primary" />
            </div>
            <AlertDialogTitle className="text-xl">Application Submitted!</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-4 text-sm text-muted-foreground">
                <p>Your application has been received successfully. Here's what happens next:</p>
                <div className="flex items-start gap-3 text-left">
                  <Mail className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                  <p>Check your email (<span className="font-medium text-foreground">{formData.email}</span>) for a verification link to confirm your account.</p>
                </div>
                <div className="flex items-start gap-3 text-left">
                  <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                  <p>After verifying your email, an administrator will review and approve your application. You'll be notified once approved.</p>
                </div>
                <div className="text-left text-xs">
                  Didn't get the email? Check your spam folder, or{' '}
                  <button
                    type="button"
                    onClick={handleResend}
                    disabled={cooldown > 0 || resending}
                    className="font-medium text-primary underline-offset-2 hover:underline disabled:opacity-60 disabled:no-underline"
                  >
                    {resending
                      ? 'sending…'
                      : cooldown > 0
                        ? `resend in ${cooldown}s`
                        : 'resend the verification link'}
                  </button>
                  .
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="sm:justify-center">
            <AlertDialogAction asChild>
              <Button onClick={() => window.location.href = '/auth/login'}>
                Go to Login
              </Button>
            </AlertDialogAction>
          </AlertDialogFooter>

        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}