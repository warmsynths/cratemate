import { css } from 'lit';
import { classifyHat } from '../services/layouts.ts';
import type { HardwareTarget, LayoutSlot, PadSlot, SampleRole } from '../types/index.ts';

/** The seven sound types the UI shows. Hats split into closed and open; every other type is one role. */
export type Category = 'Kick' | 'Snare' | 'Closed HH' | 'Open HH' | 'Perc' | 'Melodic' | 'Misc';

export const CATS: Category[] = ['Kick', 'Snare', 'Closed HH', 'Open HH', 'Perc', 'Melodic', 'Misc'];

export const CAT_COLOR: Record<Category, string> = {
  Kick: '#cf8a68',
  Snare: '#dfbd6f',
  'Closed HH': '#b4b87f',
  'Open HH': '#93b5ae',
  Perc: '#ddaea0',
  Melodic: '#b6a9c4',
  Misc: '#c8bca6'
};

export const CAT_SHORT: Record<Category, string> = {
  Kick: 'Kick', Snare: 'Snare', 'Closed HH': 'Hat', 'Open HH': 'Open', Perc: 'Perc', Melodic: 'Melo', Misc: 'Misc'
};

/** Small corner shape per sound type: [border-radius, clip-path]. */
export const GLYPH: Record<Category, [string, string]> = {
  Kick: ['50%', 'none'],
  Snare: ['2px', 'none'],
  'Closed HH': ['0', 'polygon(50% 0,100% 50%,50% 100%,0 50%)'],
  'Open HH': ['50%', 'path(evenodd,"M6.5 0A6.5 6.5 0 1 1 6.5 13A6.5 6.5 0 1 1 6.5 0ZM6.5 3.5A3 3 0 1 0 6.5 9.5A3 3 0 1 0 6.5 3.5Z")'],
  Perc: ['0', 'polygon(50% 0,100% 100%,0 100%)'],
  Melodic: ['13px 13px 0 0', 'inset(0 0 40% 0)'],
  Misc: ['0', 'polygon(35% 0,65% 0,65% 35%,100% 35%,100% 65%,65% 65%,65% 100%,35% 100%,35% 65%,0 65%,0 35%,35% 35%)']
};

const ROLE_CAT: Record<SampleRole, Category> = {
  'Kick/Low': 'Kick',
  'Snare/Snap': 'Snare',
  'Hat/Air': 'Closed HH',
  'Perc/Hit': 'Perc',
  'Tonal/Melodic': 'Melodic',
  'Texture/Wildcard': 'Misc'
};

/** Which sound type a pad shows as. Hats use the pad's layout constraint, then the sample itself. */
export function categoryOf(pad: Pick<PadSlot, 'role' | 'hat' | 'sample'>): Category {
  if (pad.role !== 'Hat/Air') return ROLE_CAT[pad.role] ?? 'Misc';
  const kind = pad.hat ?? (pad.sample ? classifyHat(pad.sample) : 'closed');
  return kind === 'open' ? 'Open HH' : 'Closed HH';
}

/** Generator slot for one pad of a sound type. */
export function slotFor(cat: Category): LayoutSlot {
  switch (cat) {
    case 'Kick': return { role: 'Kick/Low' };
    case 'Snare': return { role: 'Snare/Snap' };
    case 'Closed HH': return { role: 'Hat/Air', hat: 'closed' };
    case 'Open HH': return { role: 'Hat/Air', hat: 'open' };
    case 'Perc': return { role: 'Perc/Hit' };
    case 'Melodic': return { role: 'Tonal/Melodic' };
    default: return { role: 'Texture/Wildcard' };
  }
}

/** A darker shade of a sound type's colour, for the tri-tone waveform bands. */
export const tone = (cat: Category, pct: number) => `color-mix(in oklch, ${CAT_COLOR[cat]} ${pct}%, #3b2e25)`;

/** Split a pad count across sound types in proportion to their weights (largest remainder). */
export function alloc(weights: Record<Category, number>, count: number): Record<Category, number> {
  const out = Object.fromEntries(CATS.map(c => [c, 0])) as Record<Category, number>;
  const act = CATS.filter(c => weights[c] > 0);
  const tot = act.reduce((a, c) => a + weights[c], 0);
  if (!tot) return out;
  const raw = act.map(c => {
    const n = weights[c] / tot * count;
    return { c, n, f: Math.floor(n) };
  });
  let left = count - raw.reduce((a, r) => a + r.f, 0);
  [...raw].sort((a, b) => (b.n - b.f) - (a.n - a.f)).forEach(r => { if (left > 0) { r.f++; left--; } });
  raw.forEach(r => { out[r.c] = r.f; });
  return out;
}

export interface DeviceDef {
  id: HardwareTarget;
  name: string;
  spec: string;
  /** Sample memory in seconds, 0 when the device has no practical limit for a kit. */
  budget: number;
}

export const DEVICES: DeviceDef[] = [
  { id: 'sp404mk2', name: 'SP-404MKII', spec: 'WAVs for the IMPORT folder · 48 kHz', budget: 0 },
  { id: 'm8', name: 'Dirtywave M8', spec: 'Numbered WAVs and a sliced chain · 44.1 kHz', budget: 0 },
  { id: 'po33', name: 'PO-33 K.O!', spec: 'One chain to play in over audio · 40 s', budget: 40 },
  { id: 'universal', name: 'Generic WAV', spec: 'Numbered WAVs for any sampler', budget: 0 }
];

export const NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
export const SCALE_STEPS = { minor: [0, 2, 3, 5, 7, 8, 10], major: [0, 2, 4, 5, 7, 9, 11] };

/** Ruler colours for the six pad controls. */
export const KNOB_C = ['#d9a441', '#d98a5f', '#b4b87f', '#93b5ae', '#ddaea0', '#b6a9c4'];

/** Base element styles shared by every CrateMate component. */
export const baseStyles = css`
  :host {
    font-family: 'Figtree', system-ui, sans-serif;
    color: #3b2e25;
  }
  *, *::before, *::after { box-sizing: border-box; scrollbar-width: none; }
  *::-webkit-scrollbar { display: none; }
  button, input { font: inherit; color: inherit; }
  button { -webkit-tap-highlight-color: transparent; }
  input::placeholder { color: #a08d76; }
  button:focus-visible, input:focus-visible, [tabindex]:focus-visible {
    outline: 2px solid #3b2e25;
    outline-offset: 2px;
  }
  .display { font-family: 'Righteous', cursive; }
  .caps { font-size: 13px; font-weight: 700; letter-spacing: 1.2px; color: #8a7764; white-space: nowrap; }
  .stripes { flex: 0 0 auto; display: flex; flex-direction: column; }
  .stripes > i { display: block; }
  .stripes > i:nth-child(1) { background: #d9a441; }
  .stripes > i:nth-child(2) { background: #c0643a; }
  .stripes > i:nth-child(3) { background: #8a4a32; }
`;
