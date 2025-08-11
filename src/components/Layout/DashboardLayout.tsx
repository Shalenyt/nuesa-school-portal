import { ReactNode } from 'react';
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { SidebarMenu } from '@/components/Shared/SidebarMenu';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { LogOut } from 'lucide-react';
import oaustechLogo from '@/assets/oaustech-logo.png';

interface DashboardLayoutProps {
  children: ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const { signOut, profile } = useAuth();

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <SidebarMenu />
        
        <div className="flex-1 flex flex-col">
          <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="flex h-14 items-center px-4">
              <SidebarTrigger />
              
              <div className="flex items-center gap-2 ml-4">
                <img src={oaustechLogo} alt="OAUSTECH Logo" className="h-8 w-8" />
                <h1 className="font-semibold text-lg">OAUSTECH Portal</h1>
              </div>
              
              <div className="ml-auto flex items-center gap-4">
                <div className="text-sm">
                  <span className="text-muted-foreground">Welcome,</span>{' '}
                  <span className="font-medium">{profile?.full_name}</span>
                </div>
                
                <ThemeToggle />
                
                <Button variant="ghost" size="sm" onClick={signOut}>
                  <LogOut className="h-4 w-4 mr-2" />
                  Sign Out
                </Button>
              </div>
            </div>
          </header>
          
          <main className="flex-1 p-6">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}