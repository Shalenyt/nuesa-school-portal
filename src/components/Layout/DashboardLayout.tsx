import { ReactNode, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { SidebarMenu } from '@/components/Shared/SidebarMenu';
import { useAuth } from '@/hooks/useAuth';
import { useSchoolSettings } from '@/hooks/useSchoolSettings';

import { Button } from '@/components/ui/button';
import { UserAvatar } from '@/components/Shared/UserAvatar';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { LogOut, Download } from 'lucide-react';
import oaustechLogo from '@/assets/oaustech-logo.png';
import { GlobalSearch } from '@/components/Shared/GlobalSearch';

interface DashboardLayoutProps {
  children: ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const navigate = useNavigate();
  const { signOut, profile } = useAuth();
  const { settings } = useSchoolSettings();
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true) {
      setIsInstalled(true);
      return;
    }

    // Check for globally captured prompt
    const globalPrompt = (window as any).__pwaInstallPrompt;
    if (globalPrompt) {
      setDeferredPrompt(globalPrompt);
      (window as any).__pwaInstallPrompt = null;
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    window.addEventListener('appinstalled', () => { setIsInstalled(true); setDeferredPrompt(null); });

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) {
      // Last attempt from global
      const gp = (window as any).__pwaInstallPrompt;
      if (gp) {
        gp.prompt();
        const { outcome } = await gp.userChoice;
        if (outcome === 'accepted') setIsInstalled(true);
        (window as any).__pwaInstallPrompt = null;
        return;
      }
      // True fallback - only for iOS
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      if (isIOS) {
        import('@/hooks/use-toast').then(({ toast }) => toast({
          title: "Install App",
          description: "Tap the Share button (↑) then 'Add to Home Screen'",
        }));
      }
      return;
    }
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') setIsInstalled(true);
    setDeferredPrompt(null);
  };

  const getProfileUrl = () => {
    switch (profile?.role) {
      case 'admin': return '/admin/profile';
      case 'teacher': return '/teacher/profile';
      case 'student': return '/student/profile';
      default: return '/';
    }
  };

  const getDashboardUrl = () => {
    switch (profile?.role) {
      case 'admin': return '/admin/dashboard';
      case 'teacher': return '/teacher/profile';
      case 'student': return '/student/profile';
      default: return '/';
    }
  };

  const showInstallButton = !isInstalled && (deferredPrompt || /iPad|iPhone|iPod/.test(navigator.userAgent));

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <SidebarMenu />
        
        <div className="flex-1 flex flex-col min-w-0">
          <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="flex h-14 items-center px-2 sm:px-4 gap-2">
              <SidebarTrigger className="shrink-0" />
              
              <a 
                href={getDashboardUrl()}
                onClick={(e) => { e.preventDefault(); navigate(getDashboardUrl()); }}
                className="flex items-center gap-2 min-w-0 cursor-pointer hover:opacity-80 transition-opacity"
              >
                <img 
                  src={settings?.logo_url || oaustechLogo} 
                  alt="School Logo" 
                  className="h-7 w-7 sm:h-8 sm:w-8 object-contain shrink-0" 
                />
                <h1 className="font-semibold text-sm sm:text-lg truncate">{settings?.portal_name || settings?.school_name || 'NUESA Portal'}</h1>
              </a>
              
              <div className="ml-auto flex items-center gap-1 sm:gap-3 shrink-0">
                <GlobalSearch />
                {showInstallButton && (
                  <Button variant="outline" size="sm" onClick={handleInstall} className="px-2 sm:px-3 gap-1">
                    <Download className="h-4 w-4" />
                    <span className="hidden sm:inline">Install App</span>
                  </Button>
                )}
                <button 
                  onClick={() => navigate(getProfileUrl())}
                  className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity"
                >
                  <UserAvatar
                    photoUrl={profile?.profile_photo_url}
                    name={profile?.full_name}
                    className="h-7 w-7 sm:h-8 sm:w-8"
                    fallbackClassName="text-xs"
                  />
                  <div className="text-sm hidden sm:block text-left">
                    <span className="text-muted-foreground">Welcome,</span>{' '}
                    <span className="font-medium">{firstNameOf(profile, '')}</span>
                  </div>
                </button>
                
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

      {/* Floating install button for mobile */}
      {showInstallButton && (
        <button
          onClick={handleInstall}
          className="fixed bottom-4 right-4 z-50 sm:hidden bg-primary text-primary-foreground rounded-full p-3 shadow-lg hover:opacity-90 transition-opacity"
          aria-label="Install App"
        >
          <Download className="h-5 w-5" />
        </button>
      )}
    </SidebarProvider>
  );
}
