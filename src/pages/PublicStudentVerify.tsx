import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { CheckCircle2, ShieldAlert, ShieldCheck, User } from 'lucide-react';
import { resolveDisplayableImageUrl } from '@/lib/publicImage';
import nuesaLogo from '@/assets/oaustech-logo.png';

interface PublicStudent {
  full_name: string;
  matric_number: string | null;
  profile_photo_url: string | null;
  phone: string | null;
  department_name: string;
  faculty_name: string;
  level_name: string;
  institution_name: string;
  organization_name: string;
  logo_url: string | null;
  is_verified: boolean;
}

type State = 'loading' | 'found' | 'not-found' | 'error';

export default function PublicStudentVerify() {
  const { code } = useParams();
  const [state, setState] = useState<State>('loading');
  const [student, setStudent] = useState<PublicStudent | null>(null);
  const [photo, setPhoto] = useState<string | null>(null);

  useEffect(() => {
    document.title = 'NUESA Student Verification';
    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute('content', 'NUESA Portal ID verification.');
  }, []);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (!code) { setState('not-found'); return; }
      setState('loading');
      try {
        // Primary: dedicated public verification code
        let row: PublicStudent | null = null;
        const { data, error } = await supabase.rpc('verify_student_by_code', { p_code: code });
        if (error) throw error;
        if (data && data.length > 0) row = data[0] as PublicStudent;

        // The old lookup by matric number has been removed: matric numbers
        // are guessable, so anyone could list every student through it.

        if (cancelled) return;
        if (!row) { setState('not-found'); return; }

        setStudent(row);
        setState('found');
        // Photos are in a private bucket. A signed-in viewer can make the
        // link directly; someone scanning the QR code isn't signed in, so ask
        // the verify-student-photo function for a link to this one photo.
        let url: string | null = null;
        const { data: session } = await supabase.auth.getSession();
        if (session.session) {
          url = await resolveDisplayableImageUrl(row.profile_photo_url);
        } else {
          const { data: photoRes } = await supabase.functions.invoke('verify-student-photo', { body: { code } });
          url = photoRes?.url ?? null;
        }
        if (!cancelled) setPhoto(url);
      } catch (err) {
        console.error('Student verification failed');
        if (!cancelled) setState('error');
      }
    };

    load();
    return () => { cancelled = true; };
  }, [code]);

  const Shell = ({ children }: { children: React.ReactNode }) => (
    <main className="min-h-screen bg-muted/30 flex items-center justify-center p-4">
      <div className="w-full max-w-md">{children}</div>
    </main>
  );

  if (state === 'loading') {
    return (
      <Shell>
        <Card>
          <CardContent className="p-10 text-center space-y-3">
            <div className="h-10 w-10 mx-auto rounded-full border-2 border-primary border-t-transparent animate-spin" role="status" aria-label="Verifying" />
            <p className="text-muted-foreground">Verifying student…</p>
          </CardContent>
        </Card>
      </Shell>
    );
  }

  if (state === 'not-found' || state === 'error') {
    return (
      <Shell>
        <Card>
          <CardContent className="p-8 text-center space-y-3">
            <ShieldAlert className="h-12 w-12 mx-auto text-muted-foreground" aria-hidden="true" />
            <h1 className="text-xl font-bold">
              {state === 'error' ? 'Unable to verify student' : 'Student Not Found'}
            </h1>
            <p className="text-sm text-muted-foreground">
              {state === 'error'
                ? 'Please try again later.'
                : 'The verification link may be invalid, expired, or unavailable.'}
            </p>
          </CardContent>
        </Card>
      </Shell>
    );
  }

  const s = student!;
  const rows: Array<[string, string]> = [
    ['Matric NO', s.matric_number || 'N/A'],
    ['Department', s.department_name],
    ['Faculty', s.faculty_name],
    ['Level', s.level_name],
  ];

  return (
    <Shell>
      <Card className="overflow-hidden">
        <header className="bg-primary text-primary-foreground p-5 text-center space-y-2">
          <div className="flex items-center justify-center gap-3">
            <img
              src={s.logo_url || nuesaLogo}
              alt={`${s.organization_name} logo`}
              className="h-10 w-10 object-contain rounded-sm bg-background/10"
              loading="eager"
              width={40}
              height={40}
            />
            <div className="text-left">
              <p className="text-sm font-semibold uppercase tracking-wide">{s.organization_name} Portal</p>
              <p className="text-xs opacity-90">{s.institution_name}</p>
            </div>
          </div>
          <h1 className="text-base font-bold uppercase tracking-widest">{s.organization_name} Portal ID</h1>
        </header>

        <CardContent className="p-6 space-y-6">
          <div className="flex flex-col items-center text-center gap-3">
            <Avatar className="h-28 w-28 border-4 border-primary/15">
              <AvatarImage src={photo || undefined} alt={`Photo of ${s.full_name}`} />
              <AvatarFallback><User className="h-10 w-10" aria-hidden="true" /></AvatarFallback>
            </Avatar>
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Full Name</p>
              <p className="text-xl font-bold">{s.full_name}</p>
            </div>
          </div>

          <dl className="divide-y rounded-lg border">
            {rows.map(([label, value]) => (
              <div key={label} className="flex items-start justify-between gap-4 px-4 py-3">
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
                <dd className="text-sm font-medium text-right">{value}</dd>
              </div>
            ))}
          </dl>

          <div
            className={`flex items-center justify-center gap-2 rounded-lg border-2 px-4 py-3 ${
              s.is_verified
                ? 'border-primary bg-primary/5 text-primary'
                : 'border-destructive bg-destructive/5 text-destructive'
            }`}
            role="status"
          >
            {s.is_verified
              ? <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
              : <ShieldAlert className="h-5 w-5" aria-hidden="true" />}
            <span className="font-semibold">
              {s.is_verified ? 'Verified Student' : 'Verification Unavailable'}
            </span>
          </div>

          <p className="flex items-center justify-center gap-1 text-xs text-muted-foreground border-t pt-4">
            <ShieldCheck className="h-3 w-3" aria-hidden="true" />
            Verified by the {s.organization_name} Portal
          </p>
        </CardContent>
      </Card>
    </Shell>
  );
}
