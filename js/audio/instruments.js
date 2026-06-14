// Synthese-Engine: erzeugt für jeden Notenanschlag eine "Stimme".
// triggerInstrument(ctx, dest, inst, midi, time, opts) -> Handle { stop(t), endTime }
// Funktioniert mit AudioContext UND OfflineAudioContext (gleiche API).

import { midiToFreq } from '../util.js';

const noiseCache = new WeakMap();
function noiseBuffer(ctx) {
  let b = noiseCache.get(ctx);
  if (!b) {
    b = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    noiseCache.set(ctx, b);
  }
  return b;
}

function makeNoiseSource(ctx) {
  const s = ctx.createBufferSource();
  s.buffer = noiseBuffer(ctx);
  s.loop = true;
  return s;
}

// Sanftes Abklingen am Param ohne Klick.
function rampDown(param, t, dur = 0.006) {
  try { param.cancelAndHoldAtTime(t); } catch (_) { param.cancelScheduledValues(t); }
  param.linearRampToValueAtTime(0.0001, t + dur);
}

/**
 * Spielt ein Instrument an. Gibt ein Handle zurück.
 * opts: { velocity, duration } – duration = Sekunden bis natürlicher Stopp (optional).
 */
export function triggerInstrument(ctx, dest, inst, midi, time, opts = {}) {
  const vel = opts.velocity == null ? 1 : opts.velocity;
  const vg = ctx.createGain();      // Stimmen-Master (für Note-Off / Cut)
  vg.gain.value = 1;
  vg.connect(dest);

  let endTime;
  if (inst.type === 'drum') endTime = triggerDrum(ctx, vg, inst, midi, time, vel);
  else if (inst.type === 'sample') endTime = triggerSample(ctx, vg, inst, midi, time, vel, opts);
  else endTime = triggerSynth(ctx, vg, inst, midi, time, vel, opts);

  return {
    endTime,
    stop(t) {
      const at = Math.max(t, time);
      rampDown(vg.gain, at, 0.008);
    }
  };
}

// ---------------- Synth ----------------
function triggerSynth(ctx, dest, inst, midi, t, vel, opts) {
  const freq = midiToFreq(midi);
  const peak = (inst.gain ?? 0.8) * vel;
  const a = inst.attack ?? 0.005;
  const d = inst.decay ?? 0.12;
  const s = inst.sustain ?? 0.7;
  const r = inst.release ?? 0.18;
  const hold = opts.duration != null ? Math.max(opts.duration, a + d) : 3.0;

  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = inst.cutoff ?? 4000;
  filter.Q.value = inst.q ?? 1;

  const amp = ctx.createGain();
  amp.gain.setValueAtTime(0.0001, t);
  amp.gain.linearRampToValueAtTime(peak, t + a);
  amp.gain.linearRampToValueAtTime(peak * s, t + a + d);

  // Haupt-Oszillator (+ optional leicht verstimmter zweiter für "fat")
  const oscs = [];
  const mkOsc = (detuneCents) => {
    const o = ctx.createOscillator();
    o.type = inst.wave || 'sawtooth';
    o.frequency.value = freq;
    o.detune.value = (inst.detune || 0) + detuneCents;
    o.connect(filter);
    oscs.push(o);
  };
  mkOsc(0);
  if (inst.fat) mkOsc(8), mkOsc(-8);

  // Optionaler Sub-Oszillator eine Oktave tiefer
  if (inst.sub) {
    const sub = ctx.createOscillator();
    sub.type = 'sine';
    sub.frequency.value = freq / 2;
    const sg = ctx.createGain();
    sg.gain.value = inst.sub;
    sub.connect(sg); sg.connect(filter);
    oscs.push(sub);
  }

  filter.connect(amp);
  amp.connect(dest);

  const stopT = t + hold + r;
  // Release-Phase
  amp.gain.setValueAtTime(peak * s, t + hold);
  amp.gain.linearRampToValueAtTime(0.0001, stopT);

  for (const o of oscs) { o.start(t); o.stop(stopT + 0.02); }
  return stopT + 0.05;
}

// ---------------- Sample ----------------
function triggerSample(ctx, dest, inst, midi, t, vel, opts) {
  if (!inst.buffer) return t;
  const src = ctx.createBufferSource();
  src.buffer = inst.buffer;
  const base = inst.baseNote ?? 60;
  src.playbackRate.value = Math.pow(2, (midi - base) / 12);
  if (inst.loop) src.loop = true;

  const amp = ctx.createGain();
  amp.gain.value = (inst.gain ?? 0.9) * vel;
  src.connect(amp); amp.connect(dest);

  const natural = inst.buffer.duration / src.playbackRate.value;
  const dur = inst.loop && opts.duration != null ? opts.duration : natural;
  src.start(t);
  src.stop(t + dur + 0.02);
  // kurzes Fade-Out gegen Klick am Ende
  amp.gain.setValueAtTime(amp.gain.value, t + Math.max(0, dur - 0.01));
  amp.gain.linearRampToValueAtTime(0.0001, t + dur + 0.01);
  return t + dur + 0.05;
}

// ---------------- Drums ----------------
function triggerDrum(ctx, dest, inst, midi, t, vel) {
  const kind = inst.drum || 'kick';
  const mul = inst.pitched ? Math.pow(2, (midi - (inst.baseNote ?? 60)) / 12) : 1;
  const peak = (inst.gain ?? 0.9) * vel;
  switch (kind) {
    case 'kick': return drumKick(ctx, dest, inst, t, peak, mul);
    case 'snare': return drumSnare(ctx, dest, inst, t, peak, mul);
    case 'clap': return drumClap(ctx, dest, inst, t, peak);
    case 'tom': return drumTom(ctx, dest, inst, t, peak, mul);
    case 'hat':
    default: return drumHat(ctx, dest, inst, t, peak);
  }
}

function drumKick(ctx, dest, inst, t, peak, mul) {
  const tune = (inst.tune ?? 50) * mul;
  const decay = inst.decay ?? 0.34;
  const o = ctx.createOscillator();
  o.type = 'sine';
  o.frequency.setValueAtTime(tune * 4.5, t);
  o.frequency.exponentialRampToValueAtTime(tune, t + (inst.pitchDecay ?? 0.06));
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(peak, t + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
  o.connect(g); g.connect(dest);
  o.start(t); o.stop(t + decay + 0.02);
  // Klick
  if ((inst.click ?? 0.3) > 0) {
    const n = makeNoiseSource(ctx);
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 1200;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime((inst.click ?? 0.3) * peak, t);
    ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.02);
    n.connect(hp); hp.connect(ng); ng.connect(dest);
    n.start(t); n.stop(t + 0.04);
  }
  return t + decay + 0.05;
}

function drumSnare(ctx, dest, inst, t, peak, mul) {
  const decay = inst.decay ?? 0.2;
  // Rauschanteil
  const n = makeNoiseSource(ctx);
  const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 1500;
  const ng = ctx.createGain();
  ng.gain.setValueAtTime(peak, t);
  ng.gain.exponentialRampToValueAtTime(0.0001, t + decay);
  n.connect(hp); hp.connect(ng); ng.connect(dest);
  n.start(t); n.stop(t + decay + 0.02);
  // Körper
  const o = ctx.createOscillator(); o.type = 'triangle';
  o.frequency.value = (inst.tune ?? 180) * mul;
  const og = ctx.createGain();
  og.gain.setValueAtTime(peak * 0.7, t);
  og.gain.exponentialRampToValueAtTime(0.0001, t + decay * 0.6);
  o.connect(og); og.connect(dest);
  o.start(t); o.stop(t + decay + 0.02);
  return t + decay + 0.05;
}

function drumHat(ctx, dest, inst, t, peak) {
  const decay = inst.decay ?? 0.05;
  const n = makeNoiseSource(ctx);
  const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = inst.cutoff ?? 7000;
  const g = ctx.createGain();
  g.gain.setValueAtTime(peak * 0.8, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
  n.connect(hp); hp.connect(g); g.connect(dest);
  n.start(t); n.stop(t + decay + 0.02);
  return t + decay + 0.05;
}

function drumClap(ctx, dest, inst, t, peak) {
  const decay = inst.decay ?? 0.22;
  const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1200; bp.Q.value = 1.2;
  const g = ctx.createGain();
  bp.connect(g); g.connect(dest);
  g.gain.setValueAtTime(0.0001, t);
  // Mehrere kurze Bursts hintereinander
  const bursts = [0, 0.012, 0.024, 0.036];
  for (const off of bursts) {
    g.gain.setValueAtTime(peak, t + off);
    g.gain.exponentialRampToValueAtTime(0.0001, t + off + 0.05);
  }
  g.gain.setValueAtTime(peak * 0.7, t + 0.045);
  g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
  const n = makeNoiseSource(ctx);
  n.connect(bp); n.start(t); n.stop(t + decay + 0.02);
  return t + decay + 0.05;
}

function drumTom(ctx, dest, inst, t, peak, mul) {
  const tune = (inst.tune ?? 120) * mul;
  const decay = inst.decay ?? 0.3;
  const o = ctx.createOscillator(); o.type = 'sine';
  o.frequency.setValueAtTime(tune * 1.8, t);
  o.frequency.exponentialRampToValueAtTime(tune, t + 0.12);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(peak, t + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
  o.connect(g); g.connect(dest);
  o.start(t); o.stop(t + decay + 0.02);
  return t + decay + 0.05;
}

/** Rendert ein Instrument offline zu einem AudioBuffer (für "Als Sample backen"). */
export async function renderInstrumentToBuffer(inst, midi = 60, lengthSec = 1.2) {
  const sr = 44100;
  const offline = new OfflineAudioContext(1, Math.ceil(sr * lengthSec), sr);
  const dest = offline.createGain();
  dest.connect(offline.destination);
  triggerInstrument(offline, dest, inst, midi, 0, { duration: lengthSec * 0.7 });
  return offline.startRendering();
}
