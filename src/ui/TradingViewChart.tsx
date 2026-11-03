import { useEffect, useRef } from 'react';
import type { Instrument } from '../sim/types';

/**
 * TradingView Advanced Chart widget (embed).
 * - Menampilkan chart TradingView asli (data real).
 * - Symbol dipilih berdasarkan kelas instrumen sim (referensi, bukan data sim).
 */
const TV_SYMBOL: Record<string, string> = {
  crypto: 'BINANCE:BTCUSDT',
  meme: 'BINANCE:DOGEUSDT',
  shitcoin: 'BINANCE:SHIBUSDT',
  stock: 'NASDAQ:AAPL',
  forex: 'FX:EURUSD',
  commodity: 'COMEX:GC1!',
  index: 'SP:SPX'
};

export function tvSymbolFor(inst: Instrument | null | undefined): string {
  if (!inst) return 'BINANCE:BTCUSDT';
  return TV_SYMBOL[inst.cls] ?? 'BINANCE:BTCUSDT';
}

export function TradingViewChart({ symbol, height = 360 }: { symbol?: string; height?: number }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const sym = symbol ?? 'BINANCE:BTCUSDT';

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.innerHTML = '';
    const script = document.createElement('script');
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';
    script.type = 'text/javascript';
    script.async = true;
    script.innerHTML = JSON.stringify({
      autosize: true,
      symbol: sym,
      interval: '60',
      timezone: 'Asia/Jakarta',
      theme: 'dark',
      style: '1',
      locale: 'id',
      enable_publishing: false,
      allow_symbol_change: true,
      calendar: false,
      support_host: 'https://www.tradingview.com',
      height
    });
    el.appendChild(script);
    return () => {
      if (el) el.innerHTML = '';
    };
  }, [sym, height]);

  return (
    <div className="tradingview-widget-container" ref={ref} style={{ height, width: '100%' }}>
      <div className="tradingview-widget-container__widget" style={{ height: '100%', width: '100%' }} />
    </div>
  );
}
