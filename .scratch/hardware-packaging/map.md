# Wayfinder Map: Hardware Sample Packaging & Export Engine

## Destination

An automated Hardware Packaging & Export engine in CrateMate that packages selected kits into target-optimized formats for the Dirtywave M8 Tracker (44.1kHz 16-bit, `/Samples/` hierarchy, track 01–08 naming, unified sliced sample chain) and Roland SP-404MKII (48kHz 16-bit, `/ROLAND/IMPORT/` hierarchy, bank pad A01–A08 naming, auto-chop sample chain), delivering both discrete resampled WAVs and sliced sample chains with a musical companion guide (`KIT_INFO.txt`) via direct SD-card folder export or instant ZIP archive download.

## Notes

- **Domain**: Audio engineering, hardware grooveboxes & trackers, DSP resampling, sample chain concatenation, RIFF WAV encoding, browser file access.
- **Skills**: `domain-modeling`, `grilling`, `prototype`, `research`.
- **Standing Preferences**:
  - Zero heavy external binary dependencies: pure Web Audio API (`OfflineAudioContext` for resampling) + lightweight typed array WAV encoder.
  - Hardware accuracy: strictly match native rates (44.1kHz for M8, 48kHz for SP-404MKII) and 16-bit linear PCM with subtle peak normalization (-0.5 dBFS), with an option to export raw original files.
  - Dual delivery: File System Access API for direct SD card drive writes, combined with client-side ZIP bundling for instant cross-platform download.

## Decisions so far

<!-- the index — one line per closed ticket: enough to judge relevance, then zoom the link for the detail the ticket holds -->

- [01 - Hardware Audio Resampling & 16-Bit WAV Encoder Pipeline](issues/01-audio-resampling-and-wav-encoding.md) — Resample audio to 44.1kHz / 48kHz via `OfflineAudioContext`, normalize peaks to -0.5 dBFS, and encode to 16-bit linear PCM WAV with pure TypeScript typed arrays.
- [02 - Client-Side In-Memory ZIP Archive Bundler](issues/02-client-side-zip-packaging.md) — Zero-dependency client-side `ZipBuilder` using PKWARE Store method 0 for instant, uncompressed browser downloads.
- [03 - Uniform Sliced Sample Chain Assembly](issues/03-uniform-sliced-sample-chain-assembly.md) — Concatenate kit pads into uniform equal-division slice chains with decay padding for M8 `SLICED` mode and SP-404MKII auto-chop.
- [04 - Hardware Profile Formatting & Kit Companion Generation](issues/04-hardware-profile-and-directory-structure.md) — Exact directory hierarchies, pad/track naming conventions, and instant songwriting `KIT_INFO.txt` companion cheat-sheet.
- [05 - Hardware Export Modal & Target Preference Persistence](issues/05-hardware-export-modal-and-preferences.md) — Lit `<hardware-export-modal>` with M8, SP-404MKII, and Dual package targets, format toggles, SD card / ZIP actions, and preference persistence.






## Not yet specified

- **SP-404MKII 16-Pad Dual-Kit Expansion**: Generating or expanding 8-pad kits to fill all 16 pads across Bank A (Pads A01–A16) with drums on lower 8 and melodic/textures on upper 8.
- **Embedded WAV Cue/Slice Chunks**: Writing RIFF `cue ` and `smpl` chunk markers into sample chains for samplers that support slice-point detection instead of equal-division time slicing.
- **Dirtywave M8 Instrument Preset Generation (`.m8i`)**: Reverse-engineering binary M8 instrument files to bundle custom synth/sampler parameters alongside WAVs.
- **Web MIDI Direct Dump**: Triggering SysEx or MIDI Sample Dump Standard (SDS) directly into hardware over Web MIDI.

## Out of scope

- Roland SP-404MKII proprietary project binary (`PROJECT01.BIN`) generation.
- Real-time hardware MIDI synchronization during kit playback.
- Destructive editing or writing back changes to the user's original sample library.
- Cloud syncing or hosting export packages remotely.
