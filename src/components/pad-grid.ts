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

  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      gap: clamp(4px, 0.6vh, 6px);
      width: 100%;
      height: 100%;
      min-width: 0;
      min-height: 0;
      flex: 1 1 0;
    }

    .bank-header {
      display: flex;
      align-items: center;
      gap: 8px;
      flex: 0 0 auto;
      line-height: 1;
    }

    .bank-badge {
      background: #b7c3c7;
      border: 1px solid #8b989c;
      padding: 1.5px 6px;
      white-space: nowrap;
      font-family: 'Barlow Condensed', sans-serif;
      font-size: 9px;
      font-weight: 600;
      letter-spacing: 1.5px;
      color: #22241f;
      border-radius: 2px;
    }

    .bank-divider {
      flex: 1 1 auto;
      height: 1px;
      background: #a8a9a2;
    }

    .bank-stats {
      font-family: 'Barlow Condensed', sans-serif;
      font-size: 9px;
      font-weight: 600;
      letter-spacing: 1.3px;
      color: #3c3d35;
      white-space: nowrap;
    }

    .matrix-container {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      grid-template-rows: repeat(4, minmax(0, 1fr));
      gap: clamp(4px, 0.7vh, 8px);
      width: 100%;
      height: 100%;
      flex: 1 1 0;
      min-height: 0;
    }

    @media (max-width: 639px) {
      .matrix-container {
        grid-template-columns: repeat(2, minmax(0, 1fr));
        grid-template-rows: repeat(8, minmax(95px, 1fr));
        height: auto;
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
              el.trigger();
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
    } else {
      const slot = this.pads[padIndex];
      if (slot) {
        this.dispatchEvent(new CustomEvent('audition', {
          detail: { slot, padIndex },
          bubbles: true,
          composed: true
        }));
      }
    }
  }

  render() {
    const activeCount = Math.min(this.pads.length, this.padCount);
    const offCount = 16 - activeCount;

    return html`
      <div class="bank-header">
        <span class="bank-badge">PAD BANK A</span>
        <span class="bank-divider"></span>
        <span class="bank-stats">PADS 1–${activeCount} ACTIVE · ${offCount} OFF</span>
      </div>

      <div class="matrix-container">
        ${DISPLAY_ORDER.map(i => {
          const isLive = i < this.padCount;
          const slot = isLive ? this.pads[i] : undefined;
          const isFresh = this.freshIndices.includes(i);

          return html`
            <sample-pad
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
