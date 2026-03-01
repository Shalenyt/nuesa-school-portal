import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Loader2, ArrowLeft, Mail, CheckCircle2, AlertTriangle } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/Layout/DashboardLayout';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';

export default function ChangeEmail() {
  const [newEmail, setNewEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [changedOldEmail, setChangedOldEmail] = useState('');
  const [changedNewEmail, setChangedNewEmail] = useState('');
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

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("You must be logged in to change your email.");

      const response = await supabase.functions.invoke('change-email', {
        body: { newEmail },
      });

      if (response.error) {
        throw new Error(response.error.message || "Failed to change email.");
      }

      const result = response.data;
      if (!result.success) {
        throw new Error(result.error || "Failed to change email.");
      }

      setChangedOldEmail(oldEmail);
      setChangedNewEmail(newEmail);
      setNewEmail('');
      setShowSuccess(true);
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

  const handleSuccessDismiss = async () => {
    setShowSuccess(false);
    await supabase.auth.signOut();
    navigate('/auth/login');
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
              Enter your new email below. Your email will be changed instantly — no confirmation link required.
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
                  ⚠️ This action is permanent. You will be logged out and must sign in with your new email.
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

      {/* Success Dialog */}
      <Dialog open={showSuccess} onOpenChange={(open) => { if (!open) handleSuccessDismiss(); }}>
        <DialogContent className="text-center sm:max-w-md">
          <DialogHeader className="items-center">
            <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
              <CheckCircle2 className="h-9 w-9 text-primary" />
            </div>
            <DialogTitle className="text-xl">Email Changed Successfully! 🎉</DialogTitle>
            <DialogDescription asChild>
              <div className="text-base pt-2 space-y-3">
                <p>Your email has been successfully changed.</p>
                <div className="rounded-lg border bg-muted/50 p-3 text-left space-y-1.5">
                  <p className="text-sm">
                    <span className="text-muted-foreground">Old email:</span>{' '}
                    <span className="font-semibold text-foreground line-through">{changedOldEmail}</span>
                  </p>
                  <p className="text-sm">
                    <span className="text-muted-foreground">New email:</span>{' '}
                    <span className="font-semibold text-foreground">{changedNewEmail}</span>
                  </p>
                </div>
                <p className="font-medium text-foreground">
                  You'll be logged out now. Next time, sign in with your shiny new email — the old one is officially retired! 😎
                </p>
              </div>
            </DialogDescription>
          </DialogHeader>
          <Button onClick={handleSuccessDismiss} className="w-full mt-4" size="lg">
            Got it, take me to Login
          </Button>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
