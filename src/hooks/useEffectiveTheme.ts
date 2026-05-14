import { useEffect, useState } from 'react';

/**
 * Vraca tekuci effective theme ('light' | 'dark') sa baseom na DOM class koju
 * ThemeProvider postavlja u <html>. Reaguje na promene preko MutationObserver.
 *
 * Koristi se u Canvas/SVG renderima koji nemaju access Tailwind-ovim dark:
 * prefix-evima (canvas 2D context, leaflet DivIcon-i, recharts color scheme).
 */
export function useEffectiveTheme(): 'light' | 'dark' {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof document === 'undefined') return 'dark';
    return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
  });
  useEffect(() => {
    const observer = new MutationObserver(() => {
      setTheme(document.documentElement.classList.contains('dark') ? 'dark' : 'light');
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);
  return theme;
}
