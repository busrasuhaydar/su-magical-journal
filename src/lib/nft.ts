// NFT eserleri: tek kaynak public/koleksiyonlar.json (orijinal dosyalar IPFS/Arweave/OpenSea'de kalır, uygulamada kopya tutulmaz).
// Her koleksiyon gerçek bir proje olur (slug: koleksiyon-<slug>); eser başına sayfalar o projenin sayfalarıdır (pages.artwork_key).
import { useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from './supabase';
import { useAllPages, useProjects } from './data';
import type { Project } from './types';

export interface Nft { c: string; contract: string; tokenId: string; name: string; description: string; thumb: string | null; original: string | null; video: string | null; file: string | null; opensea: string; superrare: string | null }
export interface Col { name: string; slug: string; description: string }
export interface NftData { collections: Col[]; items: Nft[] }

export function useNfts() {
  return useQuery({ queryKey: ['nft-data'], staleTime: Infinity, queryFn: async (): Promise<NftData> => {
    const d: NftData = await (await fetch(`${import.meta.env.BASE_URL}koleksiyonlar.json`)).json();
    const n = new Map<string, number>(); d.items.forEach((i) => n.set(i.c, (n.get(i.c) ?? 0) + 1));
    d.collections.sort((a, b) => (n.get(b.slug) ?? 0) - (n.get(a.slug) ?? 0));
    return d;
  } });
}
export const artKey = (n: Pick<Nft, 'contract' | 'tokenId'>) => `${n.contract.toLowerCase()}-${n.tokenId}`;
export const projectSlug = (colSlug: string) => `koleksiyon-${colSlug}`;
export const isCollectionProject = (p: Project) => p.slug.startsWith('koleksiyon-');
const COLORS = ['#E2558C', '#1FA9A6', '#F28A5C', '#9B6FE0', '#5AA9E6', '#D4A017'];

/** Her koleksiyon için bir proje yoksa bir kez oluşturur (idempotent). */
export function useEnsureCollectionProjects() {
  const nfts = useNfts();
  const projects = useProjects();
  const qc = useQueryClient();
  const busy = useRef(false);
  useEffect(() => {
    if (busy.current || !nfts.data || !projects.data) return;
    const have = new Set(projects.data.map((p) => p.slug));
    const missing = nfts.data.collections.filter((c) => !have.has(projectSlug(c.slug)));
    if (!missing.length) return;
    busy.current = true;
    (async () => {
      for (const [i, c] of missing.entries()) {
        await supabase.from('projects').insert({ title: c.name, slug: projectSlug(c.slug), status: 'active', priority: 'medium', color: COLORS[i % COLORS.length], icon: '🖼️', description: c.description?.replace(/\s+/g, ' ').slice(0, 500) || null });
      }
      qc.invalidateQueries({ queryKey: ['projects'] });
    })().finally(() => { busy.current = false; });
  }, [nfts.data, projects.data, qc]);
}

export function useArtworkPages(key: string | undefined) {
  const pages = useAllPages();
  return (pages.data ?? []).filter((p) => key && p.artwork_key === key);
}

async function fetchOriginal(n: Nft, video = false) {
  const url = (video ? n.video : n.original) ?? n.original;
  if (!url) throw new Error('Orijinal dosya adresi yok');
  const r = await fetch(url);
  if (!r.ok) throw new Error('Orijinal dosya indirilemedi');
  const blob = await r.blob();
  const ext = ({ 'image/png': 'png', 'image/jpeg': 'jpg', 'image/gif': 'gif', 'image/webp': 'webp', 'image/avif': 'avif', 'video/mp4': 'mp4', 'video/quicktime': 'mov' } as Record<string, string>)[blob.type] ?? (url.split('.').pop()?.slice(0, 4) || 'jpg');
  return { blob, name: `${n.name.replace(/[\\/:*?"<>|\n\r]+/g, ' ').trim()} [${n.tokenId.slice(-6)}].${ext}` };
}
function saveBlob(blob: Blob, name: string) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 30_000);
}
/** Orijinal dosyayı cihaza indirir (CORS engeli olursa yeni sekmede açar). */
export async function saveOriginal(n: Nft, video = false) {
  try { const { blob, name } = await fetchOriginal(n, video); saveBlob(blob, name); return 'saved' as const; }
  catch { window.open((video ? n.video : n.original) ?? n.opensea, '_blank'); return 'opened' as const; }
}
export const shareText = (n: Nft) => `${n.name}\n${n.superrare ?? n.opensea}`;
/** Telefonda paylaş menüsü (orijinal dosyayla); bilgisayarda dosyayı indirir ve X paylaşım penceresini açar. */
export async function shareOriginal(n: Nft): Promise<'sheet' | 'intent'> {
  const text = shareText(n);
  try {
    const { blob, name } = await fetchOriginal(n);
    const file = new File([blob], name, { type: blob.type });
    if (navigator.canShare?.({ files: [file] })) { await navigator.share({ files: [file], text }); return 'sheet'; }
    saveBlob(blob, name);
  } catch { /* dosya alınamazsa yalnız metin */ }
  window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(n.name)}&url=${encodeURIComponent(n.superrare ?? n.opensea)}`, '_blank');
  return 'intent';
}
