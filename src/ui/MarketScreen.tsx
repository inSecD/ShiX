import { useStore } from '../store';
import { TradingViewChart, tvSymbolFor } from './TradingViewChart';
import { MarketView } from './MarketView';
import { TradePanel } from './TradePanel';

export function MarketScreen() {
  const sim = useStore((s) => s.sim);
  const v = useStore((s) => s.v);
  const selectedId = useStore((s) => s.selectedId);
  void v;

  const inst = sim.instruments[selectedId];

  return (
    <div className="market-screen">
      {inst ? (
        <div className="market-chart-card">
          <TradingViewChart symbol={tvSymbolFor(inst)} height={360} />
        </div>
      ) : (
        <div className="empty">Pilih instrumen dulu</div>
      )}
      <aside className="market-side">
        <TradePanel embedded />
      </aside>
      <div className="market-list-card" data-tut="market-list">
        <MarketView />
      </div>
    </div>
  );
}
