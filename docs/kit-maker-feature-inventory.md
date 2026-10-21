# Kit Maker feature inventory

Source: https://www.kit-maker.com (Kit Maker 3.0.1 docs, FAQ, release notes, format pages, reviews; crawled 2026-10-21).
Kit Maker 3 is a desktop app (Mac Apple Silicon + Windows) by Grayson Kilmer, $39 one-time. Companion app: Preset Maker ($29).
It is a **batch converter**: it takes sample packs you already own and writes native kit presets for many DAWs/hardware.
It does not synthesize, audition, or analyze audio; sorting is **keyword/folder-name based**, not acoustic.

Items are numbered (e.g. `2.7`) so we can reference them in the plan. "New in KM3" is flagged where the site says so.

---

## 1. Product / business

1.1 Desktop app, Mac (Apple Silicon only in KM3; KM2 was the last Intel build) and Windows 10/11.
1.2 One-time purchase, no subscription, no account. Free updates within KM3. KM2 owners: free (bought on/after 2025-10-19) or 30% off.
1.3 License: up to 2 computers; license lookup/recovery page; Lemon Squeezy (previously Gumroad).
1.4 Never modifies source samples: copies what it needs into a new "Kit Maker Kits" folder.
1.5 Does not ship any sounds. User supplies packs (Splice, Loopmasters, NI Expansions, etc.).
1.6 Public beta program (email list, feedback form with version/build/OS fields, optional log attachment).
1.7 In-app update check: version in top-right corner (tooltip, click → update dialog, green arrow when update waiting), Help > Check for Updates, skip-version option, release notes in dialog.
1.8 Support tooling: right-click logo menu (Send Support Files, Send License Log, Submit a Bug, Reveal Main Log / License Log / Config, Enable Reports); Verbose Logging; "Send Support Files" bundles logs + settings + recent reports into a .zip and opens an email.
1.9 Marketing/educational extras: per-DAW landing pages, YouTube tutorials, "How to make MPC Expansions" guide, free J Dilla MIDI drum loops pack (Classic / Ergonomic / Ableton layouts), reviews page, FAQ, per-format transfer guides.
1.10 Related product Preset Maker (see §14).

## 2. Import / input

2.1 Drag-and-drop folders onto the Import panel (multiple at once).
2.2 **Sample Pack Importer** (KM3, new): overlay with tabs
  - *My Packs*: user-added folders (+ Add Folder), each a collapsible group.
  - *Splice*: auto-finds the Splice download folder (user can override).
  - *MPC Exp.*: scans standard Akai locations, merges multiple locations.
  - *Samples From Mars*: user picks folder.
  - Rows show pack name, colored per-category bars, sample count (hover = full breakdown); MPC/Mars rows show kit count; tags like "no drums" / "N pre-grouped kits"; unusable packs dimmed not hidden; Refresh + Done buttons; read-only (nothing copied/moved/renamed).
2.3 **Maschine Importer** (KM3, new): scans NI content folder, lists installed Expansions, folder picker, Refresh. Also reachable via Extras > Import Maschine Expansions.
2.4 Two modes: **Sample Pack Mode** and **Maschine Mode**. Can batch several packs or several Expansions per run, but not mixed.
2.5 Accepted audio: .wav, .aiff/.aif, .mp3 (per-format limits: Beatmaker 3 = wav only; MPC = 44.1 kHz wav; Ableton = wav/aiff/mp3).
2.6 Maschine Mode inputs: official NI Expansions, Maschine 2 Factory Library, Battery 4 Factory Library (kits >16 sounds scaled to 16). Third-party Maschine libs unsupported (suggests Sample Pack Mode). Warns about wrong-folder imports (inner Groups/Samples folder, MPC .xpm, Community Drive).
2.7 Maschine kits are built from the **original kit files** (KM3) not keywords → original kit names, original layout optional, original previews copied. Kits that would be nearly empty are skipped on purpose; pads relying on software-generated sounds come out empty.
2.8 **MPC Expansion import** (.xpm/.xtd): every bank → its own kit (KM3; KM2 only first bank); original layouts retained or re-laid-out; "Recreate Kits from MPC programs" and "Use Original MPC Layouts" options. Instrument-only expansions have nothing to convert.
2.9 **Samples From Mars** packs auto-detected, built with original kit names; option "Search Samples From Mars packs for kit folders".
2.10 **Pre-grouped kit folders** auto-detected (one folder per kit, ≤16 sounds): offered as "Process Kit Folders".
2.11 Splice Beatmaker presets ("From Splice" folder) processed as kit folders; menu item to reveal Beatmaker folder (Mac/Win default paths documented); kits with <16 sounds keep empty pads.
2.12 Smart Detection options: *Filter 16-bit duplicate folders* (when pack ships 24-bit + 16-bit copies, use only 24-bit); *Convert AIFF Samples to WAV* (always converts for 16-Slice WAV and OP-1; never for Impact).
2.13 *Copy to Local Drive Before Processing* (workaround for external-drive/permission problems; red "Copy to Local On" indicator).

## 3. Sorting / classification

3.1 Exactly **7 categories**: Kick, Snare, Closed HH, Open HH, Percussion, Melodic, Misc (Misc = catch-all, cannot be renamed).
3.2 Sorting priority: category **folder names** → **filenames** → Misc. Packs with no category folders are sorted by filename automatically.
3.3 Per-category **keyword lists** (e.g. Kick: kick, kik, kck, bass drum), user-editable in the *Edit Categories/Keywords* window (also Cmd+F, Preferences, main-screen button).
3.4 **Keyword modifiers** (KM3): `/` word-boundary on either/both sides (`/hh/`), `*` spacer wildcard matching nothing/space/dash/underscore (`wood*block`); combinable.
3.5 **Also Search In**: per-category cross-search (e.g. Open HH also searches the Closed HH folder for open-hat filenames).
3.6 Rename/repurpose any of the 7 categories (e.g. Percussion → "808s"); cannot add an 8th category (stated limitation).
3.7 Category **colors** editable; **color themes**: User (editable), FL Studio, MPC, Serato (fixed). "Use default colors in kit presets" toggle. Colors are written into pad colors on MPC, FL Studio, Bitwig 6, Serato, Impact, Koala, Logic. Colors shared between Sample Pack and Maschine modes.
3.8 Reset Categories/Keywords button; keyword-update prompt when new default keywords ship; safer reset defaults to Skip; added "Vocal" keyword (KM2.4.2).
3.9 Sort options: *Sort Leftover Samples by Filename* (default on), *Force Sorting By Filename* (ignore folders), *Randomize Samples* (default off; otherwise alphabetical order puts similar names in the same kits).
3.10 **Filters**: *Large Files* (default on, skips ≥2 MB) and *Keywords* (skip loops/breaks/demos/stems/construction kits etc.; editable red list at bottom of keyword window). Filtered counts and names shown in summary.
3.11 Prepare menu tools: **Sort by Filenames** (writes a category-foldered copy to Desktop for manual fixing before import), **Make Blank Sample Pack Folder** (empty folder per category to hand-build a pack).

## 4. Kit building / layout engine

4.1 Fixed **16-pad** kits (4×4). Pad 1 = bottom-left, 16 = top-right.
4.2 **Layout dropdown**: Classic (default), Ergonomic, Ableton, SP404, OP-1/OP-XY, FL Studio, plus user-saved Custom.
4.3 Drag/swap pads to design a layout; Save button stores it; Reset All Pads to Default.
4.4 **Edit a pad's category** (right-click → Set Category) — KM3. Removing a category entirely from the layout drops those samples.
4.5 **Second-pick (fallback) categories** per pad (right-click order matters).
4.6 **Priority pads** (right-click toggle; white label): get filled first when samples run short.
4.7 **Fill All Pads** (main screen, default on): every kit full; shortages spread across kits rather than starving last kits; fallback category used when a category is exhausted. Off = sparse kits but more of them.
4.8 **Balance Categories** (KM3, off by default): layout auto-adjusts to pack composition (25% kicks → 4 kick pads instead of 2).
4.9 **Group Toms** onto Tom 1/2/3 pads for kit-based imports (low/mid/high), with "Toms Follow Pad Layout" and per-pad Tom 1/2/3 placement.
4.10 **Create Extra Kit with Overfill Samples**: leftover samples become one extra partial kit.
4.11 **Banks** dropdown: stacks N consecutive kits into one multi-bank preset (max per format: MPC/MPC Sample 8, Impact 8, Ableton 7, Bitwig 7, Koala 4, Logic 3, FL Studio 2). Name suffix "– x4".
4.12 **Processing methods** (dropdown next to Make Kits): *Make Kits* (each folder = its own pack), *Combine Packs* (merge many packs/volumes into one collection with a custom name), *Process Kit Folders*.
4.13 Kit naming: pack name + number; Maschine kits keep original names; "Include Expansion Name in Kits" prefix for Move/Note; ampersands → "And"; OP-1 original names truncated to 10 chars; Samples From Mars keep original kit names.
4.14 **Choke Hi-Hats** (closed/open hat cut each other): Ableton, MPC, Bitwig, Beatmaker 3.
4.15 **Use Icons from Filenames**: per-pad icon in Logic and FL Studio FPC.
4.16 Kit count depends on usable sample count; "why fewer kits" explanations in docs.

## 5. Summary / reporting (KM3)

5.1 **Summary Page** after each run: scrollable card per pack.
5.2 Page 1: pack title, colored category-count bars, first-kit 4×4 colored layout preview, kit count, messages (e.g. "only 3 categories found").
5.3 Page 2: grid of **every kit** with colored 4×4 layout + numbered list of 16 filenames (numbers colored by category).
5.4 Page 3: filtered samples breakdown (found / usable / filtered; large vs keyword; named lists of excluded files/folders).
5.5 Skipped packs explained (all too large, already processed for that format, no audio files).
5.6 Maschine cards (expansion name + "processed").
5.7 **"Where Your Kits Went"** overlay per format with output folder + short instructions (don't-show-again checkbox); "Reveal Kit Folders" button; auto-written **How to Transfer.txt** for Move/Note, Note (Folders), Deluge, Serato, MPC Sample, Koala.
5.8 Optional per-run diagnostic **reports** (how each sample was read and placed; flags unused samples, special chars in paths).
5.9 "Making Kits" progress screen with status text and loading bar.

## 6. Audio previews (KM3)

6.1 MPC + Ableton Live only. Preview per kit built from the kit's own samples.
6.2 Preview Method: **Play In Order** or **Play Beat** (short demo beat) with Beat Style Auto / Boom Bap / House / Trap.
6.3 Limit each sample to N seconds (quick fade).
6.4 Ableton preview files saved alongside kits or in a `[Previews]` folder; MPC plays preview on kit select.
6.5 Maschine kits copy the original NI previews.
6.6 Toggles: Create Sample Pack Previews (default on), Include Maschine Previews.

## 7. Output formats (21+ targets)

| # | Format | Output | Notes |
|---|---|---|---|
| 7.1 | MPC hardware/software (Live, X, One, Force, Key 37/61, MPC 2/3, Beats) | `.xpm` drum programs, 44.1 kHz wav, up to 8 banks, colored pads, previews | no legacy .pgm |
| 7.2 | MPC Sample (NEW) | `.xpj` project + `_[ProjectData]` (default) or `.mpcsample` folder; up to 8 banks | restart device after copy |
| 7.3 | Ableton Live 10/11/12 | `.adg` Drum Rack in User Library; Simpler / Drum Sampler (12.1+) / Simpler (Live 10); portable samples (`_Samples` next to presets) or legacy In-User-Library; up to 7 banks; optional "Kit Maker" browser tag; Push 3 standalone friendly | custom User Library path support, "Convert to Ableton Pack (beta)", "Update old .adg" |
| 7.4 | Ableton Move + Note | `.ablpresetbundle` (samples packed inside) | Include-expansion-name option |
| 7.5 | Ableton Note (folders) | folder-organized kits for advanced users | USB transfer |
| 7.6 | Logic Pro (NEW preset) | Drum Machine Designer patches into Logic folder, up to 3 banks | Keyboard Mapping: Chromatic vs Logic GM layout; start key C0–C4 |
| 7.7 | Bitwig Studio 6 (NEW preset) | Library presets, category pad colors, up to 7 banks | Use ADSR envelope option (default one-shot) |
| 7.8 | FL Studio FPC (NEW) | FPC presets with colored pads + per-pad icons, 2 banks | auto-detects Image-Line folder; FLkey RGB pads mirror colors; FL color theme + layout |
| 7.9 | Studio One / Fender Studio Pro "Impact" (NEW) | `.soundx` self-contained, up to 8 banks (128 pads), colors | picks PreSonus vs Fender folder |
| 7.10 | Koala Sampler (NEW preset) | `.koala` files, up to 4 banks, samples inside | Load Bank workflow |
| 7.11 | Serato Studio (NEW) | `.serato-pack`, Serato color theme | Reverse Pad Order option (default on) |
| 7.12 | OP-1 / OP-1 Field (NEW) | single sliced AIFF per kit | model chooser (mono 12 s vs stereo 20 s), Fit Samples to Available Time, Max Sample Length, preset-count limits, 10-char names |
| 7.13 | OP-XY (NEW) | 16 samples, repeats to fill spare slots | OP-1/OP-XY layout |
| 7.14 | Roland Zenbeats (NEW) | installs to Zenbeats User folder | |
| 7.15 | Deluge (Synthstrom) | KITS xml + SAMPLES/DRUMS/KIT MAKER | folder organization |
| 7.16 | Beatmaker 3 (iOS) | bmk2 format, EMPTY.wav for empty pads | wav only |
| 7.17 | EG Pulse (hidden by default) | per-kit files; iOS transfer | |
| 7.18 | NanoStudio 2 (discontinued, hidden) | iOS preset | |
| 7.19 | 16-Slice WAV (NEW) | one WAV per kit, 16 equal slices, 16-bit 44.1 kHz stereo, normalized as a whole | Equal Slices, Max segment length, Add silence between slices (for transient slicers like PO-33) |
| 7.20 | Numbered Files | one folder per kit, `01…16` pad-ordered files to drag onto pads | for SP-404 MKII (SP404 layout), Reason Kong, Circuit Tracks, Maschine, Geist2, Groove Agent SE 5, iMPC |
| 7.21 | Maschine / Reason Kong / iMPC Pro 2 | via Numbered Files (Maschine presets are encrypted, so unsupported) | |

7.22 Multiple formats can be ticked and exported in one run.
7.23 Per-format output locations (Folder Paths): Kit Maker Kits folder (default Desktop), Ableton User Library, Impact, Zenbeats, Logic (fixed), Bitwig Library, FL Image-Line folder. Click to change, right-click to reset, reveal buttons.
7.24 Per-format option panels (Preferences > Format Options): MPC Sample, Ableton, Move/Note, Serato, OP-1, 16-Slice, Bitwig, Logic, Audio Previews.
7.25 Menu > Formats for hiding/showing discontinued or niche formats.

## 8. UI / UX

8.1 Main screen: Import panel (Large Files / Keywords toggles, Importer buttons), Formats panel, Layout dropdown + Save, Banks dropdown, Fill All Pads / Balance Categories, Make Kits button + dropdown (processing methods), Edit Categories/Keywords, folder-reveal icon, bottom row (Preferences gear, Quick Guide, Manual, Help).
8.2 First-run interactive tutorial; Quick Guide; "Replay the Tutorial".
8.3 Pad grid shows category colors and Tom / priority labels.
8.4 Preferences: single scrolling page with left jump list; Reset All Preferences (red button; Alt = reset config and quit).
8.5 Tooltips (e.g., hover "Banks" lists format support), format-menu checkbox indicators, alerts explaining user-error mistakes.
8.6 Built-in manual with Markdown copy / "open in ChatGPT/Claude" links, audio narration.

## 9. Preferences inventory (complete)

General: Choke Hi-Hats, Use Icons from Filenames, Group Toms, Toms Follow Pad Layout, Copy to Local Drive Before Processing.
Sample Pack Mode: Convert AIFF→WAV, Filter 16-bit duplicates, Search Mars packs for kit folders, Recreate kits from MPC programs, Use Original MPC Layouts, Randomize Samples, Sort Leftover by Filename, Force Sorting By Filename, Create Extra Kit with Overfill Samples, Edit Categories/Keywords.
Maschine Mode: Use Original Layouts, Include Maschine Previews, Include Expansion Name in Kits.
Format options: see §7.24. Folder Paths: see §7.23.
Troubleshooting: Enable Reports, Verbose Logging, Send Support Files.

## 10. Known limitations (stated on site)

- 16 pads only (no 4/8/32/64-pad kits); Battery kits truncated to 16.
- Only 7 fixed categories (rename/recolor ok, no new ones).
- Sorting is purely name-based; packs with poor naming land in Misc.
- Loops and files ≥2 MB filtered by default; one-shot drum focus.
- No Maschine/other encrypted-preset output; no instrument/keygroup output (that's Preset Maker).
- Third-party Maschine libraries unsupported in Maschine Mode.
- MPC: wav-only 44.1 kHz, no .aif, no legacy .pgm.
- Samples are copied (disk usage), no audio editing/normalization except 16-Slice WAV and OP-1 stitching.
- Windows historically had sporadic-empty-pad bugs (fixed 2.4.0).
- No audition/waveform view; no per-sample manual swapping inside the app (only layout/category edits); no BPM/key/pitch analysis.

## 11. Feature history (release notes)

KM 2.2 Sample Pack mode, 16-pad fill, EG Pulse · 2.2.5 Deluge · 2.3.0 multi-bank MPC/Ableton, auto filename sort, Auto-sort button, Quick Guide, Reset All Settings · 2.3.1 Pre-grouped kits, Splice Beatmaker · 2.3.3 Ableton Move, Koala/SP404 layouts · 2.4.0 Ableton Note (Folders), MPC Expansion conversion, Combine Packs, Ableton 12.1 format, kits-folder location · 2.4.1 progress status, Reveal Kits Folder, local processing · 2.4.2 update notifications, troubleshooting tools, import warnings, better reports · 2.4.3 Submit a Bug, Intel build · **3.0.0/3.0.1** everything flagged "KM3" above.

## 12. KM2 → KM3 delta (useful as a priority signal: what users asked for)

Editable pad categories ("longtime user request"), editable/renamable categories, saved layouts (already existed), FL Studio export (called a "huge setback" without it in a review), Fill All Pads smarts, Balance Categories, Sample Pack Importer, summary page, previews, direct presets for Logic/Bitwig/Koala, 16-slice WAV.

## 13. Reviews / user sentiment

4.8/5 from ~340 Gumroad ratings, 10,369 sales (2019–2026). Praise: fast, easy, converts Maschine Expansions, custom packs for MPC/SP-404. Complaints: missing FL export (fixed in KM3), no ability to edit pad labels (fixed), GUI "dated", license recovery.

## 14. Preset Maker (companion app, $29)

14.1 Makes **melodic** presets rather than drum kits: MPC `.xpm` keygroups, Ableton Sampler (Live 10–12), Beatmaker 2/3, Deluge, FL Studio DirectWave, SFZ.
14.2 Multi-sample detection from filenames (instrument + note + octave; MIDI-number mode needs ≥5 samples; negative octaves unsupported), up to 4 velocity layers per note (V1/V2 or V65/V95).
14.3 One-Shot Group Presets by folder keyword (Synths, Guitars, Keys…) spread across keyboard; "Start MPC One-Shot presets at C0".
14.4 Loose preset for leftovers (threshold configurable); audio previews per keygroup.
14.5 Accepts Maschine Expansion `Samples/Instruments`.

---

## 15. Preliminary comparison with CrateMate today (to refine in planning)

CrateMate (browser, Lit + Web Audio, File System Access API) already has: acoustic profile (transients, tri-band energy, YIN pitch/root key, waveform bins), role classification from audio + name tokens, 4/6/8/16-pad kit generation with locks/reroll, Camelot harmonic matching, live audition with FX, M8 / SP-404MKII / universal exports (chain WAV, KIT_INFO.txt, zip or folder), presets.

| Kit Maker capability | CrateMate | Gap size |
|---|---|---|
| Keyword/folder categorization (§3) | token-based classifier exists; no user-editable keyword lists / modifiers / folder-name priority | medium |
| Acoustic classification, pitch, key, BPM | **CrateMate is ahead** | n/a |
| Batch "make all kits from a pack" (§4.12, 4.7) | generates one kit at a time | large |
| Layouts, saved layouts, per-pad category edit, priority/fallback pads (§4.2–4.6) | fixed role templates | medium |
| Fill All Pads / Balance Categories (§4.7–4.8) | partial (role templates) | small–medium |
| Banks (§4.11) | none | medium |
| Summary page / reports (§5) | none | medium |
| Filters: large files, loop keywords (§3.10) | duration/acoustic based; verify | small |
| Pack importer incl. Splice/MPC/Mars/Maschine detection (§2) | single folder picker | medium (browser can't auto-scan OS paths) |
| Kit-folder / Combine Packs methods (§4.12) | none | medium |
| Category colors + themes (§3.7) | roles only | small |
| Previews / demo beat (§6) | live audition exists; no rendered previews | medium |
| Output formats (§7) | M8, SP-404MKII, universal, PO-33, dual | large: MPC .xpm, MPC Sample, Ableton .adg / .ablpresetbundle, Bitwig, Logic, FL FPC, Impact, Koala, Serato, OP-1/XY, Deluge, 16-slice WAV, Numbered Files |
| 16-Slice WAV (§7.19) | chain WAV exists (equal-slice) | small |
| Numbered Files (§7.20) | universal `01_…` export exists | small |
| Support tooling, updates, license (§1) | n/a for a web app | skip |

Browser constraints to keep in mind when planning: no silent writes outside user-picked folders (File System Access API), no auto-detect of Splice/NI/Ableton paths, zip download as fallback for binary bundles; several formats (`.adg`, `.soundx`, `.koala`, `.ablpresetbundle`, `.serato-pack`) are zip/gzip/XML-based and feasible to generate in JS, but their exact schemas would need reverse-engineering from sample files.

## Source pages crawled

Home, /manual/, /docs/ (KM3 + KM2 manuals, ~45 KM3 pages), /faq/, /help/, /releases/, /kit-maker-2-releases/, /whats-new-in-kit-maker-3/, /beta/, format pages (MPC, MPC Sample, Ableton Live/Move/Note, Bitwig, Logic, FL Studio, Koala, Serato, OP-1, OP-XY, Studio One/Impact, Deluge, Beatmaker 3, 16-Slice WAV, Numbered Files, Maschine), /maschine-mpc/, /how-to-make-mpc-expansions/, /j-dilla-drum-loops/, /mpc-keygroups/, /presetmaker/, /preset-maker-manual/, /reviews/.
Not crawled in detail: KM2-era manual pages (superseded by KM3), Preset Maker release notes/help/reviews, legal pages, purchase/license pages, YouTube videos (feature demos and any behavior not in text docs may be missing).
