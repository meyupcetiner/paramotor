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

const HEAD_RE = /^\s*\[?(\d{1,2})[./](\d{1,2})[./](\d{2,4}),?\s+\d{1,2}[:.]\d{2}(?::\d{2})?\]?\s*(?:-\s*)?(?:~\s*)?([^:\n]{1,40}):\s?/;
export const ITEM_RE = /^(\d{1,3})\s*[-–]\s*(\d.*)$/;
export const TOTAL_RE = /^(wp|wa|whatsapp|watsap|fb|face|facebook|ig|insta|instagram|ma[gğ]aza|dükkan|dukkan|web|site)\s*[:.]?\s*(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{1,2})?|\d{1,7})(?![\d.,])\s*(?:₺|tl|try)?\s*(.*)$/i;
const isOrderish = t => t.split('\n').some(l => ITEM_RE.test(l.trim()) || TOTAL_RE.test(l.trim()));

export function splitMessages(text) {
  const lines = String(text || '').replace(/\r/g, '').split('\n');
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
      const text = b.lines.join('\n').trim(); if (!text) continue;
      const prev = res[res.length - 1];
      // sipariş içermeyen kısa mesajlar (ör. "tamam", ek not) önceki siparişin devamıdır
      if (prev && !isOrderish(text) && !(text.match(PHONE_RE))) { prev.text += '\n' + text; prev.merged = true; continue; }
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

export function parseText(text, { sources = [], payments = [] } = {}) {
  const msgs = splitMessages(text);
  return msgs.map((m, idx) => isOrderish(m.text) ? parseWA(m, idx, sources, payments) : parseOne(m, idx, sources, payments));
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
// Testeresan WhatsApp sevkiyat grubu biçimi:
// [2.11.2026 14:24:29] ~ Testere.com.tr: KAPIDA NAKİT ÖDEME
// Ad Soyad / Telefon / Adres (il-ilçe adresin içinde)
// 1-300x3.20x30 96z Kronberg Alüminyum 3800₺      ← adet-ölçü ürün [fiyat]
// Wp6750₺                                          ← kaynak kısaltması + toplam
// (M.cemal)                                        ← satış temsilcisi
// İsimsiz/telefonsuz sipariş = mağaza müşterisi.
const STATUS_RE = /(kap[ıi]da|havale|eft|iban|resm[iİ]|gayr[iİ]|ma[gğ]aza|teslim|ptt|kargo|yurt[iİ]ç[iİ]|aras|mng|s[uü]rat|elden|nakit|kredi|kart|[öo]deme|sat[ıi][şs])/i;
const SRC_MAP = [[/^(wp|wa|whatsapp|watsap)$/i, 'WhatsApp'], [/^(fb|face|facebook)$/i, 'Facebook'], [/^(ig|insta|instagram)$/i, 'Instagram'], [/^(ma[gğ]aza|dükkan|dukkan)$/i, 'Mağaza'], [/^(web|site)$/i, 'Web']];
const TAX_RE = /\(?\s*([^()]*?)\s*V\.?\s*D\.?\s*(?:tax\s*no|vergi\s*no|vkn|tckn|no)?\s*[:.]?\s*([\d\s]{10,14})\s*\)?/i;
const EMAIL_RE = /[\w.+-]+@[\w-]+\.[\w.]+/;
const COMPANY_RE = /\b(ltd|şti|sti|a\.?ş\.?|ticaret|tic\.|san\.|sanayi|inşaat|insaat|limited|anonim|pazarlama|paz\.)/i;
const cap = s => s.replace(/(^|[\s.])(\p{L})/gu, (m, a, b) => a + b.toLocaleUpperCase('tr'));

function parseWA(m, idx, sources, payments) {
  const lines = m.text.split('\n').map(x => x.trim()).filter(Boolean);
  const o = { date: m.date || null, customer_name: '', phone: '', address: '', il: '', ilce: '', source: 'Belirsiz', payment: 'Belirsiz', order_total: null, note: '', items: [], uncertain_fields: [], is_official: false, tax_no: '', tax_office: '', official_title: '', email: '', delivery: '', rep: '', rep_note: '', anonymous: false, source_ref: `${m.date ? m.date.split('-').reverse().join('.') + ' · ' : ''}${idx + 1}. mesaj`, raw_text: m.text };
  const notes = [];
  const rest = [];
  lines.forEach((l, i) => {
    let mm;
    if ((mm = l.match(/^\((.+)\)$/))) { const parts = mm[1].trim().split(/\s+/); o.rep = parts[0]; o.rep_note = parts.slice(1).join(' '); return; }
    if ((mm = l.match(/^(\d[\d.,]*)\s*(?:₺|tl|try)\s*(.*)$/i)) && o.items.length) { o.order_total = parseMoney(mm[1]); if (mm[2] && mm[2].trim()) notes.push(mm[2].trim()); return; }
    if ((mm = l.match(TOTAL_RE))) {
      const src = SRC_MAP.find(([re]) => re.test(mm[1])); if (src) o.source = sources.includes(src[1]) ? src[1] : (src[1] === 'Web' ? 'Belirsiz' : 'Belirsiz');
      o.order_total = parseMoney(mm[2]); if (mm[3] && mm[3].trim()) notes.push(mm[3].trim());
      return;
    }
    if ((mm = l.match(ITEM_RE))) {
      let body = mm[2];
      const it = { raw_text: l, qty: parseInt(mm[1]), unit_price: null, line_total: null, uncertain: [] };
      const pm = body.match(/(\d[\d.,]*)\s*(?:₺|tl|try)\s*$/i);
      if (pm) { it.line_total = parseMoney(pm[1]); body = body.slice(0, pm.index).trim(); }
      if (/çıkma|cikma|ikinci el|2\.\s?el/i.test(body)) { it.second_hand = true; notes.push(`Çıkma (ikinci el) ürün: ${body}`); }
      const note = (body.match(/\(([^)]*)\)/g) || []).map(x => x.slice(1, -1)).filter(x => !/çıkma|cikma/i.test(x));
      if (note.length) it.note = note.join(', ');
      it.spec = body;
      o.items.push(it); return;
    }
    if (i === 0 && STATUS_RE.test(l) && !PHONE_RE.test(l.replace(/\s/g, '') ) && !/\d{3,}/.test(l)) {
      PHONE_RE.lastIndex = 0;
      o.payment = detectPayment(l, payments);
      if (/kap[ıi]da/i.test(l) && o.payment === 'Belirsiz') notes.push('Kapıda ödeme yazıyor; nakit/kart belirtilmemiş.');
      if (/resm[iİ]/i.test(l) && !/gayr/i.test(l)) o.is_official = true;
      const low = l.toLocaleLowerCase('tr');
      if (/^ma[gğ]aza(\s+sat[ıi][şs][ıi]?)?$/.test(low.trim()) && sources.includes('Mağaza')) o.source = 'Mağaza';
      const del = low.replace(/gayr[iı]resm[iı]|kap[ıi]da|nakit|kredi kart[ıi]?|kart|[öo]deme|resm[iı]|sat[ıi][şs][ıi]?/g, '').replace(/\s+/g, ' ').trim();
      if (del && !(o.source === 'Mağaza' && /^ma[gğ]aza$/.test(del))) o.delivery = cap(del);
      return;
    }
    PHONE_RE.lastIndex = 0;
    rest.push(l);
  });
  // kalan satırlar: isim, telefon, adres, vergi, e-posta
  const addr = [];
  for (let l of rest) {
    const em = l.match(EMAIL_RE); if (em) { o.email = em[0]; l = l.replace(em[0], '').trim(); if (!l) continue; }
    const tx = l.match(TAX_RE); if (tx) { o.tax_no = tx[2].replace(/\s/g, ''); o.tax_office = tx[1].trim().replace(/^\(/, ''); l = l.replace(tx[0], '').trim(); if (!l) continue; }
    const ph = l.match(PHONE_RE); PHONE_RE.lastIndex = 0;
    if (ph && !o.phone && l.replace(ph[0], '').replace(/[^\p{L}\d]/gu, '').length < 3) { o.phone = ph[0].trim(); continue; }
    if (ph && !o.phone) { o.phone = ph[0].trim(); l = l.replace(ph[0], '').trim(); }
    if (!o.customer_name && !o.phone && !/\d/.test(l) && !ADDRESS_WORDS.test(l)) { o.customer_name = l; continue; }
    if (!o.customer_name && !/\d/.test(l) && (COMPANY_RE.test(l) || !ADDRESS_WORDS.test(l)) && !addr.length) { o.customer_name = l; continue; }
    addr.push(l);
  }
  o.address = addr.join(' ').replace(/\s+/g, ' ').trim();
  if (o.customer_name && COMPANY_RE.test(o.customer_name)) o.official_title = o.customer_name;
  if (o.is_official && !o.official_title) o.official_title = o.customer_name;
  const loc = o.address ? findIlIlce(o.address) : { il: null, ilce: null };
  o.il = loc.il || ''; o.ilce = loc.ilce || '';
  o.anonymous = !o.customer_name && !o.phone;
  if (o.anonymous) { if (o.source === 'Belirsiz' && sources.includes('Mağaza')) o.source = 'Mağaza'; }
  else {
    if (!o.customer_name) o.uncertain_fields.push('customer_name');
    if (!o.phone) o.uncertain_fields.push('phone');
    if (!o.il) o.uncertain_fields.push('il');
    if (!o.ilce) o.uncertain_fields.push('ilce');
  }
  if (o.source === 'Belirsiz') o.uncertain_fields.push('source');
  if (o.payment === 'Belirsiz' && !o.is_official && !o.anonymous) o.uncertain_fields.push('payment');
  if (!o.items.length) o.uncertain_fields.push('items');
  if (!o.date) o.uncertain_fields.push('date');
  // fiyatlar: tek ürün + toplam → satır toplamı; çok ürün → satır fiyatları, toplamla karşılaştır
  const priced = o.items.filter(it => it.line_total != null);
  if (o.items.length === 1 && o.items[0].line_total == null && o.order_total != null) o.items[0].line_total = o.order_total;
  else if (o.items.length > 1 && o.order_total != null) {
    const missing = o.items.filter(it => it.line_total == null);
    const sum = priced.reduce((a, it) => a + it.line_total, 0);
    if (missing.length === 1) missing[0].line_total = Math.max(0, o.order_total - sum);
    else if (missing.length > 1) missing.forEach(it => it.uncertain.push('price'));
    else if (Math.abs(sum - o.order_total) > 1) notes.push(`Satır fiyatları toplamı (${sum}) mesajdaki toplamdan (${o.order_total}) farklı.`);
  }
  for (const it of o.items) { if (it.line_total != null && it.qty) it.unit_price = +(it.line_total / it.qty).toFixed(4); if (it.line_total == null) it.uncertain.push('price'); }
  for (const it of o.items) if (it.note) notes.push(`${it.spec.replace(/\s*\([^)]*\)/g, '')}: ${it.note}`);
  if (o.delivery) notes.unshift(o.delivery);
  if (o.email) notes.push('E-posta: ' + o.email);
  if (o.rep_note) notes.push(`Temsilci notu: ${o.rep_note}`);
  o.note = [...new Set(notes)].join(' · ');
  return o;
}
