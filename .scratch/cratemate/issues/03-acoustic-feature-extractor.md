# 03 - Acoustic Feature Extraction (Sharpness, Energy Balance, Pitch)

Type: prototype
Status: resolved
Blocked by: 02

## Question

What deterministic DSP algorithms will reliably calculate transient sharpness (attack rise-time and crest factor), tri-band frequency energy balance (Low $<250\text{ Hz}$, Mid $250-4000\text{ Hz}$, High $>4000\text{ Hz}$), fundamental pitch detection via normalized autocorrelation / YIN with note mapping (e.g. C3, F#2), and a 64-to-128 point peak waveform overview within milliseconds per sample?

## Answer

Implemented in `src/services/dsp.ts`:
1. **Transient Sharpness**: Calculates attack rise-time from 5% onset to 90% peak, plus crest factor ($20 \log_{10}(\text{Peak}/\text{RMS})$), normalized into a 0–100 score.
2. **Tri-band Frequency Energy**: Discrete multi-band filter simulations for Low ($<250$ Hz), Mid ($250-4000$ Hz), and High ($>4000$ Hz), yielding normalized ratios summing to 1.0.
3. **Pitch & Key Detection**: YIN-derived normalized autocorrelation difference function searching lag $\tau$ corresponding to 35 Hz – 1800 Hz with parabolic interpolation. Discovered $f_0$ is converted to MIDI note, note name (e.g. `A1`, `C3`), and Camelot Wheel key (e.g. `8A`, `5A`).
4. **Waveform Peak Bins**: Downsampled 64-point peak array normalized to $[0, 1]$ for lightweight UI rendering without keeping audio buffers in RAM.
