# 04 - Hardware Profile Formatting & Kit Companion Generation

Type: task
Status: resolved
Blocked by: 01, 03

## Question

How should the export packaging service organize directories, file names, and companion metadata for Dirtywave M8 (`/Samples/CrateMate/<KitName>/01_...wav`, `..._Chain.wav`), Roland SP-404MKII (`/ROLAND/IMPORT/CrateMate/<KitName>/A01_...wav`), Dual Package (`/m8/` and `/sp404mk2/`), and generate `KIT_INFO.txt` with Camelot key, root note, suggested BPM, and pad mapping?

## Answer

Implemented via `HardwareProfileService` in `src/services/hardware-packager.ts`:

1. **Hardware Profile Directory & Naming Contracts**:
   - **Dirtywave M8 (`m8`)**:
     - Target Rate: 44,100 Hz, 16-bit linear PCM WAV.
     - Folder path: `Samples/CrateMate/[KitName]/`
     - Discrete filenames: `${index2}_${safeRole}_${safeSampleName}.wav` (e.g. `01_Kick_Low_Punchy808.wav`, `05_Tonal_Melodic_8A_Am_Rhodes.wav` with detected Camelot/key appended for tonal samples).
     - Slice chain: `${KitName}_Chain_08Slice_44k.wav`.
   - **Roland SP-404MKII (`sp404mk2`)**:
     - Target Rate: 48,000 Hz, 16-bit linear PCM WAV.
     - Folder path: `ROLAND/IMPORT/CrateMate/[KitName]/`
     - Discrete filenames: `A${index2}_${safeRole}_${safeSampleName}.wav` (e.g. `A01_Kick_Low_...wav` mapping to Bank A Pads 1–8).
     - Slice chain: `${KitName}_Chain_16Pad_48k.wav`.
   - **Dual / Universal Package (`dual`)**:
     - Outputs both parallel root trees (`m8/Samples/...` and `sp404mk2/ROLAND/IMPORT/...`), enabling 1-click drag directly to SD card roots.

2. **Kit Companion Guide (`KIT_INFO.txt`)**:
   - Packaged at the root of the kit directory.
   - Summarizes: Kit Name, Timestamp, Hardware Target, Pad Count, Dominant Camelot Key & Root Note, Suggested BPM range based on acoustic profile duration/genre, and detailed per-pad role/sample/key listings.
   - Includes quick-start instructions for M8 (`SLICED` mode, 08 slices) and SP-404MKII (`AUTO CHOP` -> `TIME DIV` -> Pad 1).

