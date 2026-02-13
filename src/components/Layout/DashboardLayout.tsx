import { ReactNode, useEffect, useState } from 'react';
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { SidebarMenu } from '@/components/Shared/SidebarMenu';
import { useAuth } from '@/hooks/useAuth';
import { useSchoolSettings } from '@/hooks/useSchoolSettings';

import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { LogOut, Download } from 'lucide-react';
import oaustechLogo from '@/assets/oaustech-logo.png';

interface DashboardLayoutProps {
  children: ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const { signOut, profile } = useAuth();
  const { settings, ready } = useSchoolSettings();
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);

    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
    }
    window.addEventListener('appinstalled', () => setIsInstalled(true));

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') setIsInstalled(true);
    setDeferredPrompt(null);
  };


  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <SidebarMenu />
        
        <div className="flex-1 flex flex-col min-w-0">
          <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="flex h-14 items-center px-2 sm:px-4 gap-2">
              <SidebarTrigger className="shrink-0" />
              
              <a 
                href={profile?.role === 'admin' ? '/admin/dashboard' : profile?.role === 'teacher' ? '/teacher/profile' : '/student/profile'}
                className="flex items-center gap-2 min-w-0 cursor-pointer hover:opacity-80 transition-opacity"
              >
                <img 
                  src={settings?.logo_url || oaustechLogo} 
                  alt="School Logo" 
                  className="h-7 w-7 sm:h-8 sm:w-8 object-contain shrink-0" 
                />
                <h1 className="font-semibold text-sm sm:text-lg truncate">{settings?.portal_name || settings?.school_name || 'UNIABUJA Portal'}</h1>
              </a>
              
              <div className="ml-auto flex items-center gap-1 sm:gap-3 shrink-0">
                {deferredPrompt && !isInstalled && (
                  <Button variant="outline" size="sm" onClick={handleInstall} className="px-2 sm:px-3 gap-1">
                    <Download className="h-4 w-4" />
                    <span className="hidden sm:inline">Install App</span>
                  </Button>
                )}
                <Avatar className="h-7 w-7 sm:h-8 sm:w-8">
                  <AvatarImage src={profile?.profile_photo_url} />
                  <AvatarFallback className="text-xs">
                    {profile?.full_name?.charAt(0)?.toUpperCase() || 'U'}
                  </AvatarFallback>
                </Avatar>
                <div className="text-sm hidden sm:block">
                  <span className="text-muted-foreground">Welcome,</span>{' '}
                  <span className="font-medium">{profile?.full_name}</span>
                </div>
                
                <ThemeToggle />
                
                <Button variant="ghost" size="sm" onClick={signOut} className="px-2 sm:px-3">
                  <LogOut className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">Sign Out</span>
                </Button>
              </div>
            </div>
          </header>
          
          <main className="flex-1 p-3 sm:p-6 overflow-x-hidden">
            {children}
          </main>
          <footer className="py-2 text-center text-xs text-muted-foreground/50">
            Built by Shalen
          </footer>
        </div>
      </div>
    </SidebarProvider>
  );
}
