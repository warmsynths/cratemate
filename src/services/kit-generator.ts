import { storage } from './storage.ts';
import { FACTORY_ROLE_TEMPLATES, FACTORY_PRESETS, DEFAULT_PRESET_ID, mergeCriteria } from './presets.ts';
import type { AcousticCriteria, Kit, PadSlot, SampleRecord, SampleRole } from '../types/index.ts';

const QWERTY_KEYS_8 = ['Q', 'W', 'E', 'R', 'A', 'S', 'D', 'F'];
const NUMBER_KEYS_8 = ['1', '2', '3', '4', '5', '6', '7', '8'];

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
  const prefBand = roleProfile?.preferredBand;
  const minBandEnergy = roleProfile?.minBandEnergy;

  if (prefBand === 'low') {
    if (minBandEnergy !== undefined && profile.energyBalance.low < minBandEnergy) {
      score -= (minBandEnergy - profile.energyBalance.low) * 60;
    } else {
      score += profile.energyBalance.low * 40;
    }
  } else if (prefBand === 'mid') {
    if (minBandEnergy !== undefined && profile.energyBalance.mid < minBandEnergy) {
      score -= (minBandEnergy - profile.energyBalance.mid) * 60;
    } else {
      score += profile.energyBalance.mid * 40;
    }
  } else if (prefBand === 'high') {
    if (minBandEnergy !== undefined && profile.energyBalance.high < minBandEnergy) {
      score -= (minBandEnergy - profile.energyBalance.high) * 60;
    } else {
      score += profile.energyBalance.high * 40;
    }
  }

  // Global macroTone bias
  if (criteria.macroTone === 'warm' || criteria.frequencyBias === 'warm-sub') {
    score += profile.energyBalance.low * 20 - profile.energyBalance.high * 10;
  } else if (criteria.macroTone === 'bright' || criteria.frequencyBias === 'bright-air') {
    score += profile.energyBalance.high * 20 - profile.energyBalance.low * 10;
  }

  // 4. Semantic Keyword Affinity
  const affinityWeight = (criteria.genreAffinityStrength ?? 70) / 100;
  const sampleTokens = new Set<string>();

  // Collect from tags
  for (const t of sample.tags) {
    if (t.startsWith('tag:')) {
      sampleTokens.add(t.substring(4));
    } else {
      sampleTokens.add(t.toLowerCase());
    }
  }
  // Collect from filename & relativePath
  const pathTokens = `${sample.relativePath} ${sample.fileName}`.toLowerCase().split(/[\/\\_\-\s\.\(\)\[\]0-9]+/);
  for (const pt of pathTokens) {
    if (pt.length >= 2) sampleTokens.add(pt);
  }

  // Check role-specific keywords
  if (roleProfile?.keywords) {
    for (const kw of roleProfile.keywords) {
      if (sampleTokens.has(kw.toLowerCase())) {
        score += 30 * affinityWeight;
        break;
      }
    }
  }

  // Check role-specific negative keywords
  if (roleProfile?.negativeKeywords) {
    for (const nkw of roleProfile.negativeKeywords) {
      if (sampleTokens.has(nkw.toLowerCase())) {
        score -= 45 * affinityWeight;
        break;
      }
    }
  }

  // Check global genre keywords
  if (criteria.genreKeywords) {
    for (const gkw of criteria.genreKeywords) {
      if (sampleTokens.has(gkw.toLowerCase())) {
        score += 20 * affinityWeight;
        break;
      }
    }
  }

  // 5. Dynamic Kit Context: Sub-Bass Anti-Masking
  if (criteria.antiMaskingEnabled !== false && contextPads.length > 0) {
    if (targetRole === 'Tonal/Melodic') {
      const heavySubKick = contextPads.find(p => 
        p.role === 'Kick/Low' && 
        p.sample && 
        p.sample.acousticProfile.energyBalance.low > 0.45 &&
        p.sample.acousticProfile.duration > 0.3
      );
      if (heavySubKick) {
        if (profile.energyBalance.low > 0.45) {
          score -= 40; // avoid competing sub bass clash
        }
        if (profile.energyBalance.mid > 0.35 || profile.energyBalance.high > 0.25) {
          score += 25; // boost chords, keys, leads
        }
      }
    }

    if (targetRole === 'Hat/Air') {
      const brightSnare = contextPads.find(p => 
        p.role === 'Snare/Snap' && 
        p.sample && 
        p.sample.acousticProfile.energyBalance.high > 0.38
      );
      if (brightSnare && profile.energyBalance.high > 0.55 && profile.duration > 0.3) {
        score -= 15; // avoid excessive wash
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
  if (targetRole === 'Tonal/Melodic' && effectiveKey) {
    if (profile.camelotKey) {
      if (profile.camelotKey === effectiveKey) {
        score += 50;
      } else {
        const compatible = getCompatibleCamelotKeys(effectiveKey);
        if (compatible.includes(profile.camelotKey)) {
          score += 35;
        } else {
          score -= 35;
        }
      }
    } else {
      score -= 10;
    }
  }

  // Random variety jitter (0-6 pts)
  score += Math.random() * 6;

  return score;
}

export class KitGeneratorService {
  /**
   * Create or reroll a kit with given pad count (4, 6, or 8)
   * Uses role-specific acoustic targets, semantic genre matching, and progressive relaxation fallbacks.
   */
  async generateKit(
    padCount: 4 | 6 | 8 = 8,
    existingKit?: Kit,
    rerollAll = false,
    presetId = DEFAULT_PRESET_ID,
    customCriteria?: AcousticCriteria
  ): Promise<Kit> {
    const allSamples = await storage.getAllSamples();
    const customPresets = await storage.getCustomPresets();
    const allPresets = [...FACTORY_PRESETS, ...customPresets];
    const activePreset = allPresets.find(p => p.id === presetId) || FACTORY_PRESETS[0];

    const criteria = mergeCriteria(activePreset.criteria, customCriteria);
    const roleTemplate = criteria.roleTemplates?.[padCount] || FACTORY_ROLE_TEMPLATES[padCount];

    const pads: PadSlot[] = [];
    const fallbackNotices: string[] = [];
    let dominantCamelotKey: string | undefined;

    // Check if key is strictly locked in criteria
    if (criteria.keyLockMode === 'strict' && criteria.lockedCamelotKey) {
      dominantCamelotKey = criteria.lockedCamelotKey;
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

    // First pass: collect locked pads to preserve their samples and keys
    for (let i = 0; i < padCount; i++) {
      const keybind = `${QWERTY_KEYS_8[i]} / ${NUMBER_KEYS_8[i]}`;
      if (existingKit && !rerollAll && existingKit.pads[i] && existingKit.pads[i].locked && existingKit.pads[i].sample) {
        const lockedSlot = {
          ...existingKit.pads[i],
          index: i,
          keybind,
          isPlaying: false
        };
        pads.push(lockedSlot);
        if (lockedSlot.sample) {
          alreadyPickedIds.add(lockedSlot.sample.id);
        }
      }
    }

    // Second pass: fill unlocked slots
    for (let i = 0; i < padCount; i++) {
      if (pads.find(p => p.index === i)) {
        continue;
      }

      let targetRole = roleTemplate[i] || 'Texture/Wildcard';
      if (existingKit && existingKit.pads[i] && !rerollAll) {
        targetRole = existingKit.pads[i].role;
      }

      const keybind = `${QWERTY_KEYS_8[i]} / ${NUMBER_KEYS_8[i]}`;

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
        alreadyPickedIds.add(selectedSample.id);
        if (!dominantCamelotKey && criteria.keyLockMode !== 'any' && selectedSample.acousticProfile.camelotKey) {
          dominantCamelotKey = selectedSample.acousticProfile.camelotKey;
        }
      }

      pads.push({
        index: i,
        keybind,
        role: targetRole,
        sample: selectedSample,
        locked: false,
        isPlaying: false
      });
    }

    pads.sort((a, b) => a.index - b.index);

    const kitName = this.generateKitName(activePreset.name, dominantCamelotKey);
    const newKit: Kit = {
      id: 'kit_' + Math.random().toString(36).substring(2, 9),
      name: kitName,
      padCount,
      pads,
      dominantCamelot: dominantCamelotKey,
      generatedAt: Date.now(),
      presetId: activePreset.id,
      presetName: activePreset.name,
      criteria,
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

    const alreadyPickedIds = new Set(
      currentKit.pads
        .filter((_, idx) => idx !== padIndex)
        .map(p => p.sample?.id)
        .filter((id): id is string => !!id)
    );

    const otherPads = currentKit.pads.filter((_, idx) => idx !== padIndex);

    const { sample: newSample, notice } = this.selectSampleWithFallback(
      allSamples,
      targetSlot.role,
      effectiveCriteria,
      currentKit.dominantCamelot,
      alreadyPickedIds,
      padIndex,
      otherPads
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

    const alreadyPickedIds = new Set(
      currentKit.pads
        .filter((_, idx) => idx !== padIndex)
        .map(p => p.sample?.id)
        .filter((id): id is string => !!id)
    );

    const otherPads = currentKit.pads.filter((_, idx) => idx !== padIndex);

    const { sample: newSample, notice } = this.selectSampleWithFallback(
      allSamples,
      newRole,
      effectiveCriteria,
      currentKit.dominantCamelot,
      alreadyPickedIds,
      padIndex,
      otherPads
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
   * Multi-tiered selection engine with progressive relaxation
   */
  private selectSampleWithFallback(
    allSamples: SampleRecord[],
    targetRole: SampleRole,
    criteria: AcousticCriteria,
    dominantCamelotKey?: string,
    alreadyPickedIds = new Set<string>(),
    padIndex = 0,
    contextPads: PadSlot[] = []
  ): { sample: SampleRecord; notice?: string } {
    const folderFilter = criteria.folderIds && criteria.folderIds.length > 0 ? new Set(criteria.folderIds) : null;
    const effectiveKey = criteria.keyLockMode === 'strict' && criteria.lockedCamelotKey 
      ? criteria.lockedCamelotKey 
      : dominantCamelotKey;

    const roleProfile = criteria.roleProfiles?.[targetRole];
    const roleSamples = allSamples.filter(s => s.role === targetRole);

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

    if (tier1Candidates.length > 0) {
      return {
        sample: this.pickBestCandidate(tier1Candidates, targetRole, criteria, effectiveKey, alreadyPickedIds, contextPads)
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

    if (tier2Candidates.length > 0) {
      return {
        sample: this.pickBestCandidate(tier2Candidates, targetRole, criteria, effectiveKey, alreadyPickedIds, contextPads)
      };
    }

    // --- TIER 3: Relax Folder Filter (Any Folder + Role + Key) ---
    let tier3Candidates = roleSamples;
    if (targetRole === 'Tonal/Melodic' && effectiveKey && criteria.keyLockMode !== 'any') {
      const compatible = getCompatibleCamelotKeys(effectiveKey);
      tier3Candidates = tier3Candidates.filter(s => s.acousticProfile.camelotKey && compatible.includes(s.acousticProfile.camelotKey));
    }

    if (tier3Candidates.length > 0) {
      const notice = folderFilter ? `Pad ${padIndex + 1} (${targetRole}): pulled from other folders` : undefined;
      return {
        sample: this.pickBestCandidate(tier3Candidates, targetRole, criteria, effectiveKey, alreadyPickedIds, contextPads),
        notice
      };
    }

    // --- TIER 4: Relax Harmonic Key (Any Folder + Role + Any Key) ---
    if (roleSamples.length > 0) {
      const notice = effectiveKey ? `Pad ${padIndex + 1} (${targetRole}): musical key relaxed` : undefined;
      return {
        sample: this.pickBestCandidate(roleSamples, targetRole, criteria, effectiveKey, alreadyPickedIds, contextPads),
        notice
      };
    }

    // --- TIER 5: Fallback to Any Library Sound or Factory Demo ---
    if (allSamples.length > 0) {
      return {
        sample: this.pickBestCandidate(allSamples, targetRole, criteria, effectiveKey, alreadyPickedIds, contextPads),
        notice: `Pad ${padIndex + 1} (${targetRole}): role relaxed to library sound`
      };
    }

    return {
      sample: this.createDemoSample(targetRole, padIndex, effectiveKey),
      notice: `Pad ${padIndex + 1} (${targetRole}): factory demo sound`
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
    const unpicked = candidates.filter(c => !alreadyPickedIds.has(c.id));
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
   * Create realistic demo sample record when user hasn't scanned local audio yet
   */
  private createDemoSample(role: SampleRole, padIndex: number, forcedCamelot?: string): SampleRecord {
    const demoNames: Record<SampleRole, string[]> = {
      'Kick/Low': ['808_DeepKick_Punch.wav', 'Sub_Boom_LowC.wav', 'Punchy_Analog_BD.wav'],
      'Snare/Snap': ['Crisp_Vintage_Snare.wav', 'Tight_Rim_Snap.wav', 'Trap_Clap_Hit.wav'],
      'Hat/Air': ['Crisp_Closed_HH.wav', 'Sizzle_Open_Hat.wav', 'Shaker_Groove.wav'],
      'Tonal/Melodic': ['Rhodes_Chords_Am.wav', 'Analog_SubBass_D.wav', 'Vocal_Chop_Melody.wav'],
      'Texture/Wildcard': ['Vinyl_Crackles_Atmo.wav', 'Foley_Click_Drop.wav', 'Space_Sweep_FX.wav']
    };

    const names = demoNames[role] || ['Sample.wav'];
    const fileName = names[padIndex % names.length];

    const pitchMap: Record<number, { pitch: number; note: string; camelot: string }> = {
      0: { pitch: 55, note: 'A1', camelot: '8A' },
      1: { pitch: 110, note: 'A2', camelot: '8A' },
      4: { pitch: 220, note: 'A3', camelot: '8A' },
      5: { pitch: 330, note: 'E4', camelot: '9A' }
    };

    const pitchInfo = pitchMap[padIndex] || { pitch: 220, note: 'A3', camelot: forcedCamelot || '8A' };

    const waveformBins = Array.from({ length: 64 }, (_, i) => {
      const env = Math.exp(-i / (role === 'Hat/Air' ? 10 : 25));
      const wobble = 0.5 + 0.5 * Math.sin(i * 0.4);
      return Math.min(1.0, +(env * wobble).toFixed(2));
    });

    return {
      id: `demo_${role}_${padIndex}`,
      folderId: 'demo_factory',
      folderName: 'Factory Demo',
      fileName,
      relativePath: `Demo/${fileName}`,
      fileSize: 44100 * 2,
      lastModified: Date.now(),
      role,
      acousticProfile: {
        duration: role === 'Hat/Air' ? 0.18 : role === 'Tonal/Melodic' ? 1.4 : 0.45,
        transientSharpness: role === 'Snare/Snap' ? 88 : role === 'Kick/Low' ? 76 : role === 'Hat/Air' ? 92 : 45,
        attackRiseMs: role === 'Snare/Snap' ? 3.2 : role === 'Kick/Low' ? 6.5 : 12.0,
        crestFactorDb: 18.5,
        energyBalance: {
          low: role === 'Kick/Low' ? 0.65 : 0.1,
          mid: role === 'Snare/Snap' ? 0.55 : 0.3,
          high: role === 'Hat/Air' ? 0.70 : 0.15
        },
        rootPitchHz: role === 'Tonal/Melodic' || role === 'Kick/Low' ? pitchInfo.pitch : undefined,
        rootKey: role === 'Tonal/Melodic' || role === 'Kick/Low' ? pitchInfo.note : undefined,
        camelotKey: role === 'Tonal/Melodic' ? pitchInfo.camelot : undefined,
        pitchConfidence: role === 'Tonal/Melodic' ? 0.85 : 0.4,
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
