import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, ChevronLeft, ChevronRight, Copy, Download, ExternalLink, Expand, Search, Shuffle, X } from 'lucide-react';
import { PageHead } from '../components/Shell';
import { Empty, useToast } from '../components/ui';

interface Nft { c: string; contract: string; tokenId: string; name: string; description: string; thumb: string | null; original: string | null; video: string | null; file: string | null; opensea: string; superrare: string | null }
interface Col { name: string; slug: string; description: string }
interface Data { collections: Col[]; items: Nft[] }

function useNfts() {
  return useQuery({ queryKey: ['nft-data'], staleTime: Infinity, queryFn: async (): Promise<Data> => {
    const d: Data = await (await fetch(`${import.meta.env.BASE_URL}koleksiyonlar.json`)).json();
    const n = new Map<string, number>(); d.items.forEach((i) => n.set(i.c, (n.get(i.c) ?? 0) + 1));
    d.collections.sort((a, b) => (n.get(b.slug) ?? 0) - (n.get(a.slug) ?? 0));
    return d;
  } });
}
const norm = (s: string) => s.toLocaleLowerCase('tr');
const key = (n: Nft) => `${n.contract}-${n.tokenId}`;

function useCopy() {
  const toast = useToast();
  return async (text: string, what: string) => {
    try { await navigator.clipboard.writeText(text); toast.ok(`${what} kopyalandı`); }
    catch { const t = document.createElement('textarea'); t.value = text; document.body.appendChild(t); t.select(); document.execCommand('copy'); t.remove(); toast.ok(`${what} kopyalandı`); }
  };
}

function LinkRow({ label, url, compact }: { label: string; url: string; compact?: boolean }) {
  const copy = useCopy();
  return (
    <div className="lrow" onClick={(e) => e.stopPropagation()}>
      <a className={`btn btn-glass btn-sm${compact ? ' lr-a' : ''}`} href={url} target="_blank" rel="noreferrer">{label}<ExternalLink size={12} /></a>
      <button type="button" className="btn btn-glass btn-sm icon-btn lr-c" aria-label={`${label} linkini kopyala`} title="Linki kopyala" onClick={() => copy(url, `${label} linki`)}><Copy size={13} /></button>
    </div>
  );
}

function Card({ n, onOpen }: { n: Nft; onOpen: () => void }) {
  return (
    <article className="nft-card" onClick={onOpen} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && onOpen()}>
      <div className="nft-img">{n.thumb && <img src={n.thumb} alt={n.name} loading="lazy" />}<span className="nft-zoom"><Expand size={15} /></span></div>
      <b>{n.name}</b>
      <div className="stack-links">
        <LinkRow label="OpenSea" url={n.opensea} compact />
        {n.superrare && <LinkRow label="SuperRare" url={n.superrare} compact />}
      </div>
    </article>
  );
}

function Lightbox({ items, index, setIndex, onClose }: { items: Nft[]; index: number; setIndex: (i: number) => void; onClose: () => void }) {
  const n = items[index];
  const copy = useCopy();
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [zoom, setZoom] = useState(false);
  const strip = useRef<HTMLDivElement>(null);
  const touch = useRef<number | null>(null);
  const go = useCallback((d: number) => setIndex((index + d + items.length) % items.length), [index, items.length, setIndex]);
  useEffect(() => { setLoaded(false); setFailed(false); setZoom(false); }, [index]);
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); else if (e.key === 'ArrowRight') go(1); else if (e.key === 'ArrowLeft') go(-1); };
    document.addEventListener('keydown', k);
    const prev = document.body.style.overflow; document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', k); document.body.style.overflow = prev; };
  }, [go, onClose]);
  useEffect(() => { strip.current?.querySelector('.on')?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' }); }, [index]);
  // komşu görselleri önceden yükle
  useEffect(() => { [1, -1].forEach((d) => { const m = items[(index + d + items.length) % items.length]; if (m?.original) new Image().src = m.original; }); }, [index, items]);
  const from = Math.max(0, index - 25), to = Math.min(items.length, index + 26);
  const src = failed || !n.original ? n.thumb : n.original;
  const detail = [`${n.name}`, n.description, n.opensea, n.superrare].filter(Boolean).join('\n\n');
  return (
    <div className="lb" role="dialog" aria-modal="true" aria-label={n.name}>
      <div className="lb-bg" onClick={onClose} />
      <button type="button" className="lb-x btn btn-glass icon-btn" onClick={onClose} aria-label="Kapat"><X size={18} /></button>
      <button type="button" className="lb-nav l btn btn-glass icon-btn" onClick={() => go(-1)} aria-label="Önceki"><ChevronLeft size={20} /></button>
      <button type="button" className="lb-nav r btn btn-glass icon-btn" onClick={() => go(1)} aria-label="Sonraki"><ChevronRight size={20} /></button>
      <div className="lb-card glass">
        <div className={`lb-stage${zoom ? ' zoom' : ''}`} onTouchStart={(e) => { touch.current = e.touches[0].clientX; }}
          onTouchEnd={(e) => { if (touch.current != null && !zoom) { const dx = e.changedTouches[0].clientX - touch.current; if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1); } touch.current = null; }}>
          {n.thumb && !loaded && <img className="lb-ph" src={n.thumb} alt="" />}
          {src && <img key={src} className="lb-img" src={src} alt={n.name} onLoad={() => setLoaded(true)} onError={() => { if (!failed && n.thumb) setFailed(true); }} onClick={() => setZoom((z) => !z)} style={{ opacity: loaded ? 1 : 0, cursor: zoom ? 'zoom-out' : 'zoom-in' }} />}
          {!loaded && <span className="lb-spin">Orijinal yükleniyor…</span>}
        </div>
        <div className="lb-info">
          <div className="small muted">{index + 1} / {items.length} · #{n.tokenId}</div>
          <h2>{n.name}</h2>
          {n.description && <p className="lb-desc">{n.description}</p>}
          <div className="lb-actions">
            <div className="lb-grp"><span className="small muted">OpenSea</span>
              <div className="row" style={{ gap: 6 }}><a className="btn btn-primary btn-sm" href={n.opensea} target="_blank" rel="noreferrer">OpenSea'de aç <ExternalLink size={13} /></a><button type="button" className="btn btn-glass btn-sm" onClick={() => copy(n.opensea, 'OpenSea linki')}><Copy size={13} />Linki kopyala</button></div></div>
            {n.superrare && <div className="lb-grp"><span className="small muted">SuperRare</span>
              <div className="row" style={{ gap: 6 }}><a className="btn btn-primary btn-sm" href={n.superrare} target="_blank" rel="noreferrer">SuperRare'de aç <ExternalLink size={13} /></a><button type="button" className="btn btn-glass btn-sm" onClick={() => copy(n.superrare!, 'SuperRare linki')}><Copy size={13} />Linki kopyala</button></div></div>}
            <div className="row" style={{ gap: 6 }}>
              {n.original && <a className="btn btn-glass btn-sm" href={n.original} target="_blank" rel="noreferrer"><Expand size={13} />Orijinal dosya</a>}
              {n.video && <a className="btn btn-glass btn-sm" href={n.video} target="_blank" rel="noreferrer"><Download size={13} />Video / animasyon</a>}
              <button type="button" className="btn btn-glass btn-sm" onClick={() => copy(detail, 'Ad ve açıklama')}><Copy size={13} />Ad + açıklama</button>
            </div>
          </div>
        </div>
        <div className="lb-strip" ref={strip}>
          {items.slice(from, to).map((m, k) => (
            <button type="button" key={key(m)} className={from + k === index ? 'on' : ''} onClick={() => setIndex(from + k)} aria-label={m.name}>{m.thumb && <img src={m.thumb} alt="" loading="lazy" />}</button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function NftCollectionsPage() {
  const { slug } = useParams();
  const data = useNfts();
  if (data.isLoading) return <><PageHead title="Koleksiyonlarım" /><p className="muted">Yükleniyor…</p></>;
  if (!data.data) return <Empty title="Veri yüklenemedi">Sayfayı yenile.</Empty>;
  return slug ? <CollectionView data={data.data} slug={slug} /> : <Overview data={data.data} />;
}

function Overview({ data }: { data: Data }) {
  const [q, setQ] = useState('');
  const [lb, setLb] = useState<number | null>(null);
  const nav = useNavigate();
  const by = useMemo(() => { const m = new Map<string, Nft[]>(); data.items.forEach((i) => m.set(i.c, [...(m.get(i.c) ?? []), i])); return m; }, [data]);
  const found = useMemo(() => { const t = norm(q.trim()); return t ? data.items.filter((n) => norm(`${n.name} ${n.description}`).includes(t)) : []; }, [q, data]);
  const sr = data.items.filter((i) => i.superrare).length;
  function surprise() { const i = Math.floor(Math.random() * data.items.length); setQ(''); setLb(-1 - i); }
  const lbItems = lb != null && lb < 0 ? data.items : found;
  const lbIndex = lb == null ? 0 : lb < 0 ? -1 - lb : lb;
  return (
    <>
      <PageHead title="Koleksiyonlarım">
        <div className="row" style={{ position: 'relative' }}>
          <Search size={15} style={{ position: 'absolute', left: 12, color: 'var(--ink-500)' }} />
          <input className="input" style={{ paddingLeft: 34, width: 260 }} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tüm eserlerde ara…" />
        </div>
        <button type="button" className="btn btn-glass btn-sm" onClick={surprise}><Shuffle size={14} />Beni şaşırt</button>
        <a className="btn btn-glass btn-sm" href="https://opensea.io/busrasuhaydar" target="_blank" rel="noreferrer">OpenSea <ExternalLink size={13} /></a>
        <a className="btn btn-glass btn-sm" href="https://superrare.com/busrasuhaydar" target="_blank" rel="noreferrer">SuperRare <ExternalLink size={13} /></a>
      </PageHead>
      <div className="row">
        {data.collections.map((c) => <Link key={c.slug} className="chip" to={`/koleksiyonlar/${c.slug}`}>{c.name} · {by.get(c.slug)?.length ?? 0}</Link>)}
      </div>
      <div className="stat-row">
        <div className="stat"><b>{data.items.length}</b><span>Eser</span></div>
        <div className="stat"><b>{data.collections.length}</b><span>Koleksiyon</span></div>
        <div className="stat"><b>{sr}</b><span>SuperRare'de</span></div>
      </div>
      {q.trim() ? (
        <section className="glass panel">
          <div className="panel-head"><h2>Arama sonuçları</h2><span className="count">{found.length}</span></div>
          {found.length === 0 ? <Empty title="Sonuç yok">Başka bir kelime dene.</Empty> : <div className="nft-grid">{found.map((n, i) => <Card key={key(n)} n={n} onOpen={() => setLb(i)} />)}</div>}
        </section>
      ) : (
        <div className="col-grid">
          {data.collections.map((c) => {
            const list = by.get(c.slug) ?? [];
            const pv = [0, 1, 2, 3].map((k) => list[Math.floor((list.length / 4) * k)]).filter(Boolean);
            return (
              <Link key={c.slug} to={`/koleksiyonlar/${c.slug}`} className="col-card glass">
                <div className={`mosaic m${pv.length}`}>{pv.map((p) => <img key={key(p)} src={p.thumb ?? ''} alt="" loading="lazy" />)}</div>
                <div className="col-meta">
                  <h3>{c.name}</h3>
                  <span className="small muted">{list.length} eser{list.some((l) => l.superrare) ? ' · SuperRare' : ''}</span>
                  {c.description && <p className="small muted col-d">{c.description.replace(/\s+/g, ' ')}</p>}
                </div>
              </Link>
            );
          })}
        </div>
      )}
      {lb != null && lbItems.length > 0 && <Lightbox items={lbItems} index={lbIndex} setIndex={(i) => setLb(lb < 0 ? -1 - i : i)} onClose={() => setLb(null)} />}
      <button type="button" className="sr-only" onClick={() => nav('/koleksiyonlar')}>Başa dön</button>
    </>
  );
}

function CollectionView({ data, slug }: { data: Data; slug: string }) {
  const col = data.collections.find((c) => c.slug === slug);
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<'no' | 'ad' | 'son'>('no');
  const [sp, setSp] = useSearchParams();
  const list = useMemo(() => {
    let l = data.items.filter((i) => i.c === slug);
    const t = norm(q.trim());
    if (t) l = l.filter((n) => norm(`${n.name} ${n.description}`).includes(t));
    const num = (n: Nft) => Number(n.tokenId) || 0;
    return [...l].sort(sort === 'ad' ? (a, b) => a.name.localeCompare(b.name, 'tr') : sort === 'son' ? (a, b) => num(b) - num(a) : (a, b) => num(a) - num(b));
  }, [data, slug, q, sort]);
  const open = sp.get('eser');
  const idx = open ? list.findIndex((n) => n.tokenId === open.split('-').pop() && n.contract.toLowerCase().startsWith(open.split('-')[0])) : -1;
  const setOpen = (i: number | null) => { const n = new URLSearchParams(sp); if (i == null) n.delete('eser'); else n.set('eser', `${list[i].contract.slice(0, 10).toLowerCase()}-${list[i].tokenId}`); setSp(n, { replace: true }); };
  if (!col) return <Empty title="Koleksiyon bulunamadı"><Link to="/koleksiyonlar">Koleksiyonlara dön</Link></Empty>;
  return (
    <>
      <PageHead title={col.name}>
        <Link className="btn btn-glass btn-sm" to="/koleksiyonlar"><ArrowLeft size={14} />Tüm koleksiyonlar</Link>
      </PageHead>
      <div className="row">
        {data.collections.map((c) => <Link key={c.slug} className={`chip${c.slug === slug ? ' chip-on' : ''}`} to={`/koleksiyonlar/${c.slug}`}>{c.name}</Link>)}
      </div>
      <section className="glass panel">
        {col.description && <p className="col-desc">{col.description}</p>}
        <div className="row" style={{ marginBottom: 14 }}>
          <div className="row" style={{ position: 'relative' }}>
            <Search size={15} style={{ position: 'absolute', left: 12, color: 'var(--ink-500)' }} />
            <input className="input" style={{ paddingLeft: 34, width: 240 }} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Bu koleksiyonda ara…" />
          </div>
          <div className="seg">{([['no', 'Eskiden yeniye'], ['son', 'Yeniden eskiye'], ['ad', 'A–Z']] as const).map(([v, l]) => <button key={v} type="button" className={sort === v ? 'on' : ''} onClick={() => setSort(v)}>{l}</button>)}</div>
          <span className="count">{list.length}</span>
        </div>
        {list.length === 0 ? <Empty title="Sonuç yok">Aramayı değiştir.</Empty> : <div className="nft-grid">{list.map((n, i) => <Card key={key(n)} n={n} onOpen={() => setOpen(i)} />)}</div>}
      </section>
      {idx >= 0 && <Lightbox items={list} index={idx} setIndex={(i) => setOpen(i)} onClose={() => setOpen(null)} />}
    </>
  );
}
