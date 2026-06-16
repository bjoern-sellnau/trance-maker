// Tests für die browser-unabhängige Kernlogik (laufen mit `npm test`).
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { midiToFreq, midiToName } from '../js/util.js';
import { defaultProject, emptyProject, createInstrument, createPattern, createClip, arrangementEndBeats, clipTriggers, clipNoteEvents, cloneInstrument, PRESETS, presetCategories } from '../js/model.js';
import { encodeWAV, arrayBufferToBase64, base64ToArrayBuffer, audioBufferToBase64Wav } from '../js/audio/wav.js';
import { serializeProject, deserializeProject } from '../js/project.js';
import { buildDemo, DEMO_LIST } from '../js/demos.js';

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
  assert.equal(song.instruments.length, 16);
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
  assert.equal(song.instruments.length, 16);
  assert.equal(song.patterns.length, 1);
  assert.equal(song.arrangement.clips.length, 0);
  const allEmpty = song.patterns[0].cells.every((row) => row.every((c) => c === null));
  assert.ok(allEmpty, 'alle Tracker-Zellen müssen leer sein');
});

test('clipTriggers: füllt die Länge je nach Instrumenttyp', () => {
  const synth = createInstrument({ type: 'synth' });
  let tr = clipTriggers({ lengthBeats: 8 }, synth, 0.5);
  assert.equal(tr.length, 1);            // ein gehaltener Ton
  assert.equal(tr[0].durBeats, 8);

  const drum = createInstrument({ type: 'drum' });
  tr = clipTriggers({ lengthBeats: 4 }, drum, 0.5);
  assert.equal(tr.length, 4);            // pro Beat ein Schlag

  const smp = createInstrument({ type: 'sample' }); // ohne Buffer
  tr = clipTriggers({ lengthBeats: 4 }, smp, 0.5);
  assert.equal(tr.length, 1);
});

test('cloneInstrument: neue ID, kopierte Parameter, Kopie-Name', () => {
  const a = createInstrument({ type: 'synth', name: 'X', cutoff: 1234, drive: 0.4, category: 'Lead' });
  const b = cloneInstrument(a);
  assert.notEqual(b.id, a.id);
  assert.equal(b.cutoff, 1234);
  assert.equal(b.drive, 0.4);
  assert.equal(b.category, 'Lead');
  assert.match(b.name, /Kopie/);
});

test('PRESETS: großer Katalog mit Genre-Kategorien', () => {
  assert.ok(PRESETS.length >= 500, 'mindestens 500 Presets, hat ' + PRESETS.length);
  const cats = presetCategories();
  for (const g of ['Kick & Drums', 'Bass', 'Lead', 'Keyboard', 'Orchestra', 'Chiptune', 'Mallets', 'Trance', 'EDM', 'Rock', 'Metal']) {
    assert.ok(cats.includes(g), 'Kategorie fehlt: ' + g);
  }
  // jedes Preset hat Name/Typ/Kategorie und gültigen Typ
  for (const p of PRESETS) {
    assert.ok(p.name && p.type && p.category);
    assert.ok(['synth', 'drum', 'sample'].includes(p.type));
  }
});

test('Alle Presets sind instanziierbar (keine NaN-Parameter)', () => {
  for (const p of PRESETS) {
    const inst = createInstrument(p);
    assert.equal(typeof inst.gain, 'number');
    assert.ok(!Number.isNaN(inst.gain));
    if (inst.type === 'synth') assert.ok(!Number.isNaN(inst.cutoff));
  }
});

test('createInstrument: Kategorie-Default', () => {
  assert.equal(createInstrument({ type: 'synth' }).category, 'Sonstige');
  assert.equal(createInstrument({ type: 'drum', category: 'Kick & Drums' }).category, 'Kick & Drums');
});

test('clipNoteEvents: Melodie nutzt eigene Noten, sonst Füllung', () => {
  const synth = createInstrument({ type: 'synth' });
  const melody = { lengthBeats: 4, midi: 60, notes: [{ beat: 0, length: 1, midi: 64 }, { beat: 1, length: 1, midi: 67 }] };
  let ev = clipNoteEvents(melody, synth, 0.5);
  assert.equal(ev.length, 2);
  assert.equal(ev[0].midi, 64);
  assert.equal(ev[1].midi, 67);
  const fill = { lengthBeats: 4, midi: 60 };
  ev = clipNoteEvents(fill, synth, 0.5);
  assert.equal(ev.length, 1);
  assert.equal(ev[0].midi, 60);
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

// ---- Demo-Songs ----
test('Demo-Songs: alle 6 baubar mit Inhalt', () => {
  assert.equal(DEMO_LIST.length, 6);
  for (const d of DEMO_LIST) {
    const { song } = buildDemo(d.id);
    assert.ok(song.instruments.length >= 4, d.id + ' Instrumente');
    assert.ok(song.arrangement.clips.length >= 4, d.id + ' Clips');
    assert.ok(song.arrangement.bars >= 16, d.id + ' Takte');
    const notes = song.arrangement.clips.reduce((s, c) => s + (c.notes ? c.notes.length : 0), 0);
    assert.ok(notes > 50, d.id + ' Noten=' + notes);
  }
});

test('Demo-Songs: Dauer im Zielbereich', () => {
  const dur = (id) => { const { song } = buildDemo(id); return song.arrangement.bars * 240 / song.bpm; };
  assert.ok(dur('trance') >= 120 && dur('trance') <= 200, 'trance');
  assert.ok(dur('hardstyle') >= 240 && dur('hardstyle') <= 320, 'hardstyle');
  assert.ok(dur('trance90s') >= 320 && dur('trance90s') <= 400, '90s trance');
});

test('Demo-Songs: serialisierbar (Melodie-Noten überstehen Roundtrip)', async () => {
  const project = buildDemo('eurodance');
  const round = await deserializeProject(serializeProject(project));
  assert.equal(round.song.arrangement.clips.length, project.song.arrangement.clips.length);
  const c = round.song.arrangement.clips.find((x) => x.notes && x.notes.length);
  assert.ok(c && c.notes.length > 0);
});

test('serialize: Nicht-Sample-Instrumente haben kein sampleData', () => {
  const json = JSON.parse(serializeProject(defaultProject()));
  for (const inst of json.song.instruments) {
    assert.equal('sampleData' in inst, false);
  }
});
