// Datenmodell: Song, Pattern, Instrumente + Standardprojekt mit Demo-Beat.

import { uid } from './util.js';

/** Instrument mit sinnvollen Defaults je Typ erzeugen. */
export function createInstrument(opts = {}) {
  const base = {
    id: uid('inst'),
    name: opts.name || 'Instrument',
    type: opts.type || 'synth',
    category: opts.category || 'Sonstige',
    volume: opts.volume ?? 0.85,   // Mixer-Lautstärke
    mute: false,
    solo: false
  };
  if (base.type === 'synth') {
    return Object.assign(base, {
      wave: 'sawtooth', attack: 0.005, decay: 0.12, sustain: 0.7, release: 0.18,
      cutoff: 4000, q: 1, sub: 0, fat: false, detune: 0, drive: 0, gain: 0.8
    }, opts);
  }
  if (base.type === 'drum') {
    return Object.assign(base, {
      drum: 'kick', tune: 50, decay: 0.34, click: 0.3, pitched: false, baseNote: 60, drive: 0, gain: 0.9
    }, opts);
  }
  // sample
  return Object.assign(base, {
    sampleData: null,   // Base64-WAV (nur beim Serialisieren gesetzt)
    sampleRate: 44100,
    baseNote: 60, loop: false, gain: 0.95, buffer: null /* AudioBuffer zur Laufzeit */
  }, opts);
}

/** Leeres Pattern: cells[row][channel] = null | {midi,inst} | {off:true} */
export function createPattern(name, channels, rows = 16) {
  const cells = [];
  for (let r = 0; r < rows; r++) {
    const row = [];
    for (let c = 0; c < channels; c++) row.push(null);
    cells.push(row);
  }
  return { id: uid('pat'), name: name || 'Pattern', rows, cells };
}

export function createSong() {
  return {
    title: 'Neuer Track',
    bpm: 138,
    rowsPerBeat: 4,
    channels: 8,
    instruments: [],
    patterns: [],
    order: [],
    // Music-Maker-artiger Arranger: Sample-Bloecke auf Spuren/Zeitleiste
    arrangement: { tracks: 8, bars: 8, clips: [] }
  };
}

/** Ein Clip/Block im Arranger. */
export function createClip(opts = {}) {
  return Object.assign({
    id: uid('clip'), track: 0, startBeat: 0, lengthBeats: 2, inst: null, midi: 60
  }, opts);
}

export const BEATS_PER_BAR = 4;

/** Ende des letzten Clips in Beats (fuer Loop-/Export-Laenge). */
export function arrangementEndBeats(arr) {
  let end = 0;
  for (const c of (arr?.clips || [])) end = Math.max(end, c.startBeat + c.lengthBeats);
  return end;
}

/**
 * Auslösungen eines Clips: füllt die Clip-Länge mit dem Instrument.
 * - synth: ein gehaltener Ton über die ganze Länge
 * - drum:  Wiederholung pro Beat
 * - sample: Kacheln in Sample-Länge (nahtlos aneinander)
 * Liefert [{ offsetBeats, durBeats }].
 */
export function clipTriggers(clip, inst, spb) {
  const len = clip.lengthBeats;
  if (!inst || inst.type === 'synth') return [{ offsetBeats: 0, durBeats: len }];
  let step;
  if (inst.type === 'sample') step = inst.buffer ? Math.max(0.125, inst.buffer.duration / spb) : len;
  else step = 1; // drum
  const out = [{ offsetBeats: 0, durBeats: step }];
  let t = step;
  while (t < len - 0.5 * step) { out.push({ offsetBeats: t, durBeats: step }); t += step; }
  return out;
}

/**
 * Note-Events eines Clips inkl. Tonhöhe:
 * - Hat der Clip eigene Noten (Piano-Roll-Melodie), werden diese verwendet.
 * - Sonst Füll-Verhalten (clipTriggers) mit der Clip-Tonhöhe.
 * Liefert [{ offsetBeats, durBeats, midi }].
 */
export function clipNoteEvents(clip, inst, spb) {
  if (clip.notes && clip.notes.length) {
    return clip.notes.map((n) => ({ offsetBeats: n.beat, durBeats: n.length, midi: n.midi }));
  }
  return clipTriggers(clip, inst, spb).map((t) => ({ offsetBeats: t.offsetBeats, durBeats: t.durBeats, midi: clip.midi }));
}

const setCell = (pat, row, ch, midi, instId) => { pat.cells[row][ch] = { midi, inst: instId }; };

/** Preset-Katalog, nach Kategorien geordnet. */
export const PRESETS = [
  // Kick & Drums
  { category: 'Kick & Drums', name: 'Kick', type: 'drum', drum: 'kick', tune: 50, decay: 0.36, click: 0.35 },
  { category: 'Kick & Drums', name: 'Hardstyle Kick', type: 'drum', drum: 'kick', tune: 60, decay: 0.5, pitchDecay: 0.09, click: 0.6, drive: 0.8, gain: 0.95 },
  { category: 'Kick & Drums', name: 'Punch Kick', type: 'drum', drum: 'kick', tune: 48, decay: 0.28, pitchDecay: 0.04, click: 0.5, drive: 0.2 },
  { category: 'Kick & Drums', name: 'Deep Kick', type: 'drum', drum: 'kick', tune: 42, decay: 0.45, click: 0.15 },
  { category: 'Kick & Drums', name: 'Clap', type: 'drum', drum: 'clap', decay: 0.22, gain: 0.8 },
  { category: 'Kick & Drums', name: 'Snare', type: 'drum', drum: 'snare', tune: 190, decay: 0.18, gain: 0.7 },
  { category: 'Kick & Drums', name: 'Rimshot', type: 'drum', drum: 'snare', tune: 320, decay: 0.08, gain: 0.6 },
  { category: 'Kick & Drums', name: 'Hat (zu)', type: 'drum', drum: 'hat', decay: 0.04, cutoff: 8000, gain: 0.5 },
  { category: 'Kick & Drums', name: 'Hat (offen)', type: 'drum', drum: 'hat', decay: 0.28, cutoff: 7000, gain: 0.45 },
  { category: 'Kick & Drums', name: 'Crash', type: 'drum', drum: 'hat', decay: 1.0, cutoff: 5000, gain: 0.4 },
  { category: 'Kick & Drums', name: 'Tom', type: 'drum', drum: 'tom', tune: 120, decay: 0.3, pitched: true },
  // Bass
  { category: 'Bass', name: 'Bass', type: 'synth', wave: 'sawtooth', cutoff: 700, q: 6, sub: 0.6, attack: 0.004, decay: 0.18, sustain: 0.2, release: 0.08, gain: 0.85 },
  { category: 'Bass', name: 'Sub Bass', type: 'synth', wave: 'sine', cutoff: 3000, q: 0.7, attack: 0.005, decay: 0.2, sustain: 0.9, release: 0.12, gain: 0.8 },
  { category: 'Bass', name: 'Acid Bass', type: 'synth', wave: 'sawtooth', cutoff: 500, q: 14, sub: 0.2, attack: 0.004, decay: 0.22, sustain: 0.2, release: 0.1, drive: 0.3, gain: 0.6 },
  { category: 'Bass', name: 'Reese Bass', type: 'synth', wave: 'sawtooth', fat: true, detune: 28, cutoff: 900, q: 3, sub: 0.3, attack: 0.01, decay: 0.3, sustain: 0.7, release: 0.2, drive: 0.2, gain: 0.5 },
  { category: 'Bass', name: 'Donk', type: 'synth', wave: 'square', cutoff: 4200, q: 9, attack: 0.001, decay: 0.09, sustain: 0.0, release: 0.05, drive: 0.25, gain: 0.55 },
  // Lead
  { category: 'Lead', name: 'Lead', type: 'synth', wave: 'square', cutoff: 5000, q: 2, fat: true, attack: 0.01, decay: 0.2, sustain: 0.6, release: 0.25, gain: 0.5 },
  { category: 'Lead', name: 'Supersaw', type: 'synth', wave: 'sawtooth', fat: true, detune: 12, cutoff: 6500, q: 1, attack: 0.02, decay: 0.3, sustain: 0.75, release: 0.4, drive: 0.12, gain: 0.4 },
  { category: 'Lead', name: 'Hoover', type: 'synth', wave: 'sawtooth', fat: true, detune: 22, cutoff: 3800, q: 2, attack: 0.01, decay: 0.25, sustain: 0.7, release: 0.3, drive: 0.35, gain: 0.38 },
  { category: 'Lead', name: 'Screech', type: 'synth', wave: 'sawtooth', fat: true, cutoff: 5200, q: 8, attack: 0.01, decay: 0.3, sustain: 0.6, release: 0.3, drive: 0.5, gain: 0.3 },
  { category: 'Lead', name: 'Saw Lead', type: 'synth', wave: 'sawtooth', cutoff: 5500, q: 1.5, attack: 0.01, decay: 0.2, sustain: 0.7, release: 0.25, gain: 0.4 },
  // Pluck
  { category: 'Pluck', name: 'Pluck', type: 'synth', wave: 'triangle', cutoff: 3500, q: 3, attack: 0.002, decay: 0.16, sustain: 0.0, release: 0.12, gain: 0.6 },
  { category: 'Pluck', name: 'Trance Pluck', type: 'synth', wave: 'sawtooth', cutoff: 4200, q: 5, attack: 0.002, decay: 0.18, sustain: 0.0, release: 0.14, gain: 0.55 },
  { category: 'Pluck', name: 'Glass Pluck', type: 'synth', wave: 'sine', cutoff: 6000, q: 2, attack: 0.001, decay: 0.25, sustain: 0.0, release: 0.2, gain: 0.6 },
  // Pad
  { category: 'Pad', name: 'Trance Pad', type: 'synth', wave: 'sawtooth', fat: true, cutoff: 2600, q: 1, attack: 0.45, decay: 0.6, sustain: 0.85, release: 0.9, gain: 0.32 },
  { category: 'Pad', name: 'Warm Pad', type: 'synth', wave: 'triangle', fat: true, cutoff: 2200, q: 0.8, attack: 0.6, decay: 0.8, sustain: 0.8, release: 1.1, gain: 0.34 },
  { category: 'Pad', name: 'Choir Pad', type: 'synth', wave: 'sawtooth', fat: true, detune: 8, cutoff: 3000, q: 1, attack: 0.5, decay: 0.7, sustain: 0.9, release: 1.0, gain: 0.3 },
  // Keyboard-spezifische Sounds
  { category: 'Keyboard', name: 'Grand Piano', type: 'synth', wave: 'triangle', attack: 0.002, decay: 0.6, sustain: 0.0, release: 0.35, cutoff: 5200, q: 0.8, gain: 0.6 },
  { category: 'Keyboard', name: 'E-Piano', type: 'synth', wave: 'sine', attack: 0.002, decay: 0.5, sustain: 0.2, release: 0.4, cutoff: 4200, q: 0.8, gain: 0.6 },
  { category: 'Keyboard', name: 'Orgel', type: 'synth', wave: 'square', attack: 0.01, decay: 0.2, sustain: 0.9, release: 0.2, cutoff: 4500, q: 0.7, gain: 0.4 },
  { category: 'Keyboard', name: 'Clavinet', type: 'synth', wave: 'square', attack: 0.002, decay: 0.15, sustain: 0.1, release: 0.12, cutoff: 3600, q: 1.5, drive: 0.2, gain: 0.5 },
  { category: 'Keyboard', name: 'Glocken', type: 'synth', wave: 'sine', attack: 0.001, decay: 0.8, sustain: 0.0, release: 0.6, cutoff: 7000, q: 0.8, gain: 0.55 },
  { category: 'Keyboard', name: 'Synth Keys', type: 'synth', wave: 'sawtooth', fat: true, attack: 0.01, decay: 0.3, sustain: 0.6, release: 0.3, cutoff: 5000, q: 1, gain: 0.4 },
  { category: 'Keyboard', name: 'Streicher', type: 'synth', wave: 'sawtooth', fat: true, attack: 0.3, decay: 0.6, sustain: 0.85, release: 0.8, cutoff: 3500, q: 1, gain: 0.34 },
  { category: 'Keyboard', name: 'Cembalo', type: 'synth', wave: 'square', attack: 0.001, decay: 0.4, sustain: 0.0, release: 0.3, cutoff: 5200, q: 1.2, gain: 0.5 },
  // Orchester
  { category: 'Orchestra', name: 'Streicher Ensemble', type: 'synth', wave: 'sawtooth', fat: true, attack: 0.25, decay: 0.5, sustain: 0.9, release: 0.8, cutoff: 3600, q: 0.9, gain: 0.32 },
  { category: 'Orchestra', name: 'Pizzicato', type: 'synth', wave: 'triangle', attack: 0.002, decay: 0.2, sustain: 0.0, release: 0.15, cutoff: 4500, q: 1.5, gain: 0.55 },
  { category: 'Orchestra', name: 'Blechbläser', type: 'synth', wave: 'sawtooth', attack: 0.03, decay: 0.2, sustain: 0.8, release: 0.25, cutoff: 3500, q: 1, drive: 0.15, gain: 0.4 },
  { category: 'Orchestra', name: 'Horn', type: 'synth', wave: 'triangle', attack: 0.05, decay: 0.3, sustain: 0.85, release: 0.4, cutoff: 2800, q: 0.8, gain: 0.45 },
  { category: 'Orchestra', name: 'Flöte', type: 'synth', wave: 'sine', attack: 0.06, decay: 0.2, sustain: 0.9, release: 0.3, cutoff: 6000, q: 0.7, gain: 0.5 },
  { category: 'Orchestra', name: 'Cello', type: 'synth', wave: 'sawtooth', fat: true, attack: 0.08, decay: 0.4, sustain: 0.85, release: 0.5, cutoff: 2000, q: 1, gain: 0.42 },
  { category: 'Orchestra', name: 'Pauke', type: 'drum', drum: 'tom', tune: 90, decay: 0.5, pitched: true, gain: 0.8 },
  // Chiptune
  { category: 'Chiptune', name: 'Square Lead', type: 'synth', wave: 'square', attack: 0.001, decay: 0.05, sustain: 0.9, release: 0.05, cutoff: 8000, q: 0.7, gain: 0.4 },
  { category: 'Chiptune', name: 'Triangle Lead', type: 'synth', wave: 'triangle', attack: 0.001, decay: 0.05, sustain: 0.9, release: 0.05, cutoff: 9000, q: 0.7, gain: 0.5 },
  { category: 'Chiptune', name: 'Pulse Pluck', type: 'synth', wave: 'square', attack: 0.001, decay: 0.12, sustain: 0.0, release: 0.06, cutoff: 7000, q: 1, gain: 0.45 },
  { category: 'Chiptune', name: 'NES Bass', type: 'synth', wave: 'triangle', attack: 0.001, decay: 0.1, sustain: 0.8, release: 0.05, cutoff: 2500, q: 0.7, gain: 0.6 },
  { category: 'Chiptune', name: 'Arp Blip', type: 'synth', wave: 'square', attack: 0.001, decay: 0.06, sustain: 0.0, release: 0.04, cutoff: 9000, q: 1, gain: 0.4 },
  // Mallets & Welt
  { category: 'Mallets', name: 'Marimba', type: 'synth', wave: 'triangle', attack: 0.001, decay: 0.4, sustain: 0.0, release: 0.3, cutoff: 4000, q: 0.9, gain: 0.55 },
  { category: 'Mallets', name: 'Kalimba', type: 'synth', wave: 'sine', attack: 0.001, decay: 0.5, sustain: 0.0, release: 0.35, cutoff: 5000, q: 0.8, gain: 0.55 },
  { category: 'Mallets', name: 'Spieluhr', type: 'synth', wave: 'sine', attack: 0.001, decay: 0.7, sustain: 0.0, release: 0.5, cutoff: 8000, q: 0.8, gain: 0.5 },
  { category: 'Mallets', name: 'Vibraphon', type: 'synth', wave: 'sine', attack: 0.002, decay: 0.8, sustain: 0.2, release: 0.5, cutoff: 5500, q: 0.8, gain: 0.5 },
  { category: 'Mallets', name: 'Steel Drum', type: 'synth', wave: 'triangle', attack: 0.002, decay: 0.5, sustain: 0.1, release: 0.3, cutoff: 4500, q: 1, drive: 0.12, gain: 0.5 }
];

// ---- Genre-Preset-Generator: ~500 Variationen (Trance / EDM / Rock / Metal) ----
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function generateGenrePresets() {
  const rng = mulberry32(20240615);          // fester Seed -> reproduzierbar
  const INT = new Set(['cutoff', 'tune', 'detune']);
  const sample = (k, lo, hi) => { const v = lo + rng() * (hi - lo); return INT.has(k) ? Math.round(v) : +v.toFixed(3); };
  const pick = (arr) => arr[Math.floor(rng() * arr.length)];
  const out = [];

  const specs = {
    Trance: [
      { role: 'Lead', count: 25, type: 'synth', waves: ['sawtooth'], base: { fat: true, q: 1, attack: 0.02, sustain: 0.75 }, vary: { cutoff: [3500, 9000], detune: [4, 24], decay: [0.2, 0.5], release: [0.2, 0.7], drive: [0, 0.3], gain: [0.32, 0.45] } },
      { role: 'Pluck', count: 25, type: 'synth', waves: ['sawtooth', 'triangle'], base: { attack: 0.002, sustain: 0.0 }, vary: { cutoff: [2500, 7000], q: [2, 7], decay: [0.1, 0.25], release: [0.08, 0.2], gain: [0.45, 0.6] } },
      { role: 'Bass', count: 20, type: 'synth', waves: ['sawtooth'], base: { sub: 0.5, attack: 0.004, sustain: 0.25 }, vary: { cutoff: [350, 1100], q: [3, 9], decay: [0.12, 0.3], release: [0.06, 0.15], drive: [0, 0.25], gain: [0.5, 0.7] } },
      { role: 'Pad', count: 20, type: 'synth', waves: ['sawtooth', 'triangle'], base: { fat: true, attack: 0.4, sustain: 0.85 }, vary: { cutoff: [1800, 4000], q: [0.7, 1.5], decay: [0.4, 0.8], release: [0.7, 1.3], gain: [0.28, 0.36] } },
      { role: 'Stab', count: 20, type: 'synth', waves: ['sawtooth', 'square'], base: { fat: true, attack: 0.005, sustain: 0.3 }, vary: { cutoff: [2500, 6000], q: [1, 5], decay: [0.15, 0.35], release: [0.15, 0.4], detune: [6, 20], gain: [0.35, 0.48] } },
      { role: 'Arp', count: 15, type: 'synth', waves: ['square', 'sawtooth'], base: { attack: 0.002, sustain: 0.0 }, vary: { cutoff: [3000, 8000], q: [1, 6], decay: [0.08, 0.2], release: [0.06, 0.15], gain: [0.4, 0.55] } }
    ],
    EDM: [
      { role: 'Lead', count: 25, type: 'synth', waves: ['sawtooth', 'square'], base: { fat: true, attack: 0.01, sustain: 0.7 }, vary: { cutoff: [3000, 9000], detune: [8, 30], decay: [0.2, 0.5], release: [0.2, 0.5], drive: [0.1, 0.45], gain: [0.32, 0.46] } },
      { role: 'Bass', count: 25, type: 'synth', waves: ['sawtooth', 'square'], base: { attack: 0.003, sustain: 0.3 }, vary: { cutoff: [300, 1200], q: [2, 8], decay: [0.1, 0.3], release: [0.05, 0.15], drive: [0.1, 0.5], sub: [0, 0.5], gain: [0.5, 0.68] } },
      { role: 'Pluck', count: 20, type: 'synth', waves: ['sawtooth', 'triangle'], base: { attack: 0.002, sustain: 0.0 }, vary: { cutoff: [2500, 7000], q: [2, 7], decay: [0.1, 0.25], release: [0.08, 0.2], gain: [0.45, 0.6] } },
      { role: 'Pad', count: 15, type: 'synth', waves: ['sawtooth'], base: { fat: true, attack: 0.35, sustain: 0.85 }, vary: { cutoff: [2000, 4500], q: [0.8, 1.6], decay: [0.4, 0.8], release: [0.6, 1.2], gain: [0.28, 0.36] } },
      { role: 'Stab', count: 20, type: 'synth', waves: ['square', 'sawtooth'], base: { fat: true, attack: 0.004, sustain: 0.25 }, vary: { cutoff: [2500, 6500], q: [1, 5], decay: [0.12, 0.3], release: [0.1, 0.3], drive: [0.1, 0.4], gain: [0.35, 0.48] } },
      { role: 'Wobble', count: 20, type: 'synth', waves: ['sawtooth'], base: { fat: true, sub: 0.3, attack: 0.005, sustain: 0.5 }, vary: { cutoff: [350, 1500], q: [6, 16], decay: [0.15, 0.4], release: [0.1, 0.3], drive: [0.2, 0.6], detune: [10, 30], gain: [0.4, 0.55] } }
    ],
    Rock: [
      { role: 'Guitar', count: 25, type: 'synth', waves: ['square', 'sawtooth'], base: { attack: 0.005, sustain: 0.5 }, vary: { cutoff: [1800, 3800], q: [1.5, 4], decay: [0.2, 0.5], release: [0.15, 0.35], drive: [0.35, 0.7], gain: [0.34, 0.46] } },
      { role: 'Lead', count: 20, type: 'synth', waves: ['square', 'sawtooth'], base: { attack: 0.006, sustain: 0.6 }, vary: { cutoff: [2500, 5500], q: [1, 3], decay: [0.2, 0.5], release: [0.2, 0.45], drive: [0.25, 0.55], gain: [0.34, 0.46] } },
      { role: 'Bass', count: 20, type: 'synth', waves: ['sawtooth', 'triangle'], base: { attack: 0.004, sustain: 0.5 }, vary: { cutoff: [500, 1400], q: [1.5, 4], decay: [0.2, 0.5], release: [0.1, 0.25], drive: [0.1, 0.4], gain: [0.5, 0.66] } },
      { role: 'Organ', count: 15, type: 'synth', waves: ['sine', 'triangle'], base: { attack: 0.01, sustain: 0.85 }, vary: { cutoff: [2500, 6000], q: [0.7, 2], decay: [0.2, 0.5], release: [0.15, 0.4], gain: [0.4, 0.55] } },
      { role: 'Kick', count: 10, type: 'drum', drum: 'kick', base: { click: 0.4 }, vary: { tune: [45, 70], decay: [0.25, 0.45], drive: [0, 0.2], gain: [0.85, 0.95] } },
      { role: 'Snare', count: 10, type: 'drum', drum: 'snare', base: {}, vary: { tune: [150, 260], decay: [0.12, 0.25], gain: [0.6, 0.8] } },
      { role: 'Tom', count: 10, type: 'drum', drum: 'tom', base: { pitched: true }, vary: { tune: [80, 200], decay: [0.2, 0.45], gain: [0.6, 0.8] } },
      { role: 'Pad', count: 15, type: 'synth', waves: ['sawtooth', 'triangle'], base: { fat: true, attack: 0.3, sustain: 0.8 }, vary: { cutoff: [1800, 4000], q: [0.7, 1.5], decay: [0.4, 0.8], release: [0.6, 1.1], gain: [0.28, 0.36] } }
    ],
    Metal: [
      { role: 'Guitar', count: 30, type: 'synth', waves: ['square', 'sawtooth'], base: { attack: 0.004, sustain: 0.45 }, vary: { cutoff: [1100, 2600], q: [2, 5], decay: [0.15, 0.4], release: [0.1, 0.3], drive: [0.6, 0.95], gain: [0.3, 0.42] } },
      { role: 'Chug Bass', count: 25, type: 'synth', waves: ['sawtooth', 'square'], base: { attack: 0.003, sustain: 0.35 }, vary: { cutoff: [350, 1000], q: [2, 6], decay: [0.1, 0.28], release: [0.06, 0.16], drive: [0.4, 0.8], sub: [0.1, 0.4], gain: [0.48, 0.64] } },
      { role: 'Lead', count: 20, type: 'synth', waves: ['square', 'sawtooth'], base: { fat: true, attack: 0.006, sustain: 0.6 }, vary: { cutoff: [2500, 6000], q: [1, 4], decay: [0.2, 0.5], release: [0.2, 0.5], drive: [0.4, 0.8], detune: [4, 16], gain: [0.3, 0.42] } },
      { role: 'Kick', count: 15, type: 'drum', drum: 'kick', base: { click: 0.7 }, vary: { tune: [50, 80], decay: [0.1, 0.22], drive: [0.3, 0.7], gain: [0.85, 0.97] } },
      { role: 'Snare', count: 15, type: 'drum', drum: 'snare', base: {}, vary: { tune: [180, 320], decay: [0.1, 0.2], drive: [0, 0.3], gain: [0.65, 0.82] } },
      { role: 'Tom', count: 10, type: 'drum', drum: 'tom', base: { pitched: true }, vary: { tune: [90, 220], decay: [0.18, 0.4], gain: [0.6, 0.8] } },
      { role: 'Growl', count: 10, type: 'synth', waves: ['sawtooth'], base: { fat: true, sub: 0.3, attack: 0.005, sustain: 0.5 }, vary: { cutoff: [300, 1200], q: [6, 14], decay: [0.15, 0.4], release: [0.1, 0.3], drive: [0.5, 0.9], detune: [10, 28], gain: [0.4, 0.55] } }
    ]
  };

  for (const genre of Object.keys(specs)) {
    for (const role of specs[genre]) {
      for (let n = 1; n <= role.count; n++) {
        const p = Object.assign({ category: genre, name: `${genre} ${role.role} ${String(n).padStart(2, '0')}`, type: role.type }, role.base);
        if (role.drum) p.drum = role.drum;
        if (role.waves) p.wave = pick(role.waves);
        for (const k of Object.keys(role.vary || {})) p[k] = sample(k, role.vary[k][0], role.vary[k][1]);
        out.push(p);
      }
    }
  }
  return out;
}

PRESETS.push(...generateGenrePresets());

/** Kategorien in Reihenfolge ihres ersten Auftretens. */
export function presetCategories() {
  const seen = [];
  for (const p of PRESETS) if (!seen.includes(p.category)) seen.push(p.category);
  return seen;
}

const presetByName = (name) => PRESETS.find((p) => p.name === name) || PRESETS[0];

/** Tiefe Kopie eines Instruments mit neuer ID (Sample-Buffer wird geteilt). */
export function cloneInstrument(inst) {
  const copy = JSON.parse(JSON.stringify({ ...inst, buffer: undefined }));
  delete copy.id;
  copy.name = (inst.name || 'Instrument') + ' Kopie';
  const out = createInstrument(copy);
  if (inst.type === 'sample') out.buffer = inst.buffer || null;
  return out;
}

/** Die Standard-Instrumente (von Default- und Leerprojekt genutzt). */
export function defaultInstruments() {
  const names = ['Kick', 'Clap', 'Hat (zu)', 'Hat (offen)', 'Snare', 'Bass', 'Lead', 'Pluck',
    'Hardstyle Kick', 'Supersaw', 'Trance Pluck', 'Trance Pad', 'Hoover', 'Screech', 'Acid Bass', 'Sub Bass'];
  return names.map((n) => createInstrument(presetByName(n)));
}

/** Leeres Projekt: Instrumente bleiben, aber Tracker & Arranger sind komplett leer. */
export function emptyProject() {
  const song = createSong();
  song.instruments = defaultInstruments();
  song.patterns = [createPattern('Pattern', song.channels, 16)];
  song.order = [0];
  // song.arrangement ist durch createSong() bereits leer
  return { version: 1, song };
}

/** Standardprojekt mit Instrumenten und einem treibenden Techno-Demo-Beat. */
export function defaultProject() {
  const song = createSong();
  const all = defaultInstruments();
  song.instruments = all;
  const [kick, clap, chat, ohat, snare, bass, lead, pluck] = all;

  // ----- Pattern A: Beat + Bassline -----
  const A = createPattern('A — Beat', song.channels, 16);
  // Four-on-the-floor Kick
  [0, 4, 8, 12].forEach((r) => setCell(A, r, 0, 60, kick.id));
  // Clap auf 2 und 4
  [4, 12].forEach((r) => setCell(A, r, 1, 60, clap.id));
  // Closed Hats auf jedem Offbeat
  [2, 6, 10, 14].forEach((r) => setCell(A, r, 2, 60, chat.id));
  // Open Hat
  [7, 15].forEach((r) => setCell(A, r, 3, 60, ohat.id));
  // Bassline (Achtel, A1-Wurzel mit kleinen Bewegungen)
  const bassNotes = [33, 33, 33, 36, 33, 33, 40, 33, 33, 33, 33, 36, 33, 31, 33, 36];
  bassNotes.forEach((m, r) => setCell(A, r, 4, m, bass.id));

  // ----- Pattern B: + Lead/Pluck -----
  const B = createPattern('B — Lead', song.channels, 16);
  [0, 4, 8, 12].forEach((r) => setCell(B, r, 0, 60, kick.id));
  [4, 12].forEach((r) => setCell(B, r, 1, 60, clap.id));
  [2, 6, 10, 14].forEach((r) => setCell(B, r, 2, 60, chat.id));
  bassNotes.forEach((m, r) => setCell(B, r, 4, m, bass.id));
  // Pluck-Arpeggio
  const arp = [57, 60, 64, 60, 57, 60, 64, 67, 64, 60, 57, 60, 64, 67, 64, 60];
  arp.forEach((m, r) => setCell(B, r, 5, m, pluck.id));
  // Lead-Akzente
  [0, 8].forEach((r) => setCell(B, r, 6, 69, lead.id));

  song.patterns = [A, B];
  song.order = [0, 0, 1, 1];

  // ----- Arranger-Demo (Music-Maker-Ansicht) -----
  const clips = [];
  [0, 1, 2, 3, 4, 5, 6, 7].forEach((b) => clips.push(createClip({ track: 0, startBeat: b, lengthBeats: 1, inst: kick.id, midi: 60 })));
  [1, 3, 5, 7].forEach((b) => clips.push(createClip({ track: 1, startBeat: b, lengthBeats: 1, inst: clap.id, midi: 60 })));
  [[0, 33], [1, 33], [2, 36], [3, 33], [4, 40], [5, 33], [6, 36], [7, 31]]
    .forEach(([b, m]) => clips.push(createClip({ track: 2, startBeat: b, lengthBeats: 1, inst: bass.id, midi: m })));
  [[0, 69], [4, 72]].forEach(([b, m]) => clips.push(createClip({ track: 3, startBeat: b, lengthBeats: 4, inst: lead.id, midi: m })));
  // Melodie-Clip (Piano-Roll) auf Spur 5
  clips.push(createClip({
    track: 4, startBeat: 0, lengthBeats: 4, inst: pluck.id, midi: 72, notes: [
      { beat: 0, length: 0.5, midi: 72 }, { beat: 0.5, length: 0.5, midi: 74 },
      { beat: 1, length: 0.5, midi: 76 }, { beat: 1.5, length: 0.5, midi: 74 },
      { beat: 2, length: 1, midi: 72 }, { beat: 3, length: 1, midi: 67 }
    ]
  }));
  song.arrangement = { tracks: 8, bars: 8, clips };

  return { version: 1, song };
}
