// On-Screen-Klaviatur (Melodien, mit Instrumentenauswahl) und
// Drum-Kit mit frei belegbaren Pads.

import { el, $, midiToName, colorForIndex } from '../util.js';

const WHITE_SEMIS = [0, 2, 4, 5, 7, 9, 11];
const BLACK_SEMIS = [1, 3, 6, 8, 10];
const BLACK_AFTER_WHITE = [0, 1, 3, 4, 5];

export class KeyboardUI {
  constructor(app, root) {
    this.app = app;
    this.root = root;
    this.octaves = 2;
  }

  // Auswahlfeld mit allen melodischen Instrumenten füllen.
  refreshInstSelect() {
    const sel = $('#kbInstSelect');
    if (!sel) return;
    sel.innerHTML = '';
    const melodic = this.app.song.instruments.filter((i) => i.type !== 'drum');
    for (const inst of melodic) {
      const o = el('option', { value: inst.id, text: inst.name });
      if (inst.id === this.app.selectedInstrumentId) o.selected = true;
      sel.appendChild(o);
    }
    if (!sel._wired) {
      sel.addEventListener('change', () => { this.app.selectInstrument(sel.value); this.render(); });
      sel._wired = true;
    }
  }

  render() {
    const root = this.root;
    root.innerHTML = '';
    this.refreshInstSelect();
    const base = 12 * (this.app.octave + 1);
    const octEl = $('#kbOctLabel'); if (octEl) octEl.textContent = this.app.octave;

    const whites = [];
    for (let o = 0; o < this.octaves; o++) for (const s of WHITE_SEMIS) whites.push(base + o * 12 + s);
    whites.push(base + this.octaves * 12);
    const whiteW = 100 / whites.length;

    const wWrap = el('div', { class: 'kb-whites' });
    for (const m of whites) wWrap.appendChild(this._key(m, false));
    root.appendChild(wWrap);

    const bWrap = el('div', { class: 'kb-blacks' });
    for (let o = 0; o < this.octaves; o++) {
      BLACK_SEMIS.forEach((s, i) => {
        const key = this._key(base + o * 12 + s, true);
        key.style.left = ((o * 7 + BLACK_AFTER_WHITE[i] + 1) * whiteW) + '%';
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

  drumInstruments() {
    return this.app.song.instruments.filter((i) => i.type === 'drum');
  }

  // Pad-Belegung sicherstellen (gültige IDs, sinnvolle Voreinstellung).
  ensurePads() {
    const drums = this.drumInstruments();
    const ids = new Set(drums.map((d) => d.id));
    if (!Array.isArray(this.app.drumkitPads) || this.app.drumkitPads.length === 0) {
      this.app.drumkitPads = drums.map((d) => d.id);
    }
    const fallback = drums[0] ? drums[0].id : null;
    this.app.drumkitPads = this.app.drumkitPads.map((id) => (ids.has(id) ? id : fallback)).filter((x) => x);
    if (this.app.drumkitPads.length === 0 && fallback) this.app.drumkitPads = [fallback];
  }

  render() {
    const root = this.root;
    root.innerHTML = '';
    const drums = this.drumInstruments();
    if (!drums.length) {
      root.appendChild(el('div', { class: 'muted', text: 'Keine Drum-Instrumente. Im Sample Maker (Drum) oder über Presets welche anlegen.' }));
      return;
    }
    this.ensurePads();

    // Werkzeugleiste
    const bar = el('div', { class: 'dk-toolbar' }, [
      el('button', { class: 'pc-btn', text: '＋ Pad', onclick: () => { this.app.drumkitPads.push(drums[0].id); this.render(); } }),
      el('button', { class: 'pc-btn', text: '− Pad', onclick: () => { if (this.app.drumkitPads.length > 1) { this.app.drumkitPads.pop(); this.render(); } } }),
      el('button', { class: 'pc-btn', text: 'Alle Drums', title: 'Pads mit allen Drum-Instrumenten belegen', onclick: () => { this.app.drumkitPads = drums.map((d) => d.id); this.render(); } })
    ]);
    root.appendChild(bar);

    const grid = el('div', { class: 'drumkit' });
    this.app.drumkitPads.forEach((id, slot) => grid.appendChild(this._pad(id, slot, drums)));
    root.appendChild(grid);
  }

  _pad(id, slot, drums) {
    const inst = this.app.getInstrument(id);
    const idx = inst ? this.app.song.instruments.indexOf(inst) : 0;
    const sel = el('select', { class: 'pad-sel' });
    for (const d of drums) {
      const o = el('option', { value: d.id, text: d.name });
      if (d.id === id) o.selected = true;
      sel.appendChild(o);
    }
    sel.addEventListener('pointerdown', (e) => e.stopPropagation());
    sel.addEventListener('change', () => { this.app.drumkitPads[slot] = sel.value; this.render(); });

    const trigger = el('div', { class: 'pad-trigger', text: inst ? inst.name : '—' });
    const hit = (e) => {
      e.preventDefault();
      trigger.classList.add('hit');
      this.app.selectInstrument(id);
      this.app.playNote(60);
    };
    trigger.addEventListener('pointerdown', hit);
    trigger.addEventListener('pointerup', () => trigger.classList.remove('hit'));
    trigger.addEventListener('pointerleave', () => trigger.classList.remove('hit'));

    return el('div', { class: 'drum-pad', style: `--pad:${colorForIndex(idx)}` }, [sel, trigger]);
  }
}
