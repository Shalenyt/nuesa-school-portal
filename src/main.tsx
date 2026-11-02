import { createRoot } from 'react-dom/client'
import { applyNigerianDateFormat } from './lib/dateLocale'
import App from './App.tsx'
import './index.css'

// Dates as 31/12/2026 (Nigerian format) instead of the browser's default
applyNigerianDateFormat();

// Capture PWA install prompt globally before React mounts
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  (window as any).__pwaInstallPrompt = e;
});

createRoot(document.getElementById("root")!).render(<App />);
