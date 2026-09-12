import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import type { FolderSource, ScanProgress } from '../types/index.ts';

@customElement('folder-manager')
export class FolderManager extends LitElement {
  @property({ type: Array }) folders: FolderSource[] = [];
  @property({ type: Object }) scanProgress?: ScanProgress;
  @property({ type: Boolean }) isOpen = false;

  static styles = css`
    :host {
      display: block;
      width: 100%;
    }

    .drawer-panel {
      background: #111318;
      border: 1px solid #232734;
      border-radius: 12px;
      padding: 16px;
      margin-bottom: 20px;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
    }

    .drawer-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
      margin-bottom: 14px;
    }

    .drawer-title-group {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .drawer-title {
      font-size: 15px;
      font-weight: 800;
      color: #ffffff;
      letter-spacing: -0.01em;
    }

    .folder-count-badge {
      font-size: 11px;
      font-family: 'JetBrains Mono', monospace;
      color: #8f9cae;
      background: #1c202a;
      padding: 2px 8px;
      border-radius: 12px;
      border: 1px solid #282f3f;
    }

    .add-folder-btn {
      background: #00d2d3;
      color: #0d0f14;
      font-family: inherit;
      font-size: 12px;
      font-weight: 700;
      border: none;
      padding: 8px 14px;
      border-radius: 8px;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      transition: all 0.15s;
    }

    .add-folder-btn:hover {
      background: #48dbfb;
      box-shadow: 0 2px 10px rgba(0, 210, 211, 0.4);
    }

    /* Scan progress banner */
    .progress-banner {
      background: #181b24;
      border: 1px solid #2d3345;
      border-radius: 10px;
      padding: 12px 16px;
      margin-bottom: 16px;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .progress-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 12px;
    }

    .progress-title {
      font-weight: 700;
      color: #00d2d3;
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .progress-stats {
      font-family: 'JetBrains Mono', monospace;
      font-size: 11px;
      color: #94a3b8;
    }

    .progress-bar-track {
      width: 100%;
      height: 8px;
      background: #0d0f14;
      border-radius: 4px;
      overflow: hidden;
      border: 1px solid #232734;
    }

    .progress-bar-fill {
      height: 100%;
      background: linear-gradient(90deg, #00d2d3, #2ecc71);
      border-radius: 4px;
      transition: width 0.2s ease-out;
    }

    .current-file-text {
      font-size: 11px;
      color: #8f9cae;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .cancel-scan-btn {
      background: transparent;
      border: 1px solid #e74c3c;
      color: #e74c3c;
      font-size: 10px;
      font-weight: 700;
      padding: 3px 8px;
      border-radius: 4px;
      cursor: pointer;
    }

    .cancel-scan-btn:hover {
      background: rgba(231, 76, 60, 0.15);
    }

    /* Folder list */
    .folder-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
      gap: 12px;
    }

    .folder-card {
      background: #181b24;
      border: 1px solid #252b3b;
      border-radius: 10px;
      padding: 14px;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .folder-top-row {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 8px;
    }

    .folder-name-col {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .folder-name {
      font-size: 14px;
      font-weight: 700;
      color: #f8fafc;
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .folder-path-input-group {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .input-label {
      font-size: 10px;
      font-weight: 600;
      color: #8f9cae;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .prefix-input {
      background: #0d0f14;
      border: 1px solid #232734;
      border-radius: 6px;
      padding: 6px 10px;
      color: #ffffff;
      font-family: 'JetBrains Mono', monospace;
      font-size: 11px;
      outline: none;
      transition: border-color 0.15s;
    }

    .prefix-input:focus {
      border-color: #00d2d3;
    }

    .folder-stats-row {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      font-family: 'JetBrains Mono', monospace;
      font-size: 11px;
    }

    .stat-pill {
      background: #0d0f14;
      padding: 3px 8px;
      border-radius: 4px;
      color: #94a3b8;
      border: 1px solid #1c202a;
    }

    .stat-pill.success {
      color: #2ecc71;
    }

    .stat-pill.info {
      color: #54a0ff;
    }

    .folder-actions {
      display: flex;
      justify-content: flex-end;
      align-items: center;
      gap: 8px;
      padding-top: 8px;
      border-top: 1px solid #232734;
    }

    .btn-sm {
      background: #232734;
      color: #cbd5e1;
      border: 1px solid #33394c;
      padding: 5px 10px;
      border-radius: 6px;
      font-size: 11px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.15s;
    }

    .btn-sm:hover {
      background: #2d3345;
      color: #ffffff;
    }

    .btn-relink {
      background: rgba(241, 196, 15, 0.15);
      border-color: rgba(241, 196, 15, 0.4);
      color: #f1c40f;
    }

    .btn-relink:hover {
      background: rgba(241, 196, 15, 0.25);
    }

    .btn-delete {
      color: #e74c3c;
      border-color: rgba(231, 76, 60, 0.3);
      background: transparent;
    }

    .btn-delete:hover {
      background: rgba(231, 76, 60, 0.15);
    }

    .empty-state {
      padding: 30px;
      text-align: center;
      color: #8f9cae;
      font-size: 13px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
    }
  `;

  private addFolder() {
    this.dispatchEvent(new CustomEvent('add-folder', {
      bubbles: true,
      composed: true
    }));
  }

  private scanFolder(folder: FolderSource) {
    this.dispatchEvent(new CustomEvent('scan-folder', {
      detail: { folder },
      bubbles: true,
      composed: true
    }));
  }

  private relinkFolder(folder: FolderSource) {
    this.dispatchEvent(new CustomEvent('relink-folder', {
      detail: { folder },
      bubbles: true,
      composed: true
    }));
  }

  private removeFolder(folder: FolderSource) {
    this.dispatchEvent(new CustomEvent('remove-folder', {
      detail: { folderId: folder.id },
      bubbles: true,
      composed: true
    }));
  }

  private updatePrefix(folder: FolderSource, e: Event) {
    const input = e.target as HTMLInputElement;
    this.dispatchEvent(new CustomEvent('update-prefix', {
      detail: { folderId: folder.id, prefix: input.value },
      bubbles: true,
      composed: true
    }));
  }

  private cancelScan() {
    this.dispatchEvent(new CustomEvent('cancel-scan', {
      bubbles: true,
      composed: true
    }));
  }

  render() {
    const progress = this.scanProgress;
    const isScanning = progress?.isScanning;

    // Calculate percentage if scanning
    let pct = 0;
    if (progress && progress.totalFound > 0) {
      const processed = progress.analyzed + progress.skipped;
      pct = Math.min(100, Math.round((processed / progress.totalFound) * 100));
    }

    return html`
      <div class="drawer-panel">
        <div class="drawer-header">
          <div class="drawer-title-group">
            <span class="drawer-title">📁 Sample Library Sources</span>
            <span class="folder-count-badge">${this.folders.length} Folders</span>
          </div>

          <button class="add-folder-btn" @click=${this.addFolder}>
            ➕ Add Sample Folder
          </button>
        </div>

        <!-- Scan Progress Banner -->
        ${isScanning ? html`
          <div class="progress-banner">
            <div class="progress-header">
              <span class="progress-title">
                ⏳ Scanning "${progress?.folderName}"...
              </span>
              <div style="display: flex; align-items: center; gap: 10px;">
                <span class="progress-stats">
                  Analyzed: ${progress?.analyzed} | Skipped (cached): ${progress?.skipped} | Total: ${progress?.totalFound}
                </span>
                <button class="cancel-scan-btn" @click=${this.cancelScan}>Stop</button>
              </div>
            </div>

            <div class="progress-bar-track">
              <div class="progress-bar-fill" style="width: ${pct}%"></div>
            </div>

            ${progress?.currentFile ? html`
              <div class="current-file-text">
                Decoding & profiling: <code>${progress.currentFile}</code>
              </div>
            ` : ''}
          </div>
        ` : ''}

        <!-- Folder List -->
        ${this.folders.length === 0 ? html`
          <div class="empty-state">
            <div>No local sample folders added yet.</div>
            <div style="font-size: 11px; opacity: 0.8;">
              Click "Add Sample Folder" to scan your drum kits, loops, or sample packs using the File System Access API.
            </div>
          </div>
        ` : html`
          <div class="folder-grid">
            ${this.folders.map(folder => html`
              <div class="folder-card">
                <div class="folder-top-row">
                  <div class="folder-name-col">
                    <div class="folder-name">
                      📁 ${folder.name}
                    </div>
                  </div>

                  ${folder.permissionGranted ? html`
                    <span class="stat-pill success">● Connected</span>
                  ` : html`
                    <button class="btn-sm btn-relink" @click=${() => this.relinkFolder(folder)}>
                      🔑 Re-link Handle
                    </button>
                  `}
                </div>

                <div class="folder-path-input-group">
                  <label class="input-label">Host OS Path Prefix (for DAW Copy Path):</label>
                  <input
                    type="text"
                    class="prefix-input"
                    placeholder="e.g. E:\\Audio\\Packs\\${folder.name}"
                    .value=${folder.pathPrefix || ''}
                    @change=${(e: Event) => this.updatePrefix(folder, e)}
                  />
                </div>

                <div class="folder-stats-row">
                  <span class="stat-pill">Found: ${folder.totalFiles || 0}</span>
                  <span class="stat-pill success">Indexed: ${folder.analyzedFiles || 0}</span>
                  <span class="stat-pill info">Cached: ${folder.skippedFiles || 0}</span>
                </div>

                <div class="folder-actions">
                  <button 
                    class="btn-sm" 
                    @click=${() => this.scanFolder(folder)}
                    ?disabled=${isScanning}
                  >
                    🔄 Scan Folder
                  </button>
                  <button 
                    class="btn-sm btn-delete" 
                    @click=${() => this.removeFolder(folder)}
                  >
                    🗑️ Remove
                  </button>
                </div>
              </div>
            `)}
          </div>
        `}
      </div>
    `;
  }
}
