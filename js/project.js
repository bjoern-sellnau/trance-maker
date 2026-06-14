// Projekt speichern/laden (.trance = JSON, Samples als eingebettetes Base64-WAV)
// sowie WAV-Export des gerenderten Songs.

import { getCtx } from './audio/context.js';
import { audioBufferToBase64Wav, base64ToArrayBuffer, wavBlob } from './audio/wav.js';
import { renderSong } from './audio/render.js';
import { downloadBlob } from './util.js';

function serializeInstrument(inst) {
  const { buffer, ...rest } = inst;
  if (inst.type === 'sample') {
    rest.sampleData = inst.buffer ? audioBufferToBase64Wav(inst.buffer) : (inst.sampleData || null);
    rest.sampleRate = inst.buffer ? inst.buffer.sampleRate : (inst.sampleRate || 44100);
  } else {
    delete rest.sampleData;
  }
  return rest;
}

/** Projekt -> JSON-String (.trance-Inhalt). */
export function serializeProject(project) {
  const song = project.song;
  const out = {
    version: 1,
    song: {
      title: song.title,
      bpm: song.bpm,
      rowsPerBeat: song.rowsPerBeat,
      channels: song.channels,
      instruments: song.instruments.map(serializeInstrument),
      patterns: song.patterns.map((p) => ({
        id: p.id, name: p.name, rows: p.rows,
        cells: p.cells   // bereits JSON-sicher (null | {midi,inst} | {off:true})
      })),
      order: song.order.slice(),
      arrangement: song.arrangement
        ? { tracks: song.arrangement.tracks, bars: song.arrangement.bars, clips: song.arrangement.clips }
        : { tracks: 8, bars: 8, clips: [] }
    }
  };
  return JSON.stringify(out);
}

/** JSON (String oder Objekt) -> Projekt; dekodiert eingebettete Samples. */
export async function deserializeProject(json) {
  const project = typeof json === 'string' ? JSON.parse(json) : json;
  if (!project || !project.song) throw new Error('Ungültige Projektdatei.');
  const song = project.song;

  // Pflichtfelder absichern
  song.bpm = song.bpm || 138;
  song.rowsPerBeat = song.rowsPerBeat || 4;
  song.channels = song.channels || 8;
  song.instruments = song.instruments || [];
  song.patterns = song.patterns || [];
  song.order = song.order || [];
  if (!song.arrangement) song.arrangement = { tracks: 8, bars: 8, clips: [] };
  song.arrangement.tracks = song.arrangement.tracks || 8;
  song.arrangement.bars = song.arrangement.bars || 8;
  song.arrangement.clips = song.arrangement.clips || [];

  for (const inst of song.instruments) {
    if (inst.mute == null) inst.mute = false;
    if (inst.solo == null) inst.solo = false;
    if (inst.volume == null) inst.volume = 0.85;
    if (inst.type === 'sample' && inst.sampleData) {
      try {
        const ab = base64ToArrayBuffer(inst.sampleData);
        inst.buffer = await getCtx().decodeAudioData(ab.slice(0));
      } catch (e) {
        console.warn('Sample konnte nicht dekodiert werden:', inst.name, e);
        inst.buffer = null;
      }
    }
  }
  return project;
}

/** Beliebige Audiodatei (ArrayBuffer) zu AudioBuffer dekodieren. */
export async function decodeAudioFile(arrayBuffer) {
  return getCtx().decodeAudioData(arrayBuffer.slice(0));
}

export function saveProjectToFile(project) {
  const json = serializeProject(project);
  const name = (project.song.title || 'track').replace(/[^\w\-]+/g, '_');
  downloadBlob(new Blob([json], { type: 'application/json' }), name + '.trance');
}

export async function openProjectFromFile(file) {
  const text = await file.text();
  return deserializeProject(text);
}

/** Ganzen Song zu WAV rendern und als Download anbieten. */
export async function exportSongWav(app) {
  const buffer = await renderSong(app);
  const name = (app.project.song.title || 'track').replace(/[^\w\-]+/g, '_');
  downloadBlob(wavBlob(buffer), name + '.wav');
  return buffer;
}
