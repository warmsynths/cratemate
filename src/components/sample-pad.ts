import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type { PadSlot, SampleRole, AcousticProfile } from '../types/index.ts';

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
      gap: 4px;
      height: 100%;
      min-height: 0;
      user-select: none;
      font-family: 'Barlow', system-ui, sans-serif;
      box-sizing: border-box;
    }

    :host(.fresh-deal) {
      animation: dealIn 220ms ease-out both;
    }

    @keyframes dealIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }

    button { outline: none; -webkit-tap-highlight-color: transparent; }

    .pad-top-meta {
      display: flex;
      align-items: center;
      gap: 6px;
      flex: 0 0 auto;
    }
    .role-dot {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      display: block;
      flex-shrink: 0;
    }
    .pad-number-label {
      font-family: 'Barlow Condensed', sans-serif;
      font-size: 10px;
      font-weight: 600;
      letter-spacing: 1.4px;
      color: #3c3d35;
    }
    .fresh-badge {
      font-family: 'Barlow Condensed', sans-serif;
      font-size: 9px;
      font-weight: 700;
      letter-spacing: 1.2px;
      color: transparent;
    }
    .fresh-badge.visible { color: #a9521a; }
    .role-tag-label {
      font-family: 'Barlow Condensed', sans-serif;
      font-size: 10px;
      font-weight: 500;
      letter-spacing: 1.2px;
      color: #3c3d35;
      margin-left: auto;
    }

    /* Rubber pad */
    .rubber-pad {
      flex: 1 1 auto;
      min-height: 28px;
      border-radius: 7px;
      cursor: pointer;
      padding: 10px 11px;
      display: flex;
      flex-direction: column;
      justify-content: flex-end;
      gap: 3px;
      text-align: left;
      font-family: 'Barlow', sans-serif;
      border: 1px solid #46423d;
      background: linear-gradient(#7b766e, #635f59);
      color: #f2efe6;
      box-shadow: 0 2px 3px rgba(0, 0, 0, 0.34), inset 0 1px 0 rgba(255, 255, 255, 0.22);
      transition: transform 60ms ease-out, box-shadow 60ms ease-out;
      box-sizing: border-box;
      overflow: hidden;
      position: relative;
    }
    .rubber-pad.locked {
      background: linear-gradient(#efe7c8, #ddd3ad);
      color: #25261f;
      border-color: #6f6a55;
    }
    .rubber-pad.pressed,
    .rubber-pad:active {
      transform: translateY(1.5px);
      background: linear-gradient(#5a554f, #4b4741);
      color: #f2efe6;
      box-shadow: inset 0 2px 5px rgba(0, 0, 0, 0.5);
    }
    .rubber-pad.off {
      background: linear-gradient(#b9b9b2, #adada6);
      color: #8b8c83;
      border-color: #9b9c94;
      box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.16);
      cursor: default;
      pointer-events: none;
    }

    .pad-mini-waveform {
      flex: 1 1 auto;
      min-height: 0;
      width: 100%;
      display: flex;
      align-items: center;
      gap: 1px;
      overflow: hidden;
      opacity: 0.32;
      padding-bottom: 4px;
      pointer-events: none;
      box-sizing: border-box;
    }
    .wave-bar {
      flex: 1 1 0;
      min-width: 0;
      background: currentColor;
      border-radius: 1px;
      display: block;
    }

    .pad-filename {
      font-family: 'Barlow Condensed', sans-serif;
      font-weight: 600;
      font-size: clamp(12px, 1.25vw, 17px);
      line-height: 1.05;
      letter-spacing: 0.2px;
      text-transform: uppercase;
      overflow: hidden;
      overflow-wrap: anywhere;
    }

    .pad-meta-row {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 3px 5px;
      min-height: 15px;
      color: #e4e0d4;
    }
    .rubber-pad.locked .pad-meta-row { color: #514f43; }
    .rubber-pad.pressed .pad-meta-row { color: #e4e0d4; }

    .pad-key-tag {
      font-family: 'DM Mono', monospace;
      font-size: 9px;
      letter-spacing: 0.5px;
      padding: 1px 5px;
      border: 1px solid rgba(37, 38, 31, 0.32);
      border-radius: 2px;
    }
    .pad-len-tag {
      font-family: 'DM Mono', monospace;
      font-size: 9px;
      letter-spacing: 0.4px;
    }

    .pad-fx-chips { display: contents; }
    .fx-chip {
      font-family: 'DM Mono', monospace;
      font-size: 9px;
      letter-spacing: 0.4px;
      padding: 1px 4px;
      border-radius: 2px;
      background: rgba(242, 239, 230, 0.9);
      color: #25261f;
    }
    .rubber-pad.locked:not(.pressed) .fx-chip {
      background: #25261f;
      color: #efe7c8;
    }

    /* KEEP + respin keys */
    .pad-actions {
      display: flex;
      gap: 4px;
      flex: 0 0 auto;
    }
    .keep-button,
    .respin-button {
      font-family: 'Barlow Condensed', sans-serif;
      font-weight: 600;
      padding: 5px 0;
      border: 1px solid #6f6a55;
      border-radius: 2px;
      cursor: pointer;
      background: linear-gradient(#f0e9ca, #ddd3ad);
      color: #25261f;
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.26), inset 0 1px 0 rgba(255, 255, 255, 0.5);
    }
    .keep-button:active,
    .respin-button:active { transform: translateY(1px); }
    .keep-button {
      flex: 1 1 auto;
      min-width: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      font-size: 10px;
      letter-spacing: 1.4px;
    }
    .keep-button.active {
      background: linear-gradient(#cf4436, #a92e23);
      color: #f7efe2;
    }
    .keep-lamp {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      display: block;
      background: #8f8a72;
    }
    .keep-button.active .keep-lamp { background: #ffd9b0; }
    .respin-button {
      flex: 0 0 auto;
      width: 30px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 12px;
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
    .keep-button.off .keep-lamp { background: #a9aaa3; }

    @media (max-width: 559px) {
      .rubber-pad { min-height: 54px; }
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

  private handleDblClick(e: Event) {
    e.stopPropagation();
    if (this.isOff || !this.slotData) return;
    this.dispatchEvent(new CustomEvent('inspect-pad', {
      detail: { padIndex: this.slotData.index },
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

  private renderMiniWaveform(profile?: AcousticProfile) {
    const bins = profile?.waveformBins || [];
    const bars = Array.from({ length: 24 }, (_, i) => {
      if (bins.length > 0) {
        const idx = Math.floor((i / 24) * bins.length);
        return Math.max(0.06, Math.min(1.0, bins[idx] || 0.1));
      }
      return 0.12;
    });

    return html`
      <div class="pad-mini-waveform">
        ${bars.map(h => html`<span class="wave-bar" style="height: ${Math.round(h * 100)}%;"></span>`)}
      </div>
    `;
  }

  private renderFxChips() {
    const fx = this.slotData?.fx;
    if (!fx) return nothing;
    const chips: string[] = [];
    if (fx.pitch) chips.push(`${fx.pitch > 0 ? '+' : ''}${fx.pitch}ST`);
    if (fx.reverse) chips.push('REV');
    if (fx.filter !== undefined && fx.filter < 20) chips.push('LP');
    if (fx.start) chips.push('TRIM');
    if (fx.drive) chips.push('DRV');
    if (fx.decay !== undefined && fx.decay !== 10) chips.push('DEC');
    if (fx.level !== undefined && fx.level !== 16) chips.push('LVL');
    if (chips.length === 0) return nothing;

    return html`
      <div class="pad-fx-chips">
        ${chips.slice(0, 3).map(c => html`<span class="fx-chip">${c}</span>`)}
        ${chips.length > 3 ? html`<span class="fx-chip">+${chips.length - 2}</span>` : ''}
      </div>
    `;
  }

  render() {
    const padNumberStr = String(this.padIndex + 1).padStart(2, '0');

    // Truly OFF pads (beyond current active pad count)
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
    const keyStr = profile?.rootKey || profile?.camelotKey || '';
    const durStr = profile?.duration ? `${profile.duration.toFixed(2)}s` : '';

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
        @dblclick=${this.handleDblClick}
      >
        ${this.renderMiniWaveform(profile)}
        <span class="pad-filename">${sample ? sample.fileName.replace(/\.[^/.]+$/, '') : '[EMPTY]'}</span>
        <div class="pad-meta-row">
          ${keyStr ? html`<span class="pad-key-tag">${keyStr}</span>` : ''}
          ${durStr ? html`<span class="pad-len-tag">${durStr}</span>` : ''}
          ${this.renderFxChips()}
        </div>
      </button>

      <div class="pad-actions">
        <button
          class="keep-button ${slot?.locked ? 'active' : ''} ${!sample ? 'off' : ''}"
          @click=${this.toggleKeep}
          title="${slot?.locked ? 'Unlock pad' : 'Keep / lock pad across rolls'}"
        >
          <span class="keep-lamp"></span>
          KEEP
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
