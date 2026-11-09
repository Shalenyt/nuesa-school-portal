import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Loader2, ArrowLeft, Mail, AlertTriangle } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/Layout/DashboardLayout';
import { savePendingOtp } from '@/lib/otpFlow';

export default function ChangeEmail() {
  const [newEmail, setNewEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!newEmail || newEmail === user?.email) {
      toast({
        title: "Invalid email",
        description: "Please enter a different email address.",
        variant: "destructive"
      });
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newEmail)) {
      toast({
        title: "Invalid email format",
        description: "Please enter a valid email address.",
        variant: "destructive"
      });
      return;
    }

    setShowConfirm(true);
  };

  const handleConfirm = async () => {
    setShowConfirm(false);
    setLoading(true);
    const oldEmail = user?.email || '';
    const target = newEmail.trim();

    try {
      // Supabase sends a 6-digit code to the new address (and to the current one
      // when secure email change is on). Nothing changes until the code is entered.
      const { error } = await supabase.auth.updateUser({ email: target });
      if (error) {
        const raw = error.message.toLowerCase();
        throw new Error(
          raw.includes('already') ? 'That email is already used by another account.'
          : raw.includes('rate') || raw.includes('seconds') ? 'Please wait a minute before trying again.'
          : error.message
        );
      }
      savePendingOtp({ purpose: 'email_change', email: target, oldEmail, back: '/dashboard/change-email' });
      navigate('/auth/verify-code');
    } catch (error: any) {
      toast({
        title: "Failed to change email",
        description: error.message || "Something went wrong. Please try again.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-md mx-auto py-8 px-4">
        <button
          onClick={() => navigate(-1)}
          className="text-sm text-primary hover:underline flex items-center gap-1 mb-6"
        >
          <ArrowLeft className="h-3 w-3" />
          Back
        </button>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Change Email
            </CardTitle>
            <CardDescription>
              Your current email is <span className="font-medium text-foreground">{user?.email}</span>.
              Enter your new email below. We'll send a 6-digit code to confirm the change.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="currentEmail">Current Email</Label>
                <Input
                  id="currentEmail"
                  type="email"
                  value={user?.email || ''}
                  disabled
                  className="bg-muted"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="newEmail">New Email Address</Label>
                <Input
                  id="newEmail"
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  required
                  placeholder="Enter your new email"
                />
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Change Email
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      {/* Confirmation Dialog */}
      <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10">
              <AlertTriangle className="h-7 w-7 text-destructive" />
            </div>
            <AlertDialogTitle className="text-center text-xl">Confirm Email Change</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="text-center space-y-3 pt-2">
                <p>Are you sure you want to change your email address?</p>
                <div className="rounded-lg border bg-muted/50 p-3 text-left space-y-1.5">
                  <p className="text-sm">
                    <span className="text-muted-foreground">From:</span>{' '}
                    <span className="font-semibold text-foreground">{user?.email}</span>
                  </p>
                  <p className="text-sm">
                    <span className="text-muted-foreground">To:</span>{' '}
                    <span className="font-semibold text-foreground">{newEmail}</span>
                  </p>
                </div>
                <p className="text-sm font-medium text-destructive">
                  You'll enter a code sent to your email, then sign in again with the new address.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="sm:justify-center gap-2 pt-2">
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirm} className="bg-destructive hover:bg-destructive/90">
              Yes, Change My Email
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </DashboardLayout>
  );
}
