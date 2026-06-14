// Allgemeine Hilfsfunktionen

export const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

/** MIDI-Notennummer -> Frequenz in Hz (A4 = 69 = 440 Hz). */
export function midiToFreq(midi) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

/** MIDI-Notennummer -> Anzeigename, z.B. 60 -> "C-4". */
export function midiToName(midi) {
  if (midi == null) return '···';
  const name = NOTE_NAMES[((midi % 12) + 12) % 12];
  const oct = Math.floor(midi / 12) - 1;
  return (name.length === 1 ? name + '-' : name) + oct;
}

export const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/** Lineare Interpolation. */
export const lerp = (a, b, t) => a + (b - a) * t;

/** Kurz-ID erzeugen. */
export function uid(prefix = 'id') {
  return prefix + '_' + Math.random().toString(36).slice(2, 9);
}

/** DOM-Element-Helfer. */
export function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') node.className = v;
    else if (k === 'text') node.textContent = v;
    else if (k === 'html') node.innerHTML = v;
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
    else if (v === true) node.setAttribute(k, '');
    else if (v === false || v == null) { /* skip */ }
    else node.setAttribute(k, v);
  }
  for (const c of [].concat(children)) {
    if (c == null) continue;
    node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
  }
  return node;
}

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

/** Eine Farbe aus einem Index ableiten (für Instrument-Swatches). */
export function colorForIndex(i) {
  const hues = [152, 199, 280, 36, 0, 326, 90, 220, 50, 170];
  return `hsl(${hues[i % hues.length]} 70% 55%)`;
}

/** Datei-Download anstoßen. */
export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
