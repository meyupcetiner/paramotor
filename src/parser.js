// Kural tabanlı metin ayrıştırıcı (API anahtarı gerektirmez). Sadece yapıştırılan METİN için.
// Çıktı biçimi Claude ayrıştırıcısıyla aynıdır. Emin olunmayan alanlar boş bırakılır ve işaretlenir.
import '../public/il-ilce.js';
import { trLower, fold } from './match.js';

const IL = globalThis.IL_ILCE;
const IL_FOLD = Object.keys(IL).map(il => ({ il, f: fold(il), ilceler: IL[il].map(x => ({ x, f: fold(x) })) }));

export const PHONE_RE = /(?:\+?\s?90[\s.-]?)?\(?0?\s?5\d{2}\)?[\s.-]?\d{3}[\s.-]?\d{2}[\s.-]?\d{2}/g;
const WA_HEADER = /^\s*\[?\d{1,2}[./]\d{1,2}[./]\d{2,4},?\s+\d{1,2}[:.]\d{2}(?::\d{2})?\]?\s*(?:-\s*)?(?:[^:\n]{1,40}):\s?/;
const PRODUCT_WORDS = /(testere|şerit|serit|bıçak|bicak|daire|kronberg|onci|glg|krabbe|junior|schuster|flamex|freud|mdf|alüminyum|aluminyum|ahşap|ahsap|dry ?cut|bimetal|karbon|carbide|kemik|betopan|planya|tpi|\bdiş\b|\bdis\b|\bz\s?\d{2,3}\b|\d{2,4}\s*[x×*]\s*\d)/i;
const ADDRESS_WORDS = /(mah\.?|mahalle|mh\.?|sok\.?|sokak|sk\.?|cad\.?|cadde|cd\.?|bulvar|blv|no\s*:?\s*\d|apt|apartman|sitesi|site|blok|daire\s*:?\s*\d|kat\s*:?\s*\d|köyü|köy|osb|sanayi|san\.|organize)/i;

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
  for (const x of IL_FOLD) if (words.includes(' ' + x.f + ' ')) { il = x; break; }
  if (il) {
    const ic = il.ilceler.filter(y => y.f !== 'merkez').find(y => words.includes(' ' + y.f + ' '));
    if (ic) ilce = ic.x;
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

export function splitMessages(text) {
  const lines = String(text || '').replace(/\r/g, '').split('\n');
  const hasHeaders = lines.filter(l => WA_HEADER.test(l)).length >= 1;
  let blocks = [];
  if (hasHeaders) {
    let cur = null;
    for (const l of lines) {
      if (WA_HEADER.test(l)) { if (cur) blocks.push(cur); cur = [l.replace(WA_HEADER, '')]; }
      else if (cur) cur.push(l); else cur = [l];
    }
    if (cur) blocks.push(cur);
    blocks = blocks.map(b => b.join('\n').trim()).filter(Boolean);
  } else {
    blocks = String(text || '').replace(/\r/g, '').split(/\n\s*\n+/).map(s => s.trim()).filter(Boolean);
  }
  // Telefon içermeyen blokları önceki siparişe ekle (devam mesajı); aynı telefonlu ardışık blokları birleştir.
  const out = [];
  for (const b of blocks) {
    const ph = (b.match(PHONE_RE) || [])[0];
    const prev = out[out.length - 1];
    if (!ph && prev) { prev.text += '\n' + b; prev.merged = true; continue; }
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

export function parseText(text, { sources = [], payments = [] } = {}) {
  const msgs = splitMessages(text);
  return msgs.map((m, idx) => parseOne(m, idx, sources, payments));
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
