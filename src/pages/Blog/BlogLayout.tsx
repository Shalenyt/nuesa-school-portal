import { ReactNode, useEffect, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { LogIn, Menu, Search, X, LayoutDashboard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { useAuth } from '@/hooks/useAuth';
import { useThemeSync } from '@/hooks/useThemeSync';
import { nudgeNewsRefresh } from './shared';

const LOGO = 'https://www.nuesa.org/logo.png';

export const NAV = [
  { to: '/', label: 'Home', end: true },
  { to: '/news', label: 'News' },
  { to: '/articles', label: 'Articles' },
  { to: '/leadership', label: 'Leadership' },
  { to: '/engineering', label: 'Engineering' },
  { to: '/events', label: 'Events' },
  { to: '/about', label: 'About' },
  { to: '/resources', label: 'Resources' },
];

function PortalButton({ className = '' }: { className?: string }) {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  if (user && profile?.status === 'approved') {
    const to = profile.role === 'admin' ? '/admin/dashboard' : profile.role === 'teacher' ? '/teacher/dashboard' : '/student/dashboard';
    return (
      <Button size="sm" className={`rounded-full ${className}`} onClick={() => navigate(to)}>
        <LayoutDashboard className="mr-1.5 h-4 w-4" /> Dashboard
      </Button>
    );
  }
  return (
    <Button size="sm" className={`rounded-full ${className}`} onClick={() => navigate('/auth/login')}>
      <LogIn className="mr-1.5 h-4 w-4" /> Student Portal
    </Button>
  );
}

export function BlogLayout({ children }: { children: ReactNode }) {
  useThemeSync();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const navigate = useNavigate();
  const { pathname } = useLocation();

  useEffect(() => { setOpen(false); window.scrollTo(0, 0); }, [pathname]);
  useEffect(() => { nudgeNewsRefresh(); }, []);

  const search = (e: React.FormEvent) => {
    e.preventDefault();
    if (q.trim()) navigate(`/search?q=${encodeURIComponent(q.trim())}`);
  };

  const linkCls = ({ isActive }: { isActive: boolean }) =>
    `rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${isActive ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground'}`;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-40 border-b bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:px-6">
          <Link to="/" className="flex shrink-0 items-center gap-2">
            <img src={LOGO} alt="NUESA" className="h-9 w-9 object-contain" />
            <div className="leading-tight">
              <p className="text-base font-extrabold tracking-tight">NUESA <span className="text-primary">UniAbuja</span></p>
              <p className="hidden text-[11px] text-muted-foreground sm:block">Engineering news and student portal</p>
            </div>
          </Link>

          <nav className="ml-4 hidden items-center gap-0.5 xl:flex">
            {NAV.map((n) => <NavLink key={n.to} to={n.to} end={n.end} className={linkCls}>{n.label}</NavLink>)}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <form onSubmit={search} className="relative hidden md:block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search news and articles"
                aria-label="Search"
                className="h-9 w-56 rounded-full border bg-muted/40 pl-9 pr-3 text-sm outline-none focus:border-primary focus:bg-background lg:w-64"
              />
            </form>
            <ThemeToggle />
            <PortalButton className="hidden sm:inline-flex" />
            <button
              type="button"
              aria-label={open ? 'Close menu' : 'Open menu'}
              onClick={() => setOpen((o) => !o)}
              className="rounded-full p-2 hover:bg-muted xl:hidden"
            >
              {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {open && (
          <div className="border-t bg-background xl:hidden">
            <div className="mx-auto max-w-7xl space-y-3 px-4 py-4 sm:px-6">
              <form onSubmit={search} className="relative md:hidden">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search news and articles" aria-label="Search"
                  className="h-10 w-full rounded-full border bg-muted/40 pl-9 pr-3 text-sm outline-none focus:border-primary" />
              </form>
              <nav className="grid grid-cols-2 gap-1">
                {NAV.map((n) => (
                  <NavLink key={n.to} to={n.to} end={n.end}
                    className={({ isActive }) => `rounded-xl px-3 py-2.5 text-sm font-medium ${isActive ? 'bg-primary/10 text-primary' : 'hover:bg-muted'}`}>
                    {n.label}
                  </NavLink>
                ))}
              </nav>
              <PortalButton className="w-full sm:hidden" />
            </div>
          </div>
        )}
      </header>

      <main className="flex-1">{children}</main>

      <footer className="mt-16 border-t bg-muted/30">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 sm:grid-cols-2 sm:px-6 lg:grid-cols-4">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <img src={LOGO} alt="" className="h-10 w-10 object-contain" />
              <p className="font-extrabold">NUESA <span className="text-primary">UniAbuja</span></p>
            </div>
            <p className="text-sm text-muted-foreground">Nigerian Universities Engineering Students' Association, University of Abuja chapter. News, stories and resources from Nigerian engineering.</p>
          </div>
          <div>
            <p className="mb-3 text-sm font-semibold">Explore</p>
            <ul className="space-y-2 text-sm text-muted-foreground">
              {NAV.slice(1, 5).map((n) => <li key={n.to}><Link to={n.to} className="hover:text-primary">{n.label}</Link></li>)}
            </ul>
          </div>
          <div>
            <p className="mb-3 text-sm font-semibold">More</p>
            <ul className="space-y-2 text-sm text-muted-foreground">
              {NAV.slice(5).map((n) => <li key={n.to}><Link to={n.to} className="hover:text-primary">{n.label}</Link></li>)}
            </ul>
          </div>
          <div>
            <p className="mb-3 text-sm font-semibold">Student portal</p>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link to="/auth/login" className="hover:text-primary">Log in</Link></li>
              <li><Link to="/auth/apply" className="hover:text-primary">Apply for an account</Link></li>
              <li><Link to="/auth/forgot-password" className="hover:text-primary">Forgot password</Link></li>
            </ul>
          </div>
        </div>
        <div className="border-t">
          <div className="mx-auto flex max-w-7xl flex-col gap-1 px-4 py-5 text-xs text-muted-foreground sm:flex-row sm:justify-between sm:px-6">
            <p>© {new Date().getFullYear()} NUESA, University of Abuja chapter.</p>
            <p>News headlines link to their original publishers.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
