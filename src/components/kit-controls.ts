import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import type { Kit } from '../types/index.ts';

@customElement('kit-controls')
export class KitControls extends LitElement {
  @property({ type: Object }) kit?: Kit;
  @property({ type: Number }) padCount: 4 | 6 | 8 = 8;
  @property({ type: Number }) lockedCount = 0;

  static styles = css`
    :host {
      display: block;
      width: 100%;
    }

    .controls-panel {
      background: #15171e;
      border: 1px solid #232734;
      border-radius: 12px;
      padding: 12px 18px;
      display: flex;
      flex-wrap: wrap;
      justify-content: space-between;
      align-items: center;
      gap: 14px;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.25);
    }

    .kit-info {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .kit-title-row {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .kit-title {
      font-size: 16px;
      font-weight: 800;
      color: #ffffff;
      letter-spacing: -0.02em;
    }

    .harmonic-badge {
      font-family: 'JetBrains Mono', monospace;
      font-size: 11px;
      font-weight: 700;
      color: #a55eea;
      background: rgba(165, 94, 234, 0.14);
      border: 1px solid rgba(165, 94, 234, 0.35);
      padding: 2px 8px;
      border-radius: 12px;
      display: inline-flex;
      align-items: center;
      gap: 5px;
    }

    .kit-meta-desc {
      font-size: 11px;
      color: #8f9cae;
    }

    .actions-group {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 10px;
    }

    .pad-selector {
      display: inline-flex;
      background: #0d0f14;
      border: 1px solid #232734;
      border-radius: 8px;
      padding: 3px;
      gap: 3px;
    }

    .pad-option-btn {
      background: transparent;
      border: none;
      color: #8f9cae;
      font-family: 'JetBrains Mono', monospace;
      font-size: 12px;
      font-weight: 700;
      padding: 5px 12px;
      border-radius: 6px;
      cursor: pointer;
      transition: all 0.15s;
    }

    .pad-option-btn:hover {
      color: #ffffff;
    }

    .pad-option-btn.active {
      background: #232734;
      color: #00d2d3;
      box-shadow: 0 2px 6px rgba(0, 0, 0, 0.4);
    }

    .btn {
      font-family: inherit;
      font-size: 12px;
      font-weight: 700;
      padding: 8px 14px;
      border-radius: 8px;
      border: 1px solid transparent;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      transition: all 0.15s cubic-bezier(0.16, 1, 0.3, 1);
    }

    .btn:active {
      transform: scale(0.97);
    }

    .btn-primary {
      background: linear-gradient(135deg, #00d2d3 0%, #0abde3 100%);
      color: #0d0f14;
      border-color: #00d2d3;
      box-shadow: 0 2px 10px rgba(0, 210, 211, 0.3);
    }

    .btn-primary:hover {
      background: linear-gradient(135deg, #48dbfb 0%, #00d2d3 100%);
      box-shadow: 0 4px 14px rgba(0, 210, 211, 0.5);
    }

    .btn-secondary {
      background: #1c202a;
      color: #e2e8f0;
      border-color: #282f3f;
    }

    .btn-secondary:hover {
      background: #252b39;
      border-color: #3b4458;
      color: #ffffff;
    }

    .btn-export {
      background: #1e2230;
      color: #2ecc71;
      border-color: rgba(46, 204, 113, 0.3);
    }

    .btn-export:hover {
      background: rgba(46, 204, 113, 0.15);
      border-color: #2ecc71;
      color: #2ecc71;
    }

    .lock-counter-tag {
      background: rgba(241, 196, 15, 0.2);
      color: #f1c40f;
      padding: 1px 6px;
      border-radius: 10px;
      font-size: 10px;
      font-weight: 800;
    }
  `;

  private setPadCount(count: 4 | 6 | 8) {
    this.dispatchEvent(new CustomEvent('change-pad-count', {
      detail: { count },
      bubbles: true,
      composed: true
    }));
  }

  private rerollEntire() {
    this.dispatchEvent(new CustomEvent('reroll-kit', {
      detail: { rerollAll: true },
      bubbles: true,
      composed: true
    }));
  }

  private rerollUnlocked() {
    this.dispatchEvent(new CustomEvent('reroll-kit', {
      detail: { rerollAll: false },
      bubbles: true,
      composed: true
    }));
  }

  private exportKit() {
    this.dispatchEvent(new CustomEvent('export-kit', {
      bubbles: true,
      composed: true
    }));
  }

  render() {
    const kit = this.kit;
    const name = kit ? kit.name : 'Ready Kit';
    const camelot = kit?.dominantCamelot;

    return html`
      <div class="controls-panel">
        <div class="kit-info">
          <div class="kit-title-row">
            <span class="kit-title">${name}</span>
            ${camelot ? html`
              <span class="harmonic-badge" title="Harmonic compatibility active">
                ✨ Harmonic Key: ${camelot}
              </span>
            ` : ''}
          </div>
          <div class="kit-meta-desc">
            Complementary 5-role balanced acoustic palette • Harmonic key bias active
          </div>
        </div>

        <div class="actions-group">
          <!-- 4, 6, 8 Pad selector -->
          <div class="pad-selector">
            <button 
              class="pad-option-btn ${this.padCount === 4 ? 'active' : ''}"
              @click=${() => this.setPadCount(4)}
            >4 PADS</button>
            <button 
              class="pad-option-btn ${this.padCount === 6 ? 'active' : ''}"
              @click=${() => this.setPadCount(6)}
            >6 PADS</button>
            <button 
              class="pad-option-btn ${this.padCount === 8 ? 'active' : ''}"
              @click=${() => this.setPadCount(8)}
            >8 PADS</button>
          </div>

          <!-- Reroll Unlocked -->
          <button 
            class="btn btn-secondary"
            @click=${this.rerollUnlocked}
            title="Reroll only unlocked slots, keeping locked pads intact"
          >
            🎲 Reroll Unlocked
            ${this.lockedCount > 0 ? html`<span class="lock-counter-tag">${this.lockedCount} Locked</span>` : ''}
          </button>

          <!-- Reroll Entire Kit -->
          <button 
            class="btn btn-primary"
            @click=${this.rerollEntire}
            title="Reroll all pads for a fresh acoustic palette"
          >
            ⚡ Reroll Entire Kit
          </button>

          <!-- Export Kit Folder -->
          <button 
            class="btn btn-export"
            @click=${this.exportKit}
            title="Export all picked samples into a destination folder via File System Access API"
          >
            📁 Export Kit
          </button>
        </div>
      </div>
    `;
  }
}
