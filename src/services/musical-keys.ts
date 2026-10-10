export type MusicalScale = 'minor' | 'major';

export interface MusicalKeyDef {
  root: string;           // 'C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'
  scale: MusicalScale;    // 'minor' | 'major'
  camelot: string;        // e.g. '8A', '8B'
  name: string;           // e.g. 'A Minor', 'C Major'
  shortName: string;      // e.g. 'Am', 'C Maj'
  semitoneIndex: number;  // 0-11 (C=0, C#=1, ..., B=11)
  enharmonic?: string;    // 'Db', 'Eb', 'Gb', 'Ab', 'Bb'
}

export const ROOT_NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;

export const NOTE_SEMITONES: Record<string, number> = {
  'C': 0, 'B#': 0,
  'C#': 1, 'Db': 1,
  'D': 2,
  'D#': 3, 'Eb': 3,
  'E': 4, 'Fb': 4,
  'F': 5, 'E#': 5,
  'F#': 6, 'Gb': 6,
  'G': 7,
  'G#': 8, 'Ab': 8,
  'A': 9,
  'A#': 10, 'Bb': 10,
  'B': 11, 'Cb': 11
};

export const CAMELOT_TO_KEY: Record<string, MusicalKeyDef> = {
  '1A': { root: 'G#', scale: 'minor', camelot: '1A', name: 'G# Minor / Abm', shortName: 'Abm', semitoneIndex: 8, enharmonic: 'Ab' },
  '1B': { root: 'B',  scale: 'major', camelot: '1B', name: 'B Major', shortName: 'B Maj', semitoneIndex: 11 },
  '2A': { root: 'D#', scale: 'minor', camelot: '2A', name: 'D# Minor / Ebm', shortName: 'Ebm', semitoneIndex: 3, enharmonic: 'Eb' },
  '2B': { root: 'F#', scale: 'major', camelot: '2B', name: 'F# Major / Gb Maj', shortName: 'F# Maj', semitoneIndex: 6, enharmonic: 'Gb' },
  '3A': { root: 'A#', scale: 'minor', camelot: '3A', name: 'A# Minor / Bbm', shortName: 'Bbm', semitoneIndex: 10, enharmonic: 'Bb' },
  '3B': { root: 'C#', scale: 'major', camelot: '3B', name: 'C# Major / Db Maj', shortName: 'Db Maj', semitoneIndex: 1, enharmonic: 'Db' },
  '4A': { root: 'F',  scale: 'minor', camelot: '4A', name: 'F Minor', shortName: 'Fm', semitoneIndex: 5 },
  '4B': { root: 'G#', scale: 'major', camelot: '4B', name: 'G# Major / Ab Maj', shortName: 'Ab Maj', semitoneIndex: 8, enharmonic: 'Ab' },
  '5A': { root: 'C',  scale: 'minor', camelot: '5A', name: 'C Minor', shortName: 'Cm', semitoneIndex: 0 },
  '5B': { root: 'D#', scale: 'major', camelot: '5B', name: 'D# Major / Eb Maj', shortName: 'Eb Maj', semitoneIndex: 3, enharmonic: 'Eb' },
  '6A': { root: 'G',  scale: 'minor', camelot: '6A', name: 'G Minor', shortName: 'Gm', semitoneIndex: 7 },
  '6B': { root: 'A#', scale: 'major', camelot: '6B', name: 'A# Major / Bb Maj', shortName: 'Bb Maj', semitoneIndex: 10, enharmonic: 'Bb' },
  '7A': { root: 'D',  scale: 'minor', camelot: '7A', name: 'D Minor', shortName: 'Dm', semitoneIndex: 2 },
  '7B': { root: 'F',  scale: 'major', camelot: '7B', name: 'F Major', shortName: 'F Maj', semitoneIndex: 5 },
  '8A': { root: 'A',  scale: 'minor', camelot: '8A', name: 'A Minor', shortName: 'Am', semitoneIndex: 9 },
  '8B': { root: 'C',  scale: 'major', camelot: '8B', name: 'C Major', shortName: 'C Maj', semitoneIndex: 0 },
  '9A': { root: 'E',  scale: 'minor', camelot: '9A', name: 'E Minor', shortName: 'Em', semitoneIndex: 4 },
  '9B': { root: 'G',  scale: 'major', camelot: '9B', name: 'G Major', shortName: 'G Maj', semitoneIndex: 7 },
  '10A': { root: 'B', scale: 'minor', camelot: '10A', name: 'B Minor', shortName: 'Bm', semitoneIndex: 11 },
  '10B': { root: 'D', scale: 'major', camelot: '10B', name: 'D Major', shortName: 'D Maj', semitoneIndex: 2 },
  '11A': { root: 'F#', scale: 'minor', camelot: '11A', name: 'F# Minor / Gbm', shortName: 'F#m', semitoneIndex: 6, enharmonic: 'Gb' },
  '11B': { root: 'A', scale: 'major', camelot: '11B', name: 'A Major', shortName: 'A Maj', semitoneIndex: 9 },
  '12A': { root: 'C#', scale: 'minor', camelot: '12A', name: 'C# Minor / Dbm', shortName: 'C#m', semitoneIndex: 1, enharmonic: 'Db' },
  '12B': { root: 'E', scale: 'major', camelot: '12B', name: 'E Major', shortName: 'E Maj', semitoneIndex: 4 }
};

/**
 * Get Camelot key string from root note and scale
 */
export function getCamelotFromRoot(root: string, scale: MusicalScale = 'minor'): string {
  const normRoot = root.toUpperCase().trim();
  for (const [camelot, def] of Object.entries(CAMELOT_TO_KEY)) {
    if (def.scale === scale) {
      if (def.root.toUpperCase() === normRoot || (def.enharmonic && def.enharmonic.toUpperCase() === normRoot)) {
        return camelot;
      }
    }
  }
  return scale === 'minor' ? '8A' : '8B';
}

/**
 * Get definition for a Camelot code or root note
 */
export function getMusicalKeyDef(camelotOrRoot: string): MusicalKeyDef {
  const upper = camelotOrRoot.toUpperCase().trim();
  if (CAMELOT_TO_KEY[upper]) {
    return CAMELOT_TO_KEY[upper];
  }
  const camelot = getCamelotFromRoot(upper, 'minor');
  return CAMELOT_TO_KEY[camelot] || CAMELOT_TO_KEY['8A'];
}

/**
 * Get compatible Camelot keys (same key, +/-1 step on wheel, relative major/minor)
 */
export function getHarmonicMatches(camelotKey: string): {
  exact: string;
  subdominant: string; // -1 step
  dominant: string;    // +1 step
  relative: string;    // major/minor pair
  all: string[];
} {
  const match = camelotKey.match(/^(\d{1,2})([AB])$/);
  if (!match) {
    return { exact: camelotKey, subdominant: camelotKey, dominant: camelotKey, relative: camelotKey, all: [camelotKey] };
  }

  const num = parseInt(match[1], 10);
  const letter = match[2];
  const opp = letter === 'A' ? 'B' : 'A';

  const prevNum = num === 1 ? 12 : num - 1;
  const nextNum = num === 12 ? 1 : num + 1;

  const exact = `${num}${letter}`;
  const subdominant = `${prevNum}${letter}`;
  const dominant = `${nextNum}${letter}`;
  const relative = `${num}${opp}`;

  return {
    exact,
    subdominant,
    dominant,
    relative,
    all: [exact, subdominant, dominant, relative]
  };
}

/**
 * Calculate shortest semitone pitch shift to tune a source note to a target note (-6 to +5 semitones)
 */
export function calculateSemitoneShift(sourceNote: string, targetNote: string): number {
  const cleanSource = sourceNote.replace(/[0-9\-]/g, '');
  const cleanTarget = targetNote.replace(/[0-9\-]/g, '');

  const srcSemi = NOTE_SEMITONES[cleanSource];
  const tgtSemi = NOTE_SEMITONES[cleanTarget];

  if (srcSemi === undefined || tgtSemi === undefined) return 0;

  let diff = (tgtSemi - srcSemi) % 12;
  if (diff > 6) diff -= 12;
  if (diff < -6) diff += 12;

  return diff;
}

/**
 * Heuristic extraction of musical key from audio filename
 * Recognizes formats like: "Rhodes_Am_90bpm", "Bass_C#min_120", "12A_Synth_Lead", "Loop_F_Maj", etc.
 */
export function parseKeyFromFilename(fileName: string): { rootKey?: string; camelotKey?: string } | null {
  const base = fileName.replace(/\.[^/.]+$/, '').trim();

  // Check for explicit Camelot code (e.g., "8A", "11B")
  const camelotMatch = base.match(/(?:^|[\s_\-\.\(\[])([1-9]|1[0-2])([abAB])(?:$|[\s_\-\.\)\]])/);
  if (camelotMatch) {
    const code = `${camelotMatch[1]}${camelotMatch[2].toUpperCase()}`;
    const def = CAMELOT_TO_KEY[code];
    if (def) {
      return { rootKey: def.shortName, camelotKey: code };
    }
  }

  // Check for standard note + minor/major (e.g., "Am", "C#min", "Eb_maj", "F#_Minor", "Gminor")
  const keyRegex = /(?:^|[\s_\-\.\(\[])([A-Ga-g][#b]?)(?:[\s_\-\.]*)?(min|maj|m|minor|major)(?:$|[\s_\-\.\)\]0-9])/i;
  const match = base.match(keyRegex);
  if (match) {
    let note = match[1].charAt(0).toUpperCase() + match[1].slice(1).toLowerCase();
    // Normalize accidentals
    if (note.length > 1) {
      if (note[1] === '#') note = note[0] + '#';
      else if (note[1] === 'b') note = note[0] + 'b';
    }
    const tag = match[2].toLowerCase();
    const isMinor = tag.startsWith('m') && !tag.startsWith('maj');
    const scale: MusicalScale = isMinor ? 'minor' : 'major';
    const camelot = getCamelotFromRoot(note, scale);
    const def = CAMELOT_TO_KEY[camelot];
    return {
      rootKey: def ? def.shortName : `${note}${isMinor ? 'm' : ''}`,
      camelotKey: camelot
    };
  }

  return null;
}
