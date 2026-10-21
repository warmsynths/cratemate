import { LitElement, html, css, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { baseStyles, CATS, CAT_COLOR, CAT_SHORT, NOTES, SCALE_STEPS, alloc, type Category } from '../ui/theme.ts';
import type { PadCount } from '../types/index.ts';

export interface RecipeState {
  /** Root note index 0-11, or -1 for any key. */
  root: number;
  scale: 'minor' | 'major';
  count: PadCount;
  weights: Record<Category, number>;
  /** Pad layout id, or 'none' to build from the mix. */
  layoutId: string;
}

export interface RecipePack {
  id: string;
  name: string;
  active: boolean;
}

export const PAD_COUNTS: PadCount[] = [4, 6, 8, 12, 16];

const chip = (on: boolean) => on ? 'background:#3b2e25;color:#f3ead7' : 'background:#ebe0ca;color:#3b2e25';

@customElement('recipe-panel')
export class RecipePanel extends LitElement {
  @property({ type: Object }) recipe!: RecipeState;
  @property({ type: Boolean, reflect: true }) mobile = false;
  @property({ type: Array }) packs: RecipePack[] = [];
  /** Pads per sound type when a layout fixes the mix. */
  @property({ type: Object }) layoutMix?: Record<Category, number>;
  @property() layoutName = '';

  @property({ attribute: false }) onRoot?: (n: number) => void;
  @property({ attribute: false }) onScale?: (k: 'minor' | 'major' | 'any') => void;
  @property({ attribute: false }) onCount?: (n: PadCount) => void;
  @property({ attribute: false }) onLayout?: (on: boolean) => void;
  @property({ attribute: false }) onWeight?: (cat: Category, value: number) => void;
  @property({ attribute: false }) onPack?: (id: string) => void;
  @property({ attribute: false }) onAddFolder?: () => void;
  @property({ attribute: false }) onMake?: () => void;
  @property({ attribute: false }) onDone?: () => void;

  static styles = [baseStyles, css`
    :host {
      position: absolute;
      z-index: 4;
      left: clamp(14px, 2vw, 28px);
      right: clamp(14px, 2vw, 28px);
      top: clamp(70px, 11vh, 96px);
      max-height: calc(100% - clamp(84px, 13vh, 116px));
      overflow-y: auto;
      background: #fbf5e8;
      border-radius: 20px;
      box-shadow: 0 24px 48px -20px rgba(59, 46, 37, 0.5), 0 0 0 1.5px #e0d3bb;
      display: flex;
      flex-direction: column;
      animation: rise 160ms ease-out;
    }
    :host([mobile]) {
      left: 0; right: 0; top: auto; bottom: 0;
      max-height: 88%;
      border-radius: 24px 24px 0 0;
    }
    @keyframes rise { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
    .stripes > i { height: 6px; }
    .body {
      padding: clamp(12px, 2.4vh, 20px) clamp(14px, 2vw, 22px) clamp(14px, 2.6vh, 22px);
      display: flex; flex-direction: column; gap: clamp(10px, 2vh, 16px);
    }
    .title { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
    .title .display { font-size: 24px; }
    .title div { display: flex; gap: 6px; }
    .pill { min-height: 40px; padding: 0 16px; border: none; border-radius: 999px; font-size: 14px; font-weight: 700; cursor: pointer; white-space: nowrap; }
    .make { background: #b85f36; color: #fbf3e4; }
    .done { background: #3b2e25; color: #f3ead7; }
    .pull { display: flex; flex-direction: column; gap: 8px; }
    .chips { display: flex; flex-wrap: wrap; gap: 6px; }
    .chips button { min-height: 40px; padding: 0 14px; border: none; border-radius: 999px; font-size: 14px; font-weight: 600; white-space: nowrap; cursor: pointer; }
    .chips .add { background: transparent; border: 1.5px dashed #cdbb9c; color: #8a7764; }
    .grid { display: grid; grid-template-columns: minmax(160px, 0.7fr) minmax(0, 1.3fr); gap: clamp(12px, 2vw, 24px); align-items: start; }
    :host([mobile]) .grid { grid-template-columns: minmax(0, 1fr); }
    .left { display: flex; flex-direction: column; align-items: center; gap: 10px; container-type: inline-size; }
    .row { width: 100%; display: flex; justify-content: space-between; align-items: baseline; gap: 8px; }
    .row .display { font-size: 17px; }
    .notes { width: 100%; display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 4px; }
    .notes button { height: clamp(30px, 6.4vh, 40px); padding: 0; border: none; border-radius: 10px; font-size: 15px; cursor: pointer; }
    :host([mobile]) .notes button { height: 44px; }
    .opts { width: 100%; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 4px; }
    .opts.counts { grid-template-columns: repeat(5, minmax(0, 1fr)); }
    .opts.two { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .opts button {
      min-height: 36px; padding: 0 4px; border: none; border-radius: 10px; font-size: 13px; font-weight: 700;
      white-space: nowrap; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 7px;
    }
    .opts .n { font-size: 15px; }
    .cells { display: grid; grid-template-columns: repeat(4, 5px); gap: 2px; }
    .cells i { width: 5px; height: 5px; border-radius: 1.5px; }
    @container (max-width: 320px) { .cells { display: none; } }
    .sub { align-self: flex-start; margin-top: 4px; }
    .right { display: flex; flex-direction: column; gap: 8px; min-width: 0; }
    .right .row { width: auto; }
    .hint { font-size: 13px; color: #8a7764; }
    .mix { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 3px; padding: 10px 6px; border-radius: 14px; background: #f1e8d6; }
    .col { display: flex; flex-direction: column; align-items: stretch; gap: 3px; min-width: 0; }
    .col .display { font-size: 17px; text-align: center; }
    .blocks { display: flex; flex-direction: column-reverse; gap: 3px; }
    .blocks button { height: clamp(18px, 4.4vh, 30px); padding: 0; border: none; border-radius: 6px; cursor: pointer; }
    :host([mobile]) .blocks button { height: 30px; }
    .blocks button:disabled { cursor: default; }
    .col span:last-child { font-size: 12px; font-weight: 700; text-align: center; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .note { font-size: 13px; line-height: 1.4; color: #6b5b4c; text-wrap: pretty; }
  `];

  render() {
    const r = this.recipe;
    if (!r) return nothing;
    const inKey = (n: number) => r.root >= 0 && SCALE_STEPS[r.scale].includes((n - r.root + 12) % 12);
    const keyLabel = r.root < 0 ? 'Any key' : `${NOTES[r.root]} ${r.scale}`;
    const layoutOn = r.layoutId !== 'none' && !!this.layoutMix;
    const counts = layoutOn ? this.layoutMix! : alloc(r.weights, r.count);

    return html`
      <div class="stripes"><i></i><i></i><i></i></div>
      <div class="body">
        <div class="title">
          <span class="display">Kit recipe</span>
          <div>
            <button class="pill make" @click=${() => this.onMake?.()}>Make with this</button>
            <button class="pill done" @click=${() => this.onDone?.()}>Done</button>
          </div>
        </div>

        ${this.mobile ? html`
          <div class="pull">
            <span class="caps">PULL FROM</span>
            <div class="chips">
              ${this.packs.map(p => html`
                <button style=${chip(p.active)} aria-pressed=${p.active} @click=${() => this.onPack?.(p.id)}>${p.name}</button>
              `)}
              <button class="add" @click=${() => this.onAddFolder?.()}>+ Add folder</button>
            </div>
          </div>
        ` : nothing}

        <div class="grid">
          <div class="left">
            <div class="row"><span class="caps">KEY</span><span class="display">${keyLabel}</span></div>
            <div class="notes">
              ${NOTES.map((nm, n) => {
                const sel = r.root === n;
                const bg = sel ? '#c0643a' : inKey(n) ? '#efd9a5' : '#ebe0ca';
                return html`<button class="display" style="background:${bg};color:${sel ? '#fbf3e4' : '#3b2e25'}"
                  aria-pressed=${sel} @pointerdown=${(e: PointerEvent) => { if (!e.button) this.onRoot?.(n); }}
                  @keydown=${(e: KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this.onRoot?.(n); } }}>${nm}</button>`;
              })}
            </div>
            <div class="opts">
              ${([['minor', 'Minor'], ['major', 'Major'], ['any', 'Any']] as const).map(([k, label]) => {
                const on = k === 'any' ? r.root < 0 : r.root >= 0 && r.scale === k;
                return html`<button style=${chip(on)} aria-pressed=${on} @click=${() => this.onScale?.(k)}>${label}</button>`;
              })}
            </div>

            <span class="caps sub">PADS</span>
            <div class="opts counts">
              ${PAD_COUNTS.map(n => {
                const on = r.count === n;
                const ink = on ? '#f3ead7' : '#3b2e25';
                return html`<button style=${chip(on)} title="${n} pads" aria-pressed=${on} @click=${() => this.onCount?.(n)}>
                  <span class="cells">${Array.from({ length: n }, () => html`<i style="background:${ink}"></i>`)}</span>
                  <span class="display n">${n}</span>
                </button>`;
              })}
            </div>

            <span class="caps sub">LAYOUT</span>
            <div class="opts two">
              <button style=${chip(!layoutOn)} aria-pressed=${!layoutOn} @click=${() => this.onLayout?.(false)}>From mix</button>
              <button style=${chip(layoutOn)} aria-pressed=${layoutOn} title="16 pads: drums down the right, ghosts beside them, tones on the left"
                @click=${() => this.onLayout?.(true)}>SP-404 drums</button>
            </div>
          </div>

          <div class="right">
            <div class="row">
              <span class="caps">MIX OF SOUNDS</span>
              <span class="hint">${layoutOn ? `set by ${this.layoutName}` : 'pads each'}</span>
            </div>
            <div class="mix">
              ${CATS.map(c => html`
                <div class="col" title=${c}>
                  <span class="display" style="opacity:${counts[c] ? 1 : 0.35}">${counts[c]}</span>
                  <div class="blocks">
                    ${[0, 1, 2].map(i => {
                      const lit = layoutOn ? i < Math.min(3, counts[c]) : i < r.weights[c];
                      return html`<button ?disabled=${layoutOn} aria-label="${c} weight ${i + 1}"
                        style="background:${lit ? CAT_COLOR[c] : '#e0d3bb'};opacity:${layoutOn ? 0.55 : 1}"
                        @click=${() => this.onWeight?.(c, r.weights[c] === i + 1 ? i : i + 1)}></button>`;
                    })}
                  </div>
                  <span>${CAT_SHORT[c]}</span>
                </div>
              `)}
            </div>
            <span class="note">Tinted notes are in key. In-key samples are picked first; kick and melodic pads get repitched to fit.</span>
          </div>
        </div>
      </div>
    `;
  }
}
