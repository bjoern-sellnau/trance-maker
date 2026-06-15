// On-Screen-Klaviatur (Melodien) und Drum-Kit-Pads (Drums).
// Gespielte Noten gehen über app.playNote(): im Tracker an den Cursor,
// sonst nur vorhören.

import { el, $, midiToName, colorForIndex } from '../util.js';

const WHITE_SEMIS = [0, 2, 4, 5, 7, 9, 11];
const BLACK_SEMIS = [1, 3, 6, 8, 10];
const BLACK_AFTER_WHITE = [0, 1, 3, 4, 5]; // Index der weißen Taste, hinter der die schwarze sitzt

export class KeyboardUI {
  constructor(app, root) {
    this.app = app;
    this.root = root;
    this.octaves = 2;
  }

  render() {
    const root = this.root;
    root.innerHTML = '';
    const base = 12 * (this.app.octave + 1);
    const nameEl = $('#kbInstName'); if (nameEl) nameEl.textContent = this.app.selectedInstrument ? this.app.selectedInstrument.name : '—';
    const octEl = $('#kbOctLabel'); if (octEl) octEl.textContent = this.app.octave;

    const whites = [];
    for (let o = 0; o < this.octaves; o++) for (const s of WHITE_SEMIS) whites.push(base + o * 12 + s);
    whites.push(base + this.octaves * 12); // oberes C
    const numWhite = whites.length;
    const whiteW = 100 / numWhite;

    const wWrap = el('div', { class: 'kb-whites' });
    for (const m of whites) wWrap.appendChild(this._key(m, false));
    root.appendChild(wWrap);

    const bWrap = el('div', { class: 'kb-blacks' });
    for (let o = 0; o < this.octaves; o++) {
      BLACK_SEMIS.forEach((s, i) => {
        const m = base + o * 12 + s;
        const gi = o * 7 + BLACK_AFTER_WHITE[i];
        const key = this._key(m, true);
        key.style.left = ((gi + 1) * whiteW) + '%';
        key.style.width = (whiteW * 0.62) + '%';
        bWrap.appendChild(key);
      });
    }
    root.appendChild(bWrap);
  }

  _key(midi, black) {
    const k = el('div', { class: 'kb-key ' + (black ? 'black' : 'white'), title: midiToName(midi) });
    if (!black) k.appendChild(el('span', { class: 'kb-label', text: midiToName(midi) }));
    const press = (e) => { e.preventDefault(); k.classList.add('down'); this.app.playNote(midi); };
    const release = () => k.classList.remove('down');
    k.addEventListener('pointerdown', press);
    k.addEventListener('pointerup', release);
    k.addEventListener('pointerleave', release);
    return k;
  }
}

export class DrumkitUI {
  constructor(app, root) {
    this.app = app;
    this.root = root;
  }

  render() {
    const root = this.root;
    root.innerHTML = '';
    const drums = this.app.song.instruments
      .map((inst, i) => ({ inst, i }))
      .filter((x) => x.inst.type === 'drum');
    if (!drums.length) {
      root.appendChild(el('div', { class: 'muted', text: 'Keine Drum-Instrumente vorhanden. Im Sample Maker (Drum) oder über Presets welche anlegen.' }));
      return;
    }
    for (const { inst, i } of drums) {
      const pad = el('div', { class: 'drum-pad', style: `--pad:${colorForIndex(i)}` }, [
        el('span', { class: 'pad-name', text: inst.name })
      ]);
      const hit = (e) => {
        e.preventDefault();
        pad.classList.add('hit');
        this.app.selectInstrument(inst.id);
        this.app.playNote(60);
      };
      pad.addEventListener('pointerdown', hit);
      pad.addEventListener('pointerup', () => pad.classList.remove('hit'));
      pad.addEventListener('pointerleave', () => pad.classList.remove('hit'));
      root.appendChild(pad);
    }
  }
}
