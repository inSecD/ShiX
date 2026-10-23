export function fmtPrice(v: number): string {
  if (!Number.isFinite(v)) return '-';
  const a = Math.abs(v);
  if (a >= 1000) return v.toLocaleString('en-US', { maximumFractionDigits: 2 });
  if (a >= 1) return v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
  if (a >= 0.01) return v.toFixed(5);
  if (a >= 0.00001) return v.toFixed(8);
  return v.toExponential(3);
}

export function fmtUsd(v: number, compact = false): string {
  if (!Number.isFinite(v)) return '-';
  const neg = v < 0;
  const a = Math.abs(v);
  let s: string;
  if (compact) {
    if (a >= 1e12) s = `${(a / 1e12).toFixed(2)}T`;
    else if (a >= 1e9) s = `${(a / 1e9).toFixed(2)}B`;
    else if (a >= 1e6) s = `${(a / 1e6).toFixed(2)}M`;
    else if (a >= 1e3) s = `${(a / 1e3).toFixed(1)}K`;
    else s = a.toFixed(2);
  } else {
    s = a.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  return `${neg ? '-' : ''}$${s}`;
}

export function fmtPct(v: number, digits = 2): string {
  if (!Number.isFinite(v)) return '-';
  return `${v >= 0 ? '+' : ''}${v.toFixed(digits)}%`;
}

export function fmtQty(v: number): string {
  if (!Number.isFinite(v)) return '-';
  const a = Math.abs(v);
  if (a >= 1e9) return `${(v / 1e9).toFixed(2)}B`;
  if (a >= 1e6) return `${(v / 1e6).toFixed(2)}M`;
  if (a >= 1e3) return `${(v / 1e3).toFixed(2)}K`;
  if (a >= 1) return v.toFixed(2);
  return v.toPrecision(4);
}

export function fmtClock(t: number): string {
  const d = new Date(t);
  const day = d.toISOString().slice(0, 10);
  const hm = d.toISOString().slice(11, 16);
  return `${day} ${hm} UTC`;
}

export function fmtShortDate(t: number): string {
  const d = new Date(t);
  return d.toISOString().slice(5, 10).replace('-', '/');
}

export function fmtTime(t: number): string {
  return new Date(t).toISOString().slice(11, 16);
}

export function pnlClass(v: number): string {
  if (v > 0) return 'up';
  if (v < 0) return 'down';
  return 'flat';
}
