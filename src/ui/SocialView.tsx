import { useMemo, useState } from 'react';
import { useStore } from '../store';
import { parseMention } from '../sim/mentions';
import { postCooldownLeft } from '../sim/profile';
import { hashString } from '../sim/rng';
import type { FeedPost, PostMedia } from '../sim/types';

type FeedTab = 'fyp' | 'following' | 'explore';

/** "3j lalu" dari selisih milidetik */
function fmtAgo(deltaMs: number): string {
  const h = Math.floor(deltaMs / 3_600_000);
  if (h < 1) return 'baru saja';
  if (h < 24) return `${h}j lalu`;
  return `${Math.floor(h / 24)}h lalu`;
}

/** angka pendek: 950 → 950, 12400 → 12,4rb, 1200000 → 1,2jt */
function fmtN(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace('.', ',')}jt`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace('.', ',')}rb`;
  return String(n);
}

/** views post = estimasi deterministik dari like + isi post (ala X "views") */
function viewsOf(post: FeedPost): number {
  const h = hashString(post.id + post.text);
  return post.likes * (8 + (h % 15)) + 30 + (h % 600);
}

// ---------- media ----------

function ArtMedia({ media }: { media: Extract<PostMedia, { kind: 'art' }> }) {
  const h = hashString(media.seed || 'art');
  const hue1 = h % 360;
  const hue2 = (hue1 + 35 + ((h >> 9) % 70)) % 360;
  const x = 20 + ((h >> 4) % 60);
  const y = 25 + ((h >> 12) % 50);
  return (
    <div
      className="sx-art"
      style={{
        background:
          `radial-gradient(circle at ${x}% ${y}%, hsl(${hue2} 85% 60% / 0.55), transparent 55%),` +
          `linear-gradient(135deg, hsl(${hue1} 55% 26%), hsl(${hue2} 65% 42%))`
      }}
    >
      <span className="sx-art-emoji">{media.emoji}</span>
      <span className="sx-art-mark">shiX</span>
    </div>
  );
}

function ChartMedia({ instId }: { instId: string }) {
  const sim = useStore((s) => s.sim);
  const v = useStore((s) => s.v);
  void v;
  const inst = sim.instruments[instId];

  const candles = inst?.candles ?? [];
  const last = candles.length ? candles[candles.length - 1].c : 0;
  const first = candles.length ? candles[Math.max(0, candles.length - 60)].c : 0;
  const up = last >= first;

  return (
    <div className="sx-chart">
      <canvas
        ref={(cv) => {
          if (!cv) return;
          const dpr = Math.min(2, window.devicePixelRatio || 1);
          const w = cv.clientWidth || 320;
          const h = 148;
          cv.width = w * dpr;
          cv.height = h * dpr;
          const g = cv.getContext('2d');
          if (!g) return;
          g.setTransform(dpr, 0, 0, dpr, 0, 0);
          g.clearRect(0, 0, w, h);

          const pts = candles.slice(-60).map((c) => c.c);
          if (pts.length < 2) return;
          const min = Math.min(...pts);
          const max = Math.max(...pts);
          const span = max - min || 1;
          const px = (i: number) => 8 + (i / (pts.length - 1)) * (w - 16);
          const py = (p: number) => 14 + (1 - (p - min) / span) * (h - 34);

          // garis + isi gradien
          const col = up ? '#2fd08a' : '#ff5d73';
          g.beginPath();
          pts.forEach((p, i) => (i ? g.lineTo(px(i), py(p)) : g.moveTo(px(i), py(p))));
          g.strokeStyle = col;
          g.lineWidth = 2;
          g.stroke();
          g.lineTo(px(pts.length - 1), h - 6);
          g.lineTo(px(0), h - 6);
          g.closePath();
          const grad = g.createLinearGradient(0, 0, 0, h);
          grad.addColorStop(0, up ? 'rgba(47,208,138,0.35)' : 'rgba(255,93,115,0.35)');
          grad.addColorStop(1, 'rgba(0,0,0,0)');
          g.fillStyle = grad;
          g.fill();

          // label harga
          g.font = '700 11px ui-monospace, monospace';
          g.fillStyle = col;
          g.fillText(`${inst?.tag ?? instId}  ${inst ? inst.price.toFixed(inst.price < 1 ? 5 : 2) : ''}`, 8, 12);
        }}
      />
    </div>
  );
}

function MediaView({ media }: { media: PostMedia }) {
  if (media.kind === 'art') return <ArtMedia media={media} />;
  return <ChartMedia instId={media.instId} />;
}

// ---------- post ----------

interface PostProps {
  post: FeedPost;
}

function PostCard({ post }: PostProps) {
  const sim = useStore((s) => s.sim);
  const v = useStore((s) => s.v);
  void v;
  const likePost = useStore((s) => s.likePost);
  const repostPost = useStore((s) => s.repostPost);
  const toggleFollow = useStore((s) => s.toggleFollow);

  const bot = sim.bots.find((b) => b.id === post.authorId);
  const following = bot ? sim.profile.following.includes(bot.id) : false;
  const verified = !!bot && bot.followers >= 10000;
  const parent = post.replyTo ? sim.feed.posts.find((p) => p.id === post.replyTo) : null;
  const views = viewsOf(post);

  return (
    <article className={`sx-post${post.authorId === 'you' ? ' me' : ''}`}>
      <span className="sx-av">{post.emoji}</span>
      <div className="sx-main">
        <div className="sx-meta">
          <b className="sx-name">{post.name}</b>
          {verified && <span className="sx-verified" title="akun terverifikasi">✓</span>}
          <span className="sx-handle">@{post.handle}</span>
          <span className="sx-dot">·</span>
          <span className="sx-time">{fmtAgo(sim.simTime - post.t)}</span>
          {bot && (
            <button
              className={`ct-follow${following ? ' on' : ''}`}
              onClick={() => toggleFollow(bot.id)}
            >
              {following ? '✓ Ikut' : '+ Ikuti'}
            </button>
          )}
        </div>
        {parent && <div className="sx-replyto">membalas @{parent.handle}</div>}
        <div className="sx-text">{post.text}</div>
        {post.media && <MediaView media={post.media} />}
        {post.reactions.length > 0 && (
          <div className="sx-replies">
            {post.reactions.slice(0, 3).map((r, i) => (
              <div className="sx-reply" key={i}>
                <span className="sx-reply-ico">{r.emoji}</span>
                <span>
                  <b>{r.name}</b> {r.text}
                </span>
              </div>
            ))}
          </div>
        )}
        <div className="sx-actions">
          <button className="sx-act" title="Lihat">
            <span>💬</span>
            <span>{fmtN(post.replies)}</span>
          </button>
          <button
            className={`sx-act${post.reposted ? ' on' : ''}`}
            title="Repost"
            onClick={() => repostPost(post.id)}
          >
            <span>🔁</span>
            <span>{fmtN(post.reposts)}</span>
          </button>
          <button
            className={`sx-act like${post.liked ? ' on' : ''}`}
            title="Suka"
            onClick={() => likePost(post.id)}
          >
            <span>{post.liked ? '❤️' : '🤍'}</span>
            <span>{fmtN(post.likes)}</span>
          </button>
          <button className="sx-act" title="Dilihat">
            <span>👁</span>
            <span>{fmtN(views)}</span>
          </button>
        </div>
      </div>
    </article>
  );
}

// ---------- composer ----------

function Composer() {
  const sim = useStore((s) => s.sim);
  const v = useStore((s) => s.v);
  void v;
  const publishPost = useStore((s) => s.publishPost);

  const [draft, setDraft] = useState('');
  const [attach, setAttach] = useState<'none' | 'art' | 'chart'>('none');
  const [menu, setMenu] = useState(false);

  const wait = postCooldownLeft(sim);
  const mention = draft.trim() ? parseMention(sim, draft) : null;
  const profile = sim.profile;

  const mediaFor = (): PostMedia | null => {
    if (attach === 'chart' && mention) {
      return { kind: 'chart', instId: mention.instId, seed: `me${Date.now()}` };
    }
    if (attach === 'art') {
      const h = hashString(draft || 'post');
      const emoji = ['🎨', '🌆', '🖼️', '📸', '🌇'][h % 5];
      return { kind: 'art', seed: `me${Date.now()}`, emoji };
    }
    return null;
  };

  const doPost = () => {
    if (wait > 0 || !draft.trim()) return;
    publishPost(draft, mediaFor());
    setDraft('');
    setAttach('none');
    setMenu(false);
  };

  return (
    <div className="sx-composer">
      <div className="sx-me-row">
        <span className="sx-av big">😎</span>
        <div>
          <b>Kamu</b> <span className="sx-handle">@kamu</span>
          <div className="tiny muted">
            {fmtN(profile.followers)} followers · {profile.following.length} following · ⭐{' '}
            {Math.round(profile.fame)}
          </div>
        </div>
      </div>
      <textarea
        className="ct-input"
        rows={2}
        maxLength={180}
        placeholder="Apa yang terjadi?"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
      />
      {attach !== 'none' && (
        <div className="sx-attach-prev">
          <span className="tiny muted">
            {attach === 'chart' && mention
              ? `📈 nempel chart $${mention.instId}`
              : attach === 'art'
                ? '🎨 gambar nempel'
                : ''}
          </span>
          <button className="ghost tiny" onClick={() => setAttach('none')}>
            Lepas
          </button>
        </div>
      )}
      <div className="ct-composer-row">
        <div className="sx-tools">
          <button className="ghost tiny" onClick={() => setMenu((m) => !m)}>
            🖼️ Media
          </button>
          {menu && (
            <div className="sx-menu">
              <button
                className="ghost tiny"
                onClick={() => {
                  setAttach('art');
                  setMenu(false);
                }}
              >
                🎨 Gambar
              </button>
              <button
                className="ghost tiny"
                disabled={!mention}
                title={mention ? '' : 'Sebut koin dulu di teks (mis. weekend)'}
                onClick={() => {
                  setAttach('chart');
                  setMenu(false);
                }}
              >
                📈 Chart {mention ? `$${mention.instId}` : ''}
              </button>
            </div>
          )}
          <span className="tiny muted">
            {draft.length}/180 · {wait > 0 ? `cooldown ${wait}j` : 'siap ngepost'}
          </span>
        </div>
        <button
          className="primary"
          disabled={wait > 0 || !draft.trim()}
          onClick={doPost}
        >
          Post
        </button>
      </div>
    </div>
  );
}

// ---------- view ----------

export function SocialView() {
  const sim = useStore((s) => s.sim);
  const v = useStore((s) => s.v);
  void v;
  const toggleFollow = useStore((s) => s.toggleFollow);

  const [tab, setTab] = useState<FeedTab>('fyp');
  const [query, setQuery] = useState('');

  const posts = sim.feed.posts;
  const followingSet = useMemo(() => new Set(sim.profile.following), [sim.profile.following]);

  const shown = useMemo(() => {
    if (tab === 'following') {
      return posts.filter((p) => p.authorId === 'you' || followingSet.has(p.authorId));
    }
    if (tab === 'explore' && query.trim()) {
      const q = query.trim().toLowerCase().replace(/^\$/, '');
      return posts.filter(
        (p) =>
          p.text.toLowerCase().includes(q) ||
          p.name.toLowerCase().includes(q) ||
          p.handle.toLowerCase().includes(q) ||
          (p.tag ?? '').toLowerCase().includes(q) ||
          (p.mention ?? '').toLowerCase().includes(q)
      );
    }
    return posts;
  }, [posts, tab, query, followingSet]);

  // trending: tag yang paling sering disebut di feed
  const trending = useMemo(() => {
    const count = new Map<string, number>();
    for (const p of posts) {
      const t = p.tag ?? p.mention;
      if (t) count.set(t, (count.get(t) ?? 0) + 1);
    }
    return [...count.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
  }, [posts]);

  // orang paling populer di kota
  const popular = useMemo(
    () => [...sim.bots].sort((a, b) => b.followers - a.followers).slice(0, 5),
    [sim.bots]
  );

  return (
    <div className="sx">
      <div className="sx-top">
        <span className="sx-logo">🐦 CT</span>
        <div className="sx-tabs">
          {(
            [
              ['fyp', 'For You'],
              ['following', 'Mengikuti'],
              ['explore', 'Jelajahi']
            ] as [FeedTab, string][]
          ).map(([id, label]) => (
            <button
              key={id}
              className={`sx-tab${tab === id ? ' on' : ''}`}
              onClick={() => setTab(id)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {tab === 'explore' && (
        <div className="sx-search">
          <input
            className="ct-input"
            placeholder="Cari orang, koin, atau topik…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {!query.trim() && (
            <>
              <div className="sx-sec">🔥 Lagi rame</div>
              <div className="sx-trend-row">
                {trending.map(([tag, n]) => (
                  <button key={tag} className="sx-trend" onClick={() => setQuery(tag)}>
                    <b>${tag}</b>
                    <span className="tiny muted">{fmtN(n * 37)} post</span>
                  </button>
                ))}
                {trending.length === 0 && (
                  <span className="tiny muted">Belum ada yang rame… biarin sim jalan dulu.</span>
                )}
              </div>
              <div className="sx-sec">👥 Orang populer</div>
              {popular.map((b) => {
                const following = followingSet.has(b.id);
                return (
                  <div className="sx-person" key={b.id}>
                    <span className="sx-av">{b.emoji}</span>
                    <div className="sx-person-id">
                      <b>{b.name}</b> {b.followers >= 10000 && <span className="sx-verified">✓</span>}
                      <div className="tiny muted">
                        @{b.handle} · {fmtN(b.followers)} followers
                      </div>
                    </div>
                    <button
                      className={`ct-follow${following ? ' on' : ''}`}
                      onClick={() => toggleFollow(b.id)}
                    >
                      {following ? '✓ Ikut' : '+ Ikuti'}
                    </button>
                  </div>
                );
              })}
            </>
          )}
        </div>
      )}

      {tab !== 'explore' && <Composer />}

      <div className="sx-feed">
        {shown.map((p) => (
          <PostCard post={p} key={p.id} />
        ))}
        {shown.length === 0 && (
          <div className="sx-empty">
            {tab === 'following'
              ? 'Belum ikutin siapa pun. Tap “+ Ikuti” di post buat ngisi tab ini.'
              : 'Belum ada post di sini. Biarin sim jalan dulu…'}
          </div>
        )}
      </div>
    </div>
  );
}
