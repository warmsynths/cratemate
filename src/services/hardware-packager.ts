import type { Kit, SampleRecord, HardwareTarget, HardwareExportOptions, HardwareFileEntry } from '../types/index.ts';
import { encodeWav, resampleAudioBuffer, normalizeAudioBuffer } from './wav-encoder.ts';
import { ZipBuilder } from './zip.ts';
import { scanner } from './scanner.ts';
import { audioEngine } from './audio-engine.ts';
import { getLayout, spPadNumber } from './layouts.ts';

export class HardwarePackagerService {
  /**
   * Sanitize kit name for clean filesystem usage
   */
  sanitizeName(name: string): string {
    return name
      .trim()
      .replace(/[/\\?%*:|"<>]/g, '_')
      .replace(/\s+/g, '_');
  }

  /**
   * Helper to decode a SampleRecord into an AudioBuffer using AudioEngine
   */
  async getAudioBufferForSample(sample: SampleRecord): Promise<AudioBuffer | null> {
    // 1. Check if audioEngine already has the real decoded PCM audio cached
    const cached = audioEngine.getRealSampleBuffer(sample.id);
    if (cached) return cached;

    // 2. Try loading from local file handle
    const file = await scanner.getFileForSample(sample);
    if (file) {
      return await audioEngine.cachePadAudio(sample.id, file);
    }

    // 3. Fall back to distinct procedural audio buffer (ensures demo kits export full audio)
    return audioEngine.getOrCreateSampleBuffer(sample);
  }

  /**
   * Generate uniform sliced sample chain AudioBuffer
   */
  async generateSampleChainBuffer(
    buffers: AudioBuffer[],
    padCount: number,
    targetSampleRate: number,
    sliceCount?: number
  ): Promise<AudioBuffer> {
    if (buffers.length === 0) {
      throw new Error('No audio buffers available to generate sample chain');
    }

    // Number of slices: 4 for 4-pad kits, 8 for 6 or 8 pad kits
    const numSlices = sliceCount ?? (padCount === 4 ? 4 : 8);

    // Determine max duration with 50ms safety decay buffer
    let maxDuration = 0;
    for (const buf of buffers) {
      if (buf.duration > maxDuration) {
        maxDuration = buf.duration;
      }
    }

    const sliceFrames = Math.max(
      Math.ceil((maxDuration + 0.05) * targetSampleRate),
      Math.ceil(0.25 * targetSampleRate) // min 250ms slice
    );
    const totalFrames = sliceFrames * numSlices;
    const numChannels = Math.max(...buffers.map(b => b.numberOfChannels), 1) >= 2 ? 2 : 1;

    const OfflineContextClass = window.OfflineAudioContext || (window as unknown as { webkitOfflineAudioContext: typeof OfflineAudioContext }).webkitOfflineAudioContext;
    const offlineCtx = new OfflineContextClass(numChannels, totalFrames, targetSampleRate);
    const chainBuffer = offlineCtx.createBuffer(numChannels, totalFrames, targetSampleRate);

    // Populate each slice slot
    for (let slotIdx = 0; slotIdx < buffers.length && slotIdx < numSlices; slotIdx++) {
      const srcBuf = buffers[slotIdx];
      const startOffset = slotIdx * sliceFrames;
      const copyFrames = Math.min(srcBuf.length, sliceFrames);

      for (let ch = 0; ch < numChannels; ch++) {
        const destChannel = chainBuffer.getChannelData(ch);
        // If source is mono but target is stereo, replicate ch 0 to ch 1
        const srcChannel = srcBuf.getChannelData(Math.min(ch, srcBuf.numberOfChannels - 1));

        for (let f = 0; f < copyFrames; f++) {
          destChannel[startOffset + f] = srcChannel[f];
        }
      }
    }

    return chainBuffer;
  }

  /**
   * Generate instant songwriting cheat-sheet companion text
   */
  generateKitInfo(kit: Kit, target: HardwareTarget): string {
    const timestamp = new Date(kit.generatedAt || Date.now()).toISOString().replace('T', ' ').substring(0, 16);
    const camelot = kit.dominantCamelot || 'Acoustic / Free';
    const key = kit.dominantKey || 'Standard Tuning';

    // Estimate suggested BPM based on kit style or durations
    let suggestedBpm = '90 - 100 BPM';
    if (kit.presetId?.includes('trap') || kit.presetId?.includes('drill')) {
      suggestedBpm = '130 - 145 BPM';
    } else if (kit.presetId?.includes('lofi') || kit.presetId?.includes('boom')) {
      suggestedBpm = '84 - 92 BPM';
    } else if (kit.presetId?.includes('house') || kit.presetId?.includes('techno')) {
      suggestedBpm = '124 - 128 BPM';
    }

    const layout = getLayout(kit.layoutId);
    let padRows = '';
    kit.pads.forEach((pad, idx) => {
      const padNum2 = String(idx + 1).padStart(2, '0');
      const spPad = `A${String(layout?.spNumbered ? spPadNumber(idx) : idx + 1).padStart(2, '0')}`;
      const sample = pad.sample;
      if (!sample) {
        padRows += `[Track ${padNum2} / ${spPad}] Empty Pad\n\n`;
        return;
      }

      const role = pad.label ? `${pad.label} (${sample.role})` : sample.role;
      const dur = sample.acousticProfile.duration.toFixed(2) + 's';
      const sharp = Math.round(sample.acousticProfile.transientSharpness);
      const note = sample.acousticProfile.rootKey ? `${sample.acousticProfile.rootKey} (${sample.acousticProfile.camelotKey || ''})` : 'Percussive';

      padRows += `[Track ${padNum2} / Pad ${spPad}] ${role}\n`;
      padRows += `  File:     ${sample.fileName}\n`;
      padRows += `  Duration: ${dur} | Transient Punch: ${sharp}/100 | Tuning: ${note}\n`;
      padRows += `  Source:   ${sample.folderName}\n\n`;
    });

    return `============================================================
CRATEMATE HARDWARE KIT COMPANION
============================================================
Kit Name:        ${kit.name}
Generated:       ${timestamp}
Hardware Target: ${target === 'm8' ? 'Dirtywave M8 Tracker' : target === 'sp404mk2' ? 'Roland SP-404MKII' : target === 'po33' ? 'Teenage Engineering PO-33' : target === 'universal' ? 'Universal DAW / MPC' : 'Dual Package (M8 & SP-404MKII)'}
Pad Count:       ${kit.padCount} Pads
Harmonic Key:    ${camelot} (${key})
Suggested BPM:   ${suggestedBpm}
Style Preset:    ${kit.presetName || 'CrateMate Custom'}
Pad Layout:      ${layout ? layout.name : 'Standard'}

------------------------------------------------------------
PAD & TRACK ASSIGNMENTS
------------------------------------------------------------
${padRows}------------------------------------------------------------
QUICK START HARDWARE INSTRUCTIONS
------------------------------------------------------------
* DIRTYWAVE M8 TRACKER:
  1. Copy the "Samples/CrateMate/${this.sanitizeName(kit.name)}" folder to your SD card.
  2. Individual Track Mode:
     - Assign 01_Kick, 02_Snare, etc. across Tracks 1 through 8.
  3. Sliced Chain Mode (Recommended to save tracks):
     - In any track, open an Instrument and select type "Sampler".
     - Load "${this.sanitizeName(kit.name)}_Chain_*.wav".
     - Set PLAY MODE to "SLICED", SLICE COUNT to "08".
     - Use the instrument or slice command to trigger any kit hit on a single track!

* ROLAND SP-404MKII:
  1. Copy the "ROLAND/IMPORT/CrateMate/${this.sanitizeName(kit.name)}" folder to your SD card.
  2. Individual Pad Mode:
     - On the SP-404MKII, press [IMPORT], navigate to the folder, and batch-import A01-A08 onto Bank A Pads 1-8.
  3. Auto-Chop Chain Mode:
     - Load "${this.sanitizeName(kit.name)}_Chain_*.wav" onto any free pad.
     - Press [SHIFT] + [START/END] to enter CHOP mode.
     - Press [AUTO CHOP] (Control Knob 1).
     - Set MODE to "TIME DIV" and NUM to 8 (or 16).
     - Press [ENTER] -> [EXECUTE] -> Press Pad 1.
     - Your complete kit is instantly laid out across Bank A!

* TEENAGE ENGINEERING PO-33 / OP-Z:
  1. Resampled to 22.05kHz mono to conserve battery & sample memory.
  2. Load into drum slot 09–16.

* UNIVERSAL WAV:
  1. Compatible with all general samplers, DAWs, and Akai MPC devices.

============================================================
Exported with CrateMate • Local-First Sample Curation
============================================================
`;
  }

  /**
   * Build complete file entries for the chosen hardware profile
   */
  async buildPackageFiles(
    kit: Kit,
    options: HardwareExportOptions,
    onProgress?: (status: string) => void
  ): Promise<HardwareFileEntry[]> {
    const safeKitName = this.sanitizeName(kit.name);
    const entries: HardwareFileEntry[] = [];

    // Filter valid samples
    const validPads = kit.pads.filter(p => !!p.sample);
    if (validPads.length === 0) {
      throw new Error('No samples loaded in kit to export');
    }

    // Determine target sample rates
    const targets: Array<{
      id: HardwareTarget;
      label: string;
      sampleRate: number;
      baseDir: string;
      prefixFn: (idx: number) => string;
      chainName: string;
    }> = [];

    if (options.target === 'm8') {
      targets.push({
        id: 'm8',
        label: 'Dirtywave M8 (44.1kHz 16-bit)',
        sampleRate: 44100,
        baseDir: `Samples/CrateMate/${safeKitName}`,
        prefixFn: (i: number) => `${String(i + 1).padStart(2, '0')}`,
        chainName: `${safeKitName}_Chain_08Slice_44k.wav`
      });
    } else if (options.target === 'sp404mk2') {
      targets.push({
        id: 'sp404mk2',
        label: 'Roland SP-404MKII (48kHz 16-bit)',
        sampleRate: 48000,
        baseDir: `ROLAND/IMPORT/CrateMate/${safeKitName}`,
        prefixFn: (i: number) => `A${String(i + 1).padStart(2, '0')}`,
        chainName: `${safeKitName}_Chain_16Pad_48k.wav`
      });
    } else if (options.target === 'po33') {
      targets.push({
        id: 'po33',
        label: 'Teenage Engineering PO-33 / OP-Z (22.05kHz)',
        sampleRate: 22050,
        baseDir: `PO33/${safeKitName}`,
        prefixFn: (i: number) => `Pad_${String(i + 1).padStart(2, '0')}`,
        chainName: `${safeKitName}_PO33_Chain_22k.wav`
      });
    } else if (options.target === 'universal') {
      targets.push({
        id: 'universal',
        label: 'Universal WAV (44.1kHz 24-bit)',
        sampleRate: 44100,
        baseDir: `CrateMate/${safeKitName}`,
        prefixFn: (i: number) => `${String(i + 1).padStart(2, '0')}`,
        chainName: `${safeKitName}_Chain_44k.wav`
      });
    } else {
      // Dual package
      targets.push({
        id: 'm8',
        label: 'Dirtywave M8 (44.1kHz 16-bit)',
        sampleRate: 44100,
        baseDir: `m8/Samples/CrateMate/${safeKitName}`,
        prefixFn: (i: number) => `${String(i + 1).padStart(2, '0')}`,
        chainName: `${safeKitName}_Chain_08Slice_44k.wav`
      });
      targets.push({
        id: 'sp404mk2',
        label: 'Roland SP-404MKII (48kHz 16-bit)',
        sampleRate: 48000,
        baseDir: `sp404mk2/ROLAND/IMPORT/CrateMate/${safeKitName}`,
        prefixFn: (i: number) => `A${String(i + 1).padStart(2, '0')}`,
        chainName: `${safeKitName}_Chain_16Pad_48k.wav`
      });
    }

    const layout = getLayout(kit.layoutId);

    // Process audio per target
    for (const t of targets) {
      onProgress?.(`Processing audio for ${t.label}...`);

      const processedBuffers: AudioBuffer[] = [];

      // Layout kits: the SP-404MKII keeps its physical pad positions; other devices get drums first
      const spByPosition = !!layout?.spNumbered && t.id === 'sp404mk2';
      const orderedPads = !layout
        ? validPads
        : spByPosition
          ? [...validPads].sort((a, b) => spPadNumber(a.index) - spPadNumber(b.index))
          : layout.exportOrder.map(idx => validPads.find(p => p.index === idx)).filter((p): p is typeof validPads[number] => !!p);

      // Pass 1: render pad FX and resample
      const rendered: Array<{ pad: typeof validPads[number]; buffer: AudioBuffer }> = [];
      for (let i = 0; i < orderedPads.length; i++) {
        const pad = orderedPads[i];
        const sample = pad.sample!;
        onProgress?.(`Processing sample ${i + 1}/${orderedPads.length}: ${sample.fileName}`);

        let rawBuffer = await this.getAudioBufferForSample(sample);
        if (!rawBuffer) continue;

        let finalBuffer = rawBuffer;

        // Render pad FX (pitch, filter, decay, drive, start, reverse) if enabled
        if (options.bakePadFx !== false && pad.fx) {
          finalBuffer = await audioEngine.renderBufferWithFx(finalBuffer, pad.fx);
        }

        if (options.convertToHardwareSpec) {
          finalBuffer = await resampleAudioBuffer(finalBuffer, t.sampleRate);
        }

        rendered.push({ pad, buffer: finalBuffer });
      }

      // Pass 2: normalize, name and encode. A ghost takes its gain from its main pad so it stays softer.
      for (let i = 0; i < rendered.length; i++) {
        const { pad } = rendered[i];
        const sample = pad.sample!;
        let finalBuffer = rendered[i].buffer;

        if (options.normalizeAudio) {
          const main = pad.ghostOf !== undefined ? rendered.find(r => r.pad.index === pad.ghostOf) : undefined;
          finalBuffer = normalizeAudioBuffer(finalBuffer, -0.5, main?.buffer);
        }

        processedBuffers.push(finalBuffer);

        // Discrete file naming
        const prefix = spByPosition ? `A${String(spPadNumber(pad.index)).padStart(2, '0')}` : t.prefixFn(i);
        const safeRole = (pad.label ? pad.label.toLowerCase().replace(/\s+/g, '-') : sample.role.replace('/', '_'));
        const keyTag = sample.acousticProfile.camelotKey ? `_${sample.acousticProfile.camelotKey}` : '';
        const baseName = sample.fileName.replace(/\.[^/.]+$/, '');
        const filename = `${prefix}_${safeRole}${keyTag}_${baseName}.wav`;

        const wavBytes = encodeWav(finalBuffer);
        entries.push({
          relativePath: `${t.baseDir}/${filename}`,
          data: wavBytes
        });
      }

      // Generate Sample Chain if enabled
      if (options.includeSampleChain && processedBuffers.length > 0) {
        onProgress?.(`Generating uniform sliced sample chain for ${t.id}...`);
        const chainBuffer = await this.generateSampleChainBuffer(
          processedBuffers,
          kit.padCount,
          options.convertToHardwareSpec ? t.sampleRate : (processedBuffers[0]?.sampleRate || 44100),
          spByPosition ? 16 : undefined
        );
        const chainBytes = encodeWav(chainBuffer);
        entries.push({
          relativePath: `${t.baseDir}/${t.chainName}`,
          data: chainBytes
        });
      }

      // Add Kit Companion Info
      if (options.includeKitInfo) {
        const infoText = this.generateKitInfo(kit, t.id);
        const textEncoder = new TextEncoder();
        entries.push({
          relativePath: `${t.baseDir}/KIT_INFO.txt`,
          data: textEncoder.encode(infoText)
        });
      }
    }

    return entries;
  }

  /**
   * Export kit directly to an SD card or local directory via File System Access API
   */
  async exportToDirectory(
    kit: Kit,
    options: HardwareExportOptions,
    dirHandle: FileSystemDirectoryHandle,
    onProgress?: (status: string) => void
  ): Promise<number> {
    const files = await this.buildPackageFiles(kit, options, onProgress);

    onProgress?.(`Writing ${files.length} files to destination directory...`);

    let written = 0;
    for (const file of files) {
      const parts = file.relativePath.split('/');
      const fileName = parts.pop()!;
      let currentDir = dirHandle;

      // Ensure directory hierarchy exists
      for (const dirName of parts) {
        currentDir = await (currentDir as any).getDirectoryHandle(dirName, { create: true });
      }

      // Write file
      const fileHandle = await (currentDir as any).getFileHandle(fileName, { create: true });
      const writable = await (fileHandle as any).createWritable();
      await writable.write(file.data);
      await writable.close();
      written++;
      onProgress?.(`Saved ${written}/${files.length}: ${fileName}`);
    }

    return written;
  }

  /**
   * Export kit to an in-browser downloadable ZIP file
   */
  async exportToZip(
    kit: Kit,
    options: HardwareExportOptions,
    onProgress?: (status: string) => void
  ): Promise<void> {
    const files = await this.buildPackageFiles(kit, options, onProgress);
    onProgress?.(`Packaging ${files.length} files into ZIP archive...`);

    const zip = new ZipBuilder();
    for (const file of files) {
      zip.addFile(file.relativePath, file.data);
    }

    const targetSuffix = options.target === 'm8' ? 'M8' : options.target === 'sp404mk2' ? 'SP404MK2' : 'Dual';
    const zipName = `${this.sanitizeName(kit.name)}_${targetSuffix}.zip`;

    onProgress?.(`Triggering download for ${zipName}...`);
    zip.download(zipName);
  }
}

export const hardwarePackager = new HardwarePackagerService();
