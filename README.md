# Su's Magical Journal

Kişisel yaşam, sanat kariyeri ve proje yönetimi için tek sistem. React + TypeScript + Vite + Supabase.

## Çalıştırma

```bash
export PATH="$HOME/.local/node/bin:$PATH"
npm install
npm run dev
```

Tarayıcıda http://localhost:5173 adresini açın.

## Yapı
- `supabase/migrations/` — veritabanı şeması (RLS, tetikleyiciler, görünümler)
- `scripts/gen_holidays.py` — resmî tatil tohum verisi üreticisi
- `src/lib/` — tarih hesapları (Europe/Istanbul), veri katmanı, tipler
- `src/pages/` — Ana Sayfa, Takvim (yıl/ay/hafta/ajanda), Günlük Plan, Görevler, Projeler, Dosyalar, Ayarlar
- `docs/` — Faz 0 mimari ve tasarım belgesi
