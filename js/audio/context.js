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

let unlocked = false;

/**
 * Browser starten AudioContexts erst nach einer Nutzer-Geste.
 * iOS/Safari braucht zusätzlich einen (stillen) Klang innerhalb der Geste,
 * sonst bleibt der Context stumm, obwohl sein Zustand "running" meldet.
 */
export async function ensureRunning() {
  const c = getCtx();
  if (c.state === 'suspended') {
    try { await c.resume(); } catch (_) { /* ignore */ }
  }
  if (!unlocked) {
    try {
      const src = c.createBufferSource();
      src.buffer = c.createBuffer(1, 1, c.sampleRate);
      src.connect(c.destination);
      src.start(0);
      unlocked = true;
    } catch (_) { /* ignore */ }
  }
  return c;
}

/**
 * iOS pausiert den AudioContext beim App-/Tab-Wechsel und beim Sperren.
 * Beim Zurückkommen wieder aufwecken, sonst bleibt alles stumm.
 */
export function watchLifecycle() {
  const wake = () => {
    const c = getCtx();
    if (c.state === 'suspended') c.resume().catch(() => {});
  };
  document.addEventListener('visibilitychange', () => { if (!document.hidden) wake(); });
  window.addEventListener('focus', wake);
  window.addEventListener('pageshow', wake);
}
