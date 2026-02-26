import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Shield, MapPin } from 'lucide-react';

interface QuizConsentModalProps {
  open: boolean;
  onConsent: (consent: boolean) => void;
  gpsRequired: boolean;
}

export function QuizConsentModal({ open, onConsent, gpsRequired }: QuizConsentModalProps) {
  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="max-w-md" onPointerDownOutside={e => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            Privacy & Data Collection Notice
          </DialogTitle>
          <DialogDescription>
            Please review the data collection notice before starting the quiz.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <p>This quiz may collect the following data for academic integrity purposes:</p>
          <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
            {gpsRequired && (
              <li className="flex items-center gap-1">
                <MapPin className="h-3 w-3 shrink-0" /> GPS location (latitude/longitude)
              </li>
            )}
            <li>Device information (browser, screen size)</li>
            <li>Tab-switching and focus-loss events</li>
          </ul>
          <p className="text-xs text-muted-foreground">
            You can delete your location history anytime from your Profile → Privacy Settings.
          </p>
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onConsent(false)}>
            Decline Location
          </Button>
          <Button onClick={() => onConsent(true)}>
            I Agree
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
