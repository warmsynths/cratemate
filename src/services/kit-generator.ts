import { storage } from './storage.ts';
import { FACTORY_ROLE_TEMPLATES, FACTORY_PRESETS, DEFAULT_PRESET_ID, mergeCriteria } from './presets.ts';
import { 
  getCamelotFromRoot, 
  getMusicalKeyDef, 
  getHarmonicMatches, 
  calculateSemitoneShift 
} from './musical-keys.ts';
import type { AcousticCriteria, Kit, PadCount, PadSlot, SampleRecord, SampleRole } from '../types/index.ts';

const QWERTY_KEYS_16 = ['1', '2', '3', '4', 'Q', 'W', 'E', 'R', 'A', 'S', 'D', 'F', 'Z', 'X', 'C', 'V'];
const NUMBER_KEYS_16 = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '-', '=', 'A', 'B', 'C', 'D'];

export interface FactoryDemoSound {
  fileName: string;
  role: SampleRole;
  duration: number;
  pitchHz?: number;
  note?: string;
  camelot?: string;
  sharpness: number;
}

export const FACTORY_DEMO_LIBRARY: FactoryDemoSound[] = [
  // Kick/Low (9 distinct acoustic profiles)
  { fileName: 'Dusty Kick 04.wav', role: 'Kick/Low', duration: 0.42, pitchHz: 52, note: 'G#1', sharpness: 78 },
  { fileName: 'Tape Kick 07.wav', role: 'Kick/Low', duration: 0.51, pitchHz: 46, note: 'F#1', sharpness: 74 },
  { fileName: 'Room Kick 11.wav', role: 'Kick/Low', duration: 0.62, pitchHz: 58, note: 'A#1', sharpness: 80 },
  { fileName: 'Sub Boom A.wav', role: 'Kick/Low', duration: 1.15, pitchHz: 38, note: 'D#1', sharpness: 68 },
  { fileName: 'Thud Kick 02.wav', role: 'Kick/Low', duration: 0.38, pitchHz: 61, note: 'B1', sharpness: 84 },
  { fileName: 'Felt Kick 09.wav', role: 'Kick/Low', duration: 0.47, pitchHz: 55, note: 'A1', sharpness: 72 },
  { fileName: '808 Deep Punch.wav', role: 'Kick/Low', duration: 0.65, pitchHz: 42, note: 'E1', sharpness: 88 },
  { fileName: 'Clean Club BD.wav', role: 'Kick/Low', duration: 0.35, pitchHz: 56, note: 'A#1', sharpness: 82 },
  { fileName: 'Raw 909 Kick.wav', role: 'Kick/Low', duration: 0.40, pitchHz: 60, note: 'B1', sharpness: 86 },

  // Snare/Snap (9 distinct acoustic profiles)
  { fileName: 'Vinyl Snare 12.wav', role: 'Snare/Snap', duration: 0.22, pitchHz: 190, note: 'F#3', sharpness: 88 },
  { fileName: 'Snare Dust 09.wav', role: 'Snare/Snap', duration: 0.25, pitchHz: 168, note: 'E3', sharpness: 82 },
  { fileName: 'Rim Snap W.wav', role: 'Snare/Snap', duration: 0.14, pitchHz: 320, note: 'E4', sharpness: 94 },
  { fileName: 'Brush Snare A.wav', role: 'Snare/Snap', duration: 0.28, pitchHz: 210, note: 'G#3', sharpness: 76 },
  { fileName: 'Clap Stack B.wav', role: 'Snare/Snap', duration: 0.24, pitchHz: 240, note: 'B3', sharpness: 90 },
  { fileName: 'Cross Stick 3.wav', role: 'Snare/Snap', duration: 0.12, pitchHz: 380, note: 'F#4', sharpness: 95 },
  { fileName: 'Crisp 90s Snare.wav', role: 'Snare/Snap', duration: 0.26, pitchHz: 185, note: 'F#3', sharpness: 89 },
  { fileName: 'Layered Rim Clap.wav', role: 'Snare/Snap', duration: 0.21, pitchHz: 260, note: 'C4', sharpness: 92 },
  { fileName: 'Ghost Snare 04.wav', role: 'Snare/Snap', duration: 0.19, pitchHz: 195, note: 'G3', sharpness: 80 },

  // Hat/Air (9 distinct acoustic profiles)
  { fileName: 'Closed Hat A.wav', role: 'Hat/Air', duration: 0.08, pitchHz: 9000, sharpness: 94 },
  { fileName: 'Open Hat 03.wav', role: 'Hat/Air', duration: 0.38, pitchHz: 7600, sharpness: 88 },
  { fileName: 'Shaker Loop 2.wav', role: 'Hat/Air', duration: 0.45, pitchHz: 6200, sharpness: 80 },
  { fileName: 'Tamb Hit 02.wav', role: 'Hat/Air', duration: 0.20, pitchHz: 8200, sharpness: 92 },
  { fileName: 'Pedal Hat 06.wav', role: 'Hat/Air', duration: 0.13, pitchHz: 7000, sharpness: 86 },
  { fileName: 'Ride Tip A.wav', role: 'Hat/Air', duration: 0.65, pitchHz: 5400, sharpness: 78 },
  { fileName: 'Sizzle HiHat.wav', role: 'Hat/Air', duration: 0.28, pitchHz: 8400, sharpness: 91 },
  { fileName: 'Half Open HH.wav', role: 'Hat/Air', duration: 0.22, pitchHz: 8000, sharpness: 89 },
  { fileName: 'Organic Shaker Loop.wav', role: 'Hat/Air', duration: 0.32, pitchHz: 6500, sharpness: 82 },

  // Tonal/Melodic (11 distinct acoustic profiles & Camelot wheel spread)
  { fileName: 'Rhodes Am 90.wav', role: 'Tonal/Melodic', duration: 1.4, pitchHz: 220, note: 'A3', camelot: '8A', sharpness: 45 },
  { fileName: 'Upright Bass C2.wav', role: 'Tonal/Melodic', duration: 1.1, pitchHz: 65, note: 'C2', camelot: '5A', sharpness: 60 },
  { fileName: 'Moog Sub C.wav', role: 'Tonal/Melodic', duration: 1.2, pitchHz: 49, note: 'G1', camelot: '6A', sharpness: 70 },
  { fileName: 'Wurli Stab.wav', role: 'Tonal/Melodic', duration: 1.0, pitchHz: 293, note: 'D4', camelot: '10A', sharpness: 55 },
  { fileName: 'Clav Chop 7.wav', role: 'Tonal/Melodic', duration: 0.65, pitchHz: 330, note: 'E4', camelot: '9A', sharpness: 68 },
  { fileName: 'Flute Loop C.wav', role: 'Tonal/Melodic', duration: 1.2, pitchHz: 392, note: 'G4', camelot: '9B', sharpness: 40 },
  { fileName: 'Vocal Chop A4.wav', role: 'Tonal/Melodic', duration: 0.55, pitchHz: 440, note: 'A4', camelot: '8A', sharpness: 50 },
  { fileName: 'Tape EPiano Dm.wav', role: 'Tonal/Melodic', duration: 1.3, pitchHz: 293, note: 'D4', camelot: '7A', sharpness: 48 },
  { fileName: 'Bell Chime C.wav', role: 'Tonal/Melodic', duration: 1.0, pitchHz: 523, note: 'C5', camelot: '8B', sharpness: 65 },
  { fileName: 'Soul Organ Hit.wav', role: 'Tonal/Melodic', duration: 1.1, pitchHz: 261, note: 'C4', camelot: '5A', sharpness: 52 },
  { fileName: 'FM Pluck Bell.wav', role: 'Tonal/Melodic', duration: 0.9, pitchHz: 392, note: 'G4', camelot: '6A', sharpness: 72 },

  // Texture/Wildcard (10 distinct acoustic profiles)
  { fileName: 'Vinyl Crackle.wav', role: 'Texture/Wildcard', duration: 1.5, pitchHz: 2400, sharpness: 30 },
  { fileName: 'Hiss Bed.wav', role: 'Texture/Wildcard', duration: 1.8, pitchHz: 3600, sharpness: 25 },
  { fileName: 'Room Foley A.wav', role: 'Texture/Wildcard', duration: 0.8, pitchHz: 1500, sharpness: 65 },
  { fileName: 'Tape Stop Hiss.wav', role: 'Texture/Wildcard', duration: 1.1, pitchHz: 2800, sharpness: 40 },
  { fileName: 'Dust Loop 4.wav', role: 'Texture/Wildcard', duration: 1.4, pitchHz: 1900, sharpness: 35 },
  { fileName: 'Foley Click Drop.wav', role: 'Texture/Wildcard', duration: 0.35, pitchHz: 1200, sharpness: 85 },
  { fileName: 'Space Sweep FX.wav', role: 'Texture/Wildcard', duration: 0.95, pitchHz: 850, sharpness: 55 },
  { fileName: 'Rain Ambience.wav', role: 'Texture/Wildcard', duration: 1.6, pitchHz: 2200, sharpness: 28 },
  { fileName: 'Cassette Click.wav', role: 'Texture/Wildcard', duration: 0.28, pitchHz: 1400, sharpness: 88 },
  { fileName: 'Glitch Zap.wav', role: 'Texture/Wildcard', duration: 0.45, pitchHz: 950, sharpness: 75 }
];

/**
 * Get harmonically compatible Camelot keys
 * (Same key, +/- 1 step on the wheel, or relative major/minor)
 */
export function getCompatibleCamelotKeys(camelotKey: string): string[] {
  const match = camelotKey.match(/^(\d{1,2})([AB])$/);
  if (!match) return [camelotKey];

  const num = parseInt(match[1], 10);
  const letter = match[2]; // 'A' or 'B'
  const oppositeLetter = letter === 'A' ? 'B' : 'A';

  const prevNum = num === 1 ? 12 : num - 1;
  const nextNum = num === 12 ? 1 : num + 1;

  return [
    `${num}${letter}`,            // exact key
    `${prevNum}${letter}`,        // 1 step counter-clockwise (fourth)
    `${nextNum}${letter}`,        // 1 step clockwise (fifth)
    `${num}${oppositeLetter}`     // relative major/minor
  ];
}

/**
 * Universal de-duplication helper to check if a sample or file has already been assigned to another pad
 */
export function isSamplePicked(
  s: { id?: string; fileName?: string },
  alreadyPicked: Set<string>,
  avoidFileName?: string
): boolean {
  if (avoidFileName && s.fileName && s.fileName.toLowerCase() === avoidFileName.toLowerCase()) {
    return true;
  }
  if (s.id && alreadyPicked.has(s.id)) return true;
  if (s.fileName && alreadyPicked.has(s.fileName)) return true;
  if (s.fileName) {
    const clean = s.fileName.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
    for (const picked of alreadyPicked) {
      const pickedLower = picked.toLowerCase();
      if (pickedLower === clean || pickedLower.includes(clean)) return true;
    }
  }
  return false;
}

/**
 * Register a chosen sample in the de-duplication tracker
 */
export function markSamplePicked(
  s: { id?: string; fileName?: string },
  alreadyPicked: Set<string>
): void {
  if (s.id) alreadyPicked.add(s.id);
  if (s.fileName) {
    alreadyPicked.add(s.fileName);
    alreadyPicked.add(s.fileName.replace(/[^a-zA-Z0-9]/g, '_'));
  }
}

/**
 * Multi-factor acoustic & semantic score for ranking candidate samples against criteria and kit context
 */
export function scoreCandidate(
  sample: SampleRecord,
  targetRole: SampleRole,
  criteria: AcousticCriteria,
  effectiveKey?: string,
  contextPads: PadSlot[] = []
): number {
  let score = 50;
  const profile = sample.acousticProfile;
  const roleProfile = criteria.roleProfiles?.[targetRole];

  // 1. Role-Specific Duration Bounds (modulated by macroLength)
  const lengthMacro = (criteria.macroLength ?? 50) / 50; // 0 to 2
  const minDur = roleProfile?.durationMin ?? criteria.durationMin;
  const maxDur = roleProfile?.durationMax ?? criteria.durationMax;

  const effectiveMinDur = minDur !== undefined ? minDur * Math.min(1.0, lengthMacro) : undefined;
  const effectiveMaxDur = maxDur !== undefined ? maxDur * Math.max(0.5, lengthMacro) : undefined;

  if (effectiveMinDur !== undefined && profile.duration < effectiveMinDur) {
    score -= Math.min(40, (effectiveMinDur - profile.duration) * 60);
  }
  if (effectiveMaxDur !== undefined && profile.duration > effectiveMaxDur) {
    score -= Math.min(50, (profile.duration - effectiveMaxDur) * 40);
  }

  // 2. Transient Sharpness (modulated by macroPunch)
  const punchMacro = (criteria.macroPunch ?? 50) / 50; // 0 to 2
  const targetSharpness = roleProfile?.sharpnessTarget || criteria.sharpnessTarget;
  const minSharpness = roleProfile?.minSharpness;
  const maxSharpness = roleProfile?.maxSharpness;

  if (minSharpness !== undefined && profile.transientSharpness < minSharpness * Math.min(1.0, punchMacro)) {
    score -= (minSharpness - profile.transientSharpness) * 0.8;
  }
  if (maxSharpness !== undefined && profile.transientSharpness > maxSharpness) {
    score -= (profile.transientSharpness - maxSharpness) * 0.5;
  }

  if (targetSharpness === 'punchy') {
    score += (profile.transientSharpness - 50) * 0.6 * punchMacro;
  } else if (targetSharpness === 'soft') {
    score += (50 - profile.transientSharpness) * 0.6;
  } else if (targetSharpness === 'moderate') {
    const dist = Math.abs(profile.transientSharpness - 50);
    score += (25 - dist) * 0.5;
  }

  // 3. Frequency Energy Balance & Preferred Band
  const preferredBand = roleProfile?.preferredBand;
  const minBandEnergy = roleProfile?.minBandEnergy;
  if (preferredBand && profile.energyBalance) {
    const energy = profile.energyBalance[preferredBand];
    if (minBandEnergy !== undefined && energy < minBandEnergy) {
      score -= (minBandEnergy - energy) * 50;
    }
    score += energy * 25;
  }

  // Frequency bias macro
  if (criteria.frequencyBias === 'warm-sub' && profile.energyBalance) {
    score += (profile.energyBalance.low - profile.energyBalance.high) * 20;
  } else if (criteria.frequencyBias === 'bright-air' && profile.energyBalance) {
    score += (profile.energyBalance.high - profile.energyBalance.low) * 20;
  } else if (criteria.frequencyBias === 'mid-focused' && profile.energyBalance) {
    score += profile.energyBalance.mid * 20;
  }

  // 4. Genre Keywords & Negative Keywords
  const fullPathLower = `${sample.relativePath}/${sample.fileName}`.toLowerCase();
  if (criteria.genreKeywords && criteria.genreKeywords.length > 0) {
    const strength = (criteria.genreAffinityStrength ?? 50) / 50;
    let matchCount = 0;
    for (const kw of criteria.genreKeywords) {
      if (fullPathLower.includes(kw.toLowerCase())) {
        matchCount++;
      }
    }
    score += matchCount * 12 * strength;
  }

  if (roleProfile?.keywords && roleProfile.keywords.length > 0) {
    let roleMatch = 0;
    for (const kw of roleProfile.keywords) {
      if (fullPathLower.includes(kw.toLowerCase())) {
        roleMatch++;
      }
    }
    score += roleMatch * 10;
  }

  if (roleProfile?.negativeKeywords && roleProfile.negativeKeywords.length > 0) {
    for (const neg of roleProfile.negativeKeywords) {
      if (fullPathLower.includes(neg.toLowerCase())) {
        score -= 40;
      }
    }
  }

  // 5. Dynamic Kit Context: Anti-Masking
  if (criteria.antiMaskingEnabled !== false && contextPads.length > 0) {
    if (targetRole === 'Kick/Low') {
      const longKick = contextPads.find(p => 
        p.role === 'Kick/Low' && 
        p.sample && 
        p.sample.acousticProfile.duration > 0.45
      );
      if (longKick && profile.duration > 0.45) {
        score -= 25;
      }
    } else if (targetRole === 'Hat/Air') {
      const brightSnare = contextPads.find(p => 
        p.role === 'Snare/Snap' && 
        p.sample && 
        p.sample.acousticProfile.energyBalance.high > 0.38
      );
      if (brightSnare && profile.energyBalance.high > 0.55 && profile.duration > 0.3) {
        score -= 15;
      }
    }
  }

  // 6. Dynamic Kit Context: Pack Proximity Affinity
  if (criteria.packAffinityEnabled !== false && contextPads.length > 0) {
    const anchorSample = contextPads[0]?.sample;
    if (anchorSample && anchorSample.folderId === sample.folderId) {
      const anchorSub = anchorSample.relativePath.split(/[\\/]/)[0];
      const sampleSub = sample.relativePath.split(/[\\/]/)[0];
      if (anchorSub && anchorSub === sampleSub) {
        score += 15;
      } else {
        score += 8;
      }
    }
  }

  // 7. Harmonic Key Compatibility
  if ((targetRole === 'Tonal/Melodic' || profile.camelotKey) && effectiveKey) {
    if (profile.camelotKey) {
      if (profile.camelotKey === effectiveKey) {
        score += 80;
      } else {
        const compatible = getHarmonicMatches(effectiveKey).all;
        if (compatible.includes(profile.camelotKey)) {
          score += 45;
        } else if (criteria.keyLockMode === 'strict') {
          score -= 90;
        } else {
          score -= 25;
        }
      }
    } else {
      score -= (criteria.keyLockMode === 'strict' ? 30 : 10);
    }
  }

  // Random variety jitter (0-6 pts)
  score += Math.random() * 6;

  return score;
}

export class KitGeneratorService {
  /**
   * Create or reroll a kit with given pad count (4, 6, 8, or 16)
   * Uses role-specific acoustic targets, custom LCD roleMix overrides, and strict de-duplication.
   */
  async generateKit(
    padCount: PadCount = 8,
    existingKit?: Kit,
    rerollAll = false,
    presetId = DEFAULT_PRESET_ID,
    customCriteria?: AcousticCriteria,
    customRoleMix?: Partial<Record<SampleRole, number>>
  ): Promise<Kit> {
    const allSamples = await storage.getAllSamples();
    const customPresets = await storage.getCustomPresets();
    const allPresets = [...FACTORY_PRESETS, ...customPresets];
    const activePreset = allPresets.find(p => p.id === presetId) || FACTORY_PRESETS[0];

    const criteria = mergeCriteria(activePreset.criteria, customCriteria);
    
    // Build active role sequence from customRoleMix or factory template
    let roleTemplate: SampleRole[] = [];
    if (customRoleMix) {
      for (const [role, count] of Object.entries(customRoleMix) as [SampleRole, number][]) {
        for (let c = 0; c < count; c++) {
          roleTemplate.push(role);
        }
      }
    }
    const defaultTemplate = criteria.roleTemplates?.[padCount] || FACTORY_ROLE_TEMPLATES[padCount];
    while (roleTemplate.length < padCount) {
      roleTemplate.push(defaultTemplate[roleTemplate.length] || 'Texture/Wildcard');
    }
    roleTemplate = roleTemplate.slice(0, padCount);

    const pads: PadSlot[] = [];
    const fallbackNotices: string[] = [];
    let dominantCamelotKey: string | undefined;

    // Check if key is explicitly locked/targeted in criteria
    if (criteria.lockedCamelotKey && criteria.lockedCamelotKey !== 'any') {
      dominantCamelotKey = criteria.lockedCamelotKey;
    } else if (criteria.targetRootNote && criteria.targetRootNote !== 'any') {
      dominantCamelotKey = getCamelotFromRoot(criteria.targetRootNote, criteria.targetScale || 'minor');
    } else if (existingKit && !rerollAll) {
      for (let i = 0; i < Math.min(existingKit.pads.length, padCount); i++) {
        const slot = existingKit.pads[i];
        if (slot.locked && slot.sample?.acousticProfile.camelotKey) {
          dominantCamelotKey = slot.sample.acousticProfile.camelotKey;
          break;
        }
      }
    }

    const alreadyPickedIds = new Set<string>();

    // First pass: collect locked pads to preserve their samples, keys, and fx
    for (let i = 0; i < padCount; i++) {
      const keybind = `${QWERTY_KEYS_16[i] || (i + 1)} / ${NUMBER_KEYS_16[i] || (i + 1)}`;
      if (existingKit && !rerollAll && existingKit.pads[i] && existingKit.pads[i].locked && existingKit.pads[i].sample) {
        const lockedSlot = {
          ...existingKit.pads[i],
          index: i,
          keybind,
          isPlaying: false
        };
        pads.push(lockedSlot);
        if (lockedSlot.sample) {
          markSamplePicked(lockedSlot.sample, alreadyPickedIds);
        }
      }
    }

    // Second pass: fill unlocked slots up to padCount
    for (let i = 0; i < padCount; i++) {
      if (pads.find(p => p.index === i)) {
        continue;
      }

      let targetRole = roleTemplate[i] || 'Texture/Wildcard';
      if (existingKit && existingKit.pads[i] && !rerollAll && !customRoleMix) {
        targetRole = existingKit.pads[i].role;
      }

      const keybind = `${QWERTY_KEYS_16[i] || (i + 1)} / ${NUMBER_KEYS_16[i] || (i + 1)}`;

      const { sample: selectedSample, notice } = this.selectSampleWithFallback(
        allSamples,
        targetRole,
        criteria,
        dominantCamelotKey,
        alreadyPickedIds,
        i,
        pads
      );

      if (notice) {
        fallbackNotices.push(notice);
      }

      if (selectedSample) {
        markSamplePicked(selectedSample, alreadyPickedIds);
        if (!dominantCamelotKey && criteria.keyLockMode !== 'any' && selectedSample.acousticProfile.camelotKey) {
          dominantCamelotKey = selectedSample.acousticProfile.camelotKey;
        }
      }

      let slotFx = existingKit?.pads[i]?.fx ? { ...existingKit.pads[i].fx } : undefined;

      // Auto-tune / pitch-shift non-drum / melodic samples if target key is known and autoPitchShift is enabled
      if (criteria.autoPitchShift && dominantCamelotKey && targetRole === 'Tonal/Melodic' && selectedSample) {
        const targetDef = getMusicalKeyDef(dominantCamelotKey);
        const sampleRoot = selectedSample.acousticProfile.rootKey;
        if (sampleRoot) {
          const shift = calculateSemitoneShift(sampleRoot, targetDef.root);
          if (shift !== 0 && Math.abs(shift) <= 3) {
            slotFx = slotFx || {};
            slotFx.pitch = shift;
          }
        }
      }

      pads.push({
        index: i,
        keybind,
        role: targetRole,
        sample: selectedSample,
        locked: false,
        isPlaying: false,
        fx: slotFx
      });
    }

    // Third pass: ensure all 16 slots exist in pads so inactive rows render cleanly as OFF rubber pads
    const BANK16_FALLBACK: SampleRole[] = [
      'Kick/Low', 'Snare/Snap', 'Hat/Air', 'Tonal/Melodic',
      'Hat/Air', 'Snare/Snap', 'Tonal/Melodic', 'Texture/Wildcard',
      'Kick/Low', 'Snare/Snap', 'Hat/Air', 'Tonal/Melodic',
      'Hat/Air', 'Texture/Wildcard', 'Snare/Snap', 'Texture/Wildcard'
    ];

    for (let i = padCount; i < 16; i++) {
      const keybind = `${QWERTY_KEYS_16[i] || (i + 1)} / ${NUMBER_KEYS_16[i] || (i + 1)}`;
      const existing = existingKit?.pads[i];
      pads.push({
        index: i,
        keybind,
        role: existing?.role || BANK16_FALLBACK[i],
        sample: undefined,
        locked: false,
        isPlaying: false
      });
    }

    pads.sort((a, b) => a.index - b.index);

    const effectiveDominantKey = dominantCamelotKey || (criteria.lockedCamelotKey && criteria.lockedCamelotKey !== 'any' ? criteria.lockedCamelotKey : undefined);
    const dominantKeyDef = effectiveDominantKey ? getMusicalKeyDef(effectiveDominantKey) : undefined;
    const kitName = this.generateKitName(activePreset.name, effectiveDominantKey);

    const newKit: Kit = {
      id: 'kit_' + Math.random().toString(36).substring(2, 9),
      name: kitName,
      padCount,
      pads,
      dominantKey: dominantKeyDef?.shortName,
      dominantCamelot: effectiveDominantKey,
      generatedAt: Date.now(),
      presetId: activePreset.id,
      presetName: activePreset.name,
      criteria,
      roleMix: customRoleMix,
      fallbackNotices: fallbackNotices.length > 0 ? fallbackNotices : undefined
    };

    await storage.saveActiveKit(newKit);
    return newKit;
  }

  /**
   * Reroll a single pad slot while keeping all other pads intact
   */
  async rerollPad(padIndex: number, currentKit: Kit, criteria?: AcousticCriteria): Promise<Kit> {
    const allSamples = await storage.getAllSamples();
    const effectiveCriteria = criteria || currentKit.criteria || FACTORY_PRESETS[0].criteria;
    const targetSlot = currentKit.pads[padIndex];
    if (!targetSlot) return currentKit;

    const alreadyPickedIds = new Set<string>();
    currentKit.pads
      .filter((_, idx) => idx !== padIndex)
      .forEach(p => {
        if (p.sample) {
          markSamplePicked(p.sample, alreadyPickedIds);
        }
      });

    const otherPads = currentKit.pads.filter((_, idx) => idx !== padIndex);
    const avoidFileName = targetSlot.sample?.fileName;

    const { sample: newSample, notice } = this.selectSampleWithFallback(
      allSamples,
      targetSlot.role,
      effectiveCriteria,
      currentKit.dominantCamelot,
      alreadyPickedIds,
      padIndex,
      otherPads,
      avoidFileName
    );

    const updatedPads = currentKit.pads.map((p, idx) => {
      if (idx === padIndex) {
        return {
          ...p,
          sample: newSample,
          isPlaying: false
        };
      }
      return p;
    });

    const notices = currentKit.fallbackNotices ? [...currentKit.fallbackNotices] : [];
    if (notice) notices.push(notice);

    const updatedKit: Kit = {
      ...currentKit,
      pads: updatedPads,
      generatedAt: Date.now(),
      fallbackNotices: notices.length > 0 ? notices : undefined
    };

    await storage.saveActiveKit(updatedKit);
    return updatedKit;
  }

  /**
   * Change a pad's role and immediately pick a compatible sample
   */
  async setPadRole(padIndex: number, newRole: SampleRole, currentKit: Kit, criteria?: AcousticCriteria): Promise<Kit> {
    const allSamples = await storage.getAllSamples();
    const effectiveCriteria = criteria || currentKit.criteria || FACTORY_PRESETS[0].criteria;

    const alreadyPickedIds = new Set<string>();
    currentKit.pads
      .filter((_, idx) => idx !== padIndex)
      .forEach(p => {
        if (p.sample) {
          markSamplePicked(p.sample, alreadyPickedIds);
        }
      });

    const otherPads = currentKit.pads.filter((_, idx) => idx !== padIndex);
    const avoidFileName = currentKit.pads[padIndex]?.sample?.fileName;

    const { sample: newSample, notice } = this.selectSampleWithFallback(
      allSamples,
      newRole,
      effectiveCriteria,
      currentKit.dominantCamelot,
      alreadyPickedIds,
      padIndex,
      otherPads,
      avoidFileName
    );

    const updatedPads = currentKit.pads.map((p, idx) => {
      if (idx === padIndex) {
        return {
          ...p,
          role: newRole,
          sample: newSample,
          isPlaying: false
        };
      }
      return p;
    });

    const notices = currentKit.fallbackNotices ? [...currentKit.fallbackNotices] : [];
    if (notice) notices.push(notice);

    const updatedKit: Kit = {
      ...currentKit,
      pads: updatedPads,
      generatedAt: Date.now(),
      fallbackNotices: notices.length > 0 ? notices : undefined
    };

    await storage.saveActiveKit(updatedKit);
    return updatedKit;
  }

  /**
   * Multi-tiered selection engine with progressive relaxation and strict de-duplication
   */
  private selectSampleWithFallback(
    allSamples: SampleRecord[],
    targetRole: SampleRole,
    criteria: AcousticCriteria,
    dominantCamelotKey?: string,
    alreadyPickedIds = new Set<string>(),
    padIndex = 0,
    contextPads: PadSlot[] = [],
    avoidFileName?: string
  ): { sample: SampleRecord; notice?: string } {
    const folderFilter = criteria.folderIds && criteria.folderIds.length > 0 ? new Set(criteria.folderIds) : null;
    const effectiveKey = criteria.keyLockMode === 'strict' && criteria.lockedCamelotKey 
      ? criteria.lockedCamelotKey 
      : dominantCamelotKey;

    const roleProfile = criteria.roleProfiles?.[targetRole];
    const roleSamples = allSamples.filter(s => s.role === targetRole);
    const isAvail = (s: SampleRecord) => !isSamplePicked(s, alreadyPickedIds, avoidFileName);

    // --- TIER 1: Exact Match (Folder + Role + Key + Role-Specific Acoustic Bounds) ---
    let tier1Candidates = roleSamples;
    if (folderFilter) {
      tier1Candidates = tier1Candidates.filter(s => folderFilter.has(s.folderId));
    }
    if (targetRole === 'Tonal/Melodic' && effectiveKey && criteria.keyLockMode !== 'any') {
      const compatible = getCompatibleCamelotKeys(effectiveKey);
      tier1Candidates = tier1Candidates.filter(s => s.acousticProfile.camelotKey && compatible.includes(s.acousticProfile.camelotKey));
    }

    // Role-specific duration bounds
    const minDur = roleProfile?.durationMin ?? criteria.durationMin;
    const maxDur = roleProfile?.durationMax ?? criteria.durationMax;
    if (minDur !== undefined || maxDur !== undefined) {
      tier1Candidates = tier1Candidates.filter(s => {
        if (minDur !== undefined && s.acousticProfile.duration < minDur * 0.8) return false;
        if (maxDur !== undefined && s.acousticProfile.duration > maxDur * 1.2) return false;
        return true;
      });
    }

    const tier1Available = tier1Candidates.filter(isAvail);
    if (tier1Available.length > 0) {
      return {
        sample: this.pickBestCandidate(tier1Available, targetRole, criteria, effectiveKey, alreadyPickedIds, contextPads)
      };
    }

    // --- TIER 2: Relax Acoustic Bounds (Folder + Role + Key) ---
    let tier2Candidates = roleSamples;
    if (folderFilter) {
      tier2Candidates = tier2Candidates.filter(s => folderFilter.has(s.folderId));
    }
    if (targetRole === 'Tonal/Melodic' && effectiveKey && criteria.keyLockMode !== 'any') {
      const compatible = getCompatibleCamelotKeys(effectiveKey);
      tier2Candidates = tier2Candidates.filter(s => s.acousticProfile.camelotKey && compatible.includes(s.acousticProfile.camelotKey));
    }

    const tier2Available = tier2Candidates.filter(isAvail);
    if (tier2Available.length > 0) {
      return {
        sample: this.pickBestCandidate(tier2Available, targetRole, criteria, effectiveKey, alreadyPickedIds, contextPads)
      };
    }

    // --- TIER 3: Relax Folder Filter (Any Folder + Role + Key) ---
    let tier3Candidates = roleSamples;
    if (targetRole === 'Tonal/Melodic' && effectiveKey && criteria.keyLockMode !== 'any') {
      const compatible = getCompatibleCamelotKeys(effectiveKey);
      tier3Candidates = tier3Candidates.filter(s => s.acousticProfile.camelotKey && compatible.includes(s.acousticProfile.camelotKey));
    }

    const tier3Available = tier3Candidates.filter(isAvail);
    if (tier3Available.length > 0) {
      const notice = folderFilter ? `Pad ${padIndex + 1} (${targetRole}): pulled from other folders` : undefined;
      return {
        sample: this.pickBestCandidate(tier3Available, targetRole, criteria, effectiveKey, alreadyPickedIds, contextPads),
        notice
      };
    }

    // --- TIER 4: Relax Harmonic Key (Any Folder + Role + Any Key) ---
    const tier4Available = roleSamples.filter(isAvail);
    if (tier4Available.length > 0) {
      const notice = effectiveKey ? `Pad ${padIndex + 1} (${targetRole}): musical key relaxed` : undefined;
      return {
        sample: this.pickBestCandidate(tier4Available, targetRole, criteria, effectiveKey, alreadyPickedIds, contextPads),
        notice
      };
    }

    // --- TIER 5: Fallback to Any Unpicked Library Sound ---
    const tier5Available = allSamples.filter(isAvail);
    if (tier5Available.length > 0) {
      return {
        sample: this.pickBestCandidate(tier5Available, targetRole, criteria, effectiveKey, alreadyPickedIds, contextPads),
        notice: `Pad ${padIndex + 1} (${targetRole}): role relaxed to library sound`
      };
    }

    // --- TIER 6: Factory Demo Sound ---
    return {
      sample: this.createDemoSample(targetRole, padIndex, effectiveKey, alreadyPickedIds, avoidFileName),
      notice: allSamples.length > 0 
        ? `Pad ${padIndex + 1} (${targetRole}): filled with factory demo sound` 
        : `Pad ${padIndex + 1} (${targetRole}): factory demo sound`
    };
  }

  /**
   * Sort candidates by multi-factor score and select with weighted variety
   */
  private pickBestCandidate(
    candidates: SampleRecord[],
    targetRole: SampleRole,
    criteria: AcousticCriteria,
    effectiveKey?: string,
    alreadyPickedIds = new Set<string>(),
    contextPads: PadSlot[] = []
  ): SampleRecord {
    const unpicked = candidates.filter(c => !isSamplePicked(c, alreadyPickedIds));
    const pool = unpicked.length > 0 ? unpicked : candidates;

    const scored = pool.map(sample => ({
      sample,
      score: scoreCandidate(sample, targetRole, criteria, effectiveKey, contextPads)
    }));

    scored.sort((a, b) => b.score - a.score);

    const topCount = Math.max(1, Math.min(3, Math.ceil(scored.length * 0.30)));
    const topCandidates = scored.slice(0, topCount);

    const selectedIndex = Math.floor(Math.random() * topCandidates.length);
    return topCandidates[selectedIndex].sample;
  }

  /**
   * Create realistic demo sample record with true role variety, pitch diversity, and unique non-doubled identity
   */
  private createDemoSample(
    role: SampleRole,
    padIndex: number,
    forcedCamelot?: string,
    alreadyPickedIds = new Set<string>(),
    avoidFileName?: string
  ): SampleRecord {
    const roleCandidates = FACTORY_DEMO_LIBRARY.filter(s => s.role === role);
    let available: FactoryDemoSound[] = [];

    // First attempt: matching role with compatible Camelot key (same, +/-1 step, relative major/minor)
    if (role === 'Tonal/Melodic' && forcedCamelot) {
      const compatible = getCompatibleCamelotKeys(forcedCamelot);
      available = roleCandidates.filter(s => !isSamplePicked(s, alreadyPickedIds, avoidFileName) && s.camelot && compatible.includes(s.camelot));
    }

    // Second attempt: any unpicked sound of this exact role
    if (available.length === 0) {
      available = roleCandidates.filter(s => !isSamplePicked(s, alreadyPickedIds, avoidFileName));
    }

    // Third attempt: if all demo sounds for this role are already assigned in this kit, pick any unpicked sound from the entire demo library
    if (available.length === 0) {
      available = FACTORY_DEMO_LIBRARY.filter(s => !isSamplePicked(s, alreadyPickedIds, avoidFileName));
    }

    // Fourth attempt: if avoidFileName was specified (respin) but no unpicked sounds exist, pick any sound other than avoidFileName
    if (available.length === 0) {
      available = roleCandidates.filter(s => !avoidFileName || s.fileName.toLowerCase() !== avoidFileName.toLowerCase());
    }

    // Absolute fallback: all role candidates
    if (available.length === 0) {
      available = roleCandidates;
    }

    // Pick random available sound
    const item = available[Math.floor(Math.random() * available.length)];
    markSamplePicked(item, alreadyPickedIds);

    const uniqueId = `demo_${item.fileName.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}_${padIndex}_${Math.random().toString(36).substring(2, 6)}`;

    const waveformBins = Array.from({ length: 64 }, (_, i) => {
      const env = Math.exp(-i / (role === 'Hat/Air' ? 10 : role === 'Kick/Low' ? 16 : 28));
      const wobble = 0.5 + 0.5 * Math.sin(i * 0.4 + padIndex);
      return Math.min(1.0, +(env * wobble).toFixed(2));
    });

    return {
      id: uniqueId,
      folderId: 'demo_factory',
      folderName: 'Factory Demo',
      fileName: item.fileName,
      relativePath: `Demo/${item.fileName}`,
      fileSize: 44100 * 2,
      lastModified: Date.now(),
      role,
      acousticProfile: {
        duration: item.duration,
        transientSharpness: item.sharpness,
        attackRiseMs: role === 'Snare/Snap' ? 3.2 : role === 'Kick/Low' ? 6.5 : 12.0,
        crestFactorDb: 18.5,
        energyBalance: {
          low: role === 'Kick/Low' ? 0.65 : role === 'Tonal/Melodic' && (item.pitchHz || 0) < 100 ? 0.7 : 0.1,
          mid: role === 'Snare/Snap' ? 0.55 : 0.3,
          high: role === 'Hat/Air' ? 0.70 : role === 'Texture/Wildcard' ? 0.4 : 0.15
        },
        rootPitchHz: item.pitchHz,
        rootKey: item.note,
        camelotKey: item.camelot,
        pitchConfidence: role === 'Tonal/Melodic' ? 0.90 : 0.4,
        isMelodic: role === 'Tonal/Melodic',
        waveformBins
      },
      tags: ['demo', role.toLowerCase()]
    };
  }

  private generateKitName(presetName: string, camelotKey?: string): string {
    const adjectives = ['Neon', 'Velvet', 'Midnight', 'Raw', 'Liquid', 'Dusty', 'Solar', 'Lo-Fi', 'Quantum', 'Glitch', 'Golden', 'Deep'];
    const nouns = ['Crate', 'Session', 'Vault', 'Pulse', 'Cipher', 'Groove', 'Engine', 'Palette', 'Flux', 'Matrix', 'Draft'];
    const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
    const noun = nouns[Math.floor(Math.random() * nouns.length)];
    const keyTag = camelotKey ? ` (${camelotKey})` : '';
    return `${presetName}: ${adj} ${noun}${keyTag}`;
  }
}

export const kitGenerator = new KitGeneratorService();
