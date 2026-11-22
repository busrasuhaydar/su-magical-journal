import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ExternalLink, Search } from 'lucide-react';
import { PageHead } from '../components/Shell';
import { Empty } from '../components/ui';

interface Nft {
  collection: string; contract: string; tokenId: string; name: string; description: string;
  thumb: string | null; opensea: string; superrare: string | null;
}

export default function NftCollectionsPage() {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState<string | null>(null);
  const data = useQuery({
    queryKey: ['nft-collections'], staleTime: Infinity,
    queryFn: async (): Promise<Nft[]> => (await fetch(`${import.meta.env.BASE_URL}koleksiyonlar.json`)).json(),
  });
  const groups = useMemo(() => {
    const t = q.trim().toLocaleLowerCase('tr');
    const m = new Map<string, Nft[]>();
    for (const n of data.data ?? []) {
      if (t && !`${n.name} ${n.description} ${n.collection}`.toLocaleLowerCase('tr').includes(t)) continue;
      m.set(n.collection, [...(m.get(n.collection) ?? []), n]);
    }
    return [...m.entries()].sort((a, b) => b[1].length - a[1].length);
  }, [data.data, q]);

  return (
    <>
      <PageHead title="Koleksiyonlarım">
        <div className="row" style={{ position: 'relative' }}>
          <Search size={15} style={{ position: 'absolute', left: 12, color: 'var(--ink-500)' }} />
          <input className="input" style={{ paddingLeft: 34, width: 260 }} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Eser ara…" />
        </div>
        <a className="btn btn-glass btn-sm" href="https://opensea.io/busrasuhaydar" target="_blank" rel="noreferrer">OpenSea <ExternalLink size={13} /></a>
        <a className="btn btn-glass btn-sm" href="https://superrare.com/busrasuhaydar" target="_blank" rel="noreferrer">SuperRare <ExternalLink size={13} /></a>
      </PageHead>
      {data.isLoading ? <p className="muted">Yükleniyor…</p> : groups.length === 0 ? <Empty title="Sonuç yok">Aramayı değiştir.</Empty> : (
        <>
          <div className="row">{groups.map(([c, l]) => <a key={c} className="chip" href={`#c-${encodeURIComponent(c)}`}>{c} · {l.length}</a>)}</div>
          {groups.map(([c, list]) => (
            <section key={c} id={`c-${encodeURIComponent(c)}`} className="glass panel">
              <div className="panel-head"><h2>{c}</h2><span className="count">{list.length}</span></div>
              <div className="nft-grid">
                {list.map((n) => {
                  const id = `${n.contract}-${n.tokenId}`;
                  return (
                    <article key={id} className="nft-card">
                      <div className="nft-img">{n.thumb ? <img src={n.thumb} alt={n.name} loading="lazy" /> : null}</div>
                      <b>{n.name}</b>
                      {n.description && <p className={`small muted nft-desc${open === id ? ' open' : ''}`} onClick={() => setOpen(open === id ? null : id)}>{n.description}</p>}
                      <div className="row" style={{ gap: 6, marginTop: 'auto' }}>
                        <a className="btn btn-glass btn-sm" href={n.opensea} target="_blank" rel="noreferrer">OpenSea</a>
                        {n.superrare && <a className="btn btn-glass btn-sm" href={n.superrare} target="_blank" rel="noreferrer">SuperRare</a>}
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          ))}
        </>
      )}
    </>
  );
}
