# 05 - Smart Harmonic Kit Generator & Slot Balancing

Type: prototype
Status: resolved
Blocked by: 04

## Question

How should the generator construct 4, 6, and 8 pad kits that guarantee role balance (avoiding redundant kicks or clashing frequencies), enforce harmonic compatibility (Camelot wheel / Circle of Fifths key alignment between multiple tonal picks), respect user-locked pads, and provide random rerolling for unlocked slots with instant preview?

## Answer

Implemented in `src/services/kit-generator.ts`:
1. Fixed role templates for 4, 6, and 8 pads:
   - 4 Pads: Kick/Low, Snare/Snap, Hat/Air, Tonal/Melodic.
   - 6 Pads: Kick/Low, Snare/Snap, Hat/Air, Snare/Snap (Perc), Tonal/Melodic, Texture/Wildcard.
   - 8 Pads: Kick/Low, Snare/Snap, Hat/Air, Hat/Air, Tonal/Melodic (Bass), Tonal/Melodic (Lead/Chord), Texture/Wildcard, Texture/Wildcard.
2. Harmonic Camelot Wheel engine: when a tonal sample is locked or chosen, accompanying tonal picks are filtered by compatible keys (same key, $\pm 1$ step on Camelot wheel, or relative major/minor).
3. Pad locking preserves locked slots when clicking "Reroll Unlocked", while "Reroll Entire Kit" resets all slots to generate a new cohesive palette.
4. Built-in synthesized factory demo kit ensures instant playability even before user scans local folders.
