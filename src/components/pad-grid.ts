import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import type { PadCount, PadSlot } from '../types/index.ts';
import './sample-pad.ts';
import type { SamplePad } from './sample-pad.ts';

// MPC numbering: pad 1 sits bottom-left, so rows render 13-16 / 9-12 / 5-8 / 1-4
const DISPLAY_ORDER = [12, 13, 14, 15, 8, 9, 10, 11, 4, 5, 6, 7, 0, 1, 2, 3];

const KEY_MAP: Record<string, number> = {
  // Numbers
  '1': 0, '2': 1, '3': 2, '4': 3, '5': 4, '6': 5, '7': 6, '8': 7,
  // QWERTY bottom row to top row (MPC mapping)
  'z': 0, 'x': 1, 'c': 2, 'v': 3,
  'a': 4, 's': 5, 'd': 6, 'f': 7,
  'q': 8, 'w': 9, 'e': 10, 'r': 11
};

@customElement('pad-grid')
export class PadGrid extends LitElement {
  @property({ type: Array }) pads: PadSlot[] = [];
  @property({ type: Number }) padCount: PadCount = 8;
  @property({ type: Array }) freshIndices: number[] = [];
  @property({ type: String }) pathPrefix = '';
  @property({ type: Boolean }) stickers = false;
  @property({ type: String }) activeDevice = 'sp404mk2';

  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      gap: 8px;
      width: 100%;
      height: 100%;
      min-width: 0;
      min-height: 0;
      flex: 1 1 0;
    }

    .bank-header {
      display: flex;
      align-items: center;
      gap: 10px;
      flex: 0 0 auto;
      flex-wrap: wrap;
      position: relative;
    }

    .bank-badge {
      background: #b7c3c7;
      border: 1px solid #8b989c;
      padding: 3px 10px;
      white-space: nowrap;
      font-family: 'Barlow Condensed', sans-serif;
      font-size: 10px;
      font-weight: 600;
      letter-spacing: 2.2px;
      color: #25261f;
    }

    .bank-divider {
      flex: 1 1 auto;
      min-width: 0;
      height: 1px;
      background: #a8a9a2;
      position: relative;
    }

    .tape-sticker {
      position: absolute;
      left: 50%;
      top: 50%;
      transform: translate(-50%, -50%) rotate(-1.5deg);
      z-index: 6;
      pointer-events: none;
      display: flex;
      align-items: stretch;
      background: #f4efe1;
      border: 1px solid #b9ae8e;
      border-radius: 2px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.25);
      overflow: hidden;
      white-space: nowrap;
    }

    .tape-red {
      background: #c1382c;
      color: #f4efe1;
      font-family: 'Archivo Black', sans-serif;
      font-size: 8px;
      letter-spacing: 1.4px;
      padding: 4px 6px;
      display: flex;
      align-items: center;
    }

    .tape-title {
      font-family: 'Permanent Marker', cursive;
      font-size: 12px;
      color: #1f2a6b;
      padding: 1px 8px;
      line-height: 16px;
    }

    .bank-stats {
      font-family: 'Barlow Condensed', sans-serif;
      font-size: 10px;
      font-weight: 600;
      letter-spacing: 1.8px;
      color: #3c3d35;
      white-space: nowrap;
    }

    .matrix-container {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      grid-auto-rows: minmax(0, 1fr);
      gap: 8px;
      width: 100%;
      flex: 1 1 auto;
      min-height: 0;
    }

    @media (max-width: 559px) {
      :host {
        height: auto;
        flex: 0 0 auto;
      }
      .matrix-container sample-pad.off {
        display: none;
      }
      .matrix-container {
        grid-template-columns: repeat(2, minmax(0, 1fr));
        grid-auto-rows: minmax(clamp(104px, 10vw, 150px), 1fr);
      }
    }
  `;

  connectedCallback() {
    super.connectedCallback();
    window.addEventListener('keydown', this.handleKeyDown);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    window.removeEventListener('keydown', this.handleKeyDown);
  }

  private handleKeyDown = (e: KeyboardEvent) => {
    if (e.repeat) return;
    const path = e.composedPath();
    const activeEl = (path[0] as HTMLElement) || (e.target as HTMLElement);
    if (activeEl && (
      activeEl.tagName === 'INPUT' || 
      activeEl.tagName === 'TEXTAREA' || 
      activeEl.tagName === 'SELECT' || 
      activeEl.isContentEditable
    )) {
      return;
    }

    const key = e.key.toLowerCase();
    if (key in KEY_MAP) {
      const idx = KEY_MAP[key];
      if (idx < this.padCount && idx < this.pads.length) {
        e.preventDefault();
        const padEls = this.shadowRoot?.querySelectorAll('sample-pad');
        if (padEls) {
          padEls.forEach((el: any) => {
            if (el.padIndex === idx && !el.isOff) {
              if (e.shiftKey) {
                el.toggleKeep(e);
              } else if (e.altKey) {
                el.respin(e);
              } else {
                el.trigger();
              }
            }
          });
        }
      }
    }
  };

  public triggerPadByIndex(padIndex: number) {
    if (padIndex < 0 || padIndex >= this.pads.length || padIndex >= this.padCount) return;
    const padEls = this.shadowRoot?.querySelectorAll<SamplePad>('sample-pad');
    let targetEl: SamplePad | undefined;
    padEls?.forEach((el: any) => {
      if (el.padIndex === padIndex && !el.isOff) {
        targetEl = el;
      }
    });
    if (targetEl && typeof targetEl.trigger === 'function') {
      targetEl.trigger();
    }
  }

  render() {
    const activeCount = Math.min(this.pads.length, this.padCount);
    const totalSecs = this.pads.slice(0, activeCount).reduce((acc, p) => acc + (p.sample?.acousticProfile.duration || 0), 0);
    const devLabel = this.activeDevice === 'sp404mk2' ? 'SP-404MKII' : this.activeDevice === 'm8' ? 'M8 TRACKER' : this.activeDevice === 'po33' ? 'PO-33' : 'UNIVERSAL';

    return html`
      <div class="bank-header">
        <span class="bank-badge">PAD BANK A${window.innerWidth < 560 ? ` · 2×${Math.ceil(this.padCount / 2)}` : ''}</span>
        <span class="bank-divider">
          ${this.stickers ? html`
            <span class="tape-sticker">
              <span class="tape-red">BEAT TAPE</span>
              <span class="tape-title">Vol. 2 — Basement</span>
            </span>
          ` : ''}
        </span>
        <span class="bank-stats">${devLabel} · ${activeCount} PADS · ${totalSecs.toFixed(1)}s</span>
      </div>

      <div class="matrix-container">
        ${DISPLAY_ORDER.map(i => {
          const isLive = i < this.padCount;
          const slot = isLive ? this.pads[i] : undefined;
          const isFresh = this.freshIndices.includes(i);

          return html`
            <sample-pad
              class=${isLive ? '' : 'off'}
              .slotData=${slot}
              .padIndex=${i}
              .isOff=${!isLive}
              .isFresh=${isFresh}
              .pathPrefix=${this.pathPrefix}
            ></sample-pad>
          `;
        })}
      </div>
    `;
  }
}
