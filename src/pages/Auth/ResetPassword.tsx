import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useSchoolSettings } from '@/hooks/useSchoolSettings';
import { useThemeSync } from '@/hooks/useThemeSync';
import { Button } from '@/components/ui/button';
import { PasswordInput } from '@/components/ui/password-input';
import { Label } from '@/components/ui/label';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { BookOpen, Loader2, ArrowLeft, CheckCircle } from 'lucide-react';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { toast } from '@/hooks/use-toast';
import oaustechLogo from '@/assets/oaustech-logo.png';

export default function ResetPassword() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [sessionEstablished, setSessionEstablished] = useState(false);
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [user, setUser] = useState<any>(null);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { settings } = useSchoolSettings();
  
  // Initialize theme sync
  useThemeSync();

  // Check if we have the required tokens and establish session
  useEffect(() => {
    const establishSession = async () => {
      const accessToken = searchParams.get('access_token');
      const refreshToken = searchParams.get('refresh_token');
      const tokenHash = searchParams.get('token_hash');
      const type = searchParams.get('type');
      
      console.log('URL params:', { accessToken: !!accessToken, refreshToken: !!refreshToken, tokenHash: !!tokenHash, type });
      
      // Handle different types of reset links
      if (accessToken && refreshToken) {
        // Handle session tokens from email link
        try {
          const { data, error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          
          if (error) throw error;
          setSessionEstablished(true);
          setUser(data.user);
        } catch (error: any) {
          console.error('Session establishment failed:', error);
          toast({
            title: "Invalid reset link",
            description: "This password reset link is invalid or has expired. Please request a new one.",
            variant: "destructive"
          });
          navigate('/auth/forgot-password');
        }
      } else if (tokenHash && type === 'recovery') {
        // For recovery tokens, just validate the presence and set session as established
        // The actual token verification will happen during password update
        setSessionEstablished(true);
        // We'll verify the token when updating the password
      } else {
        // No valid parameters found
        toast({
          title: "Invalid reset link",
          description: "This password reset link is invalid or has expired. Please request a new one.",
          variant: "destructive"
        });
        navigate('/auth/forgot-password');
      }
    };

    establishSession();
  }, [searchParams, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!sessionEstablished) {
      toast({
        title: "Session not established",
        description: "Please use a valid password reset link.",
        variant: "destructive"
      });
      return;
    }
    
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

    // Check if user is trying to use the same password
    try {
      const { error: testError } = await supabase.auth.signInWithPassword({
        email: user?.email || '',
        password: password
      });
      
      if (!testError) {
        toast({
          title: "Invalid password",
          description: "You cannot use your current password. Please choose a different password.",
          variant: "destructive"
        });
        return;
      }
    } catch (error) {
      // This is expected if the password is different, continue with reset
    }

    setLoading(true);

    try {
      const tokenHash = searchParams.get('token_hash');
      const type = searchParams.get('type');
      
      if (tokenHash && type === 'recovery') {
        // Use verifyOtp for recovery tokens
        const { error } = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type: 'recovery',
        });
        
        if (error) throw error;
        
        // Now update the password
        const { error: updateError } = await supabase.auth.updateUser({
          password: password
        });
        
        if (updateError) throw updateError;
      } else {
        // For session-based resets, just update the password
        const { error } = await supabase.auth.updateUser({
          password: password
        });

        if (error) throw error;
      }

      // Show success popup
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
    // Sign out to ensure clean state and redirect to homepage
    await supabase.auth.signOut();
    navigate('/');
  };

  // Show loading state while establishing session
  if (!sessionEstablished) {
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
            <CardDescription>
              Enter your new password below
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password">New Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    placeholder="Enter your new password"
                    minLength={6}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <div className="relative">
                  <Input
                    id="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    placeholder="Confirm your new password"
                    minLength={6}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                </div>
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

      {/* Success Dialog */}
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