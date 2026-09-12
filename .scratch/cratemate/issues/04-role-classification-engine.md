# 04 - Automatic Sample Role Categorization Engine

Type: prototype
Status: resolved
Blocked by: 03

## Question

How should the classification engine combine acoustic profile metrics (spectral energy distribution, transient sharpness, duration, periodicity confidence) with filename token heuristics (e.g. `bd`/`kick`, `sd`/`snare`/`clap`, `hh`/`hat`, `808`/`bass`/`synth`, `fx`/`vox`) to accurately assign each sample to one of five kit roles (`Kick/Low`, `Snare/Snap`, `Hat/Air`, `Tonal/Melodic`, `Texture/Wildcard`) without misclassifying edge cases?

## Answer

Implemented in `src/services/classifier.ts`:
1. Lexical regex cued against common drum, loop, and production tokens (`kick|bd`, `snare|sd|clap|rim`, `hat|hh|cymbal`, `synth|lead|bass|chord|key|vocal`, `fx|foley|sweep|atmo`).
2. Acoustic metric validation:
   - High periodicity confidence ($>0.70$) and duration $>0.35$s $\rightarrow$ `Tonal/Melodic`.
   - Low energy dominant ($>0.45$), punchy rise time, duration $\le 2.0$s $\rightarrow$ `Kick/Low`.
   - Mid energy dominant ($>0.40$), transient sharpness $\ge 45$, duration $\le 1.5$s $\rightarrow$ `Snare/Snap`.
   - High energy dominant ($>0.42$), low bass, crisp rise time $\rightarrow$ `Hat/Air`.
   - Long duration ($>2.5$s) or low sharpness ($\le 25$) $\rightarrow$ `Texture/Wildcard`.
3. Filename priors guide classification, while acoustic metrics catch unlabelled files or override misleading tags.
