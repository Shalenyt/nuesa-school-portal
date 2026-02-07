import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/Layout/DashboardLayout';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import { Check, X, Users, Filter, Trash2 } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';

interface Profile {
  id: string;
  full_name: string;
  email: string;
  role: 'admin' | 'teacher' | 'student';
  status: 'pending' | 'approved' | 'rejected';
  student_id?: string;
  staff_id?: string;
  created_at: string;
}

export default function ManageUsers() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');

  useEffect(() => {
    fetchProfiles();
  }, [filter]);

  const fetchProfiles = async () => {
    try {
      let query = supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (filter !== 'all') {
        query = query.eq('status', filter);
      }

      const { data, error } = await query;

      if (error) throw error;
      setProfiles(data || []);
    } catch (error) {
      console.error('Error fetching profiles:', error);
      toast({
        title: "Error",
        description: "Failed to fetch user profiles",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const updateUserStatus = async (userId: string, status: 'pending' | 'approved' | 'rejected') => {
    try {
      // Find the user to get their email and name for notification
      const user = profiles.find(p => p.id === userId);
      if (!user) throw new Error('User not found');

      const { error } = await supabase
        .from('profiles')
        .update({ status })
        .eq('id', userId);

      if (error) throw error;

      // Send notification email based on status
      if (status === 'approved' || status === 'rejected') {
        try {
          await supabase.functions.invoke('send-notification-email', {
            body: {
              to: user.email,
              name: user.full_name,
              type: status,
              role: user.role
            }
          });
          console.log(`${status} notification email sent to ${user.email}`);
        } catch (emailError) {
          console.error('Failed to send notification email:', emailError);
          // Don't fail the status update if email fails
        }
      }

      toast({
        title: "Success",
        description: `User ${status} successfully${status === 'approved' || status === 'rejected' ? ' and notification email sent' : ''}`,
      });

      fetchProfiles();
    } catch (error) {
      console.error('Error updating user status:', error);
      toast({
        title: "Error",
        description: "Failed to update user status",
        variant: "destructive"
      });
    }
  };

  const deleteUser = async (userId: string, userEmail: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('admin-delete-user', {
        body: { userId }
      });

      if (error) throw error;

      toast({
        title: "User deleted",
        description: `User ${userEmail} has been completely removed from the system`,
      });

      fetchProfiles();
    } catch (error) {
      console.error('Error deleting user:', error);
      toast({
        title: "Error",
        description: "Failed to delete user. Please try again.",
        variant: "destructive"
      });
    }
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'approved':
        return 'default';
      case 'pending':
        return 'secondary';
      case 'rejected':
        return 'destructive';
      default:
        return 'outline';
    }
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'admin':
        return 'destructive';
      case 'teacher':
        return 'default';
      case 'student':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Manage Users</h1>
            <p className="text-muted-foreground">
              Approve, reject, or manage user accounts
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4" />
            <Select value={filter} onValueChange={(value) => setFilter(value as typeof filter)}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Users</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              User Accounts ({profiles.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">Loading users...</div>
            ) : profiles.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No users found
              </div>
            ) : (
              <div className="space-y-4">
                {profiles.map((profile) => (
                  <div key={profile.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-medium">{profile.full_name}</h3>
                        <Badge variant={getRoleBadgeVariant(profile.role)}>
                          {profile.role}
                        </Badge>
                        <Badge variant={getStatusBadgeVariant(profile.status)}>
                          {profile.status}
                        </Badge>
                      </div>
                      
                      <div className="text-sm text-muted-foreground space-y-1">
                        <p>Email: {profile.email}</p>
                        {profile.student_id && <p>Student ID: {profile.student_id}</p>}
                        {profile.staff_id && <p>Staff ID: {profile.staff_id}</p>}
                        <p>Applied: {new Date(profile.created_at).toLocaleDateString()}</p>
                      </div>
                    </div>

                    {profile.status === 'pending' && (
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => updateUserStatus(profile.id, 'approved')}
                          className="bg-green-600 hover:bg-green-700"
                        >
                          <Check className="h-4 w-4 mr-1" />
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => updateUserStatus(profile.id, 'rejected')}
                        >
                          <X className="h-4 w-4 mr-1" />
                          Reject
                        </Button>
                      </div>
                    )}

                    {profile.status === 'approved' && (
                      <div className="flex gap-2">
                         <Button
                           size="sm"
                           variant="outline"
                           onClick={async () => {
                             try {
                               await supabase.functions.invoke('send-notification-email', {
                                 body: {
                                   to: profile.email,
                                   name: profile.full_name,
                                   type: 'suspended',
                                   role: profile.role
                                 }
                               });
                               updateUserStatus(profile.id, 'rejected');
                             } catch (error) {
                               console.error('Failed to send suspension email:', error);
                               updateUserStatus(profile.id, 'rejected'); // Still deactivate even if email fails
                             }
                           }}
                         >
                           <X className="h-4 w-4 mr-1" />
                           Deactivate
                         </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button size="sm" variant="destructive">
                              <Trash2 className="h-4 w-4 mr-1" />
                              Delete
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete User Permanently</AlertDialogTitle>
                              <AlertDialogDescription>
                                This will permanently delete <strong>{profile.full_name}</strong> ({profile.email}) from the entire system. 
                                This action cannot be undone and will free up their email and IDs for reuse.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction 
                                onClick={() => deleteUser(profile.id, profile.email)}
                                className="bg-red-600 hover:bg-red-700"
                              >
                                Delete Permanently
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    )}

                    {profile.status === 'rejected' && (
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => updateUserStatus(profile.id, 'approved')}
                        >
                          <Check className="h-4 w-4 mr-1" />
                          Reactivate
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button size="sm" variant="destructive">
                              <Trash2 className="h-4 w-4 mr-1" />
                              Delete
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete User Permanently</AlertDialogTitle>
                              <AlertDialogDescription>
                                This will permanently delete <strong>{profile.full_name}</strong> ({profile.email}) from the entire system. 
                                This action cannot be undone and will free up their email and IDs for reuse.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction 
                                onClick={() => deleteUser(profile.id, profile.email)}
                                className="bg-red-600 hover:bg-red-700"
                              >
                                Delete Permanently
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}