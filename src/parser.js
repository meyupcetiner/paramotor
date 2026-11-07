// Kural tabanlı metin ayrıştırıcı (API anahtarı gerektirmez). Sadece yapıştırılan METİN için.
// Çıktı biçimi Claude ayrıştırıcısıyla aynıdır. Emin olunmayan alanlar boş bırakılır ve işaretlenir.
import '../public/il-ilce.js';
import { trLower, fold, extractDims } from './match.js';

const IL = globalThis.IL_ILCE;
const IL_FOLD = Object.keys(IL).map(il => ({ il, f: fold(il), ilceler: IL[il].map(x => ({ x, f: fold(x) })) }));

export const PHONE_RE = /(?:\+?\s?90[\s.-]?)?\(?0?\s?5\d{2}\)?[\s.-]?\d{3}[\s.-]?\d{2}[\s.-]?\d{2}/g;
const WA_HEADER = /^\s*\[?\d{1,2}[./]\d{1,2}[./]\d{2,4},?\s+\d{1,2}[:.]\d{2}(?::\d{2})?\]?\s*(?:-\s*)?(?:[^:\n]{1,40}):\s?/;
const PRODUCT_WORDS = /(testere|şerit|serit|bıçak|bicak|daire|kronberg|onci|glg|krabbe|junior|schuster|flamex|freud|mdf|alüminyum|aluminyum|ahşap|ahsap|dry ?cut|bimetal|karbon|carbide|kemik|betopan|planya|tpi|\bdiş\b|\bdis\b|\bz\s?\d{2,3}\b|\d{2,4}\s*[x×*]\s*\d)/i;
const ADDRESS_WORDS = /(?<![\p{L}])(mah\.?|mahallesi|mahalle|mh\.?|sok\.?|sokak|sokağı|sk\.?|cad\.?|caddesi|cadde|cd\.?|bulvar[ıi]?|blv\.?|no\s*[:.=]?\s*\d|apt\.?|apartman[ıi]?|sitesi|site|blok|daire\s*[:.]?\s*\d|d\s*[:.]\s*\d|kat\s*[:.]?\s*\d|köyü|köy|osb|sanayi|san\.|organize|işhanı|plaza|merkez)(?![\p{L}])/iu;

export function normalizePhone(raw) {
  if (!raw) return { phone: '', ok: false };
  let d = String(raw).replace(/\D/g, '');
  if (d.startsWith('90') && d.length === 12) d = d.slice(2);
  if (d.length === 10 && d.startsWith('5')) d = '0' + d;
  if (d.length === 11 && d.startsWith('05')) return { phone: d, ok: true };
  return { phone: String(raw).trim(), ok: false };
}
export function formatPhone(p) {
  const d = String(p || '').replace(/\D/g, '');
  if (d.length === 11) return `${d.slice(0, 4)} ${d.slice(4, 7)} ${d.slice(7, 9)} ${d.slice(9)}`;
  return p || '';
}

// "ANKARA"/"ankara" -> "Ankara" (listede birebir karşılığı varsa yazımı standartlaştırır, aksi hâlde aynen bırakır)
export function canonIlIlce(il, ilce) {
  const x = il ? IL_FOLD.find(k => k.f === fold(il).trim()) : null;
  const y = x && ilce ? x.ilceler.find(k => k.f === fold(ilce).trim()) : null;
  return { il: x ? x.il : (il || '').trim(), ilce: y ? y.x : (ilce || '').trim() };
}
export function findIlIlce(text) {
  const t = fold(text);
  const words = ' ' + t.replace(/[^a-z0-9]+/g, ' ') + ' ';
  let il = null, ilce = null;
  // "ilçe/il" veya "ilçe - il" kalıbı öncelikli
  const slash = t.match(/([a-z0-9 ]{2,30})\s*[\/\-–]\s*([a-z ]{3,20})/g) || [];
  for (const s of slash) {
    const [a, b] = s.split(/[\/\-–]/).map(x => x.trim().split(/\s+/).slice(-2).join(' '));
    const cand = IL_FOLD.find(x => x.f === b.trim() || x.f === b.trim().split(' ').pop());
    if (cand) {
      const ic = cand.ilceler.find(y => a.endsWith(y.f));
      if (ic) return { il: cand.il, ilce: ic.x };
    }
  }
  let ilPos = -1;
  for (const x of IL_FOLD) { const p = words.lastIndexOf(' ' + x.f + ' '); if (p > ilPos) { ilPos = p; il = x; } }
  if (il) {
    let best = null, bd = 1e9;
    for (const y of il.ilceler) { const p = words.lastIndexOf(' ' + y.f + ' '); if (p < 0 || (y.f === il.f)) continue; const d = Math.abs(p - ilPos); if (d < bd) { bd = d; best = y; } }
    if (best) ilce = best.x;
    return { il: il.il, ilce };
  }
  // sadece ilçe adı geçiyorsa ve tek bir ile aitse
  const hits = [];
  for (const x of IL_FOLD) for (const y of x.ilceler) if (y.f.length > 3 && y.f !== 'merkez' && words.includes(' ' + y.f + ' ')) hits.push([x.il, y.x]);
  if (hits.length === 1) return { il: hits[0][0], ilce: hits[0][1], ilGuessed: true };
  return { il: null, ilce: null };
}

function detectPayment(t, names) {
  const f = fold(t);
  if (/kontroll?u|ptt\s*kontrol/.test(f)) return pick(names, 'Kapıda Kontrollü');
  if (/kapida|kapıda/.test(f)) {
    if (/kart|kredi|pos/.test(f)) return pick(names, 'Kapıda Kredi Kartı');
    if (/nakit|cash/.test(f)) return pick(names, 'Kapıda Nakit');
    return 'Belirsiz';
  }
  if (/havale|eft|iban|fast\b|hesaba|dekont/.test(f)) return pick(names, 'Havale');
  return 'Belirsiz';
}
function detectSource(t, names) {
  const f = fold(t);
  if (/instagram|insta\b|\big\b/.test(f)) return pick(names, 'Instagram');
  if (/facebook|\bfb\b|\bface\b/.test(f)) return pick(names, 'Facebook');
  if (/whatsapp|\bwp\b|\bwa\b|watsap|vatsap/.test(f)) return pick(names, 'WhatsApp');
  if (/magaza|dukkan|elden|karakoy/.test(f)) return pick(names, 'Mağaza');
  return 'Belirsiz';
}
function pick(names, n) { return names.includes(n) ? n : 'Belirsiz'; }

function parseMoney(s) {
  // 1.250,50 / 1250 / 1,250.50 / 2.500
  let x = String(s).replace(/\s/g, '');
  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(x)) x = x.replace(/\./g, '').replace(',', '.');
  else if (/^\d+,\d{1,2}$/.test(x)) x = x.replace(',', '.');
  else if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(x)) x = x.replace(/,/g, '');
  const v = parseFloat(x);
  return isFinite(v) ? v : null;
}
const MONEY_RE = /(\d[\d.,]*)\s*(?:tl|₺|lira|try)\b/i;

const HEAD_RE = /^\s*\[?(\d{1,2})[./](\d{1,2})[./](\d{2,4}),?\s+\d{1,2}[:.]\d{2}(?::\d{2})?\]?\s*(?:-\s*)?(?:~\s*)?([^:\n]{1,40}):\s?/;
export const ITEM_RE = /^(\d{1,3})\s*[-–]\s*(?!\d{2,3}[-–]\d)(.+)$/;
export const ITEM2_RE = /^(\d{1,3})\s*(?:ad\.?|adet|ade)\s*\.?\s+(.+)$/i;
const AMT = '(\\d{1,3}(?:[.,]\\d{3})+(?:,\\d{1,2})?|\\d{1,7}(?:,\\d{1,2})?)(?![\\d.,])';
export const TOTAL_RE = new RegExp('^(wp|wa|whatsapp|watsap|fb|face|facebook|ig|[iİı]nsta|[iİı]nstagram|ma[gğ]aza(?:da)?|dükkan|dukkan|web|site|toplam)\\s*(\\([^)]*\\))?\\s*[:.]?\\s*(?:[a-zçğıöşü ]{0,20}?toplam\\s*)?' + AMT + '\\s*(?:₺|tl|try)?\\s*(.*)$', 'i');
export const TOTAL_EMPTY_RE = /^(wp|insta|instagram|fb|facebook|ma[gğ]aza)\s*\(([^)]*)\)\s*$/i;
const PLAIN_AMT_RE = new RegExp('^(?:\\(([^)]*)\\)\\s*)?' + AMT + '\\s*(?:₺|tl|try)\\s*(.*)$', 'i');
const isOrderish = t => t.split('\n').some(l => { l = l.trim().replace(/^\*+|\*+$/g, ''); if (/^[\p{L} ]{2,20}\s*:/u.test(l)) return false; const tm = l.match(TOTAL_RE); return ITEM_RE.test(l) || ITEM2_RE.test(l) || (tm && !/^toplam$/i.test(tm[1])) || TOTAL_EMPTY_RE.test(l); });

// WhatsApp kopyala/dışa aktar gürültüsü: görünmez karakterler, düzenlendi etiketi, silinen mesajlar, medya satırları
export function cleanWA(text) {
  return String(text || '').replace(/\r/g, '').replace(/[\u200e\u200f\u202a-\u202e\u2066-\u2069\ufeff]/g, '').replace(/[\u00a0\u202f]/g, ' ')
    .replace(/\s*<Bu mesaj düzenlendi>/gi, '').replace(/\s*<Medya dahil edilmedi>/gi, '').replace(/\s*(görüntü|video|ses|çıkartma|GIF) dahil edilmedi/gi, '');
}
const NOISE = /^(bu mesaj silindi\.?|bu mesaj .* tarafından silindi\.?|mesajlar ve aramalar uçtan uca şifrelidir.*|.* bu grubu oluşturdu|.* grup adını .*|.* bu grubun simgesini değiştirdi|eklendiniz|.* kişisini ekledi|.* bir mesajı sabitledi|.* kullanıcı adını oluşturdu)$/i;
export const PDF_RE = /^(.+?)(?:\s+\d+)?\.pdf\s*•?.*$/i;

export function splitMessages(text) {
  text = cleanWA(text);
  const lines = String(text || '').split('\n');
  const hasHeaders = lines.some(l => HEAD_RE.test(l));
  const out = [];
  if (hasHeaders) {
    let cur = null;
    for (const l of lines) {
      const h = l.match(HEAD_RE);
      if (h) {
        if (cur) out.push(cur);
        const y = h[3].length === 2 ? '20' + h[3] : h[3];
        cur = { lines: [l.replace(HEAD_RE, '')], date: `${y}-${h[2].padStart(2, '0')}-${h[1].padStart(2, '0')}`, sender: h[4].trim() };
      } else if (cur) cur.lines.push(l); else cur = { lines: [l], date: null, sender: null };
    }
    if (cur) out.push(cur);
    const res = [];
    for (const b of out) {
      const text = b.lines.join('\n').trim(); if (!text || NOISE.test(text)) continue;
      // sipariş olmayan sohbet mesajları ("çıktı mı", "İADE", tek başına PDF) atlanır
      if (!isOrderish(text) && !(text.match(PHONE_RE))) { res.ignored = (res.ignored || 0) + 1; continue; }
      res.push({ text, date: b.date, sender: b.sender, phone: (text.match(PHONE_RE) || [])[0] || null });
    }
    return res;
  }
  const blocks = String(text || '').replace(/\r/g, '').split(/\n\s*\n+/).map(s => s.trim()).filter(Boolean);
  for (const b of blocks) {
    const ph = (b.match(PHONE_RE) || [])[0];
    const prev = out[out.length - 1];
    if (!ph && prev && !isOrderish(b)) { prev.text += '\n' + b; prev.merged = true; continue; }
    if (ph && prev && prev.phone && normalizePhone(prev.phone).phone === normalizePhone(ph).phone) { prev.text += '\n' + b; prev.merged = true; continue; }
    out.push({ text: b, phone: ph || null });
  }
  return out;
}

const LABELS = {
  name: /^(?:ad\s*soyad|adı\s*soyadı|adi\s*soyadi|isim\s*soyisim|isim|ad|müşteri|musteri|alıcı|alici)\s*[:=-]\s*(.+)$/i,
  phone: /^(?:tel|telefon|gsm|cep|numara|no)\s*[:=-]\s*(.+)$/i,
  address: /^(?:adres|açık adres|acik adres|teslimat adresi)\s*[:=-]\s*(.+)$/i,
  il: /^(?:il|şehir|sehir)\s*[:=-]\s*(.+)$/i,
  ilce: /^(?:ilçe|ilce)\s*[:=-]\s*(.+)$/i,
  payment: /^(?:ödeme|odeme|ödeme şekli|odeme sekli)\s*[:=-]\s*(.+)$/i,
  product: /^(?:ürün|urun|ürünler|urunler|sipariş|siparis)\s*[:=-]\s*(.+)$/i,
  total: /^(?:toplam|tutar|ücret|ucret|fiyat|toplam tutar)\s*[:=-]\s*(.+)$/i
};

export function parseText(text, { sources = [], payments = [], reps = [] } = {}) {
  const msgs = splitMessages(text);
  return msgs.map((m, idx) => isOrderish(m.text) ? parseWA(m, idx, sources, payments, reps) : parseOne(m, idx, sources, payments));
}

function parseOne(m, idx, sources, payments) {
  const lines = m.text.split('\n').map(s => s.trim()).filter(Boolean);
  const o = { customer_name: '', phone: '', address: '', il: '', ilce: '', source: 'Belirsiz', payment: 'Belirsiz', order_total: null, note: '', items: [], uncertain_fields: [], source_ref: `Metin, ${idx + 1}. mesaj`, raw_text: m.text };
  const used = new Set();
  const isProd = l => { const c = l.replace(PHONE_RE, ''); return PRODUCT_WORDS.test(c) && !(ADDRESS_WORDS.test(c) && !/testere|şerit|serit|bıçak|bicak|\d\s*[x×*]\s*\d/i.test(c)); };
  lines.forEach((l, i) => {
    for (const [k, re] of Object.entries(LABELS)) {
      const mm = l.match(re); if (!mm) continue;
      used.add(i);
      const v = mm[1].trim();
      if (k === 'name') o.customer_name = v;
      else if (k === 'phone') o.phone = v;
      else if (k === 'address') o.address = v;
      else if (k === 'il') o.il = v;
      else if (k === 'ilce') o.ilce = v;
      else if (k === 'payment') o._pay = v;
      else if (k === 'product') o._prod = (o._prod || []).concat(v);
      else if (k === 'total') { const mv = v.match(/(\d[\d.,]*)/); if (mv) o.order_total = parseMoney(mv[1]); }
      break;
    }
  });
  if (!o.phone) { const ph = m.text.match(PHONE_RE); if (ph) o.phone = ph[0].trim(); }
  if (!o.phone) o.uncertain_fields.push('phone');
  // isim: etiketsizse ilk "sadece harf" satırı
  if (!o.customer_name) {
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i].replace(PHONE_RE, '').replace(/[-–:,]+$/, '').trim();
      if (used.has(i) || !l) continue;
      if (/\d/.test(l) || isProd(l) || ADDRESS_WORDS.test(l)) continue;
      if (/kapıda|kapida|havale|eft|iban|instagram|facebook|whatsapp|sipariş|siparis|merhaba|selam|teşekkür|kargo/i.test(l)) continue;
      const w = l.split(/\s+/);
      if (w.length >= 2 && w.length <= 4 && l.length <= 40) { o.customer_name = l; used.add(i); break; }
    }
  }
  if (!o.customer_name) o.uncertain_fields.push('customer_name');
  // adres
  if (!o.address) {
    const al = lines.filter((l, i) => !used.has(i) && ADDRESS_WORDS.test(l) && !isProd(l));
    if (al.length) o.address = al.join(' ').replace(PHONE_RE, '').trim();
  }
  if (!o.address) o.uncertain_fields.push('address');
  // il/ilçe: etiket yoksa metinden bul (sadece listede birebir geçiyorsa)
  if (!o.il) {
    const r = findIlIlce(lines.filter(l => !isProd(l)).join('\n'));
    if (r.il) { o.il = r.il; if (r.ilGuessed) o.uncertain_fields.push('il'); }
    if (r.ilce && !o.ilce) o.ilce = r.ilce;
  }
  if (!o.il) o.uncertain_fields.push('il');
  if (!o.ilce) o.uncertain_fields.push('ilce');
  o.payment = detectPayment((o._pay || '') + ' ' + m.text, payments);
  if (o.payment === 'Belirsiz') o.uncertain_fields.push('payment');
  if (/kap[iı]da/i.test(m.text) && o.payment === 'Belirsiz') o.note = 'Kapıda ödeme yazıyor; nakit mi kart mı belirtilmemiş.';
  o.source = detectSource(m.text, sources);
  if (o.source === 'Belirsiz') o.uncertain_fields.push('source');
  if (o.order_total == null) {
    const tl = lines.find(l => /toplam|tutar|ücret|ucret/i.test(l) && MONEY_RE.test(l));
    if (tl) o.order_total = parseMoney(tl.match(MONEY_RE)[1]);
  }
  // ürün satırları
  const prodLines = (o._prod || []).concat(lines.filter((l, i) => !used.has(i) && isProd(l)));
  for (const pl of prodLines) {
    const it = { raw_text: pl, qty: null, unit_price: null, line_total: null, uncertain: [] };
    const q = pl.match(/(\d+)\s*(?:adet|ad\.?|tane|pcs|pc)\b/i) || pl.match(/(?:adet|miktar)\s*[:=]?\s*(\d+)/i);
    if (q) it.qty = parseInt(q[1]); else it.uncertain.push('qty');
    const mon = pl.match(MONEY_RE);
    if (mon) {
      const v = parseMoney(mon[1]);
      if (/birim|tanesi|adeti|adet fiyat|tane fiyat/i.test(pl)) it.unit_price = v;
      else { it.line_total = v; if (!/toplam/i.test(pl) && (it.qty || 0) > 1) it.uncertain.push('price_kind'); }
    }
    const lenM = fold(pl).match(/(\d{3,5})\s*(mm|cm)\b/) || fold(pl).match(/\b(\d{3,5})\s*[x*×]/);
    if (lenM && parseFloat(lenM[1]) >= 500 && /serit|şerit|karbon|bimetal|kemik|et |tpi|\d{1,2}\s*[x*×]\s*0[.,]\d/i.test(fold(pl))) {
      let v = parseFloat(lenM[1]); if (lenM[2] === 'cm') v *= 10; it.length_mm = v;
    }
    o.items.push(it);
  }
  if (!o.items.length) o.uncertain_fields.push('items');
  // tek ürün ve toplam varsa birim fiyatı toplamdan türet (işaretle)
  if (o.items.length === 1) {
    const it = o.items[0];
    if (it.line_total == null && it.unit_price == null && o.order_total != null) { it.line_total = o.order_total; it.uncertain.push('price_from_total'); }
  }
  for (const it of o.items) {
    if (it.unit_price == null && it.line_total != null && it.qty) it.unit_price = +(it.line_total / it.qty).toFixed(4);
    if (it.unit_price == null && it.line_total == null) it.uncertain.push('price');
  }
  if (m.merged) o.note = (o.note ? o.note + ' ' : '') + 'Birden fazla mesaj tek siparişte birleştirildi.';
  delete o._pay; delete o._prod;
  return o;
}



// ---------------------------------------------------------------------------
// Testeresan WhatsApp sevkiyat grubu biçimi (iki grubun tüm geçmişinden çıkarılan kalıplar):
//  başlık: *KAPIDA NAKİT ÖDEME* · KAPIDA K.KARTI ÖDEME · *YURTİÇİ KARGO ALICI ÖDEMELİ* · *ARAS KARGO ...* · *MAĞAZA* · KARAKÖY MAĞAZA TESLİM
//          *RESMİ SATIŞ ...* · *ADRESE BIRAKILCAK* · *PEŞİN ÖDEME* (başta veya sonda) · başlık hiç olmayabilir
//  müşteri: isim (parantezli ek: "(Usta)", "(Gökhan Akdoğan)") · telefon (0532.., +90 5.., 5xx.., "TEL :") · adres 1-3 satır, il/ilçe sonda
//           kargo anlaşma kodu satırı · resmi satışta *FATURA BİLGİLERİ*, VKN / V.D, e-posta · mağazada isim veya telefon olmayabilir
//  ürün:   "1-305x80z Kronberg Drycut [5350₺]" · "1- 80 diş" · "4 ad. freze ..." · "20 adet 2240x13x0.36x14 tpi karbon" · "9-freze bileme"
//          fiyat ₺'li/₺'siz, "+KDV", alt satırda "(Sentetik için)" gibi not, "(çıkma)"
//  toplam: Wp5350₺ · wp4950₺ · Wp 27.500₺ KDV DAHİL · wp(MD) 11.400₺ · insta3150₺ · İnsta4160₺(özel iskontolu) · Mağaza 4700₺ [iban|toplam]
//          Mağazada ödenicek Toplam 1950₺ · TOPLAM 11.580₺ · 4500₺ · 19.000₺ (M.cemal) · 1600₺ Nakit · Wp(değişim ...) = değişim, satış değil
//  temsilci: (M.cemal) (Dogan) (DOGAN) (dogan) (M.arslan) (Dogan hdy) (M.arslan) (ödeme geldi) — yoksa gönderen kişi
const STATUS_RE = /(kap[ıi]da|havale|eft|iban|resm[iİ]|gayr[iİ]|ma[gğ]aza|teslim|ptt|kargo|yurt[iİ]ç[iİ]|aras|mng|s[uü]rat|elden|nakit|kredi|k\.?\s?kart|[öo]deme|sat[ıi][şs]|pe[şs]in|adrese|b[ıi]rak|nakliye|acil|al[ıi]c[ıi]|p\.?ö|reklam|bedelsiz|hediye|[uü]cretsiz|numune)/i;
const SRC_MAP = [[/^(wp|wa|whatsapp|watsap)$/i, 'WhatsApp'], [/^(fb|face|facebook)$/i, 'Facebook'], [/^([iİı]g|[iİı]nsta|[iİı]nstagram)$/i, 'Instagram'], [/^(ma[gğ]aza|ma[gğ]azada|dükkan|dukkan)$/i, 'Mağaza']];
const TAX_RE = /(?:\(?\s*([^()\d]*?)\s*V\.?\s*D\.?\s*(?:tax\s*no|vergi\s*no|vkn|tckn|no)?\s*[:.]?\s*([\d\s]{10,14})\s*\)?)|(?:\b(?:VKN|TCKN|vergi\s*no)\s*[:.]?\s*([\d\s]{10,14})(?:\s*V\.?\s*D\.?\s*([\p{L} ]+))?)/iu;
const EMAIL_RE = /[\w.+-]+@[\w-]+\.[\w.]+/;
const COMPANY_RE = /\b(ltd|şti|sti|a\.?ş\.?|ticaret|tic\.|san\.|sanayi|inşaat|insaat|i̇nş|limited|anonim|pazarlama|paz\.|yapı|yapi|ferforje|otomotiv|otomativ|makina|makine)\b/i;
const CARGO_RE = /(anla[şs]ma|kargo\s*kod|kod[uü]\s*:)/i;
const PROMO_RE = /(reklam|bedelsiz|[uü]cretsiz|hediye|numune|i[sş]\s*birli[gğ]i|influencer)/i;
const EXCH_RE = /(de[gğ]i[şs]im|iade|tekrar\s*(gid|yap)|k[oö]t[uü]\s*olmu[şs]|geri\s*geldi|yine\s*gid)/i;
const cap = s => s.replace(/(^|[\s.])(\p{L})/gu, (m, a, b) => a + b.toLocaleUpperCase('tr'));
const repKey = s => fold(s).replace(/[^a-z0-9]/g, '');
function isRepToken(txt, reps) {
  const first = txt.trim().split(/\s+/)[0] || '';
  const k = repKey(first);
  if (!k) return false;
  if (reps.some(r => [r.name, ...String(r.aliases || '').split(',')].some(a => a.trim() && repKey(a) === k))) return true;
  return /^[a-zçğıöşü]\.[a-zçğıöşü]{2,}$/i.test(first) || /^(dogan|doğan|cemal|arslan)$/i.test(first);
}
function payFrom(t, payments) {
  const l = fold(t);
  if (/kontroll?u|ptt\s*kontrol/.test(l)) return pick(payments, 'Kapıda Kontrollü');
  if (/kapida/.test(l)) { if (/kart|kredi|pos/.test(l)) return pick(payments, 'Kapıda Kredi Kartı'); if (/nakit/.test(l)) return pick(payments, 'Kapıda Nakit'); return 'Belirsiz'; }
  if (/havale|eft|iban|dekont|odeme geldi/.test(l)) return pick(payments, 'Havale');
  if (/pesin/.test(l)) return pick(payments, 'Havale');
  if (/\bnakit\b/.test(l)) return pick(payments, 'Mağaza Nakit');
  if (/kredi kart|k\.?\s?kart|\bkart\b|pos/.test(l)) return pick(payments, 'Kredi Kartı');
  return 'Belirsiz';
}
function priceTail(body) { // satır sonundaki fiyat: "3800₺", "4500₺+KDV", "6000₺ KDV DAHİL", "karbon 1260"
  let m = body.match(/(\d{1,3}(?:[.,]\d{3})+|\d{2,7})\s*(?:₺|tl|try)\s*(\+\s*kdv|kdv\s*dah[iİı]l|kdv\s*har[iİı][çc])?\s*$/i);
  if (m) return { v: parseMoney(m[1]), idx: m.index, vat: m[2] ? (/\+/.test(m[2]) || /hari/i.test(m[2]) ? 'excl' : 'incl') : null };
  m = body.match(/[\p{L})]\s+(\d{1,3}(?:[.,]\d{3})+|\d{3,7})\s*$/u);
  if (m && parseMoney(m[1]) >= 100) return { v: parseMoney(m[1]), idx: m.index + 1, vat: null };
  return null;
}

function parseWA(m, idx, sources, payments, reps = []) {
  const lines = m.text.split('\n').map(x => x.trim()).filter(Boolean);
  const o = { date: m.date || null, sender: m.sender || '', customer_name: '', phone: '', address: '', il: '', ilce: '', source: 'Belirsiz', payment: 'Belirsiz', order_total: null, note: '', items: [], uncertain_fields: [], is_official: false, tax_no: '', tax_office: '', official_title: '', email: '', delivery: '', rep: '', rep_note: '', rep_from_sender: false, anonymous: false, exchange: false, vat_mode: null, source_ref: `${m.date ? m.date.split('-').reverse().join('.') + ' · ' : ''}${idx + 1}. mesaj`, raw_text: m.text };
  const notes = [];
  const rest = [];
  let seenTotal = false, lastItem = null, pdfName = '';
  const takeRep = (txt) => { const parts = txt.trim().split(/\s+/); o.rep = parts[0]; if (parts.length > 1) o.rep_note = parts.slice(1).join(' '); };
  lines.forEach((raw, i) => {
    let l = raw.replace(/^\*+|\*+$/g, '').trim();
    let mm;
    if (!l) return;
    if ((mm = l.match(PDF_RE)) && /\.pdf/i.test(l)) { pdfName = mm[1].trim(); return; }
    if (/^ma[gğ]aza\s*(sat[ıi][şs][ıi]?|m[üu][şs]terisi|teslim)?\s*$/i.test(l)) { o.store = true; return; }
    // durum / başlık satırı (genelde ilk satır, bazen *PEŞİN ÖDEME* sonda)
    const upper = (() => { const L = l.replace(/\([^)]*\)/g, '').replace(/[^\p{L}]/gu, ''); return L.length >= 4 && L.replace(/[^\p{Lu}]/gu, '').length / L.length > 0.6; })();
    if (/^\*.*\*$/.test(raw) || (i === 0 && upper && STATUS_RE.test(l) && !/\d{3,}/.test(l))) {
      if (STATUS_RE.test(l) && !/\d{3,}/.test(l)) {
        const p = payFrom(l, payments); if (p !== 'Belirsiz') o.payment = p;
        if (/kap[ıi]da/i.test(l) && p === 'Belirsiz') notes.push('Kapıda ödeme yazıyor; nakit/kart belirtilmemiş.');
        if (/resm[iİ]/i.test(l) && !/gayr/i.test(l)) o.is_official = true;
        if (/fatura bilgi/i.test(l)) { rest.push('FATURA BİLGİLERİ'); return; }
        const low = l.toLocaleLowerCase('tr');
        const del = low.split(/\s+/).filter(w => !/^(gayr[iı]resm[iı]|kap[ıi]da|nakit|k\.?kart[ıi]?|kredi|kart[ıi]?|[öo]deme|resm[iı]|sat[ıi][şs][ıi]?|pe[şs]in|reklam|bedelsiz|hediye|[uü]cretsiz|numune)$/.test(w)).join(' ').trim();
        if (del) o.delivery = cap(del);
        if (/^ma[gğ]aza\b/.test(low) || /ma[gğ]aza(dan)?\s*(teslim|m[uü][şs]teri|ald[ıi])|karak[öo]y/.test(low)) o.store = true;
        return;
      }
      if (/fatura bilgi/i.test(l)) { rest.push('FATURA BİLGİLERİ'); return; }
      notes.push(l); return; // "*100 DİŞ olucak*", "*Acelesi yok*"
    }
    // temsilci + toplam aynı satırda: "(M.cemal) 2890₺" / "19.000₺ (M.cemal)"
    if ((mm = l.match(PLAIN_AMT_RE)) && (lastItem || o.items.length)) {
      o.order_total = parseMoney(mm[2]); seenTotal = true;
      if (mm[1] && isRepToken(mm[1], reps)) takeRep(mm[1]); else if (mm[1]) notes.push(mm[1]);
      let tail = (mm[3] || '').trim();
      const rp = tail.match(/^\(([^)]+)\)(.*)$/); if (rp && isRepToken(rp[1], reps)) { takeRep(rp[1]); tail = rp[2].trim(); }
      if (tail) { const p = payFrom(tail, payments); if (p !== 'Belirsiz') o.payment = p; if (/kdv\s*dahil/i.test(tail)) o.vat_mode = 'incl'; notes.push(tail.replace(/^\(|\)$/g, '')); }
      return;
    }
    if ((mm = l.match(TOTAL_RE))) {
      const src = SRC_MAP.find(([re]) => re.test(mm[1])); if (src && sources.includes(src[1])) o.source = src[1];
      if (/^ma[gğ]aza/i.test(mm[1])) o.store = true;
      o.order_total = parseMoney(mm[3]); seenTotal = true;
      if (mm[2]) { const inner = mm[2].slice(1, -1); if (EXCH_RE.test(inner)) o.exchange = true; const pp = payFrom(inner, payments); if (pp !== 'Belirsiz') o.payment = pp; const onlyPay = !fold(inner).replace(/ptt|kapida|kontroll?u|nakit|kredi|kart[ıi]?|havale|eft|odeme|ile|[^a-z]/g, '').trim(); if (!(pp !== 'Belirsiz' && onlyPay)) notes.push(inner); }
      let tail = (mm[4] || '').trim();
      const rp = tail.match(/\(([^)]+)\)/g) || [];
      for (const x of rp) { const t = x.slice(1, -1); if (!o.rep && isRepToken(t, reps)) takeRep(t); else notes.push(t); }
      tail = tail.replace(/\([^)]*\)/g, '').trim();
      if (tail) { const p = payFrom(tail, payments); if (p !== 'Belirsiz') o.payment = p; if (/kdv\s*dahil/i.test(tail)) o.vat_mode = 'incl'; if (!/^(toplam|kdv dahil)$/i.test(tail)) notes.push(tail); }
      return;
    }
    if ((mm = l.match(TOTAL_EMPTY_RE))) { // Wp(değişim, kaynak yeri sıkıntılı)
      const src = SRC_MAP.find(([re]) => re.test(mm[1])); if (src && sources.includes(src[1])) o.source = src[1];
      seenTotal = true; o.order_total = 0; if (EXCH_RE.test(mm[2])) o.exchange = true; notes.push(mm[2]); return;
    }
    // ürün satırı (adet öneki yoksa "305x80z Kronberg" gibi ölçüyle başlayan satır = 1 adet)
    let noQty = false;
    if (!mm && /^\d{2,4}\s*[x*×]\s*\d/i.test(l) && !PHONE_RE.test(l) && (PHONE_RE.lastIndex = 0, true)) { mm = [l, '1', l]; noQty = true; }
    if (mm || (mm = l.match(ITEM_RE)) || (mm = l.match(ITEM2_RE))) {
      let body = mm[2].trim();
      const it = { raw_text: l, qty: parseInt(mm[1]), unit_price: null, line_total: null, uncertain: noQty ? ['qty_assumed'] : [] };
      const notesIn = (body.match(/\(([^)]*)\)/g) || []).map(x => x.slice(1, -1));
      const pt = priceTail(body.replace(/\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim());
      if (pt) { it.line_total = pt.v; if (pt.vat) { it.vat = pt.vat; o.vat_mode = o.vat_mode || pt.vat; } }
      body = body.replace(/\([^)]*\)/g, ' ').replace(/\*[^*]*\*/g, m2 => { notes.push(m2.replace(/\*/g, '')); return ' '; });
      if (pt) body = body.replace(/(\d{1,3}(?:[.,]\d{3})+|\d{2,7})\s*(?:₺|tl|try)?\s*(\+\s*kdv|kdv\s*dah[iİı]l|kdv\s*har[iİı][çc])?\s*$/i, '');
      body = body.replace(/\s+/g, ' ').trim();
      if (/çıkma|cikma|ikinci el|2\.\s?el/i.test(mm[2])) { it.second_hand = true; notes.push(`Çıkma (ikinci el): ${body}`); }
      const extra = notesIn.filter(x => !/çıkma|cikma/i.test(x));
      if (extra.some(x => EXCH_RE.test(x))) o.exchange = true;
      if (extra.length) it.note = extra.join(', ');
      if (/bileme|bilet|kaynak|kaynat|kopan|tamir|torna|di[şs]\s*a[çc]/i.test(body) && !/kaynakl[ıi]/i.test(body)) it.service = true;
      it.spec = body;
      o.items.push(it); lastItem = it; return;
    }
    // parantezli tek satır: temsilci (sonda) veya not
    if ((mm = l.match(/^\(([^)]+)\)(?:\s*\(([^)]+)\))?$/))) {
      if ((seenTotal || i === lines.length - 1) && isRepToken(mm[1], reps)) { takeRep(mm[1]); if (mm[2]) notes.push(mm[2]); return; }
      if (lastItem && !seenTotal) { lastItem.note = (lastItem.note ? lastItem.note + ', ' : '') + mm[1]; if (EXCH_RE.test(mm[1])) o.exchange = true; return; }
      if (EXCH_RE.test(mm[1])) o.exchange = true;
      notes.push(mm[1]); return;
    }
    if (!seenTotal && /(bileme|bilet|kaynak\b|kaynat|kopan|tamir|di[şs]\s*a[çc]|makine(si)?\b|testere\s*makine)/i.test(l) && !(ADDRESS_WORDS.test(l) && !/bileme|kaynak|tamir|kopan|di[şs]\s*a[çc]/i.test(l)) && !PHONE_RE.test(l) && (PHONE_RE.lastIndex = 0, true)) {
      const pt = priceTail(l); const spec = pt ? l.slice(0, pt.idx).trim() : l;
      const it = { raw_text: l, qty: 1, unit_price: null, line_total: pt ? pt.v : null, uncertain: ['qty'], spec, service: /bileme|bilet|kaynak|kaynat|kopan|tamir|di[şs]\s*a[çc]/i.test(l), kind: /makine/i.test(l) ? 'diger' : undefined };
      o.items.push(it); lastItem = it; return;
    }
    if (o.items.length && !seenTotal && !PHONE_RE.test(l)) { PHONE_RE.lastIndex = 0; notes.push(l); return; } // ürünlerin arasındaki serbest not
    PHONE_RE.lastIndex = 0;
    rest.push(l);
  });
  // kalan satırlar: isim, telefon, adres, vergi, e-posta, kargo kodu
  const addr = []; let invBlock = false; const invAddr = [];
  for (let l of rest) {
    if (/^fatura\s*(bilgi\w*|adres\w*|icin)\b/.test(fold(l.replace(/[*_:]/g, '')).trim())) { invBlock = true; o.is_official = true; continue; }
    let vd = l.match(/V\.?\s*D\.?\s*[:.]?\s*([\p{L}][\p{L} ]*?)\s*[-,/]?\s*(?:VKN|TCKN|TC|vergi\s*no)\s*[:.]?\s*(\d[\d\s]{9,13})/iu);
    if (vd) vd = { all: vd[0], office: vd[1], no: vd[2] };
    else { const w = l.match(/(?:VKN|TCKN|vergi\s*no)\s*[:.]?\s*(\d[\d\s]{9,13})\s*[-,/]?\s*V\.?\s*D\.?\s*[:.]?\s*([\p{L}][\p{L} ]*)/iu); if (w) vd = { all: w[0], office: w[2], no: w[1] }; }
    if (vd) { o.tax_office = vd.office.trim(); o.tax_no = vd.no.replace(/\s/g, ''); o.is_official = true; l = l.replace(vd.all, '').trim(); if (!l) continue; }
    const vd2 = l.match(/^(?:V\.?\s*D\.?|vergi\s*dairesi)\s*[:.]?\s*([\p{L}][\p{L} .]*)$/iu);
    if (vd2) { o.tax_office = vd2[1].trim(); o.is_official = true; continue; }
    if (invBlock) {
      if (EMAIL_RE.test(l)) { o.email = l.match(EMAIL_RE)[0]; continue; }
      if (!TAX_RE.test(l) && !PHONE_RE.test(l) && (PHONE_RE.lastIndex = 0, true) && !o._title && !/\d{2,}/.test(l)) { o._title = l.replace(/[*_]/g, '').trim(); continue; }
      PHONE_RE.lastIndex = 0;
      if (!TAX_RE.test(l) && !PHONE_RE.test(l)) { PHONE_RE.lastIndex = 0; invAddr.push(l); continue; }
      PHONE_RE.lastIndex = 0;
    }
    const em = l.match(EMAIL_RE); if (em) { o.email = em[0]; l = l.replace(em[0], '').trim(); if (!l) continue; }
    const tx = l.match(TAX_RE);
    if (tx) { o.tax_no = (tx[2] || tx[3] || '').replace(/\s/g, ''); o.tax_office = (tx[1] || tx[4] || '').replace(/^\(|[:.]$/g, '').trim(); o.is_official = true; l = l.replace(tx[0], '').trim(); if (!l) continue; }
    if (CARGO_RE.test(l) || /^[\d\s-]{9,13}$/.test(l) && !l.replace(/\D/g, '').match(/^0?5\d{9}$/)) {
      const code = (l.match(/[\d][\d\s-]{6,}\d/) || [''])[0].replace(/\s/g, '');
      notes.push(code ? `Kargo anlaşma kodu: ${code}` : l);
      const restTxt = l.replace(/.*?(anla[şs]ma\s*(no|kodu)?|kod[uü])\s*[:.]?\s*[\d\s-]*/i, '').trim();
      if (restTxt && restTxt.length > 3 && !/^\d+$/.test(restTxt)) addr.push(restTxt);
      continue;
    }
    const ph = l.match(PHONE_RE); PHONE_RE.lastIndex = 0;
    if (ph && !o.phone) {
      o.phone = ph[0].trim();
      const left = l.replace(ph[0], '').replace(/^(tel|telefon|gsm|cep)\s*[:.]?\s*/i, '').trim();
      if (left) { const pp = left.match(/^\((.*)\)$/); if (pp) notes.push(pp[1]); else if (!o.customer_name && !/\d/.test(left)) o.customer_name = left; else addr.push(left); }
      continue;
    }
    if (!o.customer_name && !/\d{2,}/.test(l) && (!ADDRESS_WORDS.test(l) || COMPANY_RE.test(l)) && (!addr.length || !o.phone)) {
      const pn = l.match(/^(.*?)\s*\(([^)]*)\)\s*$/);
      if (pn && pn[1]) { o.customer_name = pn[1].trim(); notes.push(pn[2]); } else o.customer_name = l;
      continue;
    }
    addr.push(l);
  }
  if (!o.customer_name && pdfName) o.customer_name = pdfName;
  o.address = addr.join(' ').replace(/\s+/g, ' ').trim();
  if (o._title) { o.official_title = o._title; delete o._title; }
  if (invAddr.length) notes.push('Fatura adresi: ' + invAddr.join(' '));
  if (!o.official_title && o.customer_name && COMPANY_RE.test(o.customer_name)) o.official_title = o.customer_name;
  if (o.is_official && !o.official_title) o.official_title = o.customer_name;
  const loc = o.address ? findIlIlce(o.address) : { il: null, ilce: null };
  o.il = loc.il || ''; o.ilce = loc.ilce || '';
  if (!o.rep && m.sender && !/testere|teseresan|testeresan|ustas/i.test(m.sender)) { o.rep = m.sender; o.rep_from_sender = true; }
  if (o.store && o.source === 'Belirsiz' && sources.includes('Mağaza')) o.source = 'Mağaza';
  o.anonymous = !o.customer_name && !o.phone;
  if (o.anonymous) { if (o.source === 'Belirsiz' && sources.includes('Mağaza')) o.source = 'Mağaza'; }
  else {
    if (!o.customer_name) o.uncertain_fields.push('customer_name');
    if (!o.phone) o.uncertain_fields.push('phone');
    if (!o.store && !o.il) o.uncertain_fields.push('il');
    if (!o.store && o.il && !o.ilce) o.uncertain_fields.push('ilce');
  }
  if (o.source === 'Belirsiz') o.uncertain_fields.push('source');
  // iş kuralı: ödeme şekli hiç yazılmamış kargo siparişi = Havale
  if (o.payment === 'Belirsiz' && !o.anonymous && !o.store && !/kap[ıi]da/i.test(m.text) && payments.includes('Havale')) o.payment = 'Havale';
  o.promo = !o.exchange && PROMO_RE.test(m.text.replace(/reklam\s*(ajans|ofis)\w*/ig, ''));
  if (o.payment === 'Belirsiz' && !o.anonymous && !o.store) o.uncertain_fields.push('payment');
  // mağaza siparişi: ödeme yazmıyorsa ya da nakit yazıyorsa Mağaza Nakit
  if ((o.payment === 'Belirsiz' || o.payment === 'Nakit') && (o.store || o.anonymous || o.source === 'Mağaza') && !o.exchange && payments.includes('Mağaza Nakit')) { o.payment = 'Mağaza Nakit'; o.uncertain_fields = o.uncertain_fields.filter(x => x !== 'payment'); }
  if (o.promo && !(o.order_total > 0) && !o.items.some(it => it.line_total > 0)) { o.payment = 'Belirsiz'; o.uncertain_fields = o.uncertain_fields.filter(x => x !== 'payment'); } // fiyatsız reklam/bedelsiz gönderim: ödeme sorulmaz
  if (!o.items.length) o.uncertain_fields.push('items');
  if (!o.date) o.uncertain_fields.push('date');
  // fiyatlar: tek ürün + toplam → satır toplamı; çok ürün → satır fiyatları, eksik tek satırı toplamdan tamamla
  if (o.exchange) { for (const it of o.items) { it.line_total = 0; } notes.unshift('DEĞİŞİM / TEKRAR GÖNDERİM — satış değil'); }
  if (o.promo && o.order_total == null && !o.items.some(it => it.line_total != null)) { for (const it of o.items) { it.line_total = 0; it.uncertain = (it.uncertain || []).filter(u => !/price/.test(u)); } } // fiyat yazılmamışsa bedelsiz; fiyat varsa aynen alınır
  const priced = o.items.filter(it => it.line_total != null);
  if (o.items.length === 1 && o.items[0].line_total == null && o.order_total != null) o.items[0].line_total = o.order_total;
  else if (o.items.length > 1 && o.order_total != null) {
    const missing = o.items.filter(it => it.line_total == null);
    const sum = priced.reduce((a, it) => a + it.line_total, 0);
    if (missing.length === 1) missing[0].line_total = Math.max(0, o.order_total - sum);
    else if (missing.length > 1 && !priced.length) { // fiyatsız çok ürün: toplam adet başına eşit bölünür (dişi farklı aynı ürün aynı fiyat)
      const units = missing.reduce((a, it) => a + (Number(it.qty) || 1), 0);
      const per = Math.round(o.order_total / units * 100) / 100;
      const key = it => { const t = it.spec || it.raw_text || ''; const d = extractDims(t); const w = fold(t).replace(/[^a-z ]+/g, ' ').split(/\s+/).filter(x => x.length > 2 && !['tpi', 'adet', 'dis', 'mm'].includes(x)).sort().join(' '); return [d.width, d.thickness, d.length_mm, d.diameter, d.bore, it.service ? 's' : '', w].join('|'); };
      const same = new Set(missing.map(key)).size === 1;
      let acc = 0;
      missing.forEach((it, k) => { const q = Number(it.qty) || 1; it.line_total = k === missing.length - 1 ? Math.round((o.order_total - acc) * 100) / 100 : Math.round(per * q * 100) / 100; acc += it.line_total; if (!same) it.uncertain.push('price_even'); });
    } else if (missing.length > 1) missing.forEach(it => it.uncertain.push('price'));
    else if (o.vat_mode !== 'excl' && Math.abs(sum - o.order_total) > 1) notes.push(`Satır fiyatları toplamı (${sum}) mesajdaki toplamdan (${o.order_total}) farklı.`);
  }
  for (const it of o.items) { if (it.line_total != null && it.qty) it.unit_price = +(it.line_total / it.qty).toFixed(4); if (it.line_total == null) it.uncertain.push('price'); }
  for (const it of o.items) if (it.note) notes.push(`${it.spec}: ${it.note}`);
  if (o.delivery) notes.unshift(o.delivery);
  if (o.email) notes.push('E-posta: ' + o.email);
  if (o.rep_note) notes.push(`Temsilci notu: ${o.rep_note}`);
  const tags = [];
  if (o.promo) { if (/reklam/i.test(m.text)) tags.push('#reklam'); if (/bedelsiz|[uü]cretsiz|hediye/i.test(m.text)) tags.push('#bedelsiz'); if (/numune/i.test(m.text)) tags.push('#numune'); if (!tags.length) tags.push('#bedelsiz'); }
  if (o.items.some(it => it.service && /bileme|bilet|di[şs]\s*a[çc]|tamir|torna/i.test(it.raw_text || ''))) tags.push('#bileme');
  if (o.items.some(it => it.service && /kaynak|kaynat|kopan/i.test(it.raw_text || ''))) tags.push('#kaynak');
  const rest2 = [...new Set(notes.map(x => x.trim()).filter(Boolean))].filter(x => !/^((reklam|bedelsiz|hediye|ucretsiz|numune|icin|olarak|gonderim\w*)\s*)+$/.test(fold(x).replace(/[^a-z ]/g, '').trim()) && !/^Çıkma \(ikinci el\)/.test(x));
  o.note = [tags.join(' '), rest2.join(' · ')].filter(Boolean).join(' · ');
  return o;
}
