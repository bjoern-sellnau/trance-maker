// WAV-Kodierung/Dekodierung und Base64-Helfer.
// encodeWAV akzeptiert AudioBuffer ODER ein einfaches Objekt
// { sampleRate, numberOfChannels, length, getChannelData(ch) -> Float32Array }
// damit es ohne Web Audio (z.B. in Node-Tests) nutzbar bleibt.

/** Erzeugt einen 16-Bit-PCM-WAV-ArrayBuffer aus einem AudioBuffer-ähnlichen Objekt. */
export function encodeWAV(buffer) {
  const numCh = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const len = buffer.length;
  const bytesPerSample = 2;
  const blockAlign = numCh * bytesPerSample;
  const dataSize = len * blockAlign;
  const ab = new ArrayBuffer(44 + dataSize);
  const view = new DataView(ab);

  const writeStr = (off, str) => { for (let i = 0; i < str.length; i++) view.setUint8(off + i, str.charCodeAt(i)); };

  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);          // fmt-Chunk-Größe
  view.setUint16(20, 1, true);           // PCM
  view.setUint16(22, numCh, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);          // Bits pro Sample
  writeStr(36, 'data');
  view.setUint32(40, dataSize, true);

  // Kanäle interleaven und in Int16 wandeln
  const channels = [];
  for (let c = 0; c < numCh; c++) channels.push(buffer.getChannelData(c));

  let offset = 44;
  for (let i = 0; i < len; i++) {
    for (let c = 0; c < numCh; c++) {
      let s = Math.max(-1, Math.min(1, channels[c][i]));
      s = s < 0 ? s * 0x8000 : s * 0x7fff;
      view.setInt16(offset, s | 0, true);
      offset += 2;
    }
  }
  return ab;
}

export function wavBlob(buffer) {
  return new Blob([encodeWAV(buffer)], { type: 'audio/wav' });
}

/** ArrayBuffer -> Base64 (in Stücken, um Stack-Limits zu vermeiden). */
export function arrayBufferToBase64(ab) {
  const bytes = new Uint8Array(ab);
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return btoaSafe(binary);
}

/** Base64 -> ArrayBuffer. */
export function base64ToArrayBuffer(b64) {
  const binary = atobSafe(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

// btoa/atob existieren im Browser; in Node gibt es Buffer.
function btoaSafe(bin) {
  if (typeof btoa === 'function') return btoa(bin);
  return Buffer.from(bin, 'binary').toString('base64');
}
function atobSafe(b64) {
  if (typeof atob === 'function') return atob(b64);
  return Buffer.from(b64, 'base64').toString('binary');
}

/** AudioBuffer -> Base64-WAV-String (zum Speichern im Projekt). */
export function audioBufferToBase64Wav(buffer) {
  return arrayBufferToBase64(encodeWAV(buffer));
}
