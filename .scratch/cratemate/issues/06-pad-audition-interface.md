# 06 - Pad Grid View, Auditioning & Visual Readouts

Type: prototype
Status: resolved
Blocked by: 05

## Question

How should the Lit pad grid component render interactive pads with low-latency Web Audio auditioning, keyboard triggering (`1`–`8` and `QWERTY` rows), mini waveform visualization, lock toggles, role tags, and responsive state feedback (trigger animations, loading indicators)?

## Answer

Implemented in `src/components/sample-pad.ts`, `src/components/pad-grid.ts`, and `src/components/waveform-view.ts`:
1. `<sample-pad>` renders pad cards with role-specific glowing accents (amber kick, cyan snare, emerald hat, purple tonal, orange texture).
2. Mini waveform canvas renders 64-point peak envelope with high-DPI scaling and animated playhead sweep during playback.
3. Interactive triggers support both mouse clicks and global keyboard hotkeys (`1`–`8` and `Q W E R` / `A S D F`), ignoring keystrokes when focused in text inputs.
4. Padlock button provides tactile visual state (golden border when locked), and Copy Path button gives immediate visual feedback.
