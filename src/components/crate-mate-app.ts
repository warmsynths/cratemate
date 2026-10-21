import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { storage } from '../services/storage.ts';
import { scanner } from '../services/scanner.ts';
import { audioEngine } from '../services/audio-engine.ts';
import { kitGenerator } from '../services/kit-generator.ts';
import { FACTORY_PRESETS, DEFAULT_PRESET_ID } from '../services/presets.ts';
import { PAD_LAYOUTS, DEFAULT_LAYOUT_ID, NO_LAYOUT_ID, getLayout, layoutRoleMix, padDisplayNumber } from '../services/layouts.ts';
import { SLIDER_MODES } from './mpc-controls.ts';
import type { 
  AcousticCriteria, 
  FolderSource, 
  Kit, 
  KitPreset, 
  PadCount, 
  PadSlot, 
  SampleRole, 
  SliderMode,
  AppearanceSettings 
} from '../types/index.ts';

import './mpc-lcd.ts';
import './mpc-controls.ts';
import './pad-grid.ts';
import './setup-disk-drawer.ts';
import type { LcdScreen } from './mpc-lcd.ts';

@customElement('crate-mate-app')
export class CrateMateApp extends LitElement {
  @state() private folders: FolderSource[] = [];
  @state() private activeKit?: Kit;
  @state() private padCount: PadCount = 8;
  @state() private currentScreen: LcdScreen = 'MAIN';
  @state() private activePresetId: string = DEFAULT_PRESET_ID;
  @state() private customPresets: KitPreset[] = [];
  @state() private activeCriteria: AcousticCriteria = { ...FACTORY_PRESETS[0].criteria };
  @state() private totalIndexedCount = 0;
  @state() private isGeneratingKit = false;
  @state() private toastMessage?: string;
  @state() private volume = audioEngine.getVolume() || 0.9;
  @state() private isSetupDiskOpen = false;
  @state() private activeSlot?: PadSlot;
  @state() private activePadIndex: number | null = null;
  @state() private isPlaying = false;
  @state() private freshIndices: number[] = [];
  @state() private folderCursor = 0;
  @state() private serialNumber = 1;
  @state() private sliderMode: SliderMode = 'PITCH';
  @state() private roleMix?: Partial<Record<SampleRole, number>>;
  @state() private activeLayoutId: string = DEFAULT_LAYOUT_ID;
  @state() private look: AppearanceSettings = {
    stickers: false,
    vintage: false
  };

  private undoStack: Kit[] = [];
  private toastTimeout = 0;
  private playTimeout = 0;
  private unsubscribeProgress?: () => void;
  private scaleObserver?: ResizeObserver;

  static styles = css`
    :host {
      display: block;
      height: 100vh;
      height: 100dvh;
      width: 100%;
      background: linear-gradient(160deg, #dcddd7 0%, #cdcec8 55%, #c2c3bd 100%);
      color: #25261f;
      font-family: 'Barlow', system-ui, sans-serif;
      -webkit-font-smoothing: antialiased;
      box-sizing: border-box;
      user-select: none;
      overflow: hidden;
    }

    *, *::before, *::after { box-sizing: border-box; }

    /* Root faceplate: matches design root (padding, 20px gap, row layout) */
    .chassis-wrapper {
      position: relative;
      height: 100%;
      display: flex;
      flex-wrap: nowrap;
      gap: 20px;
      align-items: stretch;
      padding: clamp(10px, 1.6vh, 18px) clamp(12px, 1.4vw, 20px);
    }

    .chassis-wrapper.vintage {
      filter: sepia(0.32) saturate(0.82) contrast(0.96) brightness(0.98);
    }

    .vintage-overlay {
      position: absolute;
      inset: 0;
      pointer-events: none;
      z-index: 5;
      mix-blend-mode: multiply;
      background:
        radial-gradient(ellipse at 0% 0%, rgba(120, 92, 40, 0.22), transparent 38%),
        radial-gradient(ellipse at 100% 100%, rgba(110, 84, 36, 0.26), transparent 42%),
        radial-gradient(ellipse at 100% 0%, rgba(120, 92, 40, 0.12), transparent 30%),
        repeating-linear-gradient(103deg, transparent 0 140px, rgba(80, 64, 30, 0.05) 140px 141px, transparent 141px 310px),
        repeating-linear-gradient(-71deg, transparent 0 220px, rgba(255, 255, 255, 0.18) 220px 221px, transparent 221px 470px);
      display: block;
    }

    /* Left column: fixed-size hardware, zoomed by JS to fit window height */
    .console-column {
      flex: 0 0 clamp(330px, 28vw, 420px);
      max-width: 100%;
      min-width: 0;
      min-height: 0;
      overflow-y: visible;
      display: flex;
      flex-direction: column;
      gap: clamp(4px, 1vh, 14px);
    }

    .pads-column {
      flex: 1 1 0;
      min-width: 0;
      min-height: 0;
      display: flex;
      flex-direction: column;
    }

    /* MOBILE (< 560px, same as design) */
    @media (max-width: 559px) {
      :host {
        height: auto;
        min-height: 100vh;
        overflow: visible;
      }
      .chassis-wrapper {
        height: auto;
        min-height: 100vh;
        flex-wrap: wrap;
        align-content: flex-start;
        align-items: flex-start;
        padding: 18px 20px;
      }
      .console-column,
      .pads-column {
        flex: 1 1 100%;
      }
      .console-column { zoom: 1 !important; }
    }

    /* TOAST MESSAGE */
    .toast {
      position: fixed;
      bottom: 24px;
      left: 50%;
      transform: translateX(-50%);
      background: #25261f;
      color: #f7efe2;
      font-family: 'Barlow Condensed', sans-serif;
      font-size: 14px;
      font-weight: 600;
      letter-spacing: 0.8px;
      padding: 9px 18px;
      border-radius: 3px;
      box-shadow: 0 4px 14px rgba(0, 0, 0, 0.4);
      z-index: 99999;
      display: flex;
      align-items: center;
      gap: 8px;
      animation: fadeIn 0.15s ease-out;
    }

    @keyframes fadeIn {
      from { opacity: 0; transform: translate(-50%, 8px); }
      to { opacity: 1; transform: translate(-50%, 0); }
    }
  `;

  async connectedCallback() {
    super.connectedCallback();
    window.addEventListener('keydown', this.handleGlobalKeyDown);

    try {
      const savedLayout = localStorage.getItem('cratemate_layout');
      if (savedLayout && (savedLayout === NO_LAYOUT_ID || getLayout(savedLayout))) {
        this.activeLayoutId = savedLayout;
      }
    } catch (_) {}

    try {
      const savedLook = localStorage.getItem('cratemate_look');
      if (savedLook) {
        this.look = { ...this.look, ...JSON.parse(savedLook) };
      }
    } catch (_) {}

    await this.refreshData();

    // Subscribe to directory scanner progress updates
    this.unsubscribeProgress = scanner.onProgress(progress => {
      if (!progress.isScanning) {
        this.refreshData();
      }
      this.requestUpdate();
    });

    audioEngine.setVolume(this.volume);

    // Left-column fit: zoom just the console column so its hardware fits the window height.
    // Matches the design's fitLeft() — only the left panel zooms, pads stay natural.
    this.scaleObserver = new ResizeObserver(() => this._fitLeft());
    this.scaleObserver.observe(this);
    await this.updateComplete;
    this._fitLeft();
  }

  private _fitLeftTimer = 0;
  private _fitLeft() {
    if (this._fitLeftTimer) return;
    this._fitLeftTimer = window.setTimeout(() => {
      this._fitLeftTimer = 0;
      const el = this.shadowRoot?.querySelector('.console-column') as HTMLElement | null;
      if (!el) return;
      if (window.innerWidth < 560) {
        el.style.zoom = '';
        return;
      }
      // Design fitLeft(): measure at zoom 1, compare to the column's own (stretched) height
      el.style.zoom = '1';
      const top = el.getBoundingClientRect().top;
      const need = Math.max(
        el.scrollHeight,
        ...Array.from(el.children, c => c.getBoundingClientRect().bottom - top)
      ) + 4;
      const have = el.clientHeight;
      const z = need > have ? Math.max(0.5, have / need) : 1;
      el.style.zoom = z === 1 ? '' : z.toFixed(4);
    }, 0);
  }


  updated() {
    this._fitLeft();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    window.removeEventListener('keydown', this.handleGlobalKeyDown);
    if (this.unsubscribeProgress) {
      this.unsubscribeProgress();
    }
    this.scaleObserver?.disconnect();
    clearTimeout(this.toastTimeout);
    clearTimeout(this.playTimeout);
  }

  private handleGlobalKeyDown = (e: KeyboardEvent) => {
    const path = e.composedPath();
    const activeEl = (path[0] as HTMLElement) || (e.target as HTMLElement);
    if (activeEl && (
      activeEl.tagName === 'INPUT' || 
      activeEl.tagName === 'TEXTAREA' || 
      activeEl.tagName === 'SELECT' || 
      activeEl.isContentEditable
    )) {
      return;
    }

    if (e.code === 'Space') {
      e.preventDefault();
      this.handleGenerateKit(false);
      return;
    }

    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      this.handleUndo();
      return;
    }

    if (e.key === 'Escape' && this.isSetupDiskOpen) {
      this.isSetupDiskOpen = false;
      return;
    }
  };

  private async refreshData() {
    try {
      this.folders = await storage.getFolders();
      this.customPresets = await storage.getCustomPresets();
      this.totalIndexedCount = await storage.getSampleCount();
      const savedPresetId = await storage.getActivePresetId();
      if (savedPresetId) {
        this.activePresetId = savedPresetId;
        const allPresets = [...FACTORY_PRESETS, ...this.customPresets];
        const p = allPresets.find(item => item.id === savedPresetId);
        if (p) {
          this.activeCriteria = { ...p.criteria };
        }
      }

      const savedKit = await storage.getActiveKit();
      const hasOldRepetitiveDemos = savedKit && savedKit.pads.some(p => p.sample?.id.startsWith('demo_') && (p.sample.fileName.includes('_') || p.sample.id.includes('demo_Tonal') || p.sample.id.includes('demo_Texture')));
      if (savedKit && !hasOldRepetitiveDemos) {
        this.activeKit = savedKit;
        this.padCount = savedKit.padCount;
        this.roleMix = savedKit.roleMix;
        this.preloadKitAudio(savedKit);
      } else {
        await this.handleGenerateKit(false);
      }
    } catch (err) {
      console.error('Error refreshing storage data:', err);
    }
  }

  private preloadKitAudio(kit?: Kit) {
    if (!kit) return;
    for (const pad of kit.pads) {
      if (pad.sample && pad.sample.folderId !== 'demo_factory') {
        scanner.getFileForSample(pad.sample).then(file => {
          if (file) {
            audioEngine.cachePadAudio(pad.sample!.id, file);
          }
        }).catch(() => {});
      }
    }
  }

  private showToast(msg: string) {
    this.toastMessage = msg;
    clearTimeout(this.toastTimeout);
    this.toastTimeout = window.setTimeout(() => {
      this.toastMessage = undefined;
    }, 2400);
  }

  private handlePadTrigger = async (e: CustomEvent<{ padIndex: number }>) => {
    const padIndex = e.detail.padIndex;
    if (!this.activeKit) return;
    const slot = this.activeKit.pads[padIndex];
    if (!slot || !slot.sample) return;

    this.activePadIndex = padIndex;
    this.activeSlot = slot;
    this.isPlaying = true;
    clearTimeout(this.playTimeout);
    this.playTimeout = window.setTimeout(() => {
      this.isPlaying = false;
    }, Math.min((slot.sample?.acousticProfile?.duration || 0.4) * 1000, 1600));

    try {
      const sample = slot.sample;
      await audioEngine.playSample(sample, () => scanner.getFileForSample(sample), slot.fx);
    } catch (err) {
      console.warn('Playback error:', err);
    }
  };

  private handleInspectPad = (e: CustomEvent<{ padIndex: number }>) => {
    const padIndex = e.detail.padIndex;
    this.activePadIndex = padIndex;
    if (this.activeKit) {
      this.activeSlot = this.activeKit.pads[padIndex];
    }
    this.currentScreen = 'INFO';
  };

  private handlePadLock = async (e: CustomEvent<{ padIndex: number; locked: boolean }>) => {
    if (!this.activeKit) return;
    const { padIndex, locked } = e.detail;
    const slot = this.activeKit.pads[padIndex];
    if (slot) {
      slot.locked = locked;
      await storage.saveActiveKit(this.activeKit);
      this.requestUpdate();
    }
  };

  private handleRerollSinglePad = async (e: CustomEvent<{ padIndex: number }>) => {
    if (!this.activeKit) return;
    const padIndex = e.detail.padIndex;
    try {
      audioEngine.clearBufferCache();
      this.activeKit = await kitGenerator.rerollPad(padIndex, this.activeKit, this.activeCriteria);
      this.freshIndices = [padIndex];
      setTimeout(() => { this.freshIndices = []; }, 2200);
      this.preloadKitAudio(this.activeKit);
      this.showToast(`↻ Respun Pad ${padDisplayNumber(padIndex, this.isSpNumbered)}`);
      this.handlePadTrigger(new CustomEvent('pad-trigger', { detail: { padIndex } }));
    } catch (err: any) {
      this.showToast(`Could not respin: ${err.message || err}`);
    }
  };

  private handleGenerateKit = async (rerollAll = false) => {
    if (this.activeKit) {
      this.undoStack.push(JSON.parse(JSON.stringify(this.activeKit)));
      if (this.undoStack.length > 12) this.undoStack.shift();
    }

    this.isGeneratingKit = true;
    try {
      audioEngine.clearBufferCache();
      const touchedIndices: number[] = [];
      if (this.activeKit) {
        this.activeKit.pads.forEach((p, idx) => {
          if (!p.locked && idx < this.padCount) touchedIndices.push(idx);
        });
      }

      this.activeKit = await kitGenerator.generateKit(
        this.padCount,
        this.activeKit,
        rerollAll,
        this.activePresetId,
        this.activeCriteria,
        this.roleMix,
        getLayout(this.activeLayoutId)
      );

      this.serialNumber++;
      this.freshIndices = touchedIndices.length ? touchedIndices : Array.from({ length: this.padCount }, (_, i) => i);
      setTimeout(() => { this.freshIndices = []; }, 2200);

      this.preloadKitAudio(this.activeKit);
      const isDemo = this.folders.length === 0 || this.totalIndexedCount === 0;
      this.showToast(`KIT${String(this.serialNumber).padStart(3, '0')} GENERATED${isDemo ? ' (DEMO)' : ''}`);
    } catch (err: any) {
      this.showToast(`Error: ${err.message || err}`);
    } finally {
      this.isGeneratingKit = false;
    }
  };

  private handleUndo = async () => {
    const prev = this.undoStack.pop();
    if (!prev) {
      this.showToast('Nothing to undo');
      return;
    }

    this.activeKit = prev;
    this.padCount = prev.padCount;
    this.roleMix = prev.roleMix;
    await storage.saveActiveKit(prev);
    this.showToast('Undo kit');
  };

  private handleSliderValueChange = async (e: CustomEvent<{ mode: SliderMode; value: number; padIndex: number | null }>) => {
    if (!this.activeKit) return;
    const { mode, value, padIndex } = e.detail;

    const targetIndices = padIndex !== null ? [padIndex] : Array.from({ length: this.padCount }, (_, i) => i);

    for (const idx of targetIndices) {
      const pad = this.activeKit.pads[idx];
      if (pad) {
        if (!pad.fx) pad.fx = {};
        switch (mode) {
          case 'PITCH': pad.fx.pitch = value; break;
          case 'FILTER': pad.fx.filter = value; break;
          case 'DECAY': pad.fx.decay = value; break;
          case 'LEVEL': pad.fx.level = value; break;
          case 'DRIVE': pad.fx.drive = value; break;
          case 'START': pad.fx.start = value; break;
          case 'REVERSE': pad.fx.reverse = value === 1; break;
        }
      }
    }

    this.activeKit = { ...this.activeKit };
    if (padIndex !== null) {
      this.activeSlot = this.activeKit.pads[padIndex];
    }
    await storage.saveActiveKit(this.activeKit);
  };

  private handleDataWheelStep = async (e: CustomEvent<{ step: number }>) => {
    const step = e.detail.step;
    if (this.currentScreen === 'MAIN') {
      const allPresets = [...FACTORY_PRESETS, ...this.customPresets];
      const curIdx = Math.max(0, allPresets.findIndex(p => p.id === this.activePresetId));
      const nextIdx = (curIdx + step + allPresets.length) % allPresets.length;
      this.activePresetId = allPresets[nextIdx].id;
      this.activeCriteria = { ...allPresets[nextIdx].criteria };
      await storage.saveActivePresetId(this.activePresetId);
      await this.handleGenerateKit(false);
    } else if (this.currentScreen === 'SOURCES') {
      if (this.folders.length > 0) {
        this.folderCursor = (this.folderCursor + step + this.folders.length) % this.folders.length;
      }
    } else if (this.currentScreen === 'INFO') {
      const cfg = SLIDER_MODES.find(m => m.k === this.sliderMode) || SLIDER_MODES[0];
      const pad = this.activePadIndex !== null && this.activeKit ? this.activeKit.pads[this.activePadIndex] : undefined;
      if (pad) {
        const curVal = (pad.fx as any)?.[this.sliderMode.toLowerCase()] ?? cfg.def;
        const nextVal = Math.max(cfg.min, Math.min(cfg.max, curVal + step));
        this.handleSliderValueChange(new CustomEvent('slider-value-change', {
          detail: { mode: this.sliderMode, value: nextVal, padIndex: this.activePadIndex }
        }));
      }
    }
  };

  private handleRoleMixChange = async (e: CustomEvent<{ roleMix?: Partial<Record<SampleRole, number>> }>) => {
    this.roleMix = e.detail.roleMix;
    this.showToast('Target role mix updated');
    await this.handleGenerateKit(false);
  };

  private handleSwapPadRole = async (e: CustomEvent<{ padIndex: number; newRole: SampleRole }>) => {
    if (!this.activeKit) return;
    const { padIndex, newRole } = e.detail;
    const slot = this.activeKit.pads[padIndex];
    if (slot) {
      slot.role = newRole;
      await this.handleRerollSinglePad(new CustomEvent('reroll-single-pad', { detail: { padIndex } }));
    }
  };

  private handleSelectLayout = async (e: CustomEvent<{ layoutId: string }>) => {
    this.activeLayoutId = e.detail.layoutId;
    try {
      localStorage.setItem('cratemate_layout', this.activeLayoutId);
    } catch (_) {}
    const layout = getLayout(this.activeLayoutId);
    if (layout) this.padCount = 16;
    await this.handleGenerateKit(false);
    this.showToast(layout ? `Layout: ${layout.name}` : 'Layout: standard');
  };

  private handleLookChange = (e: CustomEvent<{ stickers?: boolean; vintage?: boolean }>) => {
    this.look = { ...this.look, ...e.detail };
    localStorage.setItem('cratemate_look', JSON.stringify(this.look));
    this.requestUpdate();
  };

  private handleVolumeChange = (e: CustomEvent<{ volume: number }>) => {
    this.volume = e.detail.volume;
    audioEngine.setVolume(this.volume);
  };

  private handlePadCountChange = async (e: CustomEvent<{ count: PadCount }>) => {
    const newCount = e.detail.count;
    if (newCount === this.padCount) return;
    this.padCount = newCount;
    await this.handleGenerateKit(false);
  };

  private handleScreenChange = (e: CustomEvent<{ screen: LcdScreen }>) => {
    this.currentScreen = e.detail.screen;
  };

  private handleReconnectFolder = async (folderId: string) => {
    const granted = await scanner.reconnectFolder(folderId);
    if (granted) {
      this.showToast('Folder connected!');
      await this.refreshData();
      this.preloadKitAudio(this.activeKit);
    } else {
      this.showToast('Permission not granted');
    }
  };

  /** True while the kit on screen was built against a layout that uses SP-404MKII pad numbers. */
  private get isSpNumbered(): boolean {
    return !!getLayout(this.activeKit?.layoutId)?.spNumbered;
  }

  render() {
    const allPresets = [...FACTORY_PRESETS, ...this.customPresets];
    const activePreset = allPresets.find(p => p.id === this.activePresetId) || FACTORY_PRESETS[0];
    const activePresetIdx = Math.max(0, allPresets.findIndex(p => p.id === this.activePresetId));
    const keptCount = this.activeKit?.pads.slice(0, this.padCount).filter(p => p.locked).length || 0;
    const defaultPrefix = this.folders.find(f => f.pathPrefix)?.pathPrefix || '';

    return html`
      <div class="chassis-wrapper ${this.look.vintage ? 'vintage' : ''}">
        ${this.look.vintage ? html`<span class="vintage-overlay"></span>` : ''}
          <!-- LEFT CONSOLE (LCD & HARDWARE CONTROLS) -->
          <div class="console-column">
            <mpc-lcd
              .screen=${this.currentScreen}
              .presetName=${activePreset.name}
              .serial=${String(this.serialNumber).padStart(3, '0')}
              .padCount=${this.padCount}
              .keptCount=${keptCount}
              .poolSize=${this.totalIndexedCount}
              .activeSlot=${this.activeSlot}
              .activePadIndex=${this.activePadIndex}
              .isPlaying=${this.isPlaying}
              .isGenerating=${this.isGeneratingKit}
              .folders=${this.folders}
              .folderCursor=${this.folderCursor}
              .roleMix=${(this.padCount === 16 && getLayout(this.activeLayoutId) ? layoutRoleMix(getLayout(this.activeLayoutId)!) : this.roleMix) || {}}
              .spNumbered=${this.isSpNumbered}
              .stickers=${this.look.stickers}
              @generate-kit=${() => this.handleGenerateKit(false)}
              @reroll-single-pad=${this.handleRerollSinglePad}
              @pad-lock=${this.handlePadLock}
              @swap-pad-role=${this.handleSwapPadRole}
              @role-mix-change=${this.handleRoleMixChange}
              @open-setup-disk=${() => this.isSetupDiskOpen = true}
              @add-folder=${() => { this.isSetupDiskOpen = true; }}
              @folder-toggle=${(e: CustomEvent<{ folderId: string }>) => this.handleReconnectFolder(e.detail.folderId)}
              @folder-cursor-change=${(e: CustomEvent<{ cursor: number }>) => this.folderCursor = e.detail.cursor}
            ></mpc-lcd>

            <mpc-controls
              .padCount=${this.padCount}
              .currentScreen=${this.currentScreen}
              .volume=${this.volume}
              .canUndo=${this.undoStack.length > 0}
              .isGenerating=${this.isGeneratingKit}
              .presetNames=${allPresets.map(p => p.name)}
              .activePresetIndex=${activePresetIdx}
              .sliderMode=${this.sliderMode}
              .spNumbered=${this.isSpNumbered}
              .activePadSlot=${this.activeSlot}
              .activePadIndex=${this.activePadIndex}
              .stickers=${this.look.stickers}
              .wheelField=${this.currentScreen === 'SOURCES' ? 'SOURCE' : this.currentScreen === 'INFO' ? this.sliderMode : 'PRESET'}
              @generate-kit=${() => this.handleGenerateKit(false)}
              @undo-kit=${this.handleUndo}
              @open-setup-disk=${() => this.isSetupDiskOpen = true}
              @pad-count-change=${this.handlePadCountChange}
              @screen-change=${this.handleScreenChange}
              @volume-change=${this.handleVolumeChange}
              @slider-mode-change=${(e: CustomEvent<{ mode: SliderMode }>) => this.sliderMode = e.detail.mode}
              @slider-value-change=${this.handleSliderValueChange}
              @data-wheel-step=${this.handleDataWheelStep}
            ></mpc-controls>
          </div>

          <!-- RIGHT PERFORMANCE PAD MATRIX -->
          <div class="pads-column">
            <pad-grid
              .pads=${this.activeKit?.pads || []}
              .padCount=${this.padCount}
              .freshIndices=${this.freshIndices}
              .spNumbered=${this.isSpNumbered}
              .pathPrefix=${defaultPrefix}
              .stickers=${this.look.stickers}
              @pad-trigger=${this.handlePadTrigger}
              @inspect-pad=${this.handleInspectPad}
              @pad-lock=${this.handlePadLock}
              @reroll-single-pad=${this.handleRerollSinglePad}
            ></pad-grid>
          </div>
      </div>

      <!-- SETUP DISK DRAWER MODAL -->
      <setup-disk-drawer
        .isOpen=${this.isSetupDiskOpen}
        .kit=${this.activeKit}
        .presets=${allPresets}
        .activePresetId=${this.activePresetId}
        .layouts=${PAD_LAYOUTS}
        .activeLayoutId=${this.activeLayoutId}
        .folders=${this.folders}
        .criteria=${this.activeCriteria}
        .stickers=${this.look.stickers}
        .vintage=${this.look.vintage}
        @close-disk=${() => this.isSetupDiskOpen = false}
        @reconnect-folder=${(e: CustomEvent<{ folderId: string }>) => this.handleReconnectFolder(e.detail.folderId)}
        @look-change=${this.handleLookChange}
        @select-layout=${this.handleSelectLayout}
        @select-preset=${(e: CustomEvent<{ presetId: string }>) => {
          this.activePresetId = e.detail.presetId;
          const p = allPresets.find(item => item.id === e.detail.presetId);
          if (p) this.activeCriteria = { ...p.criteria };
          this.handleGenerateKit(false);
        }}
        @folder-added=${async (e: CustomEvent<{ folder: FolderSource }>) => {
          this.showToast(`Scanning: ${e.detail.folder.name}`);
          await scanner.scanFolder(e.detail.folder);
          await this.refreshData();
          await this.handleGenerateKit(false);
        }}
        @criteria-change=${(e: CustomEvent<{ criteria: AcousticCriteria }>) => {
          this.activeCriteria = { ...this.activeCriteria, ...e.detail.criteria };
          this.handleGenerateKit(false);
        }}
        @toast=${(e: CustomEvent<{ message: string }>) => this.showToast(e.detail.message)}
      ></setup-disk-drawer>

      <!-- TOAST FEEDBACK -->
      ${this.toastMessage ? html`
        <div class="toast">
          <span>▸</span>
          <span>${this.toastMessage}</span>
        </div>
      ` : ''}
    `;
  }
}
