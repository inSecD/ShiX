import { useStore } from '../store';
import { fmtUsd } from '../lib/format';
import {
  ASSET_DEFS,
  SELL_RATE,
  dailyUpkeep,
  lifestyleAssetsValue,
  type AssetCategory,
  type AssetDef
} from '../sim/lifestyle';

const CATS: { key: AssetCategory; label: string }[] = [
  { key: 'property', label: 'Properti' },
  { key: 'vehicle', label: 'Kendaraan' },
  { key: 'collection', label: 'Koleksi' }
];

function AssetRow({ def, owned, canAfford }: { def: AssetDef; owned: boolean; canAfford: boolean }) {
  const lifestyleBuy = useStore((s) => s.lifestyleBuy);
  const lifestyleSell = useStore((s) => s.lifestyleSell);

  return (
    <div className={`asset-row${owned ? ' owned' : ''}`}>
      <span className="asset-ico">{def.icon}</span>
      <div className="asset-copy">
        <div className="asset-meta">
          <b>{def.name}</b>
          <span className="asset-price">{fmtUsd(def.price, true)}</span>
        </div>
        <div className="tiny muted">{def.desc}</div>
        <div className="asset-upkeep">Rawat {fmtUsd(def.upkeep)}/hari</div>
        {def.perks.length > 0 && (
          <div className="asset-perks">{def.perks.map((p) => `✦ ${p}`).join('  ')}</div>
        )}
      </div>
      {owned ? (
        <button className="short" onClick={() => lifestyleSell(def.id)}>
          Jual {Math.round(SELL_RATE * 100)}%
        </button>
      ) : (
        <button className="primary" disabled={!canAfford} onClick={() => lifestyleBuy(def.id)}>
          Beli
        </button>
      )}
    </div>
  );
}

export function LifestyleView() {
  const sim = useStore((s) => s.sim);
  const ls = sim.lifestyle;
  const ownedSet = new Set(ls.owned);
  const totalValue = lifestyleAssetsValue(ls);
  const upkeep = dailyUpkeep(ls);

  return (
    <div className="lifestyle">
      <div className="panel">
        <div className="panel-head">
          <span>Gaya Hidup</span>
          <span className="badge">{ls.owned.length} aset</span>
        </div>
        <div className="panel-body ls-stats">
          <div className="ls-stat">
            <span className="k">Cash</span>
            <span className="v">{fmtUsd(sim.cash, true)}</span>
          </div>
          <div className="ls-stat">
            <span className="k">Nilai aset</span>
            <span className="v">{fmtUsd(totalValue, true)}</span>
          </div>
          <div className="ls-stat">
            <span className="k">Rawat / hari</span>
            <span className="v">{fmtUsd(upkeep)}</span>
          </div>
        </div>
      </div>

      {CATS.map((cat) => {
        const list = ASSET_DEFS.filter((a) => a.cat === cat.key);
        return (
          <div className="panel" key={cat.key}>
            <div className="panel-head">
              <span>{cat.label}</span>
            </div>
            <div className="asset-list">
              {list.map((def) => (
                <AssetRow
                  key={def.id}
                  def={def}
                  owned={ownedSet.has(def.id)}
                  canAfford={sim.cash >= def.price}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
