import { LitElement, html, css, type PropertyValues } from 'lit';
import { customElement, property, state, query } from 'lit/decorators.js';
import type { PadCount } from '../types/index.ts';
import type { LcdScreen } from './mpc-lcd.ts';

@customElement('mpc-controls')
export class MpcControls extends LitElement {
  @property({ type: Number }) padCount: PadCount = 8;
  @property({ type: String }) currentScreen: LcdScreen = 'MAIN';
  @property({ type: Number }) volume = 0.9;
  @property({ type: Boolean }) canUndo = false;
  @property({ type: Boolean }) isGenerating = false;
  @property({ type: Array }) presetNames: string[] = [];
  @property({ type: Number }) activePresetIndex = 0;

  @state() private varArmed = true;
  @state() private varDrag = false;
  @state() private varAmt = 0;
  @state() private wheelTurn = 0;

  @query('.fader-track') private faderTrackEl?: HTMLElement;

  static styles = css`
    :host {
      display: block;
      width: 100%;
      user-select: none;
      font-family: 'Barlow', system-ui, sans-serif;
    }

    .controls-deck {
      display: flex;
      gap: 12px;
      align-items: stretch;
      flex-wrap: nowrap;
      width: 100%;
      box-sizing: border-box;
    }

    /* NOTE VARIATION FADER COLUMN */
    .fader-column {
      flex: 0 0 112px;
      width: 112px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 7px;
      padding: 9px 8px 12px;
      border: 1px solid #a5a69f;
      border-radius: 4px;
      background: linear-gradient(#e4e5df, #d2d3cd);
      box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.7), 0 1px 3px rgba(0, 0, 0, 0.16);
      box-sizing: border-box;
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

    .fader-armed-label {
      font-family: 'Barlow Condensed', sans-serif;
      font-size: 9px;
      font-weight: 600;
      letter-spacing: 1.5px;
      color: #4c4d44;
    }

    .armed-led {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      display: block;
      background: radial-gradient(circle at 40% 35%, #6c6f67, #4a4d46);
      box-shadow: inset 0 1px 1px rgba(255, 255, 255, 0.25);
      transition: all 120ms;
    }

    .armed-led.lit {
      background: radial-gradient(circle at 40% 35%, #ff9b7a, #d03b1c 62%, #7d2410);
      box-shadow: 0 0 6px rgba(220, 80, 40, 0.8), inset 0 1px 1px rgba(255, 255, 255, 0.4);
    }

    .arm-btn {
      width: 52px;
      padding: 6px 0;
      border: 1px solid #6f6a55;
      border-radius: 3px;
      cursor: pointer;
      background: linear-gradient(#f2ebd0, #ddd3ad);
      box-shadow: 0 2px 3px rgba(0, 0, 0, 0.28), inset 0 1px 0 rgba(255, 255, 255, 0.55);
      transition: all 80ms;
      outline: none;
    }

    .arm-btn.active {
      background: linear-gradient(#cf4436, #a92e23);
      border-color: #79241c;
    }

    .arm-btn:active {
      transform: translateY(1px);
    }

    .arm-badge {
      background: #b7c3c7;
      border: 1px solid #8b989c;
      padding: 1px 7px;
      font-family: 'Barlow Condensed', sans-serif;
      font-size: 9px;
      font-weight: 700;
      letter-spacing: 1.3px;
      color: #22241f;
      border-radius: 2px;
    }

    .fader-area {
      position: relative;
      flex: 1 1 auto;
      min-height: 140px;
      width: 70px;
      touch-action: none;
      display: flex;
      justify-content: center;
      cursor: ns-resize;
    }

    .fader-ticks {
      position: absolute;
      inset: 0;
      padding: 14px 0;
      box-sizing: border-box;
      display: flex;
      flex-direction: column-reverse;
      justify-content: space-between;
      align-items: center;
      pointer-events: none;
    }

    .tick-row {
      width: 100%;
      display: flex;
      justify-content: space-between;
      align-items: center;
      height: 1px;
    }

    .tick-line {
      height: 1px;
      background: #4c4d44;
      display: block;
      transition: all 120ms ease-out;
    }

    .tick-line.active {
      background: #cf4436;
      box-shadow: 0 0 5px rgba(207, 68, 54, 0.7);
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
      transition: bottom 60ms ease-out;
    }

    .fader-cap.active {
      box-shadow: 0 4px 8px rgba(0, 0, 0, 0.5), 0 0 4px rgba(63, 123, 214, 0.6);
      filter: brightness(1.05);
    }

    .fader-cap-stripe {
      width: 100%;
      height: 3px;
      background: linear-gradient(#3f7bd6, #1e4f9e);
      display: block;
    }

    /* RIGHT CONTROLS SUB-DECK */
    .controls-right-col {
      flex: 1 1 auto;
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .rotary-deck {
      border: 1px solid #a5a69f;
      border-radius: 4px;
      background: linear-gradient(#e6e7e1, #d4d5cf);
      box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.7);
      padding: clamp(6px, 1vh, 8px) clamp(8px, 1vw, 10px);
      display: flex;
      align-items: center;
      gap: clamp(6px, 0.8vw, 10px);
      flex-wrap: nowrap;
      box-sizing: border-box;
      width: 100%;
    }

    .control-pod {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 2px;
      flex-shrink: 0;
    }

    .pod-label {
      font-family: 'Barlow Condensed', sans-serif;
      font-size: 8.5px;
      font-weight: 600;
      letter-spacing: 1.1px;
      color: #3c3d35;
      white-space: nowrap;
    }

    /* DATA WHEEL */
    .data-wheel {
      position: relative;
      width: clamp(52px, 7vh, 60px);
      height: clamp(52px, 7vh, 60px);
      border-radius: 50%;
      cursor: grab;
      touch-action: none;
      background: radial-gradient(circle at 42% 34%, #4b4f55, #1d2024 62%, #101214);
      border: 1px solid #0c0e10;
      box-shadow: 0 3px 6px rgba(0, 0, 0, 0.38), inset 0 2px 3px rgba(255, 255, 255, 0.14);
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .data-wheel:active {
      cursor: grabbing;
    }

    .wheel-inner-recess {
      width: clamp(32px, 4.4vh, 38px);
      height: clamp(32px, 4.4vh, 38px);
      border-radius: 50%;
      background: radial-gradient(circle at 40% 32%, #3a3e44, #16181b);
      box-shadow: inset 0 2px 5px rgba(0, 0, 0, 0.7);
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
      width: 8px;
      height: 8px;
      margin-top: 3px;
      border-radius: 50%;
      background: radial-gradient(circle at 50% 78%, #41464c, #1a1d21 70%, #0e1013);
      box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.85), inset 0 -1px 1px rgba(255, 255, 255, 0.14), 0 1px 0 rgba(255, 255, 255, 0.12);
      display: block;
    }

    .pod-badge {
      background: #b7c3c7;
      border: 1px solid #8b989c;
      padding: 1px 5px;
      font-family: 'Barlow Condensed', sans-serif;
      font-size: 7.5px;
      font-weight: 700;
      letter-spacing: 1px;
      color: #22241f;
      border-radius: 2px;
      white-space: nowrap;
    }

    /* VOLUME KNOB */
    .volume-pot {
      position: relative;
      width: clamp(34px, 4.5vh, 38px);
      height: clamp(34px, 4.5vh, 38px);
      border-radius: 50%;
      cursor: ns-resize;
      touch-action: none;
      background: radial-gradient(circle at 40% 30%, #f3efe2, #d3d4ce);
      border: 1px solid #7a7d74;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.28), inset 0 1px 0 rgba(255, 255, 255, 0.65);
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
      width: 2.5px;
      height: 13px;
      margin-top: 3px;
      background: #22241f;
      border-radius: 2px;
      display: block;
    }

    .pot-readout {
      display: flex;
      gap: 5px;
      font-family: 'Barlow Condensed', sans-serif;
      font-size: 7.5px;
      letter-spacing: 0.7px;
      color: #4c4d44;
      white-space: nowrap;
    }

    /* BUTTON GROUP (NEW KIT, UNDO, SETUP DISK) */
    .transport-pod-group {
      display: flex;
      gap: clamp(4px, 0.5vw, 6px);
      align-items: flex-start;
      margin-left: auto;
      flex-wrap: nowrap;
      flex-shrink: 0;
    }

    .lamp-label-pair {
      display: flex;
      align-items: center;
      gap: 2px;
    }

    .btn-lamp {
      width: 4px;
      height: 4px;
      border-radius: 50%;
      display: block;
      background: #6c6f67;
    }

    .btn-lamp.active {
      background: radial-gradient(circle at 40% 35%, #ff9b7a, #d03b1c 62%, #7d2410);
      box-shadow: 0 0 5px rgba(208, 59, 28, 0.8);
    }

    .new-kit-btn {
      width: clamp(44px, 4.2vw, 50px);
      height: clamp(22px, 3vh, 26px);
      border: 1px solid #79241c;
      border-radius: 3px;
      background: linear-gradient(#cf4436, #a92e23);
      cursor: pointer;
      box-shadow: 0 2px 3px rgba(0, 0, 0, 0.32), inset 0 1px 0 rgba(255, 255, 255, 0.28);
      outline: none;
      transition: all 60ms;
      flex-shrink: 0;
    }

    .new-kit-btn:hover {
      background: linear-gradient(#dd5344, #bb3a2d);
    }

    .new-kit-btn:active {
      transform: translateY(1px);
      box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.5);
    }

    .undo-btn {
      width: clamp(36px, 3.5vw, 42px);
      height: clamp(22px, 3vh, 26px);
      border: 1px solid #6f6a55;
      border-radius: 3px;
      cursor: pointer;
      background: linear-gradient(#f0e9ca, #ddd3ad);
      box-shadow: 0 2px 3px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.6);
      outline: none;
      transition: all 60ms;
      flex-shrink: 0;
    }

    .undo-btn:hover {
      background: linear-gradient(#f9f4e2, #e6dcb8);
    }

    .undo-btn:active {
      transform: translateY(1px);
      box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.4);
    }

    .setup-disk-btn {
      width: clamp(36px, 3.5vw, 42px);
      height: clamp(22px, 3vh, 26px);
      border: 1px solid #8b5a12;
      border-radius: 3px;
      background: linear-gradient(#f79420, #e07a0c);
      cursor: pointer;
      box-shadow: 0 2px 3px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.45);
      outline: none;
      transition: all 60ms;
      flex-shrink: 0;
    }

    .setup-disk-btn:hover {
      background: linear-gradient(#ffa63a, #ee8a14);
    }

    .setup-disk-btn:active {
      transform: translateY(1px);
      box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.4);
    }

    /* LOWER SELECTOR ROW: PAD COUNT & SCREEN */
    .selector-bar {
      background: #c3d1cf;
      border: 1px solid #9fb0ae;
      border-radius: 4px;
      padding: clamp(3px, 0.5vh, 5px) 8px clamp(4px, 0.6vh, 6px);
      display: flex;
      flex-direction: column;
      gap: clamp(2px, 0.4vh, 4px);
    }

    .selector-title {
      text-align: center;
      font-family: 'Barlow Condensed', sans-serif;
      font-size: 8.5px;
      font-weight: 700;
      letter-spacing: 1.8px;
      color: #3c4a48;
    }

    .selector-tabs {
      display: flex;
      gap: 6px;
    }

    .tab-item {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 2px;
    }

    .tab-lamp-pair {
      display: flex;
      align-items: center;
      gap: 3px;
    }

    .tab-lamp {
      width: 4px;
      height: 4px;
      border-radius: 50%;
      display: block;
      background: #6c6f67;
    }

    .tab-lamp.lit {
      background: radial-gradient(circle at 40% 35%, #c8ffb0, #4fae2c 62%, #1e5c12);
      box-shadow: 0 0 4px rgba(79, 174, 44, 0.8);
    }

    .tab-item-title {
      font-family: 'Barlow Condensed', sans-serif;
      font-size: 9px;
      font-weight: 700;
      color: #3c4a48;
    }

    .tab-button {
      width: 100%;
      height: 18px;
      border: 1px solid #6f6a55;
      border-radius: 2px;
      background: linear-gradient(#f0e9ca, #ddd3ad);
      cursor: pointer;
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.26), inset 0 1px 0 rgba(255, 255, 255, 0.55);
      outline: none;
      transition: all 60ms;
    }

    .tab-button.active {
      background: linear-gradient(#4276c6, #2c5aa6);
      border-color: #24497f;
    }

    .screen-tab-button {
      width: 100%;
      height: 18px;
      border: 1px solid #1f3d7a;
      border-radius: 2px;
      cursor: pointer;
      background: linear-gradient(#3f7bd6, #1e4f9e);
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.35);
      outline: none;
    }

    .screen-tab-button.active {
      background: linear-gradient(#5390e6, #2a5cae);
    }

    @media (max-width: 540px) {
      .controls-deck {
        gap: 8px;
        flex-wrap: nowrap;
      }
      .fader-column {
        flex: 0 0 86px;
        width: 86px;
        padding: 6px 4px 8px;
      }
      .fader-area {
        min-height: 100px;
        width: 50px;
      }
      .fader-cap {
        width: 44px;
        height: 24px;
      }
      .arm-btn {
        width: 38px;
        padding: 4px 0;
      }
      .rotary-deck {
        padding: 6px 6px;
        gap: 6px;
        flex-wrap: wrap;
        justify-content: space-around;
      }
      .data-wheel {
        width: 58px;
        height: 58px;
      }
      .wheel-inner-recess {
        width: 36px;
        height: 36px;
      }
      .volume-pot {
        width: 38px;
        height: 38px;
      }
      .pot-marker-line {
        height: 14px;
      }
      .transport-pod-group {
        margin-left: 0;
        gap: 4px;
        justify-content: center;
        width: 100%;
        padding-top: 4px;
        border-top: 1px solid rgba(165, 166, 159, 0.4);
      }
      .new-kit-btn {
        width: 52px;
        height: 28px;
      }
      .undo-btn,
      .setup-disk-btn {
        width: 42px;
        height: 28px;
      }
    }
  `;

  willUpdate(changedProperties: PropertyValues<this>) {
    if (changedProperties.has('activePresetIndex') || changedProperties.has('presetNames')) {
      const count = Math.max(2, this.presetNames.length);
      const safeIndex = Math.max(0, Math.min(count - 1, this.activePresetIndex));
      if (!this.varDrag) {
        this.varAmt = safeIndex / (count - 1);
      }
    }
  }

  private cycleVarArm() {
    this.varArmed = !this.varArmed;
  }

  private calculateNotchFromPointer(e: PointerEvent): number {
    if (!this.faderTrackEl) return this.activePresetIndex;
    const rect = this.faderTrackEl.getBoundingClientRect();
    const travel = rect.height - 28;
    if (travel <= 0) return this.activePresetIndex;
    const capCenterFromBottom = (rect.bottom - 14) - e.clientY;
    const raw = Math.max(0, Math.min(1, capCenterFromBottom / travel));
    const count = Math.max(2, this.presetNames.length);
    return Math.max(0, Math.min(count - 1, Math.round(raw * (count - 1))));
  }

  private onFaderPointerDown(e: PointerEvent) {
    e.preventDefault();
    this.varArmed = true;
    this.varDrag = true;
    (e.currentTarget as HTMLElement)?.setPointerCapture?.(e.pointerId);

    const count = Math.max(2, this.presetNames.length);
    const notch = this.calculateNotchFromPointer(e);
    this.varAmt = notch / (count - 1);
    this.activePresetIndex = notch;

    this.dispatchEvent(new CustomEvent('select-preset-index', {
      detail: { index: notch },
      bubbles: true,
      composed: true
    }));

    const onPointerMove = (ev: PointerEvent) => {
      const newNotch = this.calculateNotchFromPointer(ev);
      if (newNotch !== this.activePresetIndex) {
        this.activePresetIndex = newNotch;
        this.varAmt = newNotch / (count - 1);
        this.dispatchEvent(new CustomEvent('select-preset-index', {
          detail: { index: newNotch },
          bubbles: true,
          composed: true
        }));
      }
    };

    const onPointerUp = (ev: PointerEvent) => {
      this.varDrag = false;
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);

      const finalNotch = this.calculateNotchFromPointer(ev);
      this.activePresetIndex = finalNotch;
      this.varAmt = finalNotch / (count - 1);
      this.dispatchEvent(new CustomEvent('select-preset-index', {
        detail: { index: finalNotch },
        bubbles: true,
        composed: true
      }));
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  }

  private onWheelPointerDown(_e: PointerEvent) {
    let acc = 0;
    const onPointerMove = (ev: PointerEvent) => {
      acc += ev.movementX - ev.movementY;
      while (Math.abs(acc) >= 28) {
        const dir = acc > 0 ? 1 : -1;
        acc -= dir * 28;
        this.wheelTurn += dir * 26;
        this.dispatchEvent(new CustomEvent('wheel-turn', {
          detail: { dir },
          bubbles: true,
          composed: true
        }));
      }
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
    const dir = e.deltaY > 0 ? -1 : 1;
    this.wheelTurn += dir * 26;
    this.dispatchEvent(new CustomEvent('wheel-turn', {
      detail: { dir },
      bubbles: true,
      composed: true
    }));
  }

  private onVolumePointerDown(_e: PointerEvent) {
    const onPointerMove = (ev: PointerEvent) => {
      const delta = -ev.movementY / 160;
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
    const capBottom = `calc(${this.varAmt * 100}% - ${this.varAmt * 28}px)`;

    const padCounts: PadCount[] = [4, 6, 8, 16];
    const screens: { id: LcdScreen; tag: string; name: string }[] = [
      { id: 'MAIN', tag: '1', name: 'KIT' },
      { id: 'SOURCES', tag: '2', name: 'SOURCES' },
      { id: 'INFO', tag: '3', name: 'PAD INFO' }
    ];

    return html`
      <div class="controls-deck">
        <!-- NOTE VARIATION FADER -->
        <div class="fader-column">
          <div class="fader-title">PROGRAM<br>SELECT</div>
          <div class="fader-armed-label">ARMED</div>
          <span class="armed-led ${this.varArmed ? 'lit' : ''}"></span>
          <button class="arm-btn ${this.varArmed ? 'active' : ''}" @click=${this.cycleVarArm}></button>
          <span class="arm-badge">ARM</span>

          <div 
            class="fader-area ${this.varArmed ? 'armed' : ''}"
            @pointerdown=${this.onFaderPointerDown}
          >
            <div class="fader-ticks">
              ${this.presetNames.map((name, i) => {
                const isCurrent = i === this.activePresetIndex;
                return html`
                  <div class="tick-row" title="${name}">
                    <span class="tick-line ${isCurrent ? 'active' : ''}" style="width: ${isCurrent ? '26px' : '18px'}; opacity: ${isCurrent ? 0.95 : 0.4};"></span>
                    <span class="tick-line ${isCurrent ? 'active' : ''}" style="width: ${isCurrent ? '26px' : '18px'}; opacity: ${isCurrent ? 0.95 : 0.4};"></span>
                  </div>
                `;
              })}
            </div>

            <div class="fader-track">
              <div class="fader-cap ${this.varDrag ? 'active' : ''}" style="bottom: ${capBottom};">
                <span class="fader-cap-stripe"></span>
              </div>
            </div>
          </div>
        </div>

        <!-- ROTARY DECK & BUTTONS -->
        <div class="controls-right-col">
          <div class="rotary-deck">
            <!-- DATA WHEEL -->
            <div class="control-pod">
              <span class="pod-label">DATA</span>
              <div 
                class="data-wheel" 
                @pointerdown=${this.onWheelPointerDown}
                @wheel=${this.onWheelScroll}
              >
                <span class="wheel-inner-recess"></span>
                <div class="wheel-dimple-wrap" style="transform: rotate(${this.wheelTurn}deg);">
                  <span class="wheel-dimple"></span>
                </div>
              </div>
              <span class="pod-badge">${this.currentScreen === 'SOURCES' ? 'SOURCE' : 'PAD COUNT'}</span>
            </div>

            <!-- MAIN VOLUME -->
            <div class="control-pod">
              <span class="pod-label">MAIN VOLUME</span>
              <div 
                class="volume-pot"
                @pointerdown=${this.onVolumePointerDown}
              >
                <div class="pot-marker-wrap" style="transform: rotate(${volDeg}deg);">
                  <span class="pot-marker-line"></span>
                </div>
              </div>
              <div class="pot-readout">
                <span>MIN</span>
                <span style="font-weight: 700;">${volPercent}</span>
                <span>MAX</span>
              </div>
            </div>

            <!-- BUTTON PODS -->
            <div class="transport-pod-group">
              <div class="control-pod">
                <div class="lamp-label-pair">
                  <span class="btn-lamp ${this.isGenerating ? 'active' : ''}"></span>
                  <span class="pod-label">NEW KIT</span>
                </div>
                <button 
                  class="new-kit-btn"
                  @click=${() => this.dispatchEvent(new CustomEvent('generate-kit', { bubbles: true, composed: true }))}
                  title="Generate new kit (Space)"
                ></button>
                <span class="pod-label">SPACE</span>
              </div>

              <div class="control-pod">
                <span class="pod-label">UNDO</span>
                <button 
                  class="undo-btn"
                  style="opacity: ${this.canUndo ? '1' : '0.45'};"
                  @click=${() => this.dispatchEvent(new CustomEvent('undo-kit', { bubbles: true, composed: true }))}
                  title="Undo kit changes (Cmd+Z)"
                ></button>
                <span class="pod-badge">⌘Z</span>
              </div>

              <div class="control-pod">
                <span class="pod-label">SETUP DISK</span>
                <button 
                  class="setup-disk-btn"
                  @click=${() => this.dispatchEvent(new CustomEvent('open-setup-disk', { bubbles: true, composed: true }))}
                  title="Open Setup Disk Drawer"
                ></button>
                <span class="pod-label">OPEN</span>
              </div>
            </div>
          </div>

          <!-- PAD COUNT & SCREEN SELECTOR ROW -->
          <div class="selector-bar">
            <div class="selector-title">PAD COUNT</div>
            <div class="selector-tabs">
              ${padCounts.map(n => html`
                <div class="tab-item">
                  <div class="tab-lamp-pair">
                    <span class="tab-lamp ${this.padCount === n ? 'lit' : ''}"></span>
                    <span class="tab-item-title">${n}</span>
                  </div>
                  <button 
                    class="tab-button ${this.padCount === n ? 'active' : ''}"
                    @click=${() => this.selectPadCount(n)}
                  ></button>
                </div>
              `)}
            </div>

            <div style="height: 1px; background: rgba(60, 74, 72, 0.28);"></div>

            <div class="selector-title">SCREEN</div>
            <div class="selector-tabs">
              ${screens.map(s => html`
                <div class="tab-item">
                  <div class="tab-lamp-pair">
                    <span class="tab-lamp ${this.currentScreen === s.id ? 'lit' : ''}"></span>
                    <span class="tab-item-title">${s.tag}</span>
                  </div>
                  <button 
                    class="screen-tab-button ${this.currentScreen === s.id ? 'active' : ''}"
                    @click=${() => this.selectScreen(s.id)}
                  ></button>
                  <span class="pod-badge" style="font-size: 8px;">${s.name}</span>
                </div>
              `)}
            </div>
          </div>
        </div>
      </div>
    `;
  }
}
