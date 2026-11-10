import type { ReactNode } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { SignedAvatarImage } from '@/components/Shared/UserAvatar';
import { Building2, CalendarDays, GraduationCap, IdCard, ScrollText, User, Vote } from 'lucide-react';

interface CandidatePreviewProps {
  candidate: any | null;
  positionName?: string;
  onClose: () => void;
  /** Show the matric number (admins only) */
  showMatric?: boolean;
  /** Buttons at the bottom, e.g. Vote or Approve */
  actions?: ReactNode;
  /** Small note under the name, e.g. "Your vote" */
  note?: ReactNode;
}

/** Everything about a candidate in a rounded popup that fills about half the screen. */
export function CandidatePreview({ candidate, positionName, onClose, showMatric, actions, note }: CandidatePreviewProps) {
  const p = candidate?.profiles || {};
  const applied = candidate?.created_at
    ? new Date(candidate.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
    : '';

  const Row = ({ icon: Icon, label, value }: { icon: any; label: string; value?: ReactNode }) =>
    value ? (
      <div className="flex items-start gap-3 py-2">
        <Icon className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="break-words text-sm font-medium">{value}</p>
        </div>
      </div>
    ) : null;

  return (
    <Dialog open={!!candidate} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[75vh] w-[calc(100%-2rem)] max-w-md overflow-y-auto rounded-3xl p-0 sm:rounded-3xl">
        {candidate && (
          <>
            <div className="flex flex-col items-center gap-3 rounded-t-3xl bg-gradient-to-b from-primary/15 to-transparent px-6 pb-4 pt-8 text-center">
              <Avatar className="h-24 w-24 ring-4 ring-background shadow-md">
                <SignedAvatarImage src={candidate.profile_pic || p.profile_photo_url} />
                <AvatarFallback className="text-2xl"><User className="h-10 w-10" /></AvatarFallback>
              </Avatar>
              <div>
                <DialogTitle className="text-xl font-bold leading-tight">{p.full_name || 'Candidate'}</DialogTitle>
                <DialogDescription className="mt-1">
                  {positionName ? `Candidate for ${positionName}` : 'Candidate'}
                </DialogDescription>
              </div>
              <div className="flex flex-wrap justify-center gap-2">
                {positionName && <Badge className="rounded-full"><Vote className="mr-1 h-3 w-3" />{positionName}</Badge>}
                <Badge variant={candidate.approved ? 'default' : 'secondary'} className="rounded-full">
                  {candidate.approved ? 'Approved candidate' : 'Awaiting approval'}
                </Badge>
              </div>
              {note}
            </div>

            <div className="space-y-4 px-6 pb-6">
              <div className="divide-y rounded-2xl border px-4">
                <Row icon={Building2} label="Department" value={p.subjects?.name} />
                <Row icon={GraduationCap} label="Level" value={p.classes?.name} />
                {showMatric && <Row icon={IdCard} label="Matric number" value={p.student_id} />}
                <Row icon={CalendarDays} label="Applied on" value={applied} />
              </div>

              <div className="rounded-2xl border p-4">
                <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
                  <ScrollText className="h-4 w-4 text-primary" /> Manifesto
                </div>
                <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-muted-foreground">
                  {candidate.manifesto?.trim() || 'This candidate has not written a manifesto.'}
                </p>
              </div>

              {actions && <div className="flex flex-col gap-2">{actions}</div>}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
