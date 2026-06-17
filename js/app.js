// Zentrale App: Zustand + Verdrahtung aller Bedienelemente.

import { $, el, colorForIndex, clamp } from './util.js';
import { defaultProject, emptyProject, createPattern, createInstrument, cloneInstrument, arrangementEndBeats, BEATS_PER_BAR } from './model.js';
import { Sequencer } from './sequencer.js';
import { MicRecorder } from './audio/recorder.js';
import { TrackerUI } from './ui/tracker.js';
import { SampleMakerUI } from './ui/samplemaker.js';
import { ArrangerUI } from './ui/arranger.js';
import { KeyboardUI, DrumkitUI } from './ui/keyboard.js';
import { PianoRollUI } from './ui/pianoroll.js';
import { getAnalyser, ensureRunning } from './audio/context.js';
import { saveProjectToFile, openProjectFromFile, exportSongWav, decodeAudioFile } from './project.js';
import { buildDemo, DEMO_LIST } from './demos.js';

const letter = (i) => String.fromCharCode(65 + i);

export class App {
  constructor() {
    this.project = defaultProject();
    this.currentPatternIndex = 0;
    this.viewMode = 'arranger';       // 'tracker' | 'arranger' (Arranger ist Standard)
    this.mutedChannels = new Set();
    this.octave = 4;
    this.seekBeat = 0;                // Start-/Playhead-Position im Arranger
    this.drumkitPads = null;          // belegbare Drum-Kit-Pads (Instrument-IDs)
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
    this.keyboard = new KeyboardUI(this, $('#keyboard'));
    this.drumkit = new DrumkitUI(this, $('#drumkit'));
    this.pianoRoll = new PianoRollUI(this, $('#pianoRoll'));
    $('#kbOctUp').addEventListener('click', () => { this.setOctave(this.octave + 1); this.keyboard.render(); });
    $('#kbOctDown').addEventListener('click', () => { this.setOctave(this.octave - 1); this.keyboard.render(); });
    this.seq.onArrPos = (beat) => { this.arranger.setPlayhead(beat); this.updateArrTime(beat < 0 ? this.seekBeat : beat); };

    this.seq.onStep = (patternIndex, row) => {
      if (row >= 0) $('#timeDisplay').textContent = 'Pat ' + letter(patternIndex) + ' · Reihe ' + (row + 1);
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
    this.bindFileDrop();
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

    this.applyView();
  }

  // ---------- Audio-Dateien per Drag & Drop importieren ----------
  bindFileDrop() {
    const overlay = $('#dropOverlay');
    let depth = 0;
    const hasFiles = (e) => e.dataTransfer && Array.from(e.dataTransfer.types || []).includes('Files');
    window.addEventListener('dragenter', (e) => { if (hasFiles(e)) { depth++; overlay.classList.add('show'); } });
    window.addEventListener('dragover', (e) => { if (hasFiles(e)) { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; } });
    window.addEventListener('dragleave', (e) => { if (hasFiles(e)) { depth = Math.max(0, depth - 1); if (depth === 0) overlay.classList.remove('show'); } });
    window.addEventListener('drop', (e) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth = 0; overlay.classList.remove('show');
      this.importAudioFiles(e.dataTransfer.files);
    });
  }

  async importAudioFiles(files) {
    const list = Array.from(files).filter((f) => f.type.startsWith('audio/') || /\.(wav|mp3|ogg|m4a|aac|flac|webm)$/i.test(f.name));
    if (!list.length) { this.setStatus('Keine Audiodateien erkannt.'); return; }
    this.setStatus('Importiere ' + list.length + ' Sample(s)…');
    let added = 0, lastId = null;
    for (const f of list) {
      try {
        const buf = await decodeAudioFile(await f.arrayBuffer());
        const inst = createInstrument({ type: 'sample', name: f.name.replace(/\.[^.]+$/, ''), baseNote: 60, gain: 0.95 });
        inst.buffer = buf;
        this.addInstrument(inst);
        lastId = inst.id; added++;
      } catch (err) {
        console.warn('Import fehlgeschlagen:', f.name, err);
      }
    }
    if (lastId) this.selectInstrument(lastId);
    this.setStatus(added ? (added + ' Sample(s) importiert – jetzt in eine Arranger-Spur ziehen oder klicken.') : 'Import fehlgeschlagen.');
  }

  // ---------- Transport ----------
  bindTransport() {
    $('#btnPlay').addEventListener('click', () => this.togglePlay());
    $('#btnStop').addEventListener('click', () => this.stop());
    const bpm = $('#inpBpm'); bpm.value = this.song.bpm;
    bpm.addEventListener('input', () => { this.song.bpm = clamp(parseInt(bpm.value) || 138, 40, 300); });
    const rpb = $('#inpRpb'); rpb.value = this.song.rowsPerBeat;
    rpb.addEventListener('input', () => { this.song.rowsPerBeat = clamp(parseInt(rpb.value) || 4, 1, 8); this.tracker.render(); });
    const title = $('#songTitle'); title.value = this.song.title || '';
    title.addEventListener('input', () => { this.song.title = title.value; });
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
      if (confirm('Neues, leeres Projekt – aktuelle Arbeit verwerfen?')) {
        this.loadProject(emptyProject());
        this.setStatus('Neues leeres Projekt.');
      }
    });
    $('#btnSave').addEventListener('click', () => { saveProjectToFile(this.project); this.setStatus('Projekt gespeichert (.trance).'); });
    const fileOpen = $('#fileOpen');
    $('#btnOpen').addEventListener('click', () => this.showOpenMenu());
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

  // ---------- Öffnen-Menü (Datei laden oder Demo-Song) ----------
  showOpenMenu() {
    if (this._openMenu) { this.closeOpenMenu(); return; }
    const btn = $('#btnOpen');
    const r = btn.getBoundingClientRect();
    const menu = el('div', { class: 'open-menu', style: `left:${r.left}px;top:${r.bottom + 4}px` });
    menu.appendChild(el('button', { class: 'om-item', text: '📂 Datei laden…', onclick: () => { this.closeOpenMenu(); $('#fileOpen').click(); } }));
    menu.appendChild(el('div', { class: 'om-sep', text: 'Demo-Songs' }));
    for (const d of DEMO_LIST) {
      menu.appendChild(el('button', { class: 'om-item', text: d.label, onclick: () => { this.closeOpenMenu(); this.loadDemo(d.id); } }));
    }
    document.body.appendChild(menu);
    this._openMenu = menu;
    this._omClose = (ev) => { if (!menu.contains(ev.target) && ev.target !== btn) this.closeOpenMenu(); };
    setTimeout(() => document.addEventListener('pointerdown', this._omClose, true), 0);
  }

  closeOpenMenu() {
    if (this._openMenu) { this._openMenu.remove(); this._openMenu = null; }
    if (this._omClose) { document.removeEventListener('pointerdown', this._omClose, true); this._omClose = null; }
  }

  loadDemo(id) {
    this.setStatus('Lade Demo-Song…');
    try {
      const project = buildDemo(id);
      this.loadProject(project);
      this.viewMode = 'arranger';
      this.applyView();
      this.arranger.fit();
      this.setStatus('Demo geladen: ' + project.song.title + ' (' + project.song.arrangement.bars + ' Takte) — ganzer Song eingepasst');
    } catch (err) {
      this.setStatus('Demo fehlgeschlagen: ' + err.message);
    }
  }

  loadProject(project) {
    this.stop();
    this.project = project;
    this.currentPatternIndex = 0;
    this.seekBeat = 0;
    this.drumkitPads = null;
    this.mutedChannels = new Set();
    this.selectedInstrumentId = this.song.instruments[0]?.id || null;
    $('#inpBpm').value = this.song.bpm;
    $('#inpRpb').value = this.song.rowsPerBeat;
    const title = $('#songTitle'); if (title) title.value = this.song.title || '';
    this.seq.instNodes.forEach((n) => n.disconnect());
    this.seq.instNodes.clear();
    this.seq.ensureInstNodes();
    if (this.arranger) this.arranger.selectedId = null;
    this.renderAll();
    this.updateArrTime(0);
  }

  // ---------- Tabs ----------
  bindTabs() {
    $('#sideTabs').querySelectorAll('.tab').forEach((tab) => {
      tab.addEventListener('click', () => this.showTab(tab.dataset.tab));
    });
  }

  showTab(name) {
    $('#sideTabs').querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t.dataset.tab === name));
    document.querySelectorAll('.tabpanel').forEach((p) => p.classList.toggle('hidden', p.dataset.panel !== name));
    if (name === 'mixer') this.renderMixer();
    if (name === 'keyboard' && this.keyboard) this.keyboard.render();
    if (name === 'drumkit' && this.drumkit) this.drumkit.render();
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
    this.applyView();
    this.setStatus(view === 'arranger' ? 'Arranger-Ansicht (Music-Maker-Stil).' : 'Tracker-Ansicht.');
  }

  applyView() {
    const view = this.viewMode;
    $('#viewSwitch').querySelectorAll('button').forEach((b) => b.classList.toggle('active', b.dataset.view === view));
    $('#trackerView').classList.toggle('hidden', view !== 'tracker');
    $('#arrangerView').classList.toggle('hidden', view !== 'arranger');
    $('#patternControls').classList.toggle('hidden', view !== 'tracker');
    $('#arrangerControls').classList.toggle('hidden', view !== 'arranger');
    if (view === 'arranger') { this.arranger.render(); this.updateArrTime(this.seekBeat); $('#arranger').focus(); }
    else { this.tracker.render(); $('#tracker').focus(); }
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
    c.appendChild(el('button', { class: 'pc-btn', text: '＋ Melodie', title: 'Melodie-Block anlegen und im Piano-Roll öffnen',
      onclick: () => this.arranger.addMelodyClip() }));
    c.appendChild(el('button', { class: 'pc-btn', text: '🔍−', title: 'Rauszoomen', onclick: () => this.arranger.zoomBy(0.6) }));
    c.appendChild(el('button', { class: 'pc-btn', text: '🔍+', title: 'Reinzoomen', onclick: () => this.arranger.zoomBy(1.6) }));
    c.appendChild(el('button', { class: 'pc-btn', text: 'Fit', title: 'Ganzen Song einpassen', onclick: () => this.arranger.fit() }));
    c.appendChild(el('button', { class: 'pc-btn', text: 'Leeren', title: 'Alle Blöcke entfernen',
      onclick: () => { if (confirm('Arranger leeren?')) { arr.clips = []; this.arranger.render(); } } }));
  }

  openPianoRoll(clip) { this.pianoRoll.open(clip); }

  // Playhead/Startposition setzen (Klick aufs Lineal)
  seekTo(beat) {
    const end = Math.max(arrangementEndBeats(this.song.arrangement), BEATS_PER_BAR);
    this.seekBeat = clamp(beat, 0, end);
    this.arranger.setPlayhead(this.seekBeat);
    this.updateArrTime(this.seekBeat);
    if (this.seq.playing && this.viewMode === 'arranger') {
      this.seq.stop();
      this.seq.play('arranger', false).then(() => $('#btnPlay').classList.add('active'));
    }
  }

  fmtTime(sec) {
    sec = Math.max(0, sec);
    const m = Math.floor(sec / 60);
    const s = Math.round(sec % 60);
    return m + ':' + String(s).padStart(2, '0');
  }

  updateArrTime(beat) {
    const bpm = this.song.bpm || 138;
    const total = Math.max(arrangementEndBeats(this.song.arrangement), BEATS_PER_BAR);
    const el2 = $('#timeDisplay');
    if (el2) el2.textContent = this.fmtTime((beat || 0) * 60 / bpm) + ' / ' + this.fmtTime(total * 60 / bpm);
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
    const kbsel = $('#kbInstSelect');
    if (kbsel && inst && inst.type !== 'drum') kbsel.value = inst.id;
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
    const cats = [];
    const byCat = new Map();
    this.song.instruments.forEach((inst, i) => {
      const c = inst.category || 'Sonstige';
      if (!byCat.has(c)) { byCat.set(c, []); cats.push(c); }
      byCat.get(c).push({ inst, i });
    });
    for (const c of cats) {
      list.appendChild(el('li', { class: 'inst-cat', text: c }));
      for (const { inst, i } of byCat.get(c)) list.appendChild(this._instItem(inst, i));
    }
    const sel = this.selectedInstrument;
    $('#activeInstName').textContent = sel ? sel.name : '—';
  }

  _instItem(inst, i) {
    const nameEl = el('span', { class: 'inst-name', text: inst.name, title: inst.name });
    return el('li', {
      class: 'inst-item' + (inst.id === this.selectedInstrumentId ? ' active' : ''),
      draggable: 'true',
      title: 'In eine Arranger-Spur ziehen, um einen Block anzulegen',
      ondragstart: (e) => {
        e.dataTransfer.setData('application/x-trance-inst', inst.id);
        e.dataTransfer.setData('text/plain', inst.name);
        e.dataTransfer.effectAllowed = 'copy';
        this.selectInstrument(inst.id);
      },
      onclick: () => { this.selectInstrument(inst.id); this.seq.preview(inst, 60, 0.5); }
    }, [
      el('span', { class: 'inst-num', text: String(i + 1).padStart(2, '0') }),
      el('span', { class: 'inst-swatch', style: `background:${colorForIndex(i)}` }),
      nameEl,
      el('span', { class: 'inst-kind', text: inst.type }),
      el('button', { title: 'Umbenennen', text: '🏷', onclick: (e) => { e.stopPropagation(); this.renameInstrument(inst); } }),
      el('button', { title: 'Bearbeiten', text: '✎', onclick: (e) => { e.stopPropagation(); this.editInstrument(inst); } }),
      el('button', { title: 'Duplizieren', text: '⧉', onclick: (e) => { e.stopPropagation(); this.duplicateInstrument(inst.id); } }),
      el('button', { title: 'Löschen', text: '🗑', onclick: (e) => { e.stopPropagation(); if (confirm('Instrument „' + inst.name + '" löschen?')) this.removeInstrument(inst.id); } })
    ]);
  }

  renameInstrument(inst) {
    const name = prompt('Neuer Name:', inst.name);
    if (name) { inst.name = name; this.renderInstrumentList(); this.renderMixer(); }
  }

  duplicateInstrument(id) {
    const inst = this.getInstrument(id);
    if (!inst) return;
    const copy = cloneInstrument(inst);
    const idx = this.song.instruments.findIndex((i) => i.id === id);
    this.song.instruments.splice(idx + 1, 0, copy);
    this.seq.ensureInstNodes();
    this.selectInstrument(copy.id);
    this.renderMixer();
    this.setStatus('Kopie „' + copy.name + '" angelegt – jetzt bearbeitbar.');
  }

  editInstrument(inst) {
    this.selectInstrument(inst.id);
    this.showTab('samplemaker');
    this.sampleMaker.editInstrument(inst);
  }

  addPresetInstrument(preset) {
    const inst = createInstrument(preset);
    this.addInstrument(inst);
    this.selectInstrument(inst.id);
    this.seq.preview(inst, 60, 0.5);
    this.setStatus('„' + inst.name + '" hinzugefügt.');
  }

  /** Note von Klaviatur/Drum-Pad: im Tracker am Cursor schreiben, sonst nur vorhören. */
  playNote(midi) {
    if (this.viewMode === 'tracker') {
      this.tracker.placeNote(midi);
    } else {
      const inst = this.selectedInstrument;
      if (inst) this.seq.preview(inst, midi, 0.5);
    }
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
