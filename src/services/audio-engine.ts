import { computeAcousticProfile } from './dsp.ts';
import type { AcousticProfile, SampleRecord } from '../types/index.ts';

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private volume: number = 0.10; // 10% default volume
  private activeKitBuffers: Map<string, AudioBuffer> = new Map();
  private activeSources: Set<AudioBufferSourceNode> = new Set();
  private decodeQueue: Array<{
    file: File;
    resolve: (profile: AcousticProfile) => void;
    reject: (err: Error) => void;
  }> = [];
  private activeDecodes = 0;
  private maxConcurrentDecodes = 2;

  constructor() {
    const savedVol = localStorage.getItem('cratemate_master_volume');
    if (savedVol !== null) {
      const parsed = parseFloat(savedVol);
      if (!isNaN(parsed) && parsed >= 0 && parsed <= 1) {
        this.volume = parsed;
      }
    }
  }

  /**
   * Get or initialize Web Audio Context
   */
  getContext(): AudioContext {
    if (!this.ctx) {
      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioContextClass();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  /**
   * Get or initialize Master Gain Node
   */
  getMasterGain(): GainNode {
    const ctx = this.getContext();
    if (!this.masterGain) {
      this.masterGain = ctx.createGain();
      this.masterGain.gain.setValueAtTime(this.volume, ctx.currentTime);
      this.masterGain.connect(ctx.destination);
    }
    return this.masterGain;
  }

  /**
   * Set master audition volume (0.0 to 1.0)
   */
  setVolume(vol: number): void {
    this.volume = Math.max(0, Math.min(1, vol));
    localStorage.setItem('cratemate_master_volume', this.volume.toString());
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(this.volume, this.ctx.currentTime);
    }
  }

  /**
   * Get current volume (0.0 to 1.0)
   */
  getVolume(): number {
    return this.volume;
  }

  /**
   * Resume audio context on user interaction
   */
  async ensureAudioContext(): Promise<void> {
    const ctx = this.getContext();
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }
  }

  /**
   * Decode audio file in background with throttled concurrency,
   * extracts acoustic profile, and immediately discards the raw PCM buffer to save memory.
   */
  async analyzeAudioFile(file: File): Promise<AcousticProfile> {
    return new Promise((resolve, reject) => {
      this.decodeQueue.push({ file, resolve, reject });
      this.processDecodeQueue();
    });
  }

  private async processDecodeQueue() {
    if (this.activeDecodes >= this.maxConcurrentDecodes || this.decodeQueue.length === 0) {
      return;
    }

    const task = this.decodeQueue.shift();
    if (!task) return;

    this.activeDecodes++;

    try {
      const arrayBuffer = await task.file.arrayBuffer();
      const ctx = this.getContext();
      // decodeAudioData consumes arrayBuffer
      const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
      
      // Compute acoustic features
      const profile = computeAcousticProfile(audioBuffer);

      // Resolve profile
      task.resolve(profile);
    } catch (err) {
      task.reject(err instanceof Error ? err : new Error(String(err)));
    } finally {
      this.activeDecodes--;
      // Small tick delay to let the event loop process UI frames
      setTimeout(() => this.processDecodeQueue(), 10);
    }
  }

  /**
   * Cache audio buffer for active kit pads so audition has 0ms latency
   */
  async cachePadAudio(sampleId: string, file: File): Promise<AudioBuffer> {
    if (this.activeKitBuffers.has(sampleId)) {
      return this.activeKitBuffers.get(sampleId)!;
    }
    const arrayBuffer = await file.arrayBuffer();
    const ctx = this.getContext();
    const buffer = await ctx.decodeAudioData(arrayBuffer);
    this.activeKitBuffers.set(sampleId, buffer);
    return buffer;
  }

  /**
   * Play an AudioBuffer instantly with gain control
   */
  playBuffer(buffer: AudioBuffer, volume = 0.9): AudioBufferSourceNode {
    const ctx = this.getContext();
    const source = ctx.createBufferSource();
    source.buffer = buffer;

    const gainNode = ctx.createGain();
    gainNode.gain.setValueAtTime(volume, ctx.currentTime);

    source.connect(gainNode);
    gainNode.connect(this.getMasterGain());

    source.start(0);
    this.activeSources.add(source);

    source.onended = () => {
      this.activeSources.delete(source);
      source.disconnect();
      gainNode.disconnect();
    };

    return source;
  }

  /**
   * Play sample from File or pre-cached buffer
   */
  async playSample(sample: SampleRecord, getFileHandle?: () => Promise<File | undefined>): Promise<void> {
    await this.ensureAudioContext();

    // Check if buffer is already cached
    let buffer = this.activeKitBuffers.get(sample.id);

    if (!buffer && getFileHandle) {
      try {
        const file = await getFileHandle();
        if (file) {
          buffer = await this.cachePadAudio(sample.id, file);
        }
      } catch (err) {
        console.warn('Could not load audio file from handle, falling back to synthetic preview:', err);
      }
    }

    if (buffer) {
      this.playBuffer(buffer);
      return;
    }

    // If file could not be read or handle is pending permission, generate synthetic audition preview
    this.playSyntheticRoleSample(sample.role, sample.acousticProfile.rootPitchHz || 220);
  }

  /**
   * Stop all active playback voices
   */
  stopAll(): void {
    for (const source of this.activeSources) {
      try {
        source.stop();
      } catch (_) {}
    }
    this.activeSources.clear();
  }

  /**
   * Synthesize acoustic sound matching the role for instant feedback and demo kits
   */
  playSyntheticRoleSample(role: string, pitch = 220): void {
    const ctx = this.getContext();
    const master = this.getMasterGain();
    const now = ctx.currentTime;

    switch (role) {
      case 'Kick/Low': {
        // Punchy 808-style pitch drop kick
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(160, now);
        osc.frequency.exponentialRampToValueAtTime(45, now + 0.08);
        osc.frequency.exponentialRampToValueAtTime(25, now + 0.35);

        gain.gain.setValueAtTime(1.0, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

        osc.connect(gain);
        gain.connect(master);
        osc.start(now);
        osc.stop(now + 0.4);
        break;
      }

      case 'Snare/Snap': {
        // Tone + noise burst
        const osc = ctx.createOscillator();
        const oscGain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(220, now);
        osc.frequency.exponentialRampToValueAtTime(140, now + 0.06);
        oscGain.gain.setValueAtTime(0.7, now);
        oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
        osc.connect(oscGain);
        oscGain.connect(master);
        osc.start(now);
        osc.stop(now + 0.15);

        // Noise buffer
        const noiseBufferSize = Math.floor(ctx.sampleRate * 0.22);
        const noiseBuffer = ctx.createBuffer(1, noiseBufferSize, ctx.sampleRate);
        const output = noiseBuffer.getChannelData(0);
        for (let i = 0; i < noiseBufferSize; i++) {
          output[i] = Math.random() * 2 - 1;
        }
        const noiseSource = ctx.createBufferSource();
        noiseSource.buffer = noiseBuffer;

        const filter = ctx.createBiquadFilter();
        filter.type = 'highpass';
        filter.frequency.setValueAtTime(1000, now);

        const noiseGain = ctx.createGain();
        noiseGain.gain.setValueAtTime(0.8, now);
        noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

        noiseSource.connect(filter);
        filter.connect(noiseGain);
        noiseGain.connect(master);
        noiseSource.start(now);
        break;
      }

      case 'Hat/Air': {
        // Metallic filtered noise burst
        const bufferSize = Math.floor(ctx.sampleRate * 0.09);
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
          data[i] = Math.random() * 2 - 1;
        }
        const source = ctx.createBufferSource();
        source.buffer = buffer;

        const bandpass = ctx.createBiquadFilter();
        bandpass.type = 'highpass';
        bandpass.frequency.setValueAtTime(7000, now);

        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.6, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

        source.connect(bandpass);
        bandpass.connect(gain);
        gain.connect(master);
        source.start(now);
        break;
      }

      case 'Tonal/Melodic': {
        // Warm melodic pluck or rhodes tone
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const gain = ctx.createGain();
        const filter = ctx.createBiquadFilter();

        osc1.type = 'sawtooth';
        osc2.type = 'sine';
        const targetFreq = pitch > 50 && pitch < 1200 ? pitch : 261.63; // Middle C default
        osc1.frequency.setValueAtTime(targetFreq, now);
        osc2.frequency.setValueAtTime(targetFreq * 2.01, now);

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(2400, now);
        filter.frequency.exponentialRampToValueAtTime(400, now + 0.45);

        gain.gain.setValueAtTime(0.7, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.55);

        osc1.connect(filter);
        osc2.connect(filter);
        filter.connect(gain);
        gain.connect(master);

        osc1.start(now);
        osc2.start(now);
        osc1.stop(now + 0.55);
        osc2.stop(now + 0.55);
        break;
      }

      case 'Texture/Wildcard':
      default: {
        // Ethereal sweep or textured chord
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const filter = ctx.createBiquadFilter();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(180, now);
        osc.frequency.linearRampToValueAtTime(320, now + 0.6);

        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(800, now);
        filter.Q.value = 4;

        gain.gain.setValueAtTime(0.01, now);
        gain.gain.linearRampToValueAtTime(0.5, now + 0.15);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.7);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(master);

        osc.start(now);
        osc.stop(now + 0.7);
        break;
      }
    }
  }

  /**
   * Synthesize an AudioBuffer for demo/test samples
   */
  createSyntheticAudioBuffer(role: string, pitch = 220): AudioBuffer {
    const ctx = this.getContext();
    const lengthSec = role === 'Hat/Air' ? 0.15 : role === 'Tonal/Melodic' ? 0.8 : 0.45;
    const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * lengthSec), ctx.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < data.length; i++) {
      const t = i / ctx.sampleRate;
      if (role === 'Kick/Low') {
        const freq = 140 * Math.exp(-t * 22) + 40;
        const env = Math.exp(-t * 8);
        data[i] = Math.sin(2 * Math.PI * freq * t) * env;
      } else if (role === 'Snare/Snap') {
        const tone = Math.sin(2 * Math.PI * 180 * t) * Math.exp(-t * 20);
        const noise = (Math.random() * 2 - 1) * Math.exp(-t * 12);
        data[i] = (tone * 0.4 + noise * 0.6);
      } else if (role === 'Hat/Air') {
        const noise = (Math.random() * 2 - 1) * Math.exp(-t * 35);
        data[i] = noise * 0.8;
      } else if (role === 'Tonal/Melodic') {
        const env = Math.exp(-t * 4);
        data[i] = (Math.sin(2 * Math.PI * pitch * t) + 0.3 * Math.sin(2 * Math.PI * pitch * 2 * t)) * env * 0.6;
      } else {
        const env = Math.sin(Math.PI * (t / lengthSec));
        data[i] = Math.sin(2 * Math.PI * (200 + 150 * t) * t) * env * 0.5;
      }
    }

    return buffer;
  }
}

export const audioEngine = new AudioEngine();
