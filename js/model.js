// Datenmodell: Song, Pattern, Instrumente + Standardprojekt mit Demo-Beat.

import { uid } from './util.js';

/** Instrument mit sinnvollen Defaults je Typ erzeugen. */
export function createInstrument(opts = {}) {
  const base = {
    id: uid('inst'),
    name: opts.name || 'Instrument',
    type: opts.type || 'synth',
    volume: opts.volume ?? 0.85,   // Mixer-Lautstärke
    mute: false,
    solo: false
  };
  if (base.type === 'synth') {
    return Object.assign(base, {
      wave: 'sawtooth', attack: 0.005, decay: 0.12, sustain: 0.7, release: 0.18,
      cutoff: 4000, q: 1, sub: 0, fat: false, detune: 0, gain: 0.8
    }, opts);
  }
  if (base.type === 'drum') {
    return Object.assign(base, {
      drum: 'kick', tune: 50, decay: 0.34, click: 0.3, pitched: false, baseNote: 60, gain: 0.9
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

const setCell = (pat, row, ch, midi, instId) => { pat.cells[row][ch] = { midi, inst: instId }; };

/** Standardprojekt mit Instrumenten und einem treibenden Techno-Demo-Beat. */
export function defaultProject() {
  const song = createSong();

  const kick = createInstrument({ name: 'Kick', type: 'drum', drum: 'kick', tune: 50, decay: 0.36, click: 0.35 });
  const clap = createInstrument({ name: 'Clap', type: 'drum', drum: 'clap', decay: 0.22, gain: 0.8 });
  const chat = createInstrument({ name: 'Hat (zu)', type: 'drum', drum: 'hat', decay: 0.04, cutoff: 8000, gain: 0.5 });
  const ohat = createInstrument({ name: 'Hat (offen)', type: 'drum', drum: 'hat', decay: 0.28, cutoff: 7000, gain: 0.45 });
  const snare = createInstrument({ name: 'Snare', type: 'drum', drum: 'snare', tune: 190, decay: 0.18, gain: 0.7 });
  const bass = createInstrument({
    name: 'Bass', type: 'synth', wave: 'sawtooth', cutoff: 700, q: 6, sub: 0.6,
    attack: 0.004, decay: 0.18, sustain: 0.2, release: 0.08, gain: 0.85
  });
  const lead = createInstrument({
    name: 'Lead', type: 'synth', wave: 'square', cutoff: 5000, q: 2, fat: true,
    attack: 0.01, decay: 0.2, sustain: 0.6, release: 0.25, gain: 0.5
  });
  const pluck = createInstrument({
    name: 'Pluck', type: 'synth', wave: 'triangle', cutoff: 3500, q: 3,
    attack: 0.002, decay: 0.16, sustain: 0.0, release: 0.12, gain: 0.6
  });

  song.instruments = [kick, clap, chat, ohat, snare, bass, lead, pluck];

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
  song.arrangement = { tracks: 8, bars: 8, clips };

  return { version: 1, song };
}
