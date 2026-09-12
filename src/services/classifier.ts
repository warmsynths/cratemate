import type { AcousticProfile, SampleRole } from '../types/index.ts';

const KICK_REGEX = /\b(kick|kik|bd|bassdrum|sub|808_?kick|foot)\b/i;
const SNARE_REGEX = /\b(snare|snr|sd|clap|clp|rim|rimshot|snap|crossstick)\b/i;
const HAT_REGEX = /\b(hat|hh|hihat|hi-?hat|open-?hat|closed-?hat|oh|ch|cymbal|cymb|ride|crash|shaker|tamb|tambourine)\b/i;
const TONAL_REGEX = /\b(synth|lead|melody|chord|pad|key|keys|piano|pluck|rhodes|bass|bassline|flute|guitar|harp|organ|sax|trumpet|horn|vocal|vox|acapella|adlib|tonal|root|arp)\b/i;
const TEXTURE_REGEX = /\b(fx|foley|sweep|riser|fall|downlifter|uplifter|noise|vinyl|ambient|atmo|atmosphere|texture|scratch|drone|glitch|impact|whoosh)\b/i;

export function classifySampleRole(fileName: string, profile: AcousticProfile): { role: SampleRole; tags: string[] } {
  const tags: string[] = [];
  const cleanName = fileName.toLowerCase().replace(/[-_.]/g, ' ');

  // Detect filename cues
  const hasKickName = KICK_REGEX.test(cleanName);
  const hasSnareName = SNARE_REGEX.test(cleanName);
  const hasHatName = HAT_REGEX.test(cleanName);
  const hasTonalName = TONAL_REGEX.test(cleanName);
  const hasTextureName = TEXTURE_REGEX.test(cleanName);

  if (hasKickName) tags.push('kick-cue');
  if (hasSnareName) tags.push('snare-cue');
  if (hasHatName) tags.push('hat-cue');
  if (hasTonalName) tags.push('tonal-cue');
  if (hasTextureName) tags.push('texture-cue');

  const { duration, transientSharpness, energyBalance, pitchConfidence, isMelodic, rootKey } = profile;
  const { low, mid, high } = energyBalance;

  if (rootKey && isMelodic) {
    tags.push(`key:${rootKey}`);
  }

  // Rule 1: Clear Melodic / Tonal Loops or One-shots
  // If sustained and strong pitch periodicity
  if ((isMelodic && pitchConfidence >= 0.70 && duration >= 0.35) || (hasTonalName && pitchConfidence >= 0.50)) {
    if (low >= 0.55 && duration >= 0.25) {
      tags.push('bass');
    } else {
      tags.push('melodic');
    }
    return { role: 'Tonal/Melodic', tags };
  }

  // Rule 2: Filename override if acoustic features are compatible
  if (hasKickName && (low >= 0.28 || duration <= 1.5)) {
    tags.push('kick');
    return { role: 'Kick/Low', tags };
  }

  if (hasSnareName && (mid >= 0.25 || transientSharpness >= 35)) {
    tags.push('snare');
    return { role: 'Snare/Snap', tags };
  }

  if (hasHatName && (high >= 0.25 || low <= 0.20)) {
    tags.push('hat');
    return { role: 'Hat/Air', tags };
  }

  if (hasTextureName) {
    tags.push('texture');
    return { role: 'Texture/Wildcard', tags };
  }

  // Rule 3: Pure Acoustic Classification (No or Ambiguous Filename Cues)
  // Kick/Low: High low frequency, fast punch, medium duration
  if (low >= 0.45 && duration <= 2.0 && high <= 0.25) {
    tags.push('acoustic-kick');
    return { role: 'Kick/Low', tags };
  }

  // Hat/Air: High frequency dominant, low bass, fast attack
  if (high >= 0.42 && low <= 0.18) {
    tags.push('acoustic-hat');
    return { role: 'Hat/Air', tags };
  }

  // Snare/Snap: Strong mid energy, high transient sharpness, short decay
  if (mid >= 0.40 && transientSharpness >= 45 && duration <= 1.5) {
    tags.push('acoustic-snare');
    return { role: 'Snare/Snap', tags };
  }

  // Tonal / Bass if periodic and has key
  if (pitchConfidence >= 0.60 && duration >= 0.2) {
    tags.push('acoustic-tonal');
    return { role: 'Tonal/Melodic', tags };
  }

  // Long sounds or atmospheric sweeps
  if (duration >= 2.5 || transientSharpness <= 25) {
    tags.push('acoustic-texture');
    return { role: 'Texture/Wildcard', tags };
  }

  // Default fallback based on highest frequency band
  if (low > mid && low > high) {
    return { role: 'Kick/Low', tags: [...tags, 'fallback-low'] };
  } else if (high > low && high > mid) {
    return { role: 'Hat/Air', tags: [...tags, 'fallback-high'] };
  } else if (mid > low && mid > high && transientSharpness > 40) {
    return { role: 'Snare/Snap', tags: [...tags, 'fallback-mid'] };
  }

  return { role: 'Texture/Wildcard', tags: [...tags, 'wildcard'] };
}
