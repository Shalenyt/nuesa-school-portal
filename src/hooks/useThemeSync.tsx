import { useEffect } from 'react';
import { useSchoolSettings } from './useSchoolSettings';

export function useThemeSync() {
  const { settings, ready } = useSchoolSettings();

  useEffect(() => {
    if (!ready) {
      // Keep body hidden until branding is ready
      document.body.classList.remove('theme-ready');
      return;
    }

    if (settings?.theme_color) {
      const hexToHsl = (hex: string) => {
        const r = parseInt(hex.slice(1, 3), 16) / 255;
        const g = parseInt(hex.slice(3, 5), 16) / 255;
        const b = parseInt(hex.slice(5, 7), 16) / 255;

        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        let h, s, l = (max + min) / 2;

        if (max === min) {
          h = s = 0;
        } else {
          const d = max - min;
          s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
          switch (max) {
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
            default: h = 0;
          }
          h /= 6;
        }

        return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
      };

      const hsl = hexToHsl(settings.theme_color);
      const root = document.documentElement;
      
      root.style.setProperty('--primary', hsl);
      root.style.setProperty('--ring', hsl);
      
      const [hue, saturation, lightness] = hsl.split(' ');
      const h = parseInt(hue);
      const s = parseInt(saturation);
      const l = parseInt(lightness);
      
      root.style.setProperty('--primary-foreground', '0 0% 98%');
      root.style.setProperty('--accent', `${h} ${Math.max(s - 60, 10)}% ${Math.min(l + 40, 96)}%`);
      root.style.setProperty('--accent-foreground', hsl);
      root.style.setProperty('--secondary-foreground', hsl);

      // Derived accent scale used across admin + student interfaces
      root.style.setProperty('--theme-primary', hsl);
      root.style.setProperty('--theme-primary-foreground', '0 0% 98%');
      const isDark = document.documentElement.classList.contains('dark');
      if (isDark) {
        root.style.setProperty('--theme-primary-light', `${h} ${Math.max(s - 45, 12)}% 14%`);
        root.style.setProperty('--theme-primary-muted', `${h} ${Math.max(s - 40, 15)}% 20%`);
        root.style.setProperty('--theme-primary-border', `${h} ${Math.max(s - 30, 20)}% 32%`);
      } else {
        root.style.setProperty('--theme-primary-light', `${h} ${Math.max(s - 25, 25)}% 96%`);
        root.style.setProperty('--theme-primary-muted', `${h} ${Math.max(s - 20, 25)}% 92%`);
        root.style.setProperty('--theme-primary-border', `${h} ${Math.max(s - 15, 25)}% 80%`);
      }
      // "Comfortable" urgency follows the theme; danger states stay red on purpose.
      root.style.setProperty('--urgency-comfortable', hsl);
      // NOTE: --destructive is intentionally NOT themed so errors/overdue stay red.
      root.style.setProperty('--sidebar-foreground', '240 5.9% 10%');
      root.style.setProperty('--sidebar-primary', hsl);
      root.style.setProperty('--sidebar-ring', hsl);
      root.style.setProperty('--sidebar-accent-foreground', '240 5.9% 10%');
    }

    // Show body now that branding is applied
    document.body.classList.add('theme-ready');
  }, [settings?.theme_color, ready]);
}
