// Arranger ("Music-Maker"-Ansicht): Sample-/Instrument-Blöcke auf Spuren
// einer Zeitleiste platzieren, verschieben, in der Länge ändern und löschen.

import { el, colorForIndex, midiToName, clamp } from '../util.js';
import { createClip, BEATS_PER_BAR, arrangementEndBeats } from '../model.js';

export class ArrangerUI {
  constructor(app, root) {
    this.app = app;
    this.root = root;
    this.beatWidth = 30;
    this.laneHeight = 44;
    this.rulerH = 22;
    this.labelW = 64;
    this.clipPad = 6;
    this.selectedId = null;
    this._playhead = null;
    root.tabIndex = 0;
    root.addEventListener('keydown', (e) => {
      if ((e.key === 'Delete' || e.key === 'Backspace') && this.selectedId) {
        this.removeClip(this.selectedId); e.preventDefault();
      }
    });
  }

  get arr() { return this.app.song.arrangement; }
  get spb() { return 60 / this.app.song.bpm; }

  gridBeats() {
    const min = Math.max(this.arr.bars * BEATS_PER_BAR, Math.ceil(arrangementEndBeats(this.arr)) + BEATS_PER_BAR, 16);
    return Math.ceil(min / BEATS_PER_BAR) * BEATS_PER_BAR;
  }

  render() {
    const root = this.root;
    root.innerHTML = '';
    const gridBeats = this.gridBeats();
    const tracks = this.arr.tracks;
    const W = this.labelW + gridBeats * this.beatWidth;
    const H = this.rulerH + tracks * this.laneHeight;
    const barW = BEATS_PER_BAR * this.beatWidth;

    const grid = el('div', { class: 'arr-grid', style: `width:${W}px;height:${H}px` });

    // Lineal (Takte)
    const ruler = el('div', { class: 'arr-ruler', style: `left:${this.labelW}px;height:${this.rulerH}px;width:${gridBeats * this.beatWidth}px` });
    for (let bar = 0; bar < gridBeats / BEATS_PER_BAR; bar++) {
      ruler.appendChild(el('span', { class: 'arr-bar-num', style: `left:${bar * barW}px`, text: String(bar + 1) }));
    }
    grid.appendChild(ruler);

    // Spur-Beschriftungen (links, klebend)
    for (let t = 0; t < tracks; t++) {
      grid.appendChild(el('div', {
        class: 'arr-lane-label',
        style: `top:${this.rulerH + t * this.laneHeight}px;height:${this.laneHeight}px;width:${this.labelW}px`,
        text: 'Spur ' + (t + 1)
      }));
    }

    // Hintergrund-Raster (nimmt Platzierungs-Klicks entgegen)
    const bg = el('div', {
      class: 'arr-bg',
      style: `left:${this.labelW}px;top:${this.rulerH}px;width:${gridBeats * this.beatWidth}px;height:${tracks * this.laneHeight}px`
    });
    bg.style.backgroundImage =
      `repeating-linear-gradient(90deg, rgba(255,255,255,.05) 0 1px, transparent 1px ${this.beatWidth}px),` +
      `repeating-linear-gradient(90deg, rgba(56,189,248,.25) 0 2px, transparent 2px ${barW}px),` +
      `repeating-linear-gradient(0deg, rgba(255,255,255,.08) 0 1px, transparent 1px ${this.laneHeight}px)`;
    bg.addEventListener('pointerdown', (e) => {
      if (e.target !== bg || e.button !== 0) return;
      const startBeat = Math.floor(e.offsetX / this.beatWidth);
      const track = clamp(Math.floor(e.offsetY / this.laneHeight), 0, tracks - 1);
      this.startFrameDrag(e, bg, track, startBeat);
    });
    // Instrument aus der Liste hierher ziehen = Block anlegen
    const hasInst = (e) => Array.from(e.dataTransfer.types || []).includes('application/x-trance-inst');
    bg.addEventListener('dragover', (e) => { if (hasInst(e)) { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; bg.classList.add('drag-over'); } });
    bg.addEventListener('dragleave', () => bg.classList.remove('drag-over'));
    bg.addEventListener('drop', (e) => {
      if (!hasInst(e)) return;
      e.preventDefault(); e.stopPropagation();
      bg.classList.remove('drag-over');
      const id = e.dataTransfer.getData('application/x-trance-inst');
      const beat = Math.floor(e.offsetX / this.beatWidth);
      const track = clamp(Math.floor(e.offsetY / this.laneHeight), 0, tracks - 1);
      this.placeClipFor(id, track, beat);
    });
    grid.appendChild(bg);

    // Clip-Ebene (über dem Raster, aber für Klicks durchlässig außer auf Clips)
    const layer = el('div', {
      class: 'arr-layer',
      style: `left:${this.labelW}px;top:${this.rulerH}px;width:${gridBeats * this.beatWidth}px;height:${tracks * this.laneHeight}px`
    });
    for (const clip of this.arr.clips) {
      const node = this.makeClip(clip);
      if (node) layer.appendChild(node);
    }
    grid.appendChild(layer);
    this._layer = layer;

    // Playhead
    this._playhead = el('div', { class: 'arr-playhead', style: `left:${this.labelW}px;top:${this.rulerH}px;height:${tracks * this.laneHeight}px;display:none` });
    grid.appendChild(this._playhead);

    root.appendChild(grid);
  }

  makeClip(clip) {
    const inst = this.app.getInstrument(clip.inst);
    const idx = inst ? this.app.song.instruments.indexOf(inst) : 0;
    const left = clip.startBeat * this.beatWidth;
    const top = clip.track * this.laneHeight + this.clipPad / 2;
    const width = Math.max(this.beatWidth, clip.lengthBeats * this.beatWidth) - 2;
    const height = this.laneHeight - this.clipPad;
    const label = (inst ? inst.name : '??') + (inst && inst.type !== 'drum' ? ' · ' + midiToName(clip.midi) : '');

    const node = el('div', {
      class: 'arr-clip' + (clip.id === this.selectedId ? ' selected' : ''),
      style: `left:${left}px;top:${top}px;width:${width}px;height:${height}px;background:${colorForIndex(idx)}`
    }, [
      el('span', { class: 'arr-clip-label', text: label }),
      el('span', { class: 'arr-clip-del', text: '✕', title: 'Löschen' }),
      el('span', { class: 'arr-clip-resize', title: 'Länge ziehen' })
    ]);
    node._clip = clip;

    node.querySelector('.arr-clip-del').addEventListener('pointerdown', (e) => {
      e.stopPropagation(); this.removeClip(clip.id);
    });
    node.querySelector('.arr-clip-resize').addEventListener('pointerdown', (e) => {
      e.stopPropagation(); this.startDrag(e, clip, node, 'resize');
    });
    node.addEventListener('pointerdown', (e) => this.startDrag(e, clip, node, 'move'));
    return node;
  }

  // Aufziehen eines Rahmens; das ausgewählte Sample füllt die gezogene Länge.
  startFrameDrag(e, bg, track, startBeat) {
    const rect = bg.getBoundingClientRect();
    const frame = el('div', { class: 'arr-frame' });
    frame.style.top = (track * this.laneHeight + this.clipPad / 2) + 'px';
    frame.style.height = (this.laneHeight - this.clipPad) + 'px';
    frame.style.left = (startBeat * this.beatWidth) + 'px';
    frame.style.width = this.beatWidth + 'px';
    bg.appendChild(frame);

    let length = 1, moved = false;
    const onMove = (ev) => {
      if (Math.abs(ev.clientX - e.clientX) > 4) moved = true;
      const curBeat = Math.round((ev.clientX - rect.left) / this.beatWidth);
      length = clamp(curBeat - startBeat, 1, this.gridBeats() - startBeat);
      frame.style.width = (length * this.beatWidth) + 'px';
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      frame.remove();
      const inst = this.app.selectedInstrument;
      if (!inst) { this.app.setStatus('Erst ein Instrument wählen.'); return; }
      this.placeClipFor(inst.id, track, startBeat, moved ? length : undefined);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }

  placeClip(track, beat) {
    const inst = this.app.selectedInstrument;
    if (!inst) { this.app.setStatus('Erst ein Instrument wählen.'); return; }
    this.placeClipFor(inst.id, track, beat);
  }

  defaultLength(inst) {
    if (inst.type === 'sample' && inst.buffer) return Math.max(1, Math.round(inst.buffer.duration / this.spb));
    if (inst.type === 'drum') return 1;
    return 2;
  }

  placeClipFor(instId, track, beat, lengthOverride) {
    const inst = this.app.getInstrument(instId);
    if (!inst) return;
    const lengthBeats = lengthOverride != null ? Math.max(1, lengthOverride) : this.defaultLength(inst);
    const midi = inst.type === 'sample' ? (inst.baseNote ?? 60)
      : inst.type === 'drum' ? 60
        : 12 * (this.app.octave + 1);
    const clip = createClip({ track, startBeat: Math.max(0, beat), lengthBeats, inst: inst.id, midi });
    this.arr.clips.push(clip);
    this.selectedId = clip.id;
    this.app.selectInstrument(inst.id);
    this.app.seq.preview(inst, midi, Math.min(2, lengthBeats * this.spb));
    this.render();
  }

  removeClip(id) {
    const i = this.arr.clips.findIndex((c) => c.id === id);
    if (i >= 0) this.arr.clips.splice(i, 1);
    if (this.selectedId === id) this.selectedId = null;
    this.render();
  }

  startDrag(e, clip, node, mode) {
    e.preventDefault();
    this.selectedId = clip.id;
    node.classList.add('selected');
    const startX = e.clientX, startY = e.clientY;
    const origStart = clip.startBeat, origTrack = clip.track, origLen = clip.lengthBeats;
    let moved = false;
    try { node.setPointerCapture(e.pointerId); } catch (_) {}

    const onMove = (ev) => {
      const dx = ev.clientX - startX, dy = ev.clientY - startY;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) moved = true;
      if (mode === 'resize') {
        clip.lengthBeats = clamp(Math.round(origLen + dx / this.beatWidth), 1, this.gridBeats());
        node.style.width = (clip.lengthBeats * this.beatWidth - 2) + 'px';
      } else {
        clip.startBeat = clamp(Math.round(origStart + dx / this.beatWidth), 0, this.gridBeats() - 1);
        clip.track = clamp(Math.round(origTrack + dy / this.laneHeight), 0, this.arr.tracks - 1);
        node.style.left = (clip.startBeat * this.beatWidth) + 'px';
        node.style.top = (clip.track * this.laneHeight + this.clipPad / 2) + 'px';
      }
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      if (!moved && mode === 'move') {
        // einfacher Klick = auswählen + vorhören
        const inst = this.app.getInstrument(clip.inst);
        if (inst) this.app.seq.preview(inst, clip.midi, Math.min(2, clip.lengthBeats * this.spb));
      }
      this.render();
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }

  setPlayhead(beat) {
    if (!this._playhead) return;
    if (beat < 0) { this._playhead.style.display = 'none'; return; }
    this._playhead.style.display = 'block';
    this._playhead.style.left = (this.labelW + beat * this.beatWidth) + 'px';
  }
}
