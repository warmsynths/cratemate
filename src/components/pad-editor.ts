import { LitElement, html, css, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { baseStyles, KNOB_C } from '../ui/theme.ts';
import type { PadFx } from '../types/index.ts';

type FxKey = 'pitch' | 'decay' | 'filter' | 'start' | 'drive' | 'level';

interface ParamDef {
  k: FxKey;
  name: string;
  min: number;
  max: number;
  step: number;
  fmt: (v: number) => string;
}

const cutoffHz = (v: number) => 200 * Math.pow(20000 / 200, (v - 1) / 19);

/** The six rulers, in the audio engine's own PadFx units. */
export const PARAMS: ParamDef[] = [
  { k: 'pitch', name: 'Pitch', min: -12, max: 12, step: 1, fmt: v => (v > 0 ? '+' : '') + v + ' st' },
  { k: 'decay', name: 'Decay', min: 1, max: 15, step: 0.1, fmt: v => Math.round(Math.pow(2, (v - 10) / 5) * 100) + '%' },
  {
    k: 'filter', name: 'Filter', min: 1, max: 20, step: 0.05,
    fmt: v => { const c = cutoffHz(v); return c >= 1000 ? (c / 1000).toFixed(1) + 'k' : Math.round(c) + ' Hz'; }
  },
  { k: 'start', name: 'Start', min: 0, max: 15, step: 0.1, fmt: v => Math.round(v * 10) + ' ms' },
  { k: 'drive', name: 'Drive', min: 0, max: 10, step: 0.1, fmt: v => Math.round(v * 10) + '%' },
  { k: 'level', name: 'Level', min: 0, max: 20, step: 0.1, fmt: v => v < 0.05 ? '-inf' : (20 * Math.log10(v / 16)).toFixed(1) + ' dB' }
];

export const FX_DEFAULTS: Required<Omit<PadFx, 'reverse'>> = { pitch: 0, decay: 10, filter: 20, start: 0, drive: 0, level: 16 };

export interface EditorPad {
  n: string;
  cat: string;
  color: string;
  name: string;
  len: string;
  locked: boolean;
  fx: PadFx;
  defaults: typeof FX_DEFAULTS;
  wave: string;
  startPct: string;
}

export interface EditorMeter {
  device: string;
  label: string;
  pct: string;
  ink: string;
  bar: string;
}

@customElement('pad-editor')
export class PadEditor extends LitElement {
  @property({ type: Object }) pad?: EditorPad;
  @property({ type: Boolean, reflect: true }) mobile = false;
  /** Short desktop windows put the rulers in two columns with coarser ticks. */
  @property({ type: Boolean }) twoCol = false;
  @property({ type: Object }) meter?: EditorMeter;
  @property() writeLabel = '';
  @property() writeBg = '#b85f36';

  @property({ attribute: false }) onPlay?: () => void;
  @property({ attribute: false }) onFx?: (k: FxKey | 'reverse', v: number | boolean) => void;
  @property({ attribute: false }) onCommit?: () => void;
  @property({ attribute: false }) onSwap?: () => void;
  @property({ attribute: false }) onLock?: () => void;
  @property({ attribute: false }) onWrite?: () => void;
  @property({ attribute: false }) onClose?: () => void;
  @property({ attribute: false }) onPrev?: () => void;
  @property({ attribute: false }) onNext?: () => void;

  static styles = [baseStyles, css`
    :host {
      display: flex;
      flex-direction: column;
      gap: clamp(8px, 2vh, 18px);
      padding: clamp(12px, 3vh, 24px) clamp(14px, 1.6vw, 24px);
      background: #ebe0ca;
      min-height: 0;
      overflow: hidden;
    }
    :host([mobile]) {
      position: absolute;
      inset: 0;
      z-index: 6;
      padding: 18px 14px 24px;
      overflow-y: auto;
    }
    .topbar { flex: 0 0 auto; display: flex; align-items: center; gap: 8px; margin: -6px 0 0 -8px; }
    .back { min-height: 44px; padding: 0 12px 0 8px; border: none; background: transparent; font-size: 16px; font-weight: 700; cursor: pointer; }
    .nav { width: 44px; height: 44px; border: none; border-radius: 13px; background: #e0d3bb; font-size: 20px; font-weight: 700; cursor: pointer; }
    .head { display: flex; align-items: center; gap: 12px; }
    .play {
      flex: 0 0 auto; width: clamp(36px, 5.5vh, 44px); height: clamp(36px, 5.5vh, 44px);
      border: none; border-radius: 14px; display: flex; align-items: center; justify-content: center;
      cursor: pointer; font-size: 14px; color: #2e241c;
    }
    .meta { display: flex; flex-direction: column; min-width: 0; }
    .meta small { font-size: 13px; color: #8a7764; }
    .meta strong { font-size: 19px; font-weight: 800; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .wave { flex: 0 0 auto; height: clamp(36px, 8vh, 80px); border-radius: 12px; background: #f6efdf; position: relative; overflow: hidden; }
    .wave svg { position: absolute; left: 10px; top: 8px; width: calc(100% - 20px); height: calc(100% - 16px); }
    .shade { position: absolute; left: 0; top: 0; bottom: 0; background: rgba(241, 232, 214, 0.7); }
    .marker { position: absolute; top: 0; bottom: 0; width: 2px; background: #b85f36; }
    .rulers {
      flex: 0 1 auto; min-height: 0; display: grid; grid-template-columns: minmax(0, 1fr);
      gap: clamp(4px, 1.4vh, 14px) 14px;
    }
    .rulers.two { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    :host([mobile]) .rulers { flex: 0 0 auto; gap: 14px; }
    .param { display: flex; flex-direction: column; gap: 2px; min-width: 0; cursor: ew-resize; touch-action: none; user-select: none; }
    .param-top { display: flex; justify-content: space-between; align-items: baseline; gap: 4px; pointer-events: none; }
    .param-top span:first-child { font-size: 12px; font-weight: 800; letter-spacing: 1px; text-transform: uppercase; }
    .param-top span:last-child { font-size: 15px; white-space: nowrap; }
    .ruler { position: relative; height: clamp(20px, 3.6vh, 30px); pointer-events: none; }
    :host([mobile]) .ruler { height: 34px; }
    .ticks { position: absolute; left: 0; right: 0; bottom: 0; height: calc(100% - 9px); display: flex; justify-content: space-between; align-items: flex-end; }
    .ticks i { width: 2px; border-radius: 1px; }
    .pointer { position: absolute; top: 0; width: 14px; height: 9px; margin-left: -7px; clip-path: polygon(0 0, 100% 0, 50% 100%); }
    .actions { flex: 0 0 auto; display: flex; flex-wrap: wrap; gap: 8px; }
    .actions button {
      flex: 1 1 auto; min-width: 0; min-height: 40px; padding: 0 10px; white-space: nowrap;
      border: 1.5px solid #cdbb9c; border-radius: 12px; background: transparent; font-size: 14px; font-weight: 600; cursor: pointer;
    }
    .actions button.on { border-color: #3b2e25; background: #3b2e25; color: #f3ead7; }
    .spacer { flex: 1 1 auto; }
    .meter { display: flex; flex-direction: column; gap: 6px; }
    .meter-row { display: flex; justify-content: space-between; gap: 8px; font-size: 13px; color: #6b5b4c; }
    .meter-track { height: 8px; border-radius: 999px; background: #dacbb0; overflow: hidden; }
    .meter-track div { height: 100%; border-radius: 999px; }
    .write {
      flex: 0 0 auto; min-height: 48px; padding: clamp(10px, 2vh, 16px); border: none; border-radius: 16px;
      color: #fbf3e4; font-size: 17px; font-weight: 800; cursor: pointer;
    }
  `];

  private drag(e: PointerEvent, P: ParamDef) {
    if (e.button) return;
    const el = e.currentTarget as HTMLElement;
    el.setPointerCapture?.(e.pointerId);
    const upd = (ev: PointerEvent) => {
      const r = el.getBoundingClientRect();
      const t = Math.max(0, Math.min(1, (ev.clientX - r.left) / r.width));
      const raw = P.min + t * (P.max - P.min);
      const q = Math.round(raw / P.step) * P.step;
      this.onFx?.(P.k, +q.toFixed(3));
    };
    upd(e);
    const up = () => {
      el.removeEventListener('pointermove', upd);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', up);
      this.onCommit?.();
    };
    el.addEventListener('pointermove', upd);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
  }

  private keyStep(e: KeyboardEvent, P: ParamDef, v: number) {
    const dir = e.key === 'ArrowRight' || e.key === 'ArrowUp' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowDown' ? -1 : 0;
    if (!dir) return;
    e.preventDefault();
    e.stopPropagation();
    const step = P.k === 'pitch' ? 1 : (P.max - P.min) / 50;
    const next = Math.max(P.min, Math.min(P.max, v + dir * step));
    this.onFx?.(P.k, +(Math.round(next / P.step) * P.step).toFixed(3));
    this.onCommit?.();
  }

  private renderParam(P: ParamDef, pi: number, pad: EditorPad) {
    const v = pad.fx[P.k] ?? pad.defaults[P.k];
    const t = (v - P.min) / (P.max - P.min);
    const nT = this.twoCol ? 13 : 25;
    const color = KNOB_C[pi];
    const ticks = Array.from({ length: nT }, (_, j) => {
      const x = j / (nT - 1);
      const on = P.k === 'pitch'
        ? (t >= 0.5 ? x >= 0.5 && x <= t + 1e-6 : x <= 0.5 && x >= t - 1e-6)
        : x <= t + 1e-6;
      const major = j % (nT === 25 ? 6 : 3) === 0;
      const mid = nT === 25 && j % 3 === 0;
      return html`<i style="height:${major ? '100%' : mid ? '66%' : '40%'};background:${on ? color : '#c9b898'}"></i>`;
    });
    return html`
      <div class="param" role="slider" tabindex="0"
        aria-label=${P.name} aria-valuemin=${P.min} aria-valuemax=${P.max} aria-valuenow=${v} aria-valuetext=${P.fmt(v)}
        title="Drag or tap to set, double-click to reset"
        @pointerdown=${(e: PointerEvent) => this.drag(e, P)}
        @dblclick=${() => { this.onFx?.(P.k, pad.defaults[P.k]); this.onCommit?.(); }}
        @keydown=${(e: KeyboardEvent) => this.keyStep(e, P, v)}>
        <div class="param-top"><span>${P.name}</span><span class="display">${P.fmt(v)}</span></div>
        <div class="ruler">
          <div class="ticks">${ticks}</div>
          <div class="pointer" style="left:${(t * 100).toFixed(1)}%;background:${color}"></div>
        </div>
      </div>
    `;
  }

  render() {
    const pad = this.pad;
    if (!pad) return nothing;
    const rev = !!pad.fx.reverse;
    return html`
      ${this.mobile ? html`
        <div class="topbar">
          <button class="back" @click=${() => this.onClose?.()}>‹ All pads</button>
          <div class="spacer"></div>
          <button class="nav" aria-label="Previous pad" @click=${() => this.onPrev?.()}>‹</button>
          <button class="nav" aria-label="Next pad" @click=${() => this.onNext?.()}>›</button>
        </div>
      ` : nothing}
      <div class="head">
        <button class="play" title="Play (space)" aria-label="Play pad" style="background:${pad.color}" @click=${() => this.onPlay?.()}>▶</button>
        <div class="meta">
          <small>Pad ${pad.n} · ${pad.cat} · ${pad.len}</small>
          <strong>${pad.name}</strong>
        </div>
      </div>
      <div class="wave">
        <svg viewBox="0 0 100 40" preserveAspectRatio="none" aria-hidden="true">
          <path d=${pad.wave} fill="none" stroke="#3b2e25" stroke-width="3.5" stroke-linecap="round" vector-effect="non-scaling-stroke"></path>
        </svg>
        <div class="shade" style="width:${pad.startPct}"></div>
        <div class="marker" style="left:${pad.startPct}"></div>
      </div>
      <div class="rulers ${this.twoCol && !this.mobile ? 'two' : ''}">
        ${PARAMS.map((P, i) => this.renderParam(P, i, pad))}
      </div>
      <div class="actions">
        <button class=${rev ? 'on' : ''} aria-pressed=${rev} @click=${() => { this.onFx?.('reverse', !rev); this.onCommit?.(); }}>Reverse</button>
        <button @click=${() => this.onSwap?.()}>Swap sample</button>
        <button class=${pad.locked ? 'on' : ''} aria-pressed=${pad.locked} @click=${() => this.onLock?.()}>${pad.locked ? 'Locked' : 'Lock'}</button>
      </div>
      ${!this.mobile && this.meter ? html`
        <div class="spacer"></div>
        <div class="meter">
          <div class="meter-row"><span>${this.meter.device}</span><span style="color:${this.meter.ink}">${this.meter.label}</span></div>
          <div class="meter-track"><div style="width:${this.meter.pct};background:${this.meter.bar}"></div></div>
        </div>
        <button class="write" style="background:${this.writeBg}" @click=${() => this.onWrite?.()}>${this.writeLabel}</button>
      ` : nothing}
    `;
  }
}
