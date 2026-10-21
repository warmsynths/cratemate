/** Peak level per bin, scanning every 4th sample like the design does. */
function binPeaks(data: Float32Array, n: number, total: number): number[] {
  const per = Math.max(1, Math.floor(total / n));
  const pk: number[] = [];
  for (let k = 0; k < n; k++) {
    let m = 0;
    for (let j = k * per; j < (k + 1) * per && j < data.length; j += 4) {
      const a = Math.abs(data[j]);
      if (a > m) m = a;
    }
    pk.push(m);
  }
  return pk;
}

/** Pad-face envelope: loudness-scaled, silent tail trimmed, returned as 0..1 heights. */
export function envelopeFromBuffer(buf: AudioBuffer, n = 40): number[] {
  const d = buf.getChannelData(0);
  const sr = buf.sampleRate;
  let mx = 1e-4;
  for (let j = 0; j < d.length; j += 4) {
    const a = Math.abs(d[j]);
    if (a > mx) mx = a;
  }
  let end = d.length - 1;
  const floorAmp = mx * 0.004;
  while (end > 0 && Math.abs(d[end]) < floorAmp) end--;
  const total = Math.max(Math.floor(0.08 * sr), end + 1);
  const pk = binPeaks(d, n, total);
  return smoothDb(pk, mx);
}

/** Same envelope from stored analysis bins, for samples whose audio isn't loaded. */
export function envelopeFromBins(bins: number[], n = 40): number[] {
  if (!bins.length) return [];
  const mx = Math.max(1e-4, ...bins);
  let end = bins.length - 1;
  while (end > 0 && bins[end] < mx * 0.004) end--;
  const used = bins.slice(0, end + 1);
  const pk = Array.from({ length: n }, (_, k) => {
    const a = Math.floor(k / n * used.length);
    const b = Math.max(a + 1, Math.floor((k + 1) / n * used.length));
    return Math.max(...used.slice(a, b));
  });
  return smoothDb(pk, mx);
}

function smoothDb(pk: number[], mx: number): number[] {
  const db = (v: number) => Math.max(0.03, Math.min(1, (20 * Math.log10(Math.max(v, 1e-6) / mx) + 48) / 48));
  return pk.map((v, k) => (pk[k - 1] ?? v) * 0.25 + v * 0.5 + (pk[k + 1] ?? v) * 0.25).map(db);
}

/** Edge line and filled floor shape for a pad, in a 100x40 box. */
export function envPaths(env: number[]): { edge: string; floor: string } {
  if (env.length < 2) return { edge: '', floor: '' };
  const n = env.length;
  const X = (k: number) => (k / (n - 1) * 100).toFixed(1);
  const Y = (a: number) => (40 - a * 38).toFixed(1);
  let edge = '';
  env.forEach((a, k) => { edge += (k ? 'L' : 'M') + X(k) + ' ' + Y(a); });
  return { edge, floor: 'M0 40L' + edge.slice(1) + 'L100 40Z' };
}

/** Editor waveform: mirrored vertical strokes, linear scale, in a 100x40 box. */
export function strokePath(buf: AudioBuffer, n = 38): string {
  const d = buf.getChannelData(0);
  const pk = binPeaks(d, n, d.length);
  return strokesFrom(pk);
}

export function strokePathFromBins(bins: number[], n = 38): string {
  if (!bins.length) return '';
  const pk = Array.from({ length: n }, (_, k) => bins[Math.min(bins.length - 1, Math.floor(k / n * bins.length))]);
  return strokesFrom(pk);
}

function strokesFrom(pk: number[]): string {
  const n = pk.length;
  let p = '';
  pk.forEach((m, k) => {
    const h = Math.max(0.6, Math.min(1, m) * 18);
    const x = ((k + 0.5) * 100 / n).toFixed(2);
    p += 'M' + x + ' ' + (20 - h).toFixed(2) + 'V' + (20 + h).toFixed(2);
  });
  return p;
}
