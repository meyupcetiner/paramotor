// PARAMOTOR — Cloudflare Worker (API + statik dosyalar). Veri: D1 (binding: DB). Görseller (opsiyonel): R2 (binding: UPLOADS).
import { SCHEMA } from './schema.js';
import { expandCatalog, CATEGORIES } from './catalog.js';
import { matchItem, fold } from './match.js';
import { shortName } from '../public/short.js';
import { parseText, normalizePhone, canonIlIlce } from './parser.js';
import { extractWithClaude } from './claude.js';

const BRANDS = [
  { id: 'testere-com-tr', name: 'testere.com.tr', color: '#33884f', logo: '/img/testere-com-tr.png', invoice_prefix: 'TCT', sort: 1 },
  { id: 'testere-ustasi', name: 'Testere Ustası', color: '#2f5d3a', logo: '/img/testere-ustasi.jpg', invoice_prefix: 'TU', sort: 2 },
  { id: 'testere-fabrikasi', name: 'Testere Fabrikası', color: '#1b355b', logo: '/img/testere-fabrikasi.png', invoice_prefix: 'TF', sort: 3 }
];
const SOURCES = [['Instagram', '#e1306c'], ['Facebook', '#1877f2'], ['WhatsApp', '#25d366'], ['Mağaza', '#3b5bdb']];
const PAYMENTS = [['Havale', '#7c5cff'], ['Kapıda Nakit', '#f59f00'], ['Kapıda Kredi Kartı', '#e8590c'], ['Nakit', '#2f9e44'], ['Kredi Kartı', '#1c7ed6'], ['Kapıda Kontrollü', '#ffcc00']];
const REPS = [['M.Cemal', 'M.cemal, Cemal İnce, Cemal', '#5fff00'], ['M.Doğan', 'Doğan, Dogan, DOGAN, dogan, M.doğan, M.dogan', '#3019e5'], ['M.Arslan', 'M.arslan, Mustafa ARSLAN, Mustafa Arslan', '#f08c00']];
export const DEFAULT_SETTINGS = {
  default_vat: 0,
  prices_incl_vat_default: false,
  claude_model: 'claude-sonnet-5-5',
  auto_engine: 'claude',
  expense_allocation: 'ciro',
  expense_manual_shares: { 'testere-com-tr': 34, 'testere-ustasi': 33, 'testere-fabrikasi': 33 },
  expense_categories: ['Reklam (Meta)', 'Kargo', 'Ambalaj', 'Malzeme / Alış', 'Personel', 'Kira', 'Komisyon', 'Vergi / Harç', 'Diğer'],
  band_roll_m: 100,
  segment_rules: { new_days: 30, loyal_min_orders: 3, loyal_max_days: 120, risk_days: 180, risk_gap_mult: 2.5, pot_gap_min: 0.7, pot_gap_max: 2, pot_single_min_days: 21, pot_single_max_days: 120, pot_single_min_spend: 1500 }
};

let READY = false;
const enc = new TextEncoder();
const nowISO = () => new Date().toISOString();
const hashtags = t => (String(t || '').match(/#[\p{L}\d_]+/gu) || []).map(x => fold(x.slice(1)));
const r2 = n => Math.round((Number(n) || 0) * 100) / 100;
const json = (data, status = 200, headers = {}) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers } });
const err = (msg, status = 400) => json({ error: msg }, status);
const esc = v => v === null || v === undefined || v === '' ? 'NULL' : (typeof v === 'number' ? String(v) : `'${String(v).replace(/'/g, "''")}'`);

async function all(env, sql, ...p) { return (await env.DB.prepare(sql).bind(...p).all()).results || []; }
async function first(env, sql, ...p) { return await env.DB.prepare(sql).bind(...p).first(); }
async function run(env, sql, ...p) { return await env.DB.prepare(sql).bind(...p).run(); }

async function ensureDB(env) {
  if (READY) return;
  const t = await first(env, "SELECT name FROM sqlite_master WHERE type='table' AND name='invoices'");
  if (!t) await env.DB.exec(SCHEMA);
  await env.DB.exec("CREATE TABLE IF NOT EXISTS sales_reps (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, aliases TEXT, color TEXT, sort INTEGER DEFAULT 0, active INTEGER DEFAULT 1);");
  const cols = await all(env, "PRAGMA table_info(invoices)");
  if (!cols.some(c => c.name === 'rep_id')) await env.DB.exec('ALTER TABLE invoices ADD COLUMN rep_id INTEGER;');
  if (!cols.some(c => c.name === 'is_promo')) await env.DB.exec('ALTER TABLE invoices ADD COLUMN is_promo INTEGER DEFAULT 0;');
  // v2 göçü: KDV'siz varsayılan, yeni ödeme yöntemleri, temsilciler, hizmet ürünleri
  const mg = await first(env, "SELECT value FROM settings WHERE key='migr_v2'");
  if (!mg && await first(env, "SELECT COUNT(*) c FROM brands").then(r => r && r.c)) {
    const pays = await all(env, 'SELECT name FROM payment_methods');
    for (const [n, c] of PAYMENTS) if (!pays.some(x => x.name === n)) await run(env, 'INSERT INTO payment_methods (name,color,sort) VALUES (?,?,?)', n, c, 9);
    const rc = await first(env, 'SELECT COUNT(*) c FROM sales_reps');
    if (!rc || !rc.c) for (const [i, [n, a, c]] of REPS.entries()) await run(env, 'INSERT INTO sales_reps (name,aliases,color,sort) VALUES (?,?,?,?)', n, a, c, i);
    await run(env, "INSERT INTO settings (key,value) VALUES ('default_vat','0') ON CONFLICT(key) DO UPDATE SET value='0'");
    await run(env, "INSERT INTO settings (key,value) VALUES ('prices_incl_vat_default','false') ON CONFLICT(key) DO UPDATE SET value='false'");
    const ex = await first(env, "SELECT COUNT(*) c FROM products WHERE category='Hizmetler'");
    if (!ex.c) for (const p of expandCatalog().filter(p => p.category === 'Hizmetler')) { const r = await run(env, "INSERT INTO products (name,mfr,category,subcategory,unit,description,is_band,created_at) VALUES (?,?,?,?,'Adet',?,0,?)", p.name, p.mfr, p.category, p.subcategory, p.description, nowISO()); await run(env, "INSERT INTO variants (product_id,label,sort) VALUES (?,'Standart',0)", r.meta.last_row_id); }
    await run(env, "INSERT INTO settings (key,value) VALUES ('migr_v2','1') ON CONFLICT(key) DO NOTHING");
  }
  const b = await first(env, 'SELECT COUNT(*) c FROM brands');
  if (!b || !b.c) await seed(env);
  // v3 göçü: hizmetler iki başlıkta toplanır (Bileme Hizmeti, Kaynak Hizmeti)
  if (!(await first(env, "SELECT value FROM settings WHERE key='migr_v3'"))) {
    const svc = await all(env, "SELECT id,name,subcategory FROM products WHERE category='Hizmetler' ORDER BY id");
    const ensure = async (name, sub, desc, pref) => {
      let p = svc.find(x => x.name === name) || svc.find(x => pref.includes(x.name));
      if (p) await run(env, "UPDATE products SET name=?, subcategory=?, description=?, active=1 WHERE id=?", name, sub, desc, p.id);
      else { const r = await run(env, "INSERT INTO products (name,mfr,category,subcategory,unit,description,is_band,created_at) VALUES (?,'Testeresan','Hizmetler',?,'Adet',?,0,?)", name, sub, desc, nowISO()); p = { id: r.meta.last_row_id }; await run(env, "INSERT INTO variants (product_id,label,sort) VALUES (?,'Standart',0)", p.id); }
      return p.id;
    };
    const bil = await ensure('Bileme Hizmeti', 'Bileme', 'Freze, daire, Dry Cut / TCT bileme, diş açma, tamir.', ['HSS Freze Bileme', 'Dry Cut / TCT Testere Bileme']);
    const kay = await ensure('Kaynak Hizmeti', 'Kaynak', 'Şerit kesim ve kaynak, kopan şerit kaynağı.', ['Şerit Kaynak']);
    for (const x of svc) if (x.id !== bil && x.id !== kay) await run(env, 'UPDATE products SET active=0 WHERE id=?', x.id);
    await run(env, "INSERT INTO settings (key,value) VALUES ('migr_v3','1') ON CONFLICT(key) DO NOTHING");
  }
  if (!(await first(env, "SELECT id FROM products WHERE name='Çıkma Testere'"))) { // v4: çıkma testere ürünü
    const r = await run(env, "INSERT INTO products (name,mfr,category,subcategory,unit,description,is_band,created_at) VALUES ('Çıkma Testere','Testeresan','Diğer Ürünler','Çıkma','Adet','İkinci el (çıkma) testere. Ölçü/tür satır açıklamasına yazılır.',0,?)", nowISO());
    await run(env, "INSERT INTO variants (product_id,label,sort) VALUES (?,'Standart',0)", r.meta.last_row_id);
  }
  if (!(await first(env, "SELECT value FROM settings WHERE key='migr_v5'"))) {
    // resmi satış = fiyatlar KDV dahil, sabit %20: KDV'si ayrılmamış resmi satışlarda tutar aynı kalır, KDV içinden ayrılır
    const offs = await all(env, "SELECT id FROM invoices WHERE is_official=1 AND IFNULL(vat_total,0)=0 AND IFNULL(auto_batch_id,0) NOT IN (SELECT id FROM auto_batches WHERE engine='import')"); // Paraşüt'ten gelenlere dokunulmaz
    for (let i = 0; i < offs.length; i += 50) {
      const ids = offs.slice(i, i + 50).map(x => x.id); const ph = ids.map(() => '?').join(',');
      await env.DB.batch([
        env.DB.prepare(`UPDATE invoice_lines SET vat_rate=20, line_vat=ROUND(line_net - line_net/1.2, 2), line_net=ROUND(line_net/1.2, 2), unit_price=ROUND(unit_price/1.2, 4) WHERE invoice_id IN (${ph}) AND IFNULL(line_vat,0)=0`).bind(...ids),
        env.DB.prepare(`UPDATE invoices SET prices_incl_vat=1, subtotal=(SELECT ROUND(SUM(line_net),2) FROM invoice_lines WHERE invoice_id=invoices.id), vat_total=(SELECT ROUND(SUM(line_vat),2) FROM invoice_lines WHERE invoice_id=invoices.id) WHERE id IN (${ph})`).bind(...ids)
      ]);
    }
    // eşleşmiş ürün satırlarında uzun adı kısa ada çevir ("Kronberg Metal Dry Cut — Ø305 × 2,2 × 25,4 · Z80" → "Kronberg Drycut 305x80")
    const ls = await all(env, "SELECT l.id, l.description, p.name, p.mfr, p.category, p.subcategory, p.is_band, v.label, v.diameter, v.thickness, v.teeth, v.width, v.tpi, v.length FROM invoice_lines l JOIN products p ON p.id=l.product_id LEFT JOIN variants v ON v.id=l.variant_id");
    const ups = [];
    for (const l of ls) {
      const long = l.label && l.label !== 'Standart' ? `${l.name} — ${l.label}` : l.name;
      if (l.description !== long) continue;
      const sn = shortName(l, l, { withTpi: true }); if (sn && sn !== l.description) ups.push(env.DB.prepare('UPDATE invoice_lines SET description=? WHERE id=?').bind(sn, l.id));
    }
    for (let i = 0; i < ups.length; i += 100) await env.DB.batch(ups.slice(i, i + 100));
    const ck = await all(env, "SELECT id, invoice_id, description FROM invoice_lines WHERE description LIKE 'Çıkma Testere — %'");
    for (const l of ck) { const sp = l.description.replace(/^Çıkma Testere — /, '').replace(/testere/ig, ' ').replace(/\s+/g, ' ').trim(); await run(env, "UPDATE invoice_lines SET description='Çıkma Testere' WHERE id=?", l.id); if (sp) await run(env, "UPDATE invoices SET note = TRIM(? || CASE WHEN COALESCE(note,'')='' THEN '' ELSE ' · ' || note END) WHERE id=?", 'Çıkma: ' + sp, l.invoice_id); }
    await run(env, "INSERT INTO settings (key,value) VALUES ('migr_v5','1') ON CONFLICT(key) DO NOTHING");
  }
  if (!(await first(env, "SELECT value FROM settings WHERE key='migr_v6'"))) { // v6: eksik ürün aileleri (oluklu, kurt diş)
    for (const p of expandCatalog().filter(p => ['Kronberg Oluklu', 'Onci Oluklu', 'Onci Kurt Diş'].includes(p.name))) {
      let row = await first(env, 'SELECT id FROM products WHERE name=?', p.name);
      if (!row) row = { id: (await run(env, "INSERT INTO products (name,mfr,category,subcategory,unit,description,is_band,created_at) VALUES (?,?,?,?,'Adet',?,0,?)", p.name, p.mfr, p.category, p.subcategory, p.description, nowISO())).meta.last_row_id };
      const have = await all(env, 'SELECT diameter, teeth FROM variants WHERE product_id=?', row.id);
      let k = have.length;
      for (const v of p.variants) if (!have.some(h => Number(h.diameter) === v.diameter && Number(h.teeth) === v.teeth)) await run(env, 'INSERT INTO variants (product_id,label,diameter,thickness,bore,teeth,sort) VALUES (?,?,?,?,?,?,?)', row.id, v.label, v.diameter, v.thickness, v.bore, v.teeth, k++);
    }
    const cat = await catalog(env);
    await run(env, "UPDATE invoice_lines SET product_id=NULL, variant_id=NULL WHERE (description LIKE '%olden%' OR description LIKE '%OLDEN%') AND product_id IN (SELECT id FROM products WHERE name NOT LIKE '%olden%')"); // Golden Line ayrı ürün
    const un = await all(env, "SELECT id, description FROM invoice_lines WHERE (product_id IS NULL OR description LIKE '%luklu%' OR description LIKE '%LUKLU%') AND (description LIKE '%luklu%' OR description LIKE '%LUKLU%' OR description LIKE '%urt%' OR description LIKE '%URT%') AND description NOT LIKE '%olden%' AND description NOT LIKE '%OLDEN%'");
    for (const l of un) { const mt = matchItem({ raw_text: l.description }, cat); if (mt.confidence !== 'low' && mt.variant_id) await run(env, 'UPDATE invoice_lines SET product_id=?, variant_id=? WHERE id=?', mt.product_id, mt.variant_id, l.id); }
    await run(env, "INSERT INTO settings (key,value) VALUES ('migr_v6','1') ON CONFLICT(key) DO NOTHING");
  }
  { const pays = await all(env, 'SELECT name FROM payment_methods'); let k = pays.length; for (const [n, c] of PAYMENTS) if (!pays.some(x => x.name === n)) await run(env, 'INSERT INTO payment_methods (name,color,sort) VALUES (?,?,?)', n, c, k++); }
  await normalizeServices(env);
  READY = true;
}

// Hizmet satırlarını iki başlığa toplar: kaynak içerenler Kaynak Hizmeti, diğer bileme/diş açma/tamir Bileme Hizmeti (eski ve yeni kayıtlar)
async function normalizeServices(env) {
  const bil = await first(env, "SELECT p.id, (SELECT v.id FROM variants v WHERE v.product_id=p.id ORDER BY v.id LIMIT 1) vid FROM products p WHERE name='Bileme Hizmeti' AND category='Hizmetler'");
  const kay = await first(env, "SELECT p.id, (SELECT v.id FROM variants v WHERE v.product_id=p.id ORDER BY v.id LIMIT 1) vid FROM products p WHERE name='Kaynak Hizmeti' AND category='Hizmetler'");
  if (!bil || !kay) return;
  const like = ws => ws.flatMap(w => [w, w.replace(/i/g, 'İ').toUpperCase(), w[0].toUpperCase() + w.slice(1)]).map(w => `description LIKE '%${w.replace(/'/g, "''")}%'`).join(' OR ');
  const K = like(['kaynak', 'kaynat']), B = like(['bileme', 'bilet', 'diş aç', 'dis ac', 'tamir', 'torna']);
  const others = `SELECT id FROM products WHERE category='Hizmetler' AND id NOT IN (${bil.id},${kay.id})`;
  await env.DB.batch([
    env.DB.prepare(`UPDATE invoice_lines SET product_id=?, variant_id=? WHERE (product_id IS NULL OR product_id IN (${others}) OR product_id=?) AND (${K})`).bind(kay.id, kay.vid, bil.id),
    env.DB.prepare(`UPDATE invoice_lines SET product_id=?, variant_id=? WHERE (product_id IS NULL AND (${B})) OR product_id IN (${others})`).bind(bil.id, bil.vid)
  ]);
  for (const [pid, tag] of [[bil.id, '#bileme'], [kay.id, '#kaynak']])
    await run(env, `UPDATE invoices SET note = TRIM(COALESCE(note,'') || ' ' || ?) WHERE id IN (SELECT invoice_id FROM invoice_lines WHERE product_id=?) AND COALESCE(note,'') NOT LIKE ?`, tag, pid, '%' + tag + '%');
}

async function seed(env) {
  const lines = [];
  for (const b of BRANDS) lines.push(`INSERT OR IGNORE INTO brands (id,name,color,logo,invoice_prefix,sort) VALUES (${esc(b.id)},${esc(b.name)},${esc(b.color)},${esc(b.logo)},${esc(b.invoice_prefix)},${b.sort});`);
  SOURCES.forEach(([n, c], i) => lines.push(`INSERT INTO sources (name,color,sort) VALUES (${esc(n)},${esc(c)},${i});`));
  PAYMENTS.forEach(([n, c], i) => lines.push(`INSERT INTO payment_methods (name,color,sort) VALUES (${esc(n)},${esc(c)},${i});`));
  REPS.forEach(([n, al, c], i) => lines.push(`INSERT INTO sales_reps (name,aliases,color,sort) VALUES (${esc(n)},${esc(al)},${esc(c)},${i});`));
  lines.push("INSERT OR IGNORE INTO settings (key,value) VALUES ('migr_v2','1');");
  const now = nowISO();
  for (const p of expandCatalog()) {
    lines.push(`INSERT INTO products (id,name,mfr,category,subcategory,unit,description,is_band,band_type,created_at) VALUES (${p.key},${esc(p.name)},${esc(p.mfr)},${esc(p.category)},${esc(p.subcategory)},'Adet',${esc(p.description)},${p.is_band},${esc(p.band_type)},${esc(now)});`);
    p.variants.forEach((v, i) => lines.push(`INSERT INTO variants (product_id,label,diameter,thickness,bore,teeth,width,tpi,length,sort) VALUES (${p.key},${esc(v.label)},${esc(v.diameter)},${esc(v.thickness)},${esc(v.bore)},${esc(v.teeth)},${esc(v.width)},${esc(v.tpi)},${esc(v.length)},${i});`));
  }
  for (const [k, v] of Object.entries(DEFAULT_SETTINGS)) lines.push(`INSERT OR IGNORE INTO settings (key,value) VALUES (${esc(k)},${esc(JSON.stringify(v))});`);
  await env.DB.exec(lines.join('\n'));
}

async function getSettings(env) {
  const rows = await all(env, 'SELECT key,value FROM settings');
  const s = { ...DEFAULT_SETTINGS };
  for (const r of rows) { try { s[r.key] = JSON.parse(r.value); } catch { s[r.key] = r.value; } }
  return s;
}
async function setSetting(env, k, v) { await run(env, 'INSERT INTO settings (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value', k, JSON.stringify(v)); }

// ---------------- Kimlik doğrulama ----------------
function b64(buf) { let s = ''; const a = new Uint8Array(buf); for (const x of a) s += String.fromCharCode(x); return btoa(s); }
async function hashPw(pw, saltB64) {
  const salt = saltB64 ? Uint8Array.from(atob(saltB64), c => c.charCodeAt(0)) : crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey('raw', enc.encode(pw), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: 100000 }, key, 256);
  return { salt: b64(salt), hash: b64(bits) };
}
function getCookie(req, name) { const m = (req.headers.get('cookie') || '').match(new RegExp('(?:^|; )' + name + '=([^;]+)')); return m ? m[1] : null; }
async function authed(env, req) {
  const tok = getCookie(req, 'pm_s'); if (!tok) return false;
  const s = await first(env, 'SELECT expires_at FROM sessions WHERE token=?', tok);
  return !!(s && s.expires_at > Date.now());
}
function sessionCookie(req, tok, maxAge) {
  const secure = new URL(req.url).protocol === 'https:' ? '; Secure' : '';
  return `pm_s=${tok}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${secure}`;
}
async function newSession(env, req) {
  const tok = b64(crypto.getRandomValues(new Uint8Array(32))).replace(/[+/=]/g, c => ({ '+': '-', '/': '_', '=': '' })[c]);
  const days = 30;
  await run(env, 'INSERT INTO sessions (token,expires_at) VALUES (?,?)', tok, Date.now() + days * 864e5);
  await run(env, 'DELETE FROM sessions WHERE expires_at < ?', Date.now());
  return sessionCookie(req, tok, days * 86400);
}

// ---------------- Yardımcılar ----------------
async function catalog(env) {
  const prods = await all(env, 'SELECT * FROM products WHERE active=1');
  const pm = new Map(prods.map(p => [p.id, p]));
  const vars = await all(env, 'SELECT * FROM variants WHERE active=1 ORDER BY product_id, sort, id');
  return vars.filter(v => pm.has(v.product_id)).map(v => ({ ...v, p: pm.get(v.product_id) }));
}
const lookups = async env => ({
  reps: await all(env, 'SELECT * FROM sales_reps ORDER BY sort,id'),
  sources: await all(env, 'SELECT * FROM sources ORDER BY sort,id'),
  payments: await all(env, 'SELECT * FROM payment_methods ORDER BY sort,id'),
  brands: await all(env, 'SELECT * FROM brands ORDER BY sort')
});

async function upsertCustomer(env, brand, c) {
  const np = normalizePhone(c.phone);
  const phone = np.ok ? np.phone : (c.phone || '').trim() || null;
  let row = null;
  if (c.customer_id) row = await first(env, 'SELECT * FROM customers WHERE id=? AND brand_id=?', c.customer_id, brand);
  if (!row && phone) row = await first(env, 'SELECT * FROM customers WHERE brand_id=? AND phone=?', brand, phone);
  const f = { name: c.name || null, phone, address: c.address || null, il: c.il || null, ilce: c.ilce || null };
  if (!row && !f.name && !f.phone) return null; // isimsiz mağaza müşterisi: müşteri kaydı açılmaz
  if (row) {
    await run(env, `UPDATE customers SET name=COALESCE(?,name), phone=COALESCE(?,phone), address=COALESCE(?,address), il=COALESCE(?,il), ilce=COALESCE(?,ilce),
      is_official=CASE WHEN ? THEN 1 ELSE is_official END, tax_no=COALESCE(?,tax_no), official_title=COALESCE(?,official_title), tax_office=COALESCE(?,tax_office), person_type=COALESCE(?,person_type) WHERE id=?`,
      f.name, f.phone, f.address, f.il, f.ilce, c.is_official ? 1 : 0, c.tax_no || null, c.official_title || null, c.tax_office || null, c.person_type || null, row.id);
    return row.id;
  }
  const r = await run(env, 'INSERT INTO customers (brand_id,name,phone,address,il,ilce,is_official,tax_no,official_title,tax_office,person_type,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',
    brand, f.name, f.phone, f.address, f.il, f.ilce, c.is_official ? 1 : 0, c.tax_no || null, c.official_title || null, c.tax_office || null, c.person_type || null, nowISO());
  return r.meta.last_row_id;
}

function computeLines(lines, inclVat, defVat) {
  let sub = 0, vat = 0;
  const out = (lines || []).filter(l => l && (l.description || l.variant_id || l.product_id)).map((l, i) => {
    const qty = Number(l.qty) || 0;
    const rate = l.vat_rate === undefined || l.vat_rate === null || l.vat_rate === '' ? defVat : Number(l.vat_rate);
    let price = Number(l.unit_price) || 0;
    if (inclVat) price = price / (1 + rate / 100);
    const net = qty * price, v = net * rate / 100;
    sub += net; vat += v;
    const len = l.band_length_mm ? Number(l.band_length_mm) : null;
    return { sort: i, product_id: l.product_id || null, variant_id: l.variant_id || null, description: l.description || '', qty, unit: l.unit || 'Adet', unit_price: price, vat_rate: rate, band_length_mm: len, band_meters: len ? r2(len * qty / 1000) : null, line_net: r2(net), line_vat: r2(v) };
  });
  return { lines: out, subtotal: r2(sub), vat_total: r2(vat), total: r2(sub + vat) };
}

async function saveInvoice(env, brand, body, id = null, settings = null) {
  settings = settings || await getSettings(env);
  if (!body.date) throw new Error('Düzenleme tarihi gerekli.');
  const cust = { ...(body.customer || {}) };
  Object.assign(cust, canonIlIlce(cust.il, cust.ilce));
  const custId = await upsertCustomer(env, brand, { ...cust, is_official: body.is_official, tax_no: body.tax_no, official_title: body.official_title, tax_office: body.tax_office, person_type: body.person_type });
  const np = normalizePhone(cust.phone);
  const calc = computeLines(body.lines, !!body.prices_incl_vat, Number(settings.default_vat));
  const off = body.is_official ? 1 : 0;
  const common = [body.title || cust.name || null, custId, body.date, body.source_id || null, body.payment_id || null, body.rep_id || null, off,
    cust.name || null, np.ok ? np.phone : (cust.phone || null), cust.address || null, cust.il || null, cust.ilce || null,
    off ? body.tax_no || null : null, off ? body.official_title || null : null, off ? body.tax_office || null : null, off ? body.person_type || null : null,
    body.order_info || null, body.note || null, body.prices_incl_vat ? 1 : 0, calc.subtotal, calc.vat_total, calc.total];
  if (id) {
    await run(env, `UPDATE invoices SET title=?,customer_id=?,date=?,source_id=?,payment_id=?,rep_id=?,is_official=?,cust_name=?,cust_phone=?,cust_address=?,cust_il=?,cust_ilce=?,tax_no=?,official_title=?,tax_office=?,person_type=?,order_info=?,note=?,prices_incl_vat=?,subtotal=?,vat_total=?,total=?,updated_at=?${body.invoice_no ? ',invoice_no=?' : ''} WHERE id=? AND brand_id=?`,
      ...common, nowISO(), ...(body.invoice_no ? [body.invoice_no] : []), id, brand);
    await run(env, 'DELETE FROM invoice_lines WHERE invoice_id=?', id);
  } else {
    const mx = await first(env, 'SELECT COALESCE(MAX(seq),0) m FROM invoices WHERE brand_id=?', brand);
    const seq = (mx ? mx.m : 0) + 1;
    const b = await first(env, 'SELECT invoice_prefix FROM brands WHERE id=?', brand);
    const no = body.invoice_no || `${(b && b.invoice_prefix) || 'PM'}-${String(body.date).slice(0, 4)}-${String(seq).padStart(4, '0')}`;
    const r = await run(env, `INSERT INTO invoices (brand_id,seq,invoice_no,title,customer_id,date,source_id,payment_id,rep_id,is_official,cust_name,cust_phone,cust_address,cust_il,cust_ilce,tax_no,official_title,tax_office,person_type,order_info,note,prices_incl_vat,subtotal,vat_total,total,auto_batch_id,created_at,updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, brand, seq, no, ...common, body.auto_batch_id || null, nowISO(), nowISO());
    id = r.meta.last_row_id;
  }
  await run(env, 'UPDATE invoices SET is_promo=? WHERE id=?', /#(reklam|bedelsiz|numune|hediye)/i.test(body.note || '') ? 1 : 0, id);
  const stmts = calc.lines.map(l => env.DB.prepare('INSERT INTO invoice_lines (invoice_id,sort,product_id,variant_id,description,qty,unit,unit_price,vat_rate,band_length_mm,band_meters,line_net,line_vat) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)')
    .bind(id, l.sort, l.product_id, l.variant_id, l.description, l.qty, l.unit, l.unit_price, l.vat_rate, l.band_length_mm, l.band_meters, l.line_net, l.line_vat));
  if (stmts.length) await env.DB.batch(stmts);
  return id;
}

function brandFilter(brand) { return brand && brand !== 'all' ? [brand] : BRANDS.map(b => b.id); }

// Satış verisini (fatura + satır + ürün) belleğe alır; raporlar JS'de hesaplanır.
async function loadSales(env, brands, from, to) {
  const ph = brands.map(() => '?').join(',');
  const invs = await all(env, `SELECT * FROM invoices WHERE brand_id IN (${ph}) AND date>=? AND date<=? ORDER BY date, id`, ...brands, from || '0000-01-01', to || '9999-12-31');
  if (!invs.length) return [];
  const ids = invs.map(i => i.id);
  const lines = [];
  for (let i = 0; i < ids.length; i += 90) {
    const chunk = ids.slice(i, i + 90);
    lines.push(...await all(env, `SELECT l.*, p.name pname, p.category, p.subcategory, p.mfr, p.is_band, v.label vlabel, v.width vwidth, v.thickness vthick, v.diameter vdia, v.teeth vteeth, v.tpi vtpi FROM invoice_lines l LEFT JOIN products p ON p.id=l.product_id LEFT JOIN variants v ON v.id=l.variant_id WHERE l.invoice_id IN (${chunk.map(() => '?').join(',')})`, ...chunk));
  }
  const by = new Map(invs.map(i => [i.id, { ...i, lines: [] }]));
  for (const l of lines) by.get(l.invoice_id)?.lines.push(l);
  return [...by.values()];
}

// ---------------- Müşteri agregaları ve segmentler ----------------
const DAY = 864e5;
function daysBetween(a, b) { return Math.round((new Date(b) - new Date(a)) / DAY); }
function segmentOf(c, R, today) {
  const since = daysBetween(c.last_order, today);
  const first = daysBetween(c.first_order, today);
  const gap = c.avg_gap;
  if (!c.order_count) return 'Sipariş yok';
  if (c.order_count === 1 && first <= R.new_days) return 'Yeni';
  if (since > Math.max(R.risk_days, gap ? gap * R.risk_gap_mult : 0)) return 'Riskli / Uykuda';
  if (c.order_count >= R.loyal_min_orders && since <= R.loyal_max_days) return 'Sadık';
  if (c.order_count >= 2 && gap && since >= gap * R.pot_gap_min && since <= gap * R.pot_gap_max) return 'Tekrar Potansiyeli Yüksek';
  if (c.order_count === 1 && since >= R.pot_single_min_days && since <= R.pot_single_max_days && c.total >= R.pot_single_min_spend) return 'Tekrar Potansiyeli Yüksek';
  if (c.order_count === 1) return 'Tek Seferlik';
  return 'Aktif';
}
export const SEGMENT_HELP = R => ({
  'Yeni': `Tek siparişi var ve ilk siparişi son ${R.new_days} gün içinde.`,
  'Riskli / Uykuda': `Son siparişinin üzerinden ${R.risk_days} günden fazla (veya ortalama sipariş aralığının ${R.risk_gap_mult} katından fazla) zaman geçmiş.`,
  'Sadık': `En az ${R.loyal_min_orders} siparişi var ve son siparişi son ${R.loyal_max_days} gün içinde.`,
  'Tekrar Potansiyeli Yüksek': `2+ siparişli ve son siparişten bu yana geçen süre ortalama sipariş aralığının ${R.pot_gap_min}–${R.pot_gap_max} katı (yeni sipariş zamanı gelmiş) VEYA tek siparişli, ${R.pot_single_min_days}–${R.pot_single_max_days} gün önce en az ${R.pot_single_min_spend} TL harcamış.`,
  'Tek Seferlik': 'Tek siparişi var ve yukarıdaki gruplara girmiyor.',
  'Aktif': '2+ siparişli, yukarıdaki gruplara girmeyen müşteri.'
});

async function customerAggregates(env, brand, settings) {
  const custs = await all(env, 'SELECT * FROM customers WHERE brand_id=?', brand);
  const all0 = await loadSales(env, [brand]); const sales = all0;
  const R = { ...DEFAULT_SETTINGS.segment_rules, ...(settings.segment_rules || {}) };
  const today = new Date().toISOString().slice(0, 10);
  const map = new Map(custs.map(c => [c.id, { ...c, order_count: 0, total: 0, net: 0, first_order: null, last_order: null, dates: [], sources: {}, payments: {}, products: {}, categories: {} }]));
  for (const inv of sales) {
    const c = map.get(inv.customer_id); if (!c) continue;
    c.order_count++; c.total += inv.total; c.net += inv.subtotal; c.dates.push(inv.date);
    if (inv.source_id) c.sources[inv.source_id] = (c.sources[inv.source_id] || 0) + 1;
    if (inv.payment_id) c.payments[inv.payment_id] = (c.payments[inv.payment_id] || 0) + 1;
    for (const l of inv.lines) {
      if (l.product_id) c.products[l.product_id] = (c.products[l.product_id] || 0) + (l.qty || 0);
      const cat = l.subcategory ? `${l.category} / ${l.subcategory}` : null;
      if (cat) c.categories[cat] = (c.categories[cat] || 0) + (l.line_net || 0);
    }
  }
  for (const inv of all0) { const c = map.get(inv.customer_id); if (!c) continue; c._tags ||= new Set(hashtags(c.note)); for (const t of hashtags(inv.note)) c._tags.add(t); }
  const top = o => { const e = Object.entries(o).sort((a, b) => b[1] - a[1])[0]; return e ? e[0] : null; };
  return [...map.values()].map(c => {
    c.tags = [...(c._tags || new Set(hashtags(c.note)))].filter(Boolean); delete c._tags;
    c.dates.sort();
    c.first_order = c.dates[0] || null; c.last_order = c.dates[c.dates.length - 1] || null;
    c.avg_gap = c.dates.length > 1 ? Math.round(daysBetween(c.first_order, c.last_order) / (c.dates.length - 1)) : null;
    c.avg_basket = c.order_count ? r2(c.total / c.order_count) : 0;
    c.total = r2(c.total); c.net = r2(c.net);
    c.days_since = c.last_order ? daysBetween(c.last_order, today) : null;
    c.segment = segmentOf(c, R, today);
    c.main_source = top(c.sources) ? Number(top(c.sources)) : null;
    c.main_payment = top(c.payments) ? Number(top(c.payments)) : null;
    c.top_category = top(c.categories);
    c.product_ids = Object.keys(c.products).map(Number);
    delete c.dates;
    return c;
  });
}

function filterCustomers(list, q) {
  const has = k => q.has(k) && q.get(k) !== '';
  const num = k => Number(q.get(k));
  const multi = k => (q.get(k) || '').split(',').filter(Boolean);
  return list.filter(c => {
    if (has('q') && /^#/.test(q.get('q').trim())) { const ts = q.get('q').trim().split(/\s+/).filter(x => x.startsWith('#')).map(x => fold(x.slice(1))); if (!ts.every(t => (c.tags || []).some(x => x.startsWith(t)))) return false; }
    else if (has('q')) { const s = fold(q.get('q')); const d = s.replace(/\D/g, ''); if (!fold(c.name).includes(s) && !(d.length >= 3 && String(c.phone || '').includes(d)) && !fold(c.official_title).includes(s)) return false; }
    if (has('il') && !multi('il').includes(c.il || '')) return false;
    if (has('ilce') && !multi('ilce').includes(c.ilce || '')) return false;
    if (has('min_total') && c.total < num('min_total')) return false;
    if (has('max_total') && c.total > num('max_total')) return false;
    if (has('threshold')) { const above = q.get('threshold_dir') !== 'below'; if (above ? c.total < num('threshold') : c.total >= num('threshold')) return false; }
    if (has('min_basket') && c.avg_basket < num('min_basket')) return false;
    if (has('orders')) { const o = multi('orders'); if (!o.some(x => x === '4+' ? c.order_count >= 4 : c.order_count === Number(x))) return false; }
    if (has('segment') && !multi('segment').includes(c.segment)) return false;
    if (has('source') && !multi('source').map(Number).some(s => c.sources[s])) return false;
    if (has('payment') && !multi('payment').map(Number).some(s => c.payments[s])) return false;
    if (has('product') && !multi('product').map(Number).some(p => c.products[p])) return false;
    if (has('category') && !Object.keys(c.categories).some(k => multi('category').some(x => k.startsWith(x)))) return false;
    if (has('first_from') && (!c.first_order || c.first_order < q.get('first_from'))) return false;
    if (has('first_to') && (!c.first_order || c.first_order > q.get('first_to'))) return false;
    if (has('last_from') && (!c.last_order || c.last_order < q.get('last_from'))) return false;
    if (has('last_to') && (!c.last_order || c.last_order > q.get('last_to'))) return false;
    if (has('official')) { if (q.get('official') === '1' && !c.is_official) return false; if (q.get('official') === '0' && c.is_official) return false; }
    return true;
  });
}

// ---------------- Raporlar ----------------
function salesReport(invs, { vat, brands, srcMap, payMap, repMap = {}, roll }) {
  const amt = i => vat === 'excl' ? i.subtotal : i.total;
  const lamt = l => vat === 'excl' ? l.line_net : (l.line_net + l.line_vat);
  const R = { total: 0, orders: invs.length, customers: 0, newCust: { orders: 0, total: 0 }, retCust: { orders: 0, total: 0 }, official: { orders: 0, total: 0 }, informal: { orders: 0, total: 0 }, bySource: {}, byPayment: {}, byRep: {}, anon: { orders: 0, total: 0 }, cross: {}, byIl: {}, byIlce: {}, byProduct: {}, byCategory: {}, bands: { meters: 0, pieces: 0, byType: {}, byWidth: {}, rolls: 0 }, daily: {}, weekday: [0, 0, 0, 0, 0, 0, 0], monthday: Array(31).fill(0), byBrand: {}, topCustomers: {} };
  const seenCust = new Map(); // customer -> ilk sipariş (bu dönemde) için global ilk siparişe ihtiyaç: firstOrderDate dışarıdan
  for (const i of invs) {
    const a = amt(i); R.total += a;
    const bucket = !i.customer_id ? R.anon : (i._isFirst ? R.newCust : R.retCust); bucket.orders++; bucket.total += a;
    if (i.customer_id) seenCust.set(i.customer_id, 1);
    const rp = repMap[i.rep_id] || 'Belirtilmemiş'; (R.byRep[rp] ||= { orders: 0, total: 0 }); R.byRep[rp].orders++; R.byRep[rp].total += a;
    const ob = i.is_official ? R.official : R.informal; ob.orders++; ob.total += a;
    const s = srcMap[i.source_id] || 'Belirsiz', p = payMap[i.payment_id] || 'Belirsiz';
    (R.bySource[s] ||= { orders: 0, total: 0 }); R.bySource[s].orders++; R.bySource[s].total += a;
    (R.byPayment[p] ||= { orders: 0, total: 0 }); R.byPayment[p].orders++; R.byPayment[p].total += a;
    (R.cross[s] ||= {}); (R.cross[s][p] ||= { orders: 0, total: 0 }); R.cross[s][p].orders++; R.cross[s][p].total += a;
    const il = i.cust_il || 'Belirtilmemiş'; (R.byIl[il] ||= { orders: 0, total: 0 }); R.byIl[il].orders++; R.byIl[il].total += a;
    if (i.cust_ilce) { const k = `${i.cust_ilce} / ${il}`; (R.byIlce[k] ||= { orders: 0, total: 0 }); R.byIlce[k].orders++; R.byIlce[k].total += a; }
    (R.byBrand[i.brand_id] ||= { orders: 0, total: 0 }); R.byBrand[i.brand_id].orders++; R.byBrand[i.brand_id].total += a;
    R.daily[i.date] = (R.daily[i.date] || 0) + a;
    const d = new Date(i.date + 'T12:00:00Z'); R.weekday[(d.getUTCDay() + 6) % 7] += a; R.monthday[d.getUTCDate() - 1] += a;
    const ck = i.customer_id || 0; if (ck) { (R.topCustomers[ck] ||= { name: i.cust_name, phone: i.cust_phone, orders: 0, total: 0, brand: i.brand_id }); R.topCustomers[ck].orders++; R.topCustomers[ck].total += a; R.topCustomers[ck].name = i.cust_name || R.topCustomers[ck].name; }
    for (const l of i.lines) {
      const la = lamt(l);
      const pk = l.product_id || ('d:' + (l.description || '?'));
      (R.byProduct[pk] ||= { name: l.pname || l.description || 'Tanımsız ürün', product_id: l.product_id, qty: 0, total: 0, orders: 0, meters: 0 });
      R.byProduct[pk].qty += l.qty || 0; R.byProduct[pk].total += la; R.byProduct[pk].orders++; R.byProduct[pk].meters += l.band_meters || 0;
      const cat = l.category ? `${l.category} / ${l.subcategory}` : 'Kategorisiz';
      (R.byCategory[cat] ||= { qty: 0, total: 0 }); R.byCategory[cat].qty += l.qty || 0; R.byCategory[cat].total += la;
      if (l.is_band) {
        R.bands.meters += l.band_meters || 0; R.bands.pieces += l.qty || 0;
        const t = l.subcategory || '?'; (R.bands.byType[t] ||= { meters: 0, pieces: 0, total: 0 }); R.bands.byType[t].meters += l.band_meters || 0; R.bands.byType[t].pieces += l.qty || 0; R.bands.byType[t].total += la;
        const w = l.vwidth ? `${l.vwidth} × ${String(l.vthick).replace('.', ',')} mm` : '?'; (R.bands.byWidth[w] ||= { meters: 0, pieces: 0 }); R.bands.byWidth[w].meters += l.band_meters || 0; R.bands.byWidth[w].pieces += l.qty || 0;
      }
    }
  }
  R.customers = seenCust.size;
  R.avgBasket = R.orders ? R.total / R.orders : 0;
  R.bands.rolls = roll ? R.bands.meters / roll : 0;
  R.repeatRate = R.customers ? (Object.values(R.topCustomers).filter(c => c.orders > 1).length / R.customers) : 0;
  R.topCustomers = Object.entries(R.topCustomers).map(([id, c]) => ({ id: Number(id), ...c })).sort((a, b) => b.total - a.total).slice(0, 15);
  return R;
}

function shiftPeriod(from, to) {
  const f = new Date(from + 'T00:00:00Z'), t = new Date(to + 'T00:00:00Z');
  const len = Math.round((t - f) / DAY) + 1;
  const pt = new Date(f - DAY), pf = new Date(pt - (len - 1) * DAY);
  return [pf.toISOString().slice(0, 10), pt.toISOString().slice(0, 10)];
}

async function markFirstOrders(env, invs, brands) {
  // Müşterinin tüm zamanlardaki ilk siparişini bul (yeni vs geri dönen ayrımı)
  const ph = brands.map(() => '?').join(',');
  const rows = await all(env, `SELECT customer_id, MIN(date || '#' || printf('%010d', id)) f FROM invoices WHERE brand_id IN (${ph}) AND customer_id IS NOT NULL GROUP BY customer_id`, ...brands);
  const firstId = new Map(rows.map(r => [r.customer_id, Number(r.f.split('#')[1])]));
  for (const i of invs) i._isFirst = !i.customer_id || firstId.get(i.customer_id) === i.id;
}

// ---------------- Gelir-Gider ----------------
async function pnl(env, brand, from, to, settings) {
  const brands = brandFilter(brand);
  const sales = await all(env, `SELECT brand_id, substr(date,1,7) m, SUM(subtotal) net, SUM(total) gross, COUNT(*) n FROM invoices WHERE date>=? AND date<=? AND IFNULL(is_promo,0)=0 GROUP BY brand_id, m`, from, to);
  const exps = await all(env, 'SELECT * FROM expenses WHERE date>=? AND date<=? ORDER BY date DESC, id DESC', from, to);
  const revByBrand = {}; for (const s of sales) revByBrand[s.brand_id] = (revByBrand[s.brand_id] || 0) + s.gross;
  const totalRev = Object.values(revByBrand).reduce((a, b) => a + b, 0);
  const mode = settings.expense_allocation || 'ciro';
  const manual = settings.expense_manual_shares || {};
  const share = (e, b) => { // ortak giderin b markasına düşen payı (0..1)
    if (e.brand_id) return e.brand_id === b ? 1 : 0;
    let alloc = null; try { alloc = e.allocation ? JSON.parse(e.allocation) : null; } catch { }
    if (alloc && typeof alloc === 'object' && Object.keys(alloc).length) { const sum = Object.values(alloc).reduce((a, c) => a + Number(c), 0) || 1; return (Number(alloc[b]) || 0) / sum; }
    if (mode === 'esit') return 1 / BRANDS.length;
    if (mode === 'manuel') { const sum = Object.values(manual).reduce((a, c) => a + Number(c), 0) || 1; return (Number(manual[b]) || 0) / sum; }
    return totalRev ? (revByBrand[b] || 0) / totalRev : 1 / BRANDS.length;
  };
  const months = {};
  for (const s of sales) if (brands.includes(s.brand_id)) { (months[s.m] ||= { income: 0, gross: 0, expense: 0, orders: 0 }); months[s.m].income += s.gross; months[s.m].gross += s.gross; months[s.m].orders += s.n; }
  const expRows = [];
  const byCat = {};
  for (const e of exps) {
    const f = brands.reduce((a, b) => a + share(e, b), 0);
    if (f <= 0) continue;
    const part = e.amount * f; const m = e.date.slice(0, 7);
    (months[m] ||= { income: 0, gross: 0, expense: 0, orders: 0 }); months[m].expense += part;
    byCat[e.category || 'Diğer'] = (byCat[e.category || 'Diğer'] || 0) + part;
    expRows.push({ ...e, share: f, part: r2(part) });
  }
  const income = Object.values(months).reduce((a, m) => a + m.income, 0), expense = Object.values(months).reduce((a, m) => a + m.expense, 0);
  return { months: Object.entries(months).sort().map(([m, v]) => ({ month: m, income: r2(v.income), gross: r2(v.gross), expense: r2(v.expense), net: r2(v.income - v.expense), orders: v.orders })), income: r2(income), expense: r2(expense), net: r2(income - expense), byCategory: byCat, expenses: expRows, allocation: mode };
}

// ---------------- Router ----------------
export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(req);
    try {
      await ensureDB(env);
      return await api(req, env, url);
    } catch (e) {
      return err(e.message || String(e), 500);
    }
  }
};

async function body(req) { try { return await req.json(); } catch { return {}; } }

async function api(req, env, url) {
  const p = url.pathname.replace(/^\/api/, ''), m = req.method, q = url.searchParams;
  const settings = await getSettings(env);
  // --- kimlik ---
  if (p === '/state') return json({ needsSetup: !settings.password_hash, authed: await authed(env, req) });
  if (p === '/setup' && m === 'POST') {
    if (settings.password_hash) return err('Şifre zaten belirlenmiş.', 403);
    const { password } = await body(req);
    if (!password || String(password).length < 6) return err('Şifre en az 6 karakter olmalı.');
    const h = await hashPw(String(password)); await setSetting(env, 'password_hash', h);
    return json({ ok: true }, 200, { 'set-cookie': await newSession(env, req) });
  }
  if (p === '/login' && m === 'POST') {
    const lock = settings.login_lock || { fails: 0, until: 0 };
    if (lock.until > Date.now()) return err('Çok fazla hatalı deneme. Biraz sonra tekrar deneyin.', 429);
    const { password } = await body(req);
    if (!settings.password_hash) return err('Önce şifre belirleyin.', 400);
    const h = await hashPw(String(password || ''), settings.password_hash.salt);
    if (h.hash !== settings.password_hash.hash) {
      const fails = (lock.fails || 0) + 1; await setSetting(env, 'login_lock', { fails: fails >= 5 ? 0 : fails, until: fails >= 5 ? Date.now() + 60000 : 0 });
      return err('Şifre hatalı.', 401);
    }
    await setSetting(env, 'login_lock', { fails: 0, until: 0 });
    return json({ ok: true }, 200, { 'set-cookie': await newSession(env, req) });
  }
  if (p === '/logout' && m === 'POST') { const t = getCookie(req, 'pm_s'); if (t) await run(env, 'DELETE FROM sessions WHERE token=?', t); return json({ ok: true }, 200, { 'set-cookie': sessionCookie(req, '', 0) }); }
  if (!(await authed(env, req))) return err('Oturum gerekli.', 401);
  if (m !== 'GET' && (req.headers.get('x-pm') !== '1')) return err('Geçersiz istek.', 403); // basit CSRF koruması

  // --- temel veriler ---
  if (p === '/bootstrap') {
    const L = await lookups(env);
    const { password_hash, login_lock, ...pub } = settings;
    return json({ ...L, settings: pub, categories: CATEGORIES, hasApiKey: !!env.ANTHROPIC_API_KEY, hasR2: !!env.UPLOADS, segmentHelp: SEGMENT_HELP({ ...DEFAULT_SETTINGS.segment_rules, ...(settings.segment_rules || {}) }) });
  }
  if (p === '/settings' && m === 'PUT') {
    const b = await body(req);
    for (const [k, v] of Object.entries(b)) if (k in DEFAULT_SETTINGS) await setSetting(env, k, v);
    return json({ ok: true });
  }
  if (p === '/password' && m === 'POST') {
    const { old, password } = await body(req);
    const h = await hashPw(String(old || ''), settings.password_hash.salt);
    if (h.hash !== settings.password_hash.hash) return err('Mevcut şifre hatalı.', 401);
    if (!password || String(password).length < 6) return err('Yeni şifre en az 6 karakter olmalı.');
    await setSetting(env, 'password_hash', await hashPw(String(password)));
    await run(env, 'DELETE FROM sessions');
    return json({ ok: true }, 200, { 'set-cookie': await newSession(env, req) });
  }
  let mm;
  if ((mm = p.match(/^\/brands\/([\w-]+)$/)) && m === 'PUT') {
    const b = await body(req);
    if (b.logo && b.logo.length > 900000) return err('Logo çok büyük (en fazla ~600 KB).');
    await run(env, 'UPDATE brands SET name=COALESCE(?,name), color=COALESCE(?,color), logo=COALESCE(?,logo), invoice_prefix=COALESCE(?,invoice_prefix) WHERE id=?', b.name || null, b.color || null, b.logo || null, b.invoice_prefix || null, mm[1]);
    return json({ ok: true });
  }
  for (const [path, table] of [['sources', 'sources'], ['payments', 'payment_methods'], ['reps', 'sales_reps']]) {
    if (p === '/' + path && m === 'POST') { const b = await body(req); if (!b.name) return err('Ad gerekli.'); const mx = await first(env, `SELECT COALESCE(MAX(sort),0)+1 s FROM ${table}`); const r = await run(env, `INSERT INTO ${table} (name,color,sort) VALUES (?,?,?)`, b.name, b.color || '#888888', mx.s); if (table === 'sales_reps' && b.aliases) await run(env, 'UPDATE sales_reps SET aliases=? WHERE id=?', b.aliases, r.meta.last_row_id); return json({ id: r.meta.last_row_id }); }
    if ((mm = p.match(new RegExp(`^/${path}/(\\d+)$`)))) {
      if (m === 'PUT') { const b = await body(req); await run(env, `UPDATE ${table} SET name=COALESCE(?,name), color=COALESCE(?,color), active=COALESCE(?,active) WHERE id=?`, b.name || null, b.color || null, b.active ?? null, mm[1]); if (table === 'sales_reps' && b.aliases !== undefined) await run(env, 'UPDATE sales_reps SET aliases=? WHERE id=?', b.aliases || null, mm[1]); return json({ ok: true }); }
      if (m === 'DELETE') { const col = path === 'sources' ? 'source_id' : path === 'reps' ? 'rep_id' : 'payment_id'; const used = await first(env, `SELECT COUNT(*) c FROM invoices WHERE ${col}=?`, mm[1]); if (used.c) { await run(env, `UPDATE ${table} SET active=0 WHERE id=?`, mm[1]); return json({ ok: true, deactivated: true }); } await run(env, `DELETE FROM ${table} WHERE id=?`, mm[1]); return json({ ok: true }); }
    }
  }

  // --- ürünler ---
  if (p === '/catalog') {
    const prods = await all(env, 'SELECT * FROM products ORDER BY category, subcategory, name');
    const vars = await all(env, 'SELECT * FROM variants ORDER BY product_id, sort, id');
    const sold = await all(env, 'SELECT product_id, COUNT(*) n FROM invoice_lines WHERE product_id IS NOT NULL GROUP BY product_id');
    const soldMap = Object.fromEntries(sold.map(s => [s.product_id, s.n]));
    const byP = {}; for (const v of vars) (byP[v.product_id] ||= []).push(v);
    return json(prods.map(pr => ({ ...pr, variants: byP[pr.id] || [], sold_lines: soldMap[pr.id] || 0 })));
  }
  if (p === '/products' && m === 'POST') {
    const b = await body(req);
    if (!b.name) return err('Ürün adı gerekli.');
    const r = await run(env, 'INSERT INTO products (name,mfr,category,subcategory,unit,description,is_band,band_type,created_at) VALUES (?,?,?,?,?,?,?,?,?)', b.name, b.mfr || null, b.category || null, b.subcategory || null, b.unit || 'Adet', b.description || null, b.is_band ? 1 : 0, b.band_type || null, nowISO());
    await saveVariants(env, r.meta.last_row_id, b.variants);
    return json({ id: r.meta.last_row_id });
  }
  if ((mm = p.match(/^\/products\/(\d+)$/))) {
    const id = Number(mm[1]);
    if (m === 'PUT') {
      const b = await body(req);
      await run(env, 'UPDATE products SET name=?,mfr=?,category=?,subcategory=?,unit=?,description=?,is_band=?,band_type=?,active=? WHERE id=?', b.name, b.mfr || null, b.category || null, b.subcategory || null, b.unit || 'Adet', b.description || null, b.is_band ? 1 : 0, b.band_type || null, b.active === 0 ? 0 : 1, id);
      if (Array.isArray(b.variants)) await saveVariants(env, id, b.variants);
      return json({ ok: true });
    }
    if (m === 'DELETE') {
      const used = await first(env, 'SELECT COUNT(*) c FROM invoice_lines WHERE product_id=?', id);
      if (used.c) { await run(env, 'UPDATE products SET active=0 WHERE id=?', id); return json({ ok: true, deactivated: true }); }
      await run(env, 'DELETE FROM variants WHERE product_id=?', id); await run(env, 'DELETE FROM products WHERE id=?', id); return json({ ok: true });
    }
  }
  if (p === '/products/import' && m === 'POST') {
    const { rows } = await body(req); // [{name, mfr, category, subcategory, variant, is_band, description}]
    if (!Array.isArray(rows) || !rows.length) return err('İçe aktarılacak satır yok.');
    let created = 0, vcount = 0; const cache = new Map((await all(env, 'SELECT id,name FROM products')).map(r => [fold(r.name), r.id]));
    for (const r of rows) {
      if (!r.name) continue;
      let pid = cache.get(fold(r.name));
      if (!pid) { const x = await run(env, 'INSERT INTO products (name,mfr,category,subcategory,unit,description,is_band,created_at) VALUES (?,?,?,?,?,?,?,?)', r.name, r.mfr || null, r.category || null, r.subcategory || null, r.unit || 'Adet', r.description || null, /şerit/i.test(r.category || '') || r.is_band ? 1 : 0, nowISO()); pid = x.meta.last_row_id; cache.set(fold(r.name), pid); created++; }
      if (r.variant) { const ex = await first(env, 'SELECT id FROM variants WHERE product_id=? AND label=?', pid, r.variant); if (!ex) { await run(env, 'INSERT INTO variants (product_id,label,diameter,thickness,bore,teeth,width,tpi) VALUES (?,?,?,?,?,?,?,?)', pid, r.variant, r.diameter || null, r.thickness || null, r.bore || null, r.teeth || null, r.width || null, r.tpi || null); vcount++; } }
    }
    return json({ ok: true, created, variants: vcount });
  }

  // --- müşteriler ---
  if (p === '/customers') {
    const brand = q.get('brand'); if (!brand) return err('Marka gerekli.');
    const list = filterCustomers(await customerAggregates(env, brand, settings), q);
    const sort = q.get('sort') || 'total';
    const dir = q.get('dir') === 'asc' ? 1 : -1;
    list.sort((a, b) => { const x = a[sort] ?? '', y = b[sort] ?? ''; return (x > y ? 1 : x < y ? -1 : 0) * dir; });
    const summary = { count: list.length, total: r2(list.reduce((a, c) => a + c.total, 0)), orders: list.reduce((a, c) => a + c.order_count, 0) };
    const segs = {}; for (const c of list) segs[c.segment] = (segs[c.segment] || 0) + 1;
    const ils = {}; for (const c of list) { const k = c.il || 'Belirtilmemiş'; (ils[k] ||= { customers: 0, total: 0 }); ils[k].customers++; ils[k].total += c.total; }
    return json({ summary, segments: segs, byIl: ils, customers: list });
  }
  if (p === '/customers/lookup') {
    const brand = q.get('brand'), s = q.get('q') || '';
    const np = normalizePhone(s);
    if (np.ok) { const c = await first(env, 'SELECT c.*, (SELECT COUNT(*) FROM invoices i WHERE i.customer_id=c.id) orders FROM customers c WHERE brand_id=? AND phone=?', brand, np.phone); return json(c ? [c] : []); }
    const rows = await all(env, 'SELECT c.*, (SELECT COUNT(*) FROM invoices i WHERE i.customer_id=c.id) orders FROM customers c WHERE brand_id=? ORDER BY id DESC LIMIT 3000', brand);
    const f = fold(s); const d = s.replace(/\D/g, '');
    return json(rows.filter(c => fold(c.name).includes(f) || (d.length >= 4 && String(c.phone || '').includes(d))).slice(0, 10));
  }
  if ((mm = p.match(/^\/customers\/(\d+)$/))) {
    const id = Number(mm[1]);
    if (m === 'GET') {
      const c = await first(env, 'SELECT * FROM customers WHERE id=?', id); if (!c) return err('Müşteri bulunamadı.', 404);
      const agg = (await customerAggregates(env, c.brand_id, settings)).find(x => x.id === id);
      const invs = await all(env, 'SELECT * FROM invoices WHERE customer_id=? ORDER BY date DESC, id DESC', id);
      return json({ customer: agg || c, invoices: invs });
    }
    if (m === 'PUT') { const b = await body(req); const np = normalizePhone(b.phone); await run(env, 'UPDATE customers SET name=?,phone=?,address=?,il=?,ilce=?,note=?,is_official=?,tax_no=?,official_title=?,tax_office=?,person_type=? WHERE id=?', b.name || null, np.ok ? np.phone : (b.phone || null), b.address || null, b.il || null, b.ilce || null, b.note || null, b.is_official ? 1 : 0, b.tax_no || null, b.official_title || null, b.tax_office || null, b.person_type || null, id); return json({ ok: true }); }
    if (m === 'DELETE') { const u = await first(env, 'SELECT COUNT(*) c FROM invoices WHERE customer_id=?', id); if (u.c) return err('Bu müşterinin faturaları var; önce faturaları silin.'); await run(env, 'DELETE FROM customers WHERE id=?', id); return json({ ok: true }); }
  }
  if (p === '/segments') {
    if (m === 'GET') return json(await all(env, 'SELECT * FROM saved_segments WHERE brand_id=? OR brand_id IS NULL ORDER BY id DESC', q.get('brand')));
    if (m === 'POST') { const b = await body(req); const r = await run(env, 'INSERT INTO saved_segments (brand_id,name,filters,created_at) VALUES (?,?,?,?)', b.brand_id || null, b.name, JSON.stringify(b.filters || {}), nowISO()); return json({ id: r.meta.last_row_id }); }
  }
  if ((mm = p.match(/^\/segments\/(\d+)$/)) && m === 'DELETE') { await run(env, 'DELETE FROM saved_segments WHERE id=?', mm[1]); return json({ ok: true }); }

  // --- faturalar ---
  if (p === '/invoices' && m === 'GET') {
    const brands = brandFilter(q.get('brand'));
    let invs = await loadSales(env, brands, q.get('from'), q.get('to'));
    const multi = k => (q.get(k) || '').split(',').filter(Boolean);
    if (q.get('source')) invs = invs.filter(i => multi('source').includes(String(i.source_id ?? 'none')));
    if (q.get('payment')) invs = invs.filter(i => multi('payment').includes(String(i.payment_id ?? 'none')));
    if (q.get('official')) invs = invs.filter(i => String(i.is_official) === q.get('official'));
    if (q.get('promo')) invs = invs.filter(i => String(i.is_promo || 0) === q.get('promo'));
    if (q.get('rep')) invs = invs.filter(i => multi('rep').includes(String(i.rep_id ?? 'none')));
    if (q.get('il')) invs = invs.filter(i => (i.cust_il || 'Belirtilmemiş') === q.get('il'));
    if (q.get('ilce')) invs = invs.filter(i => i.cust_ilce === q.get('ilce'));
    if (q.get('customer')) invs = invs.filter(i => String(i.customer_id) === q.get('customer'));
    if (q.get('product')) invs = invs.filter(i => i.lines.some(l => String(l.product_id) === q.get('product')));
    if (q.get('category')) invs = invs.filter(i => i.lines.some(l => `${l.category} / ${l.subcategory}`.startsWith(q.get('category'))));
    if (q.get('auto')) invs = invs.filter(i => String(i.auto_batch_id || '') === q.get('auto'));
    if (q.get('first')) { await markFirstOrders(env, invs, brands); invs = invs.filter(i => String(i._isFirst ? 1 : 0) === q.get('first')); }
    if (q.get('q')) { const s = fold(q.get('q')); invs = invs.filter(i => fold([i.title, i.cust_name, i.invoice_no, i.cust_phone, i.cust_il, i.cust_ilce, i.note, ...i.lines.map(l => l.description)].join(' ')).includes(s)); }
    invs.sort((a, b) => (b.date + String(b.id).padStart(9, '0')).localeCompare(a.date + String(a.id).padStart(9, '0')));
    const summary = { count: invs.length, subtotal: r2(invs.reduce((a, i) => a + i.subtotal, 0)), vat: r2(invs.reduce((a, i) => a + i.vat_total, 0)), total: r2(invs.reduce((a, i) => a + i.total, 0)) };
    const page = Math.max(1, Number(q.get('page') || 1)), per = Math.min(500, Number(q.get('per') || 25));
    return json({ summary, page, per, invoices: invs.slice((page - 1) * per, page * per).map(i => ({ ...i, lines: i.lines.map(l => ({ description: l.description, qty: l.qty, unit: l.unit, band_length_mm: l.band_length_mm, band_meters: l.band_meters, pname: l.pname, mfr: l.mfr, category: l.category, subcategory: l.subcategory, is_band: l.is_band, vwidth: l.vwidth, vthick: l.vthick, vdia: l.vdia, vteeth: l.vteeth })) })) });
  }
  if (p === '/invoices' && m === 'POST') {
    const b = await body(req); if (!b.brand) return err('Marka gerekli.');
    const id = await saveInvoice(env, b.brand, b, null, settings);
    return json({ id });
  }
  if ((mm = p.match(/^\/invoices\/(\d+)$/))) {
    const id = Number(mm[1]);
    const inv = await first(env, 'SELECT * FROM invoices WHERE id=?', id); if (!inv) return err('Fatura bulunamadı.', 404);
    if (m === 'GET') { const lines = await all(env, 'SELECT l.*, p.name pname, p.is_band, v.label vlabel FROM invoice_lines l LEFT JOIN products p ON p.id=l.product_id LEFT JOIN variants v ON v.id=l.variant_id WHERE invoice_id=? ORDER BY sort', id); const cnt = await first(env, 'SELECT COUNT(*) c FROM invoices WHERE customer_id=? AND (date<? OR (date=? AND id<=?))', inv.customer_id, inv.date, inv.date, id); return json({ ...inv, lines, customer_order_no: cnt ? cnt.c : 1 }); }
    if (m === 'PUT') { const b = await body(req); await saveInvoice(env, inv.brand_id, b, id, settings); return json({ id }); }
    if (m === 'DELETE') { await run(env, 'DELETE FROM invoice_lines WHERE invoice_id=?', id); await run(env, 'DELETE FROM invoices WHERE id=?', id); return json({ ok: true }); }
  }

  // --- otomatik satış girişi ---
  if (p === '/auto/parse' && m === 'POST') {
    const b = await body(req);
    if (!b.brand) return err('Marka gerekli.');
    const images = (b.images || []).slice(0, 20);
    if ((b.images || []).length > 20) return err('En fazla 20 görsel yüklenebilir.');
    if (!b.text && !images.length) return err('Metin yapıştırın veya görsel yükleyin.');
    const L = await lookups(env);
    const srcNames = L.sources.filter(s => s.active).map(s => s.name), payNames = L.payments.filter(s => s.active).map(s => s.name);
    let engine = b.engine || settings.auto_engine || 'claude';
    if (!env.ANTHROPIC_API_KEY) engine = 'kural';
    if (engine === 'kural' && images.length) return err('Görselleri okumak için sunucuda ANTHROPIC_API_KEY tanımlı olmalı. Şimdilik metni yapıştırarak kural tabanlı okuma kullanabilirsiniz.');
    const cat = await catalog(env);
    let raw, meta = {};
    if (engine === 'claude') {
      const famNames = [...new Set(cat.map(v => `${v.p.name} [${v.p.category} / ${v.p.subcategory}]`))];
      const r = await extractWithClaude(env, { text: b.text, images, sources: srcNames, payments: payNames, productNames: famNames, model: settings.claude_model });
      raw = r.orders; meta = { model: r.model, usage: r.usage };
    } else raw = parseText(b.text, { sources: srcNames, payments: payNames, reps: L.reps });
    const orders = [];
    const srcId = n => (L.sources.find(s => s.name === n) || {}).id || null, payId = n => (L.payments.find(s => s.name === n) || {}).id || null;
    const repOf = raw => { if (!raw) return null; const k = fold(raw).replace(/[^a-z0-9]/g, ''); return L.reps.find(r => [r.name, ...String(r.aliases || '').split(',')].some(a => a.trim() && fold(a).replace(/[^a-z0-9]/g, '') === k)) || null; };
    for (const o of raw) {
      const np = normalizePhone(o.phone);
      const flags = [...(o.uncertain_fields || [])];
      if (o.phone && !np.ok) flags.push('phone_format');
      let note = o.note || '';
      if (o.payment === 'Kapıda (tür belirsiz)') { note = (note ? note + ' ' : '') + 'Kapıda ödeme yazıyor, nakit/kart belirtilmemiş.'; if (!flags.includes('payment')) flags.push('payment'); }
      let existing = null;
      if (np.ok) existing = await first(env, 'SELECT c.id, c.name, (SELECT COUNT(*) FROM invoices i WHERE i.customer_id=c.id) orders FROM customers c WHERE brand_id=? AND phone=?', b.brand, np.phone);
      const odate = o.date || b.date || null;
      if (!odate && !flags.includes('date')) flags.push('date');
      const rep = repOf(o.rep);
      const cikma = [];
      const items = (o.items || []).map(it => {
        const mt = matchItem({ ...it, raw_text: it.spec || it.raw_text }, cat);
        if (mt.confidence === 'low') { mt.variant_id = null; mt.product_id = null; }
        if (it.second_hand) { const cv = cat.find(x => x.p.name === 'Çıkma Testere'); if (cv) { mt.variant_id = cv.id; mt.product_id = cv.product_id; mt.confidence = 'ok'; mt.flags = []; mt.dims = {}; } } // güvenle eşleşmeyen ürünü uydurma: mesajdaki metin kalır, öneriler listede
        const v = mt.variant_id ? cat.find(x => x.id === mt.variant_id) : null;
        if (it.second_hand) { const sp = String(it.spec || it.raw_text || '').replace(/^\s*\d+\s*[-–]\s*/, '').replace(/\(|\)/g, ' ').replace(/(çıkma|cikma|ikinci\s*el|2\.\s?el|testeresi|testere)/ig, ' ').replace(/\s+/g, ' ').trim(); if (sp) cikma.push(sp); }
        const isBand = v ? !!v.p.is_band : it.kind === 'serit';
        const len = it.length_mm || mt.dims.length_mm || null;
        const qty = it.qty ?? null;
        let unit_price = it.unit_price ?? null;
        if (unit_price == null && it.line_total != null && qty) unit_price = +(it.line_total / qty).toFixed(4);
        const warn = [...mt.flags];
        if ((it.uncertain || []).includes('qty') || qty == null) warn.push('Adet mesajda net değil.');
        if ((it.uncertain || []).includes('qty_assumed')) warn.push('Adet yazmıyor, 1 kabul edildi.');
        if ((it.uncertain || []).includes('price_even')) warn.push('Toplam ürünlere eşit bölündü.');
        if ((it.uncertain || []).includes('price_from_total')) warn.push('Birim fiyat sipariş toplamından hesaplandı.');
        if ((it.uncertain || []).includes('price_kind')) warn.push('Fiyatın birim mi satır toplamı mı olduğu net değil (toplam kabul edildi).');
        if (unit_price == null) warn.push('Fiyat mesajda yok.');
        for (const u of (it.uncertain || [])) if (!['qty', 'price', 'price_from_total', 'price_kind', 'price_split', 'price_even', 'qty_assumed'].includes(u)) warn.push(`Belirsiz: ${u}`);
        return { raw_text: it.raw_text, note: it.note || '', product_id: mt.product_id, variant_id: mt.variant_id, description: v ? (it.second_hand ? 'Çıkma Testere' : shortName(v.p, v, { withTpi: true })) : (it.spec || it.raw_text || ''), is_band: isBand, band_length_mm: isBand ? len : null, qty: qty ?? 1, qty_missing: qty == null, unit_price: unit_price ?? 0, confidence: mt.confidence, score: mt.score, alternatives: mt.alternatives, warnings: warn };
      });
      // mükerrer kontrolü
      let duplicate = null;
      if (np.ok) {
        const dups = await all(env, 'SELECT i.id, i.invoice_no FROM invoices i WHERE i.brand_id=? AND i.date=? AND i.cust_phone=?', b.brand, odate, np.phone);
        for (const d of dups) {
          const ls = await all(env, 'SELECT variant_id, description FROM invoice_lines WHERE invoice_id=?', d.id);
          if (!items.length || items.some(it => ls.some(l => (it.variant_id && l.variant_id === it.variant_id) || fold(l.description) === fold(it.description)))) { duplicate = { id: d.id, invoice_no: d.invoice_no }; break; }
        }
      }
      if (o.rep_from_sender && !rep) flags.push('rep_sender');
      if (cikma.length) note = [cikma.map(x => 'Çıkma: ' + x).join(', '), note].filter(Boolean).join(' · ');
      orders.push({ date: odate, exchange: !!o.exchange, is_promo: !!o.promo, vat_mode: o.vat_mode || null, rep_raw: o.rep || '', rep_id: rep ? rep.id : null, anonymous: !!o.anonymous, is_official: !!o.is_official, tax_no: o.tax_no || '', tax_office: o.tax_office || '', official_title: o.official_title || '', raw_text: o.raw_text || '', customer_name: o.customer_name || '', phone: np.ok ? np.phone : (o.phone || ''), address: o.address || '', il: o.il || '', ilce: o.ilce || '', source: o.source, source_id: srcId(o.source), payment: o.payment, payment_id: payId(o.payment), order_total: o.order_total ?? null, note, source_ref: o.source_ref || '', flags, existing_customer: existing, duplicate, items });
    }
    // aynı parti içinde mükerrer
    orders.forEach((o, i) => { for (let j = 0; j < i; j++) { const x = orders[j]; if (o.phone && o.phone === x.phone && JSON.stringify(o.items.map(t => t.variant_id || t.description).sort()) === JSON.stringify(x.items.map(t => t.variant_id || t.description).sort())) o.batch_duplicate_of = j; } });
    let keys = [];
    if (env.UPLOADS && images.length) {
      for (let i = 0; i < images.length; i++) {
        const mt = /^data:(image\/\w+);base64,(.+)$/.exec(images[i]); if (!mt) continue;
        const k = `auto/${b.brand}/${Date.now()}-${i}.${mt[1].split('/')[1]}`;
        await env.UPLOADS.put(k, Uint8Array.from(atob(mt[2]), c => c.charCodeAt(0)), { httpMetadata: { contentType: mt[1] } });
        keys.push(k);
      }
    }
    const rb = await run(env, 'INSERT INTO auto_batches (brand_id,sale_date,input_text,image_count,image_keys,engine,raw_result,status,created_at) VALUES (?,?,?,?,?,?,?,?,?)',
      b.brand, b.date || (orders[0] && orders[0].date) || null, b.text || null, images.length, JSON.stringify(keys), engine + (meta.model ? ':' + meta.model : ''), JSON.stringify(orders), 'parsed', nowISO());
    return json({ batch_id: rb.meta.last_row_id, engine, orders, usage: meta.usage || null });
  }
  if (p === '/auto/commit' && m === 'POST') {
    const b = await body(req);
    if (!b.brand) return err('Marka gerekli.');
    if ((b.orders || []).some(o => !(o.date || b.date))) return err('Tarihi olmayan sipariş var; satış tarihini seçin.');
    const reps = await all(env, 'SELECT * FROM sales_reps');
    for (const o of b.orders || []) {
      if (o.rep_id || !o.rep_raw) continue;
      const k = fold(o.rep_raw).replace(/[^a-z0-9]/g, '');
      let r = reps.find(x => [x.name, ...String(x.aliases || '').split(',')].some(a => a.trim() && fold(a).replace(/[^a-z0-9]/g, '') === k));
      if (!r) { const nm = o.rep_raw.replace(/(^|[\s.])(\p{L})/gu, (m0, a, c) => a + c.toLocaleUpperCase('tr')); const x = await run(env, 'INSERT INTO sales_reps (name,color,sort) VALUES (?,?,?)', nm, ['#e8590c', '#0ca678', '#7048e8', '#1c7ed6', '#d6336c', '#f08c00'][reps.length % 6], reps.length); r = { id: x.meta.last_row_id, name: nm, aliases: '' }; reps.push(r); }
      o.rep_id = r.id;
    }
    const batch = b.batch_id ? await first(env, 'SELECT * FROM auto_batches WHERE id=?', b.batch_id) : null;
    const ids = [];
    for (const o of b.orders || []) {
      const inv = { brand: b.brand, date: o.date || b.date, auto_batch_id: b.batch_id || null, source_id: o.source_id || null, payment_id: o.payment_id || null, rep_id: o.rep_id || null, is_official: o.is_official ? 1 : 0, is_promo: o.is_promo ? 1 : 0, tax_no: o.tax_no, tax_office: o.tax_office, official_title: o.official_title, person_type: o.is_official ? 'tuzel' : null, prices_incl_vat: o.vat_mode === 'excl' ? 0 : (o.is_official || o.vat_mode === 'incl') ? 1 : 0, note: o.note || null, title: o.customer_name || null,
        customer: { name: o.customer_name, phone: o.phone, address: o.address, il: o.il, ilce: o.ilce },
        lines: (o.items || []).map(it => ({ product_id: it.product_id, variant_id: it.variant_id, description: it.description, qty: it.qty, unit_price: it.unit_price, vat_rate: (o.is_official || o.vat_mode) ? 20 : 0, band_length_mm: it.is_band ? it.band_length_mm : null, unit: 'Adet' })) };
      ids.push(await saveInvoice(env, b.brand, inv, null, settings));
    }
    if (batch) {
      const raw = JSON.parse(batch.raw_result || '[]');
      const stats = diffStats(raw, b.orders || [], b.raw_index || null);
      await run(env, 'UPDATE auto_batches SET final_result=?, stats=?, status=? WHERE id=?', JSON.stringify(b.orders), JSON.stringify({ ...stats, created: ids.length }), 'committed', batch.id);
    }
    return json({ ok: true, invoice_ids: ids });
  }
  if (p === '/auto/history') {
    const rows = await all(env, 'SELECT id,brand_id,sale_date,image_count,engine,stats,status,created_at, substr(input_text,1,160) preview FROM auto_batches WHERE brand_id=? ORDER BY id DESC LIMIT 100', q.get('brand'));
    return json(rows.map(r => ({ ...r, stats: r.stats ? JSON.parse(r.stats) : null })));
  }
  if ((mm = p.match(/^\/auto\/history\/(\d+)$/))) {
    const r = await first(env, 'SELECT * FROM auto_batches WHERE id=?', mm[1]); if (!r) return err('Bulunamadı', 404);
    return json({ ...r, raw_result: JSON.parse(r.raw_result || '[]'), final_result: r.final_result ? JSON.parse(r.final_result) : null, stats: r.stats ? JSON.parse(r.stats) : null, image_keys: JSON.parse(r.image_keys || '[]') });
  }
  if ((mm = p.match(/^\/auto\/image\/(.+)$/)) && env.UPLOADS) { const o = await env.UPLOADS.get(decodeURIComponent(mm[1])); if (!o) return err('Yok', 404); return new Response(o.body, { headers: { 'content-type': o.httpMetadata?.contentType || 'image/jpeg', 'cache-control': 'private, max-age=3600' } }); }

  // --- giderler ---
  if (p === '/expenses' && m === 'POST') { const b = await body(req); if (!b.amount || !b.date) return err('Tutar ve tarih gerekli.'); const r = await run(env, 'INSERT INTO expenses (brand_id,category,amount,date,description,allocation,created_at) VALUES (?,?,?,?,?,?,?)', b.brand_id || null, b.category || 'Diğer', Number(b.amount), b.date, b.description || null, b.allocation ? JSON.stringify(b.allocation) : null, nowISO()); return json({ id: r.meta.last_row_id }); }
  if ((mm = p.match(/^\/expenses\/(\d+)$/))) {
    if (m === 'PUT') { const b = await body(req); await run(env, 'UPDATE expenses SET brand_id=?,category=?,amount=?,date=?,description=?,allocation=? WHERE id=?', b.brand_id || null, b.category || 'Diğer', Number(b.amount), b.date, b.description || null, b.allocation ? JSON.stringify(b.allocation) : null, mm[1]); return json({ ok: true }); }
    if (m === 'DELETE') { await run(env, 'DELETE FROM expenses WHERE id=?', mm[1]); return json({ ok: true }); }
  }
  if (p === '/pnl') { const from = q.get('from') || '0000-01-01', to = q.get('to') || '9999-12-31'; return json(await pnl(env, q.get('brand'), from, to, settings)); }

  // --- raporlar ---
  if (p === '/report') {
    const brands = brandFilter(q.get('brand'));
    const from = q.get('from'), to = q.get('to'), vat = q.get('vat') || 'incl';
    const L = await lookups(env);
    const srcMap = Object.fromEntries(L.sources.map(s => [s.id, s.name])), payMap = Object.fromEntries(L.payments.map(s => [s.id, s.name]));
    const all0 = await loadSales(env, brands, from, to); const invs = all0.filter(i => !i.is_promo);
    const promoInv = all0.filter(i => i.is_promo); const promo = { count: promoInv.length, items: promoInv.reduce((a, i) => a + i.lines.reduce((b, l) => b + (Number(l.qty) || 0), 0), 0) };
    await markFirstOrders(env, invs, brands);
    const repMap = Object.fromEntries(L.reps.map(s => [s.id, s.name]));
    const opts = { vat, brands, srcMap, payMap, repMap, roll: Number(settings.band_roll_m) || 100 };
    const cur = salesReport(invs, opts);
    // hiç satmayan ürünler
    const soldIds = new Set(Object.values(cur.byProduct).map(x => x.product_id).filter(Boolean));
    const prods = await all(env, 'SELECT id,name,category,subcategory FROM products WHERE active=1');
    cur.neverSold = prods.filter(pr => !soldIds.has(pr.id));
    let prev = null;
    if (q.get('cmp') === '1' && from && to) {
      const [pf, pt] = shiftPeriod(from, to);
      const pinv = (await loadSales(env, brands, pf, pt)).filter(i => !i.is_promo); await markFirstOrders(env, pinv, brands);
      const pr = salesReport(pinv, opts);
      prev = { from: pf, to: pt, byRep: pr.byRep, total: pr.total, orders: pr.orders, avgBasket: pr.avgBasket, customers: pr.customers, bySource: pr.bySource, byPayment: pr.byPayment, byBrand: pr.byBrand, daily: pr.daily, bandMeters: pr.bands.meters };
    }
    return json({ ...cur, prev, from, to, vat, promo });
  }

  // --- dış veri aktarımı (ör. Paraşüt geçmişi): hazırlanmış JSON parça parça gönderilir ---
  if (p === '/import/invoices' && m === 'POST') {
    const b = await body(req);
    const valid = new Set(BRANDS.map(x => x.id));
    let batch = Number(b.batch_id) || null;
    if (!batch) {
      const r = await run(env, 'INSERT INTO auto_batches (brand_id,sale_date,input_text,engine,stats,status,created_at) VALUES (?,?,?,?,?,?,?)', 'all', b.sale_date || null, String(b.label || 'Veri aktarımı').slice(0, 500), 'import', JSON.stringify({ total: b.total || null }), 'committed', nowISO());
      batch = r.meta.last_row_id;
    }
    let added = 0, skipped = 0;
    for (const iv of b.invoices || []) {
      if (!valid.has(iv.brand) || !iv.date) { skipped++; continue; }
      if (iv.invoice_no && await first(env, 'SELECT id FROM invoices WHERE brand_id=? AND invoice_no=? AND date=?', iv.brand, iv.invoice_no, iv.date)) { skipped++; continue; }
      const np = normalizePhone(iv.phone || ''); const phone = np.ok ? np.phone : null;
      let cid = null;
      if (iv.name || phone) {
        const row = phone ? await first(env, 'SELECT id FROM customers WHERE brand_id=? AND phone=?', iv.brand, phone)
          : await first(env, 'SELECT id FROM customers WHERE brand_id=? AND phone IS NULL AND name=?', iv.brand, iv.name);
        if (row) cid = row.id;
        else cid = (await run(env, 'INSERT INTO customers (brand_id,name,phone,address,il,ilce,is_official,tax_no,official_title,tax_office,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
          iv.brand, iv.name || null, phone, iv.address || null, iv.il || null, iv.ilce || null, iv.is_official ? 1 : 0, iv.tax_no || null, iv.is_official ? iv.name || null : null, iv.tax_office || null, nowISO())).meta.last_row_id;
      }
      const lines = (iv.lines || []).map((l, i) => ({ ...l, sort: i, qty: Number(l.qty) || 1, line_net: r2(Number(l.line_net) || 0) }));
      const total = r2(lines.reduce((a, l) => a + l.line_net, 0));
      const off = iv.is_official ? 1 : 0;
      const id = (await run(env, `INSERT INTO invoices (brand_id,seq,invoice_no,title,customer_id,date,source_id,payment_id,rep_id,is_official,cust_name,cust_phone,cust_address,cust_il,cust_ilce,tax_no,official_title,tax_office,order_info,note,prices_incl_vat,subtotal,vat_total,total,auto_batch_id,created_at,updated_at) VALUES (?,NULL,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,0,?,0,?,?,?,?)`,
        iv.brand, iv.invoice_no || null, iv.name || null, cid, iv.date, iv.source_id || null, iv.payment_id || null, iv.rep_id || null, off, iv.name || null, phone, iv.address || null, iv.il || null, iv.ilce || null,
        off ? iv.tax_no || null : null, off ? iv.name || null : null, off ? iv.tax_office || null : null, iv.order_info || null, iv.note || null, total, total, batch, nowISO(), nowISO())).meta.last_row_id;
      if (lines.length) await env.DB.batch(lines.map(l => env.DB.prepare('INSERT INTO invoice_lines (invoice_id,sort,product_id,variant_id,description,qty,unit,unit_price,vat_rate,band_length_mm,band_meters,line_net,line_vat) VALUES (?,?,?,?,?,?,?,?,0,NULL,?,?,0)')
        .bind(id, l.sort, l.product_id || null, l.variant_id || null, l.description || '', l.qty, l.unit || 'Adet', r2(l.line_net / l.qty), l.band_meters || null, l.line_net)));
      added++;
    }
    await normalizeServices(env);
    return json({ ok: true, batch_id: batch, added, skipped });
  }
  if (p.startsWith('/import/') && m === 'DELETE') {
    const id = Number(p.split('/')[2]);
    const bt = await first(env, "SELECT id FROM auto_batches WHERE id=? AND engine='import'", id);
    if (!bt) return err('Aktarım bulunamadı.', 404);
    await run(env, 'DELETE FROM invoice_lines WHERE invoice_id IN (SELECT id FROM invoices WHERE auto_batch_id=?)', id);
    const r = await run(env, 'DELETE FROM invoices WHERE auto_batch_id=?', id);
    await run(env, 'DELETE FROM customers WHERE created_at >= (SELECT created_at FROM auto_batches WHERE id=?) AND id NOT IN (SELECT customer_id FROM invoices WHERE customer_id IS NOT NULL)', id);
    await run(env, "UPDATE auto_batches SET status='reverted' WHERE id=?", id);
    return json({ ok: true, deleted: r.meta.changes });
  }
  if (p === '/import' && m === 'GET') return json(await all(env, "SELECT b.id, b.input_text label, b.status, b.created_at, (SELECT COUNT(*) FROM invoices i WHERE i.auto_batch_id=b.id) n FROM auto_batches b WHERE engine='import' ORDER BY id DESC"));

  // --- yedek ---
  if (p === '/export/backup') {
    const out = {};
    for (const t of ['brands', 'sources', 'payment_methods', 'sales_reps', 'products', 'variants', 'customers', 'invoices', 'invoice_lines', 'expenses', 'saved_segments']) out[t] = await all(env, `SELECT * FROM ${t}`);
    out.auto_batches = await all(env, 'SELECT id,brand_id,sale_date,input_text,image_count,engine,raw_result,final_result,stats,status,created_at FROM auto_batches');
    const { password_hash, login_lock, ...pub } = settings; out.settings = pub; out.exported_at = nowISO();
    return new Response(JSON.stringify(out, null, 1), { headers: { 'content-type': 'application/json', 'content-disposition': `attachment; filename="paramotor-yedek-${nowISO().slice(0, 10)}.json"` } });
  }
  return err('Bulunamadı: ' + p, 404);
}

async function saveVariants(env, pid, variants) {
  if (!Array.isArray(variants)) return;
  const keep = variants.filter(v => v.id).map(v => Number(v.id));
  const existing = await all(env, 'SELECT id FROM variants WHERE product_id=?', pid);
  for (const e of existing) if (!keep.includes(e.id)) {
    const used = await first(env, 'SELECT COUNT(*) c FROM invoice_lines WHERE variant_id=?', e.id);
    if (used.c) await run(env, 'UPDATE variants SET active=0 WHERE id=?', e.id); else await run(env, 'DELETE FROM variants WHERE id=?', e.id);
  }
  let i = 0;
  for (const v of variants) {
    if (!v.label) continue;
    const vals = [v.label, v.diameter || null, v.thickness || null, v.bore || null, v.teeth || null, v.width || null, v.tpi || null, v.length || null, i++];
    if (v.id) await run(env, 'UPDATE variants SET label=?,diameter=?,thickness=?,bore=?,teeth=?,width=?,tpi=?,length=?,sort=?,active=1 WHERE id=? AND product_id=?', ...vals, v.id, pid);
    else await run(env, 'INSERT INTO variants (label,diameter,thickness,bore,teeth,width,tpi,length,sort,product_id) VALUES (?,?,?,?,?,?,?,?,?,?)', ...vals, pid);
  }
}

// Önizlemede kullanıcının düzelttiği alanları sayar → okuma hata oranı raporu
function diffStats(raw, final) {
  const fields = ['customer_name', 'phone', 'address', 'il', 'ilce', 'source_id', 'payment_id', 'rep_id', 'date'];
  let checked = 0, changed = 0; const per = {};
  const n = Math.min(raw.length, final.length);
  final.forEach((f, idx) => {
    const r = raw[f._raw_index === undefined ? idx : (f._raw_index ?? -1)]; if (!r) return;
    for (const k of fields) { checked++; if (String(r[k] ?? '') !== String(f[k] ?? '')) { changed++; per[k] = (per[k] || 0) + 1; } }
    const ri = r.items || [], fi = f.items || [];
    for (let i = 0; i < Math.max(ri.length, fi.length); i++) {
      for (const k of ['variant_id', 'qty', 'unit_price', 'band_length_mm']) { checked++; if (String((ri[i] || {})[k] ?? '') !== String((fi[i] || {})[k] ?? '')) { changed++; per['item.' + k] = (per['item.' + k] || 0) + 1; } }
    }
  });
  return { parsed_orders: raw.length, committed_orders: final.length, dropped_orders: Math.max(0, raw.length - final.filter(f => f._raw_index !== null).length), added_orders: final.filter(f => f._raw_index === null).length, fields_checked: checked, fields_corrected: changed, error_rate: checked ? +(changed / checked).toFixed(4) : 0, per_field: per, _n: n };
}
