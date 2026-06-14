// Tracker-Grid: Pattern-Anzeige, Cursor, Tastatur- und Maus-Eingabe.

import { el, midiToName, clamp } from '../util.js';

// Computer-Tastatur als Klaviatur (klassisches Tracker-/DAW-Layout)
const KEYMAP = {
  z: 0, s: 1, x: 2, d: 3, c: 4, v: 5, g: 6, b: 7, h: 8, n: 9, j: 10, m: 11, ',': 12, l: 13, '.': 14,
  q: 12, 2: 13, w: 14, 3: 15, e: 16, r: 17, 5: 18, t: 19, 6: 20, y: 21, 7: 22, u: 23, i: 24,
  9: 25, o: 26, 0: 27, p: 28
};

export class TrackerUI {
  constructor(app, root) {
    this.app = app;
    this.root = root;
    this.cursorRow = 0;
    this.cursorCh = 0;
    this.playingRow = -1;
    this.step = 1;
    this.rowEls = [];
    this.cellEls = [];
    root.addEventListener('keydown', (e) => this.onKey(e));
  }

  get pattern() { return this.app.song.patterns[this.app.currentPatternIndex]; }

  render() {
    const pat = this.pattern;
    this.root.innerHTML = '';
    this.rowEls = [];
    this.cellEls = [];
    if (!pat) return;

    const rpb = this.app.song.rowsPerBeat;

    // Kopfzeile mit Kanälen
    const head = el('div', { class: 'trk-headrow' });
    head.appendChild(el('div', { class: 'trk-head-ch trk-head-rownum', text: '' }));
    for (let c = 0; c < this.app.song.channels; c++) {
      const muted = this.app.mutedChannels.has(c);
      head.appendChild(el('div', {
        class: 'trk-head-ch' + (muted ? ' muted-ch' : ''),
        text: 'CH' + (c + 1),
        title: 'Klick = Kanal stumm/laut',
        onclick: () => this.toggleChannelMute(c)
      }));
    }
    this.root.appendChild(head);

    // Datenzeilen
    for (let r = 0; r < pat.rows; r++) {
      const beat = (r % rpb) === 0;
      const rowEl = el('div', { class: 'trk-row' + (beat ? ' beat' : '') });
      rowEl.appendChild(el('div', { class: 'trk-rownum', text: String(r).padStart(2, '0') }));
      const cells = [];
      for (let c = 0; c < this.app.song.channels; c++) {
        const cellEl = el('div', {
          class: 'trk-cell' + (this.app.mutedChannels.has(c) ? ' muted-ch' : ''),
          onclick: (ev) => this.onCellClick(r, c, ev)
        });
        cellEl.innerHTML = this.cellHTML(pat.cells[r][c]);
        rowEl.appendChild(cellEl);
        cells.push(cellEl);
      }
      this.root.appendChild(rowEl);
      this.rowEls.push(rowEl);
      this.cellEls.push(cells);
    }
    this.applyCursor();
  }

  cellHTML(cell) {
    if (!cell) return '<span class="note empty">···</span>';
    if (cell.off) return '<span class="off">━ OFF</span>';
    const inst = this.app.getInstrument(cell.inst);
    const num = inst ? this.app.song.instruments.indexOf(inst) + 1 : 0;
    return `<span class="note">${midiToName(cell.midi)}</span><span class="inst">${String(num).padStart(2, '0')}</span>`;
  }

  refreshCell(r, c) {
    if (this.cellEls[r] && this.cellEls[r][c]) {
      this.cellEls[r][c].innerHTML = this.cellHTML(this.pattern.cells[r][c]);
    }
  }

  applyCursor() {
    this.root.querySelectorAll('.trk-cell.cursor').forEach((n) => n.classList.remove('cursor'));
    const cell = this.cellEls[this.cursorRow] && this.cellEls[this.cursorRow][this.cursorCh];
    if (cell) cell.classList.add('cursor');
  }

  setPlayingRow(row) {
    if (this.playingRow >= 0 && this.rowEls[this.playingRow]) {
      this.rowEls[this.playingRow].classList.remove('playing');
    }
    this.playingRow = row;
    if (row >= 0 && this.rowEls[row]) this.rowEls[row].classList.add('playing');
  }

  moveCursor(dr, dc) {
    const pat = this.pattern;
    this.cursorRow = clamp(this.cursorRow + dr, 0, pat.rows - 1);
    this.cursorCh = clamp(this.cursorCh + dc, 0, this.app.song.channels - 1);
    this.applyCursor();
    this.scrollCursorIntoView();
  }

  scrollCursorIntoView() {
    const row = this.rowEls[this.cursorRow];
    if (row) row.scrollIntoView({ block: 'nearest' });
  }

  toggleChannelMute(c) {
    if (this.app.mutedChannels.has(c)) this.app.mutedChannels.delete(c);
    else this.app.mutedChannels.add(c);
    this.render();
  }

  onCellClick(r, c, ev) {
    this.cursorRow = r; this.cursorCh = c;
    const pat = this.pattern;
    const existing = pat.cells[r][c];
    if (existing) {
      pat.cells[r][c] = null;            // vorhandene Note entfernen
    } else {
      const inst = this.app.selectedInstrument;
      if (inst) {
        const midi = 12 * (this.app.octave + 1);
        pat.cells[r][c] = { midi, inst: inst.id };
        this.app.seq.preview(inst, midi, 0.4);
      }
    }
    this.refreshCell(r, c);
    this.applyCursor();
  }

  placeNote(midi) {
    const inst = this.app.selectedInstrument;
    if (!inst) return;
    const pat = this.pattern;
    pat.cells[this.cursorRow][this.cursorCh] = { midi, inst: inst.id };
    this.app.seq.preview(inst, midi, 0.4);
    this.refreshCell(this.cursorRow, this.cursorCh);
    this.moveCursor(this.step, 0);
  }

  placeOff() {
    this.pattern.cells[this.cursorRow][this.cursorCh] = { off: true };
    this.refreshCell(this.cursorRow, this.cursorCh);
    this.moveCursor(this.step, 0);
  }

  clearCell() {
    this.pattern.cells[this.cursorRow][this.cursorCh] = null;
    this.refreshCell(this.cursorRow, this.cursorCh);
  }

  onKey(e) {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const k = e.key.toLowerCase();
    switch (e.key) {
      case 'ArrowUp': this.moveCursor(-1, 0); e.preventDefault(); return;
      case 'ArrowDown': this.moveCursor(1, 0); e.preventDefault(); return;
      case 'ArrowLeft': this.moveCursor(0, -1); e.preventDefault(); return;
      case 'ArrowRight': this.moveCursor(0, 1); e.preventDefault(); return;
      case 'Delete': case 'Backspace': this.clearCell(); this.moveCursor(this.step, 0); e.preventDefault(); return;
      case 'PageUp': this.moveCursor(-this.app.song.rowsPerBeat, 0); e.preventDefault(); return;
      case 'PageDown': this.moveCursor(this.app.song.rowsPerBeat, 0); e.preventDefault(); return;
    }
    if (k === '1') { this.placeOff(); e.preventDefault(); return; }
    if (k === '+' || k === '=') { this.app.setOctave(this.app.octave + 1); e.preventDefault(); return; }
    if (k === '-') { this.app.setOctave(this.app.octave - 1); e.preventDefault(); return; }
    if (k in KEYMAP) {
      const midi = clamp(12 * (this.app.octave + 1) + KEYMAP[k], 0, 127);
      this.placeNote(midi);
      e.preventDefault();
    }
  }
}
