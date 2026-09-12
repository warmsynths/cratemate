import type { AcousticProfile, FrequencyEnergyBalance } from '../types/index.ts';

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

// Camelot Wheel mapping for root notes
// Assumes default minor key for bass/synth loops or provides standard Camelot tag
const ROOT_TO_CAMELOT_MINOR: Record<string, string> = {
  'G#': '1A', 'Ab': '1A',
  'D#': '2A', 'Eb': '2A',
  'A#': '3A', 'Bb': '3A',
  'F':  '4A',
  'C':  '5A',
  'G':  '6A',
  'D':  '7A',
  'A':  '8A',
  'E':  '9A',
  'B':  '10A',
  'F#': '11A', 'Gb': '11A',
  'C#': '12A', 'Db': '12A'
};

const ROOT_TO_CAMELOT_MAJOR: Record<string, string> = {
  'B':  '1B',
  'F#': '2B', 'Gb': '2B',
  'C#': '3B', 'Db': '3B',
  'G#': '4B', 'Ab': '4B',
  'D#': '5B', 'Eb': '5B',
  'A#': '6B', 'Bb': '6B',
  'F':  '7B',
  'C':  '8B',
  'G':  '9B',
  'D':  '10B',
  'A':  '11B',
  'E':  '12B'
};

export function frequencyToNote(freq: number): { note: string; octave: number; cents: number; fullNote: string } {
  const midi = 69 + 12 * Math.log2(freq / 440);
  const roundedMidi = Math.round(midi);
  const noteIndex = ((roundedMidi % 12) + 12) % 12;
  const octave = Math.floor(roundedMidi / 12) - 1;
  const cents = Math.round((midi - roundedMidi) * 100);
  const note = NOTE_NAMES[noteIndex];
  return {
    note,
    octave,
    cents,
    fullNote: `${note}${octave}`
  };
}

export function noteToCamelot(noteName: string, isMajor: boolean = false): string {
  const cleanNote = noteName.replace(/[0-9\-]/g, '');
  if (isMajor) {
    return ROOT_TO_CAMELOT_MAJOR[cleanNote] || '8B';
  }
  return ROOT_TO_CAMELOT_MINOR[cleanNote] || '8A';
}

/**
 * Extract 64-point peak waveform envelope from audio buffer
 */
export function extractWaveformBins(channelData: Float32Array, binCount = 64): number[] {
  const bins: number[] = new Array(binCount).fill(0);
  const step = Math.floor(channelData.length / binCount);
  if (step <= 0) {
    for (let i = 0; i < Math.min(channelData.length, binCount); i++) {
      bins[i] = Math.abs(channelData[i]);
    }
    return bins;
  }

  let maxPeak = 0.0001;
  for (let b = 0; b < binCount; b++) {
    const start = b * step;
    const end = Math.min(start + step, channelData.length);
    let peak = 0;
    for (let i = start; i < end; i++) {
      const val = Math.abs(channelData[i]);
      if (val > peak) peak = val;
    }
    bins[b] = peak;
    if (peak > maxPeak) maxPeak = peak;
  }

  // Normalize so highest peak is 1.0
  return bins.map(v => Math.min(1.0, +(v / maxPeak).toFixed(3)));
}

/**
 * Compute transient sharpness and rise time
 */
export function computeTransientMetrics(channelData: Float32Array, sampleRate: number): {
  attackRiseMs: number;
  crestFactorDb: number;
  transientSharpness: number;
} {
  let peakVal = 0;
  let sumSquares = 0;
  const length = channelData.length;

  for (let i = 0; i < length; i++) {
    const absVal = Math.abs(channelData[i]);
    if (absVal > peakVal) peakVal = absVal;
    sumSquares += absVal * absVal;
  }

  if (peakVal < 0.0001) {
    return { attackRiseMs: 100, crestFactorDb: 0, transientSharpness: 0 };
  }

  const rms = Math.sqrt(sumSquares / length);
  const crestFactorDb = 20 * Math.log10(peakVal / (rms + 1e-6));

  // Find onset (where signal exceeds 5% of peak)
  const onsetThreshold = peakVal * 0.05;
  const peakThreshold = peakVal * 0.90;
  let onsetIndex = 0;
  let peakIndex = 0;

  for (let i = 0; i < length; i++) {
    if (Math.abs(channelData[i]) >= onsetThreshold) {
      onsetIndex = i;
      break;
    }
  }

  for (let i = onsetIndex; i < length; i++) {
    if (Math.abs(channelData[i]) >= peakThreshold) {
      peakIndex = i;
      break;
    }
  }

  const riseSamples = Math.max(1, peakIndex - onsetIndex);
  const attackRiseMs = (riseSamples / sampleRate) * 1000;

  // Sharpness score 0-100
  // Fast rise (< 4ms) + high crest factor (> 14dB) => near 100
  const riseScore = Math.max(0, 100 - (attackRiseMs * 4)); // 5ms => 80, 20ms => 20
  const crestScore = Math.min(100, Math.max(0, (crestFactorDb - 6) * 5)); // 6dB => 0, 26dB => 100
  const transientSharpness = Math.round(Math.min(100, Math.max(0, (riseScore * 0.6) + (crestScore * 0.4))));

  return {
    attackRiseMs: +attackRiseMs.toFixed(2),
    crestFactorDb: +crestFactorDb.toFixed(1),
    transientSharpness
  };
}

/**
 * Approximate tri-band frequency energy balance using fast multi-band filter simulation
 */
export function computeFrequencyEnergyBalance(
  channelData: Float32Array,
  sampleRate: number
): FrequencyEnergyBalance {
  // Use a fast FFT or 3-band filter simulation
  // Take up to 16384 samples for speed
  const maxSamples = Math.min(channelData.length, 16384);
  
  // Simple RC/biquad approximations for Low (< 250Hz) and High (> 4000Hz)
  // Low-pass filter coefficient for 250Hz:
  const dt = 1 / sampleRate;
  const rcLow = 1 / (2 * Math.PI * 250);
  const alphaLow = dt / (rcLow + dt);

  // High-pass filter coefficient for 4000Hz:
  const rcHigh = 1 / (2 * Math.PI * 4000);
  const alphaHigh = rcHigh / (rcHigh + dt);

  let lowEnergy = 0;
  let highEnergy = 0;
  let totalEnergy = 0;

  let lowPrev = 0;
  let highPrevIn = 0;
  let highPrevOut = 0;

  for (let i = 0; i < maxSamples; i++) {
    const x = channelData[i];
    const xSq = x * x;
    totalEnergy += xSq;

    // Low-pass
    lowPrev = lowPrev + alphaLow * (x - lowPrev);
    lowEnergy += lowPrev * lowPrev;

    // High-pass
    highPrevOut = alphaHigh * (highPrevOut + x - highPrevIn);
    highPrevIn = x;
    highEnergy += highPrevOut * highPrevOut;
  }

  if (totalEnergy < 1e-8) {
    return { low: 0.33, mid: 0.34, high: 0.33 };
  }

  // Mid is remaining energy
  let midEnergy = Math.max(0, totalEnergy - (lowEnergy + highEnergy));
  
  // Normalize
  const sum = lowEnergy + midEnergy + highEnergy;
  if (sum < 1e-8) {
    return { low: 0.33, mid: 0.34, high: 0.33 };
  }

  return {
    low: +(lowEnergy / sum).toFixed(3),
    mid: +(midEnergy / sum).toFixed(3),
    high: +(highEnergy / sum).toFixed(3)
  };
}

/**
 * Normalized autocorrelation pitch detector (YIN-derived algorithm)
 * Finds fundamental frequency f0 between minFreq (30 Hz) and maxFreq (2000 Hz)
 */
export function detectPitchYIN(
  channelData: Float32Array,
  sampleRate: number,
  minFreq = 35,
  maxFreq = 1800
): { rootPitchHz?: number; confidence: number } {
  // Start analysis after transient onset (e.g. skip first 10-20ms if sample is long enough)
  const skipSamples = Math.min(Math.floor(sampleRate * 0.015), Math.floor(channelData.length * 0.1));
  const windowSize = Math.min(4096, channelData.length - skipSamples);

  if (windowSize < 512) {
    return { confidence: 0 };
  }

  const minTau = Math.floor(sampleRate / maxFreq);
  const maxTau = Math.min(Math.floor(sampleRate / minFreq), Math.floor(windowSize / 2));

  // Difference function d(tau)
  const d = new Float32Array(maxTau + 1);
  for (let tau = minTau; tau <= maxTau; tau++) {
    let diff = 0;
    for (let i = 0; i < windowSize / 2; i++) {
      const delta = channelData[skipSamples + i] - channelData[skipSamples + i + tau];
      diff += delta * delta;
    }
    d[tau] = diff;
  }

  // Cumulative mean normalized difference d'(tau)
  const dPrime = new Float32Array(maxTau + 1);
  dPrime[0] = 1;
  let runningSum = 0;

  for (let tau = 1; tau <= maxTau; tau++) {
    runningSum += d[tau];
    dPrime[tau] = runningSum > 0 ? (d[tau] * tau) / runningSum : 1;
  }

  // Find lowest tau with dPrime below threshold
  const threshold = 0.22;
  let bestTau = -1;

  for (let tau = minTau; tau <= maxTau; tau++) {
    if (dPrime[tau] < threshold) {
      while (tau + 1 <= maxTau && dPrime[tau + 1] < dPrime[tau]) {
        tau++;
      }
      bestTau = tau;
      break;
    }
  }

  if (bestTau === -1) {
    // If no tau dropped below threshold, find global minimum
    let minVal = 1.0;
    for (let tau = minTau; tau <= maxTau; tau++) {
      if (dPrime[tau] < minVal) {
        minVal = dPrime[tau];
        bestTau = tau;
      }
    }
    // If global minimum is still too noisy, reject pitch
    if (minVal > 0.45) {
      return { confidence: +(1 - minVal).toFixed(2) };
    }
  }

  // Parabolic interpolation for sub-sample accuracy
  let refinedTau = bestTau;
  if (bestTau > minTau && bestTau < maxTau) {
    const s0 = dPrime[bestTau - 1];
    const s1 = dPrime[bestTau];
    const s2 = dPrime[bestTau + 1];
    const denom = 2 * (s0 - 2 * s1 + s2);
    if (Math.abs(denom) > 1e-6) {
      const shift = (s0 - s2) / denom;
      refinedTau = bestTau + shift;
    }
  }

  const rootPitchHz = +(sampleRate / refinedTau).toFixed(1);
  const confidence = +Math.max(0, Math.min(1, 1 - dPrime[bestTau])).toFixed(2);

  return { rootPitchHz, confidence };
}

/**
 * Compute full acoustic profile for an AudioBuffer
 */
export function computeAcousticProfile(audioBuffer: AudioBuffer): AcousticProfile {
  const duration = +audioBuffer.duration.toFixed(2);
  const sampleRate = audioBuffer.sampleRate;
  
  // Combine channels to mono for analysis
  const channelCount = audioBuffer.numberOfChannels;
  const length = audioBuffer.length;
  const monoData = new Float32Array(length);

  for (let c = 0; c < channelCount; c++) {
    const data = audioBuffer.getChannelData(c);
    for (let i = 0; i < length; i++) {
      monoData[i] += data[i] / channelCount;
    }
  }

  const waveformBins = extractWaveformBins(monoData, 64);
  const transient = computeTransientMetrics(monoData, sampleRate);
  const energyBalance = computeFrequencyEnergyBalance(monoData, sampleRate);
  const pitchResult = detectPitchYIN(monoData, sampleRate);

  let rootKey: string | undefined;
  let camelotKey: string | undefined;
  let isMelodic = false;

  if (pitchResult.rootPitchHz && pitchResult.confidence >= 0.55 && duration >= 0.12) {
    const noteInfo = frequencyToNote(pitchResult.rootPitchHz);
    rootKey = noteInfo.fullNote;
    camelotKey = noteToCamelot(noteInfo.note, false);
    isMelodic = pitchResult.confidence >= 0.65;
  }

  return {
    duration,
    transientSharpness: transient.transientSharpness,
    attackRiseMs: transient.attackRiseMs,
    crestFactorDb: transient.crestFactorDb,
    energyBalance,
    rootPitchHz: pitchResult.rootPitchHz,
    rootKey,
    camelotKey,
    pitchConfidence: pitchResult.confidence,
    isMelodic,
    waveformBins
  };
}
