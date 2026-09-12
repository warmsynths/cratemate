import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type { AcousticCriteria, FolderSource, KitPreset, PadSlot, RoleAcousticTarget, SampleRole } from '../types/index.ts';
import { FACTORY_ROLE_TEMPLATES } from '../services/presets.ts';

const CAMELOT_KEYS = [
  '1A', '1B', '2A', '2B', '3A', '3B', '4A', '4B',
  '5A', '5B', '6A', '6B', '7A', '7B', '8A', '8B',
  '9A', '9B', '10A', '10B', '11A', '11B', '12A', '12B'
];

const ROLES: SampleRole[] = [
  'Kick/Low',
  'Snare/Snap',
  'Hat/Air',
  'Tonal/Melodic',
  'Texture/Wildcard'
];

@customElement('criteria-drawer')
export class CriteriaDrawer extends LitElement {
  @property({ type: Boolean }) isOpen = false;
  @property({ type: String }) activePresetId = 'standard';
  @property({ type: Array }) presets: KitPreset[] = [];
  @property({ type: Object }) criteria: AcousticCriteria = {};
  @property({ type: Array }) folders: FolderSource[] = [];
  @property({ type: Number }) padCount: 4 | 6 | 8 = 8;
  @property({ type: Array }) currentPads: PadSlot[] = [];

  @state() private isSavingPreset = false;
  @state() private newPresetName = '';
  @state() private newPresetIcon = '✨';
  @state() private activeRoleTab: SampleRole = 'Kick/Low';
  @state() private showAdvancedRoles = false;

  static styles = css`
    :host {
      display: block;
      width: 100%;
    }

    .drawer-container {
      background: #11141c;
      border: 1px solid #232738;
      border-radius: 14px;
      padding: 18px 20px;
      margin-top: 10px;
      display: flex;
      flex-direction: column;
      gap: 18px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.45);
      animation: expandPanel 0.2s cubic-bezier(0.16, 1, 0.3, 1);
    }

    @keyframes expandPanel {
      from { opacity: 0; transform: translateY(-8px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .drawer-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid #1e2230;
      padding-bottom: 12px;
    }

    .title-area {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .title-area h3 {
      margin: 0;
      font-size: 15px;
      font-weight: 800;
      color: #ffffff;
      letter-spacing: -0.01em;
    }

    .preset-badge {
      font-size: 11px;
      font-weight: 700;
      padding: 2px 8px;
      border-radius: 12px;
      background: rgba(0, 210, 211, 0.15);
      color: #00d2d3;
      border: 1px solid rgba(0, 210, 211, 0.3);
    }

    .btn-close {
      background: transparent;
      border: none;
      color: #8f9cae;
      font-size: 18px;
      cursor: pointer;
      padding: 4px 8px;
      border-radius: 6px;
      transition: all 0.15s;
    }

    .btn-close:hover {
      background: #1e2230;
      color: #ffffff;
    }

    /* Presets Pills Row */
    .presets-row {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: center;
    }

    .preset-pill {
      background: #181b24;
      border: 1px solid #282f3f;
      color: #94a3b8;
      font-size: 12px;
      font-weight: 700;
      padding: 6px 12px;
      border-radius: 8px;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      transition: all 0.15s;
    }

    .preset-pill:hover {
      background: #232734;
      color: #ffffff;
      border-color: #3b4458;
    }

    .preset-pill.active {
      background: rgba(0, 210, 211, 0.15);
      border-color: #00d2d3;
      color: #00d2d3;
      box-shadow: 0 0 12px rgba(0, 210, 211, 0.25);
    }

    .btn-delete-custom {
      background: transparent;
      border: none;
      color: #ff4757;
      cursor: pointer;
      font-size: 11px;
      padding: 0 2px;
      margin-left: 2px;
    }

    .btn-delete-custom:hover {
      transform: scale(1.2);
    }

    .btn-save-preset {
      background: #1c202a;
      border: 1px dashed #3b4458;
      color: #38ef7d;
      font-size: 11px;
      font-weight: 700;
      padding: 6px 12px;
      border-radius: 8px;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 5px;
      transition: all 0.15s;
    }

    .btn-save-preset:hover {
      background: rgba(56, 239, 125, 0.12);
      border-color: #38ef7d;
    }

    .save-form-inline {
      display: flex;
      gap: 8px;
      align-items: center;
      background: #151822;
      padding: 8px 12px;
      border-radius: 8px;
      border: 1px solid #2e3549;
    }

    .save-input {
      background: #0d0f14;
      border: 1px solid #232734;
      color: #ffffff;
      padding: 6px 10px;
      border-radius: 6px;
      font-size: 12px;
      outline: none;
      width: 180px;
    }

    .save-input:focus {
      border-color: #00d2d3;
    }

    .icon-input {
      background: #0d0f14;
      border: 1px solid #232734;
      color: #ffffff;
      padding: 6px 8px;
      border-radius: 6px;
      font-size: 12px;
      width: 40px;
      text-align: center;
    }

    /* Section Subheading */
    .section-title {
      font-size: 12px;
      font-weight: 800;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      color: #00d2d3;
      display: flex;
      align-items: center;
      gap: 6px;
      margin-top: 4px;
    }

    /* Settings Grid */
    .settings-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
      gap: 14px;
    }

    .setting-card {
      background: #151821;
      border: 1px solid #202433;
      border-radius: 10px;
      padding: 12px 14px;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .setting-label {
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      color: #8f9cae;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .options-row {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }

    .option-btn {
      background: #0d0f14;
      border: 1px solid #232734;
      color: #94a3b8;
      font-size: 11px;
      font-weight: 600;
      padding: 5px 10px;
      border-radius: 6px;
      cursor: pointer;
      transition: all 0.15s;
    }

    .option-btn:hover {
      color: #ffffff;
      border-color: #3b4458;
    }

    .option-btn.active {
      background: #232734;
      color: #00d2d3;
      border-color: #00d2d3;
    }

    /* Range input styling */
    .range-group {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .range-label-row {
      display: flex;
      justify-content: space-between;
      font-size: 11px;
      color: #94a3b8;
      font-family: 'JetBrains Mono', monospace;
    }

    .slider {
      -webkit-appearance: none;
      appearance: none;
      width: 100%;
      height: 4px;
      background: #282f3f;
      border-radius: 2px;
      outline: none;
      accent-color: #00d2d3;
      cursor: pointer;
    }

    /* Toggle pill */
    .toggle-row {
      display: flex;
      align-items: center;
      gap: 8px;
      cursor: pointer;
      font-size: 12px;
      color: #cbd5e1;
    }

    .toggle-row input[type="checkbox"] {
      accent-color: #00d2d3;
      cursor: pointer;
      width: 15px;
      height: 15px;
    }

    /* Folders Selector */
    .folders-checklist {
      display: flex;
      flex-direction: column;
      gap: 6px;
      max-height: 100px;
      overflow-y: auto;
    }

    .folder-check-item {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 12px;
      color: #cbd5e1;
      cursor: pointer;
    }

    .folder-check-item input[type="checkbox"] {
      accent-color: #00d2d3;
      cursor: pointer;
    }

    /* Advanced Section Toggle */
    .advanced-toggle-btn {
      background: #181b24;
      border: 1px solid #282f3f;
      color: #e2e8f0;
      font-size: 12px;
      font-weight: 800;
      padding: 8px 14px;
      border-radius: 8px;
      cursor: pointer;
      display: flex;
      justify-content: space-between;
      align-items: center;
      transition: all 0.15s;
    }

    .advanced-toggle-btn:hover {
      background: #232734;
      border-color: #00d2d3;
    }

    /* Advanced Role Editor */
    .advanced-role-panel {
      background: #0d0f14;
      border: 1px solid #282f3f;
      border-radius: 10px;
      padding: 14px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .role-tabs-bar {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      border-bottom: 1px solid #202433;
      padding-bottom: 8px;
    }

    .role-tab-btn {
      background: #151821;
      border: 1px solid #232734;
      color: #8f9cae;
      font-size: 11px;
      font-weight: 700;
      padding: 5px 12px;
      border-radius: 6px;
      cursor: pointer;
      transition: all 0.15s;
    }

    .role-tab-btn:hover {
      color: #ffffff;
      border-color: #3b4458;
    }

    .role-tab-btn.active {
      background: #232734;
      color: #00d2d3;
      border-color: #00d2d3;
    }

    .keywords-tag-container {
      display: flex;
      flex-wrap: wrap;
      gap: 5px;
      align-items: center;
    }

    .kw-tag {
      font-family: 'JetBrains Mono', monospace;
      font-size: 10px;
      background: #181b24;
      color: #38ef7d;
      border: 1px solid rgba(56, 239, 125, 0.3);
      padding: 2px 7px;
      border-radius: 4px;
    }

    .kw-tag.negative {
      color: #ff6b81;
      border-color: rgba(255, 107, 129, 0.3);
      background: rgba(255, 107, 129, 0.08);
    }

    /* Pad Slot Role Layout Preview */
    .slot-layout-container {
      background: #151821;
      border: 1px solid #202433;
      border-radius: 10px;
      padding: 12px 14px;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .slot-chips-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
      gap: 8px;
    }

    .slot-chip {
      background: #0d0f14;
      border: 1px solid #232734;
      border-radius: 8px;
      padding: 6px 10px;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .slot-chip-header {
      display: flex;
      justify-content: space-between;
      font-size: 10px;
      font-weight: 800;
      color: #8f9cae;
    }

    .role-select {
      background: #181b24;
      border: 1px solid #282f3f;
      color: #00d2d3;
      font-size: 11px;
      font-weight: 700;
      padding: 3px 6px;
      border-radius: 6px;
      outline: none;
      cursor: pointer;
      width: 100%;
    }

    .role-select:focus {
      border-color: #00d2d3;
    }

    /* Action Footer */
    .drawer-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-top: 1px solid #1e2230;
      padding-top: 12px;
      gap: 10px;
    }

    .footer-left {
      display: flex;
      gap: 10px;
    }

    .btn-apply {
      background: linear-gradient(135deg, #00d2d3 0%, #0abde3 100%);
      color: #090a0f;
      font-size: 12px;
      font-weight: 800;
      border: none;
      padding: 8px 18px;
      border-radius: 8px;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      transition: all 0.15s;
    }

    .btn-apply:hover {
      box-shadow: 0 4px 16px rgba(0, 210, 211, 0.4);
      transform: translateY(-1px);
    }

    .btn-ghost {
      background: #181b24;
      border: 1px solid #282f3f;
      color: #8f9cae;
      font-size: 12px;
      font-weight: 700;
      padding: 8px 14px;
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.15s;
    }

    .btn-ghost:hover {
      background: #232734;
      color: #ffffff;
    }
  `;

  private selectPreset(preset: KitPreset) {
    this.dispatchEvent(new CustomEvent('select-preset', {
      detail: { presetId: preset.id },
      bubbles: true,
      composed: true
    }));
  }

  private deleteCustomPreset(e: Event, presetId: string) {
    e.stopPropagation();
    this.dispatchEvent(new CustomEvent('delete-custom-preset', {
      detail: { presetId },
      bubbles: true,
      composed: true
    }));
  }

  private handleMacroPunch(e: Event) {
    const val = parseInt((e.target as HTMLInputElement).value, 10);
    this.updateCriteria({ macroPunch: val });
  }

  private handleMacroLength(e: Event) {
    const val = parseInt((e.target as HTMLInputElement).value, 10);
    this.updateCriteria({ macroLength: val });
  }

  private handleMacroTone(tone: 'neutral' | 'warm' | 'bright') {
    this.updateCriteria({ macroTone: tone });
  }

  private handleGenreAffinity(e: Event) {
    const val = parseInt((e.target as HTMLInputElement).value, 10);
    this.updateCriteria({ genreAffinityStrength: val });
  }

  private handleToggleAntiMasking(e: Event) {
    const checked = (e.target as HTMLInputElement).checked;
    this.updateCriteria({ antiMaskingEnabled: checked });
  }

  private handleTogglePackAffinity(e: Event) {
    const checked = (e.target as HTMLInputElement).checked;
    this.updateCriteria({ packAffinityEnabled: checked });
  }

  private handleKeyLockMode(mode: 'auto' | 'strict' | 'any') {
    this.updateCriteria({ keyLockMode: mode });
  }

  private handleCamelotKey(key: string) {
    this.updateCriteria({ lockedCamelotKey: key, keyLockMode: 'strict' });
  }

  private toggleFolder(folderId: string) {
    const current = this.criteria.folderIds || [];
    let updated: string[];
    if (current.includes(folderId)) {
      updated = current.filter(id => id !== folderId);
    } else {
      updated = [...current, folderId];
    }
    this.updateCriteria({ folderIds: updated });
  }

  private handleSlotRoleChange(slotIndex: number, newRole: SampleRole) {
    const currentTemplates = this.criteria.roleTemplates || {};
    const count = this.padCount;
    const currentList = currentTemplates[count] 
      ? [...currentTemplates[count]!] 
      : [...FACTORY_ROLE_TEMPLATES[count]];

    currentList[slotIndex] = newRole;

    this.updateCriteria({
      roleTemplates: {
        ...currentTemplates,
        [count]: currentList
      }
    });
  }

  private updateRoleProfile(role: SampleRole, changes: Partial<RoleAcousticTarget>) {
    const currentProfiles = this.criteria.roleProfiles || {};
    const target = currentProfiles[role] || {};
    this.updateCriteria({
      roleProfiles: {
        ...currentProfiles,
        [role]: {
          ...target,
          ...changes
        }
      }
    });
  }

  private updateCriteria(changes: Partial<AcousticCriteria>) {
    const updated = {
      ...this.criteria,
      ...changes
    };
    this.dispatchEvent(new CustomEvent('update-criteria', {
      detail: { criteria: updated },
      bubbles: true,
      composed: true
    }));
  }

  private applyAndReroll() {
    this.dispatchEvent(new CustomEvent('apply-criteria', {
      bubbles: true,
      composed: true
    }));
  }

  private resetToDefaults() {
    this.dispatchEvent(new CustomEvent('reset-criteria', {
      bubbles: true,
      composed: true
    }));
  }

  private closeDrawer() {
    this.dispatchEvent(new CustomEvent('close-drawer', {
      bubbles: true,
      composed: true
    }));
  }

  private submitSavePreset() {
    if (!this.newPresetName.trim()) return;
    this.dispatchEvent(new CustomEvent('save-custom-preset', {
      detail: {
        name: this.newPresetName.trim(),
        icon: this.newPresetIcon || '✨',
        criteria: { ...this.criteria }
      },
      bubbles: true,
      composed: true
    }));
    this.isSavingPreset = false;
    this.newPresetName = '';
  }

  render() {
    if (!this.isOpen) return html``;

    const crit = this.criteria;
    const currentTemplate = crit.roleTemplates?.[this.padCount] || FACTORY_ROLE_TEMPLATES[this.padCount];
    const activePreset = this.presets.find(p => p.id === this.activePresetId) || this.presets[0];
    const currentRoleProfile = crit.roleProfiles?.[this.activeRoleTab] || {};

    return html`
      <div class="drawer-container">
        <!-- Header -->
        <div class="drawer-header">
          <div class="title-area">
            <h3>⚙️ Kit Selection & Role Criteria Engine</h3>
            <span class="preset-badge">${activePreset?.icon || '✨'} ${activePreset?.name || 'Custom'}</span>
          </div>
          <button class="btn-close" @click=${this.closeDrawer} title="Close Criteria Drawer">✕</button>
        </div>

        <!-- Presets Selection Bar -->
        <div class="presets-row">
          ${this.presets.map(preset => html`
            <button
              class="preset-pill ${preset.id === this.activePresetId ? 'active' : ''}"
              @click=${() => this.selectPreset(preset)}
              title="${preset.description}"
            >
              <span>${preset.icon}</span>
              <span>${preset.name}</span>
              ${!preset.isFactory ? html`
                <button
                  class="btn-delete-custom"
                  @click=${(e: Event) => this.deleteCustomPreset(e, preset.id)}
                  title="Delete custom preset"
                >✕</button>
              ` : ''}
            </button>
          `)}

          ${!this.isSavingPreset ? html`
            <button class="btn-save-preset" @click=${() => this.isSavingPreset = true}>
              ＋ Save As Preset
            </button>
          ` : html`
            <div class="save-form-inline">
              <input
                type="text"
                class="icon-input"
                .value=${this.newPresetIcon}
                @input=${(e: Event) => this.newPresetIcon = (e.target as HTMLInputElement).value}
                placeholder="Icon"
                maxlength="2"
              />
              <input
                type="text"
                class="save-input"
                .value=${this.newPresetName}
                @input=${(e: Event) => this.newPresetName = (e.target as HTMLInputElement).value}
                placeholder="New Preset Name..."
                @keydown=${(e: KeyboardEvent) => e.key === 'Enter' && this.submitSavePreset()}
              />
              <button class="btn-apply" style="padding: 4px 10px; font-size: 11px;" @click=${this.submitSavePreset}>Save</button>
              <button class="btn-ghost" style="padding: 4px 8px; font-size: 11px;" @click=${() => this.isSavingPreset = false}>Cancel</button>
            </div>
          `}
        </div>

        <div class="section-title">🎛️ Kit Macro Controls</div>

        <!-- Macro Grid -->
        <div class="settings-grid">
          <!-- Macro 1: Punch -->
          <div class="setting-card">
            <div class="setting-label">
              <span>⚡ Attack Punchiness</span>
              <span>${crit.macroPunch ?? 50}%</span>
            </div>
            <div class="range-group">
              <input
                type="range"
                class="slider"
                min="0"
                max="100"
                .value=${String(crit.macroPunch ?? 50)}
                @input=${this.handleMacroPunch}
              />
              <div class="range-label-row">
                <span>Soft / Mellow</span>
                <span>Balanced</span>
                <span>Ultra-Snappy</span>
              </div>
            </div>
          </div>

          <!-- Macro 2: Length -->
          <div class="setting-card">
            <div class="setting-label">
              <span>⏱️ Sample Decay & Length</span>
              <span>${crit.macroLength ?? 50}%</span>
            </div>
            <div class="range-group">
              <input
                type="range"
                class="slider"
                min="0"
                max="100"
                .value=${String(crit.macroLength ?? 50)}
                @input=${this.handleMacroLength}
              />
              <div class="range-label-row">
                <span>Tight One-Shots</span>
                <span>Standard</span>
                <span>Sustained Chops</span>
              </div>
            </div>
          </div>

          <!-- Macro 3: Tone -->
          <div class="setting-card">
            <div class="setting-label">
              <span>🎨 Frequency Tone Bias</span>
            </div>
            <div class="options-row">
              <button
                class="option-btn ${(!crit.macroTone || crit.macroTone === 'neutral') ? 'active' : ''}"
                @click=${() => this.handleMacroTone('neutral')}
              >Natural / Mix</button>
              <button
                class="option-btn ${crit.macroTone === 'warm' ? 'active' : ''}"
                @click=${() => this.handleMacroTone('warm')}
              >🔊 Warm / Subby</button>
              <button
                class="option-btn ${crit.macroTone === 'bright' ? 'active' : ''}"
                @click=${() => this.handleMacroTone('bright')}
              >✨ Bright / Air</button>
            </div>
          </div>

          <!-- Macro 4: Genre Affinity -->
          <div class="setting-card">
            <div class="setting-label">
              <span>🏷️ Genre Keyword Affinity</span>
              <span>${crit.genreAffinityStrength ?? 70}%</span>
            </div>
            <div class="range-group">
              <input
                type="range"
                class="slider"
                min="0"
                max="100"
                .value=${String(crit.genreAffinityStrength ?? 70)}
                @input=${this.handleGenreAffinity}
              />
              <div class="range-label-row">
                <span>Acoustic Only</span>
                <span>Balanced</span>
                <span>Strict Genre Match</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Cohesion & Sources Bar -->
        <div class="settings-grid">
          <!-- Smart Cohesion Switches -->
          <div class="setting-card">
            <span class="setting-label">🧩 Smart Kit Cohesion & Anti-Masking</span>
            <div style="display: flex; flex-direction: column; gap: 8px; margin-top: 4px;">
              <label class="toggle-row">
                <input
                  type="checkbox"
                  .checked=${crit.antiMaskingEnabled !== false}
                  @change=${this.handleToggleAntiMasking}
                />
                <span>🛡️ Sub-Bass Anti-Masking (prevents muddy kick & bass conflict)</span>
              </label>
              <label class="toggle-row">
                <input
                  type="checkbox"
                  .checked=${crit.packAffinityEnabled !== false}
                  @change=${this.handleTogglePackAffinity}
                />
                <span>🔗 Pack Timbre Affinity (unifies samples from same folder)</span>
              </label>
            </div>
          </div>

          <!-- Folder Source Checklist -->
          <div class="setting-card">
            <span class="setting-label">📁 Folder Sources</span>
            ${this.folders.length === 0 ? html`
              <span style="font-size: 11px; color: #8f9cae;">No local folders imported. Pulling from Factory Demo sounds.</span>
            ` : html`
              <div class="folders-checklist">
                <label class="folder-check-item">
                  <input
                    type="checkbox"
                    .checked=${!crit.folderIds || crit.folderIds.length === 0}
                    @change=${() => this.updateCriteria({ folderIds: [] })}
                  />
                  <span>All Connected Folders</span>
                </label>
                ${this.folders.map(f => html`
                  <label class="folder-check-item">
                    <input
                      type="checkbox"
                      .checked=${(crit.folderIds || []).includes(f.id)}
                      @change=${() => this.toggleFolder(f.id)}
                    />
                    <span>${f.name} (${f.analyzedFiles} sounds)</span>
                  </label>
                `)}
              </div>
            `}
          </div>

          <!-- Harmonic Key Lock -->
          <div class="setting-card">
            <span class="setting-label">🎹 Harmonic Compatibility</span>
            <div class="options-row" style="align-items: center;">
              <button
                class="option-btn ${(!crit.keyLockMode || crit.keyLockMode === 'auto') ? 'active' : ''}"
                @click=${() => this.handleKeyLockMode('auto')}
              >✨ Auto Camelot</button>
              <button
                class="option-btn ${crit.keyLockMode === 'any' ? 'active' : ''}"
                @click=${() => this.handleKeyLockMode('any')}
              >Any / Free</button>
              <button
                class="option-btn ${crit.keyLockMode === 'strict' ? 'active' : ''}"
                @click=${() => this.handleKeyLockMode('strict')}
              >🔒 Lock Key</button>

              ${crit.keyLockMode === 'strict' ? html`
                <select
                  class="role-select"
                  style="width: 80px;"
                  .value=${crit.lockedCamelotKey || '8A'}
                  @change=${(e: Event) => this.handleCamelotKey((e.target as HTMLSelectElement).value)}
                >
                  ${CAMELOT_KEYS.map(k => html`
                    <option value="${k}" ?selected=${(crit.lockedCamelotKey || '8A') === k}>${k}</option>
                  `)}
                </select>
              ` : ''}
            </div>
          </div>
        </div>

        <!-- Pad Slot Role Mapping Grid -->
        <div class="slot-layout-container">
          <span class="setting-label">🥁 Pad Slot Role Mapping (${this.padCount} Pads)</span>
          <div class="slot-chips-grid">
            ${Array.from({ length: this.padCount }, (_, i) => {
              const currentRole = currentTemplate[i] || 'Texture/Wildcard';
              return html`
                <div class="slot-chip">
                  <div class="slot-chip-header">
                    <span>PAD ${i + 1}</span>
                  </div>
                  <select
                    class="role-select"
                    .value=${currentRole}
                    @change=${(e: Event) => this.handleSlotRoleChange(i, (e.target as HTMLSelectElement).value as SampleRole)}
                  >
                    ${ROLES.map(r => html`
                      <option value="${r}" ?selected=${r === currentRole}>${r}</option>
                    `)}
                  </select>
                </div>
              `;
            })}
          </div>
        </div>

        <!-- Advanced Role Targets Accordion Toggle -->
        <button
          class="advanced-toggle-btn"
          @click=${() => this.showAdvancedRoles = !this.showAdvancedRoles}
        >
          <span>🔧 Advanced Role-Specific Acoustic Targets (${this.activeRoleTab})</span>
          <span>${this.showAdvancedRoles ? '▲ Hide' : '▼ Expand'}</span>
        </button>

        <!-- Advanced Role Targets Editor -->
        ${this.showAdvancedRoles ? html`
          <div class="advanced-role-panel">
            <div class="role-tabs-bar">
              ${ROLES.map(role => html`
                <button
                  class="role-tab-btn ${this.activeRoleTab === role ? 'active' : ''}"
                  @click=${() => this.activeRoleTab = role}
                >
                  ${role}
                </button>
              `)}
            </div>

            <div class="settings-grid">
              <!-- Min / Max Duration for this Role -->
              <div class="setting-card">
                <span class="setting-label">Role Duration Window</span>
                <div class="range-group">
                  <div class="range-label-row">
                    <span>Min: ${(currentRoleProfile.durationMin ?? 0.05).toFixed(2)}s</span>
                    <span>Max: ${(currentRoleProfile.durationMax ?? 3.0).toFixed(2)}s</span>
                  </div>
                  <input
                    type="range"
                    class="slider"
                    min="0.02"
                    max="4.0"
                    step="0.05"
                    .value=${String(currentRoleProfile.durationMax ?? 3.0)}
                    @input=${(e: Event) => {
                      const val = parseFloat((e.target as HTMLInputElement).value);
                      this.updateRoleProfile(this.activeRoleTab, { durationMax: val });
                    }}
                  />
                </div>
              </div>

              <!-- Min Sharpness for this Role -->
              <div class="setting-card">
                <span class="setting-label">Min Transient Sharpness</span>
                <div class="range-group">
                  <div class="range-label-row">
                    <span>Cutoff:</span>
                    <span>${currentRoleProfile.minSharpness ?? 50}%</span>
                  </div>
                  <input
                    type="range"
                    class="slider"
                    min="20"
                    max="95"
                    .value=${String(currentRoleProfile.minSharpness ?? 50)}
                    @input=${(e: Event) => {
                      const val = parseInt((e.target as HTMLInputElement).value, 10);
                      this.updateRoleProfile(this.activeRoleTab, { minSharpness: val });
                    }}
                  />
                </div>
              </div>

              <!-- Semantic Keywords for this Role -->
              <div class="setting-card" style="grid-column: 1 / -1;">
                <span class="setting-label">Active Keyword Dictionaries for ${this.activeRoleTab}</span>
                <div class="keywords-tag-container">
                  ${(currentRoleProfile.keywords || []).map(kw => html`
                    <span class="kw-tag">＋ ${kw}</span>
                  `)}
                  ${(currentRoleProfile.negativeKeywords || []).map(nkw => html`
                    <span class="kw-tag negative">－ ${nkw}</span>
                  `)}
                  ${(!currentRoleProfile.keywords?.length && !currentRoleProfile.negativeKeywords?.length) ? html`
                    <span style="font-size: 11px; color: #8f9cae;">No role-specific keyword filters. Uses global preset tags.</span>
                  ` : ''}
                </div>
              </div>
            </div>
          </div>
        ` : ''}

        <!-- Footer -->
        <div class="drawer-footer">
          <div class="footer-left">
            <button class="btn-ghost" @click=${this.resetToDefaults}>↺ Reset to Preset</button>
          </div>
          <div style="display: flex; gap: 8px;">
            <button class="btn-ghost" @click=${this.closeDrawer}>Done</button>
            <button class="btn-apply" @click=${this.applyAndReroll}>⚡ Apply & Reroll Kit</button>
          </div>
        </div>
      </div>
    `;
  }
}
