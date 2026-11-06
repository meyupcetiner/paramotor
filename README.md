# ZEPLİN — Detaylı Muhasebe Analiz Programı

Testeresan'ın 3 markası (testere.com.tr, Testere Ustası, Testere Fabrikası) için Paraşüt düzeninde, Envato koyu tema görünümünde satış / gelir-gider / müşteri analizi paneli. WhatsApp sipariş mesajlarından ve ekran görüntülerinden otomatik fatura oluşturur.

**Teknoloji:** Cloudflare Workers (statik dosyalar + API tek Worker'da) · D1 (SQLite) · isteğe bağlı R2 (yüklenen ekran görüntüleri) · Claude API (görsel/metin okuma) · bağımlılıksız vanilla JS arayüz.

## Kurulum (Cloudflare, GitHub'dan deploy)

1. Bu klasörü GitHub'da yeni bir repoya koyun (ör. `meyupcetiner/paramotor`).
2. D1 veritabanı oluşturun:
   `npx wrangler d1 create paramotor-db` → çıkan `database_id`'yi `wrangler.toml` içine yazın.
   (Tablolar ve ürün kataloğu ilk açılışta otomatik oluşturulur; isterseniz elle: `npx wrangler d1 execute paramotor-db --remote --file=src/schema.sql`)
3. Claude API anahtarı (ekran görüntüsü okuma için zorunlu):
   `npx wrangler secret put ANTHROPIC_API_KEY`
   Anahtar yalnızca sunucuda durur, tarayıcıya gönderilmez. Anahtar yoksa sadece yapıştırılan metin kural tabanlı okunur.
4. (Opsiyonel) Görselleri saklamak: `npx wrangler r2 bucket create paramotor-uploads` ve `wrangler.toml`'daki R2 satırlarını açın.
5. `npx wrangler deploy` (veya Cloudflare panelinde Workers › Create › Import from GitHub).
6. Siteyi açın → **ilk açılışta panel şifresini siz belirlersiniz** (en az 6 karakter).

## Yerel çalıştırma
`node dev/server.mjs` (Node 22+, ek paket gerekmez) → http://localhost:8787 · Birim testleri: `node test/unit.mjs`

## Sayfalar
- Giriş animasyonu (Testeresan logosu ortadan ikiye ayrılır; oturumda bir kez, "Geç" butonu) → marka seçimi (TESTERESAN genel + 3 marka)
- Marka paneli: Satış Faturaları · Satış Oluştur · Otomatik Satış Gir (+ geçmiş ve düzeltme oranı) · Müşteriler (filtre, otomatik RFM segmentleri, kayıtlı segment, CSV/Excel, telefon listesi) · Satış Raporları · Gelir-Gider · Giderler · Ürünler · Ayarlar
- Genel muhasebe: üç markanın birleşik raporu, marka karşılaştırması, ortak giderler

## Varsayımlar (değiştirilebilir)
- Fiyatlar varsayılan **KDV dahil** girilir (Ayarlar › Genel). Veritabanında birim fiyat KDV hariç saklanır.
- Fatura no: `ÖNEK-YIL-SIRA` marka bazında (TCT / TU / TF), elle de girilebilir.
- E-fatura/e-arşiv entegrasyonu yok; resmi satış sadece kayıt.
- Ortak giderler dönem cirosu oranında dağıtılır (Ayarlar'dan eşit/elle oran; gider bazında da oran girilebilir).
- Gayriresmi satışlarda da varsayılan KDV oranı uygulanır (satırda %0 seçilebilir).
- Katalog: Testeresan 2025 fiyat listesindeki tüm ürün/varyantlar (fiyatsız) — 47 ürün, 411 varyant. Testere Fabrikası sitesindeki ek ürünler Ürünler › İçe aktar ile eklenir.
