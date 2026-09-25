import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import type { FolderSource, PadSlot } from '../types/index.ts';

export type LcdScreen = 'MAIN' | 'INFO' | 'SOURCES';

@customElement('mpc-lcd')
export class MpcLcd extends LitElement {
  @property({ type: String }) screen: LcdScreen = 'MAIN';
  @property({ type: String }) presetName = 'STANDARD';
  @property({ type: String }) serial = '001';
  @property({ type: Number }) padCount = 8;
  @property({ type: Number }) keptCount = 0;
  @property({ type: Number }) poolSize = 0;
  @property({ type: String }) lastHitName = '—';
  @property({ type: Object }) activeSlot?: PadSlot;
  @property({ type: Boolean }) isPlaying = false;
  @property({ type: Array }) folders: FolderSource[] = [];
  @property({ type: Number }) folderCursor = 0;

  static styles = css`
    :host {
      display: block;
      width: 100%;
    }

    .lcd-bezel {
      background: linear-gradient(#3a4049, #272c33);
      border: 1px solid #1b1f24;
      border-radius: 6px 6px 3px 3px;
      padding: 5px 6px 4px;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.28);
    }

    .lcd-screen {
      background: #8f9e6a;
      border: 1px solid #1e2417;
      border-radius: 2px;
      padding: clamp(6px, 1vh, 8px) 10px clamp(4px, 0.8vh, 6px);
      min-height: clamp(140px, 18vh, 160px);
      box-sizing: border-box;
      display: flex;
      flex-direction: column;
      gap: clamp(3px, 0.5vh, 5px);
      box-shadow: inset 0 2px 7px rgba(24, 32, 16, 0.42);
      font-family: 'DM Mono', monospace;
      color: #1e2417;
    }

    .lcd-top-bar {
      display: flex;
      align-items: baseline;
      gap: 10px;
      border-bottom: 1px solid rgba(30, 36, 23, 0.35);
      padding-bottom: 3px;
      font-size: 10px;
      letter-spacing: 0.4px;
    }

    .lcd-serial {
      margin-left: auto;
    }

    .lcd-body {
      flex: 1 1 auto;
      height: clamp(70px, 10vh, 90px);
      overflow-y: auto;
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

    /* MAIN SCREEN */
    .main-grid {
      display: flex;
      flex-direction: column;
      gap: 2px;
      font-size: 11px;
      line-height: 1.25;
    }

    .main-row {
      display: flex;
    }

    .main-label {
      width: 78px;
    }

    .main-val {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    /* INFO / TRIM SCREEN */
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

    .info-kept-tag {
      flex: 0 0 auto;
      letter-spacing: 1px;
      font-weight: 600;
    }

    .waveform-strip {
      position: relative;
      height: 30px;
      border-top: 1px solid rgba(30, 36, 23, 0.28);
      border-bottom: 1px solid rgba(30, 36, 23, 0.28);
      background: rgba(30, 36, 23, 0.07);
      margin: 1px 0;
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
      padding: 3px 1px;
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

    .info-footer-row {
      display: flex;
      gap: 11px;
      letter-spacing: 0.3px;
      align-items: baseline;
      font-size: 10px;
    }

    .info-src-name {
      margin-left: auto;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    /* SOURCES SCREEN */
    .sources-list {
      display: flex;
      flex-direction: column;
      gap: 2px;
      font-size: 11px;
      line-height: 1.3;
    }

    .sources-header {
      display: flex;
      letter-spacing: 0.4px;
      padding-bottom: 2px;
      border-bottom: 1px solid rgba(30, 36, 23, 0.25);
    }

    .source-item {
      display: flex;
      gap: 8px;
      cursor: pointer;
      padding: 1px 3px;
      border-radius: 2px;
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

    /* EMPTY / PROMPT */
    .empty-prompt {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100%;
      text-align: center;
      gap: 8px;
    }

    .empty-title {
      font-size: 13px;
      font-weight: 700;
      letter-spacing: 1.2px;
    }

    .empty-subtitle {
      font-size: 10px;
      opacity: 0.85;
      letter-spacing: 0.6px;
    }

    /* SOFT KEY LABELS */
    .soft-key-labels {
      display: flex;
      gap: 4px;
      margin-top: auto;
    }

    .soft-label-pill {
      flex: 1;
      font-size: 9px;
      text-align: center;
      padding: 3px 0;
      border: 1px solid rgba(30, 36, 23, 0.5);
      background: rgba(30, 36, 23, 0.1);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .soft-label-pill.active {
      background: rgba(30, 36, 23, 0.35);
      font-weight: 700;
    }

    /* Physical Bone F-Key Buttons below bezel */
    .f-keys-row {
      display: flex;
      gap: 3px;
      padding: clamp(3px, 0.5vh, 5px) 1px 0;
    }

    .f-key-btn {
      flex: 1;
      font-family: 'Barlow Condensed', sans-serif;
      font-size: 8.5px;
      font-weight: 600;
      letter-spacing: 0.8px;
      padding: clamp(3px, 0.45vh, 4.5px) 0;
      border: 1px solid #6f6a55;
      border-radius: 2px;
      background: linear-gradient(#f0e9ca, #ddd3ad);
      color: #25261f;
      cursor: pointer;
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.65);
      transition: all 60ms ease-out;
      outline: none;
    }

    .f-key-btn:hover {
      background: linear-gradient(#f8f3dd, #e6dcb8);
    }

    .f-key-btn:active {
      transform: translateY(1px);
      box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.4);
    }
  `;

  private handleFKey(num: number) {
    this.dispatchEvent(new CustomEvent('fkey-press', {
      detail: { keyNum: num, screen: this.screen },
      bubbles: true,
      composed: true
    }));
  }

  render() {
    const slug = this.presetName.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10);
    const hasFolders = this.folders.length > 0;
    const hasSamples = this.poolSize > 0;

    const softKeys = this.screen === 'INFO' ? [
      { label: 'RESPIN', n: 1 },
      { label: 'ROLE', n: 2 },
      { label: 'KEEP', n: 3 },
      { label: 'SRCE', n: 4 },
      { label: 'DISK', n: 5 },
      { label: 'MAIN', n: 6 }
    ] : this.screen === 'SOURCES' ? [
      { label: 'UP', n: 1 },
      { label: 'DOWN', n: 2 },
      { label: 'AUTH', n: 3 },
      { label: 'ADD', n: 4 },
      { label: 'DISK', n: 5 },
      { label: 'MAIN', n: 6 }
    ] : [
      { label: 'ROLL', n: 1 },
      { label: 'KEEP', n: 2 },
      { label: 'INFO', n: 3 },
      { label: 'SRCE', n: 4 },
      { label: 'SETUP', n: 5 },
      { label: 'CRIT', n: 6 }
    ];

    return html`
      <div class="lcd-bezel">
        <div class="lcd-screen">
          <div class="lcd-top-bar">
            <span>PROGRAM:${slug || 'STANDARD'}</span>
            <span class="lcd-serial">KIT${this.serial}</span>
          </div>

          <div class="lcd-body">
            ${!hasFolders && !hasSamples ? html`
              <div class="empty-prompt">
                <div class="empty-title">INSERT DISK</div>
                <div class="empty-subtitle">CONNECT FOLDER TO LOAD SAMPLES</div>
                <div style="margin-top: 4px; font-size: 9px; opacity: 0.7;">PRESS F4 OR SETUP DISK</div>
              </div>
            ` : this.screen === 'INFO' ? this.renderInfoScreen() : this.screen === 'SOURCES' ? this.renderSourcesScreen() : this.renderMainScreen()}
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

  private renderMainScreen() {
    const padStr = String(this.padCount).padStart(2, '0');
    const keptStr = String(this.keptCount).padStart(2, '0');
    const poolStr = `${this.poolSize.toLocaleString()} smp`;

    return html`
      <div class="main-grid">
        <div class="main-row">
          <span class="main-label">Pads</span>
          <span class="main-val">${padStr}</span>
        </div>
        <div class="main-row">
          <span class="main-label">Kept</span>
          <span class="main-val">${keptStr}</span>
        </div>
        <div class="main-row">
          <span class="main-label">Pool</span>
          <span class="main-val">${poolStr}</span>
        </div>
        <div class="main-row">
          <span class="main-label">Last hit</span>
          <span class="main-val">${this.lastHitName}</span>
        </div>
      </div>
    `;
  }

  private renderInfoScreen() {
    const slot = this.activeSlot;
    const sample = slot?.sample;
    const profile = sample?.acousticProfile;
    const padNumberStr = slot ? `PAD ${String(slot.index + 1).padStart(2, '0')}` : 'PAD --';
    const filename = sample ? sample.fileName : 'HIT A PAD TO INSPECT';
    const keptText = slot?.locked ? 'KEPT' : '';

    // 48 waveform bins
    const bins = profile?.waveformBins || [];
    const barsCount = 48;
    const bars: { h: string; op: number }[] = [];
    for (let i = 0; i < barsCount; i++) {
      let val = 0.05;
      if (bins.length > 0) {
        const binIdx = Math.floor((i / barsCount) * bins.length);
        val = Math.max(0.04, Math.min(1.0, bins[binIdx] || 0.05));
      }
      bars.push({
        h: `${(val * 100).toFixed(1)}%`,
        op: Number((0.5 + val * 0.45).toFixed(2))
      });
    }

    const keyStr = profile?.camelotKey ? `KEY ${profile.camelotKey}` : profile?.rootKey ? `KEY ${profile.rootKey}` : 'KEY —';
    const durationStr = profile ? `${profile.duration.toFixed(2)}s` : '—';
    const toneStr = profile?.rootPitchHz ? `${Math.round(profile.rootPitchHz)}Hz` : '—';
    const srcStr = sample?.folderName || '—';

    return html`
      <div class="info-container">
        <div class="info-header-row">
          <span class="info-pad-id">${padNumberStr}</span>
          <span class="info-filename">${filename}</span>
          <span class="info-kept-tag">${keptText}</span>
        </div>

        <div class="waveform-strip">
          <span class="center-line"></span>
          <span class="envelope-bars-wrap">
            ${bars.map(b => html`
              <span class="env-bar" style="height: ${b.h}; opacity: ${b.op};"></span>
            `)}
          </span>
          ${this.isPlaying ? html`
            <span class="playhead-sweep" style="animation: sweepA ${Math.min(profile?.duration || 0.4, 1.8)}s linear both;"></span>
          ` : ''}
        </div>

        <div class="info-footer-row">
          <span>${keyStr}</span>
          <span>${durationStr}</span>
          <span>${toneStr}</span>
          <span class="info-src-name">${srcStr}</span>
        </div>
      </div>
    `;
  }

  private renderSourcesScreen() {
    const activeCount = this.folders.filter(f => f.permissionGranted || f.totalFiles > 0).length;

    return html`
      <div class="sources-list">
        <div class="sources-header">
          <span style="flex: 1 1 auto;">SOURCES ${activeCount}/${this.folders.length}</span>
          <span>F4 ADD</span>
        </div>
        ${this.folders.map((f, i) => {
          const isSelected = i === this.folderCursor;
          return html`
            <div 
              class="source-item ${isSelected ? 'cursor' : ''}"
              @click=${() => {
                this.dispatchEvent(new CustomEvent('select-folder-cursor', { detail: { index: i }, bubbles: true, composed: true }));
                if (!f.permissionGranted) {
                  this.dispatchEvent(new CustomEvent('reconnect-folder', { detail: { folderId: f.id }, bubbles: true, composed: true }));
                }
              }}
            >
              <span class="source-name">${isSelected ? '▸ ' : '  '}${f.name}</span>
              <span style="white-space: pre;">${String(f.totalFiles || 0).padStart(5, ' ')}</span>
              <span style="white-space: pre; color: ${f.permissionGranted ? '#1e2417' : '#9c1c11'}; font-weight: 700;">${f.permissionGranted ? ' ON' : ' AUTH'}</span>
            </div>
          `;
        })}
      </div>
    `;
  }
}
