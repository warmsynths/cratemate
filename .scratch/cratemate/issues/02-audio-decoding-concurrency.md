# 02 - Audio Decoding Pipeline & Memory Management

Type: research
Status: resolved
Blocked by: 01

## Question

How can background audio decoding (`AudioContext.decodeAudioData` or `OfflineAudioContext`) process large directories of WAV/MP3/AIFF/FLAC/OGG files with throttled concurrency (2–4 concurrent decodes), prevent main-thread jank, avoid out-of-memory crashes by immediately discarding uncompressed raw PCM buffers after feature extraction, and report real-time progress (found, analyzed, skipped)?

## Answer

Implemented via `AudioEngine` (`src/services/audio-engine.ts`):
1. A throttled queue (`decodeQueue`) limits active calls to `AudioContext.decodeAudioData` to a maximum concurrency of 2.
2. After `decodeAudioData` completes, the `AudioBuffer` is passed to `computeAcousticProfile()` to extract quantitative metrics (duration, attack time, crest factor, tri-band energy, fundamental pitch, 64-bin waveform overview).
3. The raw PCM `AudioBuffer` is not retained in memory for background indexing — only the compact JSON `AcousticProfile` is saved to IndexedDB, allowing garbage collection to immediately free the megabytes of raw uncompressed audio data.
4. A 10ms tick delay between queue items ensures the browser UI thread can render smooth progress animations.
