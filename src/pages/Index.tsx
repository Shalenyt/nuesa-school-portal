import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { useNavigate } from 'react-router-dom';
import { useSchoolSettings } from '@/hooks/useSchoolSettings';
import { useThemeSync } from '@/hooks/useThemeSync';
import oaustechLogo from '@/assets/oaustech-logo.png';

const Index = () => {
  const navigate = useNavigate();
  const { settings: schoolSettings } = useSchoolSettings();
  useThemeSync(); // Apply theme colors

  return (
    <div className="min-h-screen flex items-center justify-center bg-background relative">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      
      <div className="text-center space-y-6">
        <div className="flex items-center justify-center gap-3 mb-8">
          <img 
            src={schoolSettings?.logo_url || oaustechLogo} 
            alt={`${schoolSettings?.school_name || 'OAUSTECH'} Logo`} 
            className="h-16 w-16" 
          />
          <h1 className="text-5xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            {schoolSettings?.portal_name || schoolSettings?.school_name || 'OAUSTECH Portal'}
          </h1>
        </div>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
          Welcome to the {schoolSettings?.portal_name || schoolSettings?.school_name || 'OAUSTECH'} School Management Portal. Access your academic information, 
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
      </div>
    </div>
  );
};

export default Index;
