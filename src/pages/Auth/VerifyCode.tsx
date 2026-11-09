import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { REGEXP_ONLY_DIGITS } from 'input-otp';
import { ArrowLeft, CheckCircle2, Loader2, Mail, ShieldCheck } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useSchoolSettings } from '@/hooks/useSchoolSettings';
import { useThemeSync } from '@/hooks/useThemeSync';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { toast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  PendingOtp,
  RESEND_SECONDS,
  clearPendingOtp,
  loadPendingOtp,
  markRecoveryVerified,
  touchPendingOtp,
} from '@/lib/otpFlow';
import oaustechLogo from '@/assets/oaustech-logo.png';

const secondsLeft = (sentAt: number) =>
  Math.max(0, RESEND_SECONDS - Math.floor((Date.now() - sentAt) / 1000));

export default function VerifyCode() {
  const navigate = useNavigate();
  const { settings } = useSchoolSettings();
  useThemeSync();

  const [pending] = useState<PendingOtp | null>(() => loadPendingOtp());
  const [code, setCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [left, setLeft] = useState(() => (pending ? secondsLeft(pending.sentAt) : 0));
  const [done, setDone] = useState<null | 'signup' | 'email_change'>(null);
  const [shake, setShake] = useState(false);
  const sentAtRef = useRef(pending?.sentAt ?? 0);
  // Email change with secure change on: both addresses get a code
  const verifiedRef = useRef<{ newDone: boolean; oldDone: boolean }>({ newDone: false, oldDone: false });

  useEffect(() => {
    if (!pending) navigate('/auth/login', { replace: true });
  }, [pending, navigate]);

  useEffect(() => {
    const t = setInterval(() => setLeft(secondsLeft(sentAtRef.current)), 1000);
    return () => clearInterval(t);
  }, []);

  if (!pending) return null;

  const fail = (message?: string) => {
    const raw = (message || '').toLowerCase();
    toast({
      title: raw.includes('rate') || raw.includes('too many')
        ? 'Too many attempts. Wait a few minutes and try again.'
        : 'Incorrect or expired code',
      variant: 'destructive',
    });
    setShake(true);
    setTimeout(() => setShake(false), 450);
    setCode('');
  };

  const verify = async (token: string) => {
    if (verifying || token.length !== 6) return;
    setVerifying(true);
    try {
      if (pending.purpose === 'signup') {
        const { error } = await supabase.auth.verifyOtp({ email: pending.email, token, type: 'signup' });
        if (error) return fail(error.message);
        // Email confirmed. The account still waits for an admin, so no session is kept.
        await supabase.auth.signOut();
        clearPendingOtp();
        setDone('signup');
        return;
      }

      if (pending.purpose === 'recovery') {
        const { data, error } = await supabase.auth.verifyOtp({ email: pending.email, token, type: 'recovery' });
        if (error || !data.user) return fail(error?.message);
        markRecoveryVerified(data.user.id);
        clearPendingOtp();
        navigate('/auth/reset-password', { replace: true });
        return;
      }

      // Email change: the code may belong to the new or the current address
      const tryVerify = async (email: string) =>
        (await supabase.auth.verifyOtp({ email, token, type: 'email_change' })).error;

      let err = verifiedRef.current.newDone ? new Error('skip') : await tryVerify(pending.email);
      if (!err) verifiedRef.current.newDone = true;
      else if (pending.oldEmail && !verifiedRef.current.oldDone) {
        const err2 = await tryVerify(pending.oldEmail);
        if (!err2) { verifiedRef.current.oldDone = true; err = null; }
        else err = err2;
      }
      if (err) return fail(err.message);

      const { data: fresh } = await supabase.auth.getUser();
      if (fresh.user?.email?.toLowerCase() === pending.email.toLowerCase()) {
        // Tell both addresses about the change (server checks it really happened)
        await supabase.functions.invoke('change-email', { body: {} }).catch(() => undefined);
        clearPendingOtp();
        setDone('email_change');
      } else {
        // First of two codes accepted, wait for the code sent to the other address
        setCode('');
      }
    } finally {
      setVerifying(false);
    }
  };

  const resend = async () => {
    if (left > 0 || resending) return;
    setResending(true);
    let error: { message: string } | null = null;
    if (pending.purpose === 'signup') {
      ({ error } = await supabase.auth.resend({ type: 'signup', email: pending.email }));
    } else if (pending.purpose === 'recovery') {
      ({ error } = await supabase.auth.resetPasswordForEmail(pending.email));
    } else {
      ({ error } = await supabase.auth.resend({ type: 'email_change', email: pending.email }));
    }
    setResending(false);
    if (error) {
      const raw = error.message.toLowerCase();
      toast({
        title: raw.includes('rate') || raw.includes('seconds')
          ? 'Please wait a little before requesting another code.'
          : "Couldn't send a new code. Try again shortly.",
        variant: 'destructive',
      });
      return;
    }
    touchPendingOtp();
    sentAtRef.current = Date.now();
    setLeft(RESEND_SECONDS);
    setCode('');
  };

  const finish = async () => {
    if (done === 'email_change') await supabase.auth.signOut();
    navigate('/auth/login', { replace: true });
  };

  const mm = Math.floor(left / 60);
  const ss = String(left % 60).padStart(2, '0');
  const slot = 'h-12 w-11 text-xl font-semibold sm:h-14 sm:w-12 sm:text-2xl';

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-background p-4">
      <button
        type="button"
        aria-label="Back"
        onClick={() => navigate(pending.back || '/auth/login')}
        className="absolute left-4 top-4 rounded-full p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <ArrowLeft className="h-5 w-5" />
      </button>
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>

      <div className="flex w-full max-w-sm flex-col items-center gap-8">
        <img
          src={settings?.logo_url || oaustechLogo}
          alt={`${settings?.school_name || 'NUESA'} Logo`}
          className="h-16 w-16 object-contain"
        />

        <div className={shake ? 'animate-[otp-shake_0.45s_ease-in-out]' : ''}>
          <InputOTP
            maxLength={6}
            value={code}
            onChange={setCode}
            onComplete={verify}
            pattern={REGEXP_ONLY_DIGITS}
            inputMode="numeric"
            autoComplete="one-time-code"
            autoFocus
            disabled={verifying}
            aria-label="Verification code"
            containerClassName="gap-3"
          >
            <InputOTPGroup>
              <InputOTPSlot index={0} className={slot} />
              <InputOTPSlot index={1} className={slot} />
              <InputOTPSlot index={2} className={slot} />
            </InputOTPGroup>
            <span aria-hidden className="text-2xl font-light text-muted-foreground">-</span>
            <InputOTPGroup>
              <InputOTPSlot index={3} className={slot} />
              <InputOTPSlot index={4} className={slot} />
              <InputOTPSlot index={5} className={slot} />
            </InputOTPGroup>
          </InputOTP>
        </div>

        <div className="flex h-9 items-center justify-center">
          {verifying ? (
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          ) : left > 0 ? (
            <span className="font-mono text-sm tabular-nums text-muted-foreground">
              {mm}:{ss}
            </span>
          ) : (
            <Button variant="ghost" size="sm" onClick={resend} disabled={resending} className="text-primary">
              {resending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Resend code
            </Button>
          )}
        </div>
      </div>

      <AlertDialog open={done !== null}>
        <AlertDialogContent className="max-w-md text-center">
          <AlertDialogHeader className="flex flex-col items-center gap-3">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
              <CheckCircle2 className="h-9 w-9 text-primary" />
            </div>
            <AlertDialogTitle className="text-xl">
              {done === 'signup' ? 'Application Submitted!' : 'Email Changed'}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              {done === 'signup' ? (
                <div className="space-y-4 text-sm text-muted-foreground">
                  <div className="flex items-start gap-3 text-left">
                    <Mail className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                    <p>Your email has been verified.</p>
                  </div>
                  <div className="flex items-start gap-3 text-left">
                    <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                    <p>An administrator will now review your application. We'll email you once it's approved, then you can sign in.</p>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Your email is now <span className="font-medium text-foreground">{pending.email}</span>. Sign in with it from now on.
                </p>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="sm:justify-center">
            <AlertDialogAction asChild>
              <Button onClick={finish}>Go to Login</Button>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
