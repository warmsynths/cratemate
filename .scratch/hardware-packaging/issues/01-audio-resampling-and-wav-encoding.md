# 01 - Hardware Audio Resampling & 16-Bit WAV Encoder Pipeline

Type: research
Status: resolved
Blocked by:

## Question

How should CrateMate resample decoded AudioBuffers to target hardware sample rates (44.1 kHz for Dirtywave M8, 48 kHz for Roland SP-404MKII) using `OfflineAudioContext`, apply peak normalization (-0.5 dBFS), and encode the resulting PCM float data into standard 16-bit linear PCM WAV blobs in browser TypeScript without external binary dependencies?

## Answer

Implemented via browser-native Web Audio API (`OfflineAudioContext`) and a typed-array linear PCM WAV encoder:

1. **Hardware Rate Resampling (`OfflineAudioContext`)**:
   - Web Audio's `OfflineAudioContext` provides browser-optimized, anti-aliased sinc/Kaiser resampling.
   - Target frame count is calculated: `Math.ceil(sourceBuffer.duration * targetSampleRate)`.
   - An `OfflineAudioContext(sourceBuffer.numberOfChannels, targetFrames, targetSampleRate)` renders the source buffer into the target sample rate (e.g. 44,100 Hz for M8, 48,000 Hz for SP-404MKII).

2. **True Peak Normalization (-0.5 dBFS)**:
   - Compute maximum absolute sample value $M = \max_{c, i} |x_{c}[i]|$ across all channels.
   - Target ceiling is $-0.5\text{ dBFS} = 10^{-0.5 / 20} \approx 0.94406$.
   - If $M > 0$, multiply all samples by $\text{gain} = 0.94406 / M$. If $M \ge 1.0$ (clipping), it is reduced; if below, it is normalized to standard audition level.

3. **Pure TypeScript 16-Bit Linear PCM WAV Encoder**:
   - Construct a standard 44-byte canonical RIFF/WAVE header in an `ArrayBuffer` (`DataView`):
     - `RIFF` chunk identifier, total file size minus 8 bytes.
     - `WAVE` format with `fmt ` subchunk: PCM format tag `1`, channels (1 or 2), sample rate (44100 or 48000), byte rate (`sampleRate * channels * 2`), block align (`channels * 2`), and bits per sample (`16`).
     - `data` subchunk with byte length `totalSamples * channels * 2`.
   - Interleave channels and convert 32-bit floats $[-1.0, 1.0]$ into clamped 16-bit signed integers $[-32768, 32767]$:
     ```ts
     const s = Math.max(-1, Math.min(1, floatSample));
     view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
     ```
   - Zero external libraries required; 100% compatible with hardware samplers (Dirtywave M8, Roland SP-404MKII, MPCs, Elektron).

