import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ExternalLink, FolderOpen, Search, Shuffle } from 'lucide-react';
import { PageHead } from '../components/Shell';
import { Card, Lightbox, nftKey } from '../components/NftLightbox';
import { useEnsureCollectionProjects, useNfts, type Nft, type NftData as Data } from '../lib/nft';
import { Empty } from '../components/ui';

const norm = (s: string) => s.toLocaleLowerCase('tr');
const key = nftKey;

export default function NftCollectionsPage() {
  const { slug } = useParams();
  const data = useNfts();
  useEnsureCollectionProjects();
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
        <Link className="btn btn-primary btn-sm" to={`/projeler/koleksiyon-${slug}`}><FolderOpen size={14} />Proje: sayfalar, görevler</Link>
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
