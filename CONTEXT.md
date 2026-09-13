# CrateMate Domain Model

## Core Entities

### Folder Source
A local directory registered by the user via the browser's File System Access API (`showDirectoryPicker`). 
- **Handle**: Stored `FileSystemDirectoryHandle` in IndexedDB (`idb-keyval` or custom store).
- **Status**: `connected`, `permission-required`, `scanning`, or `error`.
- **Metrics**: Total discovered audio files, analyzed files, and skipped (already cached) files.

### Sample
An audio file residing within a Folder Source (supported extensions: `.wav`, `.mp3`, `.aiff`, `.flac`, `.ogg`).
- **File Metadata**: File name, relative path within the source folder, file size, last modified timestamp.
- **Acoustic Profile**: Extracted audio features used for categorization and visual rendering.
- **Role**: Functional kit category assigned by the classification engine.

### Acoustic Profile
Quantitative metrics extracted by decoding the sample:
- **Duration**: Total time in seconds.
- **Transient Sharpness**: Measure of attack suddenness calculated via attack rise-time (ms to reach 90% peak) and crest factor ($20 \log_{10}(\text{Peak} / \text{RMS})$).
- **Frequency Energy Balance**: Tri-band energy distribution normalized to $[0, 1]$:
  - Low band: $< 250\text{ Hz}$
  - Mid band: $250\text{ Hz} - 4000\text{ Hz}$
  - High band: $> 4000\text{ Hz}$
- **Pitch & Root Key**: Melodic pitch detection via autocorrelation / YIN algorithm, yielding:
  - `f0`: Fundamental frequency in Hz.
  - `note`: Musical note name and octave (e.g., `C3`, `F#2`).
  - `pitchConfidence`: Strength of harmonic periodicity ($[0, 1]$).
  - `isMelodic`: Boolean thresholded by confidence ($> 0.65$) and sustained duration.
- **Waveform Bins**: Lightweight downsampled peak envelope array (64 to 128 points) for instant UI rendering without retaining raw PCM data in memory.

### Sample Role
The operational drum/beat kit category assigned to a sample:
- `Kick/Low`: Low-frequency dominant ($> 45\%$ low energy), punchy or sub-heavy attack.
- `Snare/Snap`: Mid-frequency burst ($250\text{ Hz} - 4000\text{ Hz}$), sharp transient, short-to-medium decay.
- `Hat/Air`: High-frequency dominant ($> 45\%$ high energy), crisp attack or sizzle.
- `Tonal/Melodic`: Periodic pitch detected with high confidence (basslines, leads, chords, melodic vocal chops).
- `Texture/Wildcard`: Atmos, vinyl noise, Foley, experimental hits, long soundscapes.

### Kit
A curated collection of 4, 6, or 8 complementary Pad Slots structured to create an immediately playable beat palette.
- **Pad Count**: 4, 6, or 8 pads.
- **Cohesion Constraint**: Avoids redundant roles (e.g. max 1 Kick, max 1 Snare in small kits; balanced distribution across roles).
- **Harmonic Compatibility**: If one or more melodic samples are selected with detected musical keys, other melodic selections are harmonically biased using the Circle of Fifths / Camelot Wheel (same key, adjacent keys $\pm 1$, or relative major/minor).

### Pad Slot
An audition and performance cell within a Kit:
- **Index**: 0 to $N-1$ (displayed as Pad 1 to Pad $N$).
- **Hotkey**: Mapped to numeric keys (`1`–`8`) and QWERTY performance rows (`Q W E R` / `A S D F`).
- **Locked State**: When locked, generating or rerolling a kit preserves this sample while rerolling all unlocked pads.
- **Audition State**: Triggering triggers low-latency Web Audio playback with active trigger animation.
- **Export Action**: Quick copy of sample path or direct file download / folder export.

### Hardware Target
A physical groovebox, tracker, or hardware sampler device receiving exported kits.
- **Dirtywave M8**: 8-track portable tracker operating natively at 44.1 kHz 16/24-bit with `/Samples/` SD card file organization and `SLICED` sample chain playback.
- **Roland SP-404MKII**: 16-pad linear sampler operating natively at 48 kHz 16-bit with `/ROLAND/IMPORT/` SD card file organization and 16-pad bank mapping (`A01`–`A16`).
- **Universal**: Standardized sequential kit format (`01_`–`08_`) compatible with general DAWs, MPCs, and hardware samplers.

### Hardware Profile
The technical and structural formatting specification tailored to a specific Hardware Target:
- **Target Sample Rate & Bit Depth**: 44.1 kHz 16-bit PCM (M8) or 48 kHz 16-bit PCM (SP-404MKII).
- **Directory Hierarchy**: SD card destination path conventions (e.g. `/Samples/CrateMate/<KitName>` vs `/ROLAND/IMPORT/CrateMate/<KitName>`).
- **File Naming Schema**: Track/pad index and role prefixing (e.g. `01_Kick_...` for M8, `A01_Kick_...` for SP-404MKII).

### Sample Chain
A single contiguous linear PCM WAV file containing all samples of a Kit concatenated at uniform time slice intervals.
- **Equal-Division Slices**: Uniform slice length (longest sample rounded up to power-of-two or beat interval) allowing hardware slice engines to access all kit sounds via slice indices without requiring separate tracks or instrument slots.
- **Slice Count**: Matches kit pad count (e.g. 4, 6, or 8 slices).

### Kit Companion
A plain-text quick-reference file (`KIT_INFO.txt`) packaged alongside samples containing musical and operational kit metadata:
- **Musical Profile**: Kit name, dominant Camelot key, musical root key, and suggested playback BPM.
- **Role Map**: Listing of track/pad index to role and sample source.

### Export Package
The complete, structured output of an exported Kit ready for hardware ingestion:
- **Discrete WAVs**: Normalized, resampled individual sample files.
- **Sample Chain**: Single concatenated slice file (`[KitName]_Chain.wav`).
- **Kit Companion**: Reference cheat-sheet (`KIT_INFO.txt`).
- **Delivery Modes**: Direct SD Card / local folder creation via File System Access API or zero-dependency `.zip` file download.

