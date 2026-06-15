// Rendert den Song offline (schneller als Echtzeit) zu einem AudioBuffer.
// mode: 'tracker' (Pattern/Order) oder 'arranger' (Music-Maker-Zeitleiste).

import { triggerInstrument } from './instruments.js';
import { arrangementEndBeats, BEATS_PER_BAR, clipTriggers } from '../model.js';

export async function renderSong(app, { sampleRate = 44100, tail = 2.5, mode } = {}) {
  const song = app.project.song;
  mode = mode || app.viewMode || 'tracker';

  // Gesamtlänge bestimmen
  let totalSec;
  if (mode === 'arranger') {
    const spb = 60 / song.bpm;
    totalSec = Math.max(arrangementEndBeats(song.arrangement), BEATS_PER_BAR) * spb;
  } else {
    const spr = 60 / (song.bpm * song.rowsPerBeat);
    let totalRows = 0;
    const order = song.order.length ? song.order : song.patterns.map((_, i) => i);
    for (const oi of order) { const p = song.patterns[oi]; if (p) totalRows += p.rows; }
    if (totalRows === 0) totalRows = 16;
    totalSec = totalRows * spr;
  }

  const length = Math.ceil(sampleRate * (totalSec + tail));
  const offline = new OfflineAudioContext(2, length, sampleRate);

  // Master-Kette (entspricht der Live-Kette)
  const master = offline.createGain();
  master.gain.value = 0.72;
  const comp = offline.createDynamicsCompressor();
  comp.threshold.value = -8; comp.knee.value = 30; comp.ratio.value = 8;
  comp.attack.value = 0.003; comp.release.value = 0.25;
  master.connect(comp); comp.connect(offline.destination);

  // Pro-Instrument-Gain (Mixer/Mute/Solo)
  const anySolo = song.instruments.some((i) => i.solo);
  const nodes = new Map();
  for (const inst of song.instruments) {
    const g = offline.createGain();
    const audible = !inst.mute && (!anySolo || inst.solo);
    g.gain.value = audible ? inst.volume : 0;
    g.connect(master);
    nodes.set(inst.id, g);
  }

  if (mode === 'arranger') {
    const spb = 60 / song.bpm;
    for (const clip of (song.arrangement.clips || [])) {
      const inst = app.getInstrument(clip.inst);
      if (!inst) continue;
      const target = nodes.get(inst.id) || master;
      for (const tr of clipTriggers(clip, inst, spb)) {
        triggerInstrument(offline, target, inst, clip.midi, (clip.startBeat + tr.offsetBeats) * spb, { duration: tr.durBeats * spb });
      }
    }
  } else {
    const spr = 60 / (song.bpm * song.rowsPerBeat);
    const order = song.order.length ? song.order : song.patterns.map((_, i) => i);
    let t = 0;
    const channelVoice = [];
    for (const oi of order) {
      const pat = song.patterns[oi];
      if (!pat) continue;
      for (let r = 0; r < pat.rows; r++) {
        for (let ch = 0; ch < song.channels; ch++) {
          if (app.mutedChannels.has(ch)) continue;
          const cell = pat.cells[r][ch];
          if (!cell) continue;
          if (cell.off) {
            if (channelVoice[ch]) channelVoice[ch].stop(t);
            channelVoice[ch] = null;
            continue;
          }
          const inst = app.getInstrument(cell.inst);
          if (!inst) continue;
          if (channelVoice[ch]) channelVoice[ch].stop(t);
          channelVoice[ch] = triggerInstrument(offline, nodes.get(inst.id) || master, inst, cell.midi, t, {});
        }
        t += spr;
      }
    }
  }

  const buffer = await offline.startRendering();

  // Sicherheits-Normalisierung: garantiert kein Clipping in der exportierten Datei.
  let peak = 0;
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    const d = buffer.getChannelData(c);
    for (let i = 0; i < d.length; i++) { const a = Math.abs(d[i]); if (a > peak) peak = a; }
  }
  if (peak > 0.99) {
    const g = 0.99 / peak;
    for (let c = 0; c < buffer.numberOfChannels; c++) {
      const d = buffer.getChannelData(c);
      for (let i = 0; i < d.length; i++) d[i] *= g;
    }
  }
  return buffer;
}
