// Zentraler AudioContext + Master-Signalkette.

let ctx = null;
let master = null;     // Summen-Gain (Lautstärke)
let comp = null;       // Limiter/Kompressor zum Schutz vor Übersteuern
let analyser = null;   // für VU-Meter

/** Liefert den (einmaligen) AudioContext und baut die Master-Kette auf. */
export function getCtx() {
  if (!ctx) {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain();
    master.gain.value = 0.72;

    comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -8;
    comp.knee.value = 30;
    comp.ratio.value = 8;
    comp.attack.value = 0.003;
    comp.release.value = 0.25;

    analyser = ctx.createAnalyser();
    analyser.fftSize = 256;

    master.connect(comp);
    comp.connect(analyser);
    analyser.connect(ctx.destination);
  }
  return ctx;
}

/** Master-Bus, an den alle Stimmen angeschlossen werden. */
export function getMaster() {
  getCtx();
  return master;
}

export function getAnalyser() {
  getCtx();
  return analyser;
}

export function setMasterVolume(v) {
  getMaster().gain.value = v;
}

/** Browser starten AudioContexts erst nach einer Nutzer-Geste. */
export async function ensureRunning() {
  const c = getCtx();
  if (c.state === 'suspended') {
    try { await c.resume(); } catch (_) { /* ignore */ }
  }
  return c;
}
