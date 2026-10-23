import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Candle, Instrument } from '../sim/types';
import { useStore } from '../store';
import type { Timeframe } from '../store';
import { fmtPrice, fmtPct } from '../lib/format';

export function aggregate(candles: Candle[], n: number): Candle[] {
  if (n <= 1) return candles;
  const out: Candle[] = [];
  for (let i = 0; i < candles.length; i += n) {
    const slice = candles.slice(i, i + n);
    if (!slice.length) break;
    let h = -Infinity;
    let l = Infinity;
    let v = 0;
    for (const c of slice) {
      if (c.h > h) h = c.h;
      if (c.l < l) l = c.l;
      v += c.v;
    }
    out.push({
      t: slice[0].t,
      o: slice[0].o,
      h,
      l,
      c: slice[slice.length - 1].c,
      v
    });
  }
  return out;
}

function ema(values: number[], period: number): number[] {
  const k = 2 / (period + 1);
  const out: number[] = [];
  let prev = values[0] ?? 0;
  for (let i = 0; i < values.length; i++) {
    prev = i === 0 ? values[0] : values[i] * k + prev * (1 - k);
    out.push(prev);
  }
  return out;
}

interface Props {
  inst: Instrument;
  tf: Timeframe;
}

interface View {
  end: number;
  count: number;
}

export function ChartView({ inst, tf }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(360);
  const [view, setView] = useState<View>({ end: 0, count: 70 });
  const [cursor, setCursor] = useState<number | null>(null);
  const [showEma, setShowEma] = useState(true);
  const setTf = useStore((s) => s.setTf);
  const toggleWatch = useStore((s) => s.toggleWatch);
  const watchlist = useStore((s) => s.watchlist);
  const watched = watchlist.includes(inst.id);
  const viewRef = useRef(view);
  viewRef.current = view;

  const data = useMemo<Candle[]>(() => {
    if (tf === '1h') return inst.candles;
    if (tf === '4h') return aggregate(inst.candles, 4);
    if (tf === '1D') return inst.daily;
    return aggregate(inst.daily, 7);
  }, [inst.candles, inst.daily, tf]);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width ?? 360;
      setWidth(w);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    setView((v) => ({ ...v, end: Math.max(0, data.length - 1) }));
  }, [data.length]);

  const draw = useCallback(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    const H = 250;
    const VOL = 52;
    const w = width;
    cv.width = w * dpr;
    cv.height = H * dpr;
    cv.style.height = `${H}px`;
    const ctx = cv.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, H);

    if (!data.length) {
      ctx.fillStyle = '#556175';
      ctx.font = '12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Belum ada data', w / 2, H / 2);
      return;
    }

    const end = Math.min(Math.max(0, view.end), data.length - 1);
    const count = Math.max(12, Math.min(view.count, data.length || 1));
    const start = Math.max(0, end - count + 1);
    const slice = data.slice(start, end + 1);

    let hi = -Infinity;
    let lo = Infinity;
    let maxVol = 0;
    for (const c of slice) {
      if (c.h > hi) hi = c.h;
      if (c.l < lo) lo = c.l;
      if (c.v > maxVol) maxVol = c.v;
    }
    if (!Number.isFinite(hi) || !Number.isFinite(lo) || hi === lo) {
      hi = lo * 1.01 || 1;
      lo = lo * 0.99 || 1;
    }
    const pad = (hi - lo) * 0.08;
    hi += pad;
    lo -= pad;

    const padR = 52;
    const plotW = w - padR;
    const bw = plotW / slice.length;
    const cw = Math.max(1, Math.min(11, bw * 0.66));
    const yOf = (p: number) => ((hi - p) / (hi - lo)) * (H - VOL - 10) + 6;

    // grid
    ctx.strokeStyle = '#161d29';
    ctx.lineWidth = 1;
    ctx.font = '9px monospace';
    ctx.fillStyle = '#556175';
    ctx.textAlign = 'left';
    for (let i = 0; i <= 4; i++) {
      const y = 6 + ((H - VOL - 16) / 4) * i;
      ctx.beginPath();
      ctx.moveTo(0, y + 0.5);
      ctx.lineTo(plotW, y + 0.5);
      ctx.stroke();
      const val = hi - ((hi - lo) / 4) * i;
      ctx.fillText(fmtPrice(val), plotW + 4, y + 3);
    }

    // volume
    for (let i = 0; i < slice.length; i++) {
      const c = slice[i];
      const prev = i > 0 ? slice[i - 1].c : c.o;
      const up = c.c >= prev;
      ctx.fillStyle = up ? 'rgba(22,208,154,0.35)' : 'rgba(255,77,106,0.35)';
      const vh = maxVol > 0 ? (c.v / maxVol) * (VOL - 14) : 0;
      ctx.fillRect(i * bw + (bw - cw) / 2, H - vh - 4, cw, vh);
    }

    // candles
    for (let i = 0; i < slice.length; i++) {
      const c = slice[i];
      const prev = i > 0 ? slice[i - 1].c : c.o;
      const up = c.c >= prev;
      const x = i * bw + bw / 2;
      const color = up ? '#16d09a' : '#ff4d6a';
      ctx.strokeStyle = color;
      ctx.fillStyle = color;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(Math.round(x) + 0.5, yOf(c.h));
      ctx.lineTo(Math.round(x) + 0.5, yOf(c.l));
      ctx.stroke();
      const yo = yOf(c.o);
      const yc = yOf(c.c);
      const top = Math.min(yo, yc);
      const hgt = Math.max(1, Math.abs(yc - yo));
      ctx.fillRect(x - cw / 2, top, cw, hgt);
    }

    // EMA
    if (showEma && slice.length > 25) {
      const closes = slice.map((c) => c.c);
      const e20 = ema(closes, 20);
      const e50 = ema(closes, 50);
      const drawLine = (arr: number[], color: string) => {
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.3;
        ctx.beginPath();
        for (let i = 0; i < arr.length; i++) {
          const x = i * bw + bw / 2;
          const y = yOf(arr[i]);
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      };
      drawLine(e20, 'rgba(77,141,255,0.9)');
      drawLine(e50, 'rgba(168,107,255,0.9)');
    }

    // last price line
    const last = slice[slice.length - 1];
    const yl = yOf(last.c);
    ctx.strokeStyle = 'rgba(230,237,247,0.35)';
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(0, yl);
    ctx.lineTo(plotW, yl);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = last.c >= (slice[slice.length - 2]?.c ?? last.c) ? '#16d09a' : '#ff4d6a';
    ctx.fillRect(plotW + 1, yl - 8, padR - 2, 16);
    ctx.fillStyle = '#04140e';
    ctx.font = 'bold 9.5px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(fmtPrice(last.c), plotW + padR / 2, yl + 3.5);

    // crosshair
    if (cursor !== null && cursor >= 0 && cursor < slice.length) {
      const c = slice[cursor];
      const x = cursor * bw + bw / 2;
      ctx.strokeStyle = 'rgba(230,237,247,0.3)';
      ctx.setLineDash([2, 3]);
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, H);
      ctx.stroke();
      ctx.setLineDash([]);
      const label = `${fmtPrice(c.o)} ${fmtPrice(c.h)} ${fmtPrice(c.l)} ${fmtPrice(c.c)}`;
      ctx.font = '9.5px monospace';
      const tw = ctx.measureText(label).width + 10;
      const bx = Math.min(Math.max(0, x - tw / 2), w - tw);
      ctx.fillStyle = 'rgba(20,26,38,0.95)';
      ctx.fillRect(bx, 2, tw, 15);
      ctx.strokeStyle = '#2a3446';
      ctx.strokeRect(bx, 2, tw, 15);
      ctx.fillStyle = '#e6edf7';
      ctx.textAlign = 'left';
      ctx.fillText(label, bx + 5, 13);
    }
  }, [data, view, width, cursor, showEma]);

  useEffect(() => {
    draw();
  }, [draw]);

  // interactions
  const dragState = useRef<{ x: number; end: number; count: number; pinch: number } | null>(null);

  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches;
    if (t.length === 1) {
      dragState.current = { x: t[0].clientX, end: viewRef.current.end, count: viewRef.current.count, pinch: 0 };
    } else if (t.length === 2) {
      const d = Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
      dragState.current = { x: 0, end: viewRef.current.end, count: viewRef.current.count, pinch: d };
    }
  };

  const onTouchMove = (e: React.TouchEvent) => {
    const st = dragState.current;
    if (!st) return;
    const t = e.touches;
    if (t.length === 2 && st.pinch > 0) {
      const d = Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
      const scale = st.pinch / d;
      const count = Math.max(12, Math.min(400, Math.round(st.count * scale)));
      setView((v) => ({ ...v, count }));
    } else if (t.length === 1) {
      const plotW = width - 52;
      const bw = plotW / Math.max(12, st.count);
      const dx = t[0].clientX - st.x;
      const shift = Math.round(dx / bw);
      setView((v) => ({ ...v, end: Math.max(0, Math.min(data.length - 1, st.end - shift)) }));
    }
  };

  const onTouchEnd = () => {
    dragState.current = null;
  };

  const onPointer = (e: React.MouseEvent) => {
    const rect = (e.currentTarget as HTMLCanvasElement).getBoundingClientRect();
    const plotW = width - 52;
    const bw = plotW / Math.max(12, view.count);
    const idx = Math.floor((e.clientX - rect.left) / bw);
    setCursor(idx >= 0 && idx < view.count ? idx : null);
  };

  const chg = data.length > 1 ? (data[data.length - 1].c / data[0].c - 1) * 100 : 0;
  const tfLabel = { '1h': '1 JAM', '4h': '4 JAM', '1D': '1 HARI', '1W': '1 MINGGU' }[tf];

  return (
    <div className="chart-wrap" ref={wrapRef}>
      <div className="chart-head">
        <div>
          <div style={{ fontFamily: 'var(--mono)', fontWeight: 800, fontSize: 15 }}>
            {inst.name}{' '}
            <span style={{ color: 'var(--dim)', fontWeight: 600 }}>{inst.id}</span>
          </div>
          <div className="tiny muted">{inst.sector} · {inst.tag}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <button
            className="tiny ghost"
            style={{ padding: '2px 6px', marginBottom: 2, color: watched ? 'var(--warn)' : 'var(--dim2)' }}
            onClick={() => toggleWatch(inst.id)}
          >
            {watched ? '★ Watchlist' : '☆ Tambah'}
          </button>
          <div className="chart-price mono">{fmtPrice(inst.price)}</div>
          <div className={`mono ${chg >= 0 ? 'up' : 'down'}`} style={{ fontSize: 12, fontWeight: 700 }}>
            {fmtPct(chg)}
          </div>
        </div>
      </div>

      <canvas
        ref={canvasRef}
        className="chart-canvas"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onTouchCancel={onTouchEnd}
        onMouseMove={onPointer}
        onMouseLeave={() => setCursor(null)}
        onWheel={(e) => {
          const scale = e.deltaY > 0 ? 1.12 : 0.89;
          setView((v) => ({ ...v, count: Math.max(12, Math.min(400, Math.round(v.count * scale))) }));
        }}
      />

      <div className="tf-row">
        {(['1h', '4h', '1D', '1W'] as Timeframe[]).map((t) => (
          <button
            key={t}
            className={`tf-btn ${tf === t ? 'on' : ''}`}
            onClick={() => setTf(t)}
          >
            {t === '1h' ? '1J' : t === '4h' ? '4J' : t === '1D' ? '1H' : '1M'}
          </button>
        ))}
        <div style={{ flex: 1 }} />
        <button className={`tf-btn ${showEma ? 'on' : ''}`} onClick={() => setShowEma((s) => !s)}>
          EMA
        </button>
        <span className="badge">{tfLabel}</span>
      </div>
    </div>
  );
}
