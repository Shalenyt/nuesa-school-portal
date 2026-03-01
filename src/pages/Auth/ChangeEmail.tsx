import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useSchoolSettings } from '@/hooks/useSchoolSettings';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Loader2, ArrowLeft, Mail } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '@/components/Layout/DashboardLayout';

export default function ChangeEmail() {
  const [newEmail, setNewEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newEmail || newEmail === user?.email) {
      toast({
        title: "Invalid email",
        description: "Please enter a different email address.",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        email: newEmail,
      });

      if (error) throw error;

      toast({
        title: "Confirmation email sent",
        description: "Check your new email inbox to confirm the change.",
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
              Enter a new email below. You'll need to confirm it via a link sent to the new address.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
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
                Update Email
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
