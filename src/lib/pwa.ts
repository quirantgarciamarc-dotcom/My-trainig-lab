import { Platform } from 'react-native';

/**
 * Web only: añade al <head> lo necesario para que la app se pueda instalar en la
 * pantalla de inicio (iPhone/Android) y se abra a pantalla completa.
 * Es idempotente y no hace nada fuera del navegador.
 */
export function setupPwaHead(): void {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return;
  const head = document.head;
  const basePath = (process.env.EXPO_PUBLIC_BASE_URL ?? '').replace(/\\/$/, '');
  const assetPath = (path: string) => `${basePath}${path}`;
  const ensure = (selector: string, create: () => HTMLElement) => {
    if (!head.querySelector(selector)) head.appendChild(create());
  };
  const link = (rel: string, href: string, extra: Record<string, string> = {}) => {
    const el = document.createElement('link');
    el.rel = rel; el.href = href;
    Object.entries(extra).forEach(([k, v]) => el.setAttribute(k, v));
    return el;
  };
  const meta = (name: string, content: string) => {
    const el = document.createElement('meta');
    el.name = name; el.content = content;
    return el;
  };
  try {
    ensure('link[rel="manifest"]', () => link('manifest', assetPath('/manifest.webmanifest')));
    ensure('link[rel="apple-touch-icon"]', () => link('apple-touch-icon', assetPath('/icons/apple-touch-icon.png')));
    ensure('meta[name="theme-color"]', () => meta('theme-color', '#080B10'));
    ensure('meta[name="apple-mobile-web-app-capable"]', () => meta('apple-mobile-web-app-capable', 'yes'));
    ensure('meta[name="mobile-web-app-capable"]', () => meta('mobile-web-app-capable', 'yes'));
    ensure('meta[name="apple-mobile-web-app-title"]', () => meta('apple-mobile-web-app-title', 'Training Lab'));
    ensure('meta[name="apple-mobile-web-app-status-bar-style"]', () => meta('apple-mobile-web-app-status-bar-style', 'black-translucent'));
    // viewport-fit=cover para respetar la zona segura (notch) en iPhone
    const vp = head.querySelector('meta[name="viewport"]') as HTMLMetaElement | null;
    if (vp && !vp.content.includes('viewport-fit')) vp.content = `${vp.content}, viewport-fit=cover`;
    if (!document.title || document.title === 'undefined') document.title = 'My Training Lab';
    document.documentElement.style.backgroundColor = '#080B10';
    document.body.style.backgroundColor = '#080B10';
  } catch {
    /* la instalación como app es opcional; nunca debe romper la app */
  }
}
