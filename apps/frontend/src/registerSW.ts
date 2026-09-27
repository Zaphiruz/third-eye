import { registerSW } from 'virtual:pwa-register';

/**
 * Single registration path (`injectRegister: false`). When a NEW worker takes over a page that
 * already had one, reload once so the page's lazily-loaded chunks match the new precache.
 */
export function registerServiceWorker(): void {
  if (!('serviceWorker' in navigator)) return;
  const hadController = !!navigator.serviceWorker.controller;
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || reloading) return;
    reloading = true;
    location.reload();
  });
  registerSW({ immediate: true });
}
