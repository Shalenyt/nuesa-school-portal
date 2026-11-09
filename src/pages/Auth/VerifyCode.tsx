import { useContext, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { OTPInput, OTPInputContext, REGEXP_ONLY_DIGITS } from 'input-otp';
import { ArrowLeft, CheckCircle2, ClipboardPaste, Loader2, Mail, ShieldCheck } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useSchoolSettings } from '@/hooks/useSchoolSettings';
import { useThemeSync } from '@/hooks/useThemeSync';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
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
import { recordAccountSignal } from '@/lib/accountSignals';

type Status = 'idle' | 'verifying' | 'error' | 'success';

const secondsLeft = (sentAt: number) =>
  Math.max(0, RESEND_SECONDS - Math.floor((Date.now() - sentAt) / 1000));

// One code box. The digit pops in when typed or autofilled.
function CodeSlot({ index, status }: { index: number; status: Status }) {
  const ctx = useContext(OTPInputContext);
  const { char, hasFakeCaret, isActive } = ctx.slots[index];
  return (
    <div
      className={cn(
        'relative flex h-11 w-10 items-center justify-center rounded-lg border border-input bg-background text-lg font-semibold transition-all duration-200 sm:h-12 sm:w-11 sm:text-xl',
        char && 'border-primary/50 bg-primary/[0.03]',
        isActive && status === 'idle' && 'border-primary ring-2 ring-primary/20',
        status === 'verifying' && 'animate-pulse border-primary/40',
        status === 'error' && 'border-destructive bg-destructive/5 text-destructive'
      )}
    >
      {char && (
        <span
          key={char}
          className="animate-[otp-pop_0.22s_ease-out_both]"
          style={{ animationDelay: `${index * 25}ms` }}
        >
          {char}
        </span>
      )}
      {hasFakeCaret && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="h-5 w-[1.5px] rounded-full bg-primary animate-[otp-caret-blink_1s_step-end_infinite]" />
        </div>
      )}
    </div>
  );
}

function SuccessCheck() {
  return (
    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-600 shadow-lg shadow-green-600/25 animate-[otp-check-pop_0.4s_cubic-bezier(0.2,1.3,0.4,1)_both]">
      <svg viewBox="0 0 24 24" className="h-9 w-9" fill="none" stroke="white" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
        <path
          d="M5 12.5l4.5 4.5L19 7.5"
          style={{ strokeDasharray: 24, strokeDashoffset: 24, animation: 'otp-check-draw 0.35s 0.25s ease-out forwards' }}
        />
      </svg>
    </div>
  );
}

export default function VerifyCode() {
  const navigate = useNavigate();
  const { settings } = useSchoolSettings();
  useThemeSync();

  const [pending] = useState<PendingOtp | null>(() => loadPendingOtp());
  const [code, setCode] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [errorText, setErrorText] = useState('');
  const [resending, setResending] = useState(false);
  const [left, setLeft] = useState(() => (pending ? secondsLeft(pending.sentAt) : 0));
  const [done, setDone] = useState<null | 'signup' | 'email_change'>(null);
  const [shake, setShake] = useState(false);
  const sentAtRef = useRef(pending?.sentAt ?? 0);
  const inputRef = useRef<HTMLInputElement>(null);
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
    setErrorText(raw.includes('rate') || raw.includes('too many') ? 'Too many attempts. Try again shortly.' : 'Incorrect OTP');
    setStatus('error');
    setShake(true);
    setTimeout(() => setShake(false), 500);
    setTimeout(() => {
      setCode('');
      inputRef.current?.focus();
    }, 700);
  };

  // Show the check, then move on
  const succeed = (next: () => void) => {
    setStatus('success');
    setTimeout(next, 1200);
  };

  const verify = async (token: string) => {
    if (status === 'verifying' || status === 'success' || token.length !== 6) return;
    setStatus('verifying');
    setErrorText('');

    if (pending.purpose === 'signup') {
      const { error } = await supabase.auth.verifyOtp({ email: pending.email, token, type: 'signup' });
      if (error) return fail(error.message);
      // Email confirmed. Note this device for duplicate checks, then sign out:
      // the account still waits for an admin.
      await recordAccountSignal('sign_up');
      await supabase.auth.signOut();
      clearPendingOtp();
      return succeed(() => setDone('signup'));
    }

    if (pending.purpose === 'recovery') {
      const { data, error } = await supabase.auth.verifyOtp({ email: pending.email, token, type: 'recovery' });
      if (error || !data.user) return fail(error?.message);
      markRecoveryVerified(data.user.id);
      clearPendingOtp();
      return succeed(() => navigate('/auth/reset-password', { replace: true }));
    }

    // Email change: the code may belong to the new or the current address
    const tryVerify = async (email: string) =>
      (await supabase.auth.verifyOtp({ email, token, type: 'email_change' })).error;

    let err: { message: string } | null = verifiedRef.current.newDone ? { message: 'skip' } : await tryVerify(pending.email);
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
      return succeed(() => setDone('email_change'));
    }
    // First of two codes accepted: clear the boxes for the code sent to the other address
    setStatus('success');
    setTimeout(() => {
      setStatus('idle');
      setCode('');
      inputRef.current?.focus();
    }, 1200);
  };

  // One tap paste for codes copied from Gmail (iPhone only suggests codes from Apple Mail)
  const canPaste = typeof navigator !== 'undefined' && !!navigator.clipboard?.readText;
  const pasteCode = async () => {
    try {
      const text = await navigator.clipboard.readText();
      const digits = (text.match(/\d{6}/) || [])[0];
      if (!digits) {
        toast({ title: 'No 6-digit code copied', description: 'Copy the code from the email, then tap paste.' });
        return;
      }
      setStatus('idle');
      setErrorText('');
      setCode(digits);
      verify(digits);
    } catch {
      /* paste refused */
    }
  };

  const onChange = (value: string) => {
    if (status === 'error') {
      setStatus('idle');
      setErrorText('');
    }
    setCode(value);
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
    setStatus('idle');
    setErrorText('');
    inputRef.current?.focus();
  };

  const finish = async () => {
    if (done === 'email_change') await supabase.auth.signOut();
    navigate('/auth/login', { replace: true });
  };

  const mm = Math.floor(left / 60);
  const ss = String(left % 60).padStart(2, '0');

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
          className="h-32 w-32 sm:h-36 sm:w-36 object-contain"
        />

        <div className="flex h-16 items-center justify-center">
          {status === 'success' ? (
            <SuccessCheck />
          ) : (
            <div className={shake ? 'animate-[otp-shake_0.45s_ease-in-out]' : ''}>
              <OTPInput
                ref={inputRef}
                maxLength={6}
                value={code}
                onChange={onChange}
                onComplete={verify}
                pattern={REGEXP_ONLY_DIGITS}
                inputMode="numeric"
                autoComplete="one-time-code"
                autoFocus
                disabled={status === 'verifying'}
                aria-label="Verification code"
                containerClassName="flex items-center gap-1.5 sm:gap-2"
              >
                {[0, 1, 2, 3, 4, 5].map((i) => (
                  <CodeSlot key={i} index={i} status={status} />
                ))}
              </OTPInput>
            </div>
          )}
        </div>

        <div className="flex h-12 flex-col items-center justify-start gap-1">
          {status === 'error' && errorText ? (
            <span className="text-sm font-medium text-destructive">{errorText}</span>
          ) : status === 'verifying' ? (
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          ) : status === 'success' ? null : left > 0 ? (
            <div className="flex items-center gap-3">
              <span className="font-mono text-sm tabular-nums text-muted-foreground">
                {mm}:{ss}
              </span>
              {canPaste && (
                <button
                  type="button"
                  aria-label="Paste code"
                  onClick={pasteCode}
                  className="rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <ClipboardPaste className="h-4 w-4" />
                </button>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="sm" onClick={resend} disabled={resending} className="text-primary">
                {resending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Resend code
              </Button>
              {canPaste && (
                <button
                  type="button"
                  aria-label="Paste code"
                  onClick={pasteCode}
                  className="rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <ClipboardPaste className="h-4 w-4" />
                </button>
              )}
            </div>
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
