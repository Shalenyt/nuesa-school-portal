import { useEffect } from 'react';
import { useSchoolSettings } from './useSchoolSettings';

export function useThemeSync() {
  const { settings } = useSchoolSettings();

  useEffect(() => {
    if (settings?.theme_color) {
      // Convert hex color to HSL for CSS variables
      const hexToHsl = (hex: string) => {
        const r = parseInt(hex.slice(1, 3), 16) / 255;
        const g = parseInt(hex.slice(3, 5), 16) / 255;
        const b = parseInt(hex.slice(5, 7), 16) / 255;

        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        let h, s, l = (max + min) / 2;

        if (max === min) {
          h = s = 0; // achromatic
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

      // Apply the theme color as primary
      const hsl = hexToHsl(settings.theme_color);
      const root = document.documentElement;
      
      // Set primary colors for both light and dark mode
      root.style.setProperty('--primary', hsl);
      root.style.setProperty('--ring', hsl);
      
      // Extract HSL values for calculations
      const [hue, saturation, lightness] = hsl.split(' ');
      const h = parseInt(hue);
      const s = parseInt(saturation);
      const l = parseInt(lightness);
      
      // Create semantic variants
      root.style.setProperty('--primary-foreground', '0 0% 98%');
      root.style.setProperty('--accent', `${h} ${Math.max(s - 60, 10)}% ${Math.min(l + 40, 96)}%`);
      root.style.setProperty('--accent-foreground', hsl);
      
      // Update secondary colors to complement the primary
      root.style.setProperty('--secondary-foreground', hsl);
      
      // Update destructive colors to use a red variant for proper contrast
      root.style.setProperty('--destructive', '0 84% 60%');
      
      // Update sidebar colors
      root.style.setProperty('--sidebar-primary', hsl);
      root.style.setProperty('--sidebar-ring', hsl);
      root.style.setProperty('--sidebar-accent-foreground', hsl);
      
      // Force a repaint to apply changes immediately
      document.body.style.display = 'none';
      document.body.offsetHeight; // Trigger reflow
      document.body.style.display = '';
    }
  }, [settings?.theme_color]);
}