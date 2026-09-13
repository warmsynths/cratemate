import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import type { PadSlot } from '../types/index.ts';
import { SamplePad } from './sample-pad.ts';

const KEY_MAP: Record<string, number> = {
  // Numbers
  '1': 0, '2': 1, '3': 2, '4': 3, '5': 4, '6': 5, '7': 6, '8': 7,
  // QWERTY Row 1
  'q': 0, 'w': 1, 'e': 2, 'r': 3,
  // QWERTY Row 2
  'a': 4, 's': 5, 'd': 6, 'f': 7,
  // Alternative 6-pad top row mapping (q, w, e, t, y, u or a, s, d)
  't': 4, 'y': 5
};

@customElement('pad-grid')
export class PadGrid extends LitElement {
  @property({ type: Array }) pads: PadSlot[] = [];
  @property({ type: String }) pathPrefix = '';

  static styles = css`
    :host {
      display: block;
      width: 100%;
    }

    .grid-container {
      display: grid;
      gap: 14px;
      width: 100%;
    }

    /* 4 Pads: 2 columns on mobile, 4 columns on desktop */
    .grid-4 {
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    }

    @media (min-width: 900px) {
      .grid-4 {
        grid-template-columns: repeat(4, 1fr);
      }
    }

    /* 6 Pads: 3 columns x 2 rows */
    .grid-6 {
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    }

    @media (min-width: 900px) {
      .grid-6 {
        grid-template-columns: repeat(3, 1fr);
      }
    }

    /* 8 Pads: 4 columns x 2 rows */
    .grid-8 {
      grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
    }

    @media (min-width: 900px) {
      .grid-8 {
        grid-template-columns: repeat(4, 1fr);
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
    // Ignore repeat key events so holding down a key doesn't stutter/machine-gun audio
    if (e.repeat) return;

    // Ignore keystrokes when focused in an input, textarea, select, or editable element
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
      const padIndex = KEY_MAP[key];
      if (padIndex < this.pads.length) {
        e.preventDefault();
        this.triggerPadByIndex(padIndex);
      }
    }
  };

  public triggerPadByIndex(padIndex: number) {
    if (padIndex < 0 || padIndex >= this.pads.length) return;
    const samplePads = this.shadowRoot?.querySelectorAll<SamplePad>('sample-pad');
    const padEl = samplePads?.[padIndex];
    if (padEl && typeof padEl.trigger === 'function') {
      padEl.trigger();
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
    const count = this.pads.length || 8;
    const gridClass = count === 4 ? 'grid-4' : count === 6 ? 'grid-6' : 'grid-8';

    return html`
      <div class="grid-container ${gridClass}">
        ${this.pads.map(slot => html`
          <sample-pad
            .slotData=${slot}
            .pathPrefix=${this.pathPrefix}
          ></sample-pad>
        `)}
      </div>
    `;
  }
}
