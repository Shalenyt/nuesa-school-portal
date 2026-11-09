import { createRoot } from 'react-dom/client'
import { applyNigerianDateFormat } from './lib/dateLocale'
import App from './App.tsx'
import { supabase } from '@/integrations/supabase/client'
import './index.css'

// Dates as 31/12/2026 (Nigerian format) instead of the browser's default
applyNigerianDateFormat();

// Capture PWA install prompt globally before React mounts
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  (window as any).__pwaInstallPrompt = e;
});

// Someone moved here from nuesa.org: pick up the login they had there, so they
// stay signed in. The handoff is removed from the address bar straight away.
async function takeOverLoginFromOldAddress() {
  const match = /[#&]nuesa_handoff=([^&]+)/.exec(window.location.hash);
  if (!match) return;
  window.history.replaceState(null, '', window.location.pathname + window.location.search);
  if (window.location.hostname !== 'www.nuesa.org') return;
  try {
    const { data } = await supabase.auth.getSession();
    if (data.session) return; // already signed in here
    await supabase.auth.refreshSession({ refresh_token: decodeURIComponent(match[1]) });
  } catch {
    /* expired login: they just sign in again */
  }
}

takeOverLoginFromOldAddress().finally(() => {
  createRoot(document.getElementById("root")!).render(<App />);
});
