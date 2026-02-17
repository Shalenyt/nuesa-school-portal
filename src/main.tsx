import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'

// Capture PWA install prompt globally before React mounts
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  (window as any).__pwaInstallPrompt = e;
});

createRoot(document.getElementById("root")!).render(<App />);
