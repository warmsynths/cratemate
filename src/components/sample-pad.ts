import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type { PadSlot, SampleRole } from '../types/index.ts';
import './waveform-view.ts';

const ROLE_THEMES: Record<SampleRole, { border: string; glow: string; badgeBg: string; badgeText: string }> = {
  'Kick/Low': {
    border: 'rgba(255, 71, 87, 0.4)',
    glow: 'rgba(255, 71, 87, 0.25)',
    badgeBg: 'rgba(255, 71, 87, 0.15)',
    badgeText: '#ff6b81'
  },
  'Snare/Snap': {
    border: 'rgba(0, 210, 211, 0.4)',
    glow: 'rgba(0, 210, 211, 0.25)',
    badgeBg: 'rgba(0, 210, 211, 0.15)',
    badgeText: '#00d2d3'
  },
  'Hat/Air': {
    border: 'rgba(29, 209, 161, 0.4)',
    glow: 'rgba(29, 209, 161, 0.25)',
    badgeBg: 'rgba(29, 209, 161, 0.15)',
    badgeText: '#1dd1a1'
  },
  'Tonal/Melodic': {
    border: 'rgba(165, 94, 234, 0.4)',
    glow: 'rgba(165, 94, 234, 0.25)',
    badgeBg: 'rgba(165, 94, 234, 0.15)',
    badgeText: '#a55eea'
  },
  'Texture/Wildcard': {
    border: 'rgba(255, 165, 2, 0.4)',
    glow: 'rgba(255, 165, 2, 0.25)',
    badgeBg: 'rgba(255, 165, 2, 0.15)',
    badgeText: '#ffa502'
  }
};

const ALL_ROLES: SampleRole[] = [
  'Kick/Low',
  'Snare/Snap',
  'Hat/Air',
  'Tonal/Melodic',
  'Texture/Wildcard'
];

@customElement('sample-pad')
export class SamplePad extends LitElement {
  @property({ type: Object }) slotData!: PadSlot;
  @property({ type: String }) pathPrefix = '';
  @state() private isTriggered = false;
  @state() private copied = false;

  static styles = css`
    :host {
      display: block;
      user-select: none;
    }

    .pad-card {
      background: #15171e;
      border: 1px solid #232734;
      border-radius: 12px;
      padding: 12px;
      position: relative;
      display: flex;
      flex-direction: column;
      gap: 10px;
      transition: all 0.15s cubic-bezier(0.16, 1, 0.3, 1);
      cursor: pointer;
      box-shadow: 0 4px 14px rgba(0, 0, 0, 0.35);
      overflow: hidden;
    }

    .pad-card:hover {
      background: #1a1d26;
      border-color: #383e52;
      transform: translateY(-2px);
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
    }

    .pad-card.triggered {
      transform: scale(0.98);
      background: #202432;
      box-shadow: 0 0 20px var(--role-glow, rgba(0, 210, 211, 0.5)), inset 0 0 14px var(--role-glow, rgba(0, 210, 211, 0.2)) !important;
      border-color: var(--role-badge-text, #00d2d3) !important;
    }

    .pad-card.triggered .keybind-pill {
      background: var(--role-badge-bg, rgba(0, 210, 211, 0.2));
      color: var(--role-badge-text, #00d2d3);
      border-color: var(--role-badge-text, #00d2d3);
      box-shadow: 0 0 8px var(--role-glow, rgba(0, 210, 211, 0.4));
    }

    .pad-card.triggered .pad-index {
      color: var(--role-badge-text, #00d2d3);
    }

    .pad-card.locked {
      border-style: solid;
      border-color: #f1c40f;
    }

    .pad-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 8px;
    }

    .index-keybind {
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .pad-index {
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 0.08em;
      color: #8f9cae;
      text-transform: uppercase;
      transition: color 0.15s;
    }

    .keybind-pill {
      font-family: 'JetBrains Mono', monospace, ui-monospace;
      font-size: 10px;
      font-weight: 700;
      background: #232734;
      color: #e2e8f0;
      padding: 2px 6px;
      border-radius: 4px;
      border: 1px solid #33394c;
      transition: all 0.15s;
    }

    .role-select-badge {
      font-size: 11px;
      font-weight: 700;
      padding: 2px 8px;
      border-radius: 12px;
      background: var(--role-badge-bg, rgba(0, 210, 211, 0.15));
      color: var(--role-badge-text, #00d2d3);
      border: 1px solid var(--role-border, rgba(0, 210, 211, 0.3));
      cursor: pointer;
      outline: none;
      transition: all 0.15s;
    }

    .role-select-badge:hover {
      filter: brightness(1.2);
    }

    .role-select-badge option {
      background: #15171e;
      color: #e2e8f0;
    }

    .sample-body {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .sample-name {
      font-size: 13px;
      font-weight: 600;
      color: #f8fafc;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      letter-spacing: -0.01em;
    }

    .telemetry-row {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      align-items: center;
    }

    .tag-pill {
      font-size: 10px;
      font-family: 'JetBrains Mono', monospace;
      color: #94a3b8;
      background: #1c202a;
      padding: 2px 6px;
      border-radius: 4px;
      border: 1px solid #282f3f;
    }

    .tag-pill.highlight {
      color: #38ef7d;
      border-color: rgba(56, 239, 125, 0.3);
      background: rgba(56, 239, 125, 0.08);
    }

    .pad-card.loading {
      border-color: #00d2d3 !important;
      box-shadow: 0 0 16px rgba(0, 210, 211, 0.35) !important;
    }

    .waveform-container {
      position: relative;
      background: #0d0f14;
      border-radius: 6px;
      padding: 4px;
      border: 1px solid #1c202a;
      min-height: 48px;
    }

    .loading-overlay {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(13, 15, 20, 0.85);
      backdrop-filter: blur(2px);
      border-radius: 6px;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      color: #00d2d3;
      font-size: 11px;
      font-weight: 700;
      z-index: 5;
    }

    .mini-spinner {
      width: 12px;
      height: 12px;
      border: 2px solid rgba(0, 210, 211, 0.25);
      border-top-color: #00d2d3;
      border-radius: 50%;
      animation: spin 0.6s linear infinite;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    .pad-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-top: 2px;
      padding-top: 6px;
      border-top: 1px solid #1c202a;
      gap: 4px;
    }

    .action-btn {
      background: transparent;
      border: 1px solid transparent;
      color: #8f9cae;
      border-radius: 6px;
      padding: 4px 7px;
      font-size: 11px;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 3px;
      transition: all 0.15s;
    }

    .action-btn:hover {
      background: #232734;
      color: #ffffff;
      border-color: #33394c;
    }

    .action-btn.active-lock {
      color: #f1c40f;
      background: rgba(241, 196, 15, 0.12);
      border-color: rgba(241, 196, 15, 0.4);
    }

    .action-btn.copied {
      color: #2ecc71;
      border-color: rgba(46, 204, 113, 0.4);
      background: rgba(46, 204, 113, 0.1);
    }

    .trigger-indicator {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: #3b4256;
      transition: background 0.1s;
    }

    .trigger-indicator.loading {
      background: #00d2d3;
      box-shadow: 0 0 8px #00d2d3;
      animation: pulseIndicator 0.8s ease-in-out infinite alternate;
    }

    @keyframes pulseIndicator {
      from { opacity: 0.4; transform: scale(0.9); }
      to { opacity: 1; transform: scale(1.3); }
    }

    .pad-card.triggered .trigger-indicator {
      background: #2ecc71;
      box-shadow: 0 0 10px #2ecc71, 0 0 4px #ffffff;
      transform: scale(1.4);
    }
  `;

  private triggerTimer: number | null = null;

  disconnectedCallback() {
    super.disconnectedCallback();
    if (this.triggerTimer) {
      clearTimeout(this.triggerTimer);
      this.triggerTimer = null;
    }
  }

  public trigger = (options?: { pulseMs?: number }) => {
    this.isTriggered = true;
    if (this.triggerTimer) {
      clearTimeout(this.triggerTimer);
    }

    const durationSec = this.slotData?.sample?.acousticProfile?.duration || 0.3;
    const pulseMs = options?.pulseMs || Math.min(Math.max(durationSec * 1000, 240), 900);

    this.triggerTimer = window.setTimeout(() => {
      this.isTriggered = false;
      this.triggerTimer = null;
    }, pulseMs);

    this.dispatchEvent(new CustomEvent('audition', {
      detail: { slot: this.slotData, padIndex: this.slotData.index },
      bubbles: true,
      composed: true
    }));
  };

  private toggleLock(e: Event) {
    e.stopPropagation();
    this.dispatchEvent(new CustomEvent('toggle-lock', {
      detail: { index: this.slotData.index },
      bubbles: true,
      composed: true
    }));
  }

  private rerollSinglePad(e: Event) {
    e.stopPropagation();
    this.dispatchEvent(new CustomEvent('reroll-single-pad', {
      detail: { padIndex: this.slotData.index },
      bubbles: true,
      composed: true
    }));
  }

  private handleRoleSelect(e: Event) {
    e.stopPropagation();
    const newRole = (e.target as HTMLSelectElement).value as SampleRole;
    this.dispatchEvent(new CustomEvent('change-pad-role', {
      detail: { padIndex: this.slotData.index, newRole },
      bubbles: true,
      composed: true
    }));
  }

  private async copyPath(e: Event) {
    e.stopPropagation();
    if (!this.slotData.sample) return;

    const sample = this.slotData.sample;
    let fullPath = sample.relativePath;

    if (this.pathPrefix && this.pathPrefix.trim() !== '') {
      const cleanPrefix = this.pathPrefix.trim().replace(/[\\/]+$/, '');
      const cleanRel = sample.relativePath.replace(/^[\\/]+/, '');
      const sep = cleanPrefix.includes('\\') ? '\\' : '/';
      fullPath = `${cleanPrefix}${sep}${cleanRel.replace(/\//g, sep)}`;
    }

    try {
      await navigator.clipboard.writeText(fullPath);
      this.copied = true;
      setTimeout(() => {
        this.copied = false;
      }, 1500);

      this.dispatchEvent(new CustomEvent('toast', {
        detail: { message: `Copied: ${sample.fileName}` },
        bubbles: true,
        composed: true
      }));
    } catch (err) {
      console.warn('Clipboard write failed:', err);
    }
  }

  render() {
    const slot = this.slotData;
    const sample = slot.sample;
    const role = slot.role;
    const theme = ROLE_THEMES[role] || ROLE_THEMES['Snare/Snap'];
    const padNumber = slot.index + 1;

    const profile = sample?.acousticProfile;
    const durationStr = profile ? `${profile.duration.toFixed(2)}s` : '--';
    const sharpnessStr = profile ? `⚡ ${profile.transientSharpness}%` : '--';
    const keyStr = profile?.camelotKey 
      ? `🎹 ${profile.rootKey || ''} (${profile.camelotKey})`
      : profile?.rootKey 
      ? `🎹 ${profile.rootKey}` 
      : null;

    return html`
      <div 
        class="pad-card ${this.isTriggered ? 'triggered' : ''} ${slot.locked ? 'locked' : ''} ${slot.isLoading ? 'loading' : ''}"
        style="
          --role-border: ${theme.border};
          --role-glow: ${theme.glow};
          --role-badge-bg: ${theme.badgeBg};
          --role-badge-text: ${theme.badgeText};
        "
        @click=${() => this.trigger()}
      >
        <div class="pad-header">
          <div class="index-keybind">
            <span class="trigger-indicator ${slot.isLoading ? 'loading' : ''}"></span>
            <span class="pad-index">PAD ${padNumber}</span>
            <span class="keybind-pill">${slot.keybind}</span>
          </div>

          <!-- Interactive Role Switcher -->
          <select 
            class="role-select-badge"
            .value=${role}
            @click=${(e: Event) => e.stopPropagation()}
            @change=${this.handleRoleSelect}
            title="Change role for this pad slot"
          >
            ${ALL_ROLES.map(r => html`
              <option value="${r}" ?selected=${r === role}>${r}</option>
            `)}
          </select>
        </div>

        <div class="sample-body">
          <div class="sample-name" title="${sample?.fileName || 'Empty'}">
            ${sample ? sample.fileName : 'Empty Slot'}
          </div>

          <div class="telemetry-row">
            <span class="tag-pill">${durationStr}</span>
            <span class="tag-pill">${sharpnessStr}</span>
            ${keyStr ? html`<span class="tag-pill highlight">${keyStr}</span>` : ''}
          </div>

          <div class="waveform-container">
            ${slot.isLoading ? html`
              <div class="loading-overlay">
                <div class="mini-spinner"></div>
                <span>Loading...</span>
              </div>
            ` : ''}
            <waveform-view
              .bins=${profile?.waveformBins || []}
              .role=${role}
              .isPlaying=${this.isTriggered}
              .duration=${profile?.duration || 0.4}
            ></waveform-view>
          </div>
        </div>

        <div class="pad-footer">
          <button 
            class="action-btn ${slot.locked ? 'active-lock' : ''}"
            @click=${this.toggleLock}
            title="${slot.locked ? 'Unlock Pad' : 'Lock Pad (preserve during kit reroll)'}"
          >
            ${slot.locked ? '🔒 Locked' : '🔓 Lock'}
          </button>

          <!-- Single Pad Reroll Button -->
          <button
            class="action-btn"
            @click=${this.rerollSinglePad}
            title="Reroll only Pad ${padNumber}"
          >
            🎲 Reroll
          </button>

          <button 
            class="action-btn ${this.copied ? 'copied' : ''}"
            @click=${this.copyPath}
            title="Copy path to clipboard"
          >
            ${this.copied ? '✓ Copied' : '📋 Copy'}
          </button>
        </div>
      </div>
    `;
  }
}
