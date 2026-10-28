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
import {
  BUSINESS_DEFS,
  businessDailyUpkeep,
  businessIncomeOf,
  businessIncomePerTick,
  businessUpkeepOf,
  businessValueOf,
  getBusiness,
  upgradeCost,
  type BusinessDef
} from '../sim/business';

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

function BusinessRow({ def, level, cash }: { def: BusinessDef; level: number | null; cash: number }) {
  const businessBuy = useStore((s) => s.businessBuy);
  const businessUpgrade = useStore((s) => s.businessUpgrade);
  const owned = level !== null;
  const maxed = owned && level >= def.maxLevel;
  const income = businessIncomeOf(def, level ?? 1);
  const upkeep = businessUpkeepOf(def, level ?? 1);
  const upCost = owned && !maxed ? upgradeCost(def, level) : 0;

  return (
    <div className={`asset-row${owned ? ' owned' : ''}`}>
      <span className="asset-ico">{def.icon}</span>
      <div className="asset-copy">
        <div className="asset-meta">
          <b>{def.name}</b>
          <span className="asset-price">{fmtUsd(def.price, true)}</span>
        </div>
        <div className="tiny muted">{def.desc}</div>
        <div className="asset-upkeep">
          {owned ? `Lv ${level}/${def.maxLevel} · ` : ''}
          +{fmtUsd(income)}/jam · rawat {fmtUsd(upkeep)}/hari
        </div>
        {owned && <div className="asset-perks">Nilai bisnis {fmtUsd(businessValueOf(def, level), true)}</div>}
      </div>
      {owned ? (
        maxed ? (
          <button className="short" disabled>
            Maks
          </button>
        ) : (
          <button className="primary" disabled={cash < upCost} onClick={() => businessUpgrade(def.id)}>
            Upg {fmtUsd(upCost, true)}
          </button>
        )
      ) : (
        <button className="primary" disabled={cash < def.price} onClick={() => businessBuy(def.id)}>
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

  const bs = sim.business;
  const bizIncome = businessIncomePerTick(bs);
  const bizUpkeep = businessDailyUpkeep(bs);

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

      <div className="panel">
        <div className="panel-head">
          <span>Imperium Bisnis</span>
          <span className="badge">
            +{fmtUsd(bizIncome)}/jam · rawat {fmtUsd(bizUpkeep)}/hari
          </span>
        </div>
        <div className="asset-list">
          {BUSINESS_DEFS.map((def) => {
            const inst = getBusiness(bs, def.id);
            return (
              <BusinessRow key={def.id} def={def} level={inst ? inst.level : null} cash={sim.cash} />
            );
          })}
        </div>
        {bs.owned.length > 0 && (
          <div className="panel-body">
            <div className="tiny muted">
              Nilai total bisnis {fmtUsd(bs.owned.reduce((s, b) => s + businessValueOf(BUSINESS_DEFS.find((d) => d.id === b.id)!, b.level), 0), true)} ·
              masuk ke kekayaan bersih
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
