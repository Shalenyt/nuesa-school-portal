import { useAuth } from '@/hooks/useAuth';
import { useSchoolSettings } from '@/hooks/useSchoolSettings';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { QRCodeSVG } from 'qrcode.react';
import { User } from 'lucide-react';

export function DigitalStudentID() {
  const { profile } = useAuth();
  const { settings } = useSchoolSettings();

  if (!profile) return null;

  const qrData = JSON.stringify({
    id: profile.id,
    student_id: profile.student_id,
    name: profile.full_name,
    status: profile.status,
  });

  return (
    <Card className="max-w-sm mx-auto overflow-hidden">
      <div className="bg-primary p-4 text-center">
        <p className="text-primary-foreground font-bold text-lg">{settings?.school_name || 'School Portal'}</p>
        <p className="text-primary-foreground/80 text-xs">Student Identification Card</p>
      </div>
      <CardContent className="p-6 space-y-4">
        <div className="flex items-center gap-4">
          <Avatar className="h-20 w-20">
            <AvatarImage src={profile.profile_photo_url} />
            <AvatarFallback><User className="h-8 w-8" /></AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-lg truncate">{profile.full_name}</p>
            <p className="text-sm text-muted-foreground">{profile.student_id || 'N/A'}</p>
            <p className="text-xs text-muted-foreground">{profile.email}</p>
            <Badge variant={profile.status === 'approved' ? 'default' : 'destructive'} className="mt-1">
              {profile.status === 'approved' ? 'Active' : profile.status}
            </Badge>
          </div>
        </div>
        <div className="flex justify-center pt-2">
          <QRCodeSVG value={qrData} size={120} level="M" includeMargin />
        </div>
        <p className="text-center text-[10px] text-muted-foreground">Scan QR code to verify enrollment status</p>
      </CardContent>
    </Card>
  );
}
