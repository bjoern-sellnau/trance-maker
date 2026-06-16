// 6 Demo-Songs, algorithmisch erzeugt – als spielbare Arranger-Projekte.
// Jeder Song hat Schlagzeug, Bass, Pluck/Arp, Lead und Pad mit Intro/Break/Outro.

import { createSong, createInstrument, createClip, createPattern, PRESETS } from './model.js';

const SCALES = { minor: [0, 2, 3, 5, 7, 8, 10], major: [0, 2, 4, 5, 7, 9, 11] };
const STEP = 0.25;

function degToMidi(root, scaleName, degree) {
  const s = SCALES[scaleName] || SCALES.minor;
  const len = s.length;
  const oct = Math.floor(degree / len);
  const idx = ((degree % len) + len) % len;
  return root + oct * 12 + s[idx];
}

function presetInst(name) {
  const p = PRESETS.find((x) => x.name === name);
  return createInstrument(p || { type: 'synth', name });
}

// ----- 16-Step-Schlagzeugmuster -----
const KICK_4 = [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0];
const CLAP_24 = [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0];
const HAT_OFF = [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0];
const HAT_16 = [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1];
const OHAT = [0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1];

// ----- Tonale Lanes (geben pro Takt Noten zurück) -----
function bassDriving(octShift, motif) {
  return (bar, root, scale) => {
    const out = [];
    for (let i = 0; i < 8; i++) out.push({ beat: bar * 4 + i * 0.5, length: 0.45, midi: degToMidi(root + octShift, scale, motif[i % motif.length]) });
    return out;
  };
}
function bassOffbeat(octShift) {
  return (bar, root, scale) => {
    const out = [];
    for (let b = 0; b < 4; b++) out.push({ beat: bar * 4 + b + 0.5, length: 0.4, midi: degToMidi(root + octShift, scale, 0) });
    return out;
  };
}
function arpLane(octShift, degs, len) {
  return (bar, root, scale) => {
    const out = [];
    for (let s = 0; s < 16; s++) out.push({ beat: bar * 4 + s * STEP, length: len || STEP * 0.9, midi: degToMidi(root + octShift, scale, degs[s % degs.length]) });
    return out;
  };
}
function chordLane(octShift, degs) {
  return (bar, root, scale) => degs.map((d) => ({ beat: bar * 4, length: 4, midi: degToMidi(root + octShift, scale, d) }));
}
function leadLane(octShift, seq) {
  return (bar, root, scale) => seq.map((n) => ({ beat: bar * 4 + n.step * STEP, length: (n.len || 4) * STEP, midi: degToMidi(root + octShift, scale, n.deg) }));
}

function defaultSections(bar, bars) {
  const intro = Math.min(8, Math.floor(bars * 0.12));
  const outro = Math.min(8, Math.floor(bars * 0.12));
  const brkStart = Math.floor(bars * 0.45);
  const brkLen = Math.min(8, Math.max(4, Math.floor(bars * 0.08)));
  const inIntro = bar < intro;
  const inOutro = bar >= bars - outro;
  const inBreak = bar >= brkStart && bar < brkStart + brkLen;
  return {
    drums: (!inIntro || bar >= Math.floor(intro / 2)) && !inBreak,
    bass: !inIntro && !inBreak,
    pluck: !inBreak,
    lead: !inIntro && !inOutro && !inBreak,
    pad: true
  };
}

const DRUM_KEYS = ['kick', 'clap', 'hat', 'ohat', 'perc'];
const LANE_ORDER = ['kick', 'clap', 'hat', 'ohat', 'perc', 'bass', 'pluck', 'lead', 'pad'];

function buildSong(cfg) {
  const song = createSong();
  song.title = cfg.title;
  song.bpm = cfg.bpm;
  const secPerBar = 240 / cfg.bpm;
  const bars = Math.max(16, Math.round(cfg.seconds / secPerBar));
  const totalBeats = bars * 4;
  const scale = cfg.scale || 'minor';

  const I = {};
  for (const [k, name] of Object.entries(cfg.insts)) { const inst = presetInst(name); I[k] = inst; song.instruments.push(inst); }

  const rootAt = (bar) => cfg.rootBase + cfg.progression[Math.floor(bar / (cfg.chordBars || 4)) % cfg.progression.length];
  const sectionAt = cfg.sections || defaultSections;

  const lanes = {};
  const add = (k, n) => { (lanes[k] || (lanes[k] = [])).push(n); };

  for (let bar = 0; bar < bars; bar++) {
    const root = rootAt(bar);
    const s = sectionAt(bar, bars);
    if (s.drums && cfg.drums) {
      for (const dk of DRUM_KEYS) {
        const pat = cfg.drums[dk];
        if (!pat || !I[dk]) continue;
        for (let st = 0; st < 16; st++) if (pat[st]) add(dk, { beat: bar * 4 + st * STEP, length: 0.22, midi: 60 });
      }
    }
    if (s.bass && I.bass && cfg.bass) for (const n of cfg.bass(bar, root, scale)) add('bass', n);
    if (s.pluck && I.pluck && cfg.pluck) for (const n of cfg.pluck(bar, root, scale)) add('pluck', n);
    if (s.lead && I.lead && cfg.lead) for (const n of cfg.lead(bar, root, scale)) add('lead', n);
    if (s.pad && I.pad && cfg.pad) for (const n of cfg.pad(bar, root, scale)) add('pad', n);
  }

  let track = 0;
  const clips = [];
  for (const k of LANE_ORDER) {
    if (I[k] && lanes[k] && lanes[k].length) clips.push(createClip({ track: track++, startBeat: 0, lengthBeats: totalBeats, inst: I[k].id, midi: 60, notes: lanes[k] }));
  }
  song.arrangement = { tracks: Math.max(8, track), bars, clips };
  song.patterns = [createPattern('Pattern', song.channels, 16)];
  song.order = [0];
  return { version: 1, song };
}

// ----- Konfigurationen der 6 Songs -----
const DEMOS = {
  trance: {
    title: 'Trance Demo', bpm: 138, seconds: 160, scale: 'minor', rootBase: 48, chordBars: 4, progression: [0, -4, 3, -2],
    insts: { kick: 'Kick', clap: 'Clap', hat: 'Hat (zu)', ohat: 'Hat (offen)', bass: 'Bass', pluck: 'Trance Pluck', lead: 'Supersaw', pad: 'Trance Pad' },
    drums: { kick: KICK_4, clap: CLAP_24, hat: HAT_OFF, ohat: OHAT },
    bass: bassDriving(-12, [0, 0, 0, 0]),
    pluck: arpLane(12, [0, 2, 4, 2]),
    lead: leadLane(12, [{ step: 0, deg: 0, len: 6 }, { step: 8, deg: 4, len: 6 }]),
    pad: chordLane(0, [0, 2, 4])
  },
  hardstyle: {
    title: 'Hardstyle Demo', bpm: 150, seconds: 270, scale: 'minor', rootBase: 48, chordBars: 4, progression: [0, -2, -4, -5],
    insts: { kick: 'Hardstyle Kick', clap: 'Clap', hat: 'Hat (zu)', bass: 'Sub Bass', pluck: 'Screech', lead: 'Supersaw', pad: 'Trance Pad' },
    drums: { kick: KICK_4, clap: CLAP_24, hat: HAT_OFF },
    bass: bassDriving(-12, [0]),
    pluck: arpLane(0, [0, 0, 3, 2], STEP),
    lead: leadLane(12, [{ step: 0, deg: 0, len: 8 }, { step: 8, deg: 3, len: 8 }]),
    pad: chordLane(0, [0, 2, 4])
  },
  edm: {
    title: 'EDM Demo', bpm: 128, seconds: 210, scale: 'minor', rootBase: 48, chordBars: 4, progression: [0, 3, -2, -4],
    insts: { kick: 'Kick', clap: 'Clap', hat: 'Hat (zu)', ohat: 'Hat (offen)', bass: 'House Bass', pluck: 'Pluck', lead: 'Supersaw', pad: 'Choir Pad' },
    drums: { kick: KICK_4, clap: CLAP_24, hat: HAT_OFF, ohat: OHAT },
    bass: bassDriving(-12, [0, 0, 0, 0]),
    pluck: arpLane(12, [0, 2, 4, 7]),
    lead: leadLane(12, [{ step: 0, deg: 0, len: 4 }, { step: 4, deg: 4, len: 4 }, { step: 8, deg: 2, len: 4 }, { step: 12, deg: 4, len: 4 }]),
    pad: chordLane(0, [0, 2, 4])
  },
  happyhardcore: {
    title: '90s Happy Hardcore Demo', bpm: 170, seconds: 200, scale: 'major', rootBase: 48, chordBars: 4, progression: [0, 7, 9, 5],
    insts: { kick: 'Kick', clap: 'Clap', hat: 'Hat (zu)', bass: 'House Bass', pluck: 'Piano Stab', lead: 'Hoover', pad: 'Trance Pad' },
    drums: { kick: KICK_4, clap: CLAP_24, hat: HAT_16 },
    bass: bassDriving(-12, [0, 0, 0, 0]),
    pluck: arpLane(0, [0, 2, 4, 7]),
    lead: leadLane(12, [{ step: 0, deg: 4, len: 4 }, { step: 4, deg: 2, len: 4 }, { step: 8, deg: 0, len: 6 }, { step: 14, deg: 2, len: 2 }]),
    pad: chordLane(0, [0, 2, 4])
  },
  trance90s: {
    title: '90s Trance Demo', bpm: 140, seconds: 360, scale: 'minor', rootBase: 48, chordBars: 4, progression: [0, -4, 3, -2],
    insts: { kick: 'Kick', clap: 'Clap', hat: 'Hat (zu)', ohat: 'Hat (offen)', bass: 'Bass', pluck: 'Saw Lead', lead: 'Supersaw', pad: 'Warm Pad' },
    drums: { kick: KICK_4, clap: CLAP_24, hat: HAT_OFF, ohat: OHAT },
    bass: bassOffbeat(-12),
    pluck: arpLane(12, [0, 2, 4, 2, 7, 4, 2, 0]),
    lead: leadLane(12, [{ step: 0, deg: 0, len: 6 }, { step: 8, deg: 4, len: 6 }]),
    pad: chordLane(0, [0, 2, 4])
  },
  eurodance: {
    title: '90s Eurodance Demo', bpm: 135, seconds: 240, scale: 'minor', rootBase: 48, chordBars: 4, progression: [0, 3, -2, -4],
    insts: { kick: 'Kick', clap: 'Clap', hat: 'Hat (zu)', ohat: 'Hat (offen)', bass: 'House Bass', pluck: 'Organ Stab', lead: 'Supersaw', pad: 'Piano Stab' },
    drums: { kick: KICK_4, clap: CLAP_24, hat: HAT_OFF, ohat: OHAT },
    bass: bassOffbeat(-12),
    pluck: arpLane(0, [0, 2, 4]),
    lead: leadLane(12, [{ step: 0, deg: 0, len: 4 }, { step: 4, deg: 2, len: 4 }, { step: 8, deg: 3, len: 4 }, { step: 12, deg: 2, len: 4 }]),
    pad: chordLane(0, [0, 2, 4])
  }
};

export const DEMO_LIST = [
  { id: 'trance', label: '1) Trance (≈2:40)' },
  { id: 'hardstyle', label: '2) Hardstyle (≈4:30)' },
  { id: 'edm', label: '3) EDM (≈3:30)' },
  { id: 'happyhardcore', label: '4) 90s Happy Hardcore (≈3:20)' },
  { id: 'trance90s', label: '5) 90s Trance (≈6:00)' },
  { id: 'eurodance', label: '6) 90s Eurodance (≈4:00)' }
];

export function buildDemo(id) {
  const cfg = DEMOS[id];
  if (!cfg) throw new Error('Unbekannter Demo-Song: ' + id);
  return buildSong(cfg);
}
