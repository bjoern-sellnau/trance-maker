// Piano-Roll-Editor (GarageBand-Stil): Noten auf einer Klaviatur-Zeitleiste
// zeichnen, verschieben, in der Länge ändern und löschen. Bearbeitet die
// Noten eines Arranger-Clips (clip.notes = [{ beat, length, midi }]).

import { el, $, clamp, midiToName } from '../util.js';
import { BEATS_PER_BAR } from '../model.js';
import { getCtx, ensureRunning } from '../audio/context.js';
import { triggerInstrument } from '../audio/instruments.js';

export class PianoRollUI {
  constructor(app, root) {
    this.app = app;
    this.root = root;
    this.low = 36;            // C2
    this.high = 84;           // C6
    this.rowH = 14;
    this.beatW = 44;
    this.snap = 0.5;
    this.clip = null;
    this.selected = null;
    this._grid = null;

    document.addEventListener('keydown', (e) => {
      if (this.root.classList.contains('hidden')) return;
      if (e.key === 'Escape') { this.close(); }
      else if ((e.key === 'Delete' || e.key === 'Backspace') && this.selected) { this.deleteNote(this.selected); e.preventDefault(); }
    });
  }

  get inst() { return this.app.getInstrument(this.clip.inst); }
  get spb() { return 60 / this.app.song.bpm; }
  get isOpen() { return !this.root.classList.contains('hidden'); }

  open(clip) {
    this.clip = clip;
    if (!clip.notes) clip.notes = [];
    this.selected = null;
    this.root.classList.remove('hidden');
    this.render();
  }

  close() {
    this.root.classList.add('hidden');
    this.clip = null;
    if (this.app.viewMode === 'arranger') this.app.arranger.render();
  }

  render() {
    const clip = this.clip;
    if (!clip) return;
    const inst = this.inst;
    this.root.innerHTML = '';
    const panel = el('div', { class: 'pr-panel' });

    const snapSel = el('select');
    [['1', '1 Beat'], ['0.5', '1/2'], ['0.25', '1/4'], ['0.125', '1/8']].forEach(([v, l]) => {
      const o = el('option', { value: v, text: l });
      if (+v === this.snap) o.selected = true;
      snapSel.appendChild(o);
    });
    snapSel.addEventListener('change', () => { this.snap = +snapSel.value; });

    const lenInp = el('input', { type: 'number', min: 1, max: 64, step: 1, value: clip.lengthBeats, style: 'width:54px' });
    lenInp.addEventListener('change', () => { clip.lengthBeats = clamp(parseInt(lenInp.value) || 4, 1, 64); this.render(); });

    panel.appendChild(el('div', { class: 'pr-header' }, [
      el('strong', { text: '🎹 Piano-Roll — ' + (inst ? inst.name : '?') }),
      el('span', { class: 'muted pr-tip', text: 'Klick = Note · ziehen = verschieben · rechte Kante = Länge · Entf = löschen' }),
      el('label', { class: 'muted' }, ['Snap ', snapSel]),
      el('label', { class: 'muted' }, ['Länge ', lenInp]),
      el('button', { class: 'p-btn', text: '▶ Vorhören', onclick: () => this.preview() }),
      el('button', { class: 'p-btn accent', text: 'Schließen', onclick: () => this.close() })
    ]));

    const rows = this.high - this.low + 1;
    const gridW = clip.lengthBeats * this.beatW;
    const gridH = rows * this.rowH;

    const keys = el('div', { class: 'pr-keys', style: `height:${gridH}px` });
    for (let midi = this.high; midi >= this.low; midi--) {
      const isBlack = [1, 3, 6, 8, 10].includes(((midi % 12) + 12) % 12);
      keys.appendChild(el('div', { class: 'pr-key ' + (isBlack ? 'black' : 'white'), style: `height:${this.rowH}px`, text: (midi % 12 === 0) ? midiToName(midi) : '' }));
    }

    const grid = el('div', { class: 'pr-grid', style: `width:${gridW}px;height:${gridH}px` });
    const barW = BEATS_PER_BAR * this.beatW;
    grid.style.backgroundImage =
      `repeating-linear-gradient(90deg, rgba(255,255,255,.05) 0 1px, transparent 1px ${this.beatW}px),` +
      `repeating-linear-gradient(90deg, rgba(56,189,248,.25) 0 2px, transparent 2px ${barW}px),` +
      `repeating-linear-gradient(0deg, rgba(255,255,255,.05) 0 1px, transparent 1px ${this.rowH}px)`;
    grid.addEventListener('pointerdown', (e) => { if (e.target === grid) this.addNoteAt(e, grid); });
    for (const n of clip.notes) grid.appendChild(this.noteEl(n, grid));

    panel.appendChild(el('div', { class: 'pr-body' }, [el('div', { class: 'pr-scroll' }, [keys, grid])]));
    this.root.appendChild(panel);
    this._grid = grid;
  }

  noteEl(note, grid) {
    const x = note.beat * this.beatW;
    const y = (this.high - note.midi) * this.rowH;
    const w = Math.max(6, note.length * this.beatW) - 1;
    const nEl = el('div', {
      class: 'pr-note' + (note === this.selected ? ' sel' : ''),
      style: `left:${x}px;top:${y}px;width:${w}px;height:${this.rowH - 1}px`,
      title: midiToName(note.midi)
    }, [el('span', { class: 'pr-note-resize' })]);
    nEl._note = note;
    nEl.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      const mode = e.target.classList.contains('pr-note-resize') ? 'resize' : 'move';
      this.startNoteDrag(e, note, nEl, grid, mode);
    });
    return nEl;
  }

  addNoteAt(e, grid) {
    const rect = grid.getBoundingClientRect();
    const x = e.clientX - rect.left, y = e.clientY - rect.top;
    let beat = Math.floor((x / this.beatW) / this.snap) * this.snap;
    beat = clamp(beat, 0, Math.max(0, this.clip.lengthBeats - this.snap));
    const midi = clamp(this.high - Math.floor(y / this.rowH), this.low, this.high);
    const note = { beat, length: this.snap, midi };
    this.clip.notes.push(note);
    this.selected = note;
    const nEl = this.noteEl(note, grid);
    grid.appendChild(nEl);
    this._refreshSelection();
    this._previewNote(midi);
    this.startNoteDrag(e, note, nEl, grid, 'resize'); // direkt aufziehen möglich
  }

  startNoteDrag(e, note, nEl, grid, mode) {
    e.preventDefault();
    this.selected = note;
    this._refreshSelection();
    const sx = e.clientX, sy = e.clientY;
    const ob = note.beat, om = note.midi, ol = note.length;
    const onMove = (ev) => {
      const dx = ev.clientX - sx, dy = ev.clientY - sy;
      if (mode === 'resize') {
        note.length = clamp(Math.round((ol * this.beatW + dx) / this.beatW / this.snap) * this.snap, this.snap, this.clip.lengthBeats - note.beat);
      } else {
        note.beat = clamp(Math.round((ob * this.beatW + dx) / this.beatW / this.snap) * this.snap, 0, this.clip.lengthBeats - note.length);
        const newMidi = clamp(om - Math.round(dy / this.rowH), this.low, this.high);
        if (newMidi !== note.midi) { note.midi = newMidi; this._previewNote(newMidi); }
      }
      this._applyStyle(nEl, note);
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }

  _applyStyle(nEl, note) {
    nEl.style.left = (note.beat * this.beatW) + 'px';
    nEl.style.top = ((this.high - note.midi) * this.rowH) + 'px';
    nEl.style.width = (Math.max(6, note.length * this.beatW) - 1) + 'px';
  }

  _refreshSelection() {
    if (!this._grid) return;
    for (const n of this._grid.querySelectorAll('.pr-note')) n.classList.toggle('sel', n._note === this.selected);
  }

  deleteNote(note) {
    const i = this.clip.notes.indexOf(note);
    if (i >= 0) this.clip.notes.splice(i, 1);
    this.selected = null;
    this.render();
  }

  _previewNote(midi) {
    this.app.seq.preview(this.inst, midi, Math.min(0.5, this.snap * this.spb + 0.1));
  }

  async preview() {
    if (!this.clip || !this.inst) return;
    await ensureRunning();
    const ctx = getCtx();
    this.app.seq.ensureInstNodes();
    const target = this.app.seq._targetFor(this.inst.id);
    const spb = this.spb;
    const t0 = ctx.currentTime + 0.06;
    for (const n of this.clip.notes) {
      triggerInstrument(ctx, target, this.inst, n.midi, t0 + n.beat * spb, { duration: n.length * spb });
    }
  }
}
