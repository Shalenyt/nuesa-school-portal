import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useSchoolSettings } from '@/hooks/useSchoolSettings';
import { useThemeSync } from '@/hooks/useThemeSync';
import { Button } from '@/components/ui/button';
import { PasswordInput } from '@/components/ui/password-input';
import { Label } from '@/components/ui/label';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Loader2, ArrowLeft, CheckCircle } from 'lucide-react';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { toast } from '@/hooks/use-toast';
import oaustechLogo from '@/assets/oaustech-logo.png';

export default function ResetPassword() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const navigate = useNavigate();
  const { settings } = useSchoolSettings();

  useThemeSync();

  useEffect(() => {
    // Listen for PASSWORD_RECOVERY event from hash-based redirect
    // This fires when the user clicks {{ .ConfirmationURL }} in the email,
    // which goes through Supabase's server to verify the token and redirect here
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('[ResetPassword] auth event:', event);
      if (event === 'PASSWORD_RECOVERY') {
        console.log('[ResetPassword] PASSWORD_RECOVERY event received, session ready');
        setSessionReady(true);
      }
      // Also handle if user arrives with a valid session from token exchange
      if (event === 'SIGNED_IN' && session) {
        // Check if we're on the reset password page with hash params
        const hash = window.location.hash;
        if (hash.includes('type=recovery')) {
          console.log('[ResetPassword] SIGNED_IN with recovery type, session ready');
          setSessionReady(true);
        }
      }
    });

    // Check if there's already a session (e.g., if the page was refreshed after token exchange)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        // Check URL hash for recovery type
        const hash = window.location.hash;
        if (hash.includes('type=recovery')) {
          setSessionReady(true);
        }
      }
    });

    // Timeout fallback — if no auth event fires within 8 seconds, redirect
    const timeout = setTimeout(() => {
      setSessionReady((prev) => {
        if (!prev) {
          toast({
            title: "Invalid reset link",
            description: "This password reset link is invalid or has expired. Please request a new one.",
            variant: "destructive"
          });
          navigate('/auth/forgot-password');
        }
        return prev;
      });
    }, 8000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      toast({
        title: "Passwords don't match",
        description: "Please make sure both passwords are identical.",
        variant: "destructive"
      });
      return;
    }

    if (password.length < 6) {
      toast({
        title: "Password too short",
        description: "Password must be at least 6 characters long.",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({ password });

      if (error) throw error;

      // Send password change notification email
      try {
        await supabase.functions.invoke('notify-password-change');
      } catch (emailErr) {
        console.error('Failed to send password change notification:', emailErr);
      }

      setShowSuccessDialog(true);
    } catch (error: any) {
      console.error('Password update error:', error);
      toast({
        title: "Password reset failed",
        description: error.message || "There was an error updating your password. Please try again.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSuccessOk = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };

  if (!sessionReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background relative p-4">
        <div className="absolute top-4 right-4">
          <ThemeToggle />
        </div>
        <div className="w-full max-w-md">
          <Card>
            <CardContent className="pt-6">
              <div className="text-center space-y-4">
                <Loader2 className="h-8 w-8 animate-spin mx-auto" />
                <p className="text-muted-foreground">Verifying reset link...</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background relative p-4">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>

      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <img
              src={settings?.logo_url || oaustechLogo}
              alt={`${settings?.school_name || 'NUESA'} Logo`}
              className="h-12 w-12 object-contain"
            />
            <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              {settings?.portal_name || 'NUESA Portal'}
            </h1>
          </div>
          <p className="text-muted-foreground mt-2">Create a new password</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Reset Password</CardTitle>
            <CardDescription>Enter your new password below</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password">New Password</Label>
                <PasswordInput
                  id="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="Enter your new password"
                  minLength={6}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <PasswordInput
                  id="confirmPassword"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  placeholder="Confirm your new password"
                  minLength={6}
                />
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Change Password
              </Button>
            </form>

            <div className="mt-6 text-center">
              <button
                onClick={() => navigate('/auth/login')}
                className="text-sm text-primary hover:underline flex items-center justify-center gap-1"
              >
                <ArrowLeft className="h-3 w-3" />
                Back to Sign In
              </button>
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={showSuccessDialog} onOpenChange={setShowSuccessDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center justify-center mb-4">
              <CheckCircle className="h-12 w-12 text-green-500" />
            </div>
            <DialogTitle className="text-center">Password Changed Successfully</DialogTitle>
            <DialogDescription className="text-center">
              Your password has been updated successfully. You can now sign in with your new password.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-center mt-6">
            <Button onClick={handleSuccessOk} className="w-full">
              Okay
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
