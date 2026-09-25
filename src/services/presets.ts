import type { AcousticCriteria, KitPreset, PadCount, SampleRole } from '../types/index.ts';

export const FACTORY_ROLE_TEMPLATES: Record<PadCount, SampleRole[]> = {
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
  ],
  16: [
    'Kick/Low', 'Snare/Snap', 'Hat/Air', 'Tonal/Melodic',
    'Hat/Air', 'Snare/Snap', 'Tonal/Melodic', 'Texture/Wildcard',
    'Kick/Low', 'Snare/Snap', 'Hat/Air', 'Tonal/Melodic',
    'Hat/Air', 'Texture/Wildcard', 'Snare/Snap', 'Texture/Wildcard'
  ]
};

export const FACTORY_PRESETS: KitPreset[] = [
  {
    id: 'standard',
    name: 'Standard Balanced',
    description: 'Versatile all-around kit with balanced frequency and transient spread across all roles',
    icon: '🥁',
    isFactory: true,
    criteria: {
      durationMin: 0.05,
      durationMax: 3.5,
      sharpnessTarget: 'any',
      frequencyBias: 'any',
      keyLockMode: 'auto',
      macroPunch: 50,
      macroLength: 50,
      macroTone: 'neutral',
      genreKeywords: ['drum', 'kit', 'sample', 'beat', 'groove'],
      genreAffinityStrength: 40,
      antiMaskingEnabled: true,
      packAffinityEnabled: true,
      roleTemplates: FACTORY_ROLE_TEMPLATES,
      roleProfiles: {
        'Kick/Low': {
          durationMin: 0.15,
          durationMax: 1.0,
          sharpnessTarget: 'punchy',
          minSharpness: 60,
          preferredBand: 'low',
          minBandEnergy: 0.38,
          keywords: ['kick', 'bd', 'punch', 'bassdrum']
        },
        'Snare/Snap': {
          durationMin: 0.10,
          durationMax: 0.85,
          sharpnessTarget: 'punchy',
          minSharpness: 65,
          preferredBand: 'mid',
          minBandEnergy: 0.32,
          keywords: ['snare', 'clap', 'rim', 'sd']
        },
        'Hat/Air': {
          durationMin: 0.03,
          durationMax: 0.35,
          sharpnessTarget: 'any',
          preferredBand: 'high',
          minBandEnergy: 0.35,
          keywords: ['hat', 'hihat', 'ch', 'oh', 'shaker']
        },
        'Tonal/Melodic': {
          durationMin: 0.40,
          durationMax: 3.5,
          keywords: ['synth', 'chord', 'lead', 'bass', 'keys', 'melody']
        },
        'Texture/Wildcard': {
          durationMin: 0.30,
          durationMax: 4.0,
          keywords: ['fx', 'noise', 'sweep', 'foley', 'atmo']
        }
      }
    }
  },
  {
    id: 'trap808',
    name: 'Modern Trap / 808',
    description: 'Heavy sub/808 kicks, razor-sharp claps/rims, sizzle hats & dark minor bells',
    icon: '⚡',
    isFactory: true,
    criteria: {
      durationMin: 0.04,
      durationMax: 2.8,
      sharpnessTarget: 'punchy',
      frequencyBias: 'warm-sub',
      keyLockMode: 'auto',
      macroPunch: 80,
      macroLength: 60,
      macroTone: 'warm',
      genreKeywords: ['trap', 'drill', '808', 'metro', 'southside', 'spinz', 'pierre', 'wheezy', 'atlanta', 'sub'],
      genreAffinityStrength: 75,
      antiMaskingEnabled: true,
      packAffinityEnabled: true,
      roleTemplates: {
        4: ['Kick/Low', 'Snare/Snap', 'Hat/Air', 'Tonal/Melodic'],
        6: ['Kick/Low', 'Kick/Low', 'Snare/Snap', 'Hat/Air', 'Hat/Air', 'Tonal/Melodic'],
        8: ['Kick/Low', 'Kick/Low', 'Snare/Snap', 'Snare/Snap', 'Hat/Air', 'Hat/Air', 'Tonal/Melodic', 'Texture/Wildcard']
      },
      roleProfiles: {
        'Kick/Low': {
          durationMin: 0.30,
          durationMax: 2.5,
          sharpnessTarget: 'punchy',
          minSharpness: 65,
          preferredBand: 'low',
          minBandEnergy: 0.50,
          keywords: ['808', 'sub', 'spinz', 'boom', 'heavy', 'distorted', 'kick'],
          negativeKeywords: ['acoustic', 'vintage', 'real', 'rock', 'live', 'jazz']
        },
        'Snare/Snap': {
          durationMin: 0.08,
          durationMax: 0.60,
          sharpnessTarget: 'punchy',
          minSharpness: 75,
          preferredBand: 'mid',
          minBandEnergy: 0.35,
          keywords: ['clap', 'rim', 'snap', 'tight', 'chop', 'trap'],
          negativeKeywords: ['brush', 'jazz', 'acoustic']
        },
        'Hat/Air': {
          durationMin: 0.02,
          durationMax: 0.25,
          sharpnessTarget: 'punchy',
          preferredBand: 'high',
          minBandEnergy: 0.45,
          keywords: ['closed', 'roll', 'sizzle', 'ch', 'hihat', 'clean', 'bright'],
          negativeKeywords: ['tambourine', 'ride']
        },
        'Tonal/Melodic': {
          durationMin: 0.40,
          durationMax: 4.0,
          keywords: ['bell', 'flute', 'pluck', 'lead', 'synth', 'chord', 'vocal', 'brass', 'dark', 'minor'],
          negativeKeywords: ['jazz', 'acoustic guitar', 'country']
        },
        'Texture/Wildcard': {
          durationMin: 0.20,
          durationMax: 2.5,
          keywords: ['riser', 'fx', 'laser', 'gunshot', 'chant', 'vox', 'glitch']
        }
      }
    }
  },
  {
    id: 'boombap',
    name: 'Boom Bap / 90s',
    description: 'Punchy acoustic kicks, crunchy vinyl snares, crisp hats & soulful Rhodes/bass chops',
    icon: '📻',
    isFactory: true,
    criteria: {
      durationMin: 0.06,
      durationMax: 2.2,
      sharpnessTarget: 'punchy',
      frequencyBias: 'mid-focused',
      keyLockMode: 'auto',
      macroPunch: 70,
      macroLength: 45,
      macroTone: 'warm',
      genreKeywords: ['boombap', '90s', 'vintage', 'dusty', 'vinyl', 'mpc', 'dilla', 'premier', 'soul', 'hiphop', 'classic', 'eastcoast'],
      genreAffinityStrength: 75,
      antiMaskingEnabled: true,
      packAffinityEnabled: true,
      roleTemplates: {
        4: ['Kick/Low', 'Snare/Snap', 'Hat/Air', 'Tonal/Melodic'],
        6: ['Kick/Low', 'Snare/Snap', 'Hat/Air', 'Texture/Wildcard', 'Tonal/Melodic', 'Snare/Snap'],
        8: ['Kick/Low', 'Kick/Low', 'Snare/Snap', 'Snare/Snap', 'Hat/Air', 'Hat/Air', 'Tonal/Melodic', 'Texture/Wildcard']
      },
      roleProfiles: {
        'Kick/Low': {
          durationMin: 0.15,
          durationMax: 0.70,
          sharpnessTarget: 'punchy',
          minSharpness: 65,
          preferredBand: 'low',
          minBandEnergy: 0.35,
          keywords: ['acoustic', 'punch', 'bd', 'fat', 'vinyl', 'analog', 'heavy', 'tight'],
          negativeKeywords: ['808', 'laser', 'synth', 'future']
        },
        'Snare/Snap': {
          durationMin: 0.15,
          durationMax: 0.75,
          sharpnessTarget: 'punchy',
          minSharpness: 70,
          preferredBand: 'mid',
          minBandEnergy: 0.38,
          keywords: ['snare', 'crack', 'rimshot', 'vintage', 'acoustic', 'fat', 'ghost'],
          negativeKeywords: ['laser', 'edm', 'synth']
        },
        'Hat/Air': {
          durationMin: 0.04,
          durationMax: 0.30,
          sharpnessTarget: 'any',
          preferredBand: 'high',
          minBandEnergy: 0.30,
          keywords: ['closed', 'shaker', 'real', 'acoustic', 'tamb', 'tight', 'pedal']
        },
        'Tonal/Melodic': {
          durationMin: 0.50,
          durationMax: 3.5,
          keywords: ['rhodes', 'piano', 'organ', 'upright', 'jazz', 'soul', 'chords', 'keys', 'horns', 'bass']
        },
        'Texture/Wildcard': {
          durationMin: 0.50,
          durationMax: 4.0,
          keywords: ['vinyl', 'crackle', 'noise', 'dust', 'scratch', 'needle', 'static']
        }
      }
    }
  },
  {
    id: 'house',
    name: 'House & Techno',
    description: 'Driving 4-on-the-floor kicks, snappy 909 claps, bright open/closed hats & rhythmic chord stabs',
    icon: '🎛️',
    isFactory: true,
    criteria: {
      durationMin: 0.05,
      durationMax: 2.0,
      sharpnessTarget: 'punchy',
      frequencyBias: 'bright-air',
      keyLockMode: 'auto',
      macroPunch: 75,
      macroLength: 45,
      macroTone: 'bright',
      genreKeywords: ['house', 'techno', 'club', '909', 'rave', 'four', '4x4', 'deep', 'chicago', 'detroit'],
      genreAffinityStrength: 70,
      antiMaskingEnabled: true,
      packAffinityEnabled: true,
      roleTemplates: {
        4: ['Kick/Low', 'Snare/Snap', 'Hat/Air', 'Tonal/Melodic'],
        6: ['Kick/Low', 'Snare/Snap', 'Hat/Air', 'Hat/Air', 'Tonal/Melodic', 'Texture/Wildcard'],
        8: ['Kick/Low', 'Snare/Snap', 'Hat/Air', 'Hat/Air', 'Tonal/Melodic', 'Tonal/Melodic', 'Texture/Wildcard', 'Texture/Wildcard']
      },
      roleProfiles: {
        'Kick/Low': {
          durationMin: 0.20,
          durationMax: 0.65,
          sharpnessTarget: 'punchy',
          minSharpness: 70,
          preferredBand: 'low',
          minBandEnergy: 0.45,
          keywords: ['909', 'punch', 'deep', 'solid', 'thump', 'club', 'click']
        },
        'Snare/Snap': {
          durationMin: 0.10,
          durationMax: 0.65,
          sharpnessTarget: 'punchy',
          minSharpness: 65,
          preferredBand: 'mid',
          minBandEnergy: 0.35,
          keywords: ['clap', '909', 'snare', 'verb', 'rim']
        },
        'Hat/Air': {
          durationMin: 0.04,
          durationMax: 0.50,
          sharpnessTarget: 'punchy',
          preferredBand: 'high',
          minBandEnergy: 0.45,
          keywords: ['open', 'closed', '909', 'shaker', 'ride', 'cymbal', 'groove']
        },
        'Tonal/Melodic': {
          durationMin: 0.20,
          durationMax: 2.5,
          keywords: ['stab', 'chord', 'bass', 'acid', 'organ', 'synth', 'saw', 'pluck']
        },
        'Texture/Wildcard': {
          durationMin: 0.50,
          durationMax: 3.5,
          keywords: ['sweep', 'uplifter', 'riser', 'white noise', 'crash', 'impact']
        }
      }
    }
  },
  {
    id: 'lofi',
    name: 'Lo-Fi Soul',
    description: 'Warm mellow kicks, soft rim snaps, organic hats, vinyl noise & dusty keys',
    icon: '☕',
    isFactory: true,
    criteria: {
      durationMin: 0.08,
      durationMax: 3.2,
      sharpnessTarget: 'soft',
      frequencyBias: 'warm-sub',
      keyLockMode: 'auto',
      macroPunch: 35,
      macroLength: 65,
      macroTone: 'warm',
      genreKeywords: ['lofi', 'soul', 'chill', 'tape', 'cassette', 'warm', 'dusty', 'wobble', 'chilled', 'study', 'relax'],
      genreAffinityStrength: 75,
      antiMaskingEnabled: true,
      packAffinityEnabled: true,
      roleTemplates: {
        4: ['Kick/Low', 'Snare/Snap', 'Hat/Air', 'Tonal/Melodic'],
        6: ['Kick/Low', 'Snare/Snap', 'Hat/Air', 'Tonal/Melodic', 'Tonal/Melodic', 'Texture/Wildcard'],
        8: ['Kick/Low', 'Snare/Snap', 'Hat/Air', 'Tonal/Melodic', 'Tonal/Melodic', 'Texture/Wildcard', 'Texture/Wildcard', 'Texture/Wildcard']
      },
      roleProfiles: {
        'Kick/Low': {
          durationMin: 0.20,
          durationMax: 0.90,
          sharpnessTarget: 'soft',
          maxSharpness: 72,
          preferredBand: 'low',
          minBandEnergy: 0.35,
          keywords: ['warm', 'soft', 'mellow', 'round', 'acoustic', 'tape', 'thud'],
          negativeKeywords: ['harsh', 'bright', 'laser', 'edm']
        },
        'Snare/Snap': {
          durationMin: 0.10,
          durationMax: 0.80,
          sharpnessTarget: 'soft',
          maxSharpness: 75,
          preferredBand: 'mid',
          minBandEnergy: 0.35,
          keywords: ['rim', 'click', 'brush', 'soft', 'snap', 'wood', 'dusty']
        },
        'Hat/Air': {
          durationMin: 0.04,
          durationMax: 0.40,
          sharpnessTarget: 'any',
          preferredBand: 'high',
          minBandEnergy: 0.25,
          keywords: ['tape', 'damped', 'organic', 'soft', 'shaker', 'felt']
        },
        'Tonal/Melodic': {
          durationMin: 0.60,
          durationMax: 4.0,
          keywords: ['rhodes', 'wurlitzer', 'electric piano', 'jazz', 'warm bass', 'nylon', 'guitar', 'chords', 'keys']
        },
        'Texture/Wildcard': {
          durationMin: 1.0,
          durationMax: 5.0,
          keywords: ['cassette', 'tape hiss', 'rain', 'vinyl', 'ambience', 'foley', 'room']
        }
      }
    }
  },
  {
    id: 'organic',
    name: 'Acoustic & Organic',
    description: 'Live natural percussion, wooden rims, shakers, upright bass & room foley',
    icon: '🌿',
    isFactory: true,
    criteria: {
      durationMin: 0.05,
      durationMax: 3.0,
      sharpnessTarget: 'moderate',
      frequencyBias: 'mid-focused',
      keyLockMode: 'auto',
      macroPunch: 55,
      macroLength: 50,
      macroTone: 'neutral',
      genreKeywords: ['acoustic', 'live', 'organic', 'wood', 'human', 'room', 'foley', 'percussion', 'natural', 'real', 'world'],
      genreAffinityStrength: 75,
      antiMaskingEnabled: true,
      packAffinityEnabled: true,
      roleTemplates: {
        4: ['Kick/Low', 'Snare/Snap', 'Hat/Air', 'Texture/Wildcard'],
        6: ['Kick/Low', 'Snare/Snap', 'Hat/Air', 'Tonal/Melodic', 'Texture/Wildcard', 'Texture/Wildcard'],
        8: ['Kick/Low', 'Snare/Snap', 'Hat/Air', 'Hat/Air', 'Tonal/Melodic', 'Tonal/Melodic', 'Texture/Wildcard', 'Texture/Wildcard']
      },
      roleProfiles: {
        'Kick/Low': {
          durationMin: 0.15,
          durationMax: 0.80,
          sharpnessTarget: 'moderate',
          minSharpness: 55,
          maxSharpness: 85,
          preferredBand: 'low',
          minBandEnergy: 0.30,
          keywords: ['acoustic', 'live', 'natural', 'bela', 'wood', 'cajon']
        },
        'Snare/Snap': {
          durationMin: 0.10,
          durationMax: 0.70,
          sharpnessTarget: 'moderate',
          minSharpness: 60,
          maxSharpness: 90,
          preferredBand: 'mid',
          minBandEnergy: 0.35,
          keywords: ['rim', 'wood', 'snap', 'live', 'stick', 'cross', 'organic']
        },
        'Hat/Air': {
          durationMin: 0.04,
          durationMax: 0.35,
          sharpnessTarget: 'any',
          preferredBand: 'high',
          minBandEnergy: 0.28,
          keywords: ['shaker', 'tambourine', 'cabasa', 'maraca', 'seeds', 'organic']
        },
        'Tonal/Melodic': {
          durationMin: 0.50,
          durationMax: 4.0,
          keywords: ['upright', 'acoustic bass', 'guitar', 'kalimba', 'marimba', 'wooden', 'harp', 'flute']
        },
        'Texture/Wildcard': {
          durationMin: 0.50,
          durationMax: 4.0,
          keywords: ['foley', 'footstep', 'water', 'leaves', 'forest', 'room', 'organic', 'creak']
        }
      }
    }
  },
  {
    id: 'glitch',
    name: 'Experimental / Glitch',
    description: 'Extreme transients, metallic hits, noisy sweeps & modular sound design',
    icon: '🧪',
    isFactory: true,
    criteria: {
      durationMin: 0.03,
      durationMax: 4.5,
      sharpnessTarget: 'punchy',
      frequencyBias: 'bright-air',
      keyLockMode: 'any',
      macroPunch: 85,
      macroLength: 70,
      macroTone: 'bright',
      genreKeywords: ['glitch', 'fx', 'modular', 'fm', 'metallic', 'noise', 'industrial', 'circuit', 'granulator', 'digital', 'weird'],
      genreAffinityStrength: 80,
      antiMaskingEnabled: true,
      packAffinityEnabled: false,
      roleTemplates: {
        4: ['Kick/Low', 'Snare/Snap', 'Texture/Wildcard', 'Texture/Wildcard'],
        6: ['Kick/Low', 'Snare/Snap', 'Tonal/Melodic', 'Texture/Wildcard', 'Texture/Wildcard', 'Texture/Wildcard'],
        8: ['Kick/Low', 'Snare/Snap', 'Hat/Air', 'Tonal/Melodic', 'Texture/Wildcard', 'Texture/Wildcard', 'Texture/Wildcard', 'Texture/Wildcard']
      },
      roleProfiles: {
        'Kick/Low': {
          durationMin: 0.10,
          durationMax: 1.2,
          sharpnessTarget: 'punchy',
          minSharpness: 75,
          preferredBand: 'low',
          minBandEnergy: 0.35,
          keywords: ['click', 'sub', 'fm', 'distorted', 'glitch', 'digital', 'heavy']
        },
        'Snare/Snap': {
          durationMin: 0.05,
          durationMax: 0.50,
          sharpnessTarget: 'punchy',
          minSharpness: 75,
          preferredBand: 'mid',
          minBandEnergy: 0.30,
          keywords: ['metal', 'click', 'zap', 'pop', 'crack', 'glitch']
        },
        'Hat/Air': {
          durationMin: 0.02,
          durationMax: 0.30,
          sharpnessTarget: 'punchy',
          preferredBand: 'high',
          minBandEnergy: 0.35,
          keywords: ['tick', 'static', 'glitch', 'noise', 'blip', 'metallic']
        },
        'Tonal/Melodic': {
          durationMin: 0.20,
          durationMax: 3.0,
          keywords: ['fm', 'metallic', 'modular', 'abstract', 'acid', 'drone', 'arp']
        },
        'Texture/Wildcard': {
          durationMin: 0.30,
          durationMax: 5.0,
          keywords: ['glitch', 'granulator', 'circuit', 'drone', 'sweep', 'burst', 'noise']
        }
      }
    }
  }
];

export const DEFAULT_PRESET_ID = 'standard';

export function getFactoryPreset(id: string): KitPreset | undefined {
  return FACTORY_PRESETS.find(p => p.id === id);
}

export function mergeCriteria(base: AcousticCriteria, overrides?: Partial<AcousticCriteria>): AcousticCriteria {
  if (!overrides) return { ...base };
  return {
    ...base,
    ...overrides,
    roleTemplates: {
      ...(base.roleTemplates || FACTORY_ROLE_TEMPLATES),
      ...(overrides.roleTemplates || {})
    },
    roleProfiles: {
      ...(base.roleProfiles || {}),
      ...(overrides.roleProfiles || {})
    }
  };
}
