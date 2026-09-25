import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type { PadSlot, SampleRole } from '../types/index.ts';

const SHORT_ROLES: Record<SampleRole, string> = {
  'Kick/Low': 'LOW',
  'Snare/Snap': 'SNAP',
  'Hat/Air': 'AIR',
  'Tonal/Melodic': 'TONAL',
  'Texture/Wildcard': 'TEXTURE'
};

const ROLE_HUES: Record<SampleRole, string> = {
  'Kick/Low': '#c1382c',
  'Snare/Snap': '#3667b8',
  'Hat/Air': '#6f8036',
  'Tonal/Melodic': '#2b3037',
  'Texture/Wildcard': '#a9521a'
};

@customElement('sample-pad')
export class SamplePad extends LitElement {
  @property({ type: Object }) slotData?: PadSlot;
  @property({ type: Number }) padIndex = 0;
  @property({ type: Boolean }) isOff = false;
  @property({ type: Boolean }) isFresh = false;
  @property({ type: String }) pathPrefix = '';
  @state() private isTriggered = false;

  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      gap: clamp(2px, 0.4vh, 4px);
      height: 100%;
      min-height: 0;
      user-select: none;
      font-family: 'Barlow', system-ui, sans-serif;
      box-sizing: border-box;
      overflow: hidden;
    }

    .pad-top-meta {
      display: flex;
      align-items: center;
      gap: 5px;
      flex: 0 0 auto;
      line-height: 1;
    }

    .role-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      display: block;
      flex-shrink: 0;
    }

    .pad-number-label {
      font-family: 'Barlow Condensed', sans-serif;
      font-size: 9.5px;
      font-weight: 600;
      letter-spacing: 1.2px;
      color: #3c3d35;
    }

    .fresh-badge {
      font-family: 'Barlow Condensed', sans-serif;
      font-size: 8.5px;
      font-weight: 700;
      letter-spacing: 1px;
      color: #a9521a;
      opacity: 0;
      transition: opacity 0.2s ease-out;
    }

    .fresh-badge.visible {
      opacity: 1;
    }

    .role-tag-label {
      font-family: 'Barlow Condensed', sans-serif;
      font-size: 9px;
      font-weight: 500;
      letter-spacing: 1px;
      color: #4c4d44;
      margin-left: auto;
    }

    /* Rubber MPC Pad Button */
    .rubber-pad {
      flex: 1 1 0;
      min-height: 0;
      border-radius: 6px;
      cursor: pointer;
      padding: clamp(4px, 0.7vh, 8px) clamp(6px, 0.7vw, 10px);
      display: flex;
      flex-direction: column;
      justify-content: flex-end;
      gap: 2px;
      text-align: left;
      font-family: 'Barlow', sans-serif;
      border: 1px solid #46423d;
      background: linear-gradient(#7b766e, #635f59);
      color: #f2efe6;
      box-shadow: 0 2px 3px rgba(0, 0, 0, 0.34), inset 0 1px 0 rgba(255, 255, 255, 0.22);
      transition: transform 60ms ease-out, box-shadow 60ms ease-out, background 120ms ease-out;
      outline: none;
      -webkit-tap-highlight-color: transparent;
      box-sizing: border-box;
      overflow: hidden;
    }

    .rubber-pad:hover {
      background: linear-gradient(#88837a, #6d6962);
    }

    .rubber-pad.pressed,
    .rubber-pad:active {
      transform: translateY(1.5px);
      background: linear-gradient(#5a554f, #4b4741);
      box-shadow: inset 0 2px 5px rgba(0, 0, 0, 0.5);
    }

    .rubber-pad.locked {
      background: linear-gradient(#efe7c8, #ddd3ad);
      color: #25261f;
      border-color: #6f6a55;
      box-shadow: 0 2px 3px rgba(0, 0, 0, 0.3), inset 0 1px 0 #fff;
    }

    .rubber-pad.locked:hover {
      background: linear-gradient(#f7efd2, #e6dcb8);
    }

    .rubber-pad.off {
      background: linear-gradient(#b9b9b2, #adada6);
      color: #8b8c83;
      border-color: #9b9c94;
      box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.16);
      cursor: default;
      pointer-events: none;
    }

    .pad-filename {
      font-family: 'Barlow Condensed', sans-serif;
      font-weight: 600;
      font-size: clamp(11px, 1.1vw, 14px);
      line-height: 1.1;
      letter-spacing: 0.2px;
      text-transform: uppercase;
      overflow: hidden;
      overflow-wrap: anywhere;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
    }

    .pad-key-tag {
      align-self: flex-start;
      font-family: 'DM Mono', monospace;
      font-size: 8.5px;
      letter-spacing: 0.4px;
      padding: 1px 4px;
      border: 1px solid rgba(255, 255, 255, 0.25);
      border-radius: 2px;
      color: #e4e0d4;
      background: rgba(0, 0, 0, 0.15);
      line-height: 1.1;
    }

    .rubber-pad.locked .pad-key-tag {
      color: #514f43;
      border-color: rgba(37, 38, 31, 0.35);
      background: rgba(0, 0, 0, 0.05);
    }

    /* Actions row (KEEP and Respin) */
    .pad-actions {
      display: flex;
      gap: 3px;
      flex: 0 0 auto;
    }

    .keep-button {
      flex: 1 1 auto;
      min-width: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 5px;
      font-family: 'Barlow Condensed', sans-serif;
      font-size: 9px;
      font-weight: 600;
      letter-spacing: 1.2px;
      padding: clamp(2px, 0.35vh, 4px) 0;
      border: 1px solid #6f6a55;
      border-radius: 2px;
      cursor: pointer;
      background: linear-gradient(#f0e9ca, #ddd3ad);
      color: #25261f;
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.26), inset 0 1px 0 rgba(255, 255, 255, 0.5);
      transition: all 80ms ease-out;
      outline: none;
    }

    .keep-button:hover {
      background: linear-gradient(#f8f3dd, #e7dcba);
    }

    .keep-button:active {
      transform: translateY(1px);
    }

    .keep-button.active {
      background: linear-gradient(#cf4436, #a92e23);
      color: #f7efe2;
      border-color: #79241c;
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.32), inset 0 1px 0 rgba(255, 255, 255, 0.35);
    }

    .keep-lamp {
      width: 5px;
      height: 5px;
      border-radius: 50%;
      display: block;
      background: #8f8a72;
      transition: background 100ms;
    }

    .keep-button.active .keep-lamp {
      background: #ffd9b0;
      box-shadow: 0 0 5px rgba(255, 217, 176, 0.8);
    }

    .respin-button {
      flex: 0 0 auto;
      width: clamp(22px, 2.2vw, 26px);
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: 'Barlow Condensed', sans-serif;
      font-size: 11px;
      font-weight: 600;
      padding: clamp(2px, 0.35vh, 4px) 0;
      border: 1px solid #6f6a55;
      border-radius: 2px;
      cursor: pointer;
      background: linear-gradient(#f0e9ca, #ddd3ad);
      color: #25261f;
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.26), inset 0 1px 0 rgba(255, 255, 255, 0.5);
      outline: none;
    }

    .respin-button:hover {
      background: linear-gradient(#f8f3dd, #e7dcba);
    }

    .respin-button:active {
      transform: translateY(1px);
    }

    .keep-button.off,
    .respin-button.off {
      background: linear-gradient(#c6c6bf, #b9b9b2);
      color: #84857c;
      border-color: #a9aaa3;
      box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.14);
      cursor: not-allowed;
      pointer-events: none;
    }

    .keep-button.off .keep-lamp {
      background: #a9aaa3;
      box-shadow: none;
    }
  `;

  public trigger() {
    if (this.isOff) return;
    this.isTriggered = true;
    setTimeout(() => {
      this.isTriggered = false;
    }, 110);

    this.dispatchEvent(new CustomEvent('pad-trigger', {
      detail: { padIndex: this.slotData?.index ?? this.padIndex },
      bubbles: true,
      composed: true
    }));
  }

  private toggleKeep(e: Event) {
    e.stopPropagation();
    if (this.isOff || !this.slotData) return;
    const newLocked = !this.slotData.locked;
    this.dispatchEvent(new CustomEvent('pad-lock', {
      detail: { padIndex: this.slotData.index, locked: newLocked },
      bubbles: true,
      composed: true
    }));
  }

  private respin(e: Event) {
    e.stopPropagation();
    if (this.isOff || !this.slotData) return;
    this.dispatchEvent(new CustomEvent('reroll-single-pad', {
      detail: { padIndex: this.slotData.index },
      bubbles: true,
      composed: true
    }));
  }

  render() {
    const padNumberStr = String(this.padIndex + 1).padStart(2, '0');

    // Truly OFF pads (beyond current active pad count, e.g. pads 9-16 when count=8)
    if (this.isOff) {
      return html`
        <div class="pad-top-meta">
          <span class="role-dot" style="background: #a9aaa3;"></span>
          <span class="pad-number-label" style="color: #6f7067;">PAD ${padNumberStr}</span>
          <span class="role-tag-label" style="color: #6f7067;">OFF</span>
        </div>

        <button class="rubber-pad off" tabindex="-1">
          <span class="pad-filename"></span>
        </button>

        <div class="pad-actions">
          <button class="keep-button off" tabindex="-1">
            <span class="keep-lamp"></span>
            —
          </button>
          <button class="respin-button off" tabindex="-1">↻</button>
        </div>
      `;
    }

    // Active pad slot
    const slot = this.slotData;
    const sample = slot?.sample;
    const role = slot?.role || (this.padIndex % 4 === 0 ? 'Kick/Low' : this.padIndex % 4 === 1 ? 'Snare/Snap' : this.padIndex % 4 === 2 ? 'Hat/Air' : 'Tonal/Melodic');
    const roleHue = ROLE_HUES[role] || '#3667b8';
    const roleShort = SHORT_ROLES[role] || 'ROLE';

    const profile = sample?.acousticProfile;
    const tagStr = profile?.camelotKey || profile?.rootKey || (profile?.duration ? `${profile.duration.toFixed(2)}s` : '');

    return html`
      <div class="pad-top-meta">
        <span class="role-dot" style="background: ${roleHue};"></span>
        <span class="pad-number-label">PAD ${padNumberStr}</span>
        <span class="fresh-badge ${this.isFresh ? 'visible' : ''}">NEW</span>
        <span class="role-tag-label">${roleShort}</span>
      </div>

      <button
        class="rubber-pad ${this.isTriggered ? 'pressed' : ''} ${slot?.locked ? 'locked' : ''}"
        @click=${() => this.trigger()}
      >
        <span class="pad-filename">${sample ? sample.fileName.replace(/\.[^/.]+$/, '') : '[EMPTY]'}</span>
        ${tagStr ? html`<span class="pad-key-tag">${tagStr}</span>` : ''}
      </button>

      <div class="pad-actions">
        <button
          class="keep-button ${slot?.locked ? 'active' : ''} ${!sample ? 'off' : ''}"
          @click=${this.toggleKeep}
          title="${slot?.locked ? 'Unlock pad' : 'Keep / lock pad across rolls'}"
        >
          <span class="keep-lamp"></span>
          ${slot?.locked ? 'LOCKED' : 'KEEP'}
        </button>
        <button
          class="respin-button ${!sample ? 'off' : ''}"
          @click=${this.respin}
          title="Respin this pad"
        >
          ↻
        </button>
      </div>
    `;
  }
}
