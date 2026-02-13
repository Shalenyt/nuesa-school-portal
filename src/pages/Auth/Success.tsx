import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useSchoolSettings } from '@/hooks/useSchoolSettings';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { CheckCircle, ArrowRight } from 'lucide-react';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import oaustechLogo from '@/assets/oaustech-logo.png';

export default function Success() {
  const { settings } = useSchoolSettings();

  useEffect(() => {
    // Clear any existing auth state from the URL params
    const url = new URL(window.location.href);
    if (url.searchParams.has('access_token') || url.searchParams.has('refresh_token')) {
      // Clean the URL by removing the query parameters
      window.history.replaceState({}, document.title, url.pathname);
    }
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="mx-auto w-16 h-16 flex items-center justify-center mb-4">
            <img 
              src={settings?.logo_url || oaustechLogo} 
              alt={`${settings?.school_name || 'UNIABUJA'} Logo`} 
              className="h-16 w-16 object-contain" 
            />
          </div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            {settings?.school_name || 'UNIABUJA Portal'}
          </h1>
        </div>

        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 flex items-center justify-center mb-4 bg-green-100 rounded-full">
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
            <CardTitle className="text-2xl text-green-700">Application Successful!</CardTitle>
            <CardDescription>
              Your email has been confirmed and your application has been submitted for review.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="text-center space-y-4">
              <div className="p-4 bg-muted rounded-lg">
                <h3 className="font-semibold text-foreground mb-2">What's Next?</h3>
                <ul className="text-sm text-muted-foreground space-y-1 text-left">
                  <li>• Your application will be reviewed by an administrator</li>
                  <li>• You'll receive an email notification once approved</li>
                  <li>• After approval, you can access the portal with your credentials</li>
                </ul>
              </div>
              
              <div className="space-y-3">
                <Link to="/auth/login" className="w-full">
                  <Button className="w-full">
                    <ArrowRight className="mr-2 h-4 w-4" />
                    Go to Login Page
                  </Button>
                </Link>
                
                <Link to="/" className="w-full">
                  <Button variant="outline" className="w-full">
                    Back to Home
                  </Button>
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}