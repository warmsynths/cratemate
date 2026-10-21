import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type { FolderSource, PadSlot, SampleRole } from '../types/index.ts';
import { padDisplayNumber } from '../services/layouts.ts';

export type LcdScreen = 'MAIN' | 'INFO' | 'SOURCES';

const ROLE_SHORT_NAMES: Record<SampleRole, string> = {
  'Kick/Low': 'KICK',
  'Snare/Snap': 'SNARE',
  'Hat/Air': 'HAT',
  'Tonal/Melodic': 'TONAL',
  'Texture/Wildcard': 'WILD'
};

const ALL_ROLES: SampleRole[] = [
  'Kick/Low',
  'Snare/Snap',
  'Hat/Air',
  'Tonal/Melodic',
  'Texture/Wildcard'
];

@customElement('mpc-lcd')
export class MpcLcd extends LitElement {
  @property({ type: String }) screen: LcdScreen = 'MAIN';
  @property({ type: String }) presetName = 'STANDARD';
  @property({ type: String }) serial = '001';
  @property({ type: Number }) padCount = 8;
  @property({ type: Number }) keptCount = 0;
  @property({ type: Number }) poolSize = 0;
  @property({ type: Object }) activeSlot?: PadSlot;
  @property({ type: Number }) activePadIndex: number | null = null;
  @property({ type: Boolean }) isPlaying = false;
  @property({ type: Boolean }) isGenerating = false;
  @property({ type: Array }) folders: FolderSource[] = [];
  @property({ type: Number }) folderCursor = 0;
  @property({ type: Object }) roleMix: Partial<Record<SampleRole, number>> = {};
  @property({ type: Boolean }) spNumbered = false;
  @property({ type: Boolean }) stickers = false;

  @state() private mixCursor = 0;
  @state() private busyStep = 0;
  private busyInterval = 0;

  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      flex: 0 0 auto;
      width: 100%;
      user-select: none;
    }

    .lcd-bezel {
      position: relative;
      background: linear-gradient(#3a4049, #272c33);
      border: 1px solid #1b1f24;
      border-radius: 6px 6px 3px 3px;
      padding: 9px 9px 7px;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.28);
    }

    .tape-sticker-lcd {
      position: absolute;
      left: 50%;
      top: -12px;
      z-index: 6;
      transform: translateX(-50%) rotate(-2deg);
      pointer-events: none;
      background: #e6d9ae;
      padding: 3px 16px 2px;
      clip-path: polygon(0 8%, 4% 0, 9% 10%, 15% 2%, 100% 0, 97% 30%, 100% 55%, 96% 100%, 10% 94%, 4% 100%, 0 70%, 3% 40%);
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
      font-family: 'Permanent Marker', cursive;
      font-size: 13px;
      color: #2a2a2a;
      white-space: nowrap;
    }

    .lcd-screen {
      background: #8f9e6a;
      border: 1px solid #1e2417;
      border-radius: 2px;
      padding: clamp(6px, 1.1vh, 11px) 13px clamp(5px, 0.9vh, 9px);
      box-sizing: border-box;
      display: flex;
      flex-direction: column;
      gap: clamp(4px, 0.8vh, 8px);
      box-shadow: inset 0 2px 7px rgba(24, 32, 16, 0.42);
      font-family: 'DM Mono', monospace;
      color: #1e2417;
    }

    .lcd-top-bar {
      display: flex;
      align-items: baseline;
      gap: 10px;
      border-bottom: 1px solid rgba(30, 36, 23, 0.35);
      padding-bottom: 6px;
      font-size: 11px;
      letter-spacing: 0.4px;
    }

    .busy-indicator {
      margin-left: auto;
      display: flex;
      align-items: center;
      gap: 5px;
      font-size: 11px;
      letter-spacing: 0.4px;
      animation: busyBlink 520ms steps(1) infinite;
    }

    .busy-dot {
      width: 7px;
      height: 7px;
      background: #1e2417;
      display: block;
    }

    @keyframes busyBlink {
      0%, 49% { opacity: 1; }
      50%, 100% { opacity: 0.15; }
    }

    .lcd-serial {
      margin-left: auto;
    }

    .lcd-body {
      flex: 0 0 auto;
      min-height: clamp(82px, 13vh, 104px);
      overflow: hidden;
      scrollbar-width: none;
      -ms-overflow-style: none;
      display: flex;
      flex-direction: column;
    }

    .lcd-body::-webkit-scrollbar {
      display: none;
      width: 0;
      height: 0;
    }

    /* BUSY / BUILDING KIT SCREEN */
    .busy-container {
      height: 100%;
      display: flex;
      flex-direction: column;
      justify-content: center;
      gap: 7px;
      font-size: 11px;
      letter-spacing: 0.4px;
    }

    .busy-meter {
      display: flex;
      gap: 2px;
      height: 12px;
      padding: 2px;
      border: 1px solid #1e2417;
      box-sizing: border-box;
    }

    .meter-block {
      flex: 1 1 0;
      background: #1e2417;
      display: block;
      transition: opacity 100ms;
    }

    /* MAIN / MIX SCREEN */
    .mix-container {
      display: flex;
      flex-direction: column;
      gap: 1px;
      font-size: 11px;
      line-height: 1.15;
    }

    .mix-header-row {
      display: flex;
      gap: 8px;
      letter-spacing: 0.4px;
      padding-bottom: 2px;
    }

    .mix-row {
      display: flex;
      gap: 8px;
      cursor: pointer;
      padding: 1px 3px;
    }

    .mix-row.cursor {
      background: rgba(30, 36, 23, 0.16);
    }

    .mix-role-label {
      flex: 0 0 auto;
      width: 80px;
      white-space: pre;
    }

    .mix-role-count {
      flex: 0 0 auto;
      width: 18px;
    }

    .mix-role-bar {
      flex: 1 1 auto;
      min-width: 0;
      overflow: hidden;
      white-space: nowrap;
      letter-spacing: 1px;
    }

    /* INFO SCREEN */
    .info-container {
      display: flex;
      flex-direction: column;
      gap: 5px;
      font-size: 11px;
      line-height: 1.2;
    }

    .info-header-row {
      display: flex;
      gap: 8px;
      align-items: baseline;
      letter-spacing: 0.4px;
    }

    .info-pad-id {
      flex: 0 0 auto;
      font-weight: 600;
    }

    .info-filename {
      flex: 1 1 auto;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      text-transform: uppercase;
    }

    .waveform-strip {
      position: relative;
      height: 44px;
      border-top: 1px solid rgba(30, 36, 23, 0.28);
      border-bottom: 1px solid rgba(30, 36, 23, 0.28);
      background: rgba(30, 36, 23, 0.07);
      margin: 1px 0;
      overflow: hidden;
    }

    .center-line {
      position: absolute;
      left: 0;
      right: 0;
      top: 50%;
      height: 1px;
      background: rgba(30, 36, 23, 0.22);
      display: block;
    }

    .envelope-bars-wrap {
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      gap: 1px;
      padding: 2px 1px;
      box-sizing: border-box;
    }

    .env-bar {
      flex: 1 1 auto;
      min-width: 0;
      background: #1e2417;
      display: block;
    }

    .playhead-sweep {
      position: absolute;
      top: 0;
      bottom: 0;
      width: 2px;
      margin-left: -1px;
      background: #e8f0cf;
      box-shadow: 0 0 6px rgba(232, 240, 207, 0.95);
      pointer-events: none;
    }

    .sweep-anim {
      animation: sweepAcross 400ms linear both;
    }

    @keyframes sweepAcross {
      from { left: 0%; }
      to { left: 100%; }
    }

    .info-footer-row {
      display: flex;
      gap: 11px;
      letter-spacing: 0.3px;
      align-items: baseline;
      font-size: 11px;
    }

    /* SOURCES SCREEN */
    .sources-list {
      display: flex;
      flex-direction: column;
      gap: 2px;
      font-size: 11px;
      line-height: 1.15;
    }

    .sources-header {
      display: flex;
      letter-spacing: 0.4px;
      padding-bottom: 2px;
    }

    .source-item {
      display: flex;
      gap: 8px;
      cursor: pointer;
      padding: 1px 3px;
    }

    .source-item.cursor {
      background: rgba(30, 36, 23, 0.16);
    }

    .source-name {
      flex: 1 1 auto;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    /* SOFT KEY LABELS ON LCD */
    .soft-key-labels {
      display: flex;
      gap: 4px;
      margin-top: 2px;
    }

    .soft-label-pill {
      flex: 1;
      font-size: 9px;
      text-align: center;
      padding: 3px 0;
      border: 1px solid rgba(30, 36, 23, 0.5);
      background: rgba(30, 36, 23, 0.12);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    /* Physical Bone F-Key Buttons below bezel */
    .f-keys-row {
      display: flex;
      gap: 4px;
      padding: clamp(4px, 0.7vh, 7px) 1px 0;
    }

    .f-key-btn {
      flex: 1;
      font-family: 'Barlow Condensed', sans-serif;
      font-size: 9px;
      font-weight: 600;
      letter-spacing: 0.8px;
      padding: clamp(2px, 0.5vh, 5px) 0;
      border: 1px solid #6f6a55;
      border-radius: 2px;
      background: linear-gradient(#f0e9ca, #ddd3ad);
      color: #25261f;
      cursor: pointer;
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.65);
      outline: none;
    }

    .f-key-btn:hover {
      background: linear-gradient(#f8f3dd, #e6dcb8);
    }

    .f-key-btn:active {
      transform: translateY(1px);
    }
  `;

  connectedCallback() {
    super.connectedCallback();
    this.busyInterval = window.setInterval(() => {
      if (this.isGenerating) {
        this.busyStep = (this.busyStep + 1) % 24;
        this.requestUpdate();
      }
    }, 90);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    clearInterval(this.busyInterval);
  }

  private handleFKey(num: number) {
    if (this.isGenerating) return;

    if (this.screen === 'MAIN') {
      if (num === 1) this.stepMixCursor(-1);
      else if (num === 2) this.stepMixCursor(1);
      else if (num === 3) this.adjustRoleCount(-1);
      else if (num === 4) this.adjustRoleCount(1);
      else if (num === 5) this.resetRoleMix();
      else if (num === 6) this.dispatchEvent(new CustomEvent('generate-kit', { bubbles: true, composed: true }));
    } else if (this.screen === 'SOURCES') {
      if (num === 1) this.stepFolderCursor(-1);
      else if (num === 2) this.stepFolderCursor(1);
      else if (num === 3) this.toggleCurrentFolder();
      else if (num === 4) this.dispatchEvent(new CustomEvent('add-folder', { bubbles: true, composed: true }));
      else if (num === 5) this.deleteCurrentFolder();
      else if (num === 6) this.screen = 'MAIN';
    } else if (this.screen === 'INFO') {
      if (num === 1 && this.activePadIndex !== null) {
        this.dispatchEvent(new CustomEvent('reroll-single-pad', { detail: { padIndex: this.activePadIndex }, bubbles: true, composed: true }));
      } else if (num === 2 && this.activePadIndex !== null) {
        this.swapPadRole();
      } else if (num === 3 && this.activePadIndex !== null) {
        this.togglePadLock();
      } else if (num === 4) {
        this.screen = 'SOURCES';
      } else if (num === 5) {
        this.dispatchEvent(new CustomEvent('open-setup-disk', { bubbles: true, composed: true }));
      } else if (num === 6) {
        this.screen = 'MAIN';
      }
    }
  }

  private stepMixCursor(dir: number) {
    this.mixCursor = (this.mixCursor + dir + ALL_ROLES.length) % ALL_ROLES.length;
    this.requestUpdate();
  }

  private adjustRoleCount(delta: number) {
    const role = ALL_ROLES[this.mixCursor];
    const currentCounts = this.getEffectiveRoleCounts();
    const current = currentCounts[role] || 0;
    const next = Math.max(0, Math.min(this.padCount, current + delta));
    if (next !== current) {
      const updated = { ...currentCounts, [role]: next };
      this.dispatchEvent(new CustomEvent('role-mix-change', {
        detail: { roleMix: updated },
        bubbles: true,
        composed: true
      }));
    }
  }

  private resetRoleMix() {
    this.dispatchEvent(new CustomEvent('role-mix-change', {
      detail: { roleMix: undefined },
      bubbles: true,
      composed: true
    }));
  }

  private stepFolderCursor(dir: number) {
    if (this.folders.length === 0) return;
    this.folderCursor = (this.folderCursor + dir + this.folders.length) % this.folders.length;
    this.dispatchEvent(new CustomEvent('folder-cursor-change', {
      detail: { cursor: this.folderCursor },
      bubbles: true,
      composed: true
    }));
  }

  private toggleCurrentFolder() {
    const f = this.folders[this.folderCursor];
    if (!f) return;
    this.dispatchEvent(new CustomEvent('folder-toggle', {
      detail: { folderId: f.id },
      bubbles: true,
      composed: true
    }));
  }

  private deleteCurrentFolder() {
    const f = this.folders[this.folderCursor];
    if (!f) return;
    this.dispatchEvent(new CustomEvent('folder-delete', {
      detail: { folderId: f.id },
      bubbles: true,
      composed: true
    }));
  }

  private swapPadRole() {
    if (this.activePadIndex === null || !this.activeSlot) return;
    const currentRole = this.activeSlot.role;
    const idx = ALL_ROLES.indexOf(currentRole);
    const nextRole = ALL_ROLES[(idx + 1) % ALL_ROLES.length];
    this.dispatchEvent(new CustomEvent('swap-pad-role', {
      detail: { padIndex: this.activePadIndex, newRole: nextRole },
      bubbles: true,
      composed: true
    }));
  }

  private togglePadLock() {
    if (this.activePadIndex === null || !this.activeSlot) return;
    this.dispatchEvent(new CustomEvent('pad-lock', {
      detail: { padIndex: this.activePadIndex, locked: !this.activeSlot.locked },
      bubbles: true,
      composed: true
    }));
  }

  private getEffectiveRoleCounts(): Record<SampleRole, number> {
    const counts: Record<SampleRole, number> = {
      'Kick/Low': 0,
      'Snare/Snap': 0,
      'Hat/Air': 0,
      'Tonal/Melodic': 0,
      'Texture/Wildcard': 0
    };

    if (this.roleMix && Object.keys(this.roleMix).length > 0) {
      for (const r of ALL_ROLES) {
        counts[r] = this.roleMix[r] || 0;
      }
      return counts;
    }

    // Default distribution based on pad count
    if (this.padCount === 4) {
      counts['Kick/Low'] = 1;
      counts['Snare/Snap'] = 1;
      counts['Hat/Air'] = 1;
      counts['Tonal/Melodic'] = 1;
    } else if (this.padCount === 6) {
      counts['Kick/Low'] = 2;
      counts['Snare/Snap'] = 1;
      counts['Hat/Air'] = 2;
      counts['Tonal/Melodic'] = 1;
    } else if (this.padCount === 8) {
      counts['Kick/Low'] = 2;
      counts['Snare/Snap'] = 2;
      counts['Hat/Air'] = 2;
      counts['Tonal/Melodic'] = 1;
      counts['Texture/Wildcard'] = 1;
    } else {
      counts['Kick/Low'] = 4;
      counts['Snare/Snap'] = 4;
      counts['Hat/Air'] = 4;
      counts['Tonal/Melodic'] = 2;
      counts['Texture/Wildcard'] = 2;
    }

    return counts;
  }

  render() {
    const slug = this.presetName.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10);

    const softKeys = this.screen === 'INFO' ? [
      { label: 'RESPIN', n: 1 },
      { label: 'ROLE', n: 2 },
      { label: 'KEEP', n: 3 },
      { label: 'SRCE', n: 4 },
      { label: 'SAVE', n: 5 },
      { label: 'MAIN', n: 6 }
    ] : this.screen === 'SOURCES' ? [
      { label: 'UP', n: 1 },
      { label: 'DOWN', n: 2 },
      { label: 'ON/OFF', n: 3 },
      { label: 'ADD', n: 4 },
      { label: 'DEL', n: 5 },
      { label: 'MAIN', n: 6 }
    ] : [
      { label: 'UP', n: 1 },
      { label: 'DOWN', n: 2 },
      { label: '−', n: 3 },
      { label: '+', n: 4 },
      { label: 'AUTO', n: 5 },
      { label: 'ROLL', n: 6 }
    ];

    return html`
      <div class="lcd-bezel">
        ${this.stickers ? html`
          <span class="tape-sticker-lcd">DON'T TOUCH — KIT LOADED</span>
        ` : ''}

        <div class="lcd-screen">
          <div class="lcd-top-bar">
            <span>PROGRAM:${slug || 'STANDARD'}</span>
            ${this.isGenerating ? html`
              <span class="busy-indicator"><span class="busy-dot"></span>BUSY</span>
            ` : html`
              <span class="lcd-serial">KIT${this.serial}</span>
            `}
          </div>

          <div class="lcd-body">
            ${this.isGenerating ? this.renderBusyScreen() :
              this.screen === 'INFO' ? this.renderInfoScreen() :
              this.screen === 'SOURCES' ? this.renderSourcesScreen() :
              this.renderMixScreen()}
          </div>

          <div class="soft-key-labels">
            ${softKeys.map(k => html`
              <span class="soft-label-pill">${k.label}</span>
            `)}
          </div>
        </div>

        <div class="f-keys-row">
          ${softKeys.map(k => html`
            <button class="f-key-btn" @click=${() => this.handleFKey(k.n)}>F${k.n}</button>
          `)}
        </div>
      </div>
    `;
  }

  private renderBusyScreen() {
    const dots = '.'.repeat((this.busyStep % 3) + 1);
    const stepCount = String(Math.min(this.busyStep + 1, this.padCount)).padStart(2, '0');
    const totalCount = String(this.padCount).padStart(2, '0');

    return html`
      <div class="busy-container">
        <div style="display: flex; justify-content: space-between;">
          <span>BUILDING KIT${dots}</span>
          <span>${stepCount}/${totalCount}</span>
        </div>
        <div class="busy-meter">
          ${Array.from({ length: 24 }, (_, i) => html`
            <span class="meter-block" style="opacity: ${i <= (this.busyStep % 24) ? 1 : 0.12};"></span>
          `)}
        </div>
        <div style="display: flex; justify-content: space-between; font-size: 10px;">
          <span>PAD ${stepCount} ROLE</span>
          <span>PADS LOCKED: ${this.keptCount}</span>
        </div>
      </div>
    `;
  }

  private renderMixScreen() {
    const counts = this.getEffectiveRoleCounts();

    return html`
      <div class="mix-container">
        <div class="mix-header-row">
          <span style="flex: 1 1 auto;">MIX · ${this.padCount} PADS</span>
          <span style="flex: 0 0 auto;">${this.keptCount} KEPT</span>
        </div>
        ${ALL_ROLES.map((role, idx) => {
          const isSelected = idx === this.mixCursor;
          const count = counts[role] || 0;
          const barLen = Math.round((count / this.padCount) * 12);
          const barStr = '█'.repeat(barLen) + '░'.repeat(Math.max(0, 12 - barLen));
          return html`
            <div 
              class="mix-row ${isSelected ? 'cursor' : ''}"
              @click=${() => { this.mixCursor = idx; }}
            >
              <span class="mix-role-label">${isSelected ? '▸ ' : '  '}${ROLE_SHORT_NAMES[role]}</span>
              <span class="mix-role-count">${String(count).padStart(2, '0')}</span>
              <span class="mix-role-bar">${barStr}</span>
            </div>
          `;
        })}
      </div>
    `;
  }

  private renderInfoScreen() {
    const slot = this.activeSlot;
    if (!slot || !slot.sample) {
      return html`
        <div class="info-container" style="justify-content: center; align-items: center; height: 100%;">
          <span>PAD --</span>
          <span style="opacity: 0.7;">HIT A PAD TO INSPECT</span>
        </div>
      `;
    }

    const sample = slot.sample;
    const padStr = this.activePadIndex !== null ? `PAD ${padDisplayNumber(this.activePadIndex, this.spNumbered)}` : 'PAD';
    const profile = sample.acousticProfile;
    const durStr = profile?.duration ? `${profile.duration.toFixed(2)}s` : '—';
    const keyStr = profile?.rootKey ? `KEY ${profile.rootKey}` : profile?.camelotKey ? `KEY ${profile.camelotKey}` : 'KEY —';
    const hzStr = profile?.rootPitchHz ? `${Math.round(profile.rootPitchHz)}Hz` : 'PERC';
    const folderStr = sample.folderName || 'FACTORY';

    const bins = profile?.waveformBins || [];
    const bars = Array.from({ length: 48 }, (_, i) => {
      if (bins.length > 0) {
        const idx = Math.floor((i / 48) * bins.length);
        return Math.max(0.06, Math.min(1.0, bins[idx] || 0.1));
      }
      return 0.12;
    });

    return html`
      <div class="info-container">
        <div class="info-header-row">
          <span class="info-pad-id">${padStr}</span>
          <span class="info-filename">${sample.fileName}</span>
          <span style="margin-left: auto; letter-spacing: 1px; font-weight: 600;">${slot.locked ? 'KEPT' : ''}</span>
        </div>

        <div class="waveform-strip">
          <span class="center-line"></span>
          <div class="envelope-bars-wrap">
            ${bars.map(h => html`<span class="env-bar" style="height: ${Math.round(h * 100)}%;"></span>`)}
          </div>
          ${this.isPlaying ? html`<div class="playhead-sweep sweep-anim"></div>` : ''}
        </div>

        <div class="info-footer-row">
          <span>${keyStr}</span>
          <span>${durStr}</span>
          <span>${hzStr}</span>
          <span class="info-src-name" style="margin-left: auto;">${folderStr}</span>
        </div>
      </div>
    `;
  }

  private renderSourcesScreen() {
    const activeCount = this.folders.filter(f => f.permissionGranted).length;

    return html`
      <div class="sources-list">
        <div class="sources-header">
          <span style="flex: 1 1 auto;">SOURCES ${activeCount}/${this.folders.length}</span>
          <span>F4 ADD</span>
        </div>
        ${this.folders.length === 0 ? html`
          <div style="padding: 10px 0; text-align: center; opacity: 0.7;">NO FOLDERS REGISTERED</div>
        ` : this.folders.map((f, idx) => {
          const isCursor = idx === this.folderCursor;
          const status = f.permissionGranted ? 'ON ' : 'OFF';
          const count = f.totalFiles ? String(f.totalFiles).padStart(5, ' ') : ' SCAN';
          return html`
            <div 
              class="source-item ${isCursor ? 'cursor' : ''}"
              @click=${() => { this.folderCursor = idx; }}
            >
              <span class="source-name">${isCursor ? '▸ ' : '  '}${f.name}</span>
              <span style="white-space: pre;">${count}</span>
              <span style="white-space: pre; margin-left: 8px;">${status}</span>
            </div>
          `;
        })}
      </div>
    `;
  }
}
