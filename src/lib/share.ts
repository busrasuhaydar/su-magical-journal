// API'siz paylaşım: telefonda paylaş menüsü (görsel + metin), bilgisayarda X paylaşım bağlantısı + panoya görsel.
import { signedUrl } from './data';
import type { FileRec, SocialPost } from './types';

export const postText = (p: Pick<SocialPost, 'caption_tr' | 'caption_en' | 'hashtags' | 'links' | 'title'>) =>
  [p.caption_tr || p.caption_en || '', (p.hashtags ?? []).join(' '), (p.links ?? []).join(' ')].filter(Boolean).join('\n\n').trim() || p.title;

async function toFiles(media: FileRec[]) {
  return Promise.all(media.map(async (m) => {
    const blob = await (await fetch(await signedUrl(m.storage_path))).blob();
    return new File([blob], m.title, { type: m.mime || blob.type });
  }));
}

async function asPng(f: FileRec): Promise<Blob> {
  const blob = await (await fetch(await signedUrl(f.storage_path))).blob();
  if (blob.type === 'image/png') return blob;
  const bmp = await createImageBitmap(blob);
  const c = document.createElement('canvas'); c.width = bmp.width; c.height = bmp.height;
  c.getContext('2d')!.drawImage(bmp, 0, 0);
  return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('Görsel hazırlanamadı'))), 'image/png'));
}

export type ShareResult = { method: 'sheet' | 'intent' | 'manual'; note: string };

/** Düğme tıklamasının içinde çağrılmalı (tarayıcı izni için). */
export async function shareTo(platform: 'x' | 'instagram', text: string, media: FileRec[]): Promise<ShareResult> {
  const images = media.filter((m) => m.mime.startsWith('image/') || m.mime.startsWith('video/'));
  const mobile = /Android|iPhone|iPad/i.test(navigator.userAgent);
  // Instagram metni paylaş menüsünden almaz: önce panoya
  if (platform === 'instagram') { try { await navigator.clipboard.writeText(text); } catch { /* yok say */ } }

  // 1) Paylaş menüsü (telefonda görsel + metin birlikte)
  if (mobile && images.length && navigator.canShare) {
    const files = await toFiles(images.slice(0, platform === 'x' ? 4 : 10));
    if (navigator.canShare({ files })) {
      await navigator.share({ files, text: platform === 'x' ? text : undefined });
      return { method: 'sheet', note: platform === 'instagram' ? 'Açıklama panoya kopyalandı; Instagram’da açıklama alanına yapıştırın.' : 'Paylaş menüsünden X’i seçin.' };
    }
  }

  // 2) Bilgisayar: X paylaşım bağlantısı + ilk görsel panoda
  if (platform === 'x') {
    const img = images.find((m) => m.mime.startsWith('image/'));
    if (img && 'ClipboardItem' in window) {
      try { await navigator.clipboard.write([new ClipboardItem({ 'image/png': asPng(img) })]); } catch { /* izin yoksa atla */ }
    }
    window.open(`https://x.com/intent/post?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
    return { method: 'intent', note: img ? 'Metin hazır. Görsel panoda: gönderi kutusunda ⌘+V ile yapıştırın.' : 'Metin hazır; Gönder’e basın.' };
  }
  window.open('https://www.instagram.com/', '_blank', 'noopener');
  return { method: 'manual', note: 'Açıklama panoya kopyalandı. Bilgisayarda Instagram görsel yüklemeyi kendi sitesinden yapar; en kolayı telefondan bu düğmeye basmak.' };
}
