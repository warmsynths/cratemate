import { LitElement, html, css, svg, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { storage } from '../services/storage.ts';
import { scanner } from '../services/scanner.ts';
import { audioEngine } from '../services/audio-engine.ts';
import { kitGenerator } from '../services/kit-generator.ts';
import { hardwarePackager } from '../services/hardware-packager.ts';
import { padPreviews } from '../services/pad-preview.ts';
import { FACTORY_PRESETS, DEFAULT_PRESET_ID, mergeCriteria } from '../services/presets.ts';
import { DEFAULT_LAYOUT_ID, GHOST_LEVEL, getLayout } from '../services/layouts.ts';
import { getCamelotFromRoot } from '../services/musical-keys.ts';
import {
  baseStyles, CATS, CAT_COLOR, DEVICES, GLYPH, NOTES, alloc, categoryOf, slotFor, tone, type Category
} from '../ui/theme.ts';
import { envPaths } from '../ui/waveforms.ts';
import { FX_DEFAULTS, type EditorPad, type EditorMeter } from './pad-editor.ts';
import type { RecipeState, RecipePack } from './recipe-panel.ts';
import type {
  AcousticCriteria, FolderSource, HardwareTarget, Kit, LayoutSlot, PadCount, PadFx, PadSlot, ScanProgress
} from '../types/index.ts';

import './pad-editor.ts';
import './recipe-panel.ts';

const KEYS = '1234qwerasdfzxcv';
const SETTINGS_KEY = 'cratemate_v4_settings';
const ALL_PACKS = 'all';
const ECHO = [1, 2, 3, 4, 5, 6].map(k => ({ tf: `translate(0,${-k * 5.5})`, op: (0.55 - k * 0.07).toFixed(2) }));

interface Settings {
  recipe: RecipeState;
  pack: string;
  kitNo: number;
  dev: HardwareTarget;
}

const DEFAULT_SETTINGS: Settings = {
  recipe: {
    root: 9,
    scale: 'minor',
    count: 16,
    weights: { Kick: 2, Snare: 2, 'Closed HH': 2, 'Open HH': 2, Perc: 2, Melodic: 2, Misc: 1 },
    layoutId: 'none'
  },
  pack: ALL_PACKS,
  kitNo: 0,
  dev: 'sp404mk2'
};

function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return structuredClone(DEFAULT_SETTINGS);
    const s = JSON.parse(raw) as Partial<Settings>;
    return {
      ...DEFAULT_SETTINGS,
      ...s,
      recipe: {
        ...DEFAULT_SETTINGS.recipe,
        ...s.recipe,
        weights: { ...DEFAULT_SETTINGS.recipe.weights, ...s.recipe?.weights }
      }
    };
  } catch {
    return structuredClone(DEFAULT_SETTINGS);
  }
}

/** Kit pad indices in on-screen order (row by row from the top-left). SP-404 layouts store pad 0 at the bottom-left. */
function visualOrder(kit: Kit): number[] {
  const sp = !!getLayout(kit.layoutId)?.spNumbered && kit.padCount === 16;
  return Array.from({ length: kit.padCount }, (_, p) => sp ? (3 - (p >> 2)) * 4 + (p & 3) : p);
}

/** Ordered generator slots for a mix of sound types. */
function planFromWeights(weights: Record<Category, number>, count: number): LayoutSlot[] {
  const al = alloc(weights, count);
  return CATS.flatMap(c => Array.from({ length: al[c] }, () => slotFor(c)));
}

function fxDefaults(pad: PadSlot) {
  return pad.ghostOf !== undefined ? { ...FX_DEFAULTS, level: GHOST_LEVEL } : FX_DEFAULTS;
}

function isEdited(pad: PadSlot): boolean {
  const fx = pad.fx ?? {};
  const def = fxDefaults(pad);
  if (fx.reverse) return true;
  return (Object.keys(def) as (keyof typeof def)[]).some(k => fx[k] != null && fx[k] !== def[k]);
}

@customElement('crate-mate-app')
export class CrateMateApp extends LitElement {
  @state() private folders: FolderSource[] = [];
  @state() private packCounts: Record<string, number> = {};
  @state() private totalIndexed = 0;
  @state() private scan?: ScanProgress;
  @state() private kit?: Kit;
  @state() private settings: Settings = loadSettings();
  @state() private devOpen = false;
  @state() private devQuery = '';
  @state() private packQuery = '';
  @state() private recipeOpen = false;
  @state() private editOpen = false;
  @state() private sel = 0;
  @state() private press = -1;
  @state() private write: 'idle' | 'busy' | 'done' = 'idle';
  @state() private mobile = false;
  @state() private short = false;
  @state() private busy = false;
  @state() private dropping = false;
  @state() private toast?: string;

  private undoStack: Kit[] = [];
  private pressT = 0;
  private toastT = 0;
  private saveT = 0;
  private cleanups: Array<() => void> = [];

  static styles = [baseStyles, css`
    :host {
      position: relative;
      display: flex;
      flex-direction: column;
      width: 100%;
      height: 100vh;
      height: 100dvh;
      background: #f1e8d6;
      overflow: hidden;
      user-select: none;
      -webkit-user-select: none;
    }
    input { user-select: text; -webkit-user-select: text; }

    /* Header */
    .stripes > i { height: 8px; }
    :host([mobile]) .stripes > i { height: 4px; }
    header {
      flex: 0 0 auto; height: clamp(52px, 9vh, 72px); padding: 0 clamp(14px, 2vw, 28px);
      display: flex; align-items: center; gap: 16px; border-bottom: 1.5px solid #e0d3bb; position: relative; z-index: 5;
    }
    :host([mobile]) header { height: 60px; padding: 0 12px 0 16px; gap: 10px; }
    .logo { font-size: clamp(24px, 3.4vh, 30px); color: #3b2e25; }
    .grow { flex: 1; }
    .kit-input-m {
      flex: 1 1 auto; min-width: 0; padding: 0; border: none; background: transparent; outline: none;
      font-family: 'Righteous', cursive; font-size: 21px; text-overflow: ellipsis;
    }
    .dev { position: relative; }
    .dev-btn {
      display: flex; align-items: center; gap: 10px; padding: 10px 16px; min-height: 44px; border: none; border-radius: 999px;
      background: #3b2e25; color: #f3ead7; font-size: 14px; font-weight: 700; cursor: pointer; white-space: nowrap;
    }
    .dev-btn .lead { font-weight: 500; opacity: 0.7; }
    .dev-btn .caret { font-size: 11px; }
    .dev-menu {
      position: absolute; right: 0; top: calc(100% + 8px); width: 280px; max-height: min(420px, 70vh); overflow-y: auto;
      background: #fbf5e8; border: 1.5px solid #e0d3bb; border-radius: 16px; box-shadow: 0 20px 40px -16px rgba(59, 46, 37, 0.4);
      padding: 6px; display: flex; flex-direction: column; gap: 2px;
    }
    .dev-menu input { margin: 4px 4px 6px; padding: 10px 12px; border: 1.5px solid #e0d3bb; border-radius: 10px; background: #fff; font-size: 14px; outline: none; }
    .dev-menu button { display: flex; flex-direction: column; align-items: flex-start; gap: 2px; padding: 10px 12px; border: none; border-radius: 10px; background: transparent; text-align: left; cursor: pointer; }
    .dev-menu button.on { background: #ebe0ca; }
    .dev-menu b { font-size: 15px; font-weight: 700; }
    .dev-menu small { font-size: 13px; color: #8a7764; }

    /* Body */
    .body { flex: 1 1 auto; min-height: 0; display: grid; grid-template-columns: clamp(170px, 17vw, 250px) minmax(0, 1fr) clamp(240px, 24vw, 330px); }
    :host([mobile]) .body { display: flex; flex-direction: column; }

    /* Packs column */
    .packs {
      padding: clamp(12px, 3vh, 24px) clamp(12px, 1.4vw, 20px); display: flex; flex-direction: column; gap: clamp(8px, 1.8vh, 14px);
      border-right: 1.5px solid #e0d3bb; min-height: 0; overflow: hidden;
    }
    .search { flex: 0 0 auto; width: 100%; padding: 9px 12px; border: 1.5px solid #e0d3bb; border-radius: 10px; background: #fbf5e8; font-size: 14px; outline: none; }
    .pack-list {
      flex: 1 1 0; min-height: 0; overflow-y: auto; display: flex; flex-direction: column; gap: clamp(2px, 0.6vh, 6px);
      -webkit-mask-image: linear-gradient(#000 85%, transparent); mask-image: linear-gradient(#000 85%, transparent); padding-bottom: 16px;
    }
    .pack { position: relative; flex: 0 0 auto; display: flex; align-items: center; border-radius: 12px; }
    .pack.on { background: #e6dbc4; }
    .pack > button:first-child {
      flex: 1 1 auto; min-width: 0; display: flex; flex-direction: column; align-items: flex-start; gap: 1px;
      padding: clamp(6px, 1.2vh, 12px) 14px; border: none; border-radius: 12px; background: transparent; text-align: left; cursor: pointer;
    }
    .pack b { max-width: 100%; font-size: 15px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .pack small { font-size: 13px; color: #8a7764; }
    .pack .rm {
      flex: 0 0 auto; width: 28px; height: 28px; margin-right: 6px; border: none; border-radius: 8px; background: transparent;
      color: #8a7764; font-size: 16px; cursor: pointer; opacity: 0;
    }
    .pack:hover .rm, .pack .rm:focus-visible { opacity: 1; }
    .pack .rm:hover { background: #dacbb0; color: #3b2e25; }
    .empty { padding: 10px 14px; font-size: 14px; color: #8a7764; }
    .drop {
      flex: 0 0 auto; padding: clamp(6px, 1.2vh, 12px) 10px; border: 1.5px dashed #cdbb9c; border-radius: 12px;
      font-size: 14px; color: #8a7764; text-align: center; background: transparent; cursor: pointer;
    }
    .drop.over { border-color: #b85f36; color: #b85f36; background: #fbf5e8; }
    .legend { flex: 0 0 auto; display: flex; flex-wrap: wrap; gap: 6px 12px; }
    .legend span { display: flex; align-items: center; gap: 6px; font-size: 13px; white-space: nowrap; }
    .legend i { flex: 0 0 auto; width: 12px; height: 12px; border-radius: 4px; }

    /* Centre */
    .center {
      flex: 1 1 auto; padding: clamp(12px, 3vh, 24px) clamp(14px, 2vw, 28px); display: flex; flex-direction: column;
      gap: clamp(10px, 2.2vh, 18px); min-width: 0; min-height: 0; position: relative;
    }
    :host([mobile]) .center { padding: 10px 10px 12px; gap: 10px; position: static; }
    .kit-row { display: flex; align-items: center; gap: 10px; }
    .kit-name { display: flex; flex-direction: column; gap: 2px; min-width: 0; flex: 1 1 160px; }
    .kit-name span { font-size: 13px; color: #8a7764; }
    .kit-name input {
      width: 100%; min-width: 0; padding: 0; border: none; background: transparent; outline: none;
      font-size: clamp(18px, 2.6vh, 24px); font-weight: 800; text-overflow: ellipsis;
    }
    .recipe-btn {
      flex: 0 0 auto; display: flex; align-items: center; gap: 8px; min-height: 44px; padding: 0 16px; border: none;
      border-radius: 999px; background: #e6dbc4; font-size: 14px; font-weight: 600; white-space: nowrap; cursor: pointer;
    }
    .recipe-btn.on { background: #dacbb0; }
    .recipe-btn span { font-weight: 500; color: #6b5b4c; }
    .make {
      flex: 0 0 auto; white-space: nowrap; min-height: 44px; padding: 0 22px; border: none; border-radius: 999px;
      background: #3b2e25; color: #f3ead7; font-size: 15px; font-weight: 700; cursor: pointer;
    }
    .make:disabled { opacity: 0.7; cursor: progress; }

    /* Pads */
    .grid {
      flex: 1 1 auto; min-height: 0; display: grid; grid-template-columns: repeat(4, minmax(0, 1fr));
      grid-auto-rows: minmax(0, 1fr); gap: clamp(8px, 1.6vh, 14px); transition: opacity 120ms;
    }
    .grid.busy { opacity: 0.6; pointer-events: none; }
    .pad {
      position: relative; border: 3px solid transparent; border-radius: 18px; padding: clamp(6px, 1.2vh, 12px) clamp(6px, 1vw, 14px);
      min-height: 0; overflow: hidden; display: flex; flex-direction: column; justify-content: flex-start; gap: 3px;
      text-align: left; cursor: pointer; color: #2e241c; transition: transform 90ms ease-out; touch-action: manipulation;
    }
    :host([mobile]) .pad { border-radius: 14px; }
    .pad.sel { border-color: #3b2e25; }
    .pad.press { transform: scale(0.96); }
    .pad-head { display: flex; justify-content: space-between; align-items: center; gap: 4px; font-size: 12px; font-weight: 700; position: relative; }
    .pad-num { display: flex; align-items: center; gap: 5px; opacity: 0.75; min-width: 0; }
    .pad-num .dot { width: 6px; height: 6px; border-radius: 50%; background: #2e241c; }
    .pad-num svg { width: 12px; height: 12px; }
    .pad-num em { font-style: normal; font-size: 10px; letter-spacing: 0.8px; text-transform: uppercase; white-space: nowrap; }
    .glyph { flex: 0 0 auto; width: 13px; height: 13px; background: #2e241c; opacity: 0.55; }
    .pad svg.wave { position: absolute; left: 0; bottom: 0; width: 100%; height: 56%; overflow: visible; }
    .pad.ghost svg.wave { opacity: 0.7; }
    .pad-name { font-size: clamp(13px, 1.8vh, 15px); font-weight: 700; line-height: 1.15; position: relative; overflow: hidden; text-overflow: ellipsis; }
    :host([mobile]) .pad-name { font-size: 13px; }

    /* Mobile bars */
    .selbar { flex: 0 0 auto; display: flex; align-items: center; gap: 6px; padding: 6px; border-radius: 18px; background: #ebe0ca; }
    .sq {
      flex: 0 0 auto; width: 44px; height: 44px; border: none; border-radius: 13px; display: flex; align-items: center;
      justify-content: center; cursor: pointer; font-size: 14px; color: #2e241c; background: #f6efdf;
    }
    .sq svg { width: 18px; height: 18px; }
    .selinfo { flex: 1 1 auto; min-width: 0; display: flex; flex-direction: column; padding-left: 4px; }
    .selinfo small { font-size: 12px; color: #8a7764; white-space: nowrap; }
    .selinfo b { font-size: 16px; font-weight: 800; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .edit-btn { flex: 0 0 auto; height: 44px; padding: 0 16px; border: none; border-radius: 13px; background: #3b2e25; color: #f3ead7; font-size: 15px; font-weight: 700; cursor: pointer; }
    .actbar { flex: 0 0 auto; display: grid; grid-template-columns: auto minmax(0, 1fr) auto; gap: 8px; }
    .actbar button { min-height: 56px; border: none; border-radius: 18px; cursor: pointer; white-space: nowrap; }
    .act-recipe { padding: 0 16px; background: #e6dbc4; display: flex; flex-direction: column; align-items: flex-start; justify-content: center; gap: 1px; }
    .act-recipe b { font-size: 15px; font-weight: 800; }
    .act-recipe span { font-size: 12px; color: #6b5b4c; }
    .act-reroll { padding: 0 12px; background: #3b2e25; color: #f3ead7; display: flex; align-items: center; justify-content: center; gap: 8px; font-size: 17px; font-weight: 800; }
    .act-reroll svg { width: 19px; height: 19px; }
    .act-save { padding: 0 18px; color: #fbf3e4; font-size: 16px; font-weight: 800; }
    .scrim { position: absolute; inset: 0; z-index: 3; background: rgba(59, 46, 37, 0.35); }

    .toast {
      position: absolute; left: 50%; bottom: 20px; transform: translateX(-50%); z-index: 20; max-width: calc(100% - 32px);
      padding: 10px 18px; border-radius: 999px; background: #3b2e25; color: #f3ead7; font-size: 14px; font-weight: 600;
      box-shadow: 0 12px 28px -12px rgba(59, 46, 37, 0.6); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
      animation: pop 160ms ease-out;
    }
    @keyframes pop { from { opacity: 0; transform: translate(-50%, 6px); } to { opacity: 1; transform: translate(-50%, 0); } }
  `];

  // ---------- lifecycle ----------

  connectedCallback() {
    super.connectedCallback();
    const mqM = window.matchMedia('(max-width: 759px)');
    const mqS = window.matchMedia('(max-height: 839px)');
    const onMedia = () => {
      this.mobile = mqM.matches;
      this.short = mqS.matches;
      this.toggleAttribute('mobile', this.mobile);
      if (!this.mobile) this.editOpen = false;
    };
    onMedia();
    mqM.addEventListener('change', onMedia);
    mqS.addEventListener('change', onMedia);
    window.addEventListener('keydown', this.onKey);
    window.addEventListener('pointerdown', this.onOutside, true);
    this.cleanups.push(
      () => mqM.removeEventListener('change', onMedia),
      () => mqS.removeEventListener('change', onMedia),
      () => window.removeEventListener('keydown', this.onKey),
      () => window.removeEventListener('pointerdown', this.onOutside, true),
      padPreviews.onChange(() => this.requestUpdate()),
      scanner.onProgress(p => {
        this.scan = p.isScanning ? { ...p } : undefined;
        if (!p.isScanning) this.refreshLibrary();
      })
    );
    this.boot();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.cleanups.forEach(fn => fn());
    this.cleanups = [];
    clearTimeout(this.pressT);
    clearTimeout(this.toastT);
    clearTimeout(this.saveT);
  }

  private async boot() {
    try {
      const relabelled = await storage.reclassifyIfOutdated();
      if (relabelled) this.showToast(`Re-sorted ${relabelled} samples into the new sound types`);
      await this.refreshLibrary();
      const saved = await storage.getActiveKit();
      if (saved && saved.pads.some(p => p.sample)) {
        this.kit = saved;
        this.sel = visualOrder(saved)[0] ?? 0;
        this.preloadKitAudio(saved);
      } else {
        await this.makeKit();
      }
    } catch (err) {
      console.error('CrateMate failed to start:', err);
      this.showToast('Could not load your library');
    }
  }

  private async refreshLibrary() {
    this.folders = await storage.getFolders();
    const samples = await storage.getAllSamples();
    const counts: Record<string, number> = {};
    for (const s of samples) counts[s.folderId] = (counts[s.folderId] ?? 0) + 1;
    this.packCounts = counts;
    this.totalIndexed = samples.length;
    if (this.settings.pack !== ALL_PACKS && !this.folders.some(f => f.id === this.settings.pack)) {
      this.patchSettings({ pack: ALL_PACKS });
    }
  }

  private preloadKitAudio(kit: Kit) {
    for (const pad of kit.pads) {
      const sample = pad.sample;
      if (!sample || sample.folderId === 'demo_factory' || audioEngine.isRealSampleCached(sample.id)) continue;
      scanner.getFileForSample(sample)
        .then(file => file && audioEngine.cachePadAudio(sample.id, file))
        .then(() => this.requestUpdate())
        .catch(() => {});
    }
  }

  // ---------- settings & helpers ----------

  private patchSettings(patch: Partial<Settings>) {
    this.settings = { ...this.settings, ...patch };
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(this.settings)); } catch { /* private mode */ }
  }

  private patchRecipe(patch: Partial<RecipeState>) {
    this.patchSettings({ recipe: { ...this.settings.recipe, ...patch } });
  }

  private showToast(msg: string) {
    this.toast = msg;
    clearTimeout(this.toastT);
    this.toastT = window.setTimeout(() => { this.toast = undefined; }, 2600);
  }

  private saveSoon() {
    clearTimeout(this.saveT);
    this.saveT = window.setTimeout(() => { if (this.kit) storage.saveActiveKit(this.kit); }, 250);
  }

  private pushUndo() {
    if (!this.kit) return;
    this.undoStack.push(structuredClone(this.kit));
    if (this.undoStack.length > 12) this.undoStack.shift();
  }

  private packName(id: string): string {
    if (id === ALL_PACKS) return 'Mixed Crate';
    return this.folders.find(f => f.id === id)?.name ?? 'Crate';
  }

  private criteria(pack = this.settings.pack): AcousticCriteria {
    const r = this.settings.recipe;
    const keyed = r.root >= 0;
    const root = keyed ? NOTES[r.root] : undefined;
    return mergeCriteria(FACTORY_PRESETS[0].criteria, {
      folderIds: pack === ALL_PACKS ? undefined : [pack],
      keyLockMode: 'auto',
      targetRootNote: root,
      targetScale: keyed ? r.scale : undefined,
      lockedCamelotKey: root ? getCamelotFromRoot(root, r.scale) : undefined,
      autoPitchShift: keyed
    });
  }

  // ---------- kit actions ----------

  private async makeKit(opts: { count?: PadCount; pack?: string } = {}) {
    if (this.busy) return;
    const r = this.settings.recipe;
    const count = opts.count ?? r.count;
    const pack = opts.pack ?? this.settings.pack;
    const layout = r.layoutId !== 'none' && count === 16 ? getLayout(r.layoutId) : undefined;
    const plan = layout ? undefined : planFromWeights(r.weights, count);
    if (plan && !plan.length) {
      this.showToast('Turn up at least one sound in the mix');
      return;
    }

    this.pushUndo();
    this.busy = true;
    try {
      const kit = await kitGenerator.generateKit(count, this.kit, false, DEFAULT_PRESET_ID, this.criteria(pack), undefined, layout, plan);
      const no = pack === this.settings.pack ? this.settings.kitNo + 1 : 1;
      kit.name = `${this.packName(pack)} ${String(no).padStart(2, '0')}`;
      await storage.saveActiveKit(kit);
      const order = visualOrder(kit);
      this.kit = kit;
      if (!order.includes(this.sel)) this.sel = order[0] ?? 0;
      this.write = 'idle';
      this.patchSettings({ pack, kitNo: no, recipe: { ...r, count } });
      this.preloadKitAudio(kit);
    } catch (err) {
      this.undoStack.pop();
      this.showToast(`Could not make a kit: ${(err as Error).message ?? err}`);
    } finally {
      this.busy = false;
    }
  }

  private async swapSample(i = this.sel) {
    if (!this.kit || this.busy) return;
    this.pushUndo();
    try {
      this.kit = await kitGenerator.rerollPad(i, this.kit, this.criteria());
      this.write = 'idle';
      this.preloadKitAudio(this.kit);
      this.play(i);
    } catch (err) {
      this.undoStack.pop();
      this.showToast(`Could not swap: ${(err as Error).message ?? err}`);
    }
  }

  private undo() {
    const prev = this.undoStack.pop();
    if (!prev) {
      this.showToast('Nothing to undo');
      return;
    }
    this.kit = prev;
    storage.saveActiveKit(prev);
    this.showToast('Undone');
  }

  private updatePads(fn: (pads: PadSlot[]) => PadSlot[]) {
    if (!this.kit) return;
    this.kit = { ...this.kit, pads: fn(this.kit.pads) };
    this.write = 'idle';
    this.saveSoon();
  }

  private toggleLock(i = this.sel) {
    this.updatePads(pads => pads.map(p => p.index === i ? { ...p, locked: !p.locked } : p));
  }

  /** Change one setting on the selected pad. Ghost copies follow their main pad, apart from their own level. */
  private setFx(k: keyof PadFx, v: number | boolean) {
    const i = this.sel;
    this.updatePads(pads => {
      const next = pads.map(p => p.index === i ? { ...p, fx: { ...p.fx, [k]: v } } : p);
      const main = next.find(p => p.index === i)!;
      return next.map(p => p.ghostOf === i && !p.locked && k !== 'level'
        ? { ...p, fx: { ...main.fx, level: p.fx?.level ?? GHOST_LEVEL } }
        : p);
    });
  }

  private play(i: number) {
    const pad = this.kit?.pads[i];
    const sample = pad?.sample;
    if (!pad || !sample) return;
    audioEngine.stopAll();
    audioEngine.playSample(sample, () => scanner.getFileForSample(sample), pad.fx)
      .then(() => this.requestUpdate())
      .catch(err => console.warn('Playback error:', err));
  }

  private hit(i: number) {
    this.play(i);
    this.sel = i;
    this.press = i;
    clearTimeout(this.pressT);
    this.pressT = window.setTimeout(() => { this.press = -1; }, 110);
  }

  private stepPad(dir: 1 | -1) {
    if (!this.kit) return;
    const order = visualOrder(this.kit);
    const at = Math.max(0, order.indexOf(this.sel));
    const next = order[(at + dir + order.length) % order.length];
    this.sel = next;
    this.play(next);
  }

  /** Short tone when picking a key, so you hear the root. */
  private blip(n: number) {
    const ctx = audioEngine.getContext();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    const t = ctx.currentTime;
    o.type = 'triangle';
    o.frequency.value = 261.63 * Math.pow(2, n / 12);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.25, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
    o.connect(g);
    g.connect(audioEngine.getMasterGain());
    o.start(t);
    o.stop(t + 0.55);
  }

  private async writeKit() {
    if (!this.kit || this.write === 'busy') return;
    const dev = this.settings.dev;
    this.write = 'busy';
    try {
      const kit = { ...this.kit, name: this.kit.name.trim() || 'CrateMate Kit' };
      await hardwarePackager.exportToZip(kit, {
        target: dev,
        includeSampleChain: true,
        convertToHardwareSpec: true,
        normalizeAudio: true,
        includeKitInfo: true,
        bakePadFx: true
      });
      this.write = 'done';
      this.showToast(`Saved ${kit.name} for ${DEVICES.find(d => d.id === dev)?.name}`);
    } catch (err) {
      this.write = 'idle';
      this.showToast(`Could not write the kit: ${(err as Error).message ?? err}`);
    }
  }

  // ---------- packs ----------

  private async pickPack(id: string) {
    const folder = this.folders.find(f => f.id === id);
    if (folder && !folder.permissionGranted) {
      const granted = await scanner.reconnectFolder(id);
      await this.refreshLibrary();
      if (!granted) this.showToast(`${folder.name}: access not granted, using its saved analysis`);
    }
    await this.makeKit({ pack: id });
  }

  private async addFolder(handle?: FileSystemDirectoryHandle) {
    let folder: FolderSource;
    try {
      folder = handle ? await scanner.addFolderHandle(handle) : await scanner.pickAndAddFolder();
    } catch (err) {
      if ((err as DOMException)?.name !== 'AbortError') this.showToast((err as Error).message ?? String(err));
      return;
    }
    await this.refreshLibrary();
    this.showToast(`Scanning ${folder.name}…`);
    try {
      await scanner.scanFolder(folder);
      await this.refreshLibrary();
      await this.makeKit({ pack: folder.id });
    } catch (err) {
      this.showToast((err as Error).message ?? String(err));
    }
  }

  private async removeFolder(folder: FolderSource) {
    if (!window.confirm(`Remove "${folder.name}" and forget its ${this.packCounts[folder.id] ?? 0} analysed samples? Your files stay where they are.`)) return;
    await storage.removeFolderSource(folder.id);
    if (this.settings.pack === folder.id) this.patchSettings({ pack: ALL_PACKS });
    await this.refreshLibrary();
  }

  private onDrop = async (e: DragEvent) => {
    e.preventDefault();
    this.dropping = false;
    const item = Array.from(e.dataTransfer?.items ?? []).find(it => it.kind === 'file');
    const getHandle = (item as unknown as { getAsFileSystemHandle?: () => Promise<FileSystemHandle | null> })?.getAsFileSystemHandle;
    if (!item || !getHandle) {
      this.showToast('Drop a folder here in Chrome or Edge, or click to browse');
      return;
    }
    const handle = await getHandle.call(item);
    if (handle?.kind !== 'directory') {
      this.showToast('That was a file. Drop a folder of samples.');
      return;
    }
    await this.addFolder(handle as FileSystemDirectoryHandle);
  };

  // ---------- input ----------

  private onKey = (e: KeyboardEvent) => {
    const target = e.composedPath()[0] as HTMLElement | undefined;
    if (target && (/INPUT|TEXTAREA|SELECT/.test(target.tagName) || target.isContentEditable)) return;
    if (e.key === 'Escape') {
      this.devOpen = false;
      this.recipeOpen = false;
      this.editOpen = false;
      return;
    }
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      this.undo();
      return;
    }
    if (e.metaKey || e.ctrlKey || e.altKey || !this.kit) return;
    if (e.code === 'Space') {
      e.preventDefault();
      this.play(this.sel);
      return;
    }
    const p = KEYS.indexOf(e.key.toLowerCase());
    const order = visualOrder(this.kit);
    if (p >= 0 && p < order.length && !e.repeat) this.hit(order[p]);
  };

  private onOutside = (e: PointerEvent) => {
    if (!this.devOpen) return;
    const menu = this.renderRoot.querySelector('.dev');
    if (menu && !e.composedPath().includes(menu)) this.devOpen = false;
  };

  // ---------- render ----------

  private renderPad(pad: PadSlot, p: number) {
    const cat = categoryOf(pad);
    const color = CAT_COLOR[cat];
    const ghost = pad.ghostOf !== undefined;
    const prev = padPreviews.get(pad);
    const { edge, floor } = envPaths(prev?.env ?? []);
    const gid = `pg${p}`;
    const i = pad.index;
    return html`
      <button class="pad ${i === this.sel ? 'sel' : ''} ${i === this.press ? 'press' : ''} ${ghost ? 'ghost' : ''}"
        style="background:${ghost ? `color-mix(in oklch, ${color} 55%, #f1e8d6)` : color}"
        aria-label="Pad ${p + 1}, ${ghost ? 'ghost ' : ''}${cat}, ${pad.sample?.fileName ?? 'empty'}${pad.locked ? ', locked' : ''}"
        @pointerdown=${(e: PointerEvent) => { if (!e.button) this.hit(i); }}
        @click=${(e: MouseEvent) => { if (e.detail === 0) this.hit(i); }}>
        <span class="pad-head">
          <span class="pad-num">${p + 1}
            <span class="dot" style="opacity:${isEdited(pad) ? 0.7 : 0}"></span>
            <svg viewBox="0 0 24 24" style="opacity:${pad.locked ? 0.8 : 0}" aria-hidden="true">
              <path d="M7.5 11V8a4.5 4.5 0 0 1 9 0v3" fill="none" stroke="#2e241c" stroke-width="2.6"></path>
              <rect x="5" y="11" width="14" height="10" rx="2.5" fill="#2e241c"></rect>
            </svg>
            ${ghost ? html`<em>ghost</em>` : nothing}
          </span>
          <span class="glyph" title=${cat} style="border-radius:${GLYPH[cat][0]};clip-path:${GLYPH[cat][1]}"></span>
        </span>
        <svg class="wave" viewBox="0 0 100 40" preserveAspectRatio="none" aria-hidden="true">
          <defs><linearGradient id=${gid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0.36" style="stop-color:${tone(cat, 90)}"></stop><stop offset="0.36" style="stop-color:${tone(cat, 64)}"></stop>
            <stop offset="0.68" style="stop-color:${tone(cat, 64)}"></stop><stop offset="0.68" style="stop-color:${tone(cat, 38)}"></stop>
          </linearGradient></defs>
          ${ECHO.map(e => svg`<path d=${edge} transform=${e.tf} fill="none" stroke=${tone(cat, 64)} stroke-opacity=${e.op} stroke-width="1.6" stroke-linejoin="round" vector-effect="non-scaling-stroke"></path>`)}
          <path d=${floor} fill="url(#${gid})"></path>
        </svg>
        <span class="pad-name">${pad.sample?.fileName.replace(/\.[^/.]+$/, '') ?? '—'}</span>
      </button>
    `;
  }

  private renderDevice() {
    const dev = DEVICES.find(d => d.id === this.settings.dev) ?? DEVICES[0];
    const q = this.devQuery.trim().toLowerCase();
    const list = DEVICES.filter(d => !q || d.name.toLowerCase().includes(q));
    return html`
      <div class="dev">
        <button class="dev-btn" aria-haspopup="listbox" aria-expanded=${this.devOpen} @click=${() => { this.devOpen = !this.devOpen; }}>
          ${this.mobile ? nothing : html`<span class="lead">Send to</span>`}${dev.name}<span class="caret">▼</span>
        </button>
        ${this.devOpen ? html`
          <div class="dev-menu" role="listbox">
            <input .value=${this.devQuery} placeholder="Find a device" aria-label="Find a device"
              @input=${(e: InputEvent) => { this.devQuery = (e.target as HTMLInputElement).value; }}>
            ${list.map(d => html`
              <button class=${d.id === dev.id ? 'on' : ''} role="option" aria-selected=${d.id === dev.id}
                @click=${() => { this.patchSettings({ dev: d.id }); this.devOpen = false; this.devQuery = ''; this.write = 'idle'; }}>
                <b>${d.name}</b><small>${d.spec}</small>
              </button>
            `)}
          </div>
        ` : nothing}
      </div>
    `;
  }

  private renderPacks() {
    const q = this.packQuery.trim().toLowerCase();
    const active = this.settings.pack;
    const rows = [
      { id: ALL_PACKS, name: 'All packs', sub: this.totalIndexed ? `${this.totalIndexed} one-shots` : 'Factory demo sounds', folder: undefined as FolderSource | undefined },
      ...this.folders.map(f => {
        const n = this.packCounts[f.id] ?? 0;
        const scanning = this.scan?.folderId === f.id;
        const sub = scanning
          ? `Scanning · ${this.scan!.analyzed + this.scan!.skipped} of ${this.scan!.totalFound}`
          : `${n} one-shots${f.permissionGranted ? '' : ' · reconnect'}`;
        return { id: f.id, name: f.name, sub, folder: f };
      })
    ].filter(r => !q || r.name.toLowerCase().includes(q));

    return html`
      <div class="packs">
        <div class="caps">YOUR PACKS</div>
        <input class="search" .value=${this.packQuery} placeholder="Search packs" aria-label="Search packs"
          @input=${(e: InputEvent) => { this.packQuery = (e.target as HTMLInputElement).value; }}>
        <div class="pack-list">
          ${rows.map(r => html`
            <div class="pack ${r.id === active ? 'on' : ''}">
              <button aria-pressed=${r.id === active} @click=${() => this.pickPack(r.id)}>
                <b>${r.name}</b><small>${r.sub}</small>
              </button>
              ${r.folder ? html`<button class="rm" aria-label="Remove ${r.name}" title="Remove pack" @click=${() => this.removeFolder(r.folder!)}>×</button>` : nothing}
            </div>
          `)}
          ${rows.length === 0 ? html`<div class="empty">No packs match.</div>` : nothing}
        </div>
        <button class="drop ${this.dropping ? 'over' : ''}"
          @click=${() => this.addFolder()}
          @dragover=${(e: DragEvent) => { e.preventDefault(); this.dropping = true; }}
          @dragleave=${() => { this.dropping = false; }}
          @drop=${this.onDrop}>Drop a folder to add</button>
        <div class="legend">
          ${CATS.map(c => html`<span><i style="background:${CAT_COLOR[c]}"></i>${c}</span>`)}
        </div>
      </div>
    `;
  }

  private editorPad(pad: PadSlot, n: number): EditorPad {
    const prev = padPreviews.get(pad);
    const fx = pad.fx ?? {};
    const startSec = (fx.start ?? 0) * 0.01 / Math.pow(2, (fx.pitch ?? 0) / 12);
    return {
      n: String(n),
      cat: (pad.ghostOf !== undefined ? 'Ghost ' : '') + categoryOf(pad),
      color: CAT_COLOR[categoryOf(pad)],
      name: pad.sample?.fileName.replace(/\.[^/.]+$/, '') ?? 'Empty pad',
      len: (prev?.duration ?? pad.sample?.acousticProfile.duration ?? 0).toFixed(2) + 's',
      locked: pad.locked,
      fx,
      defaults: fxDefaults(pad),
      wave: prev?.wave ?? '',
      startPct: prev && !fx.reverse ? Math.min(100, startSec / prev.rawDuration * 100).toFixed(1) + '%' : '0%'
    };
  }

  render() {
    const kit = this.kit;
    const s = this.settings;
    const r = s.recipe;
    const dev = DEVICES.find(d => d.id === s.dev) ?? DEVICES[0];
    const order = kit ? visualOrder(kit) : [];
    const pads = kit ? order.map(i => kit.pads[i]).filter(Boolean) : [];
    const selPad = kit?.pads[this.sel] ?? pads[0];
    const selN = Math.max(0, order.indexOf(selPad?.index ?? 0)) + 1;

    const totalSec = pads.reduce((a, p) => a + (padPreviews.get(p)?.duration ?? p.sample?.acousticProfile.duration ?? 0), 0);
    const over = dev.budget > 0 && totalSec > dev.budget;
    const meter: EditorMeter = {
      device: dev.name,
      label: dev.budget ? `${totalSec.toFixed(1)} of ${dev.budget} s${over ? ' · too long' : ''}` : `${totalSec.toFixed(1)} s · no limit`,
      pct: dev.budget ? (Math.min(1, totalSec / dev.budget) * 100).toFixed(1) + '%' : '0%',
      ink: over ? '#a6382a' : '#6b5b4c',
      bar: over ? '#c0643a' : '#8c9a5b'
    };
    const writeBg = this.write === 'done' ? '#7d8a4e' : this.write === 'busy' ? '#9a7a62' : '#b85f36';
    const writeLabel = this.write === 'busy' ? 'Writing…' : this.write === 'done' ? 'Written. Write again?' : dev.id === 'po33' ? 'Send to PO-33' : 'Write kit to disk';
    const saveLabel = this.write === 'busy' ? 'Saving…' : this.write === 'done' ? 'Saved' : 'Save';
    const layout = r.layoutId !== 'none' ? getLayout(r.layoutId) : undefined;
    const recipeSummary = `${r.root < 0 ? 'any key' : NOTES[r.root] + (r.scale === 'minor' ? ' min' : ' maj')} · ${r.count}`;
    const lockedN = pads.filter(p => p.locked).length;
    const rerollLabel = lockedN ? `Reroll ${pads.length - lockedN}` : 'Reroll all';
    const setName = (e: InputEvent) => {
      if (!this.kit) return;
      this.kit = { ...this.kit, name: (e.target as HTMLInputElement).value };
      this.saveSoon();
    };

    const layoutMix = layout ? (() => {
      const mix = Object.fromEntries(CATS.map(c => [c, 0])) as Record<Category, number>;
      layout.slots.forEach(sl => { mix[categoryOf({ role: sl.role, hat: sl.hat, sample: undefined })]++; });
      return mix;
    })() : undefined;

    const recipePacks: RecipePack[] = [
      { id: ALL_PACKS, name: 'All packs', active: s.pack === ALL_PACKS },
      ...this.folders.map(f => ({ id: f.id, name: f.name, active: s.pack === f.id }))
    ];

    return html`
      <div class="stripes"><i></i><i></i><i></i></div>

      <header>
        ${this.mobile
          ? html`<input class="kit-input-m" .value=${kit?.name ?? ''} aria-label="Kit name" @input=${setName}>`
          : html`<div class="logo display">CrateMate</div><div class="grow"></div>`}
        ${this.renderDevice()}
      </header>

      <div class="body">
        ${this.mobile ? nothing : this.renderPacks()}

        <div class="center">
          ${this.mobile ? nothing : html`
            <div class="kit-row">
              <div class="kit-name">
                <span>Kit name</span>
                <input .value=${kit?.name ?? ''} aria-label="Kit name" @input=${setName}>
              </div>
              <button class="recipe-btn ${this.recipeOpen ? 'on' : ''}" aria-expanded=${this.recipeOpen}
                @click=${() => { this.recipeOpen = !this.recipeOpen; }}>Recipe<span>${recipeSummary}</span></button>
              <button class="make" ?disabled=${this.busy} @click=${() => this.makeKit()}>${this.busy ? 'Making…' : 'Make kit'}</button>
            </div>
          `}

          <div class="grid ${this.busy ? 'busy' : ''}" aria-busy=${this.busy}>
            ${pads.map((p, i) => this.renderPad(p, i))}
          </div>

          ${this.mobile && selPad ? html`
            <div class="selbar">
              <button class="sq" aria-label="Play" style="background:${CAT_COLOR[categoryOf(selPad)]}" @click=${() => this.play(selPad.index)}>▶</button>
              <div class="selinfo">
                <small>Pad ${selN} · ${categoryOf(selPad)}</small>
                <b>${selPad.sample?.fileName.replace(/\.[^/.]+$/, '') ?? '—'}</b>
              </div>
              <button class="sq" aria-label="Lock pad" aria-pressed=${selPad.locked}
                style=${selPad.locked ? 'background:#3b2e25;color:#f3ead7' : 'color:#3b2e25'} @click=${() => this.toggleLock()}>
                <svg viewBox="0 0 24 24"><path d="M7.5 11V8a4.5 4.5 0 0 1 9 0v3" fill="none" stroke="currentColor" stroke-width="2.4"></path><rect x="5" y="11" width="14" height="10" rx="2.5" fill="currentColor"></rect></svg>
              </button>
              <button class="sq" aria-label="Reroll this pad" @click=${() => this.swapSample()}>
                <svg viewBox="0 0 24 24" style="width:19px;height:19px"><path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3" fill="none" stroke="#3b2e25" stroke-width="2.4" stroke-linecap="round"></path><path d="M19.5 3.5v4.5h-4.5" fill="none" stroke="#3b2e25" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"></path></svg>
              </button>
              <button class="edit-btn" @click=${() => { this.editOpen = true; this.recipeOpen = false; }}>Edit</button>
            </div>
            <div class="actbar">
              <button class="act-recipe" @click=${() => { this.recipeOpen = !this.recipeOpen; }}>
                <b>Recipe</b><span>${recipeSummary}</span>
              </button>
              <button class="act-reroll" ?disabled=${this.busy} @click=${() => this.makeKit()}>
                <svg viewBox="0 0 24 24"><path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3" fill="none" stroke="#f3ead7" stroke-width="2.4" stroke-linecap="round"></path><path d="M19.5 3.5v4.5h-4.5" fill="none" stroke="#f3ead7" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"></path></svg>${rerollLabel}
              </button>
              <button class="act-save" style="background:${writeBg}" @click=${() => this.writeKit()}>${saveLabel}</button>
            </div>
          ` : nothing}

          ${this.recipeOpen ? html`
            ${this.mobile ? html`<div class="scrim" @click=${() => { this.recipeOpen = false; }}></div>` : nothing}
            <recipe-panel
              ?mobile=${this.mobile}
              .recipe=${r}
              .packs=${recipePacks}
              .layoutMix=${layoutMix}
              .layoutName=${layout?.name ?? ''}
              .onRoot=${(n: number) => { this.patchRecipe({ root: n }); this.blip(n); }}
              .onScale=${(k: 'minor' | 'major' | 'any') => this.patchRecipe(k === 'any' ? { root: -1 } : { scale: k, root: r.root < 0 ? 9 : r.root })}
              .onCount=${(n: PadCount) => {
                if (n !== 16 && r.layoutId !== 'none') this.patchRecipe({ layoutId: 'none' });
                this.makeKit({ count: n });
              }}
              .onLayout=${(on: boolean) => {
                this.patchRecipe(on ? { layoutId: DEFAULT_LAYOUT_ID, count: 16 } : { layoutId: 'none' });
                this.makeKit();
              }}
              .onWeight=${(c: Category, v: number) => this.patchRecipe({ weights: { ...r.weights, [c]: v } })}
              .onPack=${(id: string) => this.patchSettings({ pack: id })}
              .onAddFolder=${() => this.addFolder()}
              .onMake=${() => { this.makeKit(); this.recipeOpen = false; }}
              .onDone=${() => { this.recipeOpen = false; }}
            ></recipe-panel>
          ` : nothing}
        </div>

        ${selPad && (!this.mobile || this.editOpen) ? html`
          <pad-editor
            ?mobile=${this.mobile}
            .twoCol=${this.short}
            .pad=${this.editorPad(selPad, selN)}
            .meter=${meter}
            .writeLabel=${writeLabel}
            .writeBg=${writeBg}
            .onPlay=${() => this.play(selPad.index)}
            .onFx=${(k: keyof PadFx, v: number | boolean) => this.setFx(k, v)}
            .onCommit=${() => window.setTimeout(() => this.play(this.sel), 40)}
            .onSwap=${() => this.swapSample()}
            .onLock=${() => this.toggleLock()}
            .onWrite=${() => this.writeKit()}
            .onClose=${() => { this.editOpen = false; }}
            .onPrev=${() => this.stepPad(-1)}
            .onNext=${() => this.stepPad(1)}
          ></pad-editor>
        ` : nothing}
      </div>

      ${this.toast ? html`<div class="toast" role="status" aria-live="polite">${this.toast}</div>` : nothing}
    `;
  }
}
