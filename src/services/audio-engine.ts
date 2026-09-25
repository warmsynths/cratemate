import { computeAcousticProfile } from './dsp.ts';
import type { AcousticProfile, SampleRecord } from '../types/index.ts';

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private volume: number = 0.90; // 90% default volume matching design spec
  private realAudioBuffers: Map<string, AudioBuffer> = new Map();
  private syntheticBuffers: Map<string, AudioBuffer> = new Map();
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
    return this.realAudioBuffers.has(sampleId) || this.syntheticBuffers.has(sampleId);
  }

  /**
   * Check if real decoded audio from file is cached in memory
   */
  isRealSampleCached(sampleId: string): boolean {
    return this.realAudioBuffers.has(sampleId);
  }

  /**
   * Get real decoded AudioBuffer from file if available
   */
  getRealSampleBuffer(sampleId: string): AudioBuffer | undefined {
    return this.realAudioBuffers.get(sampleId);
  }

  /**
   * Get cached AudioBuffer if available (prefers real audio over synthetic fallback)
   */
  getSampleBuffer(sampleId: string): AudioBuffer | undefined {
    return this.realAudioBuffers.get(sampleId) || this.syntheticBuffers.get(sampleId);
  }

  /**
   * Cache real decoded audio buffer for active kit pads so audition has 0ms latency
   */
  async cachePadAudio(sampleId: string, file: File): Promise<AudioBuffer> {
    if (this.realAudioBuffers.has(sampleId)) {
      return this.realAudioBuffers.get(sampleId)!;
    }
    const arrayBuffer = await file.arrayBuffer();
    const ctx = this.getContext();
    const buffer = await ctx.decodeAudioData(arrayBuffer);
    this.realAudioBuffers.set(sampleId, buffer);
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
   * Play sample from File, pre-cached buffer, or distinct synthesized sound.
   * Real user files will always be attempted via getFileHandle() if not yet decoded in realAudioBuffers.
   */
  async playSample(sample: SampleRecord, getFileHandle?: () => Promise<File | undefined>): Promise<void> {
    await this.ensureAudioContext();

    // 1. Check if real decoded audio from user file is already in memory
    let buffer = this.realAudioBuffers.get(sample.id);

    // 2. If not decoded yet and we have a getFileHandle accessor (and it's not a demo sound), attempt file read
    if (!buffer && getFileHandle && sample.folderId !== 'demo_factory') {
      try {
        const file = await getFileHandle();
        if (file) {
          buffer = await this.cachePadAudio(sample.id, file);
        }
      } catch (err) {
        console.warn('Could not load audio file from handle, falling back to distinct synthetic preview:', err);
      }
    }

    // 3. Fallback: If file unavailable (permission prompt pending, demo kit, or offline), use procedural preview
    if (!buffer) {
      buffer = this.getOrCreateSyntheticBuffer(sample);
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
   * Clear cached AudioBuffers so new kits and respins immediately play fresh synthesis
   */
  clearBufferCache(): void {
    this.realAudioBuffers.clear();
    this.syntheticBuffers.clear();
  }

  /**
   * Retrieve cached procedural buffer or synthesize one with distinct sound design
   */
  getOrCreateSyntheticBuffer(sample: SampleRecord): AudioBuffer {
    let buffer = this.syntheticBuffers.get(sample.id);
    if (!buffer) {
      buffer = this.createSyntheticSampleBuffer(sample);
      this.syntheticBuffers.set(sample.id, buffer);
    }
    return buffer;
  }

  /**
   * Retrieve cached AudioBuffer or synthesize one with distinct sound design (for backwards compatibility)
   */
  getOrCreateSampleBuffer(sample: SampleRecord): AudioBuffer {
    return this.realAudioBuffers.get(sample.id) || this.getOrCreateSyntheticBuffer(sample);
  }

  /**
   * Synthesize a distinct AudioBuffer tailored to the sample's identity, acoustic profile, and role
   */
  createSyntheticSampleBuffer(sample: SampleRecord): AudioBuffer {
    const ctx = this.getContext();
    const key = (sample.fileName || sample.id || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const role = sample.role;

    let buffer: AudioBuffer;

    if (role === 'Kick/Low') {
      if (key.includes('808deep') || key.includes('808punch')) {
        buffer = this.generate808DeepKick(ctx);
      } else if (key.includes('subboom')) {
        buffer = this.generateSubBoomKick(ctx);
      } else if (key.includes('punchyanalog') || key.includes('analogbd')) {
        buffer = this.generatePunchyAnalogKick(ctx);
      } else if (key.includes('dustykick') || key.includes('dusty04')) {
        buffer = this.generateDustyKick(ctx);
      } else if (key.includes('tapekick')) {
        buffer = this.generateTapeKick(ctx);
      } else if (key.includes('roomkick')) {
        buffer = this.generateRoomKick(ctx);
      } else if (key.includes('thudkick')) {
        buffer = this.generateThudKick(ctx);
      } else if (key.includes('feltkick')) {
        buffer = this.generateFeltKick(ctx);
      } else if (key.includes('cleanclub') || key.includes('clubbd')) {
        buffer = this.generateCleanClubKick(ctx);
      } else if (key.includes('raw909') || key.includes('909kick')) {
        buffer = this.generateRaw909Kick(ctx);
      } else {
        buffer = this.generateParametricSound(ctx, sample);
      }
    } else if (role === 'Snare/Snap') {
      if (key.includes('vinylsnare') || key.includes('crispvintagesnare') || key.includes('vintagesnare')) {
        buffer = this.generateVintageSnare(ctx);
      } else if (key.includes('snaredust')) {
        buffer = this.generateSnareDust(ctx);
      } else if (key.includes('rimsnap')) {
        buffer = this.generateTightRimSnap(ctx);
      } else if (key.includes('brushsnare')) {
        buffer = this.generateBrushSnare(ctx);
      } else if (key.includes('clapstack') || key.includes('trapclap') || key.includes('clap')) {
        buffer = this.generateTrapClap(ctx);
      } else if (key.includes('crossstick')) {
        buffer = this.generateCrossStick(ctx);
      } else if (key.includes('crisp90s') || key.includes('90ssnare')) {
        buffer = this.generate90sSnare(ctx);
      } else if (key.includes('layeredrim') || key.includes('rimclap')) {
        buffer = this.generateLayeredRimClap(ctx);
      } else if (key.includes('ghostsnare')) {
        buffer = this.generateGhostSnare(ctx);
      } else {
        buffer = this.generateParametricSound(ctx, sample);
      }
    } else if (role === 'Hat/Air') {
      if (key.includes('closedhat') || key.includes('closedhh')) {
        buffer = this.generateCrispClosedHat(ctx);
      } else if (key.includes('openhat')) {
        buffer = this.generateSizzleOpenHat(ctx);
      } else if (key.includes('sizzlehihat') || key.includes('sizzle')) {
        buffer = this.generateSizzleHiHat(ctx);
      } else if (key.includes('shakerloop') || key.includes('shakergroove') || key.includes('shaker')) {
        buffer = this.generateShakerGroove(ctx);
      } else if (key.includes('tamb')) {
        buffer = this.generateTambHit(ctx);
      } else if (key.includes('pedalhat')) {
        buffer = this.generatePedalHat(ctx);
      } else if (key.includes('ridetip') || key.includes('ride')) {
        buffer = this.generateRideTip(ctx);
      } else if (key.includes('halfopen')) {
        buffer = this.generateHalfOpenHat(ctx);
      } else if (key.includes('organicshaker')) {
        buffer = this.generateOrganicShaker(ctx);
      } else {
        buffer = this.generateParametricSound(ctx, sample);
      }
    } else if (role === 'Tonal/Melodic') {
      if (key.includes('rhodes')) {
        buffer = this.generateRhodesChord(ctx);
      } else if (key.includes('uprightbass') || key.includes('bassc2')) {
        buffer = this.generateUprightBass(ctx);
      } else if (key.includes('moog') || key.includes('subbass')) {
        buffer = this.generateMoogBass(ctx);
      } else if (key.includes('wurli')) {
        buffer = this.generateWurliStab(ctx);
      } else if (key.includes('clav')) {
        buffer = this.generateClavChop(ctx);
      } else if (key.includes('flute')) {
        buffer = this.generateJazzFlute(ctx);
      } else if (key.includes('vocal')) {
        buffer = this.generateVocalChop(ctx);
      } else if (key.includes('tapeepiano') || key.includes('epianodm')) {
        buffer = this.generateTapeEPiano(ctx);
      } else if (key.includes('bellchime') || key.includes('chimec')) {
        buffer = this.generateBellChime(ctx);
      } else if (key.includes('soulorgan') || key.includes('organhit')) {
        buffer = this.generateSoulOrgan(ctx);
      } else if (key.includes('fmpluck') || key.includes('pluckbell')) {
        buffer = this.generateFMPluckBell(ctx);
      } else {
        buffer = this.generateParametricSound(ctx, sample);
      }
    } else {
      // Texture/Wildcard
      if (key.includes('crackle') || key.includes('vinylcrackle') || key.includes('vinyl')) {
        buffer = this.generateVinylCrackle(ctx);
      } else if (key.includes('hissbed') || key.includes('hiss')) {
        buffer = this.generateHissBed(ctx);
      } else if (key.includes('roomfoley') || key.includes('foleya')) {
        buffer = this.generateRoomFoley(ctx);
      } else if (key.includes('tapestop')) {
        buffer = this.generateTapeStop(ctx);
      } else if (key.includes('dustloop')) {
        buffer = this.generateDustLoop(ctx);
      } else if (key.includes('foleyclick') || key.includes('clickdrop')) {
        buffer = this.generateFoleyDrop(ctx);
      } else if (key.includes('spacesweep') || key.includes('sweepfx')) {
        buffer = this.generateSpaceSweep(ctx);
      } else if (key.includes('rainambience') || key.includes('rain')) {
        buffer = this.generateRainAmbience(ctx);
      } else if (key.includes('cassetteclick')) {
        buffer = this.generateCassetteClick(ctx);
      } else if (key.includes('glitchzap')) {
        buffer = this.generateGlitchZap(ctx);
      } else {
        buffer = this.generateParametricSound(ctx, sample);
      }
    }

    this.extractWaveformBins(buffer, sample);
    return buffer;
  }

  // --- DEDICATED DISTINCT SOUND GENERATORS ---

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

  private generateDustyKick(ctx: AudioContext): AudioBuffer {
    const sr = ctx.sampleRate;
    const dur = 0.42;
    const buffer = ctx.createBuffer(1, Math.floor(sr * dur), sr);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < data.length; i++) {
      const t = i / sr;
      const click = t < 0.005 ? (Math.random() * 2 - 1) * 0.45 : 0;
      const freq = 52 + 120 * Math.exp(-t * 30);
      const sine = Math.sin(2 * Math.PI * freq * t);
      const grit = (Math.sin(2 * Math.PI * freq * 3 * t) * 0.15) * Math.exp(-t * 20);
      const env = Math.exp(-t * 8.5);
      const raw = (sine * env + click + grit) * 1.35;
      const quantized = Math.round(raw * 32) / 32;
      data[i] = Math.tanh(quantized) * 0.92;
    }
    return buffer;
  }

  private generateTapeKick(ctx: AudioContext): AudioBuffer {
    const sr = ctx.sampleRate;
    const dur = 0.51;
    const buffer = ctx.createBuffer(1, Math.floor(sr * dur), sr);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < data.length; i++) {
      const t = i / sr;
      const freq = 46 + 140 * Math.exp(-t * 24);
      const sine = Math.sin(2 * Math.PI * freq * t);
      const punch = Math.sin(2 * Math.PI * 140 * t) * Math.exp(-t * 40) * 0.35;
      const env = Math.exp(-t * 6.2);
      data[i] = Math.tanh((sine * env + punch) * 1.6) * 0.94;
    }
    return buffer;
  }

  private generateRoomKick(ctx: AudioContext): AudioBuffer {
    const sr = ctx.sampleRate;
    const dur = 0.62;
    const buffer = ctx.createBuffer(1, Math.floor(sr * dur), sr);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < data.length; i++) {
      const t = i / sr;
      const click = t < 0.007 ? Math.sin(2 * Math.PI * 2200 * t) * Math.exp(-t * 700) * 0.4 : 0;
      const freq = 58 + 95 * Math.exp(-t * 28);
      const sine = Math.sin(2 * Math.PI * freq * t) * Math.exp(-t * 7.5);
      const room = t > 0.015 ? (Math.random() * 2 - 1) * Math.exp(-(t - 0.015) * 11) * 0.18 : 0;
      data[i] = (sine + click + room) * 0.90;
    }
    return buffer;
  }

  private generateThudKick(ctx: AudioContext): AudioBuffer {
    const sr = ctx.sampleRate;
    const dur = 0.38;
    const buffer = ctx.createBuffer(1, Math.floor(sr * dur), sr);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < data.length; i++) {
      const t = i / sr;
      const freq = 61 + 80 * Math.exp(-t * 36);
      const sine = Math.sin(2 * Math.PI * freq * t);
      const env = Math.exp(-t * 11.0);
      data[i] = Math.tanh(sine * env * 1.5) * 0.88;
    }
    return buffer;
  }

  private generateFeltKick(ctx: AudioContext): AudioBuffer {
    const sr = ctx.sampleRate;
    const dur = 0.47;
    const buffer = ctx.createBuffer(1, Math.floor(sr * dur), sr);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < data.length; i++) {
      const t = i / sr;
      const freq = 55 + 50 * Math.exp(-t * 22);
      const attack = Math.min(1.0, t / 0.008);
      const sine = Math.sin(2 * Math.PI * freq * t);
      const env = attack * Math.exp(-t * 7.0);
      data[i] = sine * env * 0.88;
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
    const dur = 0.14;
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

  private generateSnareDust(ctx: AudioContext): AudioBuffer {
    const sr = ctx.sampleRate;
    const dur = 0.25;
    const buffer = ctx.createBuffer(1, Math.floor(sr * dur), sr);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < data.length; i++) {
      const t = i / sr;
      const body = Math.sin(2 * Math.PI * 168 * t) * Math.exp(-t * 24) * 0.55;
      const noise = (Math.random() * 2 - 1) * Math.exp(-t * 16) * 0.65;
      const grit = (i % 250 === 0) ? (Math.random() * 2 - 1) * 0.3 : 0;
      data[i] = (body + noise + grit) * 0.86;
    }
    return buffer;
  }

  private generateBrushSnare(ctx: AudioContext): AudioBuffer {
    const sr = ctx.sampleRate;
    const dur = 0.28;
    const buffer = ctx.createBuffer(1, Math.floor(sr * dur), sr);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < data.length; i++) {
      const t = i / sr;
      const sweep = Math.sin((t / 0.28) * Math.PI);
      const noise = (Math.random() * 2 - 1) * sweep * 0.75;
      const tap = t < 0.01 ? (Math.random() * 2 - 1) * 0.4 : 0;
      data[i] = (noise + tap) * 0.82;
    }
    return buffer;
  }

  private generateCrossStick(ctx: AudioContext): AudioBuffer {
    const sr = ctx.sampleRate;
    const dur = 0.12;
    const buffer = ctx.createBuffer(1, Math.floor(sr * dur), sr);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < data.length; i++) {
      const t = i / sr;
      const wood = (Math.sin(2 * Math.PI * 380 * t) * 0.6 + Math.sin(2 * Math.PI * 1100 * t) * 0.4) * Math.exp(-t * 52);
      const click = t < 0.003 ? (Math.random() * 2 - 1) * 0.6 : 0;
      data[i] = (wood + click) * 0.90;
    }
    return buffer;
  }

  private generate90sSnare(ctx: AudioContext): AudioBuffer {
    const sr = ctx.sampleRate;
    const dur = 0.26;
    const buffer = ctx.createBuffer(1, Math.floor(sr * dur), sr);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < data.length; i++) {
      const t = i / sr;
      const click = t < 0.006 ? (Math.random() * 2 - 1) * 0.5 : 0;
      const body = Math.sin(2 * Math.PI * (185 + 40 * Math.exp(-t * 40)) * t) * Math.exp(-t * 22) * 0.6;
      const wires = (Math.random() * 2 - 1) * Math.exp(-t * 14) * 0.65;
      data[i] = Math.tanh(body + wires + click) * 0.92;
    }
    return buffer;
  }

  private generateCrispClosedHat(ctx: AudioContext): AudioBuffer {
    const sr = ctx.sampleRate;
    const dur = 0.08;
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
      const decay = Math.exp(-t * 58);
      data[i] = (inharmonic + noise) * decay * 0.78;
    }
    return buffer;
  }

  private generateSizzleOpenHat(ctx: AudioContext): AudioBuffer {
    const sr = ctx.sampleRate;
    const dur = 0.45;
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
      const decay = Math.exp(-t * 7.5);
      data[i] = (metallic + noise) * decay * 0.76;
    }
    return buffer;
  }

  private generateShakerGroove(ctx: AudioContext): AudioBuffer {
    const sr = ctx.sampleRate;
    const dur = 0.35;
    const buffer = ctx.createBuffer(1, Math.floor(sr * dur), sr);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < data.length; i++) {
      const t = i / sr;
      const noise = Math.random() * 2 - 1;
      let env = 0;
      if (t < 0.08) {
        env = Math.sin((t / 0.08) * (Math.PI / 2)) * 0.45;
      } else {
        env = Math.exp(-(t - 0.08) * 18) * 0.85;
      }
      data[i] = noise * env * 0.80;
    }
    return buffer;
  }

  private generateTambHit(ctx: AudioContext): AudioBuffer {
    const sr = ctx.sampleRate;
    const dur = 0.20;
    const buffer = ctx.createBuffer(1, Math.floor(sr * dur), sr);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < data.length; i++) {
      const t = i / sr;
      const slap = t < 0.005 ? (Math.random() * 2 - 1) * 0.6 : 0;
      const jingle = (
        Math.sin(2 * Math.PI * 4500 * t) +
        Math.sin(2 * Math.PI * 6800 * t) +
        Math.sin(2 * Math.PI * 9200 * t)
      ) * 0.25 * Math.exp(-t * 18);
      const noise = (Math.random() * 2 - 1) * Math.exp(-t * 24) * 0.45;
      data[i] = (slap + jingle + noise) * 0.80;
    }
    return buffer;
  }

  private generatePedalHat(ctx: AudioContext): AudioBuffer {
    const sr = ctx.sampleRate;
    const dur = 0.13;
    const buffer = ctx.createBuffer(1, Math.floor(sr * dur), sr);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < data.length; i++) {
      const t = i / sr;
      const chick = (Math.random() * 2 - 1) * Math.exp(-t * 42) * 0.7;
      const stamp = Math.sin(2 * Math.PI * 180 * t) * Math.exp(-t * 50) * 0.35;
      data[i] = (chick + stamp) * 0.85;
    }
    return buffer;
  }

  private generateRideTip(ctx: AudioContext): AudioBuffer {
    const sr = ctx.sampleRate;
    const dur = 0.65;
    const buffer = ctx.createBuffer(1, Math.floor(sr * dur), sr);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < data.length; i++) {
      const t = i / sr;
      const ping = Math.sin(2 * Math.PI * 2600 * t) * Math.exp(-t * 12) * 0.55;
      const ring = (Math.sin(2 * Math.PI * 5200 * t) * 0.25 + Math.sin(2 * Math.PI * 7800 * t) * 0.15) * Math.exp(-t * 5.5);
      const wash = (Math.random() * 2 - 1) * Math.exp(-t * 6.5) * 0.25;
      data[i] = (ping + ring + wash) * 0.75;
    }
    return buffer;
  }

  // --- TONAL / MELODIC INSTRUMENT GENERATORS (Pads 5 & 6) ---

  private generateRhodesChord(ctx: AudioContext): AudioBuffer {
    const sr = ctx.sampleRate;
    const dur = 1.3;
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
        const chime = Math.sin(8 * Math.PI * freq * t) * 0.15 * Math.exp(-t * 10);
        chord += (f0 + f1 + chime);
      }
      const decay = Math.exp(-t * 2.5);
      data[i] = (chord / notes.length) * tremolo * decay * 0.82;
    }
    return buffer;
  }

  private generateUprightBass(ctx: AudioContext): AudioBuffer {
    const sr = ctx.sampleRate;
    const dur = 1.1;
    const buffer = ctx.createBuffer(1, Math.floor(sr * dur), sr);
    const data = buffer.getChannelData(0);
    const f0 = 65.41; // C2

    for (let i = 0; i < data.length; i++) {
      const t = i / sr;
      // High finger slap / string click on fingerboard
      const click = t < 0.008 ? Math.sin(2 * Math.PI * 1800 * t) * Math.exp(-t * 500) * 0.35 : 0;
      // Woody acoustic upright double-bass harmonics
      const s0 = Math.sin(2 * Math.PI * f0 * t);
      const s1 = Math.sin(2 * Math.PI * (f0 * 2) * t) * 0.45;
      const s2 = Math.sin(2 * Math.PI * (f0 * 3) * t) * 0.25;
      const s3 = Math.sin(2 * Math.PI * (f0 * 4) * t) * 0.12;
      const body = (s0 + s1 + s2 + s3);
      const decay = Math.exp(-t * 3.4);
      data[i] = Math.tanh((body * decay + click) * 1.3) * 0.92;
    }
    return buffer;
  }

  private generateMoogBass(ctx: AudioContext): AudioBuffer {
    const sr = ctx.sampleRate;
    const dur = 1.2;
    const buffer = ctx.createBuffer(1, Math.floor(sr * dur), sr);
    const data = buffer.getChannelData(0);
    const f0 = 49.0; // G1

    for (let i = 0; i < data.length; i++) {
      const t = i / sr;
      // Dual detuned saw oscillators
      const osc1 = Math.sin(2 * Math.PI * f0 * t) + 0.5 * Math.sin(4 * Math.PI * f0 * t) + 0.3 * Math.sin(6 * Math.PI * f0 * t);
      const osc2 = Math.sin(2 * Math.PI * (f0 * 2.01) * t) + 0.4 * Math.sin(4 * Math.PI * (f0 * 2.01) * t);
      // Snappy resonant filter envelope sweep
      const filterEnv = Math.exp(-t * 9.0);
      const filterCut = 0.25 + 0.75 * filterEnv;
      const decay = Math.exp(-t * 2.8);
      data[i] = Math.tanh((osc1 + osc2 * 0.7) * filterCut * 1.8) * decay * 0.92;
    }
    return buffer;
  }

  private generateWurliStab(ctx: AudioContext): AudioBuffer {
    const sr = ctx.sampleRate;
    const dur = 1.0;
    const buffer = ctx.createBuffer(1, Math.floor(sr * dur), sr);
    const data = buffer.getChannelData(0);
    // D4m chord: D4(293.66), F4(349.23), A4(440.0)
    const notes = [293.66, 349.23, 440.0];

    for (let i = 0; i < data.length; i++) {
      const t = i / sr;
      let chord = 0;
      const trem = 1.0 + 0.12 * Math.sin(2 * Math.PI * 5.2 * t);

      for (const f of notes) {
        const reed = Math.sin(2 * Math.PI * f * t) + 0.35 * Math.sin(6 * Math.PI * f * t);
        const bite = Math.sin(2 * Math.PI * f * 5 * t) * 0.15 * Math.exp(-t * 16);
        chord += reed + bite;
      }
      const decay = Math.exp(-t * 3.2);
      data[i] = Math.tanh((chord / notes.length) * 1.4 * trem) * decay * 0.85;
    }
    return buffer;
  }

  private generateClavChop(ctx: AudioContext): AudioBuffer {
    const sr = ctx.sampleRate;
    const dur = 0.65;
    const buffer = ctx.createBuffer(1, Math.floor(sr * dur), sr);
    const data = buffer.getChannelData(0);
    const f0 = 329.63; // E4

    for (let i = 0; i < data.length; i++) {
      const t = i / sr;
      const pluck = t < 0.005 ? (Math.random() * 2 - 1) * 0.5 : 0;
      const s0 = Math.sin(2 * Math.PI * f0 * t);
      const s1 = Math.sin(2 * Math.PI * (f0 * 2) * t) * 0.6;
      const s2 = Math.sin(2 * Math.PI * (f0 * 3) * t) * 0.45;
      const s3 = Math.sin(2 * Math.PI * (f0 * 4) * t) * 0.3;
      const decay = Math.exp(-t * 7.5);
      data[i] = ((s0 + s1 + s2 + s3) * 0.35 * decay + pluck) * 0.88;
    }
    return buffer;
  }

  private generateJazzFlute(ctx: AudioContext): AudioBuffer {
    const sr = ctx.sampleRate;
    const dur = 1.2;
    const buffer = ctx.createBuffer(1, Math.floor(sr * dur), sr);
    const data = buffer.getChannelData(0);
    const f0 = 392.0; // G4

    for (let i = 0; i < data.length; i++) {
      const t = i / sr;
      const chiff = (Math.random() * 2 - 1) * Math.exp(-t * 28) * 0.35;
      const vib = t > 0.12 ? Math.sin(2 * Math.PI * 5.5 * (t - 0.12)) * 6.5 : 0;
      const tone = Math.sin(2 * Math.PI * (f0 + vib) * t);
      const overtone = Math.sin(4 * Math.PI * (f0 + vib) * t) * 0.25;
      const breathHiss = (Math.random() * 2 - 1) * 0.04;
      const decay = Math.exp(-t * 2.5);
      data[i] = (tone * 0.65 + overtone + breathHiss + chiff) * decay * 0.85;
    }
    return buffer;
  }

  private generateVocalChop(ctx: AudioContext): AudioBuffer {
    const sr = ctx.sampleRate;
    const dur = 0.55;
    const buffer = ctx.createBuffer(1, Math.floor(sr * dur), sr);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < data.length; i++) {
      const t = i / sr;
      const pitch = 330 + (440 - 330) * Math.min(1.0, t / 0.12);
      const vibrato = t > 0.15 ? Math.sin(2 * Math.PI * 5.5 * (t - 0.15)) * 4 : 0;
      const carrier = Math.sin(2 * Math.PI * (pitch + vibrato) * t);
      const formant1 = Math.sin(2 * Math.PI * (750 - 200 * t) * t) * 0.4;
      const formant2 = Math.sin(2 * Math.PI * (1200 - 300 * t) * t) * 0.25;
      const decay = Math.exp(-t * 3.8);
      data[i] = (carrier * 0.55 + formant1 + formant2) * decay * 0.80;
    }
    return buffer;
  }

  // --- TEXTURE & WILDCARD GENERATORS (Pads 7 & 8) ---

  private generateVinylCrackle(ctx: AudioContext): AudioBuffer {
    const sr = ctx.sampleRate;
    const dur = 1.5;
    const buffer = ctx.createBuffer(1, Math.floor(sr * dur), sr);
    const data = buffer.getChannelData(0);

    let popInterval = Math.floor(sr * (0.02 + Math.random() * 0.08));
    let popCounter = 0;
    let popAmp = 0;
    let popPhase = 0;

    for (let i = 0; i < data.length; i++) {
      const t = i / sr;
      // Turntable motor rumble
      const rumble = Math.sin(2 * Math.PI * 45 * t) * 0.08 + Math.sin(2 * Math.PI * 90 * t) * 0.04;
      // Vinyl surface friction noise
      const surface = (Math.random() * 2 - 1) * 0.12;

      popCounter++;
      if (popCounter >= popInterval) {
        popCounter = 0;
        popInterval = Math.floor(sr * (0.015 + Math.random() * 0.09));
        popAmp = 0.5 + Math.random() * 0.45;
        popPhase = 0;
      }

      let popVal = 0;
      if (popAmp > 0.02) {
        popVal = Math.sin(popPhase * 1.8) * popAmp;
        popAmp *= 0.94;
        popPhase++;
      }

      data[i] = Math.tanh((rumble + surface + popVal) * 1.4) * 0.88;
    }
    return buffer;
  }

  private generateHissBed(ctx: AudioContext): AudioBuffer {
    const sr = ctx.sampleRate;
    const dur = 1.8;
    const buffer = ctx.createBuffer(1, Math.floor(sr * dur), sr);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < data.length; i++) {
      const t = i / sr;
      const flutter = 1.0 + 0.15 * Math.sin(2 * Math.PI * 0.35 * t);
      const hiss = (Math.random() * 2 - 1) * 0.22 * flutter;
      const tapeHum = Math.sin(2 * Math.PI * 60 * t) * 0.06;
      const env = Math.sin(Math.PI * Math.min(1.0, t / dur));
      data[i] = (hiss + tapeHum) * env * 0.85;
    }
    return buffer;
  }

  private generateRoomFoley(ctx: AudioContext): AudioBuffer {
    const sr = ctx.sampleRate;
    const dur = 0.8;
    const buffer = ctx.createBuffer(1, Math.floor(sr * dur), sr);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < data.length; i++) {
      const t = i / sr;
      const knock = (Math.sin(2 * Math.PI * 310 * t) * 0.65 + Math.sin(2 * Math.PI * 720 * t) * 0.35) * Math.exp(-t * 32);
      const click = t < 0.004 ? (Math.random() * 2 - 1) * 0.55 : 0;
      let room = 0;
      if (t >= 0.018) room += Math.sin(2 * Math.PI * 280 * (t - 0.018)) * Math.exp(-(t - 0.018) * 18) * 0.25;
      if (t >= 0.038) room += Math.sin(2 * Math.PI * 420 * (t - 0.038)) * Math.exp(-(t - 0.038) * 22) * 0.15;
      data[i] = (knock + click + room) * 0.88;
    }
    return buffer;
  }

  private generateTapeStop(ctx: AudioContext): AudioBuffer {
    const sr = ctx.sampleRate;
    const dur = 1.1;
    const buffer = ctx.createBuffer(1, Math.floor(sr * dur), sr);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < data.length; i++) {
      const t = i / sr;
      const speed = Math.max(0, 1.0 - (t / 0.75));
      const freq = 380 * speed * speed;
      const tone = freq > 15 ? Math.sin(2 * Math.PI * freq * t) * 0.75 * Math.min(1.0, speed * 2) : 0;
      const hiss = (Math.random() * 2 - 1) * Math.exp(-t * 2.5) * 0.25;
      data[i] = (tone + hiss) * 0.88;
    }
    return buffer;
  }

  private generateDustLoop(ctx: AudioContext): AudioBuffer {
    const sr = ctx.sampleRate;
    const dur = 1.4;
    const buffer = ctx.createBuffer(1, Math.floor(sr * dur), sr);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < data.length; i++) {
      const t = i / sr;
      const k1 = Math.sin(2 * Math.PI * 55 * t) * Math.exp(-t * 18) * 0.7;
      const k2 = t >= 0.5 ? Math.sin(2 * Math.PI * 55 * (t - 0.5)) * Math.exp(-(t - 0.5) * 18) * 0.6 : 0;
      const s1 = t >= 0.28 ? ((Math.random() * 2 - 1) + Math.sin(2 * Math.PI * 220 * (t - 0.28))) * Math.exp(-(t - 0.28) * 25) * 0.45 : 0;
      const vinyl = (Math.random() * 2 - 1) * 0.12;
      data[i] = Math.tanh((k1 + k2 + s1 + vinyl) * 1.3) * 0.85;
    }
    return buffer;
  }

  private generateFoleyDrop(ctx: AudioContext): AudioBuffer {
    const sr = ctx.sampleRate;
    const dur = 0.35;
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
      if (t >= 0.09 && t < 0.12) {
        bounce += Math.sin(2 * Math.PI * 840 * (t - 0.09)) * Math.exp(-(t - 0.09) * 55) * 0.25;
      }
      data[i] = (click + wood * 0.7 + bounce) * 0.88;
    }
    return buffer;
  }

  private generateSpaceSweep(ctx: AudioContext): AudioBuffer {
    const sr = ctx.sampleRate;
    const dur = 0.95;
    const buffer = ctx.createBuffer(1, Math.floor(sr * dur), sr);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < data.length; i++) {
      const t = i / sr;
      const sweepFreq = 250 + 3200 * (t / dur);
      const tone = Math.sin(2 * Math.PI * sweepFreq * t);
      const noise = (Math.random() * 2 - 1) * 0.35;
      const env = Math.sin(Math.PI * Math.min(1.0, t / dur));
      data[i] = (tone * 0.65 + noise) * env * 0.82;
    }
    return buffer;
  }

  // --- ADDITIONAL DISTINCT SOUND GENERATORS ---

  private generateCleanClubKick(ctx: AudioContext): AudioBuffer {
    const sr = ctx.sampleRate;
    const dur = 0.35;
    const buffer = ctx.createBuffer(1, Math.floor(sr * dur), sr);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < data.length; i++) {
      const t = i / sr;
      const click = t < 0.005 ? Math.sin(2 * Math.PI * 1800 * t) * Math.exp(-t * 600) * 0.4 : 0;
      const freq = 56 + 140 * Math.exp(-t * 32);
      const sine = Math.sin(2 * Math.PI * freq * t);
      const env = Math.exp(-t * 11.5);
      data[i] = Math.tanh((sine * env + click) * 1.4) * 0.92;
    }
    return buffer;
  }

  private generateRaw909Kick(ctx: AudioContext): AudioBuffer {
    const sr = ctx.sampleRate;
    const dur = 0.40;
    const buffer = ctx.createBuffer(1, Math.floor(sr * dur), sr);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < data.length; i++) {
      const t = i / sr;
      const click = t < 0.007 ? (Math.random() * 2 - 1) * Math.exp(-t * 500) * 0.45 : 0;
      const freq = 60 + 170 * Math.exp(-t * 28);
      const f0 = Math.sin(2 * Math.PI * freq * t);
      const f1 = Math.sin(4 * Math.PI * freq * t) * 0.25;
      const env = Math.exp(-t * 8.5);
      data[i] = Math.tanh(((f0 + f1) * env + click) * 1.5) * 0.94;
    }
    return buffer;
  }

  private generateLayeredRimClap(ctx: AudioContext): AudioBuffer {
    const sr = ctx.sampleRate;
    const dur = 0.24;
    const buffer = ctx.createBuffer(1, Math.floor(sr * dur), sr);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < data.length; i++) {
      const t = i / sr;
      const rim = Math.sin(2 * Math.PI * 440 * t) * Math.exp(-t * 45) * 0.6;
      let clap = 0;
      if (t >= 0.01 && t < 0.02) clap = (Math.random() * 2 - 1) * 0.4;
      else if (t >= 0.02 && t < 0.035) clap = (Math.random() * 2 - 1) * 0.55;
      else if (t >= 0.035) clap = (Math.random() * 2 - 1) * Math.exp(-(t - 0.035) * 22) * 0.85;
      data[i] = (rim + clap) * 0.88;
    }
    return buffer;
  }

  private generateGhostSnare(ctx: AudioContext): AudioBuffer {
    const sr = ctx.sampleRate;
    const dur = 0.19;
    const buffer = ctx.createBuffer(1, Math.floor(sr * dur), sr);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < data.length; i++) {
      const t = i / sr;
      const body = Math.sin(2 * Math.PI * 195 * t) * Math.exp(-t * 26) * 0.5;
      const wires = (Math.random() * 2 - 1) * Math.exp(-t * 20) * 0.45;
      data[i] = (body + wires) * 0.75;
    }
    return buffer;
  }

  private generateSizzleHiHat(ctx: AudioContext): AudioBuffer {
    const sr = ctx.sampleRate;
    const dur = 0.28;
    const buffer = ctx.createBuffer(1, Math.floor(sr * dur), sr);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < data.length; i++) {
      const t = i / sr;
      const sizzle = (
        Math.sin(2 * Math.PI * 8400 * t) +
        Math.sin(2 * Math.PI * 11200 * t) +
        Math.sin(2 * Math.PI * 13500 * t)
      ) * 0.22;
      const noise = (Math.random() * 2 - 1) * 0.78;
      const decay = Math.exp(-t * 18);
      data[i] = (sizzle + noise) * decay * 0.75;
    }
    return buffer;
  }

  private generateHalfOpenHat(ctx: AudioContext): AudioBuffer {
    const sr = ctx.sampleRate;
    const dur = 0.22;
    const buffer = ctx.createBuffer(1, Math.floor(sr * dur), sr);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < data.length; i++) {
      const t = i / sr;
      const metallic = (Math.sin(2 * Math.PI * 7200 * t) + Math.sin(2 * Math.PI * 9800 * t)) * 0.2;
      const noise = (Math.random() * 2 - 1) * 0.8;
      const decay = Math.exp(-t * 14);
      data[i] = (metallic + noise) * decay * 0.76;
    }
    return buffer;
  }

  private generateOrganicShaker(ctx: AudioContext): AudioBuffer {
    const sr = ctx.sampleRate;
    const dur = 0.32;
    const buffer = ctx.createBuffer(1, Math.floor(sr * dur), sr);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < data.length; i++) {
      const t = i / sr;
      const noise = Math.random() * 2 - 1;
      const stroke1 = t < 0.12 ? Math.sin((t / 0.12) * Math.PI) * 0.5 : 0;
      const stroke2 = t >= 0.10 ? Math.sin(((t - 0.10) / 0.22) * Math.PI) * 0.85 : 0;
      data[i] = noise * (stroke1 + stroke2) * 0.75;
    }
    return buffer;
  }

  private generateTapeEPiano(ctx: AudioContext): AudioBuffer {
    const sr = ctx.sampleRate;
    const dur = 1.3;
    const buffer = ctx.createBuffer(1, Math.floor(sr * dur), sr);
    const data = buffer.getChannelData(0);
    // Dm chord: D4(293.66), F4(349.23), A4(440.0)
    const notes = [293.66, 349.23, 440.0];

    for (let i = 0; i < data.length; i++) {
      const t = i / sr;
      const wow = 1.0 + 0.003 * Math.sin(2 * Math.PI * 1.8 * t);
      let chord = 0;
      for (const f of notes) {
        const tone = Math.sin(2 * Math.PI * (f * wow) * t);
        const harm = Math.sin(4 * Math.PI * (f * wow) * t) * 0.2;
        chord += tone + harm;
      }
      const hiss = (Math.random() * 2 - 1) * 0.02;
      const decay = Math.exp(-t * 2.8);
      data[i] = ((chord / notes.length) * 0.9 * decay + hiss) * 0.84;
    }
    return buffer;
  }

  private generateBellChime(ctx: AudioContext): AudioBuffer {
    const sr = ctx.sampleRate;
    const dur = 1.0;
    const buffer = ctx.createBuffer(1, Math.floor(sr * dur), sr);
    const data = buffer.getChannelData(0);
    const f0 = 523.25; // C5

    for (let i = 0; i < data.length; i++) {
      const t = i / sr;
      const h1 = Math.sin(2 * Math.PI * f0 * t) * Math.exp(-t * 3.0);
      const h2 = Math.sin(2 * Math.PI * (f0 * 2.02) * t) * 0.4 * Math.exp(-t * 3.8);
      const h3 = Math.sin(2 * Math.PI * (f0 * 3.01) * t) * 0.25 * Math.exp(-t * 4.5);
      const h4 = Math.sin(2 * Math.PI * (f0 * 4.45) * t) * 0.15 * Math.exp(-t * 6.0);
      const ping = t < 0.004 ? Math.sin(2 * Math.PI * 3600 * t) * 0.35 : 0;
      data[i] = (h1 + h2 + h3 + h4 + ping) * 0.82;
    }
    return buffer;
  }

  private generateSoulOrgan(ctx: AudioContext): AudioBuffer {
    const sr = ctx.sampleRate;
    const dur = 1.1;
    const buffer = ctx.createBuffer(1, Math.floor(sr * dur), sr);
    const data = buffer.getChannelData(0);
    const f0 = 261.63; // C4

    for (let i = 0; i < data.length; i++) {
      const t = i / sr;
      const rotary = 1.0 + 0.12 * Math.sin(2 * Math.PI * 6.2 * t);
      const bar1 = Math.sin(2 * Math.PI * f0 * t);
      const bar2 = Math.sin(2 * Math.PI * (f0 * 2) * t) * 0.55;
      const bar3 = Math.sin(2 * Math.PI * (f0 * 3) * t) * 0.35;
      const keyClick = t < 0.005 ? (Math.random() * 2 - 1) * 0.3 : 0;
      const decay = Math.exp(-t * 2.2);
      data[i] = ((bar1 + bar2 + bar3) * 0.38 * rotary * decay + keyClick) * 0.86;
    }
    return buffer;
  }

  private generateFMPluckBell(ctx: AudioContext): AudioBuffer {
    const sr = ctx.sampleRate;
    const dur = 0.9;
    const buffer = ctx.createBuffer(1, Math.floor(sr * dur), sr);
    const data = buffer.getChannelData(0);
    const fc = 392.0; // G4 carrier
    const fm = 392.0 * 2.5; // Modulator

    for (let i = 0; i < data.length; i++) {
      const t = i / sr;
      const modIndex = 2.5 * Math.exp(-t * 7.0);
      const mod = Math.sin(2 * Math.PI * fm * t) * modIndex;
      const carrier = Math.sin(2 * Math.PI * fc * t + mod);
      const decay = Math.exp(-t * 3.2);
      data[i] = carrier * decay * 0.82;
    }
    return buffer;
  }

  private generateRainAmbience(ctx: AudioContext): AudioBuffer {
    const sr = ctx.sampleRate;
    const dur = 1.6;
    const buffer = ctx.createBuffer(1, Math.floor(sr * dur), sr);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < data.length; i++) {
      const t = i / sr;
      const wash = (Math.random() * 2 - 1) * 0.18;
      const drop = (i % 240 === 0 && Math.random() > 0.6) ? (Math.random() * 2 - 1) * 0.35 : 0;
      const env = Math.sin(Math.PI * Math.min(1.0, t / dur));
      data[i] = (wash + drop) * env * 0.85;
    }
    return buffer;
  }

  private generateCassetteClick(ctx: AudioContext): AudioBuffer {
    const sr = ctx.sampleRate;
    const dur = 0.28;
    const buffer = ctx.createBuffer(1, Math.floor(sr * dur), sr);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < data.length; i++) {
      const t = i / sr;
      const snap1 = t < 0.005 ? (Math.random() * 2 - 1) * 0.8 : 0;
      const plastic = Math.sin(2 * Math.PI * 1400 * t) * Math.exp(-t * 40) * 0.45;
      const latch = t >= 0.04 && t < 0.05 ? (Math.random() * 2 - 1) * 0.6 : 0;
      data[i] = (snap1 + plastic + latch) * 0.90;
    }
    return buffer;
  }

  private generateGlitchZap(ctx: AudioContext): AudioBuffer {
    const sr = ctx.sampleRate;
    const dur = 0.45;
    const buffer = ctx.createBuffer(1, Math.floor(sr * dur), sr);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < data.length; i++) {
      const t = i / sr;
      const sweep = 950 * Math.exp(-t * 12);
      const stepped = Math.floor(sweep / 80) * 80;
      const tone = Math.sin(2 * Math.PI * stepped * t);
      const grit = (Math.random() * 2 - 1) * 0.15;
      const env = Math.exp(-t * 6.5);
      data[i] = (tone * 0.85 + grit) * env * 0.88;
    }
    return buffer;
  }

  private generateParametricSound(ctx: AudioContext, sample: SampleRecord): AudioBuffer {
    const sr = ctx.sampleRate;
    const profile = sample.acousticProfile;
    const role = sample.role;
    const dur = Math.max(0.12, Math.min(profile?.duration || 0.45, 2.5));
    const buffer = ctx.createBuffer(1, Math.floor(sr * dur), sr);
    const data = buffer.getChannelData(0);

    let hash = 0;
    const str = sample.fileName || sample.id || 'sample';
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash |= 0;
    }
    const seed = Math.abs(hash);
    const varFactor = 0.88 + 0.24 * ((seed % 100) / 100);
    const basePitch = profile?.rootPitchHz || (role === 'Kick/Low' ? 52 : role === 'Snare/Snap' ? 205 : role === 'Hat/Air' ? 7600 : 220);
    const pitch = basePitch * varFactor;

    if (role === 'Kick/Low') {
      const arch = seed % 5;
      for (let i = 0; i < data.length; i++) {
        const t = i / sr;
        if (arch === 0) {
          // 808 Sub Boom
          const f = 34 + 110 * Math.exp(-t * 22);
          const click = t < 0.005 ? (Math.random() * 2 - 1) * 0.4 : 0;
          data[i] = Math.tanh(Math.sin(2 * Math.PI * f * t) * Math.exp(-t * 4.2) + click) * 0.94;
        } else if (arch === 1) {
          // Punchy SP1200 Kick
          const f = 56 + 180 * Math.exp(-t * 36);
          const click = t < 0.007 ? Math.sin(2 * Math.PI * 2200 * t) * 0.5 : 0;
          data[i] = (Math.sin(2 * Math.PI * f * t) * Math.exp(-t * 12) + click) * 0.9;
        } else if (arch === 2) {
          // Muffled 70s Felt Kick
          const f = 46 + 65 * Math.exp(-t * 26);
          const warmth = Math.sin(4 * Math.PI * f * t) * 0.15;
          data[i] = Math.tanh((Math.sin(2 * Math.PI * f * t) + warmth) * Math.exp(-t * 7.5) * 1.3) * 0.92;
        } else if (arch === 3) {
          // Club 909 Solid Kick
          const f = 48 + 260 * Math.exp(-t * 44);
          const beater = t < 0.006 ? Math.sin(2 * Math.PI * 1400 * t) * 0.45 : 0;
          data[i] = Math.tanh((Math.sin(2 * Math.PI * f * t) * Math.exp(-t * 9.5) + beater) * 1.25) * 0.93;
        } else {
          // Gritty Distorted 12-bit Kick
          const f = 50 + 150 * Math.exp(-t * 28);
          const raw = (Math.sin(2 * Math.PI * f * t) + (Math.random() * 2 - 1) * 0.12) * Math.exp(-t * 8);
          const crushed = Math.round(raw * 24) / 24;
          data[i] = Math.tanh(crushed * 1.5) * 0.9;
        }
      }
    } else if (role === 'Snare/Snap') {
      const arch = seed % 6;
      for (let i = 0; i < data.length; i++) {
        const t = i / sr;
        if (arch === 0) {
          // Tight Rimshot / Cross-Stick
          const f = 410 + 380 * Math.exp(-t * 75);
          const tone = Math.sin(2 * Math.PI * f * t) * Math.exp(-t * 36) * 0.75;
          const snap = (Math.random() * 2 - 1) * Math.exp(-t * 50) * 0.4;
          data[i] = (tone + snap) * 0.9;
        } else if (arch === 1) {
          // Fat 70s Dampened Snare
          const body = Math.sin(2 * Math.PI * (165 + 85 * Math.exp(-t * 32)) * t) * Math.exp(-t * 12) * 0.65;
          const wires = (Math.random() * 2 - 1) * Math.exp(-t * 10) * 0.38;
          data[i] = Math.tanh((body + wires) * 1.2) * 0.9;
        } else if (arch === 2) {
          // 808/909 Analog Snare
          const f1 = Math.sin(2 * Math.PI * 180 * t) * Math.exp(-t * 22) * 0.4;
          const f2 = Math.sin(2 * Math.PI * 335 * t) * Math.exp(-t * 26) * 0.3;
          const noise = (Math.random() * 2 - 1) * Math.exp(-t * 14) * 0.65;
          data[i] = (f1 + f2 + noise) * 0.88;
        } else if (arch === 3) {
          // Handclap / Finger Snap Stack (pre-bursts at 0ms, 11ms, 23ms)
          const p1 = t < 0.010 ? (Math.random() * 2 - 1) * 0.75 : 0;
          const p2 = (t >= 0.011 && t < 0.022) ? (Math.random() * 2 - 1) * 0.85 : 0;
          const p3 = t >= 0.023 ? (Math.random() * 2 - 1) * Math.exp(-(t - 0.023) * 18) * 0.9 : 0;
          const ring = Math.sin(2 * Math.PI * 1050 * t) * Math.exp(-t * 25) * 0.2;
          data[i] = (p1 + p2 + p3 + ring) * 0.88;
        } else if (arch === 4) {
          // Gritty SP1200 12-Bit Ringing Snare
          const body = Math.sin(2 * Math.PI * (215 + 130 * Math.exp(-t * 24)) * t) * Math.exp(-t * 16) * 0.5;
          const ring = Math.sin(2 * Math.PI * 460 * t) * Math.exp(-t * 20) * 0.25;
          const noise = (Math.random() * 2 - 1) * Math.exp(-t * 16) * 0.55;
          const raw = (body + ring + noise) * 1.3;
          data[i] = Math.tanh(Math.round(raw * 24) / 24) * 0.92;
        } else {
          // Lofi Vinyl Wire Crack Snare
          const crack = (Math.random() * 2 - 1) * Math.exp(-t * 22) * 0.75;
          const body = Math.sin(2 * Math.PI * 230 * t) * Math.exp(-t * 18) * 0.4;
          const grit = ((i % 12) === 0) ? (Math.random() * 2 - 1) * 0.2 : 0;
          data[i] = (crack + body + grit) * 0.9;
        }
      }
    } else if (role === 'Hat/Air') {
      const arch = seed % 6;
      for (let i = 0; i < data.length; i++) {
        const t = i / sr;
        if (arch === 0) {
          // Crisp Closed 808 Metallic Hat
          const m1 = Math.sin(2 * Math.PI * 245 * t);
          const m2 = Math.sin(2 * Math.PI * 384 * t);
          const m3 = Math.sin(2 * Math.PI * 705 * t);
          const cluster = ((m1 + m2 + m3) > 0 ? 0.35 : -0.35);
          const noise = (Math.random() * 2 - 1) * 0.65;
          const decay = Math.exp(-t * 52);
          data[i] = (cluster + noise) * decay * 0.85;
        } else if (arch === 1) {
          // Loose Sizzling Open Hat
          const noise = (Math.random() * 2 - 1) * 0.8;
          const shimmer = Math.sin(2 * Math.PI * 9200 * t) * 0.2;
          const decay = Math.exp(-t * (dur < 0.2 ? 32 : 8));
          data[i] = (noise + shimmer) * decay * 0.82;
        } else if (arch === 2) {
          // Lofi Vinyl Shaker / Tambourine (double pulse)
          const p1 = Math.exp(-t * 40);
          const p2 = t > (dur * 0.35) ? Math.exp(-(t - dur * 0.35) * 35) * 0.8 : 0;
          const noise = (Math.random() * 2 - 1) * 0.75;
          const jingle = Math.sin(2 * Math.PI * 6800 * t) * 0.2;
          data[i] = (noise + jingle) * (p1 + p2) * 0.8;
        } else if (arch === 3) {
          // Pedal Foot Hat / Contact Click
          const click = Math.sin(2 * Math.PI * 1400 * t) * Math.exp(-t * 110) * 0.45;
          const air = (Math.random() * 2 - 1) * Math.exp(-t * 42) * 0.65;
          data[i] = (click + air) * 0.85;
        } else if (arch === 4) {
          // Ride Cymbal Bell Ping
          const b1 = Math.sin(2 * Math.PI * 2150 * t) * 0.5;
          const b2 = Math.sin(2 * Math.PI * 3820 * t) * 0.3;
          const b3 = Math.sin(2 * Math.PI * 6100 * t) * 0.2;
          const air = (Math.random() * 2 - 1) * 0.25;
          const decay = Math.exp(-t * (dur < 0.3 ? 24 : 5.5));
          data[i] = (b1 + b2 + b3 + air) * decay * 0.84;
        } else {
          // Modulated Flutter Hat
          const flutter = 1 + 0.35 * Math.sin(2 * Math.PI * 130 * t);
          const noise = (Math.random() * 2 - 1) * 0.85;
          const decay = Math.exp(-t * 36);
          data[i] = noise * flutter * decay * 0.8;
        }
      }
    } else if (role === 'Tonal/Melodic') {
      const arch = seed % 5;
      for (let i = 0; i < data.length; i++) {
        const t = i / sr;
        if (arch === 0) {
          // Rhodes / Electric Piano Bell
          const f0 = Math.sin(2 * Math.PI * pitch * t);
          const f2 = Math.sin(6 * Math.PI * pitch * t) * 0.22 * Math.exp(-t * 14);
          const trem = 1 + 0.12 * Math.sin(2 * Math.PI * 5.5 * t);
          data[i] = (f0 + f2) * trem * Math.exp(-t * 2.6) * 0.85;
        } else if (arch === 1) {
          // Plucked Kalimba / Wooden Marimba
          const mallet = t < 0.008 ? Math.sin(2 * Math.PI * 900 * t) * 0.4 : 0;
          const f0 = Math.sin(2 * Math.PI * pitch * t);
          const f1 = Math.sin(4 * Math.PI * pitch * t) * 0.18;
          data[i] = (f0 + f1 + mallet) * Math.exp(-t * 4.2) * 0.88;
        } else if (arch === 2) {
          // Analog Bass / Synth Pluck
          const cutoff = Math.exp(-t * 6.5);
          const saw = (2 * ((pitch * t) % 1) - 1);
          const sub = Math.sin(2 * Math.PI * (pitch * 0.5) * t) * 0.5;
          data[i] = Math.tanh((saw * cutoff + sub) * 1.3) * Math.exp(-t * 2.2) * 0.86;
        } else if (arch === 3) {
          // Ethereal Flute / Whistle
          const vib = Math.sin(2 * Math.PI * 5 * t) * (pitch * 0.02);
          const f0 = Math.sin(2 * Math.PI * (pitch + vib) * t);
          const breath = (Math.random() * 2 - 1) * 0.12;
          const attack = Math.min(1.0, t / 0.04);
          data[i] = (f0 + breath) * attack * Math.exp(-t * 2.0) * 0.85;
        } else {
          // Vibraphone / Glass Chime
          const f0 = Math.sin(2 * Math.PI * pitch * t);
          const f1 = Math.sin(2 * Math.PI * pitch * 2.76 * t) * 0.28;
          const f2 = Math.sin(2 * Math.PI * pitch * 5.40 * t) * 0.15;
          data[i] = (f0 + f1 + f2) * Math.exp(-t * 2.4) * 0.82;
        }
      }
    } else {
      // Texture/Wildcard: 8 completely distinct, non-overlapping archetypes
      const arch = seed % 8;
      for (let i = 0; i < data.length; i++) {
        const t = i / sr;
        if (arch === 0) {
          // 1. Vinyl Crackle & Dust Pop Cluster
          const popInterval = 450 + (seed % 650);
          const pop = ((i % popInterval) === 0 && Math.random() > 0.3) ? (Math.random() * 2 - 1) * 0.75 : 0;
          const hiss = (Math.random() * 2 - 1) * 0.16;
          const rumble = Math.sin(2 * Math.PI * 36 * t) * 0.12;
          const env = Math.exp(-t * 2.2);
          data[i] = (pop + hiss + rumble) * env * 0.88;
        } else if (arch === 1) {
          // 2. Cassette Tape Hiss & Motor Flutter
          const flutter = 1 + 0.2 * Math.sin(2 * Math.PI * 4.2 * t);
          const hiss = (Math.random() * 2 - 1) * 0.45 * flutter;
          const hum = Math.sin(2 * Math.PI * 60 * t) * 0.08;
          const env = Math.min(1.0, t / 0.02) * Math.exp(-t * 1.8);
          data[i] = Math.tanh((hiss + hum) * 1.4) * env * 0.85;
        } else if (arch === 2) {
          // 3. Resonant Metal / Bell Rim Ping
          const f1 = 820 + (seed % 300);
          const f2 = f1 * 1.48;
          const f3 = f1 * 2.35;
          const tone = Math.sin(2 * Math.PI * f1 * t) * 0.5 + Math.sin(2 * Math.PI * f2 * t) * 0.3 + Math.sin(2 * Math.PI * f3 * t) * 0.2;
          data[i] = tone * Math.exp(-t * 7.5) * 0.86;
        } else if (arch === 3) {
          // 4. Deep Room Foley / Wood Knock
          const knock = Math.sin(2 * Math.PI * (135 + 240 * Math.exp(-t * 55)) * t) * Math.exp(-t * 24);
          const air = (Math.random() * 2 - 1) * Math.exp(-t * 14) * 0.25;
          data[i] = (knock * 0.85 + air) * 0.9;
        } else if (arch === 4) {
          // 5. Descending Pitch Drop / Sub Zap
          const f = 75 + 1200 * Math.exp(-t * 20);
          const zap = Math.sin(2 * Math.PI * f * t);
          data[i] = zap * Math.exp(-t * 7.0) * 0.9;
        } else if (arch === 5) {
          // 6. Tape Stop / Glitch Stutter
          const slowdown = Math.max(0.01, 1 - (t / dur));
          const f = (380 + (seed % 180)) * slowdown;
          const tone = Math.sin(2 * Math.PI * f * t);
          const grit = ((i % 14) === 0) ? (Math.random() * 2 - 1) * 0.3 : 0;
          const crushed = Math.round((tone + grit) * 16) / 16;
          data[i] = Math.tanh(crushed * 1.3) * 0.88;
        } else if (arch === 6) {
          // 7. Granular Noise Burst / Rain Droplet
          const grainInterval = 900 + (seed % 800);
          const inGrain = (i % grainInterval) < 180;
          const grainPitch = 1200 + ((seed * 13) % 2400);
          const drop = inGrain ? Math.sin(2 * Math.PI * grainPitch * t) * 0.6 : 0;
          const ambient = (Math.random() * 2 - 1) * 0.15;
          data[i] = (drop + ambient) * Math.exp(-t * 3.5) * 0.85;
        } else {
          // 8. Ascending Harmonic Shimmer Sweep
          const f0 = 320 + (seed % 240);
          const sweep = (f0 + 600 * (t / dur));
          const s1 = Math.sin(2 * Math.PI * sweep * t) * 0.45;
          const s2 = Math.sin(3 * Math.PI * sweep * t) * 0.25;
          const air = (Math.random() * 2 - 1) * 0.18;
          data[i] = (s1 + s2 + air) * Math.sin(Math.PI * Math.min(1.0, t / dur)) * 0.85;
        }
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

