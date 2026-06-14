// Mikrofon-Aufnahme via getUserMedia + MediaRecorder, Ergebnis als AudioBuffer.

import { getCtx } from './context.js';

export class MicRecorder {
  constructor() {
    this.stream = null;
    this.recorder = null;
    this.chunks = [];
    this.recording = false;
    this.onLevel = null;       // callback(level 0..1) während der Aufnahme
    this._analyser = null;
    this._raf = null;
  }

  async start() {
    if (this.recording) return;
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error('Mikrofon-Zugriff wird von diesem Browser/Kontext nicht unterstützt.');
    }
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false }
    });
    this.chunks = [];
    this.recorder = new MediaRecorder(this.stream);
    this.recorder.ondataavailable = (e) => { if (e.data.size > 0) this.chunks.push(e.data); };
    this.recorder.start();
    this.recording = true;
    this._startMeter();
  }

  _startMeter() {
    const ctx = getCtx();
    const src = ctx.createMediaStreamSource(this.stream);
    this._analyser = ctx.createAnalyser();
    this._analyser.fftSize = 512;
    src.connect(this._analyser);
    const data = new Uint8Array(this._analyser.fftSize);
    const tick = () => {
      if (!this.recording) return;
      this._analyser.getByteTimeDomainData(data);
      let peak = 0;
      for (let i = 0; i < data.length; i++) peak = Math.max(peak, Math.abs(data[i] - 128) / 128);
      if (this.onLevel) this.onLevel(peak);
      this._raf = requestAnimationFrame(tick);
    };
    tick();
  }

  /** Stoppt die Aufnahme und liefert den dekodierten AudioBuffer. */
  async stop() {
    if (!this.recording) return null;
    const blob = await new Promise((resolve) => {
      this.recorder.onstop = () => resolve(new Blob(this.chunks, { type: this.recorder.mimeType || 'audio/webm' }));
      this.recorder.stop();
    });
    this.recording = false;
    if (this._raf) cancelAnimationFrame(this._raf);
    this.stream.getTracks().forEach((t) => t.stop());
    this.stream = null;

    const arrayBuf = await blob.arrayBuffer();
    const ctx = getCtx();
    return await ctx.decodeAudioData(arrayBuf);
  }

  cancel() {
    if (this.recorder && this.recording) {
      try { this.recorder.stop(); } catch (_) {}
    }
    this.recording = false;
    if (this._raf) cancelAnimationFrame(this._raf);
    if (this.stream) this.stream.getTracks().forEach((t) => t.stop());
    this.stream = null;
  }
}
