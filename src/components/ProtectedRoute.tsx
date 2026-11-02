import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  children: ReactNode;
  allowedRoles?: string[];
  requireApproved?: boolean;
}

export function ProtectedRoute({ 
  children, 
  allowedRoles = [], 
  requireApproved = true 
}: ProtectedRouteProps) {
  const { user, profile, loading, signOut } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth/login" replace />;
  }

  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold">Loading profile...</h2>
        </div>
      </div>
    );
  }

  if (requireApproved && profile.status !== 'approved') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-6">
          <h2 className="text-xl font-semibold mb-4">
            {profile.status === 'rejected' ? 'Account Not Approved' : 'Account Pending Approval'}
          </h2>
          <p className="text-muted-foreground mb-4">
            {profile.status === 'rejected'
              ? 'Your account has not been approved or has been deactivated. Please contact the NUESA administration.'
              : "An administrator still needs to approve your account. We'll email you as soon as it's approved."}
          </p>
          <p className="text-sm text-muted-foreground mb-6">
            Status: <span className="capitalize font-medium">{profile.status}</span>
          </p>
          {/* There was no way out of this screen before */}
          <button
            type="button"
            onClick={() => signOut()}
            className="inline-flex h-10 items-center justify-center rounded-md border px-4 text-sm font-medium hover:bg-muted"
          >
            Sign out
          </button>
        </div>
      </div>
    );
  }

  if (allowedRoles.length > 0 && !allowedRoles.includes(profile.role)) {
    // Send people to their own dashboard (there is no /unauthorized page,
    // so this used to show "404 page not found")
    const home = profile.role === 'admin' ? '/admin/dashboard'
      : profile.role === 'teacher' ? '/teacher/dashboard'
      : '/student/dashboard';
    return <Navigate to={home} replace />;
  }

  return <>{children}</>;
}