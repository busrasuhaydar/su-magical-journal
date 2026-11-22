// Proje galerisi: dosya bir kez saklanır, projeye bağlantıyla eklenir. Açıklama ve not bağlantıya aittir.
import { useEffect, useRef, useState, type DragEvent, type PointerEvent as RPE } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, FileText, Film, Grid3x3, Image as ImageIcon, List, Music, Star, Trash2, Upload, X } from 'lucide-react';
import { addToGallery, uploadFile, useFileLinks, useFiles, useSaveProject, useSignedUrl } from '../../lib/data';
import { supabase } from '../../lib/supabase';
import { dayKeyOf, formatShort } from '../../lib/dates';
import type { FileLink, FileRec, Project } from '../../lib/types';
import { ConfirmButton, Empty, formatBytes, useToast } from '../../components/ui';

export type GalleryItem = { link: FileLink; file: FileRec };
const KINDS: [string, string][] = [['', 'Tümü'], ['image', 'Görsel'], ['video', 'Video'], ['doc', 'Belge'], ['audio', 'Ses']];
const kindOf = (m: string) => (m.startsWith('image/') ? 'image' : m.startsWith('video/') ? 'video' : m.startsWith('audio/') ? 'audio' : 'doc');

export function useProjectGallery(projectId: string): GalleryItem[] {
  const links = useFileLinks();
  const files = useFiles();
  const map = new Map((files.data ?? []).map((f) => [f.id, f]));
  return (links.data ?? []).filter((l) => l.entity_type === 'project' && l.entity_id === projectId && map.has(l.file_id))
    .sort((a, b) => a.position - b.position || a.created_at.localeCompare(b.created_at)).map((link) => ({ link, file: map.get(link.file_id)! }));
}

export function Thumb({ file, fit = 'cover' }: { file: FileRec; fit?: 'cover' | 'contain' }) {
  const u = useSignedUrl(file.storage_path);
  const k = kindOf(file.mime);
  if (k === 'image' && u.data) return <img src={u.data} alt={file.title} loading="lazy" style={{ width: '100%', height: '100%', objectFit: fit, display: 'block' }} />;
  if (k === 'video' && u.data) return <video src={u.data} muted playsInline preload="metadata" style={{ width: '100%', height: '100%', objectFit: fit, display: 'block' }} />;
  const Icon = k === 'audio' ? Music : k === 'video' ? Film : FileText;
  return <div style={{ width: '100%', height: '100%', display: 'grid', placeItems: 'center', color: 'var(--rose-500)' }}><Icon size={30} /></div>;
}

export function GalleryTab({ p }: { p: Project }) {
  const items = useProjectGallery(p.id);
  const qc = useQueryClient();
  const toast = useToast();
  const saveProject = useSaveProject();
  const [view, setView] = useState<'grid' | 'list'>(() => { try { return (localStorage.getItem('gal-view') as 'grid' | 'list') || 'grid'; } catch { return 'grid'; } });
  const [kind, setKind] = useState('');
  const [open, setOpen] = useState<number | null>(null);
  const [over, setOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const start = useRef<{ x: number; y: number } | null>(null);
  useEffect(() => { try { localStorage.setItem('gal-view', view); } catch { /* yok say */ } }, [view]);
  const list = items.filter((i) => !kind || kindOf(i.file.mime) === kind);

  async function onFiles(fl: FileList | null) {
    if (!fl?.length) return; setBusy(true);
    try {
      for (const f of Array.from(fl)) { const { rec } = await uploadFile(f); await addToGallery(rec.id, p.id); }
      qc.invalidateQueries({ queryKey: ['files'] });
      toast.ok('Galeriye eklendi');
    } catch (x) { toast.fail(x); } finally { setBusy(false); }
  }
  async function reorder(from: string, to: string) {
    const arr = [...items];
    const a = arr.findIndex((i) => i.link.id === from), b = arr.findIndex((i) => i.link.id === to);
    if (a < 0 || b < 0) return;
    const [m] = arr.splice(a, 1); arr.splice(b, 0, m);
    await Promise.all(arr.map((it, i) => it.link.position !== i + 1 ? supabase.from('file_links').update({ position: i + 1 }).eq('id', it.link.id) : null));
    qc.invalidateQueries({ queryKey: ['files'] });
  }
  const down = (e: RPE, id: string) => { if ((e.target as HTMLElement).closest('button,input,textarea')) return; (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); start.current = { x: e.clientX, y: e.clientY }; setDragId(id); };
  const move = (e: RPE) => {
    if (!dragId || !start.current || Math.hypot(e.clientX - start.current.x, e.clientY - start.current.y) < 6) return;
    const el = document.elementsFromPoint(e.clientX, e.clientY).find((n) => (n as HTMLElement).dataset?.gid);
    setOverId((el as HTMLElement | undefined)?.dataset.gid ?? null);
  };
  const up = (idx: number) => {
    const moved = !!overId;
    if (dragId && overId && overId !== dragId) reorder(dragId, overId);
    else if (!moved && dragId) setOpen(idx);
    setDragId(null); setOverId(null); start.current = null;
  };

  return (
    <section className="glass panel" style={{ display: 'grid', gap: 14 }}
      onDragOver={(e: DragEvent) => { if (e.dataTransfer.types.includes('Files')) { e.preventDefault(); setOver(true); } }} onDragLeave={() => setOver(false)} onDrop={(e: DragEvent) => { e.preventDefault(); setOver(false); onFiles(e.dataTransfer.files); }}>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <div className="row">
          <div className="seg">{KINDS.map(([k, l]) => <button type="button" key={k} className={kind === k ? 'on' : ''} onClick={() => setKind(k)}>{l}</button>)}</div>
          <div className="seg">
            <button type="button" className={view === 'grid' ? 'on' : ''} onClick={() => setView('grid')} aria-label="Galeri görünümü"><Grid3x3 size={14} /></button>
            <button type="button" className={view === 'list' ? 'on' : ''} onClick={() => setView('list')} aria-label="Liste görünümü"><List size={14} /></button>
          </div>
        </div>
        <button type="button" className="btn btn-primary" disabled={busy} onClick={() => input.current?.click()}><Upload size={14} />{busy ? 'Yükleniyor…' : 'Dosya ekle'}</button>
        <input ref={input} id="gal-in" type="file" multiple hidden accept="image/*,video/*,audio/*,application/pdf,.doc,.docx,.txt,.md,.psd,.ai,.svg,.zip" onChange={(e) => { onFiles(e.target.files); e.target.value = ''; }} />
      </div>
      {over && <div className="dropzone over">Bırakın, galeriye eklensin</div>}
      {items.length === 0 && !over && <Empty title="Galeri boş">Fotoğraf, video, çizim, referans görseli veya PDF sürükleyip bırakın.</Empty>}
      {view === 'grid' ? (
        <div className="pgal" onPointerMove={move}>
          {list.map((it, idx) => (
            <figure key={it.link.id} data-gid={it.link.id} className={`pgal-item${overId === it.link.id && dragId !== it.link.id ? ' drop-target' : ''}`} style={{ opacity: dragId === it.link.id && overId ? 0.4 : 1 }}
              onPointerDown={(e) => down(e, it.link.id)} onPointerUp={() => up(idx)}>
              <div className="pgal-img"><Thumb file={it.file} /></div>
              {p.cover_file_id === it.file.id && <span className="pgal-badge"><Star size={11} fill="currentColor" /> Kapak</span>}
              <figcaption>{it.link.caption || it.file.title}</figcaption>
            </figure>
          ))}
        </div>
      ) : (
        <div className="task-list">
          {list.map((it, idx) => (
            <div key={it.link.id} className="task-row" onClick={() => setOpen(idx)} role="button" tabIndex={0} style={{ alignItems: 'center' }}>
              <div style={{ width: 56, height: 56, borderRadius: 10, overflow: 'hidden', background: 'var(--blush-100)', flex: 'none' }}><Thumb file={it.file} /></div>
              <div className="t"><b>{it.link.caption || it.file.title}</b><div className="meta"><span>{formatBytes(it.file.size)}</span><span>{formatShort(dayKeyOf(it.file.created_at))}</span>{it.link.note && <span>{it.link.note.slice(0, 60)}</span>}</div></div>
            </div>
          ))}
        </div>
      )}
      {open != null && list[open] && (
        <Lightbox items={list} index={open} onIndex={setOpen} onClose={() => setOpen(null)} coverId={p.cover_file_id}
          onCover={async (fid) => { try { await saveProject.mutateAsync({ id: p.id, title: p.title, slug: p.slug, cover_file_id: fid }); toast.ok('Kapak görseli değişti'); } catch (x) { toast.fail(x); } }} />
      )}
    </section>
  );
}

function Lightbox({ items, index, onIndex, onClose, onCover, coverId }: { items: GalleryItem[]; index: number; onIndex: (i: number) => void; onClose: () => void; onCover: (fileId: string) => void; coverId: string | null }) {
  const it = items[index];
  const qc = useQueryClient();
  const toast = useToast();
  const u = useSignedUrl(it.file.storage_path);
  const [caption, setCaption] = useState(it.link.caption ?? '');
  const [note, setNote] = useState(it.link.note ?? '');
  useEffect(() => { setCaption(it.link.caption ?? ''); setNote(it.link.note ?? ''); }, [it.link.id, it.link.caption, it.link.note]);
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).matches('input,textarea')) return;
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') onIndex((index + 1) % items.length);
      if (e.key === 'ArrowLeft') onIndex((index - 1 + items.length) % items.length);
    };
    document.addEventListener('keydown', k); return () => document.removeEventListener('keydown', k);
  }, [index, items.length, onClose, onIndex]);
  async function save() {
    if ((it.link.caption ?? '') === caption && (it.link.note ?? '') === note) return;
    const { error } = await supabase.from('file_links').update({ caption: caption.trim() || null, note: note.trim() || null }).eq('id', it.link.id);
    if (error) toast.fail(error); else { qc.invalidateQueries({ queryKey: ['files'] }); toast.ok('Kaydedildi'); }
  }
  const k = kindOf(it.file.mime);
  return (
    <div className="scrim lightbox" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="lb-body">
        <div className="lb-media">
          {k === 'image' && u.data && <img src={u.data} alt={caption || it.file.title} />}
          {k === 'video' && u.data && <video src={u.data} controls autoPlay />}
          {k === 'audio' && u.data && <audio src={u.data} controls />}
          {k === 'doc' && u.data && (it.file.mime === 'application/pdf' ? <iframe title={it.file.title} src={u.data} /> : <a className="btn btn-glass" href={u.data} target="_blank" rel="noopener noreferrer"><FileText size={16} />Dosyayı aç</a>)}
          {items.length > 1 && <>
            <button type="button" className="lb-nav l" onClick={() => onIndex((index - 1 + items.length) % items.length)} aria-label="Önceki"><ChevronLeft size={22} /></button>
            <button type="button" className="lb-nav r" onClick={() => onIndex((index + 1) % items.length)} aria-label="Sonraki"><ChevronRight size={22} /></button>
          </>}
        </div>
        <aside className="lb-side">
          <div className="row" style={{ justifyContent: 'space-between' }}><span className="small muted">{index + 1} / {items.length}</span><button type="button" className="btn btn-ghost icon-btn" onClick={onClose} aria-label="Kapat"><X size={18} /></button></div>
          <label className="field"><span>Açıklama</span><input id="lb-cap" className="input" value={caption} onChange={(e) => setCaption(e.target.value)} onBlur={save} placeholder={it.file.title} /></label>
          <label className="field"><span>Not</span><textarea id="lb-note" className="textarea" value={note} onChange={(e) => setNote(e.target.value)} onBlur={save} placeholder="Bu görselle ilgili düşünceler, teknik bilgi, kaynak…" /></label>
          <div className="small muted">{it.file.title} · {formatBytes(it.file.size)} · {formatShort(dayKeyOf(it.file.created_at))}</div>
          {k === 'image' && <button type="button" className="btn btn-glass btn-sm" disabled={coverId === it.file.id} onClick={() => onCover(it.file.id)}><ImageIcon size={14} />{coverId === it.file.id ? 'Kapak görseli' : 'Kapak yap'}</button>}
          {u.data && <a className="btn btn-ghost btn-sm" href={u.data} target="_blank" rel="noopener noreferrer">Yeni sekmede aç</a>}
          <ConfirmButton label={<><Trash2 size={14} />Galeriden kaldır</>} className="btn btn-ghost btn-sm" confirmText="Dosya projeden kaldırılsın mı? (Dosyalar'da kalır)"
            onConfirm={async () => { const { error } = await supabase.from('file_links').delete().eq('id', it.link.id); if (error) toast.fail(error); else { qc.invalidateQueries({ queryKey: ['files'] }); onClose(); } }} />
        </aside>
      </div>
    </div>
  );
}
