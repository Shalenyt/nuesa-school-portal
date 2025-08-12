import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { 
  Users, 
  Search, 
  UserCheck, 
  UserX, 
  Shield, 
  ShieldOff,
  Crown 
} from 'lucide-react';
import { DashboardLayout } from '@/components/Layout/DashboardLayout';
import { useToast } from '@/hooks/use-toast';

interface Profile {
  id: string;
  full_name: string;
  email: string;
  role: string;
  status: string;
  student_id?: string;
  staff_id?: string;
  created_at: string;
}

export default function UserManagement() {
  const { toast } = useToast();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchProfiles();
  }, [filter]);

  const fetchProfiles = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (filter !== 'all') {
        if (filter === 'pending') {
          query = query.eq('status', 'pending');
        } else {
          query = query.eq('role', filter as any);
        }
      }

      const { data, error } = await query;

      if (error) throw error;
      setProfiles(data || []);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const updateUserStatus = async (userId: string, status: string) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ status: status as any })
        .eq('id', userId);

      if (error) throw error;

      toast({
        title: "User status updated",
        description: `User has been ${status}`,
      });

      fetchProfiles();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const promoteToAdmin = async (userId: string) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ role: 'admin' as any })
        .eq('id', userId);

      if (error) throw error;

      toast({
        title: "User promoted",
        description: "User has been promoted to admin",
      });

      fetchProfiles();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const demoteFromAdmin = async (userId: string) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ role: 'teacher' as any })
        .eq('id', userId);

      if (error) throw error;

      toast({
        title: "User demoted",
        description: "User has been demoted to teacher",
      });

      fetchProfiles();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'approved': return 'default';
      case 'pending': return 'secondary';
      case 'rejected': return 'destructive';
      case 'suspended': return 'outline';
      default: return 'secondary';
    }
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'admin': return 'default';
      case 'teacher': return 'secondary';
      case 'student': return 'outline';
      default: return 'secondary';
    }
  };

  const filteredProfiles = profiles.filter(profile =>
    profile.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    profile.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (profile.student_id && profile.student_id.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (profile.staff_id && profile.staff_id.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">User Management</h1>
          <p className="text-muted-foreground">
            Manage users, permissions, and access across the system
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search users..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Users</SelectItem>
              <SelectItem value="admin">Admins</SelectItem>
              <SelectItem value="teacher">Teachers</SelectItem>
              <SelectItem value="student">Students</SelectItem>
              <SelectItem value="pending">Pending Applications</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Users ({filteredProfiles.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">Loading users...</div>
            ) : filteredProfiles.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No users found
              </div>
            ) : (
              <div className="space-y-4">
                {filteredProfiles.map((profile) => (
                  <div
                    key={profile.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border rounded-lg space-y-2 sm:space-y-0"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium">{profile.full_name}</h3>
                        <Badge variant={getRoleBadgeVariant(profile.role)}>
                          {profile.role}
                        </Badge>
                        <Badge variant={getStatusBadgeVariant(profile.status)}>
                          {profile.status}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{profile.email}</p>
                      <div className="flex gap-2 text-xs text-muted-foreground">
                        {profile.student_id && (
                          <span>Student ID: {profile.student_id}</span>
                        )}
                        {profile.staff_id && (
                          <span>Staff ID: {profile.staff_id}</span>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex flex-wrap gap-2">
                      {profile.status === 'pending' && (
                        <>
                          <Button
                            size="sm"
                            onClick={() => updateUserStatus(profile.id, 'approved')}
                          >
                            <UserCheck className="h-4 w-4 mr-1" />
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => updateUserStatus(profile.id, 'rejected')}
                          >
                            <UserX className="h-4 w-4 mr-1" />
                            Reject
                          </Button>
                        </>
                      )}
                      
                      {profile.status === 'approved' && profile.role !== 'admin' && (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => updateUserStatus(profile.id, 'suspended')}
                          >
                            <Shield className="h-4 w-4 mr-1" />
                            Suspend
                          </Button>
                          {profile.role === 'teacher' && (
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => promoteToAdmin(profile.id)}
                            >
                              <Crown className="h-4 w-4 mr-1" />
                              Promote to Admin
                            </Button>
                          )}
                        </>
                      )}
                      
                      {profile.status === 'suspended' && (
                        <Button
                          size="sm"
                          onClick={() => updateUserStatus(profile.id, 'approved')}
                        >
                          <ShieldOff className="h-4 w-4 mr-1" />
                          Reactivate
                        </Button>
                      )}
                      
                      {profile.role === 'admin' && profile.id !== profile.id && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => demoteFromAdmin(profile.id)}
                        >
                          <ShieldOff className="h-4 w-4 mr-1" />
                          Demote from Admin
                        </Button>
                      )}
                    </div>
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