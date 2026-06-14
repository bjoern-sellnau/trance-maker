// Live-Wiedergabe: Look-Ahead-Scheduler (nach dem Prinzip "A Tale of Two Clocks")
// für sample-genaues Timing, plus Instrument-Routing (Mixer/Mute/Solo).

import { getCtx, getMaster, ensureRunning } from './audio/context.js';
import { triggerInstrument } from './audio/instruments.js';

export class Sequencer {
  constructor(app) {
    this.app = app;
    this.playing = false;
    this.followSong = false;
    this.orderIdx = 0;
    this.row = 0;
    this.nextRowTime = 0;
    this.lookaheadMs = 25;
    this.scheduleAhead = 0.12;
    this._timer = null;
    this._raf = null;
    this._queue = [];            // {time, patternIndex, row}
    this._channelVoice = [];     // pro Kanal letzte Stimme (für mono-Cut)
    this.instNodes = new Map();  // instId -> GainNode (Mixer)
    this.onStep = null;          // (patternIndex, row) => void  (UI-Playhead)
    this.onStop = null;
  }

  get song() { return this.app.project.song; }

  // ---------- Routing / Mixer ----------
  ensureInstNodes() {
    const ctx = getCtx();
    const master = getMaster();
    const ids = new Set(this.song.instruments.map((i) => i.id));
    // entfernte Instrumente abbauen
    for (const [id, node] of this.instNodes) {
      if (!ids.has(id)) { node.disconnect(); this.instNodes.delete(id); }
    }
    // fehlende anlegen
    for (const inst of this.song.instruments) {
      if (!this.instNodes.has(inst.id)) {
        const g = ctx.createGain();
        g.connect(master);
        this.instNodes.set(inst.id, g);
      }
    }
    this.updateMix();
  }

  updateMix() {
    const anySolo = this.song.instruments.some((i) => i.solo);
    for (const inst of this.song.instruments) {
      const node = this.instNodes.get(inst.id);
      if (!node) continue;
      const audible = !inst.mute && (!anySolo || inst.solo);
      node.gain.value = audible ? inst.volume : 0;
    }
  }

  _targetFor(instId) {
    if (!this.instNodes.has(instId)) this.ensureInstNodes();
    return this.instNodes.get(instId) || getMaster();
  }

  // ---------- Vorhören (einzelne Note) ----------
  async preview(inst, midi = 60, duration = 0.5) {
    await ensureRunning();
    this.ensureInstNodes();
    const ctx = getCtx();
    triggerInstrument(ctx, this._targetFor(inst.id), inst, midi, ctx.currentTime + 0.01, { duration });
  }

  // ---------- Transport ----------
  async play(followSong) {
    if (this.playing) return;
    await ensureRunning();
    this.ensureInstNodes();
    this.followSong = !!followSong;
    this.playing = true;
    this.orderIdx = followSong ? 0 : this.app.currentPatternIndex;
    this.row = 0;
    this._channelVoice = [];
    this._queue = [];
    this.nextRowTime = getCtx().currentTime + 0.08;
    this._timer = setInterval(() => this._scheduler(), this.lookaheadMs);
    this._drawPlayhead();
  }

  stop() {
    this.playing = false;
    if (this._timer) { clearInterval(this._timer); this._timer = null; }
    if (this._raf) { cancelAnimationFrame(this._raf); this._raf = null; }
    const ctx = getCtx();
    // alle klingenden Stimmen weich beenden
    for (const v of this._channelVoice) { if (v) try { v.stop(ctx.currentTime); } catch (_) {} }
    this._channelVoice = [];
    this._queue = [];
    if (this.onStep) this.onStep(this._activePatternIndex(), -1);
    if (this.onStop) this.onStop();
  }

  _secondsPerRow() {
    return 60 / (this.song.bpm * this.song.rowsPerBeat);
  }

  _activePatternIndex() {
    if (this.followSong) return this.song.order[this.orderIdx] ?? 0;
    return this.app.currentPatternIndex;
  }

  _currentPattern() {
    return this.song.patterns[this._activePatternIndex()];
  }

  _scheduler() {
    const ctx = getCtx();
    while (this.nextRowTime < ctx.currentTime + this.scheduleAhead) {
      this._scheduleRow(this.nextRowTime);
      this._advance();
    }
  }

  _scheduleRow(time) {
    const pat = this._currentPattern();
    if (!pat) return;
    const patIndex = this._activePatternIndex();
    const ctx = getCtx();
    for (let ch = 0; ch < this.song.channels; ch++) {
      if (this.app.mutedChannels.has(ch)) continue;
      const cell = pat.cells[this.row] && pat.cells[this.row][ch];
      if (!cell) continue;
      // vorherige Stimme dieses Kanals beenden (mono pro Kanal, wie im Tracker)
      if (cell.off) {
        if (this._channelVoice[ch]) this._channelVoice[ch].stop(time);
        this._channelVoice[ch] = null;
        continue;
      }
      const inst = this.app.getInstrument(cell.inst);
      if (!inst) continue;
      if (this._channelVoice[ch]) this._channelVoice[ch].stop(time);
      this._channelVoice[ch] = triggerInstrument(ctx, this._targetFor(inst.id), inst, cell.midi, time, {});
    }
    this._queue.push({ time, patternIndex: patIndex, row: this.row });
  }

  _advance() {
    this.nextRowTime += this._secondsPerRow();
    const pat = this._currentPattern();
    const rows = pat ? pat.rows : 16;
    this.row++;
    if (this.row >= rows) {
      this.row = 0;
      if (this.followSong) {
        this.orderIdx++;
        if (this.orderIdx >= this.song.order.length) this.orderIdx = 0;
      }
    }
  }

  _drawPlayhead() {
    const ctx = getCtx();
    const tick = () => {
      if (!this.playing) return;
      const now = ctx.currentTime;
      let last = null;
      while (this._queue.length && this._queue[0].time <= now) {
        last = this._queue.shift();
      }
      if (last && this.onStep) this.onStep(last.patternIndex, last.row);
      this._raf = requestAnimationFrame(tick);
    };
    this._raf = requestAnimationFrame(tick);
  }
}
