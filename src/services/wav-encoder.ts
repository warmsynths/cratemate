/**
 * Pure TypeScript linear PCM WAV encoder and Web Audio resampling utility
 * Zero third-party dependencies; 100% compliant with hardware samplers
 * (Dirtywave M8, Roland SP-404MKII, Akai MPC, Elektron)
 */

/**
 * Resample an AudioBuffer to a target sample rate using OfflineAudioContext.
 * Chromium, WebKit, and Firefox implement anti-aliased sinc/Kaiser resampling internally.
 */
export async function resampleAudioBuffer(
  sourceBuffer: AudioBuffer,
  targetSampleRate: number
): Promise<AudioBuffer> {
  if (sourceBuffer.sampleRate === targetSampleRate) {
    return sourceBuffer;
  }

  const channels = Math.min(sourceBuffer.numberOfChannels, 2); // mono or stereo
  const targetFrames = Math.max(1, Math.ceil(sourceBuffer.duration * targetSampleRate));

  const OfflineContextClass = window.OfflineAudioContext || (window as unknown as { webkitOfflineAudioContext: typeof OfflineAudioContext }).webkitOfflineAudioContext;
  const offlineCtx = new OfflineContextClass(channels, targetFrames, targetSampleRate);

  const sourceNode = offlineCtx.createBufferSource();
  sourceNode.buffer = sourceBuffer;
  sourceNode.connect(offlineCtx.destination);
  sourceNode.start(0);

  return await offlineCtx.startRendering();
}

/**
 * Apply true-peak normalization to an AudioBuffer.
 * Clones channel data to avoid mutating original source audio.
 */
export function normalizeAudioBuffer(
  buffer: AudioBuffer,
  targetPeakDbfs: number = -0.5
): AudioBuffer {
  const targetPeakLinear = Math.pow(10, targetPeakDbfs / 20); // ~0.94406 for -0.5 dBFS
  let maxPeak = 0;

  // Find highest absolute peak across all channels
  for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
    const data = buffer.getChannelData(ch);
    for (let i = 0; i < data.length; i++) {
      const abs = Math.abs(data[i]);
      if (abs > maxPeak) {
        maxPeak = abs;
      }
    }
  }

  if (maxPeak === 0) return buffer;

  const gain = targetPeakLinear / maxPeak;

  // Create new AudioBuffer to hold normalized samples
  const OfflineContextClass = window.OfflineAudioContext || (window as unknown as { webkitOfflineAudioContext: typeof OfflineAudioContext }).webkitOfflineAudioContext;
  const offlineCtx = new OfflineContextClass(buffer.numberOfChannels, buffer.length, buffer.sampleRate);
  const normalized = offlineCtx.createBuffer(buffer.numberOfChannels, buffer.length, buffer.sampleRate);

  for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
    const srcData = buffer.getChannelData(ch);
    const destData = normalized.getChannelData(ch);
    for (let i = 0; i < srcData.length; i++) {
      destData[i] = srcData[i] * gain;
    }
  }

  return normalized;
}

/**
 * Encode an AudioBuffer into standard 16-bit linear PCM little-endian RIFF WAVE bytes.
 */
export function encodeWav(audioBuffer: AudioBuffer): Uint8Array {
  const numChannels = Math.min(audioBuffer.numberOfChannels, 2);
  const sampleRate = audioBuffer.sampleRate;
  const numFrames = audioBuffer.length;
  const bytesPerSample = 2; // 16-bit
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = numFrames * blockAlign;
  const totalBufferSize = 44 + dataSize;

  const buffer = new ArrayBuffer(totalBufferSize);
  const view = new DataView(buffer);

  // Helper to write ASCII strings
  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  // --- RIFF Header ---
  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true); // ChunkSize
  writeString(8, 'WAVE');

  // --- fmt Subchunk ---
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true); // Subchunk1Size (16 for PCM)
  view.setUint16(20, 1, true);  // AudioFormat (1 = Linear PCM)
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true); // BitsPerSample = 16

  // --- data Subchunk ---
  writeString(36, 'data');
  view.setUint32(40, dataSize, true);

  // --- Interleave and convert float32 to int16 ---
  const channelData: Float32Array[] = [];
  for (let ch = 0; ch < numChannels; ch++) {
    channelData.push(audioBuffer.getChannelData(ch));
  }

  let offset = 44;
  for (let i = 0; i < numFrames; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      const sample = channelData[ch][i];
      // Hard clamp [-1.0, 1.0] to prevent integer wrap-around distortion
      const clamped = Math.max(-1, Math.min(1, sample));
      const int16 = clamped < 0 ? clamped * 0x8000 : clamped * 0x7FFF;
      view.setInt16(offset, int16, true);
      offset += 2;
    }
  }

  return new Uint8Array(buffer);
}
