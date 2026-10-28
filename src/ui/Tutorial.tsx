import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useStore, type Tab } from '../store';

interface Step {
  id: string;
  tab?: Tab;
  target?: string;
  title: string;
  body: string;
}

const STEPS: Step[] = [
  {
    id: 'welcome',
    title: 'Selamat datang di ShiX 👋',
    body:
      'Lo lagi dikasih akun gratis buat jadi trader. Semua harga di sini fiksi. Ikutin tour singkat ini — ' +
      '6 langkah, kurang dari semenit.'
  },
  {
    id: 'networth',
    tab: 'home',
    target: 'networth',
    title: 'Net worth lo',
    body:
      'Angka utama di sini: total aset lo (cash + posisi + spot + komoditas). Semua keputusan diukur dari ' +
      'pergerakan angka ini.'
  },
  {
    id: 'speed',
    target: 'speed',
    title: 'Kecepatan pasar',
    body:
      'Market jalan terus. Tekan ❚❚ buat jeda kalau mau mikir, atau 5x/10x buat percepat. 1 tick = 1 jam ' +
      'waktu pasar.'
  },
  {
    id: 'nav-market',
    target: 'nav-market',
    title: 'Tab Market',
    body: 'Semua aset — saham, crypto, emas, forex — ada di sini. Tap aset buat buka chart + ticket.'
  },
  {
    id: 'market-list',
    tab: 'market',
    target: 'market-list',
    title: 'Daftar & chart',
    body:
      'Chart ada di atas, order ticket nempel di bawahnya. Scroll daftar buat cari aset lain, atau pakai ' +
      'filter di atas.'
  },
  {
    id: 'order-ticket',
    tab: 'trade',
    target: 'order-ticket',
    title: 'Order ticket',
    body:
      'Beli/jual di sini. Pilih Market/Limit, atur leverage, dan pasang TP/SL/trailing biar posisi keurus ' +
      'otomatis.'
  },
  {
    id: 'launch-panel',
    tab: 'launchpad',
    target: 'launch-panel',
    title: 'Launchpad',
    body:
      'Luncurkan token sendiri lewat bonding curve. Beli di curve, jual sebelum rug, atau bawa sampai ' +
      'graduasi listing di spot.'
  },
  {
    id: 'modes-scenarios',
    tab: 'modes',
    target: 'modes-scenarios',
    title: 'Misi & skenario',
    body:
      'Selesaikan misi latihan buat hadiah cash, lalu coba skenario pasar: Bull Run, Flash Crash, Black Swan, ' +
      'dan lainnya.'
  },
  {
    id: 'finish',
    title: 'Lo siap. 🚀',
    body:
      'Tutorial selesai. Mau ulang kapan aja lewat menu More → Tutorial. Selamat berburu profit — dan ' +
      'ingat: pakai SL biar nggak likuidasi.'
  }
];

interface Box {
  top: number;
  left: number;
  width: number;
  height: number;
}

const PAD = 6;

export function Tutorial() {
  const tutActive = useStore((s) => s.tutActive);
  const tutStep = useStore((s) => s.tutStep);
  const setTab = useStore((s) => s.setTab);
  const tutNext = useStore((s) => s.tutNext);
  const tutPrev = useStore((s) => s.tutPrev);
  const tutEnd = useStore((s) => s.tutEnd);

  const idx = Math.min(tutStep, STEPS.length - 1);
  const step = STEPS[idx];
  const [box, setBox] = useState<Box | null>(null);
  const [vp, setVp] = useState({ w: 360, h: 720 });
  const cardRef = useRef<HTMLDivElement | null>(null);
  const [cardH, setCardH] = useState(170);

  // follow viewport size
  useEffect(() => {
    const onResize = () => setVp({ w: window.innerWidth, h: window.innerHeight });
    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // jump to the tab this step talks about
  useEffect(() => {
    if (!tutActive) return;
    if (step.tab) setTab(step.tab);
  }, [tutActive, step, setTab]);

  // keep measuring the highlighted element (layout shifts as the sim ticks)
  useEffect(() => {
    if (!tutActive) {
      setBox(null);
      return;
    }
    const measure = () => {
      if (!step.target) {
        setBox(null);
        return;
      }
      const el = document.querySelector<HTMLElement>(`[data-tut="${step.target}"]`);
      if (!el) {
        setBox(null);
        return;
      }
      const r = el.getBoundingClientRect();
      setBox((prev) => {
        const next = {
          top: r.top - PAD,
          left: r.left - PAD,
          width: r.width + PAD * 2,
          height: r.height + PAD * 2
        };
        if (
          prev &&
          Math.abs(prev.top - next.top) < 1 &&
          Math.abs(prev.left - next.left) < 1 &&
          Math.abs(prev.width - next.width) < 1 &&
          Math.abs(prev.height - next.height) < 1
        ) {
          return prev;
        }
        return next;
      });
    };
    measure();
    const id = window.setInterval(measure, 180);
    return () => window.clearInterval(id);
  }, [tutActive, step]);

  // keep card height fresh for placement math
  useLayoutEffect(() => {
    if (cardRef.current) setCardH(cardRef.current.offsetHeight);
  });

  if (!tutActive) return null;

  const last = idx === STEPS.length - 1;
  const cardW = Math.min(330, vp.w - 24);

  // card placement: under the highlight if it fits, else above, else centered
  let cardTop = 0;
  let cardLeft = (vp.w - cardW) / 2;
  const onScreen = !!box && box.top < vp.h && box.top + box.height > 0;
  let centered = !onScreen;
  if (box && onScreen) {
    const below = box.top + box.height + 14;
    const above = box.top - cardH - 14;
    if (below + cardH <= vp.h - 12) {
      cardTop = below;
      centered = false;
    } else if (above >= 12) {
      cardTop = above;
      centered = false;
    } else {
      centered = true;
    }
    cardLeft = Math.min(Math.max(12, box.left + box.width / 2 - cardW / 2), vp.w - cardW - 12);
  }
  if (centered) {
    cardTop = Math.max(12, (vp.h - cardH) / 2);
    cardLeft = (vp.w - cardW) / 2;
  }

  const card = (
    <div
      ref={cardRef}
      className="tut-card"
      style={{ width: cardW, top: cardTop, left: cardLeft, position: 'fixed' }}
    >
      <div className="tut-dots">
        {STEPS.map((s, i) => (
          <span key={s.id} className={`tut-dot ${i === idx ? 'on' : ''} ${i < idx ? 'past' : ''}`} />
        ))}
      </div>
      <div className="tut-count">
        Langkah {idx + 1} / {STEPS.length}
      </div>
      <div className="tut-title">{step.title}</div>
      <div className="tut-body">{step.body}</div>
      <div className="tut-actions">
        <button className="ghost tiny" onClick={() => tutEnd(false)}>
          Lewati
        </button>
        <div className="row" style={{ gap: 6 }}>
          {idx > 0 && (
            <button className="tiny" onClick={tutPrev}>
              Kembali
            </button>
          )}
          <button className="primary tiny" onClick={() => (last ? tutEnd(true) : tutNext())}>
            {last ? 'Selesai ✓' : 'Lanjut →'}
          </button>
        </div>
      </div>
    </div>
  );

  if (!box) {
    return (
      <div className="tut-overlay">
        <div className="tut-dim" />
        {card}
      </div>
    );
  }

  const holeRight = box.left + box.width;
  const holeBottom = box.top + box.height;

  return (
    <div className="tut-overlay">
      <div className="tut-mask" style={{ top: 0, left: 0, width: vp.w, height: Math.max(0, box.top) }} />
      <div
        className="tut-mask"
        style={{ top: holeBottom, left: 0, width: vp.w, height: Math.max(0, vp.h - holeBottom) }}
      />
      <div
        className="tut-mask"
        style={{ top: box.top, left: 0, width: Math.max(0, box.left), height: box.height }}
      />
      <div
        className="tut-mask"
        style={{
          top: box.top,
          left: holeRight,
          width: Math.max(0, vp.w - holeRight),
          height: box.height
        }}
      />
      <div
        className="tut-ring"
        style={{ top: box.top, left: box.left, width: box.width, height: box.height }}
      />
      {card}
    </div>
  );
}
