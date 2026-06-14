// Einstiegspunkt: App starten, sobald das DOM bereit ist.

import { App } from './app.js';

function boot() {
  const app = new App();
  window.tranceMaker = app;   // praktisch zum Debuggen in der Konsole
  app.init();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
