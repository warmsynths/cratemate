import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { storage } from '../services/storage.ts';
import { scanner } from '../services/scanner.ts';
import { audioEngine } from '../services/audio-engine.ts';
import { kitGenerator } from '../services/kit-generator.ts';
import { FACTORY_PRESETS, DEFAULT_PRESET_ID } from '../services/presets.ts';
import type { AcousticCriteria, FolderSource, Kit, KitPreset, PadCount, PadSlot } from '../types/index.ts';

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
  @state() private lastHitName = '—';
  @state() private activeSlot?: PadSlot;
  @state() private isPlaying = false;
  @state() private freshIndices: number[] = [];
  @state() private folderCursor = 0;
  @state() private serialNumber = 1;

  private undoStack: Kit[] = [];
  private toastTimeout = 0;
  private playTimeout = 0;
  private unsubscribeProgress?: () => void;

  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      height: 100vh;
      height: 100dvh;
      max-height: 100vh;
      background: linear-gradient(160deg, #dcddd7 0%, #cdcec8 55%, #c2c3bd 100%);
      color: #25261f;
      font-family: 'Barlow', system-ui, sans-serif;
      padding: clamp(4px, 0.8vh, 8px) 14px clamp(6px, 1vh, 10px);
      box-sizing: border-box;
      user-select: none;
      overflow: hidden;
    }

    .chassis-wrapper {
      max-width: 1380px;
      width: 100%;
      height: 100%;
      margin: 0 auto;
      display: flex;
      flex-direction: column;
      gap: clamp(4px, 0.8vh, 8px);
      min-height: 0;
      box-sizing: border-box;
    }

    /* TOP CHASSIS BRANDING BAR */
    .chassis-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      flex: 0 0 auto;
      padding-bottom: 2px;
      border-bottom: 2px solid #a2a39c;
    }

    .brand-title-group {
      display: flex;
      align-items: baseline;
      gap: 8px;
      flex-wrap: wrap;
    }

    .brand-main-title {
      font-family: 'Barlow Condensed', sans-serif;
      font-size: clamp(18px, 1.8vw, 22px);
      font-weight: 700;
      letter-spacing: 1.5px;
      color: #25261f;
      line-height: 1;
    }

    .brand-red-accent {
      color: #cf4436;
      font-size: clamp(15px, 1.5vw, 18px);
      letter-spacing: 1px;
    }

    .brand-sub-title {
      font-family: 'DM Mono', monospace;
      font-size: 9.5px;
      color: #4c4d44;
      letter-spacing: 0.6px;
    }

    .header-status-group {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .header-badge {
      font-family: 'DM Mono', monospace;
      font-size: 9.5px;
      color: #3c3d35;
      background: #b7c3c7;
      border: 1px solid #8b989c;
      padding: 1.5px 6px;
      border-radius: 2px;
    }

    /* FACEPLATE TWO-PANEL LAYOUT */
    .faceplate-layout {
      flex: 1 1 0;
      min-height: 0;
      display: flex;
      gap: 20px;
      align-items: stretch;
    }

    .console-column {
      flex: 0 0 clamp(380px, 34vw, 440px);
      max-width: 460px;
      min-width: 360px;
      min-height: 0;
      display: flex;
      flex-direction: column;
      gap: 14px;
    }

    .pads-column {
      flex: 1 1 0;
      min-width: 0;
      min-height: 0;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    /* RESPONSIVE MOBILE ADAPTATION */
    @media (max-width: 900px), (max-height: 520px) {
      :host {
        height: auto;
        min-height: 100vh;
        max-height: none;
        overflow-y: auto;
        padding: 10px 10px 24px;
      }
      .chassis-wrapper {
        height: auto;
      }
      .faceplate-layout {
        flex-direction: column;
        flex: 0 0 auto;
      }
      .console-column {
        flex: 1 1 100%;
        max-width: 100%;
        min-width: 0;
      }
      .pads-column {
        flex: 1 1 100%;
        min-width: 0;
      }
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

    await this.refreshData();

    // Subscribe to directory scanner progress updates
    this.unsubscribeProgress = scanner.onProgress(progress => {
      if (!progress.isScanning) {
        this.refreshData();
      }
      this.requestUpdate();
    });

    // Initialize audio volume
    audioEngine.setVolume(this.volume);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    window.removeEventListener('keydown', this.handleGlobalKeyDown);
    if (this.unsubscribeProgress) {
      this.unsubscribeProgress();
    }
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
        }).catch(() => {
          // In background preload, handle permissions may be prompt-pending.
          // Do NOT cache synthetic fallback into realAudioBuffers!
        });
      }
    }
  }

  private async refreshFolderPermissions() {
    let updated = false;
    for (const folder of this.folders) {
      const handle = folder.handle || await storage.getFolderHandle(folder.id);
      if (handle && 'queryPermission' in handle) {
        try {
          const perm = await (handle as any).queryPermission({ mode: 'read' });
          const isGranted = perm === 'granted';
          if (folder.permissionGranted !== isGranted) {
            folder.permissionGranted = isGranted;
            updated = true;
            await storage.saveFolderSource(folder);
          }
        } catch (_) {}
      }
    }
    if (updated) {
      this.folders = [...this.folders];
      this.requestUpdate();
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

    this.lastHitName = slot.sample.fileName.replace(/\.[^/.]+$/, '');
    this.activeSlot = slot;
    this.isPlaying = true;
    clearTimeout(this.playTimeout);
    this.playTimeout = window.setTimeout(() => {
      this.isPlaying = false;
    }, Math.min((slot.sample?.acousticProfile?.duration || 0.4) * 1000, 1600));

    try {
      const sample = slot.sample;
      const wasRealCached = audioEngine.isRealSampleCached(sample.id);
      await audioEngine.playSample(sample, () => scanner.getFileForSample(sample));

      // If user authorization succeeded during this click, immediately preload all kit samples from that folder!
      if (!wasRealCached && audioEngine.isRealSampleCached(sample.id)) {
        this.preloadKitAudio(this.activeKit);
        this.refreshFolderPermissions();
      }
    } catch (err) {
      console.warn('Playback error:', err);
    }
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
      this.showToast(`↻ Respun Pad ${String(padIndex + 1).padStart(2, '0')}`);
      // Audition immediately
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
        this.activeCriteria
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
    await storage.saveActiveKit(prev);
    this.showToast('Undo kit');
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

  private handleSelectPresetIndex = async (e: CustomEvent<{ index: number }>) => {
    const allPresets = [...FACTORY_PRESETS, ...this.customPresets];
    const target = allPresets[e.detail.index];
    if (target && target.id !== this.activePresetId) {
      this.activePresetId = target.id;
      this.activeCriteria = { ...target.criteria };
      await storage.saveActivePresetId(target.id);
      await this.handleGenerateKit(false);
    }
  };

  private handleWheelTurn = (e: CustomEvent<{ dir: number }>) => {
    const dir = e.detail.dir;
    if (this.currentScreen === 'SOURCES') {
      if (this.folders.length > 0) {
        this.folderCursor = Math.max(0, Math.min(this.folders.length - 1, this.folderCursor + dir));
      }
    } else {
      const SIZES: PadCount[] = [4, 6, 8, 16];
      const curIdx = SIZES.indexOf(this.padCount);
      const nextIdx = Math.max(0, Math.min(SIZES.length - 1, curIdx + dir));
      if (SIZES[nextIdx] !== this.padCount) {
        this.handlePadCountChange(new CustomEvent('pad-count-change', { detail: { count: SIZES[nextIdx] } }));
      }
    }
  };

  private handleFKeyPress = (e: CustomEvent<{ keyNum: number; screen: LcdScreen }>) => {
    const n = e.detail.keyNum;
    const screen = e.detail.screen;

    if (screen === 'INFO') {
      if (n === 1 && this.activeSlot) this.handleRerollSinglePad(new CustomEvent('reroll-single-pad', { detail: { padIndex: this.activeSlot.index } }));
      if (n === 3 && this.activeSlot) this.handlePadLock(new CustomEvent('pad-lock', { detail: { padIndex: this.activeSlot.index, locked: !this.activeSlot.locked } }));
      if (n === 4) this.currentScreen = 'SOURCES';
      if (n === 5) this.isSetupDiskOpen = true;
      if (n === 6) this.currentScreen = 'MAIN';
    } else if (screen === 'SOURCES') {
      if (n === 1) this.folderCursor = Math.max(0, this.folderCursor - 1);
      if (n === 2) this.folderCursor = Math.min(this.folders.length - 1, this.folderCursor + 1);
      if (n === 3) {
        const f = this.folders[this.folderCursor];
        if (f) this.handleReconnectFolder(f.id);
      }
      if (n === 4) this.isSetupDiskOpen = true;
      if (n === 6) this.currentScreen = 'MAIN';
    } else {
      // MAIN
      if (n === 1) this.handleGenerateKit(false);
      if (n === 2 && this.activeKit) {
        // Toggle Keep all
        const anyUnlocked = this.activeKit.pads.slice(0, this.padCount).some(p => !p.locked);
        this.activeKit.pads.forEach((p, idx) => { if (idx < this.padCount) p.locked = anyUnlocked; });
        storage.saveActiveKit(this.activeKit);
        this.requestUpdate();
      }
      if (n === 3) this.currentScreen = 'INFO';
      if (n === 4) this.currentScreen = 'SOURCES';
      if (n === 5) this.isSetupDiskOpen = true;
      if (n === 6) this.isSetupDiskOpen = true;
    }
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

  render() {
    const allPresets = [...FACTORY_PRESETS, ...this.customPresets];
    const activePreset = allPresets.find(p => p.id === this.activePresetId) || FACTORY_PRESETS[0];
    const activePresetIdx = Math.max(0, allPresets.findIndex(p => p.id === this.activePresetId));
    const keptCount = this.activeKit?.pads.slice(0, this.padCount).filter(p => p.locked).length || 0;
    const defaultPrefix = this.folders.find(f => f.pathPrefix)?.pathPrefix || '';

    return html`
      <div class="chassis-wrapper">
        <!-- TOP AUTHENTIC BRANDING HEADER -->
        <header class="chassis-header">
          <div class="brand-title-group">
            <span class="brand-main-title">CRATEMATE <span class="brand-red-accent">MPC2000XL</span></span>
            <span class="brand-sub-title">ACOUSTIC KIT CURATOR & HARDWARE SAMPLER</span>
          </div>

          <div class="header-status-group">
            <span class="header-badge">${this.totalIndexedCount.toLocaleString()} SAMPLES</span>
            <span class="header-badge">${this.folders.length} SOURCES</span>
          </div>
        </header>

        <!-- TWO PANEL CHASSIS LAYOUT -->
        <div class="faceplate-layout">
          <!-- LEFT CONSOLE (LCD & HARDWARE CONTROLS) -->
          <div class="console-column">
            <mpc-lcd
              .screen=${this.currentScreen}
              .presetName=${activePreset.name}
              .serial=${String(this.serialNumber).padStart(3, '0')}
              .padCount=${this.padCount}
              .keptCount=${keptCount}
              .poolSize=${this.totalIndexedCount}
              .lastHitName=${this.lastHitName}
              .activeSlot=${this.activeSlot}
              .isPlaying=${this.isPlaying}
              .folders=${this.folders}
              .folderCursor=${this.folderCursor}
              @fkey-press=${this.handleFKeyPress}
              @reconnect-folder=${(e: CustomEvent<{ folderId: string }>) => this.handleReconnectFolder(e.detail.folderId)}
              @select-folder-cursor=${(e: CustomEvent<{ index: number }>) => this.folderCursor = e.detail.index}
            ></mpc-lcd>

            <mpc-controls
              .padCount=${this.padCount}
              .currentScreen=${this.currentScreen}
              .volume=${this.volume}
              .canUndo=${this.undoStack.length > 0}
              .isGenerating=${this.isGeneratingKit}
              .presetNames=${allPresets.map(p => p.name)}
              .activePresetIndex=${activePresetIdx}
              @generate-kit=${() => this.handleGenerateKit(false)}
              @undo-kit=${this.handleUndo}
              @open-setup-disk=${() => this.isSetupDiskOpen = true}
              @pad-count-change=${this.handlePadCountChange}
              @screen-change=${this.handleScreenChange}
              @volume-change=${this.handleVolumeChange}
              @select-preset-index=${this.handleSelectPresetIndex}
              @wheel-turn=${this.handleWheelTurn}
            ></mpc-controls>
          </div>

          <!-- RIGHT PERFORMANCE PAD MATRIX -->
          <div class="pads-column">
            <pad-grid
              .pads=${this.activeKit?.pads || []}
              .padCount=${this.padCount}
              .freshIndices=${this.freshIndices}
              .pathPrefix=${defaultPrefix}
              @pad-trigger=${this.handlePadTrigger}
              @pad-lock=${this.handlePadLock}
              @reroll-single-pad=${this.handleRerollSinglePad}
            ></pad-grid>
          </div>
        </div>
      </div>

      <!-- SETUP DISK DRAWER MODAL -->
      <setup-disk-drawer
        .isOpen=${this.isSetupDiskOpen}
        .kit=${this.activeKit}
        .presets=${allPresets}
        .activePresetId=${this.activePresetId}
        .folders=${this.folders}
        .criteria=${this.activeCriteria}
        @close-disk=${() => this.isSetupDiskOpen = false}
        @reconnect-folder=${(e: CustomEvent<{ folderId: string }>) => this.handleReconnectFolder(e.detail.folderId)}
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
