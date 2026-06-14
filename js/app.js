// Zentrale App: Zustand + Verdrahtung aller Bedienelemente.

import { $, el, colorForIndex, clamp } from './util.js';
import { defaultProject, createPattern, createInstrument } from './model.js';
import { Sequencer } from './sequencer.js';
import { MicRecorder } from './audio/recorder.js';
import { TrackerUI } from './ui/tracker.js';
import { SampleMakerUI } from './ui/samplemaker.js';
import { ArrangerUI } from './ui/arranger.js';
import { getAnalyser, ensureRunning } from './audio/context.js';
import { saveProjectToFile, openProjectFromFile, exportSongWav } from './project.js';

const letter = (i) => String.fromCharCode(65 + i);

export class App {
  constructor() {
    this.project = defaultProject();
    this.currentPatternIndex = 0;
    this.viewMode = 'tracker';        // 'tracker' | 'arranger'
    this.mutedChannels = new Set();
    this.octave = 4;
    this.selectedInstrumentId = this.project.song.instruments[0]?.id || null;
    this.seq = new Sequencer(this);
    this.recorder = new MicRecorder();
  }

  get song() { return this.project.song; }
  get currentPattern() { return this.song.patterns[this.currentPatternIndex]; }
  getInstrument(id) { return this.song.instruments.find((i) => i.id === id); }
  get selectedInstrument() { return this.getInstrument(this.selectedInstrumentId); }

  setStatus(msg) { $('#status').textContent = msg; }

  init() {
    this.tracker = new TrackerUI(this, $('#tracker'));
    this.sampleMaker = new SampleMakerUI(this, {
      bodyEl: $('#smBody'), canvas: $('#waveCanvas'), subtabsEl: $('#smSubtabs'),
      btnPreview: $('#btnPreview'), btnAdd: $('#btnAddInst')
    });
    this.arranger = new ArrangerUI(this, $('#arranger'));
    this.seq.onArrPos = (beat) => this.arranger.setPlayhead(beat);

    this.seq.onStep = (patternIndex, row) => {
      if (this.seq.playing && this.seq.followSong && patternIndex !== this.currentPatternIndex) {
        this.currentPatternIndex = patternIndex;
        this.tracker.render();
        this.renderPatternControls();
      }
      this.tracker.setPlayingRow(patternIndex === this.currentPatternIndex ? row : -1);
    };
    this.seq.onStop = () => {
      $('#btnPlay').classList.remove('active');
      this.tracker.setPlayingRow(-1);
    };

    this.seq.ensureInstNodes();
    this.bindTransport();
    this.bindProjectButtons();
    this.bindTabs();
    this.bindViewSwitch();
    this.sampleMaker.setMode('synth');
    this.renderAll();
    this.startVU();

    // AudioContext bei erster Interaktion aufwecken
    const wake = () => ensureRunning();
    document.addEventListener('pointerdown', wake, { once: true });

    // Globale Leertaste = Start/Stopp
    document.addEventListener('keydown', (e) => {
      const t = e.target;
      const inField = t && (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA');
      if (e.code === 'Space' && !inField) { e.preventDefault(); this.togglePlay(); }
    });

    $('#tracker').focus();
  }

  // ---------- Transport ----------
  bindTransport() {
    $('#btnPlay').addEventListener('click', () => this.togglePlay());
    $('#btnStop').addEventListener('click', () => this.stop());
    const bpm = $('#inpBpm'); bpm.value = this.song.bpm;
    bpm.addEventListener('input', () => { this.song.bpm = clamp(parseInt(bpm.value) || 138, 40, 300); });
    const rpb = $('#inpRpb'); rpb.value = this.song.rowsPerBeat;
    rpb.addEventListener('input', () => { this.song.rowsPerBeat = clamp(parseInt(rpb.value) || 4, 1, 8); this.tracker.render(); });
  }

  async togglePlay() {
    if (this.seq.playing) { this.stop(); return; }
    await this.seq.play(this.viewMode, $('#chkSong').checked);
    $('#btnPlay').classList.add('active');
    if (this.viewMode === 'arranger') this.setStatus('Spiele Arranger…');
    else this.setStatus($('#chkSong').checked ? 'Spiele Song…' : 'Spiele Pattern ' + letter(this.currentPatternIndex) + '…');
  }

  stop() {
    this.seq.stop();
    $('#btnPlay').classList.remove('active');
    this.setStatus('Gestoppt.');
  }

  // ---------- Projekt-Buttons ----------
  bindProjectButtons() {
    $('#btnNew').addEventListener('click', () => {
      if (confirm('Neues Projekt – aktuelle Arbeit verwerfen?')) this.loadProject(defaultProject());
    });
    $('#btnSave').addEventListener('click', () => { saveProjectToFile(this.project); this.setStatus('Projekt gespeichert (.trance).'); });
    const fileOpen = $('#fileOpen');
    $('#btnOpen').addEventListener('click', () => fileOpen.click());
    fileOpen.addEventListener('change', async () => {
      if (!fileOpen.files[0]) return;
      try {
        const project = await openProjectFromFile(fileOpen.files[0]);
        this.loadProject(project);
        this.setStatus('Projekt geladen.');
      } catch (err) {
        this.setStatus('Fehler beim Laden: ' + err.message);
      }
      fileOpen.value = '';
    });
    $('#btnExport').addEventListener('click', async () => {
      const btn = $('#btnExport');
      btn.disabled = true; this.setStatus('Rendere WAV…');
      try {
        await exportSongWav(this);
        this.setStatus('WAV exportiert.');
      } catch (err) {
        this.setStatus('Export fehlgeschlagen: ' + err.message);
      }
      btn.disabled = false;
    });
  }

  loadProject(project) {
    this.stop();
    this.project = project;
    this.currentPatternIndex = 0;
    this.mutedChannels = new Set();
    this.selectedInstrumentId = this.song.instruments[0]?.id || null;
    $('#inpBpm').value = this.song.bpm;
    $('#inpRpb').value = this.song.rowsPerBeat;
    this.seq.instNodes.forEach((n) => n.disconnect());
    this.seq.instNodes.clear();
    this.seq.ensureInstNodes();
    if (this.arranger) this.arranger.selectedId = null;
    this.renderAll();
  }

  // ---------- Tabs ----------
  bindTabs() {
    $('#sideTabs').querySelectorAll('.tab').forEach((tab) => {
      tab.addEventListener('click', () => {
        $('#sideTabs').querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t === tab));
        document.querySelectorAll('.tabpanel').forEach((p) => p.classList.toggle('hidden', p.dataset.panel !== tab.dataset.tab));
        if (tab.dataset.tab === 'mixer') this.renderMixer();
      });
    });
  }

  // ---------- Ansicht: Tracker / Arranger ----------
  bindViewSwitch() {
    $('#viewSwitch').querySelectorAll('button').forEach((b) => {
      b.addEventListener('click', () => this.setView(b.dataset.view));
    });
  }

  setView(view) {
    if (view === this.viewMode) return;
    if (this.seq.playing) this.stop();
    this.viewMode = view;
    $('#viewSwitch').querySelectorAll('button').forEach((b) => b.classList.toggle('active', b.dataset.view === view));
    $('#trackerView').classList.toggle('hidden', view !== 'tracker');
    $('#arrangerView').classList.toggle('hidden', view !== 'arranger');
    $('#patternControls').classList.toggle('hidden', view !== 'tracker');
    $('#arrangerControls').classList.toggle('hidden', view !== 'arranger');
    if (view === 'arranger') { this.arranger.render(); $('#arranger').focus(); }
    else { this.tracker.render(); $('#tracker').focus(); }
    this.setStatus(view === 'arranger' ? 'Arranger-Ansicht (Music-Maker-Stil).' : 'Tracker-Ansicht.');
  }

  renderArrangerControls() {
    const c = $('#arrangerControls');
    c.innerHTML = '';
    const arr = this.song.arrangement;
    const bars = el('input', { type: 'number', min: 1, max: 64, step: 1, value: arr.bars, style: 'width:58px' });
    bars.addEventListener('change', () => { arr.bars = clamp(parseInt(bars.value) || 8, 1, 64); this.arranger.render(); });
    c.appendChild(el('label', { class: 'muted', style: 'display:flex;gap:4px;align-items:center' }, ['Takte', bars]));
    const tracks = el('input', { type: 'number', min: 1, max: 16, step: 1, value: arr.tracks, style: 'width:54px' });
    tracks.addEventListener('change', () => { arr.tracks = clamp(parseInt(tracks.value) || 8, 1, 16); this.arranger.render(); });
    c.appendChild(el('label', { class: 'muted', style: 'display:flex;gap:4px;align-items:center' }, ['Spuren', tracks]));
    c.appendChild(el('button', { class: 'pc-btn', text: 'Leeren', title: 'Alle Blöcke entfernen',
      onclick: () => { if (confirm('Arranger leeren?')) { arr.clips = []; this.arranger.render(); } } }));
  }

  // ---------- Instrumente ----------
  setOctave(o) {
    this.octave = clamp(o, 0, 8);
    $('#octLabel').textContent = this.octave;
  }

  selectInstrument(id) {
    this.selectedInstrumentId = id;
    this.renderInstrumentList();
    const inst = this.selectedInstrument;
    $('#activeInstName').textContent = inst ? inst.name : '—';
  }

  addInstrument(inst) {
    this.song.instruments.push(inst);
    this.seq.ensureInstNodes();
    this.renderInstrumentList();
    this.renderMixer();
  }

  removeInstrument(id) {
    const idx = this.song.instruments.findIndex((i) => i.id === id);
    if (idx < 0) return;
    this.song.instruments.splice(idx, 1);
    // Referenzen in allen Patterns entfernen
    for (const pat of this.song.patterns) {
      for (let r = 0; r < pat.rows; r++) {
        for (let c = 0; c < this.song.channels; c++) {
          const cell = pat.cells[r][c];
          if (cell && cell.inst === id) pat.cells[r][c] = null;
        }
      }
    }
    // Arranger-Blöcke dieses Instruments entfernen
    if (this.song.arrangement && this.song.arrangement.clips) {
      this.song.arrangement.clips = this.song.arrangement.clips.filter((c) => c.inst !== id);
    }
    if (this.selectedInstrumentId === id) this.selectedInstrumentId = this.song.instruments[0]?.id || null;
    this.seq.ensureInstNodes();
    this.renderAll();
  }

  renderInstrumentList() {
    const list = $('#instList');
    list.innerHTML = '';
    this.song.instruments.forEach((inst, i) => {
      const item = el('li', {
        class: 'inst-item' + (inst.id === this.selectedInstrumentId ? ' active' : ''),
        onclick: () => { this.selectInstrument(inst.id); this.seq.preview(inst, inst.type === 'drum' ? 60 : 60, 0.5); }
      }, [
        el('span', { class: 'inst-num', text: String(i + 1).padStart(2, '0') }),
        el('span', { class: 'inst-swatch', style: `background:${colorForIndex(i)}` }),
        el('span', { class: 'inst-name', text: inst.name }),
        el('span', { class: 'inst-kind', text: inst.type }),
        el('button', { title: 'Umbenennen', text: '✎', onclick: (e) => { e.stopPropagation(); this.renameInstrument(inst); } }),
        el('button', { title: 'Löschen', text: '🗑', onclick: (e) => { e.stopPropagation(); if (confirm('Instrument „' + inst.name + '" löschen?')) this.removeInstrument(inst.id); } })
      ]);
      list.appendChild(item);
    });
    const sel = this.selectedInstrument;
    $('#activeInstName').textContent = sel ? sel.name : '—';
  }

  renameInstrument(inst) {
    const name = prompt('Neuer Name:', inst.name);
    if (name) { inst.name = name; this.renderInstrumentList(); this.renderMixer(); }
  }

  // ---------- Mixer ----------
  renderMixer() {
    const wrap = $('#mixer');
    if (!wrap) return;
    wrap.innerHTML = '';
    this.song.instruments.forEach((inst, i) => {
      const vol = el('input', { type: 'range', min: 0, max: 100, step: 1, value: Math.round(inst.volume * 100) });
      vol.setAttribute('orient', 'vertical');
      vol.addEventListener('input', () => { inst.volume = parseInt(vol.value) / 100; this.seq.updateMix(); });
      const mute = el('button', { class: 'mini mute' + (inst.mute ? ' on' : ''), text: 'M',
        onclick: () => { inst.mute = !inst.mute; this.seq.updateMix(); this.renderMixer(); } });
      const solo = el('button', { class: 'mini solo' + (inst.solo ? ' on' : ''), text: 'S',
        onclick: () => { inst.solo = !inst.solo; this.seq.updateMix(); this.renderMixer(); } });
      wrap.appendChild(el('div', { class: 'mix-ch' }, [
        el('span', { class: 'inst-swatch', style: `background:${colorForIndex(i)};width:100%;height:6px` }),
        el('span', { class: 'name', text: inst.name }),
        vol,
        el('div', { class: 'mbtns' }, [mute, solo])
      ]));
    });
  }

  // ---------- Pattern-Steuerung ----------
  renderPatternControls() {
    const c = $('#patternControls');
    c.innerHTML = '';

    const sel = el('select', { onchange: () => { this.currentPatternIndex = parseInt(sel.value); this.tracker.cursorRow = 0; this.tracker.render(); } });
    this.song.patterns.forEach((p, i) => {
      const o = el('option', { value: i, text: letter(i) + ' · ' + p.name });
      if (i === this.currentPatternIndex) o.selected = true;
      sel.appendChild(o);
    });
    c.appendChild(sel);

    c.appendChild(el('button', { class: 'pc-btn', text: '＋ Pattern', onclick: () => this.addPattern() }));
    c.appendChild(el('button', { class: 'pc-btn', text: 'Klon', onclick: () => this.clonePattern() }));
    c.appendChild(el('button', { class: 'pc-btn', text: '✕', title: 'Pattern löschen', onclick: () => this.deletePattern() }));

    const rows = el('input', { type: 'number', min: 1, max: 64, step: 1, value: this.currentPattern.rows, style: 'width:58px' });
    rows.addEventListener('change', () => this.resizePattern(parseInt(rows.value) || 16));
    c.appendChild(el('label', { class: 'muted', style: 'display:flex;gap:4px;align-items:center' }, ['Reihen', rows]));

    // Order-Editor
    const order = el('div', { class: 'pattern-controls', style: 'margin-left:8px' });
    order.appendChild(el('span', { class: 'muted', text: 'Order:' }));
    this.song.order.forEach((pi, oi) => {
      order.appendChild(el('button', {
        class: 'pc-btn', text: letter(pi), title: 'Klick = aus Order entfernen',
        onclick: () => { this.song.order.splice(oi, 1); this.renderPatternControls(); }
      }));
    });
    order.appendChild(el('button', { class: 'pc-btn', text: '＋ akt.', title: 'Aktuelles Pattern an Order anhängen',
      onclick: () => { this.song.order.push(this.currentPatternIndex); this.renderPatternControls(); } }));
    c.appendChild(order);
  }

  addPattern() {
    this.song.patterns.push(createPattern('Pattern ' + letter(this.song.patterns.length), this.song.channels, this.currentPattern?.rows || 16));
    this.currentPatternIndex = this.song.patterns.length - 1;
    this.tracker.render();
    this.renderPatternControls();
  }

  clonePattern() {
    const src = this.currentPattern;
    const copy = createPattern(src.name + ' Kopie', this.song.channels, src.rows);
    copy.cells = src.cells.map((row) => row.map((cell) => (cell ? { ...cell } : null)));
    this.song.patterns.splice(this.currentPatternIndex + 1, 0, copy);
    this.currentPatternIndex++;
    this.tracker.render();
    this.renderPatternControls();
  }

  deletePattern() {
    if (this.song.patterns.length <= 1) { this.setStatus('Mindestens ein Pattern nötig.'); return; }
    const removed = this.currentPatternIndex;
    this.song.patterns.splice(removed, 1);
    // Order anpassen: Verweise auf gelöschtes raus, höhere dekrementieren
    this.song.order = this.song.order.filter((pi) => pi !== removed).map((pi) => (pi > removed ? pi - 1 : pi));
    this.currentPatternIndex = clamp(removed, 0, this.song.patterns.length - 1);
    this.tracker.render();
    this.renderPatternControls();
  }

  resizePattern(newRows) {
    newRows = clamp(newRows, 1, 64);
    const pat = this.currentPattern;
    if (newRows > pat.rows) {
      for (let r = pat.rows; r < newRows; r++) {
        pat.cells.push(new Array(this.song.channels).fill(null));
      }
    } else {
      pat.cells.length = newRows;
    }
    pat.rows = newRows;
    this.tracker.cursorRow = clamp(this.tracker.cursorRow, 0, newRows - 1);
    this.tracker.render();
  }

  renderAll() {
    this.setOctave(this.octave);
    this.tracker.render();
    this.renderInstrumentList();
    this.renderMixer();
    this.renderPatternControls();
    this.renderArrangerControls();
    this.arranger.render();
  }

  // ---------- VU-Meter ----------
  startVU() {
    const analyser = getAnalyser();
    const data = new Uint8Array(analyser.fftSize);
    const bar = document.querySelector('#vuMeter .vu-bar');
    const tick = () => {
      analyser.getByteTimeDomainData(data);
      let peak = 0;
      for (let i = 0; i < data.length; i++) peak = Math.max(peak, Math.abs(data[i] - 128) / 128);
      if (bar) bar.style.width = Math.min(100, peak * 130) + '%';
      requestAnimationFrame(tick);
    };
    tick();
  }
}
