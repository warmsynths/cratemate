import { LitElement, html, css } from 'lit';
import { customElement, property, state, query } from 'lit/decorators.js';
import type { PadCount, PadSlot, SliderMode } from '../types/index.ts';
import type { LcdScreen } from './mpc-lcd.ts';
import { padDisplayNumber } from '../services/layouts.ts';

export interface SliderModeConfig {
  k: SliderMode;
  lbl: string;
  unit: string;
  min: number;
  max: number;
  def: number;
  step: number;
}

export const SLIDER_MODES: SliderModeConfig[] = [
  { k: 'PITCH', lbl: 'PITCH', unit: 'ST', min: -12, max: 12, def: 0, step: 1 },
  { k: 'FILTER', lbl: 'CUTOFF', unit: 'kHz', min: 1, max: 20, def: 20, step: 1 },
  { k: 'DECAY', lbl: 'DECAY', unit: 's', min: 1, max: 20, def: 10, step: 1 },
  { k: 'LEVEL', lbl: 'LEVEL', unit: '%', min: 0, max: 20, def: 16, step: 1 },
  { k: 'DRIVE', lbl: 'DRIVE', unit: '', min: 0, max: 10, def: 0, step: 1 },
  { k: 'START', lbl: 'START', unit: 'ms', min: 0, max: 20, def: 0, step: 1 },
  { k: 'REVERSE', lbl: 'REV', unit: '', min: 0, max: 1, def: 0, step: 1 }
];

@customElement('mpc-controls')
export class MpcControls extends LitElement {
  @property({ type: Number }) padCount: PadCount = 8;
  @property({ type: Boolean }) spNumbered = false;
  @property({ type: String }) currentScreen: LcdScreen = 'MAIN';
  @property({ type: Number }) volume = 0.9;
  @property({ type: Boolean }) canUndo = false;
  @property({ type: Boolean }) isGenerating = false;
  @property({ type: Array }) presetNames: string[] = [];
  @property({ type: Number }) activePresetIndex = 0;
  @property({ type: String }) sliderMode: SliderMode = 'PITCH';
  @property({ type: Object }) activePadSlot?: PadSlot;
  @property({ type: Number }) activePadIndex: number | null = null;
  @property({ type: Boolean }) stickers = false;
  @property({ type: String }) wheelField = 'PRESET';

  @state() private mobileCtrlOpen = false;
  @state() private varDrag = false;
  @state() private wheelTurn = 0;

  @query('.fader-area') private faderAreaEl?: HTMLElement;

  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      gap: clamp(4px, 1vh, 14px);
      width: 100%;
      user-select: none;
      font-family: 'Barlow', system-ui, sans-serif;
    }

    button { font: inherit; outline: none; padding: 0; }
    button:active { transform: translateY(1px); }

    .lamp {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      display: block;
      flex: 0 0 auto;
      background: radial-gradient(circle at 40% 35%, #6c6f67, #4a4d46);
    }
    .lamp.red { background: radial-gradient(circle at 40% 35%, #ff9b7a, #d03b1c 62%, #7d2410); }
    .lamp.green { background: radial-gradient(circle at 40% 35%, #c8ffb0, #4fae2c 62%, #1e5c12); }
    .lamp.sm { width: 5px; height: 5px; }

    .badge {
      background: #b7c3c7;
      border: 1px solid #8b989c;
      font-family: 'Barlow Condensed', sans-serif;
      font-weight: 700;
      color: #22241f;
      white-space: nowrap;
    }

    /* COLLAPSIBLE CONTROLS HINGE (MOBILE ONLY, < 560px) */
    .hinge-bar {
      display: none;
      align-items: center;
      gap: 8px;
      padding: 6px 8px;
      border: 1px solid #a5a69f;
      border-radius: 4px;
      background: linear-gradient(#e4e5df, #d2d3cd);
      box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.7);
    }
    .hinge-toggle-btn {
      flex: 1 1 auto;
      min-width: 0;
      height: 44px;
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 0 10px;
      border: 1px solid #6f6a55;
      border-radius: 3px;
      cursor: pointer;
      background: linear-gradient(#f2ebd0, #ddd3ad);
      box-shadow: 0 2px 3px rgba(0, 0, 0, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.55);
    }
    .hinge-title {
      font-family: 'Barlow Condensed', sans-serif;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 1.6px;
      color: #2f302a;
      white-space: nowrap;
    }
    .hinge-groove {
      flex: 1 1 auto;
      height: 10px;
      background: repeating-linear-gradient(90deg, rgba(60, 61, 53, 0.35) 0 1px, transparent 1px 4px);
      display: block;
    }
    .hinge-state-tag {
      font-family: 'Barlow Condensed', sans-serif;
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 1.2px;
      color: #3c3d35;
      white-space: nowrap;
    }
    .hinge-mini-btn {
      flex: 0 0 auto;
      height: 44px;
      border-radius: 3px;
      cursor: pointer;
      font-family: 'Barlow Condensed', sans-serif;
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 1.2px;
    }
    .hinge-mini-btn.red {
      width: 64px;
      border: 1px solid #79241c;
      background: linear-gradient(#cf4436, #a92e23);
      color: #f6e9e2;
      box-shadow: 0 2px 3px rgba(0, 0, 0, 0.32), inset 0 1px 0 rgba(255, 255, 255, 0.28);
    }
    .hinge-mini-btn.bone {
      width: 48px;
      border: 1px solid #6f6a55;
      color: #25261f;
      box-shadow: 0 2px 3px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.6);
    }

    @media (max-width: 559px) {
      :host .hinge-bar { display: flex; }
      :host .controls-deck { display: none; }
      :host .controls-deck.mobile-open { display: flex; }
    }

    /* MAIN CONTROLS DECK */
    .controls-deck {
      display: flex;
      gap: 12px;
      align-items: stretch;
    }

    /* SLIDER PLATE */
    .fader-column {
      position: relative;
      flex: 0 0 auto;
      width: 96px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: clamp(4px, 0.7vh, 7px);
      padding: clamp(5px, 0.9vh, 9px) 6px clamp(6px, 1.2vh, 12px);
      border: 1px solid #a5a69f;
      border-radius: 4px;
      background: linear-gradient(#e4e5df, #d2d3cd);
      box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.7), 0 1px 3px rgba(0, 0, 0, 0.16);
      box-sizing: border-box;
    }
    .fader-plate-sticker {
      position: absolute;
      left: 9px;
      top: 64%;
      z-index: 6;
      transform: translate(-50%, -50%) rotate(-90deg);
      pointer-events: none;
      background: linear-gradient(#e9eaec, #b9bcc2);
      border: 1px solid #8d9096;
      border-radius: 2px;
      padding: 2px 6px;
      font-family: 'DM Mono', monospace;
      font-size: 7px;
      letter-spacing: 0.8px;
      color: #22241f;
      white-space: nowrap;
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.25);
    }
    .fader-title {
      font-family: 'Barlow Condensed', sans-serif;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 1.5px;
      color: #2f302a;
      text-align: center;
      line-height: 1.1;
    }
    .slider-screen {
      width: 100%;
      box-sizing: border-box;
      background: #9fae6e;
      border: 1px solid #6d7a45;
      border-radius: 2px;
      padding: 4px 3px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 1px;
      font-family: 'IBM Plex Mono', 'DM Mono', monospace;
      color: #1e2414;
    }
    .slider-readout {
      font-size: 11px;
      font-weight: 600;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 100%;
    }
    .slider-target {
      font-size: 8px;
      letter-spacing: 0.6px;
      white-space: nowrap;
    }
    .mode-cycle-btn {
      width: 56px;
      padding: clamp(5px, 0.9vh, 9px) 0;
      border: 1px solid #6f6a55;
      border-radius: 3px;
      cursor: pointer;
      background: linear-gradient(#f2ebd0, #ddd3ad);
      box-shadow: 0 2px 3px rgba(0, 0, 0, 0.28), inset 0 1px 0 rgba(255, 255, 255, 0.55);
    }
    .mode-cycle-btn:hover { background: linear-gradient(#f9f4e2, #e6dcb8); }
    .mode-badge {
      padding: 1px 7px;
      font-size: 9px;
      letter-spacing: 1.3px;
    }
    .fader-area {
      position: relative;
      flex: 1 1 auto;
      min-height: clamp(70px, 14vh, 150px);
      width: 70px;
      touch-action: none;
      display: flex;
      justify-content: center;
      cursor: ns-resize;
    }
    .fader-ticks {
      position: absolute;
      inset: 0;
      padding: 13.5px 0;
      box-sizing: border-box;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      align-items: center;
      pointer-events: none;
    }
    .tick-row {
      width: 100%;
      display: flex;
      justify-content: space-between;
    }
    .tick-line {
      height: 1px;
      background: #4c4d44;
      display: block;
    }
    .fader-track {
      position: relative;
      width: 10px;
      height: 100%;
      border-radius: 5px;
      background: linear-gradient(90deg, #15171a, #31353a 45%, #15171a);
      box-shadow: inset 0 0 3px rgba(0, 0, 0, 0.9);
    }
    .fader-cap {
      position: absolute;
      left: 50%;
      transform: translateX(-50%);
      width: 52px;
      height: 28px;
      border-radius: 4px;
      background: linear-gradient(#fdfdfb, #e3e3dd 52%, #c9cac3);
      border: 1px solid #9d9e97;
      box-shadow: 0 3px 5px rgba(0, 0, 0, 0.38), inset 0 1px 0 #fff;
      display: flex;
      align-items: center;
      justify-content: center;
      pointer-events: none;
      box-sizing: border-box;
    }
    .fader-cap.active { box-shadow: 0 1px 2px rgba(0, 0, 0, 0.5), inset 0 1px 0 #fff; }
    .fader-cap-stripe {
      width: 100%;
      height: 3px;
      background: linear-gradient(#3f7bd6, #1e4f9e);
      display: block;
    }

    /* RIGHT COLUMN */
    .controls-right-col {
      flex: 1 1 auto;
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .rotary-deck {
      position: relative;
      border: 1px solid #a5a69f;
      border-radius: 4px;
      background: linear-gradient(#e6e7e1, #d4d5cf);
      box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.7);
      padding: clamp(6px, 1.2vh, 12px) 10px;
      display: flex;
      flex-direction: column;
      gap: clamp(6px, 1.2vh, 14px);
    }
    .rotary-sticker {
      position: absolute;
      left: -14px;
      top: -16px;
      z-index: 6;
      width: 52px;
      height: 52px;
      border-radius: 50%;
      transform: rotate(-12deg);
      pointer-events: none;
      background: #f2c230;
      border: 2px solid #1e1e1a;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      line-height: 0.95;
      font-family: 'Archivo Black', sans-serif;
      color: #1e1e1a;
      box-sizing: border-box;
    }
    .rotary-top-row {
      display: flex;
      gap: 10px;
      align-items: center;
      justify-content: space-around;
    }
    .control-pod {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 6px;
    }
    .pod-label {
      font-family: 'Barlow Condensed', sans-serif;
      font-size: 10px;
      font-weight: 600;
      letter-spacing: 1.6px;
      color: #3c3d35;
      white-space: nowrap;
    }
    .pod-badge {
      padding: 2px 8px;
      font-size: 9px;
      letter-spacing: 1.4px;
    }

    .data-wheel {
      position: relative;
      width: clamp(42px, 9vh, 104px);
      height: clamp(42px, 9vh, 104px);
      border-radius: 50%;
      cursor: grab;
      touch-action: none;
      background: radial-gradient(circle at 42% 34%, #4b4f55, #1d2024 62%, #101214);
      border: 1px solid #0c0e10;
      box-shadow: 0 5px 11px rgba(0, 0, 0, 0.38), inset 0 2px 3px rgba(255, 255, 255, 0.14);
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .data-wheel:active { cursor: grabbing; }
    .wheel-inner-recess {
      width: 62%;
      height: 62%;
      border-radius: 50%;
      background: radial-gradient(circle at 40% 32%, #3a3e44, #16181b);
      box-shadow: inset 0 2px 6px rgba(0, 0, 0, 0.7);
      display: block;
    }
    .wheel-dimple-wrap {
      position: absolute;
      inset: 0;
      display: flex;
      justify-content: center;
      pointer-events: none;
    }
    .wheel-dimple {
      width: 15px;
      height: 15px;
      margin-top: 8px;
      border-radius: 50%;
      background: radial-gradient(circle at 50% 78%, #41464c, #1a1d21 70%, #0e1013);
      box-shadow: inset 0 3px 5px rgba(0, 0, 0, 0.85), inset 0 -2px 2px rgba(255, 255, 255, 0.14), 0 1px 0 rgba(255, 255, 255, 0.12);
      display: block;
    }

    .volume-pot {
      position: relative;
      width: clamp(40px, 7vh, 56px);
      height: clamp(40px, 7vh, 56px);
      border-radius: 50%;
      cursor: ns-resize;
      touch-action: none;
      background: radial-gradient(circle at 40% 30%, #f3efe2, #d3d4ce);
      border: 1px solid #7a7d74;
      box-shadow: 0 3px 5px rgba(0, 0, 0, 0.28), inset 0 1px 0 rgba(255, 255, 255, 0.65);
      display: flex;
      justify-content: center;
    }
    .pot-marker-wrap {
      position: absolute;
      inset: 0;
      display: flex;
      justify-content: center;
      pointer-events: none;
    }
    .pot-marker-line {
      width: 3px;
      height: 40%;
      margin-top: 4px;
      background: #22241f;
      border-radius: 2px;
      display: block;
    }
    .pot-readout {
      display: flex;
      gap: 12px;
      font-family: 'Barlow Condensed', sans-serif;
      font-size: 8px;
      letter-spacing: 1px;
      color: #4c4d44;
    }

    /* TRANSPORT KEYS */
    .transport-pod-group {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 9px;
      align-items: start;
      border-top: 1px solid #b9bab3;
      padding-top: clamp(6px, 1.2vh, 12px);
    }
    .transport-pod {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 5px;
    }
    .lamp-label-pair {
      display: flex;
      align-items: center;
      gap: 5px;
    }
    .key-label {
      font-family: 'Barlow Condensed', sans-serif;
      font-size: 9px;
      font-weight: 600;
      letter-spacing: 1.2px;
      color: #3c3d35;
      white-space: nowrap;
    }
    .key-label.wide { letter-spacing: 1.4px; }
    .key-badge {
      padding: 1px 6px;
      font-size: 8px;
      letter-spacing: 1.1px;
    }
    .transport-btn {
      width: 100%;
      height: clamp(22px, 4.4vh, 38px);
      border-radius: 3px;
      cursor: pointer;
    }
    .new-kit-btn {
      border: 1px solid #79241c;
      background: linear-gradient(#cf4436, #a92e23);
      box-shadow: 0 2px 3px rgba(0, 0, 0, 0.32), inset 0 1px 0 rgba(255, 255, 255, 0.28);
    }
    .new-kit-btn:hover { background: linear-gradient(#dd5344, #bb3a2d); }
    .undo-btn {
      border: 1px solid #6f6a55;
      box-shadow: 0 2px 3px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.6);
    }
    .bone-on { background: linear-gradient(#f0e9ca, #ddd3ad); }
    .bone-off { background: linear-gradient(#d8d9d3, #c6c7c0); opacity: 0.55; }
    .undo-btn.bone-on:hover { background: linear-gradient(#f9f4e2, #e6dcb8); }
    .setup-disk-btn {
      border: 1px solid #8b5a12;
      background: linear-gradient(#f79420, #e07a0c);
      box-shadow: 0 2px 3px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.45);
    }
    .setup-disk-btn:hover { background: linear-gradient(#ffa63a, #ee8a14); }

    /* PAD COUNT & SCREEN PANEL */
    .selector-bar {
      background: #c3d1cf;
      border: 1px solid #9fb0ae;
      border-radius: 4px;
      padding: clamp(5px, 1vh, 10px) 11px clamp(6px, 1.2vh, 12px);
      display: flex;
      flex-direction: column;
      gap: clamp(4px, 1vh, 10px);
    }
    .selector-title {
      text-align: center;
      font-family: 'Barlow Condensed', sans-serif;
      font-size: 9px;
      font-weight: 700;
      letter-spacing: 2.2px;
      color: #3c4a48;
    }
    .selector-rule {
      height: 1px;
      background: rgba(60, 74, 72, 0.28);
      display: block;
    }
    .selector-tabs {
      display: flex;
      gap: 8px;
    }
    .tab-item {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;
    }
    .tab-lamp-pair {
      display: flex;
      align-items: center;
      gap: 4px;
    }
    .tab-item-title {
      font-family: 'Barlow Condensed', sans-serif;
      font-size: 10px;
      font-weight: 700;
      color: #3c4a48;
    }
    .tab-button {
      width: 100%;
      height: clamp(14px, 2.6vh, 24px);
      border: 1px solid #6f6a55;
      border-radius: 2px;
      background: linear-gradient(#f0e9ca, #ddd3ad);
      cursor: pointer;
      box-shadow: 0 2px 2px rgba(0, 0, 0, 0.26), inset 0 1px 0 rgba(255, 255, 255, 0.55);
    }
    .tab-button.active {
      background: linear-gradient(#4276c6, #2c5aa6);
      border-color: #24497f;
    }
    .screen-tab-button {
      width: 100%;
      height: clamp(14px, 2.6vh, 24px);
      border: 1px solid #1f3d7a;
      border-radius: 2px;
      cursor: pointer;
      background: linear-gradient(#3f7bd6, #1e4f9e);
      box-shadow: 0 2px 2px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.35);
    }
    .screen-tab-button.active { background: linear-gradient(#5390e6, #2a5cae); }
    .screen-name {
      max-width: 100%;
      padding: 1px 3px;
      font-size: 8px;
      letter-spacing: 0.6px;
      color: #25261f;
      text-align: center;
      line-height: 1.1;
      white-space: normal;
    }
  `;

  private cycleSliderMode() {
    const idx = SLIDER_MODES.findIndex(m => m.k === this.sliderMode);
    const next = SLIDER_MODES[(idx + 1) % SLIDER_MODES.length];
    this.sliderMode = next.k;
    this.dispatchEvent(new CustomEvent('slider-mode-change', {
      detail: { mode: next.k },
      bubbles: true,
      composed: true
    }));
  }

  private getSliderConfig(): SliderModeConfig {
    return SLIDER_MODES.find(m => m.k === this.sliderMode) || SLIDER_MODES[0];
  }

  private getActivePadValue(): number {
    const fx = this.activePadSlot?.fx;
    const cfg = this.getSliderConfig();
    if (!fx) return cfg.def;
    switch (this.sliderMode) {
      case 'PITCH': return fx.pitch != null ? fx.pitch : cfg.def;
      case 'FILTER': return fx.filter != null ? fx.filter : cfg.def;
      case 'DECAY': return fx.decay != null ? fx.decay : cfg.def;
      case 'LEVEL': return fx.level != null ? fx.level : cfg.def;
      case 'DRIVE': return fx.drive != null ? fx.drive : cfg.def;
      case 'START': return fx.start != null ? fx.start : cfg.def;
      case 'REVERSE': return fx.reverse ? 1 : 0;
      default: return cfg.def;
    }
  }

  private getSliderReadout(): string {
    const cfg = this.getSliderConfig();
    const val = this.getActivePadValue();
    switch (this.sliderMode) {
      case 'PITCH': return `${val > 0 ? '+' : ''}${val}${cfg.unit}`;
      case 'FILTER': {
        const hz = Math.round(200 * Math.pow(20000 / 200, (val - 1) / 19));
        return hz >= 1000 ? `${(hz / 1000).toFixed(1)}kHz` : `${hz}Hz`;
      }
      case 'DECAY': {
        const factor = Math.pow(2, (val - 10) / 5);
        return `${factor.toFixed(2)}x`;
      }
      case 'LEVEL': return `${Math.round((val / 16) * 100)}%`;
      case 'DRIVE': return val === 0 ? 'CLEAN' : `DRV ${val}`;
      case 'START': return `${val * 10}ms`;
      case 'REVERSE': return val ? 'REVERSED' : 'FORWARD';
      default: return `${val}`;
    }
  }

  private getSliderNormalized(): number {
    const cfg = this.getSliderConfig();
    const val = this.getActivePadValue();
    const range = cfg.max - cfg.min;
    if (range <= 0) return 0.5;
    return Math.max(0, Math.min(1, (val - cfg.min) / range));
  }

  private onFaderPointerDown(e: PointerEvent) {
    e.preventDefault();
    this.varDrag = true;
    this.applyFaderPosition(e);

    const onPointerMove = (ev: PointerEvent) => {
      this.applyFaderPosition(ev);
    };

    const onPointerUp = () => {
      this.varDrag = false;
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  }

  private applyFaderPosition(e: PointerEvent) {
    if (!this.faderAreaEl) return;
    const r = this.faderAreaEl.getBoundingClientRect();
    const raw = Math.max(0, Math.min(1, 1 - (e.clientY - r.top) / r.height));
    const cfg = this.getSliderConfig();
    const range = cfg.max - cfg.min;
    const notch = Math.round(cfg.min + raw * range);

    this.dispatchEvent(new CustomEvent('slider-value-change', {
      detail: {
        mode: this.sliderMode,
        value: notch,
        padIndex: this.activePadIndex
      },
      bubbles: true,
      composed: true
    }));
  }

  private onFaderDblClick(e: Event) {
    e.stopPropagation();
    const cfg = this.getSliderConfig();
    this.dispatchEvent(new CustomEvent('slider-value-change', {
      detail: {
        mode: this.sliderMode,
        value: cfg.def,
        padIndex: this.activePadIndex
      },
      bubbles: true,
      composed: true
    }));
  }

  private onWheelPointerDown(e: PointerEvent) {
    e.preventDefault();
    let startY = e.clientY;

    const onPointerMove = (ev: PointerEvent) => {
      const deltaY = startY - ev.clientY;
      startY = ev.clientY;
      this.wheelTurn += deltaY * 3.5;
      const step = deltaY > 0 ? 1 : -1;
      this.dispatchEvent(new CustomEvent('data-wheel-step', {
        detail: { step },
        bubbles: true,
        composed: true
      }));
    };

    const onPointerUp = () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  }

  private onWheelScroll(e: WheelEvent) {
    e.preventDefault();
    const step = e.deltaY < 0 ? 1 : -1;
    this.wheelTurn += step * 18;
    this.dispatchEvent(new CustomEvent('data-wheel-step', {
      detail: { step },
      bubbles: true,
      composed: true
    }));
  }

  private onVolumePointerDown(e: PointerEvent) {
    e.preventDefault();
    let startY = e.clientY;

    const onPointerMove = (ev: PointerEvent) => {
      const delta = (startY - ev.clientY) / 160;
      startY = ev.clientY;
      const newVol = Math.max(0, Math.min(1, this.volume + delta));
      this.dispatchEvent(new CustomEvent('volume-change', {
        detail: { volume: newVol },
        bubbles: true,
        composed: true
      }));
    };

    const onPointerUp = () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  }

  private toggleHinge() {
    this.mobileCtrlOpen = !this.mobileCtrlOpen;
  }

  private selectPadCount(n: PadCount) {
    this.dispatchEvent(new CustomEvent('pad-count-change', {
      detail: { count: n },
      bubbles: true,
      composed: true
    }));
  }

  private selectScreen(screen: LcdScreen) {
    this.dispatchEvent(new CustomEvent('screen-change', {
      detail: { screen },
      bubbles: true,
      composed: true
    }));
  }

  render() {
    const volDeg = Math.round(-140 + this.volume * 280);
    const volPercent = Math.round(this.volume * 100);
    const norm = this.getSliderNormalized();
    const capBottom = `calc(${norm * 100}% - ${norm * 28}px)`;

    const padCounts: PadCount[] = [4, 6, 8, 16];
    const screens: { id: LcdScreen; tag: string; name: string }[] = [
      { id: 'MAIN', tag: '1', name: 'KIT' },
      { id: 'SOURCES', tag: '2', name: 'SOURCES' },
      { id: 'INFO', tag: '3', name: 'PAD INFO' }
    ];

    const targetLabel = this.activePadIndex !== null ? `PAD ${padDisplayNumber(this.activePadIndex, this.spNumbered)}` : 'ALL PADS';

    const emit = (name: string) => this.dispatchEvent(new CustomEvent(name, { bubbles: true, composed: true }));
    const tickCount = 11;
    const undoClass = this.canUndo ? 'bone-on' : 'bone-off';

    return html`
      <!-- COLLAPSIBLE HINGE BAR (MOBILE ONLY) -->
      <div class="hinge-bar">
        <button class="hinge-toggle-btn" @click=${this.toggleHinge}>
          <span class="lamp ${this.mobileCtrlOpen ? 'red' : ''}"></span>
          <span class="hinge-title">CONTROLS</span>
          <span class="hinge-groove"></span>
          <span class="hinge-state-tag">${this.mobileCtrlOpen ? 'CLOSE ▴' : 'OPEN ▾'}</span>
        </button>
        ${!this.mobileCtrlOpen ? html`
          <button class="hinge-mini-btn red" @click=${() => emit('generate-kit')} title="New kit">NEW KIT</button>
          <button class="hinge-mini-btn bone ${undoClass}" @click=${() => emit('undo-kit')} title="Undo">UNDO</button>
        ` : ''}
      </div>

      <!-- MAIN CONTROLS DECK -->
      <div class="controls-deck ${this.mobileCtrlOpen ? 'mobile-open' : ''}">
        <!-- SLIDER PLATE -->
        <div class="fader-column">
          ${this.stickers ? html`<span class="fader-plate-sticker">PROPERTY OF STUDIO 4 · NO 0417</span>` : ''}
          <span class="fader-title">SLIDER</span>
          <span class="slider-screen">
            <span class="slider-readout">${this.getSliderReadout()}</span>
            <span class="slider-target">${targetLabel}</span>
          </span>
          <button class="mode-cycle-btn" @click=${this.cycleSliderMode} title="Cycle slider mode"></button>
          <span class="badge mode-badge">${this.sliderMode}</span>
          <div
            class="fader-area"
            @pointerdown=${this.onFaderPointerDown}
            @dblclick=${this.onFaderDblClick}
            title="Drag to change ${this.sliderMode}, double click to reset"
          >
            <span class="fader-ticks">
              ${Array.from({ length: tickCount }, (_, i) => {
                const major = i % ((tickCount - 1) / 4) === 0;
                const style = `width:${major ? '26px' : '17px'};opacity:${major ? 0.55 : 0.32}`;
                return html`<span class="tick-row"><span class="tick-line" style=${style}></span><span class="tick-line" style=${style}></span></span>`;
              })}
            </span>
            <span class="fader-track">
              <span class="fader-cap ${this.varDrag ? 'active' : ''}" style="bottom: ${capBottom};">
                <span class="fader-cap-stripe"></span>
              </span>
            </span>
          </div>
        </div>

        <!-- ROTARY DECK & BUTTONS -->
        <div class="controls-right-col">
          <div class="rotary-deck">
            ${this.stickers ? html`
              <span class="rotary-sticker">
                <span style="font-size: 11px; letter-spacing: 0.5px;">DIG</span>
                <span style="font-size: 9px; letter-spacing: 0.3px;">DEEPER</span>
              </span>
            ` : ''}

            <div class="rotary-top-row">
              <span class="control-pod">
                <span class="pod-label">DATA</span>
                <span
                  class="data-wheel"
                  @pointerdown=${this.onWheelPointerDown}
                  @wheel=${this.onWheelScroll}
                  title="Drag or scroll to adjust ${this.wheelField}"
                >
                  <span class="wheel-inner-recess"></span>
                  <span class="wheel-dimple-wrap" style="transform: rotate(${this.wheelTurn}deg);">
                    <span class="wheel-dimple"></span>
                  </span>
                </span>
                <span class="badge pod-badge">${this.wheelField}</span>
              </span>

              <span class="control-pod">
                <span class="pod-label">MAIN VOLUME</span>
                <span class="volume-pot" @pointerdown=${this.onVolumePointerDown} title="Drag up/down to adjust volume">
                  <span class="pot-marker-wrap" style="transform: rotate(${volDeg}deg);">
                    <span class="pot-marker-line"></span>
                  </span>
                </span>
                <span class="pot-readout"><span>MIN</span><span>${volPercent}</span><span>MAX</span></span>
              </span>
            </div>

            <span class="transport-pod-group">
              <span class="transport-pod">
                <span class="lamp-label-pair">
                  <span class="lamp ${this.canUndo || this.isGenerating ? 'red' : ''}"></span>
                  <span class="key-label">NEW KIT</span>
                </span>
                <button class="transport-btn new-kit-btn" @click=${() => emit('generate-kit')} title="Generate new kit (Space)"></button>
                <span class="key-label wide">SPACE</span>
              </span>

              <span class="transport-pod">
                <span class="key-label">UNDO</span>
                <button class="transport-btn undo-btn ${undoClass}" @click=${() => emit('undo-kit')} title="Undo (Cmd+Z)"></button>
                <span class="badge key-badge">⌘Z</span>
              </span>

              <span class="transport-pod">
                <span class="key-label">SETUP DISK</span>
                <button class="transport-btn setup-disk-btn" @click=${() => emit('open-setup-disk')} title="Open Setup Disk"></button>
                <span class="key-label wide">OPEN</span>
              </span>
            </span>
          </div>

          <!-- PAD COUNT & SCREEN PANEL -->
          <div class="selector-bar">
            <div class="selector-title">PAD COUNT</div>
            <div class="selector-tabs">
              ${padCounts.map(n => html`
                <span class="tab-item">
                  <span class="tab-lamp-pair">
                    <span class="lamp sm ${this.padCount === n ? 'green' : ''}"></span>
                    <span class="tab-item-title">${n}</span>
                  </span>
                  <button class="tab-button ${this.padCount === n ? 'active' : ''}" @click=${() => this.selectPadCount(n)}></button>
                </span>
              `)}
            </div>
            <span class="selector-rule"></span>
            <div class="selector-title">SCREEN</div>
            <div class="selector-tabs">
              ${screens.map(s => html`
                <span class="tab-item">
                  <span class="tab-lamp-pair">
                    <span class="lamp sm ${this.currentScreen === s.id ? 'green' : ''}"></span>
                    <span class="tab-item-title">${s.tag}</span>
                  </span>
                  <button class="screen-tab-button ${this.currentScreen === s.id ? 'active' : ''}" @click=${() => this.selectScreen(s.id)}></button>
                  <span class="badge screen-name">${s.name}</span>
                </span>
              `)}
            </div>
          </div>
        </div>
      </div>
    `;
  }
}
