# Wayfinder Map: CrateMate Sample Curation & Kit Generator

## Destination

A high-performance, browser-native sample curation web application built with Lit and TypeScript that indexes local drum & sample libraries via File System Access API, extracts acoustic and harmonic profiles, classifies samples into practical kit roles, and generates cohesive 4-to-8 pad kits with harmonic matching, pad locking, and instant auditioning.

## Notes

- **Domain**: Audio engineering, music production, sample management, DSP (digital signal processing), web audio synthesis.
- **Tech Stack**: Lit 3.x, TypeScript, Vite, Web Audio API, IndexedDB (`idb-keyval`), File System Access API.
- **Standing Preferences**:
  - Zero heavy third-party audio dependencies (pure Web Audio API + lightweight DSP algorithms for autocorrelation pitch and FFT tri-band energy).
  - Memory-safe: extract metadata and downsampled waveform envelope, immediately garbage collect raw PCM buffers.
  - High-end dark theme UI tailored for music producers (Ableton / MPC / Teenage Engineering aesthetic).

## Decisions so far

- [01 - Folder Source Discovery & IndexedDB Handle Persistence](issues/01-folder-source-and-persistence.md) — Persist `FileSystemDirectoryHandle` in IndexedDB, prompt to re-link on return visits, and skip already-indexed samples.
- [02 - Audio Decoding Pipeline & Memory Management](issues/02-audio-decoding-concurrency.md) — Throttle `AudioContext.decodeAudioData` concurrency to 2, extract acoustic features, and immediately release raw PCM buffers.
- [03 - Acoustic Feature Extraction (Sharpness, Energy Balance, Pitch)](issues/03-acoustic-feature-extractor.md) — Calculate attack rise-time, crest factor, tri-band energy (<250Hz, 250-4000Hz, >4000Hz), YIN pitch/key detection, and 64-point waveform bins.
- [04 - Automatic Sample Role Categorization Engine](issues/04-role-classification-engine.md) — Hybrid rules combining drum/instrument filename regex cues with acoustic spectral/transient metrics into 5 roles.
- [05 - Smart Harmonic Kit Generator & Slot Balancing](issues/05-harmonic-kit-generator.md) — Balanced 4/6/8 pad layouts with Camelot Wheel harmonic key compatibility, pad locking, and factory demo fallbacks.
- [06 - Pad Grid View, Auditioning & Visual Readouts](issues/06-pad-audition-interface.md) — Lit `<sample-pad>` and `<pad-grid>` components with low-latency Web Audio playback, animated waveforms, and hotkeys (`1`–`8` / `QWERTY`).
- [07 - Sample Path Copy & Kit Export Pipeline](issues/07-sample-export-actions.md) — Host OS prefix for clipboard path copies and `showDirectoryPicker` batch kit export.

## Not yet specified

- **WASM Acceleration**: If pure JS autocorrelation / FFT becomes a bottleneck for libraries with 50,000+ samples, investigate WebAssembly or Web Workers with `AudioWorklet` or SharedArrayBuffer.
- **MIDI Controller Support**: Web MIDI API mapping for physical pad controllers (Akai MPK / Novation Launchpad).
- **Direct Drag-and-Drop into DAWs**: Browser limitations on native OS file dragging (`DownloadURL` vs synthetic file drags into desktop DAWs like Ableton Live / FL Studio).

## Out of scope

- Full digital audio workstation (DAW) sequencer or pattern arranger.
- Destructive sample editing (trim, pitch-shift processing written back to original files on disk).
- Cloud sync / remote file uploads (app is 100% local and privacy-first).
