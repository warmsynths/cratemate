import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type { Kit, KitPreset, FolderSource, AcousticCriteria, HardwareTarget, HardwareExportOptions, PadLayout, SampleRole } from '../types/index.ts';
import { hardwarePackager } from '../services/hardware-packager.ts';
import { scanner } from '../services/scanner.ts';
import { 
  ROOT_NOTES, 
  getCamelotFromRoot, 
  getMusicalKeyDef, 
  getHarmonicMatches, 
  type MusicalScale 
} from '../services/musical-keys.ts';

const LAYOUT_ROLE_COLORS: Record<SampleRole, string> = {
  'Kick/Low': '#c1382c',
  'Snare/Snap': '#3667b8',
  'Hat/Air': '#6f8036',
  'Tonal/Melodic': '#2b3037',
  'Texture/Wildcard': '#a9521a'
};

@customElement('setup-disk-drawer')
export class SetupDiskDrawer extends LitElement {
  @property({ type: Boolean }) isOpen = false;
  @property({ type: Object }) kit?: Kit;
  @property({ type: Array }) presets: KitPreset[] = [];
  @property({ type: String }) activePresetId = 'standard';
  @property({ type: Array }) layouts: PadLayout[] = [];
  @property({ type: String }) activeLayoutId = 'none';
  @property({ type: Array }) folders: FolderSource[] = [];
  @property({ type: Object }) criteria: AcousticCriteria = {};
  @property({ type: Boolean }) stickers = false;
  @property({ type: Boolean }) vintage = false;

  @state() private activeTab: 'PROGRAM' | 'KEY' | 'SOURCES' | 'EXPORT' | 'APPEARANCE' | 'KEYS' = 'PROGRAM';
  @state() private exportTarget: HardwareTarget = 'sp404mk2';
  @state() private includeSampleChain = true;
  @state() private normalizeAudio = true;
  @state() private bakePadFx = true;
  @state() private kitNameInput = '';
  @state() private isExporting = false;
  @state() private exportStatus = '';

  static styles = css`
    :host {
      display: block;
    }

    .drawer-overlay {
      position: fixed;
      inset: 0;
      background: rgba(20, 22, 18, 0.65);
      backdrop-filter: blur(2px);
      display: flex;
      align-items: flex-end;
      justify-content: center;
      z-index: 9999;
      padding: 0 12px;
      user-select: none;
    }

    .bay-casing {
      width: min(600px, 100%);
      max-height: 94vh;
      display: flex;
      flex-direction: column;
      background: linear-gradient(#41464d, #2b3036 22%, #23272c);
      border: 1px solid #16191d;
      border-bottom: none;
      border-radius: 8px 8px 0 0;
      box-shadow: 0 -14px 40px rgba(0, 0, 0, 0.55);
      animation: bayUp 260ms cubic-bezier(0.22, 0.9, 0.3, 1) both;
      overflow: hidden;
      font-family: 'Barlow', system-ui, sans-serif;
    }

    @keyframes bayUp {
      from { transform: translateY(102%); }
      to { transform: translateY(0); }
    }

    /* ZIP DRIVE TOP BEZEL */
    .drive-head {
      flex: 0 0 auto;
      padding: 9px 14px 7px;
      display: flex;
      align-items: center;
      gap: 12px;
      border-bottom: 1px solid #16191d;
      background: linear-gradient(#4a5058, #343a41);
    }

    .disk-led {
      width: 9px;
      height: 9px;
      border-radius: 50%;
      display: block;
      background: #ff9a3c;
      box-shadow: 0 0 7px rgba(255, 154, 60, 0.9);
      animation: diskLed 1.6s steps(1, end) infinite alternate;
    }

    @keyframes diskLed {
      0%, 55% { background: #7a2a1d; box-shadow: none; }
      70%, 100% { background: #ff9a3c; box-shadow: 0 0 7px rgba(255, 154, 60, 0.9); }
    }

    .disk-head-label {
      font-family: 'DM Mono', monospace;
      font-size: 10px;
      letter-spacing: 1.6px;
      color: #c6cbd1;
      font-weight: 600;
    }

    .drive-slot-bar {
      flex: 1 1 auto;
      height: 3px;
      border-radius: 2px;
      background: linear-gradient(#15181b, #2c3138);
      box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.8);
    }

    .eject-btn {
      font-family: 'Barlow Condensed', sans-serif;
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 1.6px;
      padding: 5px 12px;
      border: 1px solid #6f6a55;
      border-radius: 2px;
      cursor: pointer;
      background: linear-gradient(#efe7d2, #ded2b4);
      color: #25261f;
      box-shadow: 0 1px 0 #191c1f;
      outline: none;
      transition: all 60ms;
    }

    .eject-btn:hover {
      background: linear-gradient(#f6f0e0, #e4d9bd);
    }

    /* DRIVE BODY & BLUE CARTRIDGE */
    .drive-bay-body {
      flex: 1 1 auto;
      min-height: 0;
      overflow-y: auto;
      padding: 14px;
      background: repeating-linear-gradient(90deg, #2b3036 0 3px, #282d33 3px 6px);
    }

    .zip-cartridge {
      background: #2f4f9e;
      border: 1px solid #1a2f63;
      border-radius: 5px 5px 5px 16px;
      padding: 9px 9px 12px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.18);
      animation: diskIn 300ms 90ms cubic-bezier(0.2, 0.9, 0.3, 1) both;
    }

    @keyframes diskIn {
      from { transform: translateY(26px) scale(0.985); opacity: 0; }
      to { transform: translateY(0) scale(1); opacity: 1; }
    }

    .shutter-header {
      display: flex;
      align-items: center;
      gap: 9px;
      padding: 0 2px 8px;
    }

    .metal-shutter {
      flex: 0 0 74px;
      height: 15px;
      border-radius: 2px;
      background: linear-gradient(#cdd2d6, #9aa1a8);
      border: 1px solid #6d757d;
      box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.5);
    }

    .cartridge-title {
      font-family: 'Barlow Condensed', sans-serif;
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 2.4px;
      color: #cfd8ef;
    }

    .cartridge-label {
      background: #e9e3d2;
      border: 1px solid #b3ab94;
      border-radius: 2px;
      padding: 12px;
      display: flex;
      flex-direction: column;
      gap: 12px;
      box-shadow: inset 0 1px 0 #fff;
    }

    /* NAV TABS */
    .disk-nav-tabs {
      display: flex;
      gap: 4px;
      border-bottom: 2px solid #b3ab94;
      padding-bottom: 6px;
      overflow-x: auto;
    }

    .disk-tab-btn {
      font-family: 'Barlow Condensed', sans-serif;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 1.2px;
      padding: 4px 8px;
      border: 1px solid #9d9681;
      border-radius: 2px;
      background: #dfd8c5;
      color: #3c3d35;
      cursor: pointer;
      outline: none;
      transition: all 60ms;
      white-space: nowrap;
    }

    .disk-tab-btn:hover {
      background: #ece5d3;
    }

    .disk-tab-btn.active {
      background: #2f4f9e;
      color: #f7efe2;
      border-color: #1a2f63;
    }

    .section-title {
      font-family: 'Barlow Condensed', sans-serif;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 1.4px;
      color: #25261f;
      text-transform: uppercase;
      margin-bottom: 2px;
    }

    /* PROGRAM PRESETS */
    .preset-list {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
      gap: 5px;
    }

    /* HARMONIC KEY TONALITY */
    .key-config-box {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .key-mode-selector {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(110px, 1fr));
      gap: 4px;
    }

    .key-mode-btn {
      padding: 6px 8px;
      font-family: 'Barlow Condensed', sans-serif;
      font-weight: 700;
      font-size: 11px;
      letter-spacing: 0.8px;
      border: 1px solid #6f6a55;
      border-radius: 2px;
      background: #dfd8c5;
      color: #25261f;
      cursor: pointer;
      text-align: center;
      transition: all 60ms;
      outline: none;
    }

    .key-mode-btn.active {
      background: #2f4f9e;
      color: #f7efe2;
      border-color: #1a2f63;
      box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.25);
    }

    .key-grid {
      display: grid;
      grid-template-columns: repeat(6, 1fr);
      gap: 4px;
    }

    .key-note-btn {
      padding: 7px 4px;
      font-family: 'Barlow Condensed', sans-serif;
      font-weight: 700;
      font-size: 13px;
      letter-spacing: 0.5px;
      border: 1px solid #6f6a55;
      border-radius: 2px;
      background: #e7dfbe;
      color: #25261f;
      cursor: pointer;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 1px;
      transition: all 60ms;
      outline: none;
    }

    .key-note-btn.active {
      background: #3667b8;
      color: #f3f1e8;
      border-color: #28509a;
      box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.35);
    }

    .key-note-camelot {
      font-family: 'DM Mono', monospace;
      font-size: 8.5px;
      letter-spacing: 0.2px;
      opacity: 0.85;
    }

    .scale-selector {
      display: flex;
      gap: 6px;
    }

    .scale-btn {
      flex: 1;
      padding: 6px 10px;
      font-family: 'Barlow Condensed', sans-serif;
      font-weight: 700;
      font-size: 12px;
      letter-spacing: 1px;
      border: 1px solid #6f6a55;
      border-radius: 2px;
      background: #dfd8c5;
      color: #25261f;
      cursor: pointer;
      text-align: center;
      outline: none;
      transition: all 60ms;
    }

    .scale-btn.active {
      background: #3667b8;
      color: #f3f1e8;
      border-color: #28509a;
    }

    .harmony-banner {
      background: #d6ded7;
      border: 1px solid #9fb0a2;
      border-radius: 2px;
      padding: 8px 10px;
      display: flex;
      flex-direction: column;
      gap: 4px;
      font-family: 'Barlow', system-ui, sans-serif;
      font-size: 11px;
      color: #1e2e22;
    }

    .harmony-title {
      font-family: 'Barlow Condensed', sans-serif;
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 1px;
      display: flex;
      align-items: center;
      gap: 6px;
      flex-wrap: wrap;
    }

    .harmony-tag {
      background: #2b541a;
      color: #edf5ea;
      padding: 1px 6px;
      border-radius: 2px;
      font-family: 'DM Mono', monospace;
      font-size: 9.5px;
    }

    .harmony-matches-row {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
      align-items: center;
      margin-top: 2px;
    }

    .harmony-match-pill {
      background: #edf5ea;
      border: 1px solid #8fad76;
      border-radius: 2px;
      padding: 1.5px 5px;
      font-family: 'DM Mono', monospace;
      font-size: 9.5px;
      color: #1e3614;
    }

    .preset-item-btn {
      padding: 8px 6px;
      border: 1px solid #6f6a55;
      border-radius: 2px;
      cursor: pointer;
      background: #e7dfbe;
      color: #25261f;
      font-family: 'Barlow Condensed', sans-serif;
      font-weight: 700;
      font-size: 12px;
      letter-spacing: 0.6px;
      text-align: center;
      transition: all 60ms;
      outline: none;
    }

    .layout-hint {
      margin-left: 8px;
      font-weight: 500;
      letter-spacing: 1px;
      opacity: 0.6;
    }
    .layout-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
    }
    .layout-preview {
      display: grid;
      grid-template-columns: repeat(4, 8px);
      gap: 2px;
      flex: 0 0 auto;
    }
    .layout-preview i {
      width: 8px;
      height: 8px;
      border-radius: 1px;
      display: block;
    }
    .layout-preview i.ghost { opacity: 0.45; }

    .preset-item-btn:hover {
      background: #f0e9cd;
    }

    .preset-item-btn.selected {
      background: #3667b8;
      color: #f3f1e8;
      border-color: #28509a;
    }

    /* SOURCES LIST */
    .sources-box {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .source-row-item {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 6px 8px;
      background: #dfd8c5;
      border: 1px solid #b3ab94;
      border-radius: 2px;
      font-size: 12px;
    }

    .status-badge {
      font-family: 'Barlow Condensed', sans-serif;
      font-size: 9px;
      font-weight: 700;
      letter-spacing: 1px;
      padding: 2px 6px;
      border-radius: 2px;
    }

    .status-badge.connected {
      background: #d4e8c8;
      color: #2b541a;
      border: 1px solid #8fad76;
    }

    .relink-btn {
      font-family: 'Barlow Condensed', sans-serif;
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.8px;
      padding: 3px 8px;
      border: 1px solid #79241c;
      border-radius: 2px;
      background: linear-gradient(#cf4436, #a92e23);
      color: #fff;
      cursor: pointer;
    }

    .add-folder-action {
      margin-top: 4px;
      font-family: 'Barlow Condensed', sans-serif;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 1.2px;
      padding: 7px 12px;
      background: #2f4f9e;
      color: #fff;
      border: 1px solid #1a2f63;
      border-radius: 2px;
      cursor: pointer;
      align-self: flex-start;
    }

    /* EXPORT OPTIONS */
    .export-box {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .kit-name-field {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .kit-name-input {
      font-family: 'DM Mono', monospace;
      font-size: 13px;
      padding: 6px 8px;
      border: 1px solid #8b989c;
      border-radius: 2px;
      background: #fff;
      color: #25261f;
      text-transform: uppercase;
      outline: none;
    }

    .target-radio-group {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 6px;
    }

    .target-card {
      padding: 8px 10px;
      border: 1px solid #b3ab94;
      border-radius: 2px;
      background: #f7efe2;
      cursor: pointer;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .target-card.selected {
      border-color: #2f4f9e;
      background: #e2e8f8;
      box-shadow: inset 0 0 0 1px #2f4f9e;
    }

    .target-title {
      font-family: 'Barlow Condensed', sans-serif;
      font-weight: 700;
      font-size: 13px;
      color: #25261f;
    }

    .target-desc {
      font-size: 9.5px;
      color: #606259;
      line-height: 1.2;
    }

    .budget-banner {
      font-family: 'DM Mono', monospace;
      font-size: 10px;
      padding: 4px 6px;
      background: #dfd8c5;
      border: 1px solid #b3ab94;
      border-radius: 2px;
      color: #3c3d35;
    }

    .budget-banner.over {
      color: #c1382c;
      font-weight: 700;
      border-color: #c1382c;
      background: #fae8e6;
    }

    .toggle-row {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 11.5px;
      color: #25261f;
      cursor: pointer;
    }

    /* APPEARANCE TAB */
    .appearance-box {
      display: flex;
      flex-direction: column;
      gap: 12px;
      padding: 4px 0;
    }

    .setting-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 6px 8px;
      background: #dfd8c5;
      border: 1px solid #b3ab94;
      border-radius: 2px;
    }

    .setting-text {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .setting-name {
      font-family: 'Barlow Condensed', sans-serif;
      font-size: 13px;
      font-weight: 700;
      color: #25261f;
    }

    .setting-desc {
      font-size: 10px;
      color: #606259;
    }

    .toggle-switch-btn {
      padding: 4px 12px;
      font-family: 'Barlow Condensed', sans-serif;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 1px;
      border-radius: 2px;
      cursor: pointer;
      outline: none;
      transition: all 80ms;
    }

    .toggle-switch-btn.on {
      background: #2f4f9e;
      color: #fff;
      border: 1px solid #1a2f63;
    }

    .toggle-switch-btn.off {
      background: #b7c3c7;
      color: #3c3d35;
      border: 1px solid #8b989c;
    }

    /* BOTTOM TRAY BAR */
    .tray-bottom-bar {
      flex: 0 0 auto;
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 10px 14px;
      border-top: 1px solid #16191d;
      background: linear-gradient(#3a4047, #272c32);
    }

    .capacity-label {
      font-family: 'DM Mono', monospace;
      font-size: 10px;
      color: #9aa2aa;
      letter-spacing: 0.6px;
    }

    .write-disk-btn {
      margin-left: auto;
      font-family: 'Barlow Condensed', sans-serif;
      font-weight: 700;
      font-size: 13px;
      letter-spacing: 1.4px;
      padding: 8px 20px;
      white-space: nowrap;
      border: 1px solid #79241c;
      border-radius: 3px;
      background: linear-gradient(#cf4436, #a92e23);
      color: #f7efe2;
      cursor: pointer;
      box-shadow: 0 2px 0 #14171a;
      outline: none;
      transition: all 60ms;
    }

    .write-disk-btn:hover {
      background: linear-gradient(#db4f40, #b53628);
    }

    .write-disk-btn:active {
      transform: translateY(1.5px);
      box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.6);
    }

    .write-disk-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  `;

  private closeDrawer() {
    this.dispatchEvent(new CustomEvent('close-disk', {
      bubbles: true,
      composed: true
    }));
  }

  private handleSelectPreset(id: string) {
    this.dispatchEvent(new CustomEvent('select-preset', {
      detail: { presetId: id },
      bubbles: true,
      composed: true
    }));
  }

  private handleSelectLayout(id: string) {
    this.dispatchEvent(new CustomEvent('select-layout', {
      detail: { layoutId: id },
      bubbles: true,
      composed: true
    }));
  }

  private async handleAddFolder() {
    try {
      const folder = await scanner.pickAndAddFolder();
      this.dispatchEvent(new CustomEvent('folder-added', {
        detail: { folder },
        bubbles: true,
        composed: true
      }));
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        console.error('Folder registration failed:', err);
      }
    }
  }

  private updateCriteria(changes: Partial<AcousticCriteria>) {
    const updated = { ...this.criteria, ...changes };
    this.criteria = updated;
    this.dispatchEvent(new CustomEvent('criteria-change', {
      detail: { criteria: updated },
      bubbles: true,
      composed: true
    }));
  }

  private setKeyLockMode(mode: 'auto' | 'strict' | 'compatible' | 'any') {
    this.updateCriteria({ keyLockMode: mode });
  }

  private setRootNote(note: string) {
    const scale = this.criteria.targetScale || 'minor';
    const camelot = getCamelotFromRoot(note, scale);
    this.updateCriteria({
      targetRootNote: note,
      targetScale: scale,
      lockedCamelotKey: camelot,
      keyLockMode: this.criteria.keyLockMode === 'any' ? 'strict' : (this.criteria.keyLockMode || 'strict')
    });
  }

  private setScale(scale: MusicalScale) {
    const root = this.criteria.targetRootNote || 'A';
    const camelot = getCamelotFromRoot(root, scale);
    this.updateCriteria({
      targetRootNote: root,
      targetScale: scale,
      lockedCamelotKey: camelot,
      keyLockMode: this.criteria.keyLockMode === 'any' ? 'strict' : (this.criteria.keyLockMode || 'strict')
    });
  }

  private toggleAutoPitch(e: Event) {
    const checked = (e.target as HTMLInputElement).checked;
    this.updateCriteria({ autoPitchShift: checked });
  }

  private toggleStickers() {
    this.dispatchEvent(new CustomEvent('look-change', {
      detail: { stickers: !this.stickers },
      bubbles: true,
      composed: true
    }));
  }

  private toggleVintage() {
    this.dispatchEvent(new CustomEvent('look-change', {
      detail: { vintage: !this.vintage },
      bubbles: true,
      composed: true
    }));
  }

  private async handleWriteDisk() {
    if (!this.kit) return;
    this.isExporting = true;
    this.exportStatus = 'Packaging samples...';

    const effectiveName = (this.kitNameInput || this.kit.name).trim();

    try {
      const options: HardwareExportOptions = {
        target: this.exportTarget,
        includeSampleChain: this.includeSampleChain,
        convertToHardwareSpec: true,
        normalizeAudio: this.normalizeAudio,
        includeKitInfo: true,
        bakePadFx: this.bakePadFx
      };

      const kitToExport = { ...this.kit, name: effectiveName };

      await hardwarePackager.exportToZip(
        kitToExport,
        options,
        (status: string) => { this.exportStatus = status; }
      );

      const targetLabel = this.exportTarget === 'm8' ? 'M8' : this.exportTarget === 'sp404mk2' ? 'SP404' : this.exportTarget === 'po33' ? 'PO33' : 'UNIVERSAL';
      const filename = `${hardwarePackager.sanitizeName(effectiveName)}_${targetLabel}.zip`;

      this.dispatchEvent(new CustomEvent('toast', {
        detail: { message: `Export complete: ${filename}` },
        bubbles: true,
        composed: true
      }));

      setTimeout(() => {
        this.isExporting = false;
        this.exportStatus = '';
        this.closeDrawer();
      }, 500);
    } catch (err: any) {
      this.isExporting = false;
      this.exportStatus = `Error: ${err.message || err}`;
      console.error('Export failed:', err);
    }
  }

  render() {
    if (!this.isOpen) return null;

    const totalSamples = this.folders.reduce((acc, f) => acc + (f.totalFiles || 0), 0);

    return html`
      <div class="drawer-overlay" @click=${this.closeDrawer}>
        <div class="bay-casing" @click=${(e: Event) => e.stopPropagation()}>
          <!-- TOP DRIVE HEAD -->
          <div class="drive-head">
            <span class="disk-led"></span>
            <span class="disk-head-label">ZIP 100 · DISK 1</span>
            <span class="drive-slot-bar"></span>
            <button class="eject-btn" @click=${this.closeDrawer}>EJECT ⏏</button>
          </div>

          <!-- BLUE CARTRIDGE -->
          <div class="drive-bay-body">
            <div class="zip-cartridge">
              <div class="shutter-header">
                <span class="metal-shutter"></span>
                <span class="cartridge-title">CRATEMATE SETUP DISK</span>
              </div>

              <div class="cartridge-label">
                <!-- NAV TABS -->
                <div class="disk-nav-tabs">
                  <button 
                    class="disk-tab-btn ${this.activeTab === 'PROGRAM' ? 'active' : ''}"
                    @click=${() => this.activeTab = 'PROGRAM'}
                  >PROGRAM</button>
                  <button 
                    class="disk-tab-btn ${this.activeTab === 'KEY' ? 'active' : ''}"
                    @click=${() => this.activeTab = 'KEY'}
                  >
                    KEY & TONALITY
                  </button>
                  <button 
                    class="disk-tab-btn ${this.activeTab === 'SOURCES' ? 'active' : ''}"
                    @click=${() => this.activeTab = 'SOURCES'}
                  >SOURCES</button>
                  <button 
                    class="disk-tab-btn ${this.activeTab === 'EXPORT' ? 'active' : ''}"
                    @click=${() => this.activeTab = 'EXPORT'}
                  >HARDWARE EXPORT</button>
                  <button 
                    class="disk-tab-btn ${this.activeTab === 'APPEARANCE' ? 'active' : ''}"
                    @click=${() => this.activeTab = 'APPEARANCE'}
                  >APPEARANCE</button>
                  <button 
                    class="disk-tab-btn ${this.activeTab === 'KEYS' ? 'active' : ''}"
                    @click=${() => this.activeTab = 'KEYS'}
                  >KEYBINDS</button>
                </div>

                <!-- TAB CONTENT -->
                ${this.renderTabContent()}
              </div>
            </div>
          </div>

          <!-- BOTTOM ACTION BAR -->
          <div class="tray-bottom-bar">
            <span class="capacity-label">${this.isExporting ? this.exportStatus : `${totalSamples.toLocaleString()} SAMPLES INDEXED`}</span>
            <button 
              class="write-disk-btn" 
              ?disabled=${this.isExporting || !this.kit}
              @click=${this.handleWriteDisk}
            >
              ${this.isExporting ? 'WRITING...' : 'WRITE KIT TO DISK'}
            </button>
          </div>
        </div>
      </div>
    `;
  }

  private renderTabContent() {
    switch (this.activeTab) {
      case 'PROGRAM':
        return html`
          <div class="section-title">PROGRAM PRESETS</div>
          <div class="preset-list">
            ${this.presets.map(p => html`
              <button 
                class="preset-item-btn ${p.id === this.activePresetId ? 'selected' : ''}"
                @click=${() => this.handleSelectPreset(p.id)}
              >
                ${p.name}
              </button>
            `)}
          </div>

          <div class="section-title">PAD LAYOUT <span class="layout-hint">16-PAD KITS</span></div>
          <div class="preset-list">
            <button
              class="preset-item-btn ${this.activeLayoutId === 'none' ? 'selected' : ''}"
              @click=${() => this.handleSelectLayout('none')}
            >
              Standard (by pad count)
            </button>
            ${this.layouts.map(l => html`
              <button
                class="preset-item-btn layout-item ${l.id === this.activeLayoutId ? 'selected' : ''}"
                title=${l.description}
                @click=${() => this.handleSelectLayout(l.id)}
              >
                <span class="layout-name">${l.name}</span>
                <span class="layout-preview" aria-hidden="true">
                  ${[12, 13, 14, 15, 8, 9, 10, 11, 4, 5, 6, 7, 0, 1, 2, 3].map(i => html`
                    <i class="${l.slots[i].ghostOf !== undefined ? 'ghost' : ''}" style="background: ${LAYOUT_ROLE_COLORS[l.slots[i].role]}"></i>
                  `)}
                </span>
              </button>
            `)}
          </div>
        `;

      case 'KEY': {
        const currentRoot = this.criteria.targetRootNote || (this.criteria.lockedCamelotKey ? getMusicalKeyDef(this.criteria.lockedCamelotKey).root : 'A');
        const currentScale = (this.criteria.targetScale || (this.criteria.lockedCamelotKey ? getMusicalKeyDef(this.criteria.lockedCamelotKey).scale : 'minor')) as MusicalScale;
        const currentMode = this.criteria.keyLockMode || 'auto';
        const activeCamelot = this.criteria.lockedCamelotKey || getCamelotFromRoot(currentRoot, currentScale);
        const keyDef = getMusicalKeyDef(activeCamelot);
        const matches = getHarmonicMatches(activeCamelot);

        return html`
          <div class="section-title">HARMONIC KEY & TONALITY</div>
          <div class="key-config-box">
            <!-- MODE SELECTOR -->
            <div class="key-mode-selector">
              <button 
                class="key-mode-btn ${currentMode === 'auto' ? 'active' : ''}"
                @click=${() => this.setKeyLockMode('auto')}
                title="Automatically detect harmonic key from the first melodic sound"
              >⚡ AUTO-DETECT</button>
              <button 
                class="key-mode-btn ${currentMode === 'strict' ? 'active' : ''}"
                @click=${() => this.setKeyLockMode('strict')}
                title="Strictly match chords and melodic sounds in this exact key"
              >🔒 EXACT KEY</button>
              <button 
                class="key-mode-btn ${currentMode === 'compatible' ? 'active' : ''}"
                @click=${() => this.setKeyLockMode('compatible')}
                title="Circle of Fifths: match exact key and compatible 4th, 5th, & relative keys"
              >🎡 CIRCLE OF 5THS</button>
              <button 
                class="key-mode-btn ${currentMode === 'any' ? 'active' : ''}"
                @click=${() => this.setKeyLockMode('any')}
                title="Disable key filtering (chromatic/free)"
              >✕ ANY KEY</button>
            </div>

            ${currentMode !== 'any' ? html`
              <!-- SCALE SELECTOR (MINOR / MAJOR) -->
              <div class="scale-selector">
                <button 
                  class="scale-btn ${currentScale === 'minor' ? 'active' : ''}"
                  @click=${() => this.setScale('minor')}
                >
                  MINOR SCALE (A-Code)
                </button>
                <button 
                  class="scale-btn ${currentScale === 'major' ? 'active' : ''}"
                  @click=${() => this.setScale('major')}
                >
                  MAJOR SCALE (B-Code)
                </button>
              </div>

              <!-- 12-NOTE ROOT PITCH SELECTOR -->
              <div class="key-grid">
                ${ROOT_NOTES.map(note => {
                  const camelot = getCamelotFromRoot(note, currentScale);
                  const isSelected = currentRoot.toUpperCase() === note.toUpperCase();
                  return html`
                    <button 
                      class="key-note-btn ${isSelected ? 'active' : ''}"
                      @click=${() => this.setRootNote(note)}
                    >
                      <span>${note}${currentScale === 'minor' ? 'm' : ''}</span>
                      <span class="key-note-camelot">${camelot}</span>
                    </button>
                  `;
                })}
              </div>

              <!-- HARMONY SUMMARY BANNER -->
              <div class="harmony-banner">
                <div class="harmony-title">
                  <span>TARGET KEY:</span>
                  <span class="harmony-tag">${keyDef.name} (${keyDef.camelot})</span>
                  ${currentMode === 'strict' ? html`<span style="font-size: 10px; color: #79241c; font-weight: 700;">[STRICT LOCK]</span>` : ''}
                  ${currentMode === 'compatible' ? html`<span style="font-size: 10px; color: #2b541a; font-weight: 700;">[CIRCLE OF 5THS]</span>` : ''}
                </div>
                <div style="font-size: 10.5px; color: #2f3e33;">
                  All chords, melodic chops, basslines, and tonal sounds will be filtered and scored to fit this harmonic key.
                </div>
                <div class="harmony-matches-row">
                  <span style="font-size: 10px; font-weight: 700;">HARMONIC MATCHES:</span>
                  ${matches.all.map(c => {
                    const def = getMusicalKeyDef(c);
                    return html`<span class="harmony-match-pill">${def.shortName} (${c})</span>`;
                  })}
                </div>
              </div>

              <!-- AUTO-PITCH TRANSPOSITION TOGGLE -->
              <label class="toggle-row" style="margin-top: 2px;">
                <input 
                  type="checkbox" 
                  .checked=${!!this.criteria.autoPitchShift}
                  @change=${this.toggleAutoPitch}
                />
                <span style="font-weight: 600;">
                  Auto-pitch shift melodic chops within ±3 semitones to lock exact root pitch
                </span>
              </label>
            ` : html`
              <div class="harmony-banner">
                <div class="harmony-title">KEY FILTERING DISABLED</div>
                <div style="font-size: 10.5px; color: #4c4d44;">
                  Kit generator will select chords and melodic sounds freely across all musical keys.
                </div>
              </div>
            `}
          </div>
        `;
      }

      case 'SOURCES':
        return html`
          <div class="section-title">SAMPLE SOURCES</div>
          <div class="sources-box">
            ${this.folders.length === 0 ? html`
              <div style="font-size: 11px; color: #606259;">No folders connected yet. Connect your audio library to scan samples.</div>
            ` : this.folders.map(f => html`
              <div class="source-row-item">
                <span style="font-weight: 600;">▸ ${f.name}</span>
                <span style="margin-left: auto; font-family: 'DM Mono', monospace; font-size: 11px;">${f.totalFiles || 0} smp</span>
                ${f.permissionGranted ? html`
                  <span class="status-badge connected">● CONNECTED</span>
                ` : html`
                  <button 
                    class="relink-btn" 
                    @click=${() => this.dispatchEvent(new CustomEvent('reconnect-folder', { detail: { folderId: f.id }, bubbles: true, composed: true }))}
                  >
                    🔑 RECONNECT
                  </button>
                `}
              </div>
            `)}

            <button class="add-folder-action" @click=${this.handleAddFolder}>
              + ADD AUDIO FOLDER
            </button>
          </div>
        `;

      case 'EXPORT': {
        const totalDuration = this.kit ? this.kit.pads.slice(0, this.kit.padCount).reduce((acc, p) => acc + (p.sample?.acousticProfile.duration || 0), 0) : 0;
        const budgetSecs = this.exportTarget === 'po33' ? 40 : this.exportTarget === 'm8' ? 60 : 0;
        const isOverBudget = budgetSecs > 0 && totalDuration > budgetSecs;

        return html`
          <div class="section-title">HARDWARE TARGET SPEC</div>
          <div class="export-box">
            <div class="kit-name-field">
              <span class="setting-desc">KIT NAME (MAX 16 CHARS):</span>
              <input 
                class="kit-name-input"
                type="text"
                maxlength="16"
                .value=${this.kitNameInput || (this.kit?.name || '')}
                @input=${(e: any) => this.kitNameInput = e.target.value.toUpperCase()}
              />
            </div>

            <div class="target-radio-group">
              <div 
                class="target-card ${this.exportTarget === 'sp404mk2' ? 'selected' : ''}"
                @click=${() => this.exportTarget = 'sp404mk2'}
              >
                <div class="target-title">Roland SP-404MKII</div>
                <div class="target-desc">48kHz 16-bit PCM · /ROLAND/IMPORT/ · A01–A16 pads</div>
              </div>

              <div 
                class="target-card ${this.exportTarget === 'm8' ? 'selected' : ''}"
                @click=${() => this.exportTarget = 'm8'}
              >
                <div class="target-title">Dirtywave M8</div>
                <div class="target-desc">44.1kHz 16-bit PCM · /Samples/ · 8-track sliced chain</div>
              </div>

              <div 
                class="target-card ${this.exportTarget === 'universal' ? 'selected' : ''}"
                @click=${() => this.exportTarget = 'universal'}
              >
                <div class="target-title">Universal DAW / MPC</div>
                <div class="target-desc">44.1kHz 24-bit PCM · Standard sequential 01–16</div>
              </div>

              <div 
                class="target-card ${this.exportTarget === 'po33' ? 'selected' : ''}"
                @click=${() => this.exportTarget = 'po33'}
              >
                <div class="target-title">TE PO-33 / OP-Z</div>
                <div class="target-desc">22.05kHz mono chain · 40s total memory budget</div>
              </div>
            </div>

            <div class="budget-banner ${isOverBudget ? 'over' : ''}">
              ${this.kit?.padCount || 8} PADS · ${totalDuration.toFixed(1)}s ${budgetSecs > 0 ? `OF ${budgetSecs}s BUDGET` : ''} → ${this.exportTarget.toUpperCase()}${isOverBudget ? ' (OVER BUDGET)' : ''}
            </div>

            <label class="toggle-row">
              <input 
                type="checkbox" 
                .checked=${this.bakePadFx}
                @change=${(e: any) => this.bakePadFx = e.target.checked}
              />
              <span style="font-weight: 600;">Bake pad FX (Pitch, Filter, Decay, Drive, Trim, Reverse) into exported audio</span>
            </label>

            <label class="toggle-row">
              <input 
                type="checkbox" 
                .checked=${this.includeSampleChain}
                @change=${(e: any) => this.includeSampleChain = e.target.checked}
              />
              <span>Generate contiguous sliced sample chain WAV</span>
            </label>

            <label class="toggle-row">
              <input 
                type="checkbox" 
                .checked=${this.normalizeAudio}
                @change=${(e: any) => this.normalizeAudio = e.target.checked}
              />
              <span>Peak normalize audio to -0.5 dB</span>
            </label>
          </div>
        `;
      }

      case 'APPEARANCE':
        return html`
          <div class="section-title">HARDWARE IDENTITY & AESTHETICS</div>
          <div class="appearance-box">
            <div class="setting-item">
              <div class="setting-text">
                <span class="setting-name">STUDIO STICKERS</span>
                <span class="setting-desc">Authentic MPC stickers ("DON'T TOUCH", "DIG DEEPER", "STUDIO 4", "BEAT TAPE")</span>
              </div>
              <button 
                class="toggle-switch-btn ${this.stickers ? 'on' : 'off'}"
                @click=${this.toggleStickers}
              >
                ${this.stickers ? 'ENABLED' : 'DISABLED'}
              </button>
            </div>

            <div class="setting-item">
              <div class="setting-text">
                <span class="setting-name">VINTAGE PATINA TEXTURE</span>
                <span class="setting-desc">Analog multiply blend, paper texture grain & vignette overlay</span>
              </div>
              <button 
                class="toggle-switch-btn ${this.vintage ? 'on' : 'off'}"
                @click=${this.toggleVintage}
              >
                ${this.vintage ? 'ENABLED' : 'DISABLED'}
              </button>
            </div>
          </div>
        `;

      case 'KEYS':
        return html`
          <div class="section-title">MPC PERFORMANCE KEYBINDS</div>
          <div style="display: flex; flex-direction: column; gap: 6px; font-size: 12px; color: #3c3d35;">
            <div style="display: flex; justify-content: space-between;">
              <span>Pad 1–4 (Row 1):</span>
              <span style="font-family: 'DM Mono', monospace; font-weight: 600;">Z X C V / 1 2 3 4</span>
            </div>
            <div style="display: flex; justify-content: space-between;">
              <span>Pad 5–8 (Row 2):</span>
              <span style="font-family: 'DM Mono', monospace; font-weight: 600;">A S D F / 5 6 7 8</span>
            </div>
            <div style="display: flex; justify-content: space-between;">
              <span>Pad 9–12 (Row 3):</span>
              <span style="font-family: 'DM Mono', monospace; font-weight: 600;">Q W E R</span>
            </div>
            <div style="display: flex; justify-content: space-between;">
              <span>Keep / Lock Pad:</span>
              <span style="font-family: 'DM Mono', monospace; font-weight: 600;">SHIFT + Pad Key</span>
            </div>
            <div style="display: flex; justify-content: space-between;">
              <span>Respin Pad:</span>
              <span style="font-family: 'DM Mono', monospace; font-weight: 600;">ALT + Pad Key</span>
            </div>
            <div style="display: flex; justify-content: space-between;">
              <span>New Kit (Transport Roll):</span>
              <span style="font-family: 'DM Mono', monospace; font-weight: 600;">SPACE</span>
            </div>
            <div style="display: flex; justify-content: space-between;">
              <span>Undo Kit Reroll:</span>
              <span style="font-family: 'DM Mono', monospace; font-weight: 600;">⌘Z / CTRL+Z</span>
            </div>
            <div style="display: flex; justify-content: space-between;">
              <span>Close Disk / Modal:</span>
              <span style="font-family: 'DM Mono', monospace; font-weight: 600;">ESC</span>
            </div>
          </div>
        `;
    }
  }
}
