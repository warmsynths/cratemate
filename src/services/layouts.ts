import type { HatKind, LayoutSlot, PadLayout, SampleRecord, SampleRole } from '../types/index.ts';

/** Pad level used for ghost copies (16 = 100%). */
export const GHOST_LEVEL = 9;

const T: LayoutSlot = { role: 'Tonal/Melodic' };

/**
 * Finger-drumming layout for the SP-404MKII: the two right columns hold the drums,
 * main hit on the far right, ghost copy beside it. The two left columns are free for tones.
 *
 * Indices run 0-15 from bottom-left, matching the on-screen pad grid.
 */
export const SP_RIGHT_DRUMS: PadLayout = {
  id: 'sp-right-drums',
  name: 'Right-hand drums',
  description: 'Kick, snare, closed hat, open hat on the far-right column (ghost beside each). Tones on the left.',
  spNumbered: true,
  slots: [
    T, T, { role: 'Kick/Low', ghostOf: 3 }, { role: 'Kick/Low' },
    T, T, { role: 'Snare/Snap', ghostOf: 7 }, { role: 'Snare/Snap' },
    T, T, { role: 'Hat/Air', hat: 'closed', ghostOf: 11 }, { role: 'Hat/Air', hat: 'closed' },
    T, T, { role: 'Hat/Air', hat: 'open', ghostOf: 15 }, { role: 'Hat/Air', hat: 'open' }
  ],
  // kick, ghost kick, snare, ghost snare, closed, ghost closed, open, ghost open, then tones
  exportOrder: [3, 2, 7, 6, 11, 10, 15, 14, 0, 1, 4, 5, 8, 9, 12, 13]
};

export const PAD_LAYOUTS: PadLayout[] = [SP_RIGHT_DRUMS];
export const DEFAULT_LAYOUT_ID = SP_RIGHT_DRUMS.id;
export const NO_LAYOUT_ID = 'none';

export function getLayout(id?: string): PadLayout | undefined {
  return PAD_LAYOUTS.find(l => l.id === id);
}

/** SP-404MKII pad number (1-16, top-left = 1) for a grid index (0-15, bottom-left = 0). */
export function spPadNumber(index: number): number {
  return (3 - (index >> 2)) * 4 + (index & 3) + 1;
}

/** Pad number as the user's device shows it: SP-404MKII layouts count from the top-left, everything else from the bottom-left. */
export function padDisplayNumber(index: number, spNumbered = false): string {
  return String(spNumbered ? spPadNumber(index) : index + 1).padStart(2, '0');
}

/** How many pads of each role a layout has (for the LCD mix readout). */
export function layoutRoleMix(layout: PadLayout): Partial<Record<SampleRole, number>> {
  const mix: Partial<Record<SampleRole, number>> = {};
  for (const slot of layout.slots) mix[slot.role] = (mix[slot.role] ?? 0) + 1;
  return mix;
}

const OPEN_NAME = /\b(open|opn|oh|ride|crash|cymbal)\b/i;
const CLOSED_NAME = /\b(closed|clsd|ch|pedal|tick)\b/i;
const OPEN_MIN_SECONDS = 0.3;

/** Closed vs open hat, from filename cues first and tail length otherwise. */
export function classifyHat(sample: Pick<SampleRecord, 'fileName' | 'relativePath' | 'acousticProfile'>): HatKind {
  const name = sample.fileName.replace(/[-_.]/g, ' ');
  if (OPEN_NAME.test(name)) return 'open';
  if (CLOSED_NAME.test(name)) return 'closed';
  return sample.acousticProfile.duration >= OPEN_MIN_SECONDS ? 'open' : 'closed';
}

const DRUM_LABELS: Partial<Record<LayoutSlot['role'], string>> = { 'Kick/Low': 'KICK', 'Snare/Snap': 'SNARE' };

/** Pad caption for drum slots in a layout, e.g. "GHOST OPEN HAT". Tone pads keep their normal role caption. */
export function layoutSlotLabel(slot: LayoutSlot): string | undefined {
  const base = slot.role === 'Hat/Air' && slot.hat ? `${slot.hat === 'open' ? 'OPEN' : 'CLOSED'} HAT` : DRUM_LABELS[slot.role];
  if (!base) return undefined;
  return slot.ghostOf !== undefined ? `GHOST ${base}` : base;
}
