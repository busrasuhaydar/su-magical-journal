// Ortak galeri: tüm projelerin, günlüğün ve paylaşımların görselleri tek yerde. Dosya bir kez saklanır, istediğiniz projeye bağlanır.
import { useMemo, useRef, useState, type DragEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Upload, X, FolderPlus } from 'lucide-react';
import { PageHead } from '../components/Shell';
import { Empty, formatBytes, useToast } from '../components/ui';
import { addToGallery, uploadFile, useFileLinks, useFiles, useProjects, useSignedUrl } from '../lib/data';
import { dayKeyOf, formatShort } from '../lib/dates';
import type { FileRec } from '../lib/types';
import { Thumb } from './project/Gallery';

export default function CommonGallery() {
  const files = useFiles();
  const links = useFileLinks();
  const projects = useProjects();
  const qc = useQueryClient();
  const toast = useToast();
  const [proj, setProj] = useState('');
  const [kind, setKind] = useState('');
  const [open, setOpen] = useState<FileRec | null>(null);
  const [over, setOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const visual = (f: FileRec) => f.mime.startsWith('image/') || f.mime.startsWith('video/');
  const projOf = (id: string) => (links.data ?? []).filter((l) => l.file_id === id && l.entity_type === 'project').map((l) => l.entity_id);
  const usedIn = (id: string) => {
    const ls = (links.data ?? []).filter((l) => l.file_id === id);
    return { journal: ls.some((l) => l.entity_type === 'journal_day'), post: ls.some((l) => l.entity_type === 'social_post') };
  };
  const list = useMemo(() => (files.data ?? []).filter((f) => visual(f) && (!kind || f.mime.startsWith(kind)) &&
    (!proj || (proj === 'none' ? projOf(f.id).length === 0 : projOf(f.id).includes(proj)))), [files.data, links.data, proj, kind]); // eslint-disable-line react-hooks/exhaustive-deps

  async function onFiles(fl: FileList | null) {
    if (!fl?.length) return; setBusy(true);
    try {
      for (const f of Array.from(fl)) { const { rec } = await uploadFile(f); if (proj && proj !== 'none') await addToGallery(rec.id, proj); }
      qc.invalidateQueries({ queryKey: ['files'] }); toast.ok('Galeriye eklendi');
    } catch (x) { toast.fail(x); } finally { setBusy(false); }
  }

  return (
    <>
      <PageHead title="Ortak Galeri">
        <select id="cg-proj" className="select" style={{ width: 'auto' }} value={proj} onChange={(e) => setProj(e.target.value)}>
          <option value="">Tüm görseller</option><option value="none">Projeye bağlı olmayanlar</option>
          {projects.data?.map((p) => <option key={p.id} value={p.id}>{p.icon ?? '✦'} {p.title}</option>)}
        </select>
        <div className="seg">{[['', 'Tümü'], ['image/', 'Görsel'], ['video/', 'Video']].map(([k, l]) => <button type="button" key={k} className={kind === k ? 'on' : ''} onClick={() => setKind(k)}>{l}</button>)}</div>
        <button type="button" className="btn btn-primary" disabled={busy} onClick={() => input.current?.click()}><Upload size={15} />{busy ? 'Yükleniyor…' : 'Yükle'}</button>
        <input ref={input} id="cg-in" type="file" multiple hidden accept="image/*,video/*" onChange={(e) => { onFiles(e.target.files); e.target.value = ''; }} />
      </PageHead>
      <p className="small muted" style={{ margin: 0 }}>Projelerdeki, günlükteki ve paylaşımlardaki bütün görseller burada. Bir görseli birden çok projeye bağlayabilirsiniz; kopya oluşmaz.{proj && proj !== 'none' ? ' Yüklediğiniz görseller seçili projeye de eklenir.' : ''}</p>
      <section className="glass panel" onDragOver={(e: DragEvent) => { if (e.dataTransfer.types.includes('Files')) { e.preventDefault(); setOver(true); } }} onDragLeave={() => setOver(false)} onDrop={(e: DragEvent) => { e.preventDefault(); setOver(false); onFiles(e.dataTransfer.files); }}>
        {over && <div className="dropzone over" style={{ marginBottom: 12 }}>Bırakın, galeriye eklensin</div>}
        {!files.isLoading && list.length === 0 ? <Empty title="Görsel yok">Görselleri buraya sürükleyin veya Yükle’ye basın.</Empty> : (
          <div className="pgal">
            {list.map((f) => {
              const ps = projOf(f.id).map((id) => projects.data?.find((p) => p.id === id)).filter(Boolean);
              const u = usedIn(f.id);
              return (
                <figure key={f.id} className="pgal-item" onClick={() => setOpen(f)} style={{ touchAction: 'auto' }}>
                  <div className="pgal-img"><Thumb file={f} /></div>
                  <figcaption>
                    <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis' }}>{f.title}</span>
                    <span className="small muted">{ps.length ? ps.map((p) => `${p!.icon ?? '✦'} ${p!.title}`).join(' · ') : 'Projesiz'}{u.post ? ' · paylaşımda' : ''}{u.journal ? ' · günlükte' : ''}</span>
                  </figcaption>
                </figure>
              );
            })}
          </div>
        )}
      </section>
      {open && <Viewer file={open} projectIds={projOf(open.id)} onClose={() => setOpen(null)} />}
    </>
  );
}

function Viewer({ file, projectIds, onClose }: { file: FileRec; projectIds: string[]; onClose: () => void }) {
  const u = useSignedUrl(file.storage_path);
  const projects = useProjects();
  const links = useFileLinks();
  const qc = useQueryClient();
  const toast = useToast();
  return (
    <div className="scrim lightbox" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="lb-body">
        <div className="lb-media">{u.data && (file.mime.startsWith('video/') ? <video src={u.data} controls autoPlay /> : <img src={u.data} alt={file.title} />)}</div>
        <aside className="lb-side">
          <div className="row" style={{ justifyContent: 'space-between' }}><b style={{ overflowWrap: 'anywhere' }}>{file.title}</b><button type="button" className="btn btn-ghost icon-btn" onClick={onClose} aria-label="Kapat"><X size={18} /></button></div>
          <span className="small muted">{formatBytes(file.size)} · {formatShort(dayKeyOf(file.created_at))}</span>
          <b className="small">Bağlı projeler</b>
          <div className="row">
            {projectIds.map((id) => { const p = projects.data?.find((x) => x.id === id); const l = links.data?.find((x) => x.file_id === file.id && x.entity_id === id); return p && (
              <span key={id} className="chip">{p.icon ?? '✦'} {p.title}<button type="button" aria-label="Projeden kaldır" style={{ border: 0, background: 'none', cursor: 'pointer', padding: 0 }}
                onClick={async () => { if (!l) return; const { error } = await (await import('../lib/supabase')).supabase.from('file_links').delete().eq('id', l.id); if (error) toast.fail(error); else qc.invalidateQueries({ queryKey: ['files'] }); }}>×</button></span>
            ); })}
            {!projectIds.length && <span className="small muted">Henüz yok</span>}
          </div>
          <label className="field"><span className="row" style={{ gap: 6 }}><FolderPlus size={14} />Projenin galerisine ekle</span>
            <select id="cg-add" className="select" value="" onChange={async (e) => { if (!e.target.value) return; try { await addToGallery(file.id, e.target.value); qc.invalidateQueries({ queryKey: ['files'] }); toast.ok('Projenin galerisine eklendi'); } catch (x) { toast.fail(x); } }}>
              <option value="">Proje seçin…</option>{projects.data?.filter((p) => !projectIds.includes(p.id)).map((p) => <option key={p.id} value={p.id}>{p.icon ?? '✦'} {p.title}</option>)}
            </select>
          </label>
          {u.data && <a className="btn btn-ghost btn-sm" href={u.data} target="_blank" rel="noopener noreferrer">Yeni sekmede aç</a>}
        </aside>
      </div>
    </div>
  );
}
