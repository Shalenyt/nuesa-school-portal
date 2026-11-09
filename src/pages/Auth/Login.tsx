import { useEffect, useRef, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useSchoolSettings } from '@/hooks/useSchoolSettings';

import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { Label } from '@/components/ui/label';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { Fingerprint, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { logAudit } from '@/lib/audit';
import oaustechLogo from '@/assets/oaustech-logo.png';
import { savePendingOtp } from '@/lib/otpFlow';
import { markPasskeyOffer } from '@/components/PasskeyOffer';
import {
  PasskeyError,
  PreparedSignIn,
  conditionalPasskeysAvailable,
  isCancel,
  isFresh,
  passkeysSupported,
  prepareSignIn,
  signInWithPasskey,
} from '@/lib/passkeys';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [passkeyLoading, setPasskeyLoading] = useState(false);
  const { signIn } = useAuth();
  const { settings, ready } = useSchoolSettings();
  const navigate = useNavigate();
  const canPasskey = passkeysSupported();
  // A ready challenge for the button, so the prompt opens straight from the tap
  const buttonChallenge = useRef<PreparedSignIn | null>(null);
  const autofillAbort = useRef<AbortController | null>(null);

  const refreshButtonChallenge = async () => {
    try { buttonChallenge.current = await prepareSignIn(); } catch { buttonChallenge.current = null; }
  };

  // Send the signed in person to their dashboard, or explain why they can't enter yet
  const routeSignedIn = async (profile: any) => {
    if (!profile) {
      toast({ title: 'Sign in failed', description: 'We could not load your account. Please try again.', variant: 'destructive' });
      await supabase.auth.signOut();
      return false;
    }
    if (profile.status !== 'approved') {
      const rejected = profile.status === 'rejected';
      toast({
        title: rejected ? 'Account not approved' : 'Application pending approval',
        description: rejected
          ? 'Your account has not been approved or has been deactivated. Please contact the NUESA administration.'
          : "An administrator still needs to approve your account. We'll email you as soon as it's approved, then you can sign in.",
        variant: rejected ? 'destructive' : 'default',
      });
      await supabase.auth.signOut();
      return false;
    }
    switch (profile.role) {
      case 'admin': navigate('/admin/dashboard'); break;
      case 'teacher': navigate('/teacher/dashboard'); break;
      case 'student': navigate('/student/dashboard'); break;
      default: navigate('/');
    }
    return true;
  };

  const finishPasskeySignIn = async (userId: string) => {
    const { data: profile } = await supabase.from('profiles').select('*').eq('id', userId).single();
    if (profile) logAudit({ action: 'login', resourceType: 'session', resourceId: userId, resourceLabel: profile.full_name, description: 'Signed in with a passkey' });
    await routeSignedIn(profile);
  };

  const passkeyFailed = (e: any) => {
    if (isCancel(e)) return;
    const notFound = e?.code === 'webauthn_credential_not_found';
    const unconfirmed = e?.code === 'email_not_confirmed';
    toast({
      title: 'Passkey sign in failed',
      description: notFound
        ? 'That passkey is no longer linked to an account. Sign in with your password and add it again.'
        : unconfirmed
          ? 'Verify your email first: sign in with your password to get a code.'
          : 'Please try again or use your password.',
      variant: 'destructive',
    });
  };

  // Passkey suggestions in the email field (iPhone shows them above the keyboard)
  useEffect(() => {
    if (!canPasskey) return;
    let stopped = false;
    refreshButtonChallenge();
    const refresher = setInterval(refreshButtonChallenge, 4 * 60 * 1000);

    const startAutofill = async () => {
      if (stopped || !(await conditionalPasskeysAvailable())) return;
      try {
        const prepared = await prepareSignIn();
        if (stopped) return;
        const ctrl = new AbortController();
        autofillAbort.current = ctrl;
        let expired = false;
        const timer = setTimeout(() => { expired = true; ctrl.abort(); }, 4 * 60 * 1000);
        try {
          const userId = await signInWithPasskey(prepared, { mediation: 'conditional', signal: ctrl.signal });
          clearTimeout(timer);
          setPasskeyLoading(true);
          await finishPasskeySignIn(userId);
          setPasskeyLoading(false);
        } catch (e: any) {
          clearTimeout(timer);
          setPasskeyLoading(false);
          if (stopped || autofillAbort.current !== ctrl) return;
          // A passkey was picked but the server refused it: say so
          if (e instanceof PasskeyError && e.code !== 'cancelled') passkeyFailed(e);
          // Only listen again when the challenge simply ran out; any other
          // browser refusal would just fail again
          if (expired || (e as any)?.code === 'webauthn_challenge_expired') startAutofill();
        }
      } catch {
        /* passkeys unavailable right now */
      }
    };
    startAutofill();

    return () => {
      stopped = true;
      clearInterval(refresher);
      autofillAbort.current?.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handlePasskey = async () => {
    if (passkeyLoading) return;
    // Only one passkey prompt may be open at a time
    const pending = autofillAbort.current;
    autofillAbort.current = null;
    pending?.abort();
    setPasskeyLoading(true);
    try {
      const prepared = isFresh(buttonChallenge.current) ? buttonChallenge.current! : await prepareSignIn();
      buttonChallenge.current = null;
      const userId = await signInWithPasskey(prepared);
      await finishPasskeySignIn(userId);
    } catch (e) {
      passkeyFailed(e);
      refreshButtonChallenge();
    } finally {
      setPasskeyLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const result = await signIn(email, password);

    // Email never verified: send a fresh code and open the code screen
    if (result.error && result.error.message?.toLowerCase().includes('email not confirmed')) {
      const { error: resendError } = await supabase.auth.resend({ type: 'signup', email });
      const recentlySent = resendError && /rate|seconds/i.test(resendError.message);
      if (resendError && !recentlySent) {
        toast({ title: "Couldn't send a verification code", description: 'Please try again shortly.', variant: 'destructive' });
        setLoading(false);
        return;
      }
      savePendingOtp({ purpose: 'signup', email, back: '/auth/login' });
      setLoading(false);
      navigate('/auth/verify-code');
      return;
    }

    if (!result.error) {
      const approved = result.profile?.status === 'approved';
      // Offer to save a passkey once the dashboard opens
      if (approved && result.profile?.id) markPasskeyOffer(result.profile.id);
      await routeSignedIn(result.profile);
    }

    setLoading(false);
  };

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link to="/" className="flex flex-col items-center gap-2 no-underline hover:opacity-80 transition-opacity">
            <img 
              src={settings?.logo_url || oaustechLogo} 
              alt={`${settings?.school_name || 'NUESA'} Logo`} 
              className="h-28 w-28 sm:h-32 sm:w-32 object-contain" 
            />
            <h1 className="text-3xl font-black text-primary">
              {settings?.portal_name || 'NUESA Portal'}
            </h1>
          </Link>
          <p className="text-muted-foreground mt-2">Sign in to your account</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Welcome Back</CardTitle>
            <CardDescription>Enter your credentials to access your account</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="username webauthn"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="Enter your email"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <PasswordInput
                  id="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="Enter your password"
                />
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Sign In
              </Button>
            </form>

            {canPasskey && (
              <Button
                type="button"
                variant="outline"
                className="mt-3 w-full"
                onClick={handlePasskey}
                disabled={passkeyLoading || loading}
              >
                {passkeyLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Fingerprint className="mr-2 h-4 w-4" />}
                Sign in with passkey
              </Button>
            )}

            <div className="mt-6 text-center space-y-2">
              <Link 
                to="/auth/forgot-password" 
                className="text-sm text-primary hover:underline"
              >
                Forgot your password?
              </Link>
              
              <div className="text-sm text-muted-foreground">
                Don't have an account?{' '}
                <Link to="/auth/apply" className="text-primary hover:underline">
                  Apply here
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}