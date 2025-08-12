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
      document.documentElement.style.setProperty('--primary', hsl);
      
      // Create lighter/darker variants
      const [hue, saturation] = hsl.split(' ');
      document.documentElement.style.setProperty('--primary-foreground', '0 0% 98%');
      document.documentElement.style.setProperty('--accent', `${hue} ${saturation} 95%`);
      document.documentElement.style.setProperty('--accent-foreground', hsl);
    }
  }, [settings?.theme_color]);
}