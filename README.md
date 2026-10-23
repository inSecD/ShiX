# ShiX Terminal

Simulasi terminal trading dengan nama instrumen yang diplesetkan — **Binoin**, **Efhereum**, **Dogicoin**, **SPX 500**, **Emas**, **Minyak**. Semua harga, berita, dan likuidasi adalah fiksi yang dibangkitkan algoritmik (bukan data pasar nyata).

PWA: bisa di-install ke home screen iPhone/Android, jalan offline, progres tersimpan lokal.

---

## Fitur

- **Dashboard Home** ringkas: net worth, cash/margin/unrealized/realized, progres tantangan harian, mover pasar, posisi terbuka, dan cuplikan papan peringkat.
- **216+ instrumen** dengan nama dipleset: crypto (Binoin/BN, Efhereum/EF, Solena/SLN, Ripplx/RPX), memecoin (Dogicoin, Shibainu, Pepeu, Bonku), shitcoin/microcap, saham fiktif (62 emiten across 12 sektor), forex (24 cross), komoditas (Emas, Minyak, Tembaga...), index.
- **Mesin harga**: random walk + GARCH (volatilitas klaster), mean-reversion ke fundamental (`fund`), momentum, feedback hype, macro global (risk appetite, suku bunga, dollar, likuiditas, inflasi) + 8 **regime pasar** (Risk-On, Risk-Off, Stagflation, Melt-Up, Izzat, dst).
- **Order book sintetis**: spread + slippage tergantung depth, market impact (order besar menggeser harga), order Market/Limit/Stop/Stop-Limit, partial fill, IOC/GTC.
- **Posisi**: long/short, leverage 1-20x, margin, harga likuidasi, funding rate per 8 jam, fee taker/maker, margin call otomatis.
- **Advanced orders**: TP, SL, dan trailing stop per posisi. TP + SL aktif bersamaan (OCO); trailing mengikuti harga terbaik sejak dipasang. Semua kena notifikasi saat trigger.
- **Leaderboard AI**: 10 bot dengan strategi sendiri (momentum, contrarian, degen, kuant, whale, panik) yang trading otomatis, punya fee/slippage, dan ikut diperingkat bareng kamu.
- **Tantangan harian**: seed harian tetap, modal $100K, target +10% dalam 7 hari simulasi. Menang di tengah jalan langsung selesai; streak dan rekor tersimpan per hari.
- **Event/news engine**: 37 template berita (FOMC, CPI, ETF approval, hack, short squeeze, earnings, bankrupt, OPEC+, honeypot, dll) yang bikin shock dan mengubah korelasi antar aset.
- **Launchpad / shitcoin**: bonding curve constant-product, dev dump, honeypot (12% token terkunci), rug pull, graduasi ke spot, token rival AI yang luncur otomatis.
- **Chart canvas**: candlestick, EMA20/50, volume, pan-drag + pinch-zoom, timeframe 1J/4J/1H/1M.
- **Ekonomi dunia**: 12 negara, 8 komoditas, dan 96 pasar dengan harga/supply/demand per negara. Ada rute arbitrase, pengiriman antarnegara, pabrik, pasar gelap, serta progres XP/level.
- **Macro state** yang terlihat di top bar + equity curve di portfolio.

---

## Menjalankan lokal

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # output ke dist/
npm run preview    # serve dist/ di http://localhost:4173
npm run simtest    # headless test mesin simulasi
```

## Test headless

```bash
npm run simtest
```

Menjalankan 4000 tick simulasi, memeriksa NaN/infinite price, mencetak performa tiap kelas aset, dan mengetes bot AI, bracket order (TP/SL/trailing), tantangan harian, serta ekonomi dunia (beli/kirim komoditas, pabrik, pasar gelap).

Mau simulasi lebih singkat? Set env `TICKS`:

```powershell
$env:TICKS=800; npm run simtest
```

---

## Install ke iPhone

### Opsi A — GitHub Pages (live, HTTPS + offline)

**Live:** https://insecd.github.io/ShiX/

1. Buka URL di atas lewat **Safari** di iPhone.
2. Tap tombol **Share** → **Add to Home Screen** → **Add**.
3. Selesai — ikon "ShiX" jalan fullscreen & offline.

> Deploy otomatis tiap `git push` ke `main` (workflow `.github/workflows/deploy.yml`).
> Repo: https://github.com/inSecD/ShiX

> HTTPS wajib untuk service worker (offline). Lewat HTTP LAN, ikon tetap bisa dipasang tapi tidak bisa offline.

### Opsi B — LAN lokal (cepat, tanpa akun)

PC dan iPhone di Wi-Fi yang sama:

```bash
npm run preview
# buka http://<IP-PC>:4173 di Safari iPhone
```

Tap **Share → Add to Home Screen**. Karena domain HTTP → service worker nonaktif (butuh HTTPS).

---

## Cara main

Navigasi bawah punya 5 tab: **Home**, **Market**, **World**, **Porto**, **Rank**. Menu **More** tetap tersedia lewat ikon `☰` di top bar.

| Tab | Isi |
|---|---|
| **Home** | Dashboard: net worth & return, cash/margin/unrealized/realized, tantangan harian, top mover, posisi terbuka, cuplikan klasemen, dan ringkasan Dunia. |
| **Market** | Chart + order ticket (side, tipe order, nilai USD, leverage, preview fill/slippage/margin/likuidasi) + daftar instrumen. Tap baris → chart & trade card instrumen itu. |
| **World** | Peta dagang 12 negara, harga komoditas per negara, peluang arbitrase, pengiriman, pabrik, dan pasar gelap. |
| **Porto** | Equity curve, posisi (termasuk bracket aktif), open orders, riwayat transaksi, dan aset dunia. |
| **Rank** | Papan peringkat kamu vs 10 bot AI, holding tiap bot, dan progres tantangan harian. |
| **More** | Menu ke Berita, Launchpad, Setelan, dan Trade Klasik (chart penuh + order ticket satu layar). |

**Tips:**
- Saham & index hanya bergerak saat jam bursa (Sen–Sel 13:30–20:00 UTC). Crypto 24/7. Forex tutup akhir pekan.
- `1x` di top bar = kecepatan simulasi (1 tick = 1 jam pasar). `❚❚` = pause.
- Di Market, tap instrumen untuk memilih; chart dan trade card langsung terisi. Di mobile, trade card ada di bawah daftar instrumen.
- Margin call terjadi kalau harga sentuh harga likuidasi. Margin di-capped, jadi gap besar tidak bikin akun negatif tanpa batas.
- Order di book tipis (shitcoin) kena slippage besar — cek kolom "Kedalaman book" sebelum order.
- Watchlist: tap `☆ Tambah` di header chart.
- Bracket: isi TP/SL lalu **Simpan Bracket**. TP dan SL otomatis OCO — salah satu kena, posisi ditutup. Trailing % dihitung dari harga terbaik sejak bracket dipasang.
- Tantangan harian punya seed tetap per tanggal. Target +10% dalam 7 hari simulasi; kalau target kena lebih awal, tantangan langsung lolos. Sisa waktu dan streak tampil di bar bawah top bar.
- Di **World**, pilih negara di bawah peta untuk melihat harga lokal. Tab **Logistik** menampilkan rute dengan spread dan ongkos; kirim barang butuh waktu dan modal, lalu stok tiba di negara tujuan. Tab **Industri** untuk membangun pabrik di Indonesia; tab **Pasar Gelap** terbuka di level 5 dan punya risiko penyitaan.

---

## Struktur

```
src/
  sim/        engine.ts (tick/price), trading.ts (order+posisi+bracket),
              world.ts (ekonomi negara/komoditas/logistik/pabrik/pasar gelap),
              bots.ts (10 bot AI), launchpad.ts (bonding curve/rug),
              events.ts (news), universe.ts (instrumen), names.ts (nama dipleset), rng.ts
  ui/         HomeView, MarketScreen, ChartView, MarketView, TradePanel,
              WorldView, PortfolioView, RankView, DailyBar, NewsView, LaunchpadView,
              SettingsView, MoreView, TopBar, BottomNav
  store.ts    zustand store + loop simulasi + persistensi
  lib/        format.ts, persist.ts (localStorage + gzip)
scripts/      gen-icons.mjs (generator ikon PNG), simtest.ts
```

## Lisensi & disclaimer

Kode bebas dipakai. Konten game sepenuhnya fiksi — bukan nasihat finansial.
