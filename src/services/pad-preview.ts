import { audioEngine } from './audio-engine.ts';
import { scanner } from './scanner.ts';
import { envelopeFromBins, envelopeFromBuffer, strokePath, strokePathFromBins } from '../ui/waveforms.ts';
import type { PadSlot, SampleRecord } from '../types/index.ts';

export interface PadPreview {
  /** Length of the pad as it plays and exports, with its settings applied. */
  duration: number;
  /** Untrimmed length, for placing the start marker. */
  rawDuration: number;
  /** Pad-face envelope heights (0..1). */
  env: number[];
  /** Editor waveform path. */
  wave: string;
}

/**
 * Renders each pad's audio with its settings applied, so pads can show a true waveform and length.
 * Results are cached by sample and settings; while a new render runs the last one for that sample is shown.
 */
export class PadPreviewService {
  private cache = new Map<string, PadPreview>();
  private lastForSample = new Map<string, PadPreview>();
  private inflight = new Set<string>();
  private triedFile = new Set<string>();
  private listeners = new Set<() => void>();

  onChange(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  get(pad: PadSlot): PadPreview | undefined {
    const sample = pad.sample;
    if (!sample) return undefined;
    const key = this.keyFor(sample, pad);
    const hit = this.cache.get(key);
    if (hit) return hit;
    this.schedule(sample, pad, key);
    return this.lastForSample.get(sample.id) ?? this.fromBins(sample);
  }

  private keyFor(sample: SampleRecord, pad: PadSlot): string {
    const real = audioEngine.isRealSampleCached(sample.id) ? 'r' : 's';
    return `${sample.id}|${real}|${JSON.stringify(pad.fx ?? {})}`;
  }

  private fromBins(sample: SampleRecord): PadPreview | undefined {
    const bins = sample.acousticProfile?.waveformBins ?? [];
    if (!bins.length) return undefined;
    const d = sample.acousticProfile.duration;
    return { duration: d, rawDuration: d, env: envelopeFromBins(bins), wave: strokePathFromBins(bins) };
  }

  private schedule(sample: SampleRecord, pad: PadSlot, key: string) {
    if (this.inflight.has(key)) return;
    this.inflight.add(key);
    const fx = pad.fx ? { ...pad.fx } : undefined;
    this.render(sample, fx)
      .then(preview => {
        if (this.cache.size > 400) this.cache.clear();
        this.cache.set(key, preview);
        this.lastForSample.set(sample.id, preview);
        this.listeners.forEach(fn => fn());
      })
      .catch(err => console.warn('Pad preview failed:', err))
      .finally(() => this.inflight.delete(key));
  }

  private async source(sample: SampleRecord): Promise<AudioBuffer> {
    const real = audioEngine.getRealSampleBuffer(sample.id);
    if (real) return real;
    if (sample.folderId !== 'demo_factory' && !this.triedFile.has(sample.id)) {
      this.triedFile.add(sample.id);
      const file = await scanner.getFileForSample(sample).catch(() => undefined);
      if (file) return audioEngine.cachePadAudio(sample.id, file);
    }
    return audioEngine.getOrCreateSyntheticBuffer(sample);
  }

  private async render(sample: SampleRecord, fx: PadSlot['fx']): Promise<PadPreview> {
    const src = await this.source(sample);
    const play = await audioEngine.renderBufferWithFx(src, fx);
    const trims = !!fx && (!!fx.start || !!fx.reverse);
    const raw = trims ? await audioEngine.renderBufferWithFx(src, { ...fx, start: 0, reverse: false }) : play;
    return {
      duration: play.duration,
      rawDuration: raw.duration,
      env: envelopeFromBuffer(play),
      wave: strokePath(fx?.reverse ? play : raw)
    };
  }
}

export const padPreviews = new PadPreviewService();
