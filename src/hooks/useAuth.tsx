import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: any | null;
  loading: boolean;
  signUp: (email: string, password: string, userData: any) => Promise<{ error: any }>;
  signIn: (email: string, password: string) => Promise<{ error: any; profile: any }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: any }>;
  refetchProfile: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          // Fetch user profile
          setTimeout(async () => {
            const { data: profile, error } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', session.user.id)
              .single();
            
            if (!error) {
              setProfile(profile);
            }
          }, 0);
        } else {
          setProfile(null);
        }
        setLoading(false);
      }
    );

    // Check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (email: string, password: string, userData: any) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: 'https://www.nuesa.org/auth/success',
        data: {
          full_name: userData.fullName,
          role: userData.role,
          student_id: userData.studentId,
          staff_id: userData.staffId,
          classId: userData.classId,
          subjectId: userData.subjectId
        }
      }
    });

    if (error) {
      console.error('[Auth] Sign up error:', error.message, error.status);
      const raw = error.message.toLowerCase();
      let description = error.message;

      if (raw.includes('confirmation email') || raw.includes('sending email') || raw.includes('smtp')) {
        description =
          "We couldn't send your verification email right now, so your account was not created. Please try again shortly or contact the NUESA Portal Engineering Team.";
      } else if (raw.includes('already registered') || raw.includes('already been registered')) {
        description = 'An account with this email already exists. Try signing in or resetting your password.';
      } else if (raw.includes('rate limit') || error.status === 429) {
        description = 'Too many attempts. Please wait a few minutes before trying again.';
      } else if (raw.includes('password')) {
        description = 'Please choose a stronger password (at least 6 characters).';
      }

      toast({
        title: 'Sign up failed',
        description,
        variant: 'destructive'
      });
    } else {
      toast({
        title: 'Application submitted',
        description:
          'Check your inbox to verify your email address. An administrator will review your application after verification.',
      });
    }

    return { error };
  };

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      console.error('[Auth] Sign in error:', error.message, error.status);
      const raw = error.message.toLowerCase();
      let description = error.message;

      if (raw.includes('email not confirmed')) {
        description =
          'Your email address is not verified yet. Open the verification link we sent you, then sign in again.';
      } else if (raw.includes('invalid login credentials')) {
        description = 'Incorrect email or password. Please try again.';
      } else if (raw.includes('rate limit') || error.status === 429) {
        description = 'Too many sign-in attempts. Please wait a few minutes and try again.';
      }

      toast({
        title: 'Sign in failed',
        description,
        variant: 'destructive'
      });
      return { error, profile: null };
    }


    // Fetch profile immediately so caller can use it for navigation
    let fetchedProfile = null;
    if (data?.user) {
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', data.user.id)
        .single();

      if (!profileError && profileData) {
        fetchedProfile = profileData;
        setProfile(profileData);
      }
    }

    return { error: null, profile: fetchedProfile };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
    toast({
      title: "Signed out",
      description: "You have been signed out successfully.",
    });
  };

  const resetPassword = async (email: string) => {
    console.log('[Auth] Requesting password reset for:', email);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: 'https://www.nuesa.org/auth/reset-password'
    });

    if (error) {
      console.error('[Auth] Password reset error:', error.message, error.status);
      const description = error.message.includes('rate limit')
        ? 'Too many attempts. Please wait a few minutes before trying again.'
        : error.message;
      toast({
        title: "Error",
        description,
        variant: "destructive"
      });
    } else {
      console.log('[Auth] Password reset email requested successfully');
    }

    return { error };
  };

  const refetchProfile = async () => {
    if (user) {
      const { data: profileData, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();
      
      if (!error) {
        setProfile(profileData);
      }
    }
  };

  return (
    <AuthContext.Provider value={{
      user,
      session,
      profile,
      loading,
      signUp,
      signIn,
      signOut,
      resetPassword,
      refetchProfile
    }}>
      {children}
    </AuthContext.Provider>
  );
}

const defaultAuthContext: AuthContextType = {
  user: null,
  session: null,
  profile: null,
  loading: true,
  signUp: async () => ({ error: new Error('AuthProvider not mounted') }),
  signIn: async () => ({ error: new Error('AuthProvider not mounted'), profile: null }),
  signOut: async () => {},
  resetPassword: async () => ({ error: new Error('AuthProvider not mounted') }),
  refetchProfile: () => {},
};

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    console.warn('useAuth called outside AuthProvider – returning safe defaults');
    return defaultAuthContext;
  }
  return context;
}