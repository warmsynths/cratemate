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
   * Check if an audio buffer is cached in memory
   */
  isSampleCached(sampleId: string): boolean {
    return this.activeKitBuffers.has(sampleId);
  }

  /**
   * Get cached AudioBuffer if available
   */
  getSampleBuffer(sampleId: string): AudioBuffer | undefined {
    return this.activeKitBuffers.get(sampleId);
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
   * Play sample from File, pre-cached buffer, or distinct synthesized sound
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
        console.warn('Could not load audio file from handle, falling back to distinct synthetic preview:', err);
      }
    }

    if (!buffer) {
      buffer = this.getOrCreateSampleBuffer(sample);
    }

    this.playBuffer(buffer);
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
   * Retrieve cached AudioBuffer or synthesize one with distinct sound design
   */
  getOrCreateSampleBuffer(sample: SampleRecord): AudioBuffer {
    let buffer = this.activeKitBuffers.get(sample.id);
    if (!buffer) {
      buffer = this.createSyntheticSampleBuffer(sample);
      this.activeKitBuffers.set(sample.id, buffer);
    }
    return buffer;
  }

  /**
   * Synthesize a distinct AudioBuffer tailored to the sample's identity, acoustic profile, and role
   */
  createSyntheticSampleBuffer(sample: SampleRecord): AudioBuffer {
    const ctx = this.getContext();
    const fileName = sample.fileName || '';

    let buffer: AudioBuffer;

    if (fileName.includes('808_DeepKick_Punch')) {
      buffer = this.generate808DeepKick(ctx);
    } else if (fileName.includes('Sub_Boom_LowC')) {
      buffer = this.generateSubBoomKick(ctx);
    } else if (fileName.includes('Punchy_Analog_BD')) {
      buffer = this.generatePunchyAnalogKick(ctx);
    } else if (fileName.includes('Crisp_Vintage_Snare')) {
      buffer = this.generateVintageSnare(ctx);
    } else if (fileName.includes('Tight_Rim_Snap')) {
      buffer = this.generateTightRimSnap(ctx);
    } else if (fileName.includes('Trap_Clap_Hit')) {
      buffer = this.generateTrapClap(ctx);
    } else if (fileName.includes('Crisp_Closed_HH')) {
      buffer = this.generateCrispClosedHat(ctx);
    } else if (fileName.includes('Sizzle_Open_Hat')) {
      buffer = this.generateSizzleOpenHat(ctx);
    } else if (fileName.includes('Shaker_Groove')) {
      buffer = this.generateShakerGroove(ctx);
    } else if (fileName.includes('Rhodes_Chords_Am')) {
      buffer = this.generateRhodesChord(ctx);
    } else if (fileName.includes('Analog_SubBass_D')) {
      buffer = this.generateAnalogSubBass(ctx);
    } else if (fileName.includes('Vocal_Chop_Melody')) {
      buffer = this.generateVocalChop(ctx);
    } else if (fileName.includes('Vinyl_Crackles_Atmo')) {
      buffer = this.generateVinylCrackle(ctx);
    } else if (fileName.includes('Foley_Click_Drop')) {
      buffer = this.generateFoleyDrop(ctx);
    } else if (fileName.includes('Space_Sweep_FX')) {
      buffer = this.generateSpaceSweep(ctx);
    } else {
      buffer = this.generateParametricSound(ctx, sample);
    }

    this.extractWaveformBins(buffer, sample);
    return buffer;
  }

  // --- 15 DEDICATED DISTINCT SOUND GENERATORS ---

  private generate808DeepKick(ctx: AudioContext): AudioBuffer {
    const sr = ctx.sampleRate;
    const dur = 0.55;
    const buffer = ctx.createBuffer(1, Math.floor(sr * dur), sr);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < data.length; i++) {
      const t = i / sr;
      const click = t < 0.006 ? (Math.random() * 2 - 1) * Math.exp(-t * 800) * 0.45 : 0;
      const freq = 30 + 135 * Math.exp(-t * 26);
      const sine = Math.sin(2 * Math.PI * freq * t);
      const env = Math.exp(-t * 5.2);
      data[i] = Math.tanh((sine * env + click) * 1.3) * 0.92;
    }
    return buffer;
  }

  private generateSubBoomKick(ctx: AudioContext): AudioBuffer {
    const sr = ctx.sampleRate;
    const dur = 0.75;
    const buffer = ctx.createBuffer(1, Math.floor(sr * dur), sr);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < data.length; i++) {
      const t = i / sr;
      const freq = 32.7 + 45 * Math.exp(-t * 16);
      const f0 = Math.sin(2 * Math.PI * freq * t);
      const f1 = Math.sin(4 * Math.PI * freq * t) * 0.15;
      const attack = Math.min(1.0, t / 0.005);
      const decay = Math.exp(-t * 3.6);
      data[i] = (f0 + f1) * attack * decay * 0.95;
    }
    return buffer;
  }

  private generatePunchyAnalogKick(ctx: AudioContext): AudioBuffer {
    const sr = ctx.sampleRate;
    const dur = 0.28;
    const buffer = ctx.createBuffer(1, Math.floor(sr * dur), sr);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < data.length; i++) {
      const t = i / sr;
      const click = t < 0.008 ? Math.sin(2 * Math.PI * 1200 * t) * Math.exp(-t * 600) * 0.35 : 0;
      const freq = 55 + 180 * Math.exp(-t * 38);
      const sine = Math.sin(2 * Math.PI * freq * t);
      const decay = Math.exp(-t * 13.5);
      data[i] = (sine * decay + click) * 0.9;
    }
    return buffer;
  }

  private generateVintageSnare(ctx: AudioContext): AudioBuffer {
    const sr = ctx.sampleRate;
    const dur = 0.26;
    const buffer = ctx.createBuffer(1, Math.floor(sr * dur), sr);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < data.length; i++) {
      const t = i / sr;
      const body = (Math.sin(2 * Math.PI * 185 * t) * 0.6 + Math.sin(2 * Math.PI * 275 * t) * 0.4) * Math.exp(-t * 22);
      const noise = (Math.random() * 2 - 1) * Math.exp(-t * 13);
      data[i] = (body * 0.38 + noise * 0.62) * 0.88;
    }
    return buffer;
  }

  private generateTightRimSnap(ctx: AudioContext): AudioBuffer {
    const sr = ctx.sampleRate;
    const dur = 0.12;
    const buffer = ctx.createBuffer(1, Math.floor(sr * dur), sr);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < data.length; i++) {
      const t = i / sr;
      const click = t < 0.003 ? (Math.random() * 2 - 1) * 0.6 : 0;
      const ping = Math.sin(2 * Math.PI * 420 * t) * 0.5 + Math.sin(2 * Math.PI * 980 * t) * 0.35;
      const decay = Math.exp(-t * 36);
      data[i] = (ping * decay + click) * 0.85;
    }
    return buffer;
  }

  private generateTrapClap(ctx: AudioContext): AudioBuffer {
    const sr = ctx.sampleRate;
    const dur = 0.32;
    const buffer = ctx.createBuffer(1, Math.floor(sr * dur), sr);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < data.length; i++) {
      const t = i / sr;
      const noise = Math.random() * 2 - 1;
      let clapEnv = 0;
      if (t >= 0 && t < 0.012) clapEnv = Math.exp(-(t) * 160) * 0.35;
      else if (t >= 0.012 && t < 0.024) clapEnv = Math.exp(-(t - 0.012) * 160) * 0.45;
      else if (t >= 0.024 && t < 0.036) clapEnv = Math.exp(-(t - 0.024) * 160) * 0.55;
      else if (t >= 0.036) clapEnv = Math.exp(-(t - 0.036) * 14) * 0.95;

      data[i] = noise * clapEnv * 0.82;
    }
    return buffer;
  }

  private generateCrispClosedHat(ctx: AudioContext): AudioBuffer {
    const sr = ctx.sampleRate;
    const dur = 0.055;
    const buffer = ctx.createBuffer(1, Math.floor(sr * dur), sr);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < data.length; i++) {
      const t = i / sr;
      const inharmonic = (
        Math.sin(2 * Math.PI * 340 * t) +
        Math.sin(2 * Math.PI * 520 * t) +
        Math.sin(2 * Math.PI * 810 * t) +
        Math.sin(2 * Math.PI * 1150 * t)
      ) * 0.25;
      const noise = (Math.random() * 2 - 1) * 0.75;
      const decay = Math.exp(-t * 68);
      data[i] = (inharmonic + noise) * decay * 0.75;
    }
    return buffer;
  }

  private generateSizzleOpenHat(ctx: AudioContext): AudioBuffer {
    const sr = ctx.sampleRate;
    const dur = 0.50;
    const buffer = ctx.createBuffer(1, Math.floor(sr * dur), sr);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < data.length; i++) {
      const t = i / sr;
      const metallic = (
        Math.sin(2 * Math.PI * 380 * t) +
        Math.sin(2 * Math.PI * 620 * t) +
        Math.sin(2 * Math.PI * 940 * t)
      ) * 0.18;
      const noise = (Math.random() * 2 - 1) * 0.82;
      const decay = Math.exp(-t * 7.2);
      data[i] = (metallic + noise) * decay * 0.72;
    }
    return buffer;
  }

  private generateShakerGroove(ctx: AudioContext): AudioBuffer {
    const sr = ctx.sampleRate;
    const dur = 0.22;
    const buffer = ctx.createBuffer(1, Math.floor(sr * dur), sr);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < data.length; i++) {
      const t = i / sr;
      const noise = Math.random() * 2 - 1;
      let env = 0;
      if (t < 0.06) {
        env = Math.sin((t / 0.06) * (Math.PI / 2)) * 0.45;
      } else {
        env = Math.exp(-(t - 0.06) * 22) * 0.85;
      }
      data[i] = noise * env * 0.78;
    }
    return buffer;
  }

  private generateRhodesChord(ctx: AudioContext): AudioBuffer {
    const sr = ctx.sampleRate;
    const dur = 1.0;
    const buffer = ctx.createBuffer(1, Math.floor(sr * dur), sr);
    const data = buffer.getChannelData(0);
    // Am7 chord: A3(220), C4(261.63), E4(329.63), G4(392)
    const notes = [220.0, 261.63, 329.63, 392.0];

    for (let i = 0; i < data.length; i++) {
      const t = i / sr;
      let chord = 0;
      const tremolo = 1.0 + 0.15 * Math.sin(2 * Math.PI * 4.8 * t);

      for (const freq of notes) {
        const f0 = Math.sin(2 * Math.PI * freq * t);
        const f1 = Math.sin(4 * Math.PI * freq * t) * 0.25;
        const chime = Math.sin(8 * Math.PI * freq * t) * 0.1 * Math.exp(-t * 8);
        chord += (f0 + f1 + chime);
      }
      const decay = Math.exp(-t * 2.6);
      data[i] = (chord / notes.length) * tremolo * decay * 0.75;
    }
    return buffer;
  }

  private generateAnalogSubBass(ctx: AudioContext): AudioBuffer {
    const sr = ctx.sampleRate;
    const dur = 0.75;
    const buffer = ctx.createBuffer(1, Math.floor(sr * dur), sr);
    const data = buffer.getChannelData(0);
    const f0 = 73.42; // D2

    for (let i = 0; i < data.length; i++) {
      const t = i / sr;
      const filterEnv = Math.exp(-t * 5.0);
      let saw = 0;
      const harmonics = 8;
      for (let h = 1; h <= harmonics; h++) {
        const harmonicDamp = Math.min(1.0, (1.0 / h) * (0.3 + 0.7 * filterEnv));
        saw += Math.sin(2 * Math.PI * f0 * h * t) * harmonicDamp;
      }
      const decay = Math.exp(-t * 2.8);
      data[i] = Math.tanh(saw * 0.6) * decay * 0.85;
    }
    return buffer;
  }

  private generateVocalChop(ctx: AudioContext): AudioBuffer {
    const sr = ctx.sampleRate;
    const dur = 0.52;
    const buffer = ctx.createBuffer(1, Math.floor(sr * dur), sr);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < data.length; i++) {
      const t = i / sr;
      const pitch = 330 + (392 - 330) * Math.min(1.0, t / 0.12);
      const vibrato = t > 0.15 ? Math.sin(2 * Math.PI * 5.5 * (t - 0.15)) * 4 : 0;
      const carrier = Math.sin(2 * Math.PI * (pitch + vibrato) * t);

      // Formant synthesis (vowel resonance 'ah' -> 'oh')
      const formant1 = Math.sin(2 * Math.PI * (750 - 200 * t) * t) * 0.4;
      const formant2 = Math.sin(2 * Math.PI * (1200 - 300 * t) * t) * 0.25;

      const decay = Math.exp(-t * 3.8);
      data[i] = (carrier * 0.55 + formant1 + formant2) * decay * 0.75;
    }
    return buffer;
  }

  private generateVinylCrackle(ctx: AudioContext): AudioBuffer {
    const sr = ctx.sampleRate;
    const dur = 1.0;
    const buffer = ctx.createBuffer(1, Math.floor(sr * dur), sr);
    const data = buffer.getChannelData(0);

    let popInterval = Math.floor(sr * (0.04 + Math.random() * 0.12));
    let popCounter = 0;
    let popDecay = 0;

    for (let i = 0; i < data.length; i++) {
      const t = i / sr;
      const hum = Math.sin(2 * Math.PI * 50 * t) * 0.05 + Math.sin(2 * Math.PI * 100 * t) * 0.025;
      const hiss = (Math.random() * 2 - 1) * 0.04;

      popCounter++;
      if (popCounter >= popInterval) {
        popCounter = 0;
        popInterval = Math.floor(sr * (0.03 + Math.random() * 0.18));
        popDecay = 0.55 + Math.random() * 0.4;
      }

      const pop = popDecay > 0.01 ? (Math.random() * 2 - 1) * popDecay : 0;
      popDecay *= 0.88;

      data[i] = (hum + hiss + pop) * 0.75;
    }
    return buffer;
  }

  private generateFoleyDrop(ctx: AudioContext): AudioBuffer {
    const sr = ctx.sampleRate;
    const dur = 0.25;
    const buffer = ctx.createBuffer(1, Math.floor(sr * dur), sr);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < data.length; i++) {
      const t = i / sr;
      const click = t < 0.004 ? (Math.random() * 2 - 1) * 0.55 : 0;
      const wood = Math.sin(2 * Math.PI * 580 * t) * Math.exp(-t * 26);
      let bounce = 0;
      if (t >= 0.048 && t < 0.08) {
        bounce = Math.sin(2 * Math.PI * 720 * (t - 0.048)) * Math.exp(-(t - 0.048) * 45) * 0.4;
      }
      data[i] = (click + wood * 0.7 + bounce) * 0.85;
    }
    return buffer;
  }

  private generateSpaceSweep(ctx: AudioContext): AudioBuffer {
    const sr = ctx.sampleRate;
    const dur = 0.85;
    const buffer = ctx.createBuffer(1, Math.floor(sr * dur), sr);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < data.length; i++) {
      const t = i / sr;
      const sweepFreq = 280 + 3200 * (t / dur);
      const tone = Math.sin(2 * Math.PI * sweepFreq * t);
      const noise = (Math.random() * 2 - 1) * 0.35;
      const env = Math.sin(Math.PI * Math.min(1.0, t / dur));
      data[i] = (tone * 0.65 + noise) * env * 0.72;
    }
    return buffer;
  }

  private generateParametricSound(ctx: AudioContext, sample: SampleRecord): AudioBuffer {
    const sr = ctx.sampleRate;
    const profile = sample.acousticProfile;
    const role = sample.role;
    const dur = Math.max(0.1, Math.min(profile?.duration || 0.45, 2.0));
    const buffer = ctx.createBuffer(1, Math.floor(sr * dur), sr);
    const data = buffer.getChannelData(0);

    // Hash the file name or ID for deterministic timbre variation
    let hash = 0;
    const str = sample.fileName || sample.id || 'sample';
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash |= 0;
    }
    const seed = Math.abs(hash);
    const varFactor = 0.8 + 0.4 * ((seed % 100) / 100);

    const basePitch = profile?.rootPitchHz || (role === 'Kick/Low' ? 50 : role === 'Snare/Snap' ? 200 : role === 'Hat/Air' ? 8000 : 261.63);
    const pitch = basePitch * varFactor;

    for (let i = 0; i < data.length; i++) {
      const t = i / sr;
      if (role === 'Kick/Low') {
        const f = (pitch * 0.8) + (pitch * 2.5) * Math.exp(-t * 24);
        data[i] = Math.sin(2 * Math.PI * f * t) * Math.exp(-t * 6.5) * 0.9;
      } else if (role === 'Snare/Snap') {
        const body = Math.sin(2 * Math.PI * pitch * t) * Math.exp(-t * 20) * 0.4;
        const noise = (Math.random() * 2 - 1) * Math.exp(-t * 14) * 0.6;
        data[i] = (body + noise) * 0.85;
      } else if (role === 'Hat/Air') {
        const noise = (Math.random() * 2 - 1) * Math.exp(-t * (dur < 0.15 ? 45 : 12));
        data[i] = noise * 0.75;
      } else if (role === 'Tonal/Melodic') {
        const s0 = Math.sin(2 * Math.PI * pitch * t);
        const s1 = Math.sin(4 * Math.PI * pitch * t) * 0.3;
        data[i] = (s0 + s1) * Math.exp(-t * 2.5) * 0.75;
      } else {
        const mod = Math.sin(2 * Math.PI * (pitch * 0.5) * t);
        const carrier = Math.sin(2 * Math.PI * (pitch + mod * 50) * t);
        data[i] = carrier * Math.sin(Math.PI * (t / dur)) * 0.7;
      }
    }

    return buffer;
  }

  private extractWaveformBins(buffer: AudioBuffer, sample: SampleRecord): void {
    if (!sample.acousticProfile) return;
    const data = buffer.getChannelData(0);
    const step = Math.floor(data.length / 64);
    if (step <= 0) return;

    const bins: number[] = [];
    for (let b = 0; b < 64; b++) {
      let max = 0;
      const start = b * step;
      const end = Math.min(start + step, data.length);
      for (let j = start; j < end; j++) {
        const val = Math.abs(data[j]);
        if (val > max) max = val;
      }
      bins.push(+max.toFixed(2));
    }
    sample.acousticProfile.waveformBins = bins;
  }

  /**
   * Synthesize acoustic sound matching the role for instant feedback
   */
  playSyntheticRoleSample(role: string, pitch = 220): void {
    const dummySample: SampleRecord = {
      id: `synthetic_${role}_${pitch}`,
      folderId: 'demo_factory',
      folderName: 'Factory Demo',
      fileName: role,
      relativePath: role,
      fileSize: 44100,
      lastModified: Date.now(),
      role: role as any,
      acousticProfile: {
        duration: role === 'Hat/Air' ? 0.15 : role === 'Tonal/Melodic' ? 0.8 : 0.45,
        transientSharpness: 70,
        attackRiseMs: 5.0,
        crestFactorDb: 18.0,
        energyBalance: { low: 0.3, mid: 0.4, high: 0.3 },
        rootPitchHz: pitch,
        pitchConfidence: 0.8,
        isMelodic: role === 'Tonal/Melodic',
        waveformBins: []
      },
      tags: ['synthetic']
    };
    const buffer = this.createSyntheticSampleBuffer(dummySample);
    this.playBuffer(buffer);
  }

  /**
   * Synthesize an AudioBuffer for demo/test samples
   */
  createSyntheticAudioBuffer(role: string, pitch = 220): AudioBuffer {
    const dummySample: SampleRecord = {
      id: `synthetic_${role}_${pitch}`,
      folderId: 'demo_factory',
      folderName: 'Factory Demo',
      fileName: role,
      relativePath: role,
      fileSize: 44100,
      lastModified: Date.now(),
      role: role as any,
      acousticProfile: {
        duration: role === 'Hat/Air' ? 0.15 : role === 'Tonal/Melodic' ? 0.8 : 0.45,
        transientSharpness: 70,
        attackRiseMs: 5.0,
        crestFactorDb: 18.0,
        energyBalance: { low: 0.3, mid: 0.4, high: 0.3 },
        rootPitchHz: pitch,
        pitchConfidence: 0.8,
        isMelodic: role === 'Tonal/Melodic',
        waveformBins: []
      },
      tags: ['synthetic']
    };
    return this.createSyntheticSampleBuffer(dummySample);
  }
}

export const audioEngine = new AudioEngine();

