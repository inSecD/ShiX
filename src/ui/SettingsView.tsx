import { useRef, useState } from 'react';
import { useStore, dayKeyOf, readDailyMeta } from '../store';
import { equity } from '../sim/engine';
import { formatSeed, parseSeed, randomSeed } from '../sim/rng';
import { fmtPct, fmtUsd } from '../lib/format';

export function SettingsView() {
  const settings = useStore((s) => s.settings);
  const setSettings = useStore((s) => s.setSettings);
  const reset = useStore((s) => s.reset);
  const save = useStore((s) => s.save);
  const saving = useStore((s) => s.saving);
  const exportSave = useStore((s) => s.exportSave);
  const importSave = useStore((s) => s.importSave);
  const startDaily = useStore((s) => s.startDaily);
  const exitDaily = useStore((s) => s.exitDaily);
  const sim = useStore((s) => s.sim);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [seedText, setSeedText] = useState(formatSeed(settings.seed));
  const [cashText, setCashText] = useState(String(settings.startingCash));

  const applySeed = () => {
    const parsed = parseSeed(seedText);
    if (parsed === null) return;
    setSettings({ seed: parsed });
    setSeedText(formatSeed(parsed));
  };

  const ch = sim.challenge;
  const meta = readDailyMeta();
  const chPct = ch && ch.startEquity > 0 ? (equity(sim) / ch.startEquity - 1) * 100 : 0;
  const chProg = ch ? Math.min(1, Math.max(0, chPct / (ch.targetPct * 100))) : 0;
  const chLeft = ch ? Math.max(0, ch.deadlineTick - sim.ticks) : 0;

  const beginDaily = () => {
    const msg = ch
      ? 'Ulangi tantangan hari ini? Dunia sekarang (dan save otomatisnya) akan diganti.'
      : 'Mulai tantangan harian? Dunia sekarang (dan save otomatisnya) akan diganti.';
    if (confirm(msg)) startDaily();
  };

  return (
    <div>
      <div className="panel">
        <div className="panel-head">
          <span>Profil Akun</span>
        </div>
        <div className="panel-body">
          <div className="field">
            <label>Seed dunia (deterministik)</label>
            <div className="row" style={{ gap: 6 }}>
              <input value={seedText} onChange={(e) => setSeedText(e.target.value)} style={{ fontFamily: 'var(--mono)' }} />
              <button onClick={applySeed}>Pakai</button>
            </div>
            <div className="row" style={{ gap: 6, marginTop: 6 }}>
              <button
                className="tiny"
                onClick={() => {
                  const s = randomSeed();
                  setSettings({ seed: s });
                  setSeedText(formatSeed(s));
                }}
              >
                Acak seed
              </button>
              <span className="tiny muted">Pakai seed sama = dunia sama</span>
            </div>
          </div>

          <div className="field">
            <label>Modal awal</label>
            <div className="row" style={{ gap: 6 }}>
              <input inputMode="numeric" value={cashText} onChange={(e) => setCashText(e.target.value)} />
              <button onClick={() => setSettings({ startingCash: Math.max(1000, parseFloat(cashText) || 100000) })}>
                Set
              </button>
            </div>
          </div>

          <div className="field">
            <label>Level kesulitan</label>
            <div className="seg">
              {(['easy', 'normal', 'brutal'] as const).map((d) => (
                <button
                  key={d}
                  className={settings.difficulty === d ? 'on' : ''}
                  onClick={() => setSettings({ difficulty: d })}
                >
                  {d === 'easy' ? 'Santai' : d === 'normal' ? 'Normal' : 'Brutal'}
                </button>
              ))}
            </div>
          </div>

          <div className="field">
            <label>Leverage maksimum</label>
            <div className="seg">
              {[3, 5, 10, 20].map((l) => (
                <button
                  key={l}
                  className={settings.maxLeverage === l ? 'on' : ''}
                  onClick={() => setSettings({ maxLeverage: l })}
                >
                  {l}x
                </button>
              ))}
            </div>
          </div>

          <div className="row between" style={{ marginTop: 4 }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 13 }}>Slippage & depth impact</div>
              <div className="tiny muted">Order besar di book tipis digeser harga</div>
            </div>
            <button
              className={`sw ${settings.slippageEnabled ? 'on' : ''}`}
              onClick={() => setSettings({ slippageEnabled: !settings.slippageEnabled })}
            />
          </div>

          <div className="divider" />
          <div className="kv">
            <span className="k">Fee taker / maker</span>
            <span className="v">
              {(settings.feeTaker * 100).toFixed(3)}% / {(settings.feeMaker * 100).toFixed(3)}%
            </span>
          </div>
          <div className="kv">
            <span className="k">Instrumen</span>
            <span className="v">{sim.order.length}</span>
          </div>
          <div className="kv">
            <span className="k">Tick berjalan</span>
            <span className="v">{sim.ticks}</span>
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">
          <span>Tantangan Harian</span>
          <span className={`badge ${ch ? (ch.done ? (ch.won ? 'accent' : 'danger') : 'warn') : ''}`}>
            {ch ? (ch.done ? (ch.won ? 'LOLOS' : 'GAGAL') : 'AKTIF') : 'OFF'}
          </span>
        </div>
        <div className="panel-body">
          <div className="row between tiny">
            <span className="muted">Tanggal / seed harian</span>
            <span className="mono">{dayKeyOf()}</span>
          </div>
          <div className="row between tiny" style={{ marginTop: 4 }}>
            <span className="muted">Streak</span>
            <span className="mono">
              {meta.streak} hari · best {fmtPct(meta.best)}
            </span>
          </div>

          <div className="divider" />

          {ch ? (
            <>
              <div className="row between">
                <span className="tiny muted">
                  Target +{(ch.targetPct * 100).toFixed(0)}% dalam 7 hari
                </span>
                <span className={`mono ${chPct >= 0 ? 'up' : 'down'}`} style={{ fontSize: 12, fontWeight: 700 }}>
                  {fmtPct(chPct)}
                </span>
              </div>
              <div className="curve" style={{ marginTop: 6 }}>
                <i style={{ width: `${chProg * 100}%` }} />
              </div>
              <div className="row between tiny muted" style={{ marginTop: 4 }}>
                <span>terbaik {fmtPct(ch.bestPct)}</span>
                <span>
                  {ch.done
                    ? `hasil ${fmtPct(ch.finalPct ?? chPct)}`
                    : `sisa ${Math.max(0, Math.ceil(chLeft / 24))} hari`}
                </span>
              </div>
              <div className="kv" style={{ marginTop: 6 }}>
                <span className="k">Attempt</span>
                <span className="v">#{ch.attempts}</span>
              </div>
              <div className="kv">
                <span className="k">Seed</span>
                <span className="v">{formatSeed(ch.seed)}</span>
              </div>
              {ch.done && (
                <div className={`hint ${ch.won ? 'up' : 'down'}`} style={{ marginTop: 6 }}>
                  {ch.won
                    ? 'Target tercapai. Streak bertambah — balik lagi besok buat tantangan baru.'
                    : 'Target belum tercapai. Hari ini masih bisa diulang dengan pasar yang sama.'}
                </div>
              )}
              <button className="primary" style={{ width: '100%', marginTop: 8 }} onClick={beginDaily}>
                Ulangi hari ini (attempt #{ch.attempts + 1})
              </button>
              <button
                className="ghost"
                style={{ width: '100%', marginTop: 6 }}
                onClick={() => {
                  if (confirm('Keluar dari mode harian dan buat dunia normal baru?')) exitDaily();
                }}
              >
                Keluar mode harian
              </button>
            </>
          ) : (
            <>
              <div className="hint" style={{ marginBottom: 8 }}>
                Satu pasar deterministik per tanggal (seed = tanggal), modal $100.000, target +10% dalam 7
                hari. Bot AI ikut di papan peringkat. Menang = streak naik; kalah = streak reset.
              </div>
              <button className="primary" style={{ width: '100%' }} onClick={beginDaily}>
                Mulai tantangan hari ini
              </button>
            </>
          )}
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">
          <span>Save / Load</span>
          <span className="badge">{saving ? 'menyimpan...' : 'lokal'}</span>
        </div>
        <div className="panel-body">
          <div className="hint" style={{ marginBottom: 10 }}>
            Progres disimpan otomatis di perangkat ini (localStorage). Export/import untuk backup atau pindah device.
          </div>
          <button className="primary" style={{ width: '100%', marginBottom: 6 }} onClick={() => save()}>
            Simpan sekarang
          </button>
          <button style={{ width: '100%', marginBottom: 6 }} onClick={() => exportSave()}>
            Export file save
          </button>
          <button style={{ width: '100%' }} onClick={() => fileRef.current?.click()}>
            Import file save
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            style={{ display: 'none' }}
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              const text = await file.text();
              await importSave(text);
              e.target.value = '';
            }}
          />
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">
          <span>Zona bahaya</span>
        </div>
        <div className="panel-body">
          <div className="hint" style={{ marginBottom: 10 }}>
            Restart akan menghapus seluruh progres dan membuat dunia baru dengan seed saat ini.
          </div>
          <button
            className="short"
            style={{ width: '100%' }}
            onClick={() => {
              if (confirm('Restart permainan? Semua progres akan hilang.')) {
                reset(settings.seed, settings.startingCash);
              }
            }}
          >
            Restart dengan seed saat ini
          </button>
          <button
            className="ghost"
            style={{ width: '100%', marginTop: 6 }}
            onClick={() => {
              if (confirm('Mulai dunia baru random?')) reset(randomSeed(), settings.startingCash);
            }}
          >
            Dunia baru random
          </button>
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">
          <span>Tentang</span>
        </div>
        <div className="panel-body">
          <div className="hint">
            ShiX Terminal — game pasar dengan nama instrumen yang dipplesetkan (Binoin, Efhereum, Dogicoin,
            SPX 500). Semua harga, berita, dan likuidasi adalah fiksi dan dibangkitkan algoritmik, bukan data pasar
            nyata, dan bukan nasihat finansial.
          </div>
          <div className="kv" style={{ marginTop: 8 }}>
            <span className="k">Akun aktif</span>
            <span className="v">{fmtUsd(sim.cash)} cash</span>
          </div>
        </div>
      </div>
    </div>
  );
}
