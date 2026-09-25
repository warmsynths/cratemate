import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type { Kit, KitPreset, FolderSource, AcousticCriteria, HardwareTarget, HardwareExportOptions } from '../types/index.ts';
import { hardwarePackager } from '../services/hardware-packager.ts';
import { scanner } from '../services/scanner.ts';

@customElement('setup-disk-drawer')
export class SetupDiskDrawer extends LitElement {
  @property({ type: Boolean }) isOpen = false;
  @property({ type: Object }) kit?: Kit;
  @property({ type: Array }) presets: KitPreset[] = [];
  @property({ type: String }) activePresetId = 'standard';
  @property({ type: Array }) folders: FolderSource[] = [];
  @property({ type: Object }) criteria: AcousticCriteria = {};

  @state() private activeTab: 'PROGRAM' | 'SOURCES' | 'CRITERIA' | 'EXPORT' | 'KEYS' = 'PROGRAM';
  @state() private exportTarget: HardwareTarget = 'm8';
  @state() private includeSampleChain = true;
  @state() private normalizeAudio = true;
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
      width: min(580px, 100%);
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
      transition: all 80ms;
    }

    .eject-btn:hover {
      background: linear-gradient(#f6f0e0, #e4d9bd);
    }

    .eject-btn:active {
      transform: translateY(1px);
    }

    /* DISK TRAY INTERIOR */
    .drive-bay-body {
      flex: 1 1 auto;
      min-height: 0;
      overflow-y: auto;
      padding: 14px;
      background: repeating-linear-gradient(90deg, #2b3036 0 3px, #282d33 3px 6px);
    }

    /* BLUE ZIP 100 CARTRIDGE */
    .zip-cartridge {
      background: #2f4f9e;
      border: 1px solid #1a2f63;
      border-radius: 5px 5px 5px 18px;
      padding: 9px 9px 12px;
      box-shadow: 0 4px 14px rgba(0, 0, 0, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.18);
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
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 2.4px;
      color: #cfd8ef;
    }

    /* PAPER LABEL INSERT */
    .cartridge-label {
      background: #e9e3d2;
      border: 1px solid #b3ab94;
      border-radius: 2px;
      padding: 12px 14px;
      display: flex;
      flex-direction: column;
      gap: 14px;
      box-shadow: inset 0 1px 0 #fff;
    }

    /* TAB STRIP */
    .disk-nav-tabs {
      display: flex;
      gap: 4px;
      border-bottom: 1px solid #b3ab94;
      padding-bottom: 6px;
      overflow-x: auto;
    }

    .disk-tab-btn {
      font-family: 'Barlow Condensed', sans-serif;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 1.2px;
      padding: 4px 9px;
      border: 1px solid transparent;
      border-radius: 2px;
      background: transparent;
      color: #4c4d44;
      cursor: pointer;
    }

    .disk-tab-btn:hover {
      color: #25261f;
      background: rgba(0, 0, 0, 0.05);
    }

    .disk-tab-btn.active {
      background: #2f4f9e;
      color: #ffffff;
      border-color: #1a2f63;
    }

    /* PROGRAM LIST */
    .section-title {
      font-family: 'Barlow Condensed', sans-serif;
      font-size: 10px;
      font-weight: 600;
      letter-spacing: 1.8px;
      color: #3c3d35;
    }

    .preset-list {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .preset-item-btn {
      font-family: 'Barlow Condensed', sans-serif;
      font-weight: 600;
      font-size: 14px;
      letter-spacing: 0.6px;
      text-transform: uppercase;
      text-align: left;
      padding: 7px 10px;
      border: 1px solid #b3ab94;
      border-radius: 2px;
      cursor: pointer;
      background: #f7efe2;
      color: #25261f;
      transition: all 60ms;
    }

    .preset-item-btn:hover {
      background: #fffdf8;
    }

    .preset-item-btn.selected {
      background: #2f4f9e;
      color: #ffffff;
      border-color: #1a2f63;
    }

    /* SOURCES LIST */
    .sources-box {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .source-row-item {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 12px;
      color: #25261f;
    }

    .status-badge {
      font-family: 'DM Mono', monospace;
      font-size: 9.5px;
      font-weight: 600;
      padding: 2px 6px;
      border-radius: 2px;
    }

    .status-badge.connected {
      background: #e1f0da;
      color: #27631d;
      border: 1px solid #a4cca0;
    }

    .relink-btn {
      font-family: 'Barlow Condensed', sans-serif;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.8px;
      padding: 3px 8px;
      background: linear-gradient(#cf4436, #a92e23);
      color: #fff;
      border: 1px solid #79241c;
      border-radius: 2px;
      cursor: pointer;
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
    }

    .relink-btn:hover {
      background: linear-gradient(#db4f40, #b53628);
    }

    .add-folder-action {
      margin-top: 6px;
      font-family: 'Barlow Condensed', sans-serif;
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 1.2px;
      padding: 8px 12px;
      background: #2f4f9e;
      color: #fff;
      border: 1px solid #1a2f63;
      border-radius: 2px;
      cursor: pointer;
      align-self: flex-start;
    }

    .add-folder-action:hover {
      background: #3b60bd;
    }

    /* EXPORT OPTIONS */
    .export-box {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .target-radio-group {
      display: flex;
      gap: 8px;
    }

    .target-card {
      flex: 1;
      padding: 8px 10px;
      border: 1px solid #b3ab94;
      border-radius: 2px;
      background: #f7efe2;
      cursor: pointer;
      display: flex;
      flex-direction: column;
      gap: 3px;
    }

    .target-card.selected {
      border-color: #2f4f9e;
      background: #e2e8f8;
      box-shadow: inset 0 0 0 1px #2f4f9e;
    }

    .target-title {
      font-family: 'Barlow Condensed', sans-serif;
      font-weight: 700;
      font-size: 12px;
      color: #25261f;
    }

    .target-desc {
      font-size: 10px;
      color: #606259;
      line-height: 1.2;
    }

    .toggle-row {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 12px;
      color: #25261f;
      cursor: pointer;
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
      font-size: 14px;
      letter-spacing: 1.4px;
      padding: 9px 22px;
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

  private async handleWriteDisk() {
    if (!this.kit) return;
    this.isExporting = true;
    this.exportStatus = 'Packaging samples...';

    try {
      const options: HardwareExportOptions = {
        target: this.exportTarget,
        includeSampleChain: this.includeSampleChain,
        convertToHardwareSpec: true,
        normalizeAudio: this.normalizeAudio,
        includeKitInfo: true
      };

      await hardwarePackager.exportToZip(
        this.kit,
        options,
        (status: string) => { this.exportStatus = status; }
      );

      const targetLabel = this.exportTarget === 'm8' ? 'M8' : this.exportTarget === 'sp404mk2' ? 'SP404' : 'UNIVERSAL';
      const filename = `${hardwarePackager.sanitizeName(this.kit.name)}_${targetLabel}.zip`;

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
                    class="disk-tab-btn ${this.activeTab === 'SOURCES' ? 'active' : ''}"
                    @click=${() => this.activeTab = 'SOURCES'}
                  >SOURCES</button>
                  <button 
                    class="disk-tab-btn ${this.activeTab === 'EXPORT' ? 'active' : ''}"
                    @click=${() => this.activeTab = 'EXPORT'}
                  >HARDWARE EXPORT</button>
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
        `;

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

      case 'EXPORT':
        return html`
          <div class="section-title">HARDWARE EXPORT SPEC</div>
          <div class="export-box">
            <div class="target-radio-group">
              <div 
                class="target-card ${this.exportTarget === 'm8' ? 'selected' : ''}"
                @click=${() => this.exportTarget = 'm8'}
              >
                <div class="target-title">Dirtywave M8</div>
                <div class="target-desc">44.1kHz 16-bit PCM, /Samples/ organization, sliced chain WAV</div>
              </div>

              <div 
                class="target-card ${this.exportTarget === 'sp404mk2' ? 'selected' : ''}"
                @click=${() => this.exportTarget = 'sp404mk2'}
              >
                <div class="target-title">SP-404MKII</div>
                <div class="target-desc">48kHz 16-bit PCM, /ROLAND/IMPORT/ organization, A01–A16 mapping</div>
              </div>

              <div 
                class="target-card ${this.exportTarget === 'universal' ? 'selected' : ''}"
                @click=${() => this.exportTarget = 'universal'}
              >
                <div class="target-title">Universal DAW</div>
                <div class="target-desc">Standardized kit WAVs + sliced chain for MPC & general samplers</div>
              </div>
            </div>

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
              <span>Peak normalize audio to -0.3 dB</span>
            </label>
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
