import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import type { SampleRole } from '../types/index.ts';

const ROLE_COLORS: Record<SampleRole, { primary: string; secondary: string }> = {
  'Kick/Low': { primary: '#ff4757', secondary: '#ff6b81' },
  'Snare/Snap': { primary: '#00d2d3', secondary: '#54a0ff' },
  'Hat/Air': { primary: '#1dd1a1', secondary: '#10ac84' },
  'Tonal/Melodic': { primary: '#a55eea', secondary: '#778beb' },
  'Texture/Wildcard': { primary: '#ffa502', secondary: '#ff793f' }
};

@customElement('waveform-view')
export class WaveformView extends LitElement {
  @property({ type: Array }) bins: number[] = [];
  @property({ type: String }) role: SampleRole = 'Kick/Low';
  @property({ type: Boolean }) isPlaying = false;

  static styles = css`
    :host {
      display: block;
      width: 100%;
      height: 48px;
      position: relative;
    }
    canvas {
      width: 100%;
      height: 100%;
      display: block;
      border-radius: 4px;
    }
  `;

  private canvas: HTMLCanvasElement | null = null;
  private animId = 0;
  private playProgress = 0;

  render() {
    return html`<canvas></canvas>`;
  }

  firstUpdated() {
    this.canvas = this.renderRoot.querySelector('canvas');
    this.draw();
  }

  updated(changedProperties: Map<string, any>) {
    if (changedProperties.has('bins') || changedProperties.has('role')) {
      this.draw();
    }
    if (changedProperties.has('isPlaying')) {
      if (this.isPlaying) {
        this.startPlayAnimation();
      } else {
        this.stopPlayAnimation();
      }
    }
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.stopPlayAnimation();
  }

  private startPlayAnimation() {
    this.playProgress = 0;
    const startTime = performance.now();
    const duration = 400; // default visual playhead pulse

    const animate = (now: number) => {
      const elapsed = now - startTime;
      this.playProgress = Math.min(1.0, elapsed / duration);
      this.draw();

      if (this.playProgress < 1.0 && this.isPlaying) {
        this.animId = requestAnimationFrame(animate);
      } else {
        this.playProgress = 0;
        this.draw();
      }
    };

    cancelAnimationFrame(this.animId);
    this.animId = requestAnimationFrame(animate);
  }

  private stopPlayAnimation() {
    cancelAnimationFrame(this.animId);
    this.playProgress = 0;
    this.draw();
  }

  private draw() {
    if (!this.canvas) return;
    const ctx = this.canvas.getContext('2d');
    if (!ctx) return;

    // Handle high DPI
    const rect = this.canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const width = rect.width || 200;
    const height = rect.height || 48;

    if (this.canvas.width !== width * dpr || this.canvas.height !== height * dpr) {
      this.canvas.width = width * dpr;
      this.canvas.height = height * dpr;
    }

    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);

    // Background track
    ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
    ctx.fillRect(0, 0, width, height);

    const bins = this.bins.length > 0 ? this.bins : Array.from({ length: 64 }, () => 0.1);
    const count = bins.length;
    const barWidth = Math.max(1.5, (width / count) - 1.2);
    const halfH = height / 2;

    const colors = ROLE_COLORS[this.role] || { primary: '#00d2d3', secondary: '#54a0ff' };

    for (let i = 0; i < count; i++) {
      const x = i * (width / count);
      const amp = Math.max(0.06, bins[i]);
      const barHeight = amp * (height * 0.85);
      const y = halfH - (barHeight / 2);

      const isBehindPlayhead = this.playProgress > 0 && (i / count) <= this.playProgress;

      if (isBehindPlayhead) {
        ctx.fillStyle = '#ffffff';
        ctx.shadowColor = colors.primary;
        ctx.shadowBlur = 6;
      } else {
        ctx.shadowBlur = 0;
        ctx.fillStyle = i % 2 === 0 ? colors.primary : colors.secondary;
      }

      ctx.fillRect(x, y, barWidth, barHeight);
    }

    // Playhead line
    if (this.playProgress > 0) {
      const playheadX = this.playProgress * width;
      ctx.shadowBlur = 8;
      ctx.shadowColor = '#ffffff';
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(playheadX - 1, 0, 2, height);
    }

    ctx.restore();
  }
}
