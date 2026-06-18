// Sample Maker: Samples/Instrumente erzeugen per Synth, Drum-Synthese,
// Mikrofon-Aufnahme oder Datei-Import. Mit Wellenform-Vorschau.

import { el, uid } from '../util.js';
import { createInstrument, PRESETS, presetCategories } from '../model.js';
import { renderInstrumentToBuffer } from '../audio/instruments.js';
import { getCtx } from '../audio/context.js';
import { decodeAudioFile } from '../project.js';

function cloneInstParams(src) {
  const o = JSON.parse(JSON.stringify({ ...src, buffer: undefined }));
  delete o.id;
  return o;
}

function sliceBuffer(buffer, startFrac, endFrac) {
  const ctx = getCtx();
  const s = Math.floor(buffer.length * startFrac);
  const e = Math.max(s + 1, Math.floor(buffer.length * endFrac));
  const len = e - s;
  const out = ctx.createBuffer(buffer.numberOfChannels, len, buffer.sampleRate);
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    out.getChannelData(c).set(buffer.getChannelData(c).subarray(s, e));
  }
  return out;
}

export class SampleMakerUI {
  constructor(app, refs) {
    this.app = app;
    this.bodyEl = refs.bodyEl;
    this.canvas = refs.canvas;
    this.subtabsEl = refs.subtabsEl;
    this.btnPreview = refs.btnPreview;
    this.btnAdd = refs.btnAdd;

    this.mode = 'synth';
    this.editTarget = null;   // bestehendes Instrument, das bearbeitet wird
    this._presetCat = null;   // gewählte Preset-Kategorie
    this.synthDraft = createInstrument({ type: 'synth', name: 'Mein Synth' });
    this.drumDraft = createInstrument({ type: 'drum', name: 'Meine Drum', drum: 'kick' });
    this.bake = false;
    this.captured = null;     // AudioBuffer aus Mic/Import
    this.capturedName = 'Sample';
    this.trimStart = 0; this.trimEnd = 1;
    this.baseNote = 60; this.loop = false;
    this._recTimer = null;

    this.subtabsEl.querySelectorAll('.subtab').forEach((b) => {
      b.addEventListener('click', () => this.setMode(b.dataset.sm));
    });
    this.btnPreview.addEventListener('click', () => this.preview());
    this.btnAdd.addEventListener('click', () => this.add());
  }

  setMode(mode) {
    this.editTarget = null;
    this.mode = mode;
    this.updateSubtabActive(mode);
    this.renderBody();
  }

  updateSubtabActive(mode) {
    this.subtabsEl.querySelectorAll('.subtab').forEach((b) => b.classList.toggle('active', b.dataset.sm === mode));
  }

  /** Ein bestehendes Instrument zum Bearbeiten laden. */
  editInstrument(inst) {
    this.editTarget = inst;
    this.mode = inst.type === 'drum' ? 'drum' : inst.type === 'sample' ? 'sampleedit' : 'synth';
    this.updateSubtabActive(this.mode);
    this.renderBody();
  }

  activeDraft() {
    if (this.editTarget) return this.editTarget;
    return this.mode === 'drum' ? this.drumDraft : this.synthDraft;
  }

  // ---------- UI-Bausteine ----------
  slider(label, obj, key, min, max, step, fmt) {
    const val = el('span', { class: 'val' });
    const setVal = () => { val.textContent = fmt ? fmt(obj[key]) : obj[key]; };
    const input = el('input', {
      type: 'range', min, max, step, value: obj[key],
      oninput: () => { obj[key] = parseFloat(input.value); setVal(); this.scheduleDraw(); }
    });
    setVal();
    return el('div', { class: 'ctl' }, [el('label', { text: label }), input, val]);
  }

  select(label, obj, key, options) {
    const sel = el('select', { onchange: () => { obj[key] = sel.value; this.scheduleDraw(); } });
    for (const o of options) {
      const opt = el('option', { value: o.value, text: o.label });
      if (o.value === obj[key]) opt.selected = true;
      sel.appendChild(opt);
    }
    return el('div', { class: 'ctl' }, [el('label', { text: label }), sel]);
  }

  checkbox(label, obj, key) {
    const cb = el('input', { type: 'checkbox', onchange: () => { obj[key] = cb.checked; this.scheduleDraw(); } });
    cb.checked = !!obj[key];
    return el('div', { class: 'ctl' }, [el('label', { text: label }), cb]);
  }

  textField(label, value, onInput) {
    const inp = el('input', { type: 'text', value, oninput: () => onInput(inp.value) });
    return el('div', { class: 'ctl' }, [el('label', { text: label }), inp]);
  }

  bakeToggle() {
    const cb = el('input', { type: 'checkbox', onchange: () => { this.bake = cb.checked; } });
    cb.checked = this.bake;
    return el('div', { class: 'ctl' }, [
      el('label', { text: 'Als Sample backen' }), cb,
      el('span', { class: 'muted', text: 'fixe Aufnahme statt Live-Synth' })
    ]);
  }

  renderBody() {
    const b = this.bodyEl;
    b.innerHTML = '';
    if (this.editTarget) b.appendChild(this.editHeader());
    if (this.mode === 'synth') this.renderSynth(b);
    else if (this.mode === 'drum') this.renderDrum(b);
    else if (this.mode === 'mic') this.renderMic(b);
    else if (this.mode === 'import') this.renderImport(b);
    else if (this.mode === 'presets') this.renderPresets(b);
    else if (this.mode === 'sampleedit') this.renderSampleEdit(b);
    this.updateActions();
    this.scheduleDraw();
  }

  updateActions() {
    const hide = this.mode === 'presets';
    this.btnPreview.style.display = hide ? 'none' : '';
    this.btnAdd.style.display = hide ? 'none' : '';
    if (!hide) this.btnAdd.textContent = this.editTarget ? '＋ Als Kopie hinzufügen' : '＋ Als Instrument hinzufügen';
  }

  editHeader() {
    return el('div', { class: 'sm-edit-head' }, [
      el('span', { text: 'Bearbeite: ' }),
      el('strong', { text: this.editTarget.name }),
      el('button', {
        class: 'pc-btn', text: '＋ Neu', title: 'Neues Instrument erstellen statt bearbeiten',
        onclick: () => { this.editTarget = null; if (this.mode === 'sampleedit') this.mode = 'synth'; this.updateSubtabActive(this.mode); this.renderBody(); }
      })
    ]);
  }

  renderPresets(b) {
    const cats = presetCategories();
    if (!cats.includes(this._presetCat)) this._presetCat = cats[0];
    b.appendChild(el('div', { class: 'muted', text: 'Kategorie wählen, dann Preset anklicken zum Hinzufügen:' }));

    const sel = el('select');
    for (const c of cats) {
      const n = PRESETS.filter((p) => p.category === c).length;
      const o = el('option', { value: c, text: `${c} (${n})` });
      if (c === this._presetCat) o.selected = true;
      sel.appendChild(o);
    }
    b.appendChild(el('div', { class: 'ctl' }, [el('label', { text: 'Kategorie' }), sel]));

    const list = el('div', { class: 'row-flex', style: 'margin-top:8px' });
    const fill = () => {
      list.innerHTML = '';
      for (const p of PRESETS.filter((x) => x.category === this._presetCat)) {
        list.appendChild(el('div', { class: 'chip', text: p.name, title: 'Hinzufügen', onclick: () => this.app.addPresetInstrument(p) }));
      }
    };
    sel.addEventListener('change', () => { this._presetCat = sel.value; fill(); });
    b.appendChild(list);
    fill();
  }

  renderSampleEdit(b) {
    const inst = this.editTarget;
    if (!inst) return;
    b.appendChild(this.textField('Name', inst.name, (v) => { inst.name = v; this.app.renderInstrumentList(); }));
    b.appendChild(this.slider('Basis-Note (MIDI)', inst, 'baseNote', 24, 96, 1, (v) => Math.round(v)));
    b.appendChild(this.slider('Pegel', inst, 'gain', 0, 1, 0.01, (v) => v.toFixed(2)));
    b.appendChild(this.checkbox('Loop', inst, 'loop'));
    if (!inst.buffer) b.appendChild(el('div', { class: 'muted', text: '(kein Sample-Buffer geladen)' }));
  }

  renderSynth(b) {
    const d = this.activeDraft();
    b.appendChild(this.textField('Name', d.name, (v) => { d.name = v; if (this.editTarget) this.app.renderInstrumentList(); }));
    b.appendChild(this.select('Wellenform', d, 'wave', [
      { value: 'sine', label: 'Sinus' }, { value: 'sawtooth', label: 'Sägezahn' },
      { value: 'square', label: 'Rechteck' }, { value: 'triangle', label: 'Dreieck' }
    ]));
    b.appendChild(this.slider('Attack', d, 'attack', 0, 1, 0.001, (v) => v.toFixed(3) + 's'));
    b.appendChild(this.slider('Decay', d, 'decay', 0, 1, 0.001, (v) => v.toFixed(3) + 's'));
    b.appendChild(this.slider('Sustain', d, 'sustain', 0, 1, 0.01, (v) => v.toFixed(2)));
    b.appendChild(this.slider('Release', d, 'release', 0, 1.5, 0.001, (v) => v.toFixed(3) + 's'));
    b.appendChild(this.select('Filter-Typ', d, 'filterType', [
      { value: 'lowpass', label: 'Tiefpass' }, { value: 'highpass', label: 'Hochpass' }, { value: 'bandpass', label: 'Bandpass' }
    ]));
    b.appendChild(this.slider('Filter Cutoff', d, 'cutoff', 80, 12000, 10, (v) => Math.round(v) + ' Hz'));
    b.appendChild(this.slider('Resonanz (Q)', d, 'q', 0.1, 20, 0.1, (v) => v.toFixed(1)));
    b.appendChild(this.slider('Filter-Hüllkurve', d, 'filterEnv', 0, 1, 0.01, (v) => v.toFixed(2)));
    b.appendChild(this.slider('Sub-Oszillator', d, 'sub', 0, 1, 0.01, (v) => v.toFixed(2)));
    b.appendChild(this.slider('Verstimmung', d, 'detune', -50, 50, 1, (v) => Math.round(v) + ' ct'));
    b.appendChild(this.checkbox('Fat (3 Osz.)', d, 'fat'));
    b.appendChild(this.slider('FM-Verhältnis', d, 'fmRatio', 0, 8, 0.5, (v) => v.toFixed(1)));
    b.appendChild(this.slider('FM-Stärke', d, 'fmAmount', 0, 6, 0.05, (v) => v.toFixed(2)));
    b.appendChild(this.slider('Rauschen', d, 'noise', 0, 1, 0.01, (v) => v.toFixed(2)));
    b.appendChild(this.slider('Drive/Verzerrung', d, 'drive', 0, 1, 0.01, (v) => v.toFixed(2)));
    b.appendChild(this.slider('Pegel', d, 'gain', 0, 1, 0.01, (v) => v.toFixed(2)));
    b.appendChild(this.bakeToggle());
  }

  renderDrum(b) {
    const d = this.activeDraft();
    b.appendChild(this.textField('Name', d.name, (v) => { d.name = v; if (this.editTarget) this.app.renderInstrumentList(); }));
    const chips = el('div', { class: 'row-flex' });
    [['kick', 'Kick'], ['snare', 'Snare'], ['hat', 'HiHat'], ['clap', 'Clap'], ['tom', 'Tom']].forEach(([val, lbl]) => {
      const c = el('div', { class: 'chip' + (d.drum === val ? ' active' : ''), text: lbl,
        onclick: () => { d.drum = val; this.renderBody(); this.preview(); } });
      chips.appendChild(c);
    });
    b.appendChild(el('div', { class: 'ctl' }, [el('label', { text: 'Typ' }), chips]));
    b.appendChild(this.slider('Tune', d, 'tune', 20, 400, 1, (v) => Math.round(v) + ' Hz'));
    b.appendChild(this.slider('Decay', d, 'decay', 0.02, 1.2, 0.01, (v) => v.toFixed(2) + 's'));
    if (d.drum === 'kick') b.appendChild(this.slider('Click', d, 'click', 0, 1, 0.01, (v) => v.toFixed(2)));
    b.appendChild(this.slider('Cutoff (HiHat)', d, 'cutoff', 2000, 12000, 50, (v) => Math.round(v) + ' Hz'));
    b.appendChild(this.slider('Drive/Verzerrung', d, 'drive', 0, 1, 0.01, (v) => v.toFixed(2)));
    b.appendChild(this.checkbox('Tonhöhe folgt Note', d, 'pitched'));
    b.appendChild(this.slider('Pegel', d, 'gain', 0, 1, 0.01, (v) => v.toFixed(2)));
    b.appendChild(this.bakeToggle());
  }

  renderMic(b) {
    const status = el('span', { class: 'muted', text: 'Bereit zur Aufnahme.' });
    const bar = el('span', { class: 'vu-bar' });
    const meter = el('span', { class: 'vu', style: 'width:160px' }, [bar]);
    const recBtn = el('button', { class: 'p-btn rec-btn', text: '● Aufnahme starten' });

    recBtn.addEventListener('click', async () => {
      const rec = this.app.recorder;
      if (!rec.recording) {
        try {
          rec.onLevel = (lvl) => { bar.style.width = Math.min(100, lvl * 140) + '%'; };
          await rec.start();
          recBtn.textContent = '■ Aufnahme stoppen';
          recBtn.classList.add('recording');
          let secs = 0;
          status.textContent = 'Aufnahme… 0.0s';
          this._recTimer = setInterval(() => { secs += 0.1; status.textContent = `Aufnahme… ${secs.toFixed(1)}s`; }, 100);
        } catch (err) {
          status.textContent = 'Fehler: ' + err.message;
        }
      } else {
        clearInterval(this._recTimer);
        recBtn.textContent = '● Aufnahme starten';
        recBtn.classList.remove('recording');
        status.textContent = 'Verarbeite…';
        try {
          const buf = await rec.stop();
          this.setCaptured(buf, 'Aufnahme');
          status.textContent = `Aufnahme fertig: ${buf.duration.toFixed(2)}s`;
        } catch (err) {
          status.textContent = 'Fehler: ' + err.message;
        }
        bar.style.width = '0%';
      }
    });

    b.appendChild(el('div', { class: 'ctl' }, [el('label', { text: 'Mikrofon' }), recBtn]));
    b.appendChild(el('div', { class: 'ctl' }, [el('label', { text: 'Pegel' }), meter]));
    b.appendChild(el('div', { class: 'ctl' }, [el('label', { text: '' }), status]));
    this.appendSampleControls(b);
  }

  renderImport(b) {
    const status = el('span', { class: 'muted', text: 'WAV/MP3/OGG wählen…' });
    const file = el('input', { type: 'file', accept: 'audio/*' });
    file.addEventListener('change', async () => {
      if (!file.files[0]) return;
      status.textContent = 'Lade…';
      try {
        const ab = await file.files[0].arrayBuffer();
        const buf = await decodeAudioFile(ab);
        this.setCaptured(buf, file.files[0].name.replace(/\.[^.]+$/, ''));
        status.textContent = `Geladen: ${buf.duration.toFixed(2)}s`;
      } catch (err) {
        status.textContent = 'Konnte Datei nicht laden: ' + err.message;
      }
    });
    b.appendChild(el('div', { class: 'ctl' }, [el('label', { text: 'Audiodatei' }), file]));
    b.appendChild(el('div', { class: 'ctl' }, [el('label', { text: '' }), status]));
    this.appendSampleControls(b);
  }

  // Gemeinsame Sample-Optionen (Mic + Import)
  appendSampleControls(b) {
    b.appendChild(this.textField('Name', this.capturedName, (v) => this.capturedName = v));
    const self = this;
    b.appendChild(this.slider('Trim Start', { get s() { return self.trimStart; }, set s(v) { self.trimStart = v; } }, 's', 0, 0.99, 0.01, (v) => Math.round(v * 100) + '%'));
    b.appendChild(this.slider('Trim Ende', { get e() { return self.trimEnd; }, set e(v) { self.trimEnd = v; } }, 'e', 0.01, 1, 0.01, (v) => Math.round(v * 100) + '%'));
    b.appendChild(this.slider('Basis-Note (MIDI)', { get n() { return self.baseNote; }, set n(v) { self.baseNote = Math.round(v); } }, 'n', 24, 96, 1, (v) => Math.round(v)));
    b.appendChild(this.checkbox('Loop', this, 'loop'));
  }

  setCaptured(buffer, name) {
    this.captured = buffer;
    this.capturedName = name || 'Sample';
    this.trimStart = 0; this.trimEnd = 1;
    this.renderBody();
  }

  // ---------- Aktionen ----------
  async preview() {
    if (this.mode === 'synth' || this.mode === 'drum') {
      const d = this.activeDraft();
      await this.app.seq.preview(d, 60, 0.7);
      this.drawDraft();
    } else if (this.mode === 'sampleedit' && this.editTarget) {
      const inst = this.editTarget;
      await this.app.seq.preview(inst, inst.baseNote || 60, Math.min(3, inst.buffer ? inst.buffer.duration : 1));
    } else if (this.captured) {
      const buf = sliceBuffer(this.captured, this.trimStart, this.trimEnd);
      const temp = createInstrument({ type: 'sample', name: 'preview', baseNote: this.baseNote, loop: false });
      temp.buffer = buf;
      await this.app.seq.preview(temp, this.baseNote, Math.min(buf.duration, 3));
    }
  }

  async add() {
    if (this.editTarget) { this.app.duplicateInstrument(this.editTarget.id); return; }
    let inst;
    if (this.mode === 'synth' || this.mode === 'drum') {
      const src = this.activeDraft();
      if (this.bake) {
        const buffer = await renderInstrumentToBuffer(src, 60, Math.min(2, (src.decay || 0.3) + (src.release || 0.2) + 0.6));
        inst = createInstrument({ type: 'sample', name: src.name + ' (Sample)', baseNote: 60, gain: 0.95 });
        inst.buffer = buffer;
      } else {
        inst = createInstrument(cloneInstParams(src));
      }
    } else {
      if (!this.captured) { this.app.setStatus('Erst etwas aufnehmen/importieren.'); return; }
      const buffer = sliceBuffer(this.captured, this.trimStart, this.trimEnd);
      inst = createInstrument({ type: 'sample', name: this.capturedName || 'Sample', baseNote: this.baseNote, loop: this.loop, gain: 0.95 });
      inst.buffer = buffer;
    }
    this.app.addInstrument(inst);
    this.app.selectInstrument(inst.id);
    this.app.setStatus('Instrument „' + inst.name + '" hinzugefügt.');
  }

  // ---------- Wellenform ----------
  scheduleDraw() {
    clearTimeout(this._drawT);
    this._drawT = setTimeout(() => this.draw(), 120);
  }

  async draw() {
    if (this.mode === 'synth' || this.mode === 'drum') this.drawDraft();
    else if (this.mode === 'sampleedit' && this.editTarget && this.editTarget.buffer) this.drawWave(this.editTarget.buffer, 0, 1);
    else if ((this.mode === 'mic' || this.mode === 'import') && this.captured) this.drawWave(this.captured, this.trimStart, this.trimEnd);
    else this.clearCanvas();
  }

  async drawDraft() {
    try {
      const buf = await renderInstrumentToBuffer(this.activeDraft(), 60, 1.0);
      this.drawWave(buf, 0, 1);
    } catch (_) { this.clearCanvas(); }
  }

  clearCanvas() {
    const ctx = this.canvas.getContext('2d');
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  drawWave(buffer, startFrac, endFrac) {
    const c = this.canvas;
    const ctx = c.getContext('2d');
    const W = c.width, H = c.height;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#0a0c10';
    ctx.fillRect(0, 0, W, H);
    const data = buffer.getChannelData(0);
    const mid = H / 2;
    ctx.strokeStyle = '#34d399';
    ctx.beginPath();
    const step = Math.max(1, Math.floor(data.length / W));
    for (let x = 0; x < W; x++) {
      let min = 1, max = -1;
      for (let i = 0; i < step; i++) {
        const v = data[x * step + i] || 0;
        if (v < min) min = v;
        if (v > max) max = v;
      }
      ctx.moveTo(x + 0.5, mid + min * mid);
      ctx.lineTo(x + 0.5, mid + max * mid);
    }
    ctx.stroke();
    // Trim-Markierungen
    ctx.fillStyle = 'rgba(56,189,248,.12)';
    ctx.fillRect(0, 0, startFrac * W, H);
    ctx.fillRect(endFrac * W, 0, W - endFrac * W, H);
    ctx.strokeStyle = '#38bdf8';
    ctx.beginPath();
    ctx.moveTo(startFrac * W, 0); ctx.lineTo(startFrac * W, H);
    ctx.moveTo(endFrac * W, 0); ctx.lineTo(endFrac * W, H);
    ctx.stroke();
  }
}
