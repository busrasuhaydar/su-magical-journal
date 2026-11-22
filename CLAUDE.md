# Su's Magical Journal

Kişisel yaşam + sanat kariyeri + proje yönetimi uygulaması. Arayüz tamamen **Türkçe**, saat dilimi **Europe/Istanbul**.

## Yığın
- React 18 + TypeScript + Vite, TanStack Query, react-router (basename = `import.meta.env.BASE_URL`)
- Supabase projesi `tjouaydmwmokbuomyyub` (Postgres + RLS, Storage kovası `files`, Realtime, Edge Functions, pg_cron)
- Node: `export PATH="$HOME/.local/node/bin:$HOME/.local/bin:$PATH"` (gh ve supabase CLI de burada)
- Yayın: `main`'e push → GitHub Actions → https://busrasuhaydar.github.io/su-magical-journal/ (`GH_PAGES=1` ile base `/su-magical-journal/`)

## Komutlar
- Geliştirme: `npm run dev` (port 5173, strictPort)
- Kontrol: `npx tsc -p tsconfig.json` · Derleme: `npm run build`
- DB göçü: `supabase/migrations/` içine dosya yaz, `supabase db push` (MCP'ye uzun SQL yapıştırma)
- Fonksiyon: `supabase functions deploy <ad> --project-ref tjouaydmwmokbuomyyub` (dispatcher ve oauth için `--no-verify-jwt`)

## Yapı
- `src/lib/data.ts` — tüm sorgular/mutasyonlar; `TABLE_KEYS` Realtime → sorgu yenileme eşlemesi (yeni tablo eklenirse buraya VE `supabase_realtime` yayınına ekle, yoksa tüm Realtime kanalı bozulur)
- `src/lib/dates.ts` — gün anahtarı `YYYY-MM-DD`, `toInstant/dayKeyOf/minutesOf` (İstanbul)
- `src/lib/types.ts` — tipler ve Türkçe etiketler
- `src/components/` — Shell (menü), Editors (görev/etkinlik/içerik pencereleri, `useEditors`), TimeGrid, PostEditor, QuickSearch (⌘K), NotificationBell
- `src/pages/` — Home, Calendar, Day, Tasks, Projects, project/{Workspace,Gallery,Pages,Links,Sections}, Social, Opportunities, Contacts, Ideas, Gallery (ortak), Files, Settings
- `supabase/functions/` — `extract-opportunity` (Claude ile duyuru çıkarma), `dispatcher` (her dakika: hatırlatıcı→bildirim, yayın kuyruğu), `oauth`
- Stil: `src/styles/app.css` (en alttaki "Apple cam" bloğu belirteçleri geçersiz kılar)

## Kurallar
- Tek kayıt ilkesi: veri kopyalanmaz; ilişkiler `file_links`, `entity_links`, `project_*` tablolarıyla.
- Her tabloda `owner_id default auth.uid()` + RLS; değişiklikler `change_log`'a tetikleyiciyle yazılır; silme = `deleted_at` (yumuşak).
- `memory_entries` değiştirilemez (yalnız ekleme, `supersedes`).
- Sosyal paylaşım şu an elle: `src/lib/share.ts` (paylaş menüsü / X intent); paylaşımlar `post_shares`'e kaydedilir. API ile otomatik yayın altyapısı hazır ama anahtarlar girilmedi.
- Belirsiz bilgi uydurulmaz; dinî bayramlar `certainty='uncertain'`.
- Kullanıcıya Türkçe, kısa yanıt ver; token tasarrufu önemli.

## Token tasarrufu (önemli)
- İstenmedikçe kod tabanını keşfetme; CLAUDE.md'deki yapıya güven, yalnız ilgili dosyayı oku (gerekirse `grep -n` ile ilgili satırları).
- İstenmedikçe tarayıcı testi, ekran görüntüsü, uzun log okuma yapma. Kontrol = `npx tsc -p tsconfig.json`.
- Yayın: değişikliği `main`'e commit + push (Actions kendiliğinden yayınlar).
- Yanıtlar kısa olsun.
