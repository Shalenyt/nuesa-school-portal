import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { User, CheckCircle, XCircle, Clock, ShieldCheck } from 'lucide-react';
import { useSchoolSettings } from '@/hooks/useSchoolSettings';
import oaustechLogo from '@/assets/oaustech-logo.png';

export default function Verify() {
  const [searchParams] = useSearchParams();
  const [student, setStudent] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { settings } = useSchoolSettings();

  useEffect(() => {
    const id = searchParams.get('id');
    if (!id) {
      setError('No student ID provided');
      setLoading(false);
      return;
    }
    fetchStudent(id);
  }, [searchParams]);

  const fetchStudent = async (id: string) => {
    try {
      const { data, error: fetchError } = await supabase
        .from('profiles')
        .select('*, subjects:department_id(name, code), classes:level_id(name)')
        .eq('id', id)
        .eq('role', 'student')
        .maybeSingle();

      if (fetchError) throw fetchError;
      if (!data) {
        setError('Student not found');
        return;
      }
      setStudent(data);
    } catch (err: any) {
      setError(err.message || 'Failed to verify student');
    } finally {
      setLoading(false);
    }
  };

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'approved':
        return { label: 'Active', icon: CheckCircle, variant: 'default' as const, color: 'text-green-600' };
      case 'pending':
        return { label: 'Pending', icon: Clock, variant: 'secondary' as const, color: 'text-yellow-600' };
      case 'rejected':
        return { label: 'Inactive', icon: XCircle, variant: 'destructive' as const, color: 'text-red-600' };
      default:
        return { label: status, icon: Clock, variant: 'secondary' as const, color: 'text-muted-foreground' };
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Verifying student...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center space-y-4">
            <XCircle className="h-16 w-16 text-destructive mx-auto" />
            <h2 className="text-xl font-bold">Verification Failed</h2>
            <p className="text-muted-foreground">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const statusConfig = getStatusConfig(student.status);
  const StatusIcon = statusConfig.icon;

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="max-w-md w-full overflow-hidden">
        <div className="bg-primary p-4 text-center">
          <div className="flex items-center justify-center gap-2 mb-1">
            <img src={settings?.logo_url || oaustechLogo} alt="Logo" className="h-8 w-8" />
            <p className="text-primary-foreground font-bold text-lg">{settings?.school_name || 'OAUSTECH'}</p>
          </div>
          <p className="text-primary-foreground/80 text-xs">Student Verification</p>
        </div>
        <CardContent className="p-6 space-y-5">
          <div className="flex items-center justify-center">
            <div className={`flex items-center gap-2 px-4 py-2 rounded-full border-2 ${
              student.status === 'approved' ? 'border-green-500 bg-green-50 dark:bg-green-950' : 'border-destructive bg-destructive/10'
            }`}>
              <StatusIcon className={`h-5 w-5 ${statusConfig.color}`} />
              <span className={`font-semibold ${statusConfig.color}`}>
                Enrollment Status: {statusConfig.label}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <Avatar className="h-20 w-20">
              <AvatarImage src={student.profile_photo_url} />
              <AvatarFallback><User className="h-8 w-8" /></AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-lg">{student.full_name}</p>
              <p className="text-sm text-muted-foreground">{student.student_id || 'N/A'}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="space-y-1">
              <p className="text-muted-foreground text-xs">Department</p>
              <p className="font-medium">{(student as any).subjects?.name || 'N/A'}</p>
            </div>
            <div className="space-y-1">
              <p className="text-muted-foreground text-xs">Level</p>
              <p className="font-medium">{(student as any).classes?.name || 'N/A'}</p>
            </div>
            <div className="space-y-1">
              <p className="text-muted-foreground text-xs">Email</p>
              <p className="font-medium truncate">{student.email}</p>
            </div>
            <div className="space-y-1">
              <p className="text-muted-foreground text-xs">Verified At</p>
              <p className="font-medium">{new Date().toLocaleString()}</p>
            </div>
          </div>

          <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground pt-2 border-t">
            <ShieldCheck className="h-3 w-3" />
            <span>Verified by {settings?.portal_name || 'OAUSTECH Portal'}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
