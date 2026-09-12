import { storage } from './storage.ts';
import type { Kit, PadSlot, SampleRecord, SampleRole } from '../types/index.ts';

const QWERTY_KEYS_8 = ['Q', 'W', 'E', 'R', 'A', 'S', 'D', 'F'];
const NUMBER_KEYS_8 = ['1', '2', '3', '4', '5', '6', '7', '8'];

const ROLE_TEMPLATES: Record<4 | 6 | 8, SampleRole[]> = {
  4: ['Kick/Low', 'Snare/Snap', 'Hat/Air', 'Tonal/Melodic'],
  6: ['Kick/Low', 'Snare/Snap', 'Hat/Air', 'Snare/Snap', 'Tonal/Melodic', 'Texture/Wildcard'],
  8: [
    'Kick/Low',
    'Snare/Snap',
    'Hat/Air',
    'Hat/Air',
    'Tonal/Melodic',
    'Tonal/Melodic',
    'Texture/Wildcard',
    'Texture/Wildcard'
  ]
};

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

export class KitGeneratorService {
  /**
   * Create or reroll a kit with given pad count (4, 6, or 8)
   * Preserves locked pad slots and finds complementary sounds for unlocked slots.
   */
  async generateKit(padCount: 4 | 6 | 8 = 8, existingKit?: Kit, rerollAll = false): Promise<Kit> {
    const allSamples = await storage.getAllSamples();
    const roleTemplate = ROLE_TEMPLATES[padCount];

    // Group available samples by role
    const samplesByRole: Record<SampleRole, SampleRecord[]> = {
      'Kick/Low': [],
      'Snare/Snap': [],
      'Hat/Air': [],
      'Tonal/Melodic': [],
      'Texture/Wildcard': []
    };

    for (const sample of allSamples) {
      if (samplesByRole[sample.role]) {
        samplesByRole[sample.role].push(sample);
      }
    }

    // Determine existing locked pads or start fresh
    const pads: PadSlot[] = [];
    let dominantCamelotKey: string | undefined;

    // Check if any locked tonal pad already establishes a key
    if (existingKit && !rerollAll) {
      for (let i = 0; i < Math.min(existingKit.pads.length, padCount); i++) {
        const slot = existingKit.pads[i];
        if (slot.locked && slot.sample?.acousticProfile.camelotKey) {
          dominantCamelotKey = slot.sample.acousticProfile.camelotKey;
          break;
        }
      }
    }

    for (let i = 0; i < padCount; i++) {
      const targetRole = roleTemplate[i];
      const keybind = `${QWERTY_KEYS_8[i]} / ${NUMBER_KEYS_8[i]}`;

      // If existing slot is locked, keep it
      if (existingKit && !rerollAll && existingKit.pads[i] && existingKit.pads[i].locked && existingKit.pads[i].sample) {
        pads.push({
          ...existingKit.pads[i],
          index: i,
          keybind,
          isPlaying: false
        });
        continue;
      }

      // Pick complementary sample for unlocked slot
      let candidates = [...(samplesByRole[targetRole] || [])];

      // Fallback if no samples exist in this role yet: try any available sample or demo
      if (candidates.length === 0) {
        candidates = allSamples;
      }

      let selectedSample: SampleRecord | undefined;

      if (candidates.length > 0) {
        // If this is a melodic slot and we have a dominant key, bias selection to harmonically compatible keys!
        if (targetRole === 'Tonal/Melodic' && dominantCamelotKey) {
          const compatible = getCompatibleCamelotKeys(dominantCamelotKey);
          const harmonized = candidates.filter(s => 
            s.acousticProfile.camelotKey && compatible.includes(s.acousticProfile.camelotKey)
          );
          if (harmonized.length > 0) {
            candidates = harmonized;
          }
        }

        // Avoid duplicate picks if possible
        const alreadyPickedIds = new Set(pads.map(p => p.sample?.id).filter(Boolean));
        const unused = candidates.filter(c => !alreadyPickedIds.has(c.id));
        const pool = unused.length > 0 ? unused : candidates;

        const randomIndex = Math.floor(Math.random() * pool.length);
        selectedSample = pool[randomIndex];

        // If this sample sets a new dominant key
        if (!dominantCamelotKey && selectedSample?.acousticProfile.camelotKey) {
          dominantCamelotKey = selectedSample.acousticProfile.camelotKey;
        }
      } else {
        // No samples in database yet: provide demo synthetic sample record
        selectedSample = this.createDemoSample(targetRole, i, dominantCamelotKey);
        if (!dominantCamelotKey && selectedSample.acousticProfile.camelotKey) {
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

    const kitName = this.generateKitName(dominantCamelotKey);
    const newKit: Kit = {
      id: 'kit_' + Math.random().toString(36).substring(2, 9),
      name: kitName,
      padCount,
      pads,
      dominantCamelot: dominantCamelotKey,
      generatedAt: Date.now()
    };

    await storage.saveActiveKit(newKit);
    return newKit;
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

    // Generate dummy waveform bins
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

  private generateKitName(camelotKey?: string): string {
    const adjectives = ['Neon', 'Velvet', 'Midnight', 'Raw', 'Liquid', 'Dusty', 'Solar', 'Lo-Fi', 'Quantum', 'Glitch', 'Golden', 'Deep'];
    const nouns = ['Crate', 'Session', 'Vault', 'Pulse', 'Cipher', 'Groove', 'Engine', 'Palette', 'Flux', 'Matrix', 'Draft'];
    const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
    const noun = nouns[Math.floor(Math.random() * nouns.length)];
    const keyTag = camelotKey ? ` (${camelotKey})` : '';
    return `${adj} ${noun}${keyTag}`;
  }
}

export const kitGenerator = new KitGeneratorService();
