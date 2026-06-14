// Tests für die browser-unabhängige Kernlogik (laufen mit `npm test`).
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { midiToFreq, midiToName } from '../js/util.js';
import { defaultProject, emptyProject, createInstrument, createPattern, createClip, arrangementEndBeats } from '../js/model.js';
import { encodeWAV, arrayBufferToBase64, base64ToArrayBuffer, audioBufferToBase64Wav } from '../js/audio/wav.js';
import { serializeProject, deserializeProject } from '../js/project.js';

// ---- util ----
test('midiToFreq: A4 = 440 Hz', () => {
  assert.ok(Math.abs(midiToFreq(69) - 440) < 1e-9);
  assert.ok(Math.abs(midiToFreq(60) - 261.625565) < 1e-3); // C4
});

test('midiToName', () => {
  assert.equal(midiToName(60), 'C-4');
  assert.equal(midiToName(61), 'C#4');
  assert.equal(midiToName(null), '···');
});

// ---- model ----
test('defaultProject: Struktur und Demo-Beat', () => {
  const { song } = defaultProject();
  assert.equal(song.instruments.length, 8);
  assert.equal(song.patterns.length, 2);
  assert.deepEqual(song.order, [0, 0, 1, 1]);
  // Kick auf Reihe 0, Kanal 0 in Pattern A
  const kickId = song.instruments[0].id;
  assert.equal(song.patterns[0].cells[0][0].inst, kickId);
});

test('createInstrument: Defaults je Typ', () => {
  const s = createInstrument({ type: 'synth' });
  assert.equal(s.wave, 'sawtooth');
  assert.equal(s.mute, false);
  const d = createInstrument({ type: 'drum', drum: 'snare' });
  assert.equal(d.drum, 'snare');
  const smp = createInstrument({ type: 'sample' });
  assert.equal(smp.baseNote, 60);
});

test('createPattern: leeres Raster korrekter Größe', () => {
  const p = createPattern('X', 4, 8);
  assert.equal(p.cells.length, 8);
  assert.equal(p.cells[0].length, 4);
  assert.equal(p.cells[0][0], null);
});

test('Arrangement: Defaultprojekt hat Clips, Endberechnung stimmt', () => {
  const { song } = defaultProject();
  assert.ok(song.arrangement);
  assert.ok(song.arrangement.clips.length > 0);
  // Lead-Clip startet bei Beat 4 mit Länge 4 -> Ende >= 8
  assert.ok(arrangementEndBeats(song.arrangement) >= 8);
  const empty = { clips: [] };
  assert.equal(arrangementEndBeats(empty), 0);
});

test('emptyProject: Instrumente bleiben, Tracker & Arranger leer', () => {
  const { song } = emptyProject();
  assert.equal(song.instruments.length, 8);
  assert.equal(song.patterns.length, 1);
  assert.equal(song.arrangement.clips.length, 0);
  const allEmpty = song.patterns[0].cells.every((row) => row.every((c) => c === null));
  assert.ok(allEmpty, 'alle Tracker-Zellen müssen leer sein');
});

test('createClip: Defaults', () => {
  const c = createClip({ track: 2, startBeat: 5, inst: 'x' });
  assert.equal(c.track, 2);
  assert.equal(c.startBeat, 5);
  assert.equal(c.lengthBeats, 2);
  assert.ok(c.id.startsWith('clip'));
});

// ---- WAV / Base64 ----
function mockBuffer(samples, sampleRate = 8000) {
  const arr = Float32Array.from(samples);
  return { numberOfChannels: 1, sampleRate, length: arr.length, getChannelData: () => arr };
}

test('encodeWAV: gültiger 16-Bit-PCM-Header', () => {
  const ab = encodeWAV(mockBuffer([0, 0.5, -0.5, 1]));
  const view = new DataView(ab);
  const str = (o, n) => String.fromCharCode(...new Uint8Array(ab, o, n));
  assert.equal(str(0, 4), 'RIFF');
  assert.equal(str(8, 4), 'WAVE');
  assert.equal(str(12, 4), 'fmt ');
  assert.equal(view.getUint16(20, true), 1);     // PCM
  assert.equal(view.getUint16(22, true), 1);     // mono
  assert.equal(view.getUint32(24, true), 8000);  // sample rate
  assert.equal(view.getUint16(34, true), 16);    // bits
  assert.equal(ab.byteLength, 44 + 4 * 2);        // 4 mono samples
  // Werte (mono: 2 Bytes pro Sample ab Offset 44)
  assert.equal(view.getInt16(44, true), 0);
  assert.equal(view.getInt16(46, true), 16383);  // 0.5
  assert.equal(view.getInt16(48, true), -16384); // -0.5
  assert.equal(view.getInt16(50, true), 32767);  // 1.0 (clamped)
});

test('Base64-Roundtrip erhält die Bytes', () => {
  const ab = encodeWAV(mockBuffer([0.1, -0.2, 0.3, -0.4, 0.9]));
  const b64 = arrayBufferToBase64(ab);
  const back = base64ToArrayBuffer(b64);
  assert.deepEqual(new Uint8Array(back), new Uint8Array(ab));
  assert.equal(typeof audioBufferToBase64Wav(mockBuffer([0, 1, -1])), 'string');
});

// ---- Projekt-Serialisierung ----
test('serialize -> deserialize erhält Song-Struktur', async () => {
  const project = defaultProject();
  const json = serializeProject(project);
  assert.equal(typeof json, 'string');
  const round = await deserializeProject(json);
  assert.equal(round.song.instruments.length, project.song.instruments.length);
  assert.equal(round.song.patterns.length, project.song.patterns.length);
  assert.deepEqual(round.song.order, project.song.order);
  // Instrument-IDs bleiben stabil (Zellen referenzieren sie)
  assert.equal(round.song.patterns[0].cells[0][0].inst, project.song.instruments[0].id);
  // Arrangement übersteht den Roundtrip
  assert.equal(round.song.arrangement.clips.length, project.song.arrangement.clips.length);
  assert.equal(round.song.arrangement.clips[0].inst, project.song.arrangement.clips[0].inst);
});

test('serialize: Nicht-Sample-Instrumente haben kein sampleData', () => {
  const json = JSON.parse(serializeProject(defaultProject()));
  for (const inst of json.song.instruments) {
    assert.equal('sampleData' in inst, false);
  }
});
