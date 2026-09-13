import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { storage } from '../services/storage.ts';
import { scanner } from '../services/scanner.ts';
import { audioEngine } from '../services/audio-engine.ts';
import { kitGenerator } from '../services/kit-generator.ts';
import { FACTORY_PRESETS, DEFAULT_PRESET_ID } from '../services/presets.ts';
import type { AcousticCriteria, FolderSource, Kit, KitPreset, PadSlot, SampleRole, ScanProgress } from '../types/index.ts';

import './folder-manager.ts';
import './kit-controls.ts';
import './criteria-drawer.ts';
import './pad-grid.ts';
import './hardware-export-modal.ts';

@customElement('crate-mate-app')
export class CrateMateApp extends LitElement {
  @state() private folders: FolderSource[] = [];
  @state() private activeKit?: Kit;
  @state() private padCount: 4 | 6 | 8 = 8;
  @state() private isFolderManagerOpen = false;
  @state() private isCriteriaDrawerOpen = false;
  @state() private activePresetId: string = DEFAULT_PRESET_ID;
  @state() private customPresets: KitPreset[] = [];
  @state() private activeCriteria: AcousticCriteria = { ...FACTORY_PRESETS[0].criteria };
  @state() private scanProgress?: ScanProgress;
  @state() private totalIndexedCount = 0;
  @state() private isGeneratingKit = false;
  @state() private toastMessage?: string;
  @state() private showHelpModal = false;
  @state() private volume = audioEngine.getVolume(); // defaults to 0.10 (10%)
  @state() private preMuteVolume = 0.10;
  @state() private isExportModalOpen = false;

  private toastTimeout = 0;
  private unsubscribeProgress?: () => void;

  static styles = css`
    :host {
      display: block;
      min-height: 100vh;
      background: #090a0f;
      color: #e2e8f0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
    }

    /* Top indeterminate progress bar */
    .top-progress-bar {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      height: 3px;
      background: linear-gradient(90deg, #00d2d3, #a55eea, #00d2d3);
      background-size: 200% 100%;
      animation: moveProgress 1.0s linear infinite;
      z-index: 99999;
      box-shadow: 0 0 10px rgba(0, 210, 211, 0.8);
    }

    @keyframes moveProgress {
      0% { background-position: 200% 0; }
      100% { background-position: -200% 0; }
    }

    .app-shell {
      max-width: 1280px;
      margin: 0 auto;
      padding: 16px 20px 40px;
      display: flex;
      flex-direction: column;
      gap: 20px;
    }

    /* Top Navigation Header */
    header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 14px 20px;
      background: #111318;
      border: 1px solid #232734;
      border-radius: 14px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
    }

    .brand-group {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .logo-icon {
      width: 32px;
      height: 32px;
      background: linear-gradient(135deg, #00d2d3, #0abde3);
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 900;
      color: #090a0f;
      font-size: 18px;
      box-shadow: 0 0 16px rgba(0, 210, 211, 0.4);
    }

    .brand-text {
      display: flex;
      flex-direction: column;
    }

    .brand-title {
      font-size: 18px;
      font-weight: 900;
      letter-spacing: -0.03em;
      color: #ffffff;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .brand-badge {
      font-size: 9px;
      font-weight: 800;
      letter-spacing: 0.08em;
      background: #232734;
      color: #00d2d3;
      padding: 2px 6px;
      border-radius: 4px;
      text-transform: uppercase;
      border: 1px solid rgba(0, 210, 211, 0.3);
    }

    .brand-subtitle {
      font-size: 11px;
      color: #8f9cae;
      letter-spacing: -0.01em;
    }

    .nav-actions {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .stat-badge {
      font-family: 'JetBrains Mono', monospace;
      font-size: 11px;
      font-weight: 700;
      background: #181b24;
      border: 1px solid #282f3f;
      padding: 6px 12px;
      border-radius: 8px;
      color: #94a3b8;
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .stat-badge .dot {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: #2ecc71;
      box-shadow: 0 0 6px #2ecc71;
    }

    .btn-nav {
      background: #181b24;
      border: 1px solid #282f3f;
      color: #cbd5e1;
      padding: 7px 12px;
      border-radius: 8px;
      font-size: 12px;
      font-weight: 700;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      transition: all 0.15s;
    }

    .btn-nav:hover {
      background: #232734;
      color: #ffffff;
      border-color: #3b4458;
    }

    .btn-nav.active {
      background: rgba(0, 210, 211, 0.15);
      border-color: #00d2d3;
      color: #00d2d3;
    }

    .volume-widget {
      background: #181b24;
      border: 1px solid #282f3f;
      border-radius: 8px;
      padding: 5px 12px;
      display: flex;
      align-items: center;
      gap: 8px;
      box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.4);
    }

    .btn-mute {
      background: transparent;
      border: none;
      color: #8f9cae;
      cursor: pointer;
      font-size: 14px;
      padding: 0;
      display: flex;
      align-items: center;
      transition: all 0.15s;
    }

    .btn-mute:hover {
      color: #00d2d3;
      transform: scale(1.1);
    }

    .volume-slider {
      -webkit-appearance: none;
      appearance: none;
      width: 75px;
      height: 5px;
      background: #282f3f;
      border-radius: 3px;
      outline: none;
      cursor: pointer;
      accent-color: #00d2d3;
    }

    .volume-slider::-webkit-slider-thumb {
      -webkit-appearance: none;
      appearance: none;
      width: 13px;
      height: 13px;
      border-radius: 50%;
      background: #00d2d3;
      cursor: pointer;
      box-shadow: 0 0 6px rgba(0, 210, 211, 0.6);
      transition: transform 0.1s;
    }

    .volume-slider::-webkit-slider-thumb:hover {
      transform: scale(1.2);
    }

    .volume-label {
      font-family: 'JetBrains Mono', monospace;
      font-size: 11px;
      font-weight: 700;
      color: #00d2d3;
      min-width: 34px;
      text-align: right;
    }

    /* Main Pad Grid Area */
    main {
      display: flex;
      flex-direction: column;
      gap: 14px;
    }

    /* Toast notification */
    .toast {
      position: fixed;
      bottom: 24px;
      right: 24px;
      background: #181b24;
      border: 1px solid #00d2d3;
      color: #ffffff;
      font-size: 13px;
      font-weight: 600;
      padding: 10px 18px;
      border-radius: 10px;
      box-shadow: 0 8px 30px rgba(0, 0, 0, 0.7);
      display: flex;
      align-items: center;
      gap: 8px;
      z-index: 1000;
      animation: slideUp 0.2s cubic-bezier(0.16, 1, 0.3, 1);
    }

    @keyframes slideUp {
      from { transform: translateY(20px); opacity: 0; }
      to { transform: translateY(0); opacity: 1; }
    }

    /* Modal dialog */
    .modal-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.75);
      backdrop-filter: blur(4px);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10000;
      padding: 20px;
    }

    .modal-content {
      background: #15171e;
      border: 1px solid #2d3345;
      border-radius: 14px;
      padding: 24px;
      max-width: 520px;
      width: 100%;
      box-shadow: 0 12px 40px rgba(0, 0, 0, 0.8);
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .modal-title {
      font-size: 18px;
      font-weight: 800;
      color: #ffffff;
    }

    .hotkey-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
      font-size: 13px;
    }

    .hotkey-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 6px 0;
      border-bottom: 1px solid #232734;
    }

    .kbd {
      font-family: 'JetBrains Mono', monospace;
      font-size: 11px;
      font-weight: 700;
      background: #232734;
      color: #00d2d3;
      padding: 2px 8px;
      border-radius: 4px;
      border: 1px solid #33394c;
    }

    .btn-close {
      align-self: flex-end;
      background: #232734;
      color: #ffffff;
      border: none;
      font-weight: 700;
      font-size: 12px;
      padding: 8px 16px;
      border-radius: 8px;
      cursor: pointer;
    }

    .btn-close:hover {
      background: #33394c;
    }
  `;

  async connectedCallback() {
    super.connectedCallback();
    
    // Subscribe to scan progress
    this.unsubscribeProgress = scanner.onProgress((progress) => {
      this.scanProgress = { ...progress };
      if (!progress.isScanning) {
        this.refreshData();
      }
    });

    // Event listeners
    this.addEventListener('audition', ((e: Event) => this.handleAudition(e as CustomEvent<{ slot: PadSlot }>)) as EventListener);
    this.addEventListener('toggle-lock', ((e: Event) => this.handleToggleLock(e as CustomEvent<{ index: number }>)) as EventListener);
    this.addEventListener('reroll-kit', ((e: Event) => this.handleRerollKit(e as CustomEvent<{ rerollAll: boolean }>)) as EventListener);
    this.addEventListener('change-pad-count', ((e: Event) => this.handleChangePadCount(e as CustomEvent<{ count: 4 | 6 | 8 }>)) as EventListener);
    this.addEventListener('export-kit', this.handleExportKit as EventListener);
    this.addEventListener('add-folder', this.handleAddFolder as EventListener);
    this.addEventListener('scan-folder', ((e: Event) => this.handleScanFolder(e as CustomEvent<{ folder: FolderSource }>)) as EventListener);
    this.addEventListener('relink-folder', ((e: Event) => this.handleRelinkFolder(e as CustomEvent<{ folder: FolderSource }>)) as EventListener);
    this.addEventListener('remove-folder', ((e: Event) => this.handleRemoveFolder(e as CustomEvent<{ folderId: string }>)) as EventListener);
    this.addEventListener('update-prefix', ((e: Event) => this.handleUpdatePrefix(e as CustomEvent<{ folderId: string; prefix: string }>)) as EventListener);
    this.addEventListener('cancel-scan', this.handleCancelScan as EventListener);
    this.addEventListener('toast', ((e: Event) => this.handleToastEvent(e as CustomEvent<{ message: string }>)) as EventListener);

    // Preset & Criteria Event Listeners
    this.addEventListener('toggle-criteria-drawer', () => {
      this.isCriteriaDrawerOpen = !this.isCriteriaDrawerOpen;
    });
    this.addEventListener('close-drawer', () => {
      this.isCriteriaDrawerOpen = false;
    });
    this.addEventListener('select-preset', ((e: Event) => this.handleSelectPreset(e as CustomEvent<{ presetId: string }>)) as EventListener);
    this.addEventListener('update-criteria', ((e: Event) => this.handleUpdateCriteria(e as CustomEvent<{ criteria: AcousticCriteria }>)) as EventListener);
    this.addEventListener('apply-criteria', this.handleApplyCriteria as EventListener);
    this.addEventListener('reset-criteria', this.handleResetCriteria as EventListener);
    this.addEventListener('save-custom-preset', ((e: Event) => this.handleSaveCustomPreset(e as CustomEvent<{ name: string; icon: string; criteria: AcousticCriteria }>)) as EventListener);
    this.addEventListener('delete-custom-preset', ((e: Event) => this.handleDeleteCustomPreset(e as CustomEvent<{ presetId: string }>)) as EventListener);
    this.addEventListener('reroll-single-pad', ((e: Event) => this.handleRerollSinglePad(e as CustomEvent<{ padIndex: number }>)) as EventListener);
    this.addEventListener('change-pad-role', ((e: Event) => this.handleChangePadRole(e as CustomEvent<{ padIndex: number; newRole: SampleRole }>)) as EventListener);

    await this.initApp();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    if (this.unsubscribeProgress) {
      this.unsubscribeProgress();
    }
  }

  private async initApp() {
    await this.refreshData();

    // Load custom presets
    this.customPresets = await storage.getCustomPresets();

    // Check active preset
    const savedPresetId = await storage.getActivePresetId();
    if (savedPresetId) {
      this.activePresetId = savedPresetId;
    }

    const allPresets = [...FACTORY_PRESETS, ...this.customPresets];
    const currentPreset = allPresets.find(p => p.id === this.activePresetId) || FACTORY_PRESETS[0];
    this.activeCriteria = { ...currentPreset.criteria };

    // Check if active kit exists in storage, else generate initial kit
    const storedKit = await storage.getActiveKit();
    if (storedKit) {
      this.activeKit = storedKit;
      this.padCount = storedKit.padCount;
      if (storedKit.presetId) {
        this.activePresetId = storedKit.presetId;
      }
      if (storedKit.criteria) {
        this.activeCriteria = storedKit.criteria;
      }
    } else {
      this.activeKit = await kitGenerator.generateKit(
        this.padCount,
        undefined,
        false,
        this.activePresetId,
        this.activeCriteria
      );
    }
    this.preloadKitAudio(this.activeKit);
  }

  private async refreshData() {
    this.folders = await storage.getFolderSources();
    const allSamples = await storage.getAllSamples();
    this.totalIndexedCount = allSamples.length;

    // Check permissions silently
    for (const folder of this.folders) {
      if (folder.handle) {
        try {
          const status = await (folder.handle as any).queryPermission({ mode: 'read' });
          folder.permissionGranted = status === 'granted';
        } catch (_) {}
      }
    }
    this.requestUpdate();
  }

  private showToast(msg: string) {
    this.toastMessage = msg;
    clearTimeout(this.toastTimeout);
    this.toastTimeout = window.setTimeout(() => {
      this.toastMessage = undefined;
    }, 2400);
  }

  private handleToastEvent = (e: CustomEvent<{ message: string }>) => {
    this.showToast(e.detail.message);
  };

  private preloadKitAudio(kit?: Kit) {
    if (!kit) return;
    for (const pad of kit.pads) {
      if (!pad.sample) continue;
      if (pad.sample.folderId === 'demo_factory') {
        audioEngine.getOrCreateSampleBuffer(pad.sample);
      } else {
        scanner.getFileForSample(pad.sample).then(file => {
          if (file) {
            audioEngine.cachePadAudio(pad.sample!.id, file).catch(() => {});
          } else {
            audioEngine.getOrCreateSampleBuffer(pad.sample!);
          }
        }).catch(() => {
          audioEngine.getOrCreateSampleBuffer(pad.sample!);
        });
      }
    }
  }

  private handleAudition = async (e: CustomEvent<{ slot: PadSlot; padIndex?: number }>) => {
    const slot = e.detail.slot;
    if (!slot.sample) return;

    const isCached = audioEngine.isSampleCached ? audioEngine.isSampleCached(slot.sample.id) : false;
    if (!isCached) {
      slot.isLoading = true;
      if (this.activeKit) {
        this.activeKit = { ...this.activeKit, pads: [...this.activeKit.pads] };
      }
    }

    try {
      await audioEngine.playSample(slot.sample, () => scanner.getFileForSample(slot.sample!));
    } catch (err) {
      console.warn('Audition playback error:', err);
    } finally {
      if (slot.isLoading) {
        slot.isLoading = false;
        if (this.activeKit) {
          this.activeKit = { ...this.activeKit, pads: [...this.activeKit.pads] };
        }
      }
    }
  };

  private handleToggleLock = async (e: CustomEvent<{ index: number }>) => {
    if (!this.activeKit) return;
    const index = e.detail.index;
    const slot = this.activeKit.pads[index];
    if (slot) {
      slot.locked = !slot.locked;
      await storage.saveActiveKit(this.activeKit);
      this.requestUpdate();
    }
  };

  private handleRerollKit = async (e: CustomEvent<{ rerollAll: boolean }>) => {
    const rerollAll = e.detail.rerollAll;
    this.isGeneratingKit = true;
    try {
      this.activeKit = await kitGenerator.generateKit(
        this.padCount,
        this.activeKit,
        rerollAll,
        this.activePresetId,
        this.activeCriteria
      );
      this.showToast(rerollAll ? '⚡ Generated brand new kit!' : '🎲 Rerolled unlocked pads!');
    } finally {
      this.isGeneratingKit = false;
      this.preloadKitAudio(this.activeKit);
    }
  };

  private handleChangePadCount = async (e: CustomEvent<{ count: 4 | 6 | 8 }>) => {
    const newCount = e.detail.count;
    this.padCount = newCount;
    this.isGeneratingKit = true;
    try {
      this.activeKit = await kitGenerator.generateKit(
        newCount,
        this.activeKit,
        false,
        this.activePresetId,
        this.activeCriteria
      );
      this.showToast(`Switched to ${newCount}-pad layout`);
    } finally {
      this.isGeneratingKit = false;
      this.preloadKitAudio(this.activeKit);
    }
  };

  private handleSelectPreset = async (e: CustomEvent<{ presetId: string }>) => {
    const presetId = e.detail.presetId;
    const allPresets = [...FACTORY_PRESETS, ...this.customPresets];
    const preset = allPresets.find(p => p.id === presetId) || FACTORY_PRESETS[0];

    this.activePresetId = preset.id;
    this.activeCriteria = { ...preset.criteria };
    await storage.saveActivePresetId(preset.id);
    this.isGeneratingKit = true;

    try {
      this.activeKit = await kitGenerator.generateKit(
        this.padCount,
        this.activeKit,
        false,
        this.activePresetId,
        this.activeCriteria
      );
      this.showToast(`Style: ${preset.icon} ${preset.name}`);
    } finally {
      this.isGeneratingKit = false;
      this.preloadKitAudio(this.activeKit);
    }
  };

  private handleUpdateCriteria = (e: CustomEvent<{ criteria: AcousticCriteria }>) => {
    this.activeCriteria = { ...e.detail.criteria };
  };

  private handleApplyCriteria = async () => {
    this.isGeneratingKit = true;
    try {
      this.activeKit = await kitGenerator.generateKit(
        this.padCount,
        this.activeKit,
        false,
        this.activePresetId,
        this.activeCriteria
      );
      this.showToast('⚡ Applied criteria & refreshed kit');
    } finally {
      this.isGeneratingKit = false;
      this.preloadKitAudio(this.activeKit);
    }
  };

  private handleResetCriteria = async () => {
    const allPresets = [...FACTORY_PRESETS, ...this.customPresets];
    const preset = allPresets.find(p => p.id === this.activePresetId) || FACTORY_PRESETS[0];
    this.activeCriteria = { ...preset.criteria };
    this.isGeneratingKit = true;
    try {
      this.activeKit = await kitGenerator.generateKit(
        this.padCount,
        this.activeKit,
        false,
        this.activePresetId,
        this.activeCriteria
      );
      this.showToast(`Reset criteria to ${preset.name}`);
    } finally {
      this.isGeneratingKit = false;
      this.preloadKitAudio(this.activeKit);
    }
  };

  private handleSaveCustomPreset = async (e: CustomEvent<{ name: string; icon: string; criteria: AcousticCriteria }>) => {
    const newPreset: KitPreset = {
      id: 'custom_' + Date.now().toString(36),
      name: e.detail.name,
      icon: e.detail.icon,
      description: 'Custom user preset',
      isFactory: false,
      criteria: { ...e.detail.criteria }
    };
    await storage.saveCustomPreset(newPreset);
    this.customPresets = await storage.getCustomPresets();
    this.activePresetId = newPreset.id;
    this.activeCriteria = { ...newPreset.criteria };
    await storage.saveActivePresetId(newPreset.id);
    this.showToast(`Saved preset: ${newPreset.icon} ${newPreset.name}`);
  };

  private handleDeleteCustomPreset = async (e: CustomEvent<{ presetId: string }>) => {
    await storage.deleteCustomPreset(e.detail.presetId);
    this.customPresets = await storage.getCustomPresets();
    if (this.activePresetId === e.detail.presetId) {
      this.activePresetId = DEFAULT_PRESET_ID;
      this.activeCriteria = { ...FACTORY_PRESETS[0].criteria };
      await storage.saveActivePresetId(DEFAULT_PRESET_ID);
    }
    this.showToast('Custom preset deleted');
  };

  private handleRerollSinglePad = async (e: CustomEvent<{ padIndex: number }>) => {
    if (!this.activeKit) return;
    const targetPad = this.activeKit.pads[e.detail.padIndex];
    if (targetPad) {
      targetPad.isLoading = true;
      this.requestUpdate();
    }
    try {
      this.activeKit = await kitGenerator.rerollPad(e.detail.padIndex, this.activeKit, this.activeCriteria);
      this.preloadKitAudio(this.activeKit);
      this.showToast(`🎲 Rerolled Pad ${e.detail.padIndex + 1}`);
    } finally {
      if (this.activeKit && this.activeKit.pads[e.detail.padIndex]) {
        this.activeKit.pads[e.detail.padIndex].isLoading = false;
      }
      this.requestUpdate();
    }
  };

  private handleChangePadRole = async (e: CustomEvent<{ padIndex: number; newRole: SampleRole }>) => {
    if (!this.activeKit) return;
    const targetPad = this.activeKit.pads[e.detail.padIndex];
    if (targetPad) {
      targetPad.isLoading = true;
      this.requestUpdate();
    }
    try {
      this.activeKit = await kitGenerator.setPadRole(e.detail.padIndex, e.detail.newRole, this.activeKit, this.activeCriteria);
      this.preloadKitAudio(this.activeKit);
      this.showToast(`Pad ${e.detail.padIndex + 1} set to ${e.detail.newRole}`);
    } finally {
      if (this.activeKit && this.activeKit.pads[e.detail.padIndex]) {
        this.activeKit.pads[e.detail.padIndex].isLoading = false;
      }
      this.requestUpdate();
    }
  };

  private handleExportKit = () => {
    if (!this.activeKit) return;
    const samples = this.activeKit.pads
      .map(p => p.sample)
      .filter((s): s is NonNullable<typeof s> => !!s);

    if (samples.length === 0) {
      this.showToast('No samples in current kit to package');
      return;
    }

    this.isExportModalOpen = true;
  };

  private handleAddFolder = async () => {
    try {
      const folder = await scanner.pickAndAddFolder();
      this.showToast(`Added folder: ${folder.name}`);
      await this.refreshData();

      await scanner.scanFolder(folder);
      await this.refreshData();
      this.showToast(`Scan complete: ${folder.name}`);

      this.activeKit = await kitGenerator.generateKit(
        this.padCount,
        this.activeKit,
        false,
        this.activePresetId,
        this.activeCriteria
      );
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        this.showToast(`Could not add folder: ${err.message || err}`);
      }
    }
  };

  private handleScanFolder = async (e: CustomEvent<{ folder: FolderSource }>) => {
    const folder = e.detail.folder;
    try {
      await scanner.scanFolder(folder);
      await this.refreshData();
      this.showToast(`Scan complete: ${folder.name}`);
      this.activeKit = await kitGenerator.generateKit(
        this.padCount,
        this.activeKit,
        false,
        this.activePresetId,
        this.activeCriteria
      );
    } catch (err: any) {
      this.showToast(`Scan failed: ${err.message || err}`);
    }
  };

  private handleRelinkFolder = async (e: CustomEvent<{ folder: FolderSource }>) => {
    const folder = e.detail.folder;
    const granted = await scanner.verifyFolderPermission(folder, true);
    if (granted) {
      this.showToast(`Handle re-linked for ${folder.name}!`);
      await this.refreshData();
    } else {
      this.showToast(`Permission not granted for ${folder.name}`);
    }
  };

  private handleRemoveFolder = async (e: CustomEvent<{ folderId: string }>) => {
    await storage.removeFolderSource(e.detail.folderId);
    await this.refreshData();
    this.showToast('Folder and its indexed samples removed');
  };

  private handleUpdatePrefix = async (e: CustomEvent<{ folderId: string; prefix: string }>) => {
    const { folderId, prefix } = e.detail;
    const folder = this.folders.find(f => f.id === folderId);
    if (folder) {
      folder.pathPrefix = prefix;
      await storage.saveFolderSource(folder);
      this.showToast('Path prefix updated');
      this.requestUpdate();
    }
  };

  private handleCancelScan = () => {
    scanner.abortScan();
    this.showToast('Cancelling scan...');
  };

  private handleVolumeChange = (e: Event) => {
    const slider = e.target as HTMLInputElement;
    const val = parseInt(slider.value, 10) / 100;
    this.volume = val;
    audioEngine.setVolume(val);
  };

  private handleToggleMute = () => {
    if (this.volume > 0) {
      this.preMuteVolume = this.volume;
      this.volume = 0;
      audioEngine.setVolume(0);
    } else {
      const restore = this.preMuteVolume || 0.10;
      this.volume = restore;
      audioEngine.setVolume(restore);
    }
  };

  render() {
    const lockedCount = this.activeKit?.pads.filter(p => p.locked).length || 0;
    const defaultPrefix = this.folders.find(f => f.pathPrefix)?.pathPrefix || '';
    const allPresets = [...FACTORY_PRESETS, ...this.customPresets];

    return html`
      ${this.isGeneratingKit ? html`<div class="top-progress-bar"></div>` : ''}
      <div class="app-shell">
        <!-- Header -->
        <header>
          <div class="brand-group">
            <div class="logo-icon">C</div>
            <div class="brand-text">
              <div class="brand-title">
                <span>CRATEMATE</span>
                <span class="brand-badge">DSP V2</span>
              </div>
              <span class="brand-subtitle">Smart Sample Curation & Kit Generator</span>
            </div>
          </div>

          <div class="nav-actions">
            <div class="volume-widget">
              <button 
                class="btn-mute" 
                @click=${this.handleToggleMute}
                title="${this.volume === 0 ? 'Unmute' : 'Mute'}"
              >
                ${this.volume === 0 ? '🔇' : this.volume < 0.3 ? '🔈' : this.volume < 0.7 ? '🔉' : '🔊'}
              </button>
              <input
                type="range"
                class="volume-slider"
                min="0"
                max="100"
                .value=${String(Math.round(this.volume * 100))}
                @input=${this.handleVolumeChange}
              />
              <span class="volume-label">${Math.round(this.volume * 100)}%</span>
            </div>

            <div class="stat-badge">
              <span class="dot"></span>
              <span>${this.totalIndexedCount.toLocaleString()} Samples</span>
            </div>

            <button 
              class="btn-nav ${this.isFolderManagerOpen ? 'active' : ''}"
              @click=${() => this.isFolderManagerOpen = !this.isFolderManagerOpen}
              title="Manage local sample folders"
            >
              📁 Library Sources (${this.folders.length})
            </button>

            <button 
              class="btn-nav"
              @click=${() => this.showHelpModal = true}
              title="Keyboard shortcuts & guide"
            >
              ⌨️ Keys
            </button>
          </div>
        </header>

        <!-- Folder Sources Drawer -->
        ${this.isFolderManagerOpen || this.folders.length === 0 ? html`
          <folder-manager
            .folders=${this.folders}
            .scanProgress=${this.scanProgress}
            .isOpen=${this.isFolderManagerOpen}
          ></folder-manager>
        ` : ''}

        <!-- Main Workspace -->
        <main>
          <!-- Kit Toolbar & Controls -->
          <kit-controls
            .kit=${this.activeKit}
            .padCount=${this.padCount}
            .lockedCount=${lockedCount}
            .activePresetId=${this.activePresetId}
            .presets=${allPresets}
            .isCriteriaDrawerOpen=${this.isCriteriaDrawerOpen}
            .isGenerating=${this.isGeneratingKit}
          ></kit-controls>

          <!-- Criteria Drawer Panel -->
          <criteria-drawer
            .isOpen=${this.isCriteriaDrawerOpen}
            .activePresetId=${this.activePresetId}
            .presets=${allPresets}
            .criteria=${this.activeCriteria}
            .folders=${this.folders}
            .padCount=${this.padCount}
            .currentPads=${this.activeKit?.pads || []}
          ></criteria-drawer>

          <!-- Interactive Audition Pad Grid -->
          <pad-grid
            .pads=${this.activeKit?.pads || []}
            .pathPrefix=${defaultPrefix}
          ></pad-grid>
        </main>

        <!-- Toast Feedback -->
        ${this.toastMessage ? html`
          <div class="toast">
            <span>✨</span>
            <span>${this.toastMessage}</span>
          </div>
        ` : ''}

        <!-- Hotkey Help Modal -->
        ${this.showHelpModal ? html`
          <div class="modal-overlay" @click=${() => this.showHelpModal = false}>
            <div class="modal-content" @click=${(e: Event) => e.stopPropagation()}>
              <div class="modal-title">⌨️ Keyboard Performance Shortcuts</div>
              
              <div class="hotkey-list">
                <div class="hotkey-item">
                  <span>Trigger Pad 1 to 4</span>
                  <div>
                    <span class="kbd">1</span> <span class="kbd">2</span> <span class="kbd">3</span> <span class="kbd">4</span>
                    or <span class="kbd">Q</span> <span class="kbd">W</span> <span class="kbd">E</span> <span class="kbd">R</span>
                  </div>
                </div>

                <div class="hotkey-item">
                  <span>Trigger Pad 5 to 8</span>
                  <div>
                    <span class="kbd">5</span> <span class="kbd">6</span> <span class="kbd">7</span> <span class="kbd">8</span>
                    or <span class="kbd">A</span> <span class="kbd">S</span> <span class="kbd">D</span> <span class="kbd">F</span>
                  </div>
                </div>

                <div class="hotkey-item">
                  <span>Pad Click</span>
                  <span>Instant low-latency audition</span>
                </div>

                <div class="hotkey-item">
                  <span>Pad Lock (🔒)</span>
                  <span>Preserve sound when rerolling kit</span>
                </div>

                <div class="hotkey-item">
                  <span>Reroll Pad (🎲)</span>
                  <span>Reroll only that individual slot</span>
                </div>

                <div class="hotkey-item">
                  <span>Pad Role (🏷️)</span>
                  <span>Change slot role directly on card</span>
                </div>

                <div class="hotkey-item">
                  <span>Copy Path (📋)</span>
                  <span>Copies host path ready for external DAWs</span>
                </div>
              </div>

              <button class="btn-close" @click=${() => this.showHelpModal = false}>Got it</button>
            </div>
          </div>
        ` : ''}

        <!-- Hardware Export & Packaging Modal -->
        <hardware-export-modal
          .isOpen=${this.isExportModalOpen}
          .kit=${this.activeKit}
          @close-export-modal=${() => { this.isExportModalOpen = false; }}
        ></hardware-export-modal>
      </div>
    `;
  }
}
