import { useStore } from '../store';
import { ChartView } from './ChartView';
import { MarketView } from './MarketView';
import { TradePanel } from './TradePanel';

export function MarketScreen() {
  const sim = useStore((s) => s.sim);
  const v = useStore((s) => s.v);
  const selectedId = useStore((s) => s.selectedId);
  const tf = useStore((s) => s.tf);
  void v;

  const inst = sim.instruments[selectedId];

  return (
    <div className="market-screen">
      {inst ? (
        <div className="market-chart-card">
          <ChartView inst={inst} tf={tf} />
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
