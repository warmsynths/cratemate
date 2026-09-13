# 05 - Hardware Export Modal & Target Preference Persistence

Type: prototype
Status: resolved
Blocked by: 02, 04

## Question

How should the UI export flow be presented in Lit (`<hardware-export-modal>`), allowing the user to select their Hardware Target (Dirtywave M8, Roland SP-404MKII, or Dual Package), toggle sample chain and audio conversion options, choose between "Save to SD Card" and "Download .ZIP", and persist their hardware preferences in IndexedDB?

## Answer

Implemented via `<hardware-export-modal>` component (`src/components/hardware-export-modal.ts`):

1. **Hardware Selection & Visual Feedback**:
   - Hardware target selector segmented cards:
     - **Dirtywave M8**: Native 44.1 kHz, `/Samples/CrateMate/`, 8-track convention.
     - **Roland SP-404MKII**: Native 48.0 kHz, `/ROLAND/IMPORT/CrateMate/`, Bank A `A01`–`A08`.
     - **Dual / Universal**: Structured `/m8/` and `/sp404mk2/` root folders for drag-and-drop to either SD card.
   - Live file structure preview showing exactly what will be written to the card or zip.

2. **Feature & Format Options**:
   - Toggle: `Include Sliced Sample Chain` (`[KitName]_Chain.wav`).
   - Toggle: `Convert to Target Hardware Spec` (Resample to 44.1k / 48k & 16-bit PCM).
   - Toggle: `True-Peak Normalization (-0.5 dBFS)`.
   - Toggle: `Include KIT_INFO.txt Companion`.

3. **Dual Delivery Action Buttons**:
   - **"Save to SD Card / Folder"**: Invokes `showDirectoryPicker()` to write directly to a connected SD card.
   - **"Download .ZIP"**: Uses client-side `ZipBuilder` to trigger instant browser `.zip` download.

4. **Preference Persistence**:
   - Stores user preferences (`hardwareTarget`, `includeSampleChain`, `convertToSpec`, `normalizeAudio`) in `localStorage` / IndexedDB so subsequent kit exports require only a single click.

