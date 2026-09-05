import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useSchoolSettings } from '@/hooks/useSchoolSettings';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { QRCodeSVG } from 'qrcode.react';
import { CheckCircle2, Copy, Download, ShieldAlert, User } from 'lucide-react';
import { studentVerifyUrl } from '@/lib/appUrl';
import { resolveDisplayableImageUrl } from '@/lib/publicImage';
import { toast } from '@/hooks/use-toast';
import nuesaLogo from '@/assets/oaustech-logo.png';

export function DigitalStudentID() {
  const { profile } = useAuth();
  const { settings } = useSchoolSettings();
  const [photo, setPhoto] = useState<string | null>(null);
  const [details, setDetails] = useState<{ department: string; level: string }>({ department: 'N/A', level: 'N/A' });
  const qrRef = useRef<HTMLDivElement>(null);

  const p: any = profile;

  useEffect(() => {
    let cancelled = false;
    resolveDisplayableImageUrl(p?.profile_photo_url).then((url) => {
      if (!cancelled) setPhoto(url);
    });
    return () => { cancelled = true; };
  }, [p?.profile_photo_url]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!p?.id) return;
      const { supabase } = await import('@/integrations/supabase/client');
      const { data } = await supabase
        .from('profiles')
        .select('subjects:department_id(name), classes:level_id(name)')
        .eq('id', p.id)
        .maybeSingle();
      if (!cancelled && data) {
        setDetails({
          department: (data as any).subjects?.name || 'N/A',
          level: (data as any).classes?.name || 'N/A',
        });
      }
    };
    load();
    return () => { cancelled = true; };
  }, [p?.id]);

  if (!profile) return null;

  const publicCode: string | undefined = p.public_student_id || undefined;
  const verifyUrl = publicCode ? studentVerifyUrl(publicCode) : null;
  const verified = profile.status === 'approved';

  const downloadQr = () => {
    const svg = qrRef.current?.querySelector('svg');
    if (!svg) return;
    const data = new XMLSerializer().serializeToString(svg);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 600; canvas.height = 600;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, 600, 600);
      ctx.drawImage(img, 0, 0, 600, 600);
      const a = document.createElement('a');
      a.href = canvas.toDataURL('image/png');
      a.download = `nuesa-id-${p.student_id || publicCode}.png`;
      a.click();
    };
    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(data)));
  };

  const copyLink = async () => {
    if (!verifyUrl) return;
    await navigator.clipboard.writeText(verifyUrl);
    toast({ title: 'Verification link copied' });
  };

  const rows: Array<[string, string]> = [
    ['Matric NO', p.student_id || 'N/A'],
    ['Department', details.department],
    ['Faculty', (settings as any)?.faculty_name || 'Engineering'],
    ['Level', details.level],
    ['Phone', p.phone || 'Not provided'],
  ];

  return (
    <Card className="max-w-sm mx-auto overflow-hidden">
      <div className="bg-primary text-primary-foreground p-4 text-center space-y-1">
        <div className="flex items-center justify-center gap-2">
          <img
            src={settings?.logo_url || nuesaLogo}
            alt={`${(settings as any)?.organization_name || 'NUESA'} logo`}
            className="h-9 w-9 object-contain"
            width={36}
            height={36}
          />
          <div className="text-left">
            <p className="text-sm font-semibold uppercase">{(settings as any)?.institution_name || 'University of Abuja'}</p>
            <p className="text-[11px] opacity-90">{(settings as any)?.organization_name || 'NUESA'}</p>
          </div>
        </div>
        <p className="text-xs font-bold uppercase tracking-widest">Digital Student ID</p>
      </div>

      <CardContent className="p-6 space-y-5">
        <div className="flex flex-col items-center text-center gap-2">
          <Avatar className="h-24 w-24 border-4 border-primary/15">
            <AvatarImage src={photo || undefined} alt={`Photo of ${profile.full_name}`} />
            <AvatarFallback><User className="h-8 w-8" aria-hidden="true" /></AvatarFallback>
          </Avatar>
          <p className="font-bold text-lg">{profile.full_name}</p>
        </div>

        <dl className="divide-y rounded-lg border">
          {rows.map(([label, value]) => (
            <div key={label} className="flex items-start justify-between gap-4 px-3 py-2">
              <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</dt>
              <dd className="text-sm font-medium text-right">{value}</dd>
            </div>
          ))}
        </dl>

        <div className={`flex items-center justify-center gap-2 rounded-lg border-2 px-3 py-2 ${
          verified ? 'border-primary bg-primary/5 text-primary' : 'border-destructive bg-destructive/5 text-destructive'
        }`} role="status">
          {verified ? <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> : <ShieldAlert className="h-4 w-4" aria-hidden="true" />}
          <span className="text-sm font-semibold">{verified ? 'Verified Student' : 'Verification Unavailable'}</span>
        </div>

        {verifyUrl ? (
          <div className="space-y-3">
            <div className="flex justify-center" ref={qrRef}>
              <QRCodeSVG value={verifyUrl} size={140} level="M" includeMargin />
            </div>
            <p className="text-center text-[10px] text-muted-foreground break-all">{verifyUrl}</p>
            <div className="flex gap-2 justify-center">
              <Button variant="outline" size="sm" onClick={downloadQr}>
                <Download className="h-4 w-4 mr-2" aria-hidden="true" /> Download QR
              </Button>
              <Button variant="outline" size="sm" onClick={copyLink}>
                <Copy className="h-4 w-4 mr-2" aria-hidden="true" /> Copy link
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-center text-xs text-muted-foreground">
            Your verification code is being prepared. Please refresh in a moment.
          </p>
        )}

        <p className="text-center text-[10px] text-muted-foreground">
          Scan the QR code to open this student's public verification page.
        </p>
      </CardContent>
    </Card>
  );
}
