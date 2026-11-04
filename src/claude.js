// Claude API ile WhatsApp mesajı/ekran görüntüsü okuma. API anahtarı yalnızca sunucuda (Worker secret).
const SYSTEM = `Sen Testeresan firmasının satış kayıt asistanısın. Sana WhatsApp "sevkiyat" grubundan sipariş mesajları (metin ve/veya ekran görüntüsü) verilecek. Görevin her siparişi yapılandırılmış veriye dönüştürmek.

KESİN KURALLAR:
1. BİREBİR AL: Ad soyad, telefon, adres, il, ilçe, ürün ve adet bilgilerini mesajda yazıldığı gibi aynen yaz. Yazım hatası düzeltme, tamamlama, tahmin, uydurma YOK. Büyük/küçük harfi değiştirme.
2. Okunamayan veya emin olmadığın alanı boş bırak ("" veya null) ve uncertain_fields listesine ekle. Ürün satırında emin olmadığın alanı o satırın uncertain listesine ekle.
3. Bir mesaj = bir sipariş. Aynı kişiye ait ardışık devam mesajlarını tek siparişte birleştir (aynı telefon/isim ya da açıkça devamı). Bir ekran görüntüsünde birden çok sipariş olabilir; hepsini ayrı ayrı çıkar. Sipariş olmayan mesajları (selamlaşma, "tamam", kargo kodu vb.) atla.
4. İl/ilçe: "FATİH/İSTANBUL" gibi yazımlarda ilçe=FATİH, il=İSTANBUL olarak aynen al. Yazmıyorsa boş bırak; adresten tahmin etme.
5. Ödeme yöntemi sadece mesajda açıkça geçiyorsa belirle: "kapıda nakit" → Kapıda Nakit; "kapıda kart/kredi kartı/pos" → Kapıda Kredi Kartı; sadece "kapıda ödeme" yazıyorsa → "Kapıda (tür belirsiz)"; "havale/EFT/IBAN/dekont" → Havale. Aksi hâlde "Belirsiz".
6. Kaynak (siparişin geldiği yer) sadece mesajda geçiyorsa: Instagram/insta/IG, Facebook/FB, WhatsApp/WP, Mağaza/elden/dükkan. Aksi hâlde "Belirsiz".
7. Ürünler: raw_text alanına ürün satırını mesajdaki gibi yaz. Ölçüleri ayrıca sayısal alanlara ayır:
   - Daire testere: "300x3.2x30 Z96", "300*96 diş", "250 lik 60 diş" → diameter (çap mm), thickness, bore (delik), teeth (diş sayısı).
   - Şerit testere: "2240*27*0.9 şerit 2 adet" → length_mm=2240, width=27, thickness=0.9, qty=2. "1400 mm 3 adet" → length_mm=1400, qty=3. "4/6" gibi ifadeler TPI'dır (tpi="4/6").
   - Adet (qty) mesajda yoksa null bırak ve uncertain'e "qty" ekle. Adet ile ölçüyü karıştırma; şüphede uncertain'e ekle.
   - Fiyat: satır fiyatı/birim fiyat mesajda varsa yaz (sayı, TL). Sadece sipariş toplamı varsa order_total'a yaz.
   - brand_hint: Kronberg, Onci, GLG, Krabbe, Junior, Schuster, Flamex, Freud vb. yazıyorsa.
   - kind: daire | serit | diger | belirsiz.
8. source_ref: siparişin nereden okunduğu (ör. "Görsel 2, 1. mesaj" veya "Metin, 3. mesaj").
9. Sonucu MUTLAKA kaydet_siparisler aracıyla döndür.`;

export function buildTool(sources, payments) {
  const item = {
    type: 'object',
    properties: {
      raw_text: { type: 'string', description: 'Ürün satırı, mesajdaki gibi' },
      product_hint: { type: 'string', description: 'Ürün türü (ör. MDF testere, ahşap şerit, et kemik şeridi)' },
      brand_hint: { type: 'string' },
      kind: { type: 'string', enum: ['daire', 'serit', 'diger', 'belirsiz'] },
      diameter: { type: ['number', 'null'] }, thickness: { type: ['number', 'null'] }, bore: { type: ['string', 'null'] }, teeth: { type: ['number', 'null'] },
      width: { type: ['number', 'null'] }, tpi: { type: ['string', 'null'] }, length_mm: { type: ['number', 'null'] },
      qty: { type: ['number', 'null'] }, unit_price: { type: ['number', 'null'] }, line_total: { type: ['number', 'null'] },
      uncertain: { type: 'array', items: { type: 'string' } }
    },
    required: ['raw_text', 'kind', 'qty', 'uncertain']
  };
  return {
    name: 'kaydet_siparisler',
    description: 'Mesajlardan çıkarılan siparişleri kaydeder.',
    input_schema: {
      type: 'object',
      properties: {
        orders: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              customer_name: { type: 'string' }, phone: { type: 'string' }, address: { type: 'string' }, il: { type: 'string' }, ilce: { type: 'string' },
              source: { type: 'string', enum: [...sources, 'Belirsiz'] },
              payment: { type: 'string', enum: [...payments, 'Kapıda (tür belirsiz)', 'Belirsiz'] },
              order_total: { type: ['number', 'null'] },
              note: { type: 'string', description: 'Mesajdaki ek not (kargo, teslim vb.) — kısa' },
              source_ref: { type: 'string' },
              uncertain_fields: { type: 'array', items: { type: 'string', enum: ['customer_name', 'phone', 'address', 'il', 'ilce', 'source', 'payment', 'items'] } },
              items: { type: 'array', items: item }
            },
            required: ['customer_name', 'phone', 'address', 'il', 'ilce', 'source', 'payment', 'items', 'uncertain_fields', 'source_ref']
          }
        }
      },
      required: ['orders']
    }
  };
}

export async function extractWithClaude(env, { text, images, sources, payments, productNames, model }) {
  const content = [];
  (images || []).forEach((img, i) => {
    const m = /^data:(image\/(?:png|jpeg|webp|gif));base64,(.+)$/.exec(img);
    if (!m) return;
    content.push({ type: 'text', text: `Görsel ${i + 1}:` });
    content.push({ type: 'image', source: { type: 'base64', media_type: m[1], data: m[2] } });
  });
  content.push({ type: 'text', text: `Katalogdaki ürün aileleri (eşleştirme sunucuda yapılır, sadece bağlam için):\n${productNames.join('\n')}\n\n` + (text ? `YAPIŞTIRILAN METİN:\n"""\n${text}\n"""` : 'Metin yok, sadece görseller.') + '\n\nTüm siparişleri kaydet_siparisler aracıyla döndür.' });
  const body = {
    model: model || 'claude-sonnet-5-5',
    max_tokens: 16000,
    system: SYSTEM,
    tools: [buildTool(sources, payments)],
    tool_choice: { type: 'tool', name: 'kaydet_siparisler' },
    messages: [{ role: 'user', content }]
  };
  const res = await fetch((env.ANTHROPIC_BASE || 'https://api.anthropic.com') + '/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify(body)
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error('Claude API hatası: ' + (data.error && data.error.message || res.status));
  const tu = (data.content || []).find(c => c.type === 'tool_use');
  if (!tu) throw new Error('Claude yapılandırılmış sonuç döndürmedi.');
  return { orders: (tu.input && tu.input.orders) || [], usage: data.usage, model: data.model };
}
