import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Loader2, ArrowLeft, Mail, CheckCircle2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/Layout/DashboardLayout';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';

export default function ChangeEmail() {
  const [newEmail, setNewEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();

  // Detect email change confirmation redirect
  useEffect(() => {
    if (window.location.hash.includes('type=email_change')) {
      setShowSuccess(true);
    }
  }, []);

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

    // Basic email validation
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
    try {
      const { error } = await supabase.auth.updateUser({
        email: newEmail,
      }, {
        emailRedirectTo: 'https://nuesauofa.vercel.app/dashboard/change-email'
      });

      if (error) throw error;

      toast({
        title: "Confirmation email sent",
        description: "Check both your old and new email inboxes to confirm the change.",
      });
      setNewEmail('');
    } catch (error: any) {
      toast({
        title: "Failed to update email",
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
              Enter a new email below. Confirmation links will be sent to both your old and new email addresses.
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
            <AlertDialogTitle>Are you sure you want to change your email?</AlertDialogTitle>
            <AlertDialogDescription>
              A confirmation link will be sent to both <span className="font-medium">{user?.email}</span> and <span className="font-medium">{newEmail}</span>. You must confirm from both emails to complete the change.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirm}>Confirm</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Success Dialog */}
      <Dialog open={showSuccess} onOpenChange={setShowSuccess}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-primary" />
              Email Changed Successfully
            </DialogTitle>
            <DialogDescription>
              Your email address has been updated successfully. You can now use your new email to log in.
            </DialogDescription>
          </DialogHeader>
          <Button onClick={() => { setShowSuccess(false); navigate(-1); }} className="w-full mt-2">
            Continue
          </Button>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
