# CrateMate UX redesign: design brief

## 1. What this is

CrateMate is a browser app (local-first, no upload) that indexes a producer's sample folders, analyses every sample (transient, frequency balance, pitch/key, length), and builds drum/beat kits for hardware samplers. It is currently built around **one kit at a time**: generate, audition on pads, lock what you like, reroll the rest, export.

We are adding a **batch workflow**: turn a whole library or pack into many kits at once, each laid out the way the user plays. We want the UI reorganised around that, borrowing the *structure and flow* of a desktop tool called **Kit Maker** (kit-maker.com), while keeping CrateMate's own visual identity.

**Brief in one line:** keep CrateMate's skin, adopt Kit Maker's flow. Import, then Layout, then Make. See and trust the results at a glance.

## 2. The user and their gear

One producer who finger-drums on a **Roland SP-404MKII** and programs (not plays) on a **Dirtywave M8**, **Novation Circuit Tracks** and **Teenage Engineering PO-33**. Pad layout matters for the SP-404 only; the other devices just need sensibly ordered files.

Their SP-404 layout (pads numbered as the unit shows them, 1 at top-left):

```
   1 Tone    2 Tone    3 GHOST OPEN HAT   4 OPEN HAT
   5 Tone    6 Tone    7 GHOST CL. HAT    8 CLOSED HAT
   9 Tone   10 Tone   11 GHOST SNARE     12 SNARE
  13 Tone   14 Tone   15 GHOST KICK      16 KICK
```

- The two right columns are the drums. The main hit is on the far right, its **ghost** (the same sample at a lower level) is beside it.
- The two left columns are free pads for tones/melodics.
- **Pad numbers must follow the SP-404 convention** (1 at top-left) wherever pads are shown in this layout.

## 3. Current CrateMate UI (reference: `crate-mate-current.png`, attached)

Keep this identity. It is skeuomorphic hardware, modelled on an MPC2000XL.

- **Chassis:** warm grey/cream faceplate with a soft gradient; two columns.
- **Left column:** an olive-green LCD in a dark bezel with monospace text and F1-F6 soft keys (screens: MAIN, SOURCES, INFO); below it a slider, a data wheel, a main-volume knob, cream hardware buttons (UNDO), a red NEW KIT button, an orange SETUP DISK button, and blue PAD COUNT (4/6/8/16) and SCREEN buttons with small indicator lamps.
- **Right column:** a 4x4 grid of **rubber pads**: warm dark-grey, each showing a waveform bar graphic, sample name in condensed caps, key and length chips, a role dot + caption (KICK / SNARE / TONAL...), and a cream KEEP button plus a respin button below.
- **Type:** Barlow and Barlow Condensed, tracked-out small caps for labels.
- **Colors by role:** kick red, snare blue, hat olive green, tonal charcoal, texture orange.
- **Secondary UI:** a "Setup Disk" drawer (tabs: Program, Key, Sources, Export, Appearance, Keys) and an export modal. Optional "stickers" and "vintage" looks.
- **Strengths to protect:** live audition on pads with keyboard triggering, per-pad FX, key-aware picking, the tactile hardware feel.

## 4. Kit Maker's UX: what to borrow (reference: `kit-maker-3-main-window.png`, attached)

Kit Maker is a dark-themed desktop window with **three panels left to right: Import, Layout, Formats**, and one big orange primary button. The key idea is that the whole job reads left to right in one screen, with almost no navigation.

**Import panel (left)**
- A large dashed drop zone with a dotted-pixel icon. Drag folders in, or click to browse.
- A Sample Pack / Maschine mode toggle under it.
- Two toggle buttons with icons: **Fill All Pads** and **Balance Categories**.
- A "Filters" row of small chips with red status dots (Large Files, Keywords).
- A **Sample Pack Importer** button that opens a browser of your library.

**Sample Pack Importer (modal over the window)**
- Tabs by source (My Packs, Splice, MPC Exp., Samples From Mars).
- "+ Add Folder", plus a Refresh button and last-scanned time.
- Collapsible folder groups ("DRUM BROKER, 8 packs"), each with refresh/remove icons.
- Each pack row: name, optional tag pill ("25 pre-grouped kits"), a **tiny colored bar chart showing how many samples of each category the pack has**, and a sample count ("380 one-shots"). Packs with nothing usable are dimmed, not hidden.
- *Why it works:* you can tell whether a pack is worth importing before you commit.

**Layout panel (center, the hero)**
- A dropdown of named layouts ("Classic") with a save icon; helper text "Drag pads to re-order / Right-click to edit".
- A 4x4 grid. Each pad is a **dark tile with a colored outline by category**, a small pad number, and the category name. Priority pads have a brighter label.
- **Right-click a pad** gives a menu: Set Category (list with a check on the current one), Priority Pad (star), Reset All Pads to Default.
- Under the grid: a **Banks** dropdown and an "Edit Categories/Keywords" link.
- *Why it works:* the layout is the main thing on screen, directly editable, and color-coded.

**Formats panel (right)**
- Plain text toggle labels (no boxes), grouped under small caps headings (Formats / Ableton Formats / Additional DAWs) with ? help icons. Multiple can be on at once.

**Make Kits (bottom right)**
- One big orange button with a dropdown arrow for alternative methods (Make Kits, Combine Packs, Process Kit Folders), and a folder icon to reveal results.

**Summary page (after a run; described from the docs, no screenshot)**
- A vertical, scrollable column of cards, one per pack.
- Card page 1: title, colored bars of samples per category, a small 4x4 preview of the first kit's pad colors, kit count, and short messages ("loops filtered out").
- Page 2 (card side dots): every kit as a small colored 4x4 grid with a numbered list of its 16 file names.
- Page 3: what was filtered and why.
- Skipped packs explain *why* they were skipped.
- A "Where your kits went" overlay lists the output folder per format and how to transfer.

**Chrome:** bottom row with settings gear, Quick Guide, Manual, Help; first-run tutorial. Orange is the single accent; everything else is dark neutral.

## 5. What to design

Design these as screens for the existing CrateMate skin. The pad grid and LCD are fixed building blocks: reuse them, don't reinvent them.

1. **Main screen, rearranged** around Import → Layout → Output. Keep the hardware faceplate, but give the workflow Kit Maker's three-zone clarity. Where does the existing LCD/controls column go? Where does the **crate** (list of generated kits) go?
2. **Crate / kit list:** the batch result. Each kit shown as a mini 4x4 thumbnail in role colors (ghosts dimmer), name, key, and a checkbox to include in export. Selecting one loads it onto the big pad grid for auditioning and tweaking, which is CrateMate's edge over Kit Maker. Think of a bank strip or a shelf.
3. **Pack/library browser:** a CrateMate version of the Sample Pack Importer. Show each folder with per-role bars and a sample count, with unusable ones dimmed. (Browser note: the user picks folders through the browser's folder picker; there is no auto-detection of Splice or similar.)
4. **Layout editor:** edit the 16-slot layout directly. Drag to swap, right-click a pad for role (kick, snare, closed hat, open hat, tonal, texture), mark a pad as **ghost of** another pad, priority pad, save as a named layout. SP-404 numbering shown.
5. **Run summary:** a CrateMate version of the summary cards: kits made, role-mix bars, samples used vs left over, what was skipped and why. This could live on the LCD or as a panel.
6. **Export:** per-device. SP-404MKII, M8, Circuit Tracks, PO-33. Per-kit or whole crate, to zip or to a picked folder. A "where your kits went / how to transfer" step.

## 6. Constraints

- Web components (Lit); desktop-first, but must still work on a narrow screen (current breakpoint is 560px).
- Exactly 16 pads for layout kits, drawn as a 4x4 grid with bottom-left as grid origin in code, but **labelled with SP-404 numbers** (1 at top-left).
- Keep accessibility basics: contrast on the LCD and pads, focus states, keyboard pad triggering (existing keys: Z X C V / A S D F / Q W E R and 1-8).
- No new colors for roles: reuse the existing role palette (kick red, snare blue, hat olive, tonal charcoal, texture orange). Closed and open hats need to be told apart (suggest shade, pattern or caption, not a new hue).
- Don't copy Kit Maker's look (dark theme, orange accent, its logo). Borrow only the structure and interaction patterns.

## 7. Deliverables

- Annotated mockups of the six screens above, desktop and narrow.
- A short note on which existing components are reused and which are new.
- Open questions or trade-offs you want a decision on.

## Attachments (the user should attach these)

- `crate-mate-current.png`: current CrateMate with a 16-pad layout kit.
- `kit-maker-3-main-window.png`: Kit Maker's main window (reference only, not to copy).
- Optionally Kit Maker's importer and pad-menu screenshots.
