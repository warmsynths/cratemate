import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type { Kit, HardwareTarget, HardwareExportOptions } from '../types/index.ts';
import { hardwarePackager } from '../services/hardware-packager.ts';

const STORAGE_KEY = 'cratemate_hardware_export_options';

@customElement('hardware-export-modal')
export class HardwareExportModal extends LitElement {
  @property({ type: Boolean }) isOpen = false;
  @property({ type: Object }) kit?: Kit;

  @state() private target: HardwareTarget = 'm8';
  @state() private includeSampleChain = true;
  @state() private convertToHardwareSpec = true;
  @state() private normalizeAudio = true;
  @state() private includeKitInfo = true;

  @state() private isProcessing = false;
  @state() private progressStatus = '';
  @state() private errorMessage = '';

  static styles = css`
    :host {
      display: block;
    }

    .modal-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(4, 6, 10, 0.82);
      backdrop-filter: blur(8px);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
      padding: 16px;
      animation: fadeIn 0.2s cubic-bezier(0.16, 1, 0.3, 1);
    }

    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }

    .modal-card {
      background: #11141c;
      border: 1px solid #232838;
      border-radius: 16px;
      width: 100%;
      max-width: 680px;
      max-height: 90vh;
      overflow-y: auto;
      box-shadow: 0 20px 50px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255, 255, 255, 0.05);
      display: flex;
      flex-direction: column;
      animation: slideUp 0.25s cubic-bezier(0.16, 1, 0.3, 1);
    }

    @keyframes slideUp {
      from { transform: translateY(16px); opacity: 0; }
      to { transform: translateY(0); opacity: 1; }
    }

    .modal-header {
      padding: 20px 24px 16px;
      border-bottom: 1px solid #1e2330;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .header-title-group {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .modal-title {
      font-size: 18px;
      font-weight: 800;
      color: #ffffff;
      display: flex;
      align-items: center;
      gap: 8px;
      letter-spacing: -0.02em;
    }

    .modal-subtitle {
      font-size: 12px;
      color: #8f9cae;
    }

    .close-btn {
      background: transparent;
      border: none;
      color: #8f9cae;
      font-size: 20px;
      cursor: pointer;
      padding: 4px 8px;
      border-radius: 6px;
      transition: all 0.15s;
    }

    .close-btn:hover {
      color: #ffffff;
      background: #1c202c;
    }

    .modal-body {
      padding: 20px 24px;
      display: flex;
      flex-direction: column;
      gap: 20px;
    }

    .section-label {
      font-size: 11px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: #64748b;
      margin-bottom: 8px;
    }

    /* Target Device Cards */
    .target-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 10px;
    }

    @media (max-width: 600px) {
      .target-grid {
        grid-template-columns: 1fr;
      }
    }

    .target-card {
      background: #161922;
      border: 2px solid #232838;
      border-radius: 12px;
      padding: 14px 12px;
      cursor: pointer;
      display: flex;
      flex-direction: column;
      gap: 6px;
      transition: all 0.18s cubic-bezier(0.16, 1, 0.3, 1);
      position: relative;
    }

    .target-card:hover {
      border-color: #3b4458;
      background: #1b1f2b;
    }

    .target-card.active {
      background: #141f2e;
      border-color: #00d2d3;
      box-shadow: 0 0 20px rgba(0, 210, 211, 0.15);
    }

    .target-card.active.sp404mk2 {
      background: #24181a;
      border-color: #ff6b6b;
      box-shadow: 0 0 20px rgba(255, 107, 107, 0.15);
    }

    .target-card.active.dual {
      background: #242016;
      border-color: #feca57;
      box-shadow: 0 0 20px rgba(254, 202, 87, 0.15);
    }

    .target-icon-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .target-icon {
      font-size: 22px;
    }

    .target-check {
      width: 16px;
      height: 16px;
      border-radius: 50%;
      background: #232838;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 10px;
      color: transparent;
      transition: all 0.15s;
    }

    .target-card.active .target-check {
      background: #00d2d3;
      color: #0d0f14;
    }

    .target-card.active.sp404mk2 .target-check {
      background: #ff6b6b;
      color: #0d0f14;
    }

    .target-card.active.dual .target-check {
      background: #feca57;
      color: #0d0f14;
    }

    .target-name {
      font-size: 13px;
      font-weight: 800;
      color: #ffffff;
    }

    .target-desc {
      font-size: 11px;
      color: #8f9cae;
      line-height: 1.35;
    }

    .target-badge {
      display: inline-block;
      font-family: 'JetBrains Mono', monospace;
      font-size: 9px;
      font-weight: 700;
      color: #00d2d3;
      background: rgba(0, 210, 211, 0.1);
      padding: 2px 6px;
      border-radius: 4px;
      margin-top: 4px;
      align-self: flex-start;
    }

    .sp404mk2 .target-badge {
      color: #ff6b6b;
      background: rgba(255, 107, 107, 0.1);
    }

    .dual .target-badge {
      color: #feca57;
      background: rgba(254, 202, 87, 0.1);
    }

    /* Options List */
    .options-container {
      display: flex;
      flex-direction: column;
      gap: 10px;
      background: #141720;
      border: 1px solid #1f2432;
      border-radius: 12px;
      padding: 14px 16px;
    }

    .option-row {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      cursor: pointer;
      user-select: none;
    }

    .option-checkbox {
      margin-top: 2px;
      accent-color: #00d2d3;
      width: 16px;
      height: 16px;
      cursor: pointer;
    }

    .option-text-group {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .option-title {
      font-size: 13px;
      font-weight: 700;
      color: #e2e8f0;
    }

    .option-desc {
      font-size: 11px;
      color: #7d8b9e;
      line-height: 1.3;
    }

    /* Preview box */
    .preview-box {
      background: #0a0c10;
      border: 1px solid #1c212d;
      border-radius: 10px;
      padding: 12px 14px;
      font-family: 'JetBrains Mono', monospace;
      font-size: 11px;
      color: #a0aec0;
      display: flex;
      flex-direction: column;
      gap: 4px;
      max-height: 140px;
      overflow-y: auto;
    }

    .preview-title {
      color: #00d2d3;
      font-weight: 700;
      margin-bottom: 2px;
    }

    .preview-line {
      display: flex;
      align-items: center;
      gap: 6px;
      white-space: nowrap;
    }

    .preview-line.file {
      color: #cbd5e1;
    }

    .preview-line.chain {
      color: #feca57;
      font-weight: 700;
    }

    .preview-line.info {
      color: #a55eea;
    }

    /* Progress Banner */
    .status-banner {
      padding: 10px 14px;
      border-radius: 8px;
      font-size: 12px;
      font-weight: 600;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .status-banner.processing {
      background: rgba(0, 210, 211, 0.12);
      border: 1px solid rgba(0, 210, 211, 0.3);
      color: #00d2d3;
    }

    .status-banner.error {
      background: rgba(235, 77, 75, 0.12);
      border: 1px solid rgba(235, 77, 75, 0.3);
      color: #eb4d4b;
    }

    .spinner {
      width: 14px;
      height: 14px;
      border: 2px solid rgba(0, 210, 211, 0.25);
      border-top-color: #00d2d3;
      border-radius: 50%;
      animation: spin 0.6s linear infinite;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    /* Modal Footer */
    .modal-footer {
      padding: 16px 24px 20px;
      border-top: 1px solid #1e2330;
      display: flex;
      justify-content: flex-end;
      align-items: center;
      gap: 12px;
      flex-wrap: wrap;
    }

    .btn {
      font-family: inherit;
      font-size: 13px;
      font-weight: 700;
      padding: 10px 18px;
      border-radius: 8px;
      border: 1px solid transparent;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      transition: all 0.15s cubic-bezier(0.16, 1, 0.3, 1);
    }

    .btn:active {
      transform: scale(0.97);
    }

    .btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
      transform: none !important;
    }

    .btn-secondary {
      background: #1c202a;
      color: #cbd5e1;
      border-color: #282f3f;
    }

    .btn-secondary:hover {
      background: #252b39;
      color: #ffffff;
    }

    .btn-zip {
      background: linear-gradient(135deg, #0984e3 0%, #00cec9 100%);
      color: #ffffff;
      box-shadow: 0 2px 10px rgba(9, 132, 227, 0.3);
    }

    .btn-zip:hover {
      background: linear-gradient(135deg, #74b9ff 0%, #81ecec 100%);
      color: #0d0f14;
    }

    .btn-sd {
      background: linear-gradient(135deg, #00b894 0%, #00cec9 100%);
      color: #0d0f14;
      font-weight: 800;
      box-shadow: 0 2px 12px rgba(0, 184, 148, 0.35);
    }

    .btn-sd:hover {
      background: linear-gradient(135deg, #55efc4 0%, #81ecec 100%);
    }
  `;

  connectedCallback() {
    super.connectedCallback();
    this.loadPreferences();
  }

  private loadPreferences() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.target) this.target = parsed.target;
        if (parsed.includeSampleChain !== undefined) this.includeSampleChain = parsed.includeSampleChain;
        if (parsed.convertToHardwareSpec !== undefined) this.convertToHardwareSpec = parsed.convertToHardwareSpec;
        if (parsed.normalizeAudio !== undefined) this.normalizeAudio = parsed.normalizeAudio;
        if (parsed.includeKitInfo !== undefined) this.includeKitInfo = parsed.includeKitInfo;
      }
    } catch {
      // ignore
    }
  }

  private savePreferences() {
    try {
      const prefs: HardwareExportOptions = {
        target: this.target,
        includeSampleChain: this.includeSampleChain,
        convertToHardwareSpec: this.convertToHardwareSpec,
        normalizeAudio: this.normalizeAudio,
        includeKitInfo: this.includeKitInfo
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
    } catch {
      // ignore
    }
  }

  private closeModal() {
    if (this.isProcessing) return;
    this.errorMessage = '';
    this.progressStatus = '';
    this.dispatchEvent(new CustomEvent('close-export-modal', {
      bubbles: true,
      composed: true
    }));
  }

  private setTarget(t: HardwareTarget) {
    this.target = t;
    this.savePreferences();
  }

  private toggleOption(key: keyof HardwareExportOptions) {
    if (key === 'includeSampleChain') this.includeSampleChain = !this.includeSampleChain;
    if (key === 'convertToHardwareSpec') this.convertToHardwareSpec = !this.convertToHardwareSpec;
    if (key === 'normalizeAudio') this.normalizeAudio = !this.normalizeAudio;
    if (key === 'includeKitInfo') this.includeKitInfo = !this.includeKitInfo;
    this.savePreferences();
  }

  private getExportOptions(): HardwareExportOptions {
    return {
      target: this.target,
      includeSampleChain: this.includeSampleChain,
      convertToHardwareSpec: this.convertToHardwareSpec,
      normalizeAudio: this.normalizeAudio,
      includeKitInfo: this.includeKitInfo
    };
  }

  private async handleExportToSD() {
    if (!this.kit) return;
    if (!('showDirectoryPicker' in window)) {
      this.errorMessage = 'File System Access API is not supported in this browser. Please use "Download .ZIP".';
      return;
    }

    this.isProcessing = true;
    this.errorMessage = '';
    this.progressStatus = 'Requesting destination directory...';

    try {
      const dirHandle = await (window as unknown as { showDirectoryPicker: () => Promise<FileSystemDirectoryHandle> }).showDirectoryPicker();
      const count = await hardwarePackager.exportToDirectory(
        this.kit,
        this.getExportOptions(),
        dirHandle,
        (msg) => { this.progressStatus = msg; }
      );
      this.progressStatus = `✅ Successfully wrote ${count} files directly to destination!`;
      setTimeout(() => {
        this.isProcessing = false;
        this.closeModal();
      }, 1400);
    } catch (err: any) {
      this.isProcessing = false;
      if (err.name !== 'AbortError') {
        this.errorMessage = err.message || 'Export failed';
      } else {
        this.progressStatus = '';
      }
    }
  }

  private async handleExportToZip() {
    if (!this.kit) return;

    this.isProcessing = true;
    this.errorMessage = '';
    this.progressStatus = 'Preparing kit files...';

    try {
      await hardwarePackager.exportToZip(
        this.kit,
        this.getExportOptions(),
        (msg) => { this.progressStatus = msg; }
      );
      this.progressStatus = '✅ ZIP archive downloaded successfully!';
      setTimeout(() => {
        this.isProcessing = false;
        this.closeModal();
      }, 1200);
    } catch (err: any) {
      this.isProcessing = false;
      this.errorMessage = err.message || 'ZIP creation failed';
    }
  }

  render() {
    if (!this.isOpen) return html``;

    const kit = this.kit;
    const kitName = kit ? hardwarePackager.sanitizeName(kit.name) : 'ReadyKit';
    const hasChain = this.includeSampleChain;
    const hasInfo = this.includeKitInfo;

    return html`
      <div class="modal-overlay" @click=${(e: Event) => e.target === e.currentTarget && this.closeModal()}>
        <div class="modal-card">
          <!-- Header -->
          <div class="modal-header">
            <div class="header-title-group">
              <div class="modal-title">
                <span>🎛️</span> Hardware Export & Packaging
              </div>
              <div class="modal-subtitle">
                Package <strong>${kit?.name || 'Current Kit'}</strong> directly for hardware grooveboxes & trackers
              </div>
            </div>
            <button class="close-btn" @click=${this.closeModal} ?disabled=${this.isProcessing}>✕</button>
          </div>

          <!-- Body -->
          <div class="modal-body">
            <!-- Target Selection -->
            <div>
              <div class="section-label">Select Hardware Target</div>
              <div class="target-grid">
                <!-- Dirtywave M8 -->
                <div
                  class="target-card ${this.target === 'm8' ? 'active' : ''}"
                  @click=${() => this.setTarget('m8')}
                >
                  <div class="target-icon-row">
                    <span class="target-icon">📟</span>
                    <span class="target-check">✓</span>
                  </div>
                  <div class="target-name">Dirtywave M8</div>
                  <div class="target-desc">44.1kHz • Tracks 01-08 • Sliced Mode</div>
                  <span class="target-badge">SD: /Samples/</span>
                </div>

                <!-- Roland SP-404MKII -->
                <div
                  class="target-card sp404mk2 ${this.target === 'sp404mk2' ? 'active sp404mk2' : ''}"
                  @click=${() => this.setTarget('sp404mk2')}
                >
                  <div class="target-icon-row">
                    <span class="target-icon">🎛️</span>
                    <span class="target-check">✓</span>
                  </div>
                  <div class="target-name">Roland SP-404MKII</div>
                  <div class="target-desc">48.0kHz • Bank A Pads A01-A08</div>
                  <span class="target-badge">SD: /ROLAND/IMPORT/</span>
                </div>

                <!-- Dual / Universal -->
                <div
                  class="target-card dual ${this.target === 'dual' ? 'active dual' : ''}"
                  @click=${() => this.setTarget('dual')}
                >
                  <div class="target-icon-row">
                    <span class="target-icon">⚡</span>
                    <span class="target-check">✓</span>
                  </div>
                  <div class="target-name">Dual Package</div>
                  <div class="target-desc">Both M8 & SP-404 pre-sorted trees</div>
                  <span class="target-badge">Multi-Device</span>
                </div>
              </div>
            </div>

            <!-- Options Checklist -->
            <div>
              <div class="section-label">Package Features & Audio Settings</div>
              <div class="options-container">
                <!-- Sliced Sample Chain -->
                <label class="option-row">
                  <input
                    type="checkbox"
                    class="option-checkbox"
                    .checked=${this.includeSampleChain}
                    @change=${() => this.toggleOption('includeSampleChain')}
                  />
                  <div class="option-text-group">
                    <span class="option-title">Generate Sliced Sample Chain (Single WAV)</span>
                    <span class="option-desc">Equal-division slice concatenation for M8 SLICED mode (08 slices) or SP-404MKII Auto-Chop (saves tracks/pads).</span>
                  </div>
                </label>

                <!-- Hardware Spec Audio Conversion -->
                <label class="option-row">
                  <input
                    type="checkbox"
                    class="option-checkbox"
                    .checked=${this.convertToHardwareSpec}
                    @change=${() => this.toggleOption('convertToHardwareSpec')}
                  />
                  <div class="option-text-group">
                    <span class="option-title">Convert to Target Hardware Audio Spec</span>
                    <span class="option-desc">Resamples to native 44.1kHz (M8) or 48.0kHz (SP-404MKII) 16-bit linear PCM to avoid slow hardware conversion.</span>
                  </div>
                </label>

                <!-- Peak Normalization -->
                <label class="option-row">
                  <input
                    type="checkbox"
                    class="option-checkbox"
                    .checked=${this.normalizeAudio}
                    @change=${() => this.toggleOption('normalizeAudio')}
                  />
                  <div class="option-text-group">
                    <span class="option-title">True-Peak Normalization (-0.5 dBFS)</span>
                    <span class="option-desc">Optimizes dynamic range for punchy sampler playback while eliminating clipping distortion.</span>
                  </div>
                </label>

                <!-- KIT_INFO.txt -->
                <label class="option-row">
                  <input
                    type="checkbox"
                    class="option-checkbox"
                    .checked=${this.includeKitInfo}
                    @change=${() => this.toggleOption('includeKitInfo')}
                  />
                  <div class="option-text-group">
                    <span class="option-title">Include Musical Companion Guide (KIT_INFO.txt)</span>
                    <span class="option-desc">Reference file with Camelot key, root note, suggested BPM, pad assignments, and hardware import guide.</span>
                  </div>
                </label>
              </div>
            </div>

            <!-- Structure Preview -->
            <div>
              <div class="section-label">Target File Hierarchy Preview</div>
              <div class="preview-box">
                ${this.target === 'm8' ? html`
                  <div class="preview-title">📁 Samples/CrateMate/${kitName}/</div>
                  <div class="preview-line file">├── 01_Kick_Low_*.wav</div>
                  <div class="preview-line file">├── 02_Snare_Snap_*.wav</div>
                  <div class="preview-line file">├── 03_Hat_Air_*.wav ... [up to Pad ${kit?.padCount || 8}]</div>
                  ${hasChain ? html`<div class="preview-line chain">├── ${kitName}_Chain_08Slice_44k.wav (Single-Track Slices)</div>` : ''}
                  ${hasInfo ? html`<div class="preview-line info">└── KIT_INFO.txt (Harmonic key & BPM cheat-sheet)</div>` : ''}
                ` : this.target === 'sp404mk2' ? html`
                  <div class="preview-title">📁 ROLAND/IMPORT/CrateMate/${kitName}/</div>
                  <div class="preview-line file">├── A01_Kick_Low_*.wav (Bank A Pad 1)</div>
                  <div class="preview-line file">├── A02_Snare_Snap_*.wav (Bank A Pad 2)</div>
                  <div class="preview-line file">├── A03_Hat_Air_*.wav ... [up to Pad ${kit?.padCount || 8}]</div>
                  ${hasChain ? html`<div class="preview-line chain">├── ${kitName}_Chain_16Pad_48k.wav (Auto-Chop Chain)</div>` : ''}
                  ${hasInfo ? html`<div class="preview-line info">└── KIT_INFO.txt (Harmonic key & BPM cheat-sheet)</div>` : ''}
                ` : html`
                  <div class="preview-title">📁 Dual Package Layout:</div>
                  <div class="preview-line file">├── 📁 m8/Samples/CrateMate/${kitName}/ (44.1kHz • 01-08)</div>
                  <div class="preview-line file">└── 📁 sp404mk2/ROLAND/IMPORT/CrateMate/${kitName}/ (48.0kHz • A01-A08)</div>
                `}
              </div>
            </div>

            <!-- Progress / Error Status -->
            ${this.isProcessing ? html`
              <div class="status-banner processing">
                <span class="spinner"></span>
                <span>${this.progressStatus}</span>
              </div>
            ` : this.errorMessage ? html`
              <div class="status-banner error">
                <span>⚠️ ${this.errorMessage}</span>
              </div>
            ` : ''}
          </div>

          <!-- Footer Actions -->
          <div class="modal-footer">
            <button class="btn btn-secondary" @click=${this.closeModal} ?disabled=${this.isProcessing}>
              Cancel
            </button>

            <button class="btn btn-zip" @click=${this.handleExportToZip} ?disabled=${this.isProcessing}>
              📦 Download .ZIP
            </button>

            <button class="btn btn-sd" @click=${this.handleExportToSD} ?disabled=${this.isProcessing}>
              💾 Save to SD Card / Folder
            </button>
          </div>
        </div>
      </div>
    `;
  }
}
