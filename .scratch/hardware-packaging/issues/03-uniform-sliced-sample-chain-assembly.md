# 03 - Uniform Sliced Sample Chain Assembly

Type: prototype
Status: resolved
Blocked by: 01

## Question

How should CrateMate calculate uniform slice interval durations based on the longest kit sample, pad/concatenate the sample buffers into a single audio file, and output a sample chain WAV that allows M8 `SLICED` mode (e.g. 8 slices) and SP-404MKII auto-chop to trigger all kit sounds seamlessly?

## Answer

Implemented via `generateSampleChainBuffer(...)` in `src/services/hardware-packager.ts`:

1. **Hardware Equal-Division Alignment**:
   - Both Dirtywave M8 (`SLICED` mode) and Roland SP-404MKII (Chop -> Time Division) divide a sample chain into $K$ equal time slices ($K \in \{4, 8, 16\}$).
   - For an $N$-pad kit ($N \in \{4, 6, 8\}$), normalize slice count $K = 4$ for 4-pad kits, and $K = 8$ for 6-pad and 8-pad kits (padding empty trailing slots with silence).

2. **Slice Interval Calculation**:
   - Determine maximum sample duration across all active kit pads:
     $$D_{\max} = \max_{p \in \text{pads}} (\text{duration}(p))$$
   - Add a 50ms safety decay buffer to prevent abrupt transient cut-offs on reverb tails, and compute uniform slice frames:
     $$\text{sliceFrames} = \lceil (D_{\max} + 0.05) \times \text{targetSampleRate} \rceil$$
   - Total chain frame count:
     $$\text{totalFrames} = K \times \text{sliceFrames}$$

3. **Buffer Assembly & Silence Padding**:
   - Allocate target `AudioBuffer(numberOfChannels, totalFrames, targetSampleRate)`.
   - For each pad $i \in [0, N-1]$:
     - Offset index: $\text{startOffset} = i \times \text{sliceFrames}$.
     - Copy channel samples into target buffer from $\text{startOffset}$ to $\text{startOffset} + \text{sampleLength}$.
     - Remaining frames in the slice interval remain digital zero ($0.0$).
   - Encode the resulting chain buffer via 16-bit linear PCM encoder into `[KitName]_Chain.wav`.
   - Produces immediate, click-free slice triggering on M8 tracks and 1-click SP-404MKII pad chopping.

