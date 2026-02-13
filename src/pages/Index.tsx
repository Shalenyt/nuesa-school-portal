import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { useNavigate } from 'react-router-dom';
import { useSchoolSettings } from '@/hooks/useSchoolSettings';

import oaustechLogo from '@/assets/oaustech-logo.png';

const Index = () => {
  const navigate = useNavigate();
  const { settings: schoolSettings, ready } = useSchoolSettings();
  

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background relative">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      
      <div className="text-center space-y-6">
        <a href="/" className="flex items-center justify-center gap-3 mb-8 cursor-pointer hover:opacity-80 transition-opacity no-underline">
          <img 
            src={schoolSettings?.logo_url || oaustechLogo} 
            alt={`${schoolSettings?.school_name || 'UNIABUJA'} Logo`} 
            className="h-16 w-16" 
          />
          <h1 className="text-5xl font-black text-primary">
            {schoolSettings?.portal_name || schoolSettings?.school_name || 'UNIABUJA Portal'}
          </h1>
        </a>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
          Welcome to the {schoolSettings?.portal_name || schoolSettings?.school_name || 'UNIABUJA'} School Management Portal. Access your academic information, 
          manage courses, and stay connected with the university community.
        </p>
        <div className="flex gap-4 justify-center mt-8">
          <Button onClick={() => navigate('/auth/login')} size="lg">
            Login to Portal
          </Button>
          <Button onClick={() => navigate('/auth/apply')} variant="outline" size="lg">
            Apply for Account
          </Button>
        </div>
        <p className="mt-12 text-xs text-muted-foreground/40">Built by Shalen</p>
      </div>
    </div>
  );
};

export default Index;
