// Zeplin — çekirdek yardımcılar: API, biçimlendirme, ikonlar, bileşenler, grafikler, dışa aktarma
import { shortName } from './short.js';
export const S = { boot: null, catalog: null, catIndex: null };

// Yeni sürüm yayınlandıysa eski arayüzle yeni veri karışmasın: sayfa otomatik yenilenir
let APP_VER = null, reloading = false;
function checkVersion(v) {
  if (!v || reloading) return;
  if (!APP_VER) { APP_VER = v; return; }
  if (v !== APP_VER) { reloading = true; try { sessionStorage.setItem('pm_upd', '1'); } catch { } location.reload(); }
}
export async function api(path, opt = {}) {
  const r = await fetch('/api' + path, { method: opt.method || 'GET', headers: { 'content-type': 'application/json', 'x-pm': '1' }, body: opt.body ? JSON.stringify(opt.body) : undefined, credentials: 'same-origin' });
  checkVersion(r.headers.get('x-app-version'));
  let d = null; try { d = await r.json(); } catch { }
  if (r.status === 401 && !path.startsWith('/login') && !path.startsWith('/password')) { location.hash = '#/giris'; throw new Error('Oturum gerekli'); }
  if (!r.ok) throw new Error((d && d.error) || ('Hata ' + r.status));
  return d;
}
api.post = (p, b) => api(p, { method: 'POST', body: b || {} });
api.put = (p, b) => api(p, { method: 'PUT', body: b || {} });
api.del = p => api(p, { method: 'DELETE' });

export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
export const $ = (sel, el = document) => el.querySelector(sel);
export const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];
export const trLower = s => String(s || '').replace(/I/g, 'ı').replace(/İ/g, 'i').toLowerCase();
export const fold = s => trLower(s).replace(/ı/g, 'i').replace(/ğ/g, 'g').replace(/ü/g, 'u').replace(/ş/g, 's').replace(/ö/g, 'o').replace(/ç/g, 'c');
export const trUpper = s => String(s || '').replace(/i/g, 'İ').replace(/ı/g, 'I').toUpperCase();

const nf = new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const nf0 = new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 0 });
const nf1 = new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 1 });
export const money = n => nf.format(Number(n) || 0) + ' ₺';
export const moneyHtml = n => { const [a, b] = nf.format(Number(n) || 0).split(','); return `<span class="amount">${a}<span class="dec">,${b}₺</span></span>`; };
export const int = n => nf0.format(Number(n) || 0);
export const dec1 = n => nf1.format(Number(n) || 0);
export const short = n => { n = Number(n) || 0; const a = Math.abs(n); return a >= 1e6 ? nf1.format(n / 1e6) + ' mn' : a >= 1e3 ? nf1.format(n / 1e3) + ' bin' : nf0.format(n); };
export const pct = n => '%' + nf1.format((Number(n) || 0) * 100);
export const dmy = iso => iso ? iso.slice(0, 10).split('-').reverse().join('.') : '';
export const today = () => { const d = new Date(); return new Date(d - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10); };
export const parseNum = v => { if (v === null || v === undefined || v === '') return null; let s = String(v).trim().replace(/\s|₺|tl/gi, ''); if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) s = s.replace(/\./g, '').replace(',', '.'); else s = s.replace(',', '.'); const n = parseFloat(s); return isFinite(n) ? n : null; };
export const numIn = n => (n === null || n === undefined || n === '') ? '' : String(Math.round(Number(n) * 10000) / 10000).replace('.', ',');
export const phoneFmt = p => { const d = String(p || '').replace(/\D/g, ''); return d.length === 11 ? `${d.slice(0, 4)} ${d.slice(4, 7)} ${d.slice(7, 9)} ${d.slice(9)}` : (p || ''); };
export const phoneNorm = raw => { let d = String(raw || '').replace(/\D/g, ''); if (d.startsWith('90') && d.length === 12) d = d.slice(2); if (d.length === 10 && d[0] === '5') d = '0' + d; return d.length === 11 && d.startsWith('05') ? d : null; };
export const waLink = p => { const n = phoneNorm(p); return n ? 'https://wa.me/90' + n.slice(1) : null; };

// ---------- ikonlar (lucide benzeri çizgiler) ----------
const P = {
  home: '<path d="M3 11 12 4l9 7"/><path d="M5 10v10h14V10"/>',
  invoice: '<path d="M7 3h8l4 4v14H7z"/><path d="M15 3v4h4"/><path d="M10 12h6M10 16h6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  spark: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.6 3.4-5.5 6.5-5.5s5.7 1.9 6.5 5.5"/><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14.7c2 .7 3.2 2.5 3.6 5.3"/>',
  box: '<path d="M3 7.5 12 3l9 4.5v9L12 21l-9-4.5z"/><path d="M3 7.5 12 12l9-4.5M12 12v9"/>',
  chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  pie: '<path d="M12 3a9 9 0 1 0 9 9h-9z"/><path d="M15 3.5A9 9 0 0 1 20.5 9H15z"/>',
  wallet: '<path d="M3 7h16a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M3 7l3-4h11v4"/><circle cx="16.5" cy="13.5" r="1.3"/>',
  coins: '<ellipse cx="9" cy="7" rx="6" ry="3"/><path d="M3 7v5c0 1.7 2.7 3 6 3s6-1.3 6-3V7"/><path d="M9 15v2c0 1.7 2.7 3 6 3s6-1.3 6-3v-5c0-1.6-2.4-2.9-5.5-3"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.6 1.7 1.7 0 0 0-1.8.3l-.1.1A2 2 0 1 1 4.3 17l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.6-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1A2 2 0 1 1 7.1 4.3l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  swap: '<path d="M7 4 3 8l4 4"/><path d="M3 8h14"/><path d="m17 20 4-4-4-4"/><path d="M21 16H7"/>',
  out: '<path d="M15 4h4v16h-4"/><path d="M10 17l5-5-5-5M15 12H3"/>',
  moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  filter: '<path d="M3 5h18l-7 8v6l-4 2v-8z"/>',
  file: '<path d="M7 3h8l4 4v14H7z"/><path d="M15 3v4h4"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1-4 4-6 8-6s7 2 8 6"/>',
  building: '<rect x="5" y="3" width="14" height="18" rx="1"/><path d="M9 7h2M13 7h2M9 11h2M13 11h2M9 15h2M13 15h2"/>',
  cal: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  pen: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13 7 4 4"/>',
  tag: '<path d="M3 12V4h8l10 10-8 8z"/><circle cx="7.5" cy="8.5" r="1.3"/>',
  folder: '<path d="M3 6h6l2 2h10v11H3z"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  check: '<path d="m5 12 5 5L20 7"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  side: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16"/>',
  download: '<path d="M12 4v11M7 10l5 5 5-5M4 20h16"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V4H4v12h4"/>',
  image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="m21 17-5-5-9 8"/>',
  warn: '<path d="M12 3 2 21h20z"/><path d="M12 10v5M12 18v.5"/>',
  phone: '<path d="M5 3h4l2 5-2.5 1.5a11 11 0 0 0 6 6L16 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 5a2 2 0 0 1 2-2z"/>',
  map: '<path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/>',
  history: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 7v5l3 2"/>',
  saw: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="2"/><path d="M12 4l2-2M20 12l2 2M12 20l-2 2M4 12l-2-2M17.7 6.3l2.8-.7M17.7 17.7l.7 2.8M6.3 17.7l-2.8.7M6.3 6.3l-.7-2.8"/>',
  print: '<path d="M6 9V3h12v6"/><rect x="3" y="9" width="18" height="8" rx="2"/><path d="M6 14h12v7H6z"/>'
};
export const icon = (n, cls = '') => `<svg class="i ${cls}" viewBox="0 0 24 24" aria-hidden="true">${P[n] || ''}</svg>`;

// ---------- toast / modal ----------
export function toast(msg, isErr = false) {
  const t = document.createElement('div'); t.className = 'toast' + (isErr ? ' err' : ''); t.textContent = msg; document.body.appendChild(t);
  setTimeout(() => t.remove(), isErr ? 5200 : 2800);
}
export function modal({ title, body, actions = [], wide = false, onOpen }) {
  const bg = document.createElement('div'); bg.className = 'modal-bg';
  bg.innerHTML = `<div class="modal ${wide ? 'wide' : ''}" role="dialog" aria-modal="true"><div class="mh"><h3>${esc(title)}</h3><span class="sp"></span><button class="btn ghost icon" data-x>${icon('x')}</button></div><div class="mb">${body}</div><div class="mf"></div></div>`;
  const close = () => { bg.remove(); document.removeEventListener('keydown', key); };
  const key = e => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', key);
  bg.addEventListener('mousedown', e => { if (e.target === bg) close(); });
  bg.querySelector('[data-x]').onclick = close;
  const mf = bg.querySelector('.mf');
  for (const a of actions) { const b = document.createElement('button'); b.className = 'btn ' + (a.cls || ''); b.textContent = a.label; b.onclick = async () => { if (a.onClick) { const r = await a.onClick(bg.querySelector('.modal'), close); if (r === false) return; } close(); }; mf.appendChild(b); }
  if (!actions.length) mf.remove();
  document.body.appendChild(bg);
  onOpen && onOpen(bg.querySelector('.modal'), close);
  return { el: bg.querySelector('.modal'), close };
}
export function confirmBox(msg) { return new Promise(res => modal({ title: 'Onay', body: `<p>${esc(msg)}</p>`, actions: [{ label: 'Vazgeç', onClick: () => res(false) }, { label: 'Evet', cls: 'pri', onClick: () => res(true) }] })); }

// ---------- etiket (pill) ----------
export const pill = (name, color) => `<span class="pill" style="background:${esc(color || '#777')}">${esc(trUpper(name))}</span>`;
export const srcById = id => S.boot.sources.find(s => s.id === Number(id));
export const payById = id => S.boot.payments.find(s => s.id === Number(id));
export const repById = id => (S.boot.reps || []).find(s => s.id === Number(id));
export const brandById = id => S.boot.brands.find(b => b.id === id);

// ---------- katalog araması ----------
export async function loadCatalog(force) {
  if (S.catalog && !force) return S.catalog;
  const prods = await api('/catalog');
  S.catalog = prods;
  S.catIndex = [];
  for (const p of prods) {
    if (!p.active) continue;
    for (const v of p.variants) if (v.active) S.catIndex.push({ ...v, p, text: shortName(p, v, { withTpi: true }), f: fold(`${p.name} ${p.mfr} ${p.category} ${p.subcategory} ${v.label} ${v.label.replace(/[^\d,.]+/g, ' ')}`).replace(/,/g, '.').replace(/[×*]/g, 'x') });
  }
  return prods;
}
export function searchCatalog(q, limit = 30) {
  const f = fold(q).replace(/[×*]/g, 'x').replace(/,/g, '.').trim(); if (!f) return S.catIndex.slice(0, limit);
  const toks = f.split(/[\s x/]+/).filter(Boolean);
  const out = [];
  for (const v of S.catIndex) { let ok = true; for (const t of toks) if (!v.f.includes(t)) { ok = false; break; } if (ok) out.push(v); if (out.length >= limit) break; }
  return out;
}
export const variantById = id => S.catIndex && S.catIndex.find(v => v.id === Number(id));

// Otomatik tamamlama: input + liste. getItems(q) => [{html, value, group?}] (async olabilir)
export function autocomplete(input, getItems, onPick, { minLen = 0 } = {}) {
  const wrap = input.closest('.ac') || input.parentElement; wrap.classList.add('ac');
  let list = null, items = [], act = -1, tmr = null;
  const close = () => { list && list.remove(); list = null; act = -1; };
  const render = () => {
    if (!list) { list = document.createElement('div'); list.className = 'ac-list'; wrap.appendChild(list); }
    if (!items.length) { list.innerHTML = '<div class="opt muted">Sonuç yok</div>'; return; }
    let g = null; list.innerHTML = items.map((it, i) => { const head = it.group && it.group !== g ? `<div class="grp">${esc(g = it.group)}</div>` : ''; return head + `<div class="opt ${i === act ? 'act' : ''}" data-i="${i}">${it.html}</div>`; }).join('');
    list.onmousedown = e => { const o = e.target.closest('.opt[data-i]'); if (!o) return; e.preventDefault(); onPick(items[+o.dataset.i]); close(); };
  };
  const refresh = async () => { if (input.value.length < minLen) return close(); items = await getItems(input.value); act = -1; render(); };
  input.addEventListener('input', () => { clearTimeout(tmr); tmr = setTimeout(refresh, 120); });
  input.addEventListener('focus', () => { if (input.value.length >= minLen) refresh(); });
  input.addEventListener('blur', () => setTimeout(close, 150));
  input.addEventListener('keydown', e => {
    if (!list) return;
    if (e.key === 'ArrowDown') { act = Math.min(items.length - 1, act + 1); render(); e.preventDefault(); }
    else if (e.key === 'ArrowUp') { act = Math.max(0, act - 1); render(); e.preventDefault(); }
    else if (e.key === 'Enter' && act >= 0) { onPick(items[act]); close(); e.preventDefault(); }
    else if (e.key === 'Escape') close();
  });
}

// Kaynak / ödeme etiketi seçici (Paraşüt "Fatura Kategorisi" tarzı)
export function tagPicker(el, { kind, value, onChange, flag = false }) {
  const LIST = { source: () => S.boot.sources, payment: () => S.boot.payments, rep: () => S.boot.reps || [] };
  const EP = { source: '/sources', payment: '/payments', rep: '/reps' };
  const LBL = { source: 'KAYNAK SEÇİN', payment: 'ÖDEME SEÇİN', rep: 'TEMSİLCİ SEÇİN' };
  const list = () => LIST[kind]().filter(x => x.active || x.id === Number(value));
  const draw = () => {
    const cur = list().find(x => x.id === Number(value));
    el.className = 'picker';
    el.innerHTML = `<div class="cur ${flag && !cur ? 'flag' : ''}" tabindex="0">${cur ? pill(cur.name, cur.color) : `<span class="pill out">${LBL[kind]}</span>`}<span class="muted">▾</span></div>`;
    el.querySelector('.cur').onclick = open;
  };
  const open = () => {
    if (el.querySelector('.menu')) return;
    const m = document.createElement('div'); m.className = 'menu';
    m.innerHTML = `<input class="in sm" placeholder="Ara">` + `<div class="opts"></div><div class="o" data-new>${pill('YENİ EKLE', 'var(--surface-3)')}</div><div class="hint">${kind === 'source' ? 'Siparişin geldiği yer.' : kind === 'rep' ? 'Satışı yapan temsilci (müşteri değil).' : 'Ödeme yöntemi.'} Ayarlar › Kaynak, Ödeme ve Temsilciler'den düzenlenir.</div>`;
    const opts = m.querySelector('.opts');
    const fill = q => { opts.innerHTML = `<div class="o" data-id="">${'<span class="pill out">BELİRSİZ</span>'}</div>` + list().filter(x => fold(x.name).includes(fold(q))).map(x => `<div class="o" data-id="${x.id}">${pill(x.name, x.color)}</div>`).join(''); };
    fill('');
    el.appendChild(m);
    const inp = m.querySelector('input'); inp.focus(); inp.oninput = () => fill(inp.value);
    m.onclick = async e => {
      const o = e.target.closest('.o'); if (!o) return;
      if (o.hasAttribute('data-new')) {
        const name = inp.value.trim() || prompt({ source: 'Yeni kaynak adı', payment: 'Yeni ödeme yöntemi adı', rep: 'Yeni satış temsilcisi adı' }[kind]); if (!name) return;
        const colors = ['#e8590c', '#0ca678', '#7048e8', '#1c7ed6', '#d6336c', '#f08c00'];
        const r = await api.post(EP[kind], { name, color: colors[Math.floor(Math.random() * colors.length)] });
        const b = await api('/bootstrap'); S.boot.sources = b.sources; S.boot.payments = b.payments; S.boot.reps = b.reps;
        value = r.id;
      } else value = o.dataset.id ? Number(o.dataset.id) : null;
      onChange(value); close(); draw();
    };
    const close = () => { m.remove(); document.removeEventListener('mousedown', out); };
    const out = e => { if (!el.contains(e.target)) close(); };
    setTimeout(() => document.addEventListener('mousedown', out));
  };
  draw();
  return { set: v => { value = v; draw(); } };
}

// İl / ilçe seçici (arama yapılabilir)
export function ilIlce(ilInput, ilceInput) {
  const D = globalThis.IL_ILCE || {};
  autocomplete(ilInput, q => Object.keys(D).filter(x => fold(x).startsWith(fold(q)) || fold(x).includes(fold(q))).slice(0, 12).map(x => ({ html: esc(x), value: x })), it => { ilInput.value = it.value; ilInput.dispatchEvent(new Event('change', { bubbles: true })); ilceInput.focus(); });
  autocomplete(ilceInput, q => { const il = matchIl(ilInput.value); const list = il ? D[il] : Object.entries(D).flatMap(([k, v]) => v.filter(x => x !== 'Merkez').map(x => x + ' / ' + k)); return list.filter(x => fold(x).includes(fold(q))).slice(0, 14).map(x => ({ html: esc(x), value: x })); }, it => {
    if (it.value.includes(' / ')) { const [a, b] = it.value.split(' / '); ilceInput.value = a; ilInput.value = b; ilInput.dispatchEvent(new Event('change', { bubbles: true })); } else ilceInput.value = it.value;
    ilceInput.dispatchEvent(new Event('change', { bubbles: true }));
  });
}
export function matchIl(v) { const D = globalThis.IL_ILCE || {}; return Object.keys(D).find(x => fold(x) === fold(v)) || null; }
export function matchIlce(il, v) { const D = globalThis.IL_ILCE || {}; const k = matchIl(il); return k ? (D[k].find(x => fold(x) === fold(v)) || null) : null; }

// ---------- tarih aralığı ----------
export function rangePreset(key) {
  const t = new Date(today() + 'T12:00:00'); const iso = d => new Date(d - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10);
  const y = t.getFullYear(), m = t.getMonth();
  switch (key) {
    case 'today': return [iso(t), iso(t)];
    case 'week': { const d = new Date(t); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return [iso(d), iso(t)]; }
    case 'month': return [iso(new Date(y, m, 1, 12)), iso(t)];
    case 'lastmonth': return [iso(new Date(y, m - 1, 1, 12)), iso(new Date(y, m, 0, 12))];
    case '90': { const d = new Date(t); d.setDate(d.getDate() - 89); return [iso(d), iso(t)]; }
    case 'year': return [iso(new Date(y, 0, 1, 12)), iso(t)];
    case 'all': return ['2000-01-01', iso(t)];
  }
  return [iso(new Date(y, m, 1, 12)), iso(t)];
}

// ---------- grafikler (bağımlılıksız SVG) ----------
export const PALETTE = ['var(--c1)', 'var(--c2)', 'var(--c3)', 'var(--c4)', 'var(--c5)', 'var(--c6)', 'var(--c7)', 'var(--c8)'];
export function donut(data, { size = 170, onClick } = {}) { // data: [{label, value, color}]
  const tot = data.reduce((a, d) => a + d.value, 0) || 1; const r = 70, cx = 85, cy = 85, sw = 26;
  let a0 = -Math.PI / 2; const C = 2 * Math.PI * r;
  const segs = data.filter(d => d.value > 0).map((d, i) => { const frac = d.value / tot; const len = frac * C; const s = `<circle class="slice" data-k="${esc(d.key ?? d.label)}" cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${d.color}" stroke-width="${sw}" stroke-dasharray="${len} ${C - len}" stroke-dashoffset="${-(a0 + Math.PI / 2) / (2 * Math.PI) * C}" transform="rotate(-90 ${cx} ${cy})"><title>${esc(d.label)}: ${money(d.value)} (${pct(frac)})</title></circle>`; a0 += frac * 2 * Math.PI; return s; }).join('');
  return `<div class="chart" style="max-width:${size}px;margin:0 auto"><svg viewBox="0 0 170 170">${segs || `<circle cx="85" cy="85" r="70" fill="none" stroke="var(--surface-3)" stroke-width="26"/>`}</svg></div>`;
}
export function legend(data, { valueFmt = money, extra } = {}) {
  const tot = data.reduce((a, d) => a + d.value, 0) || 1;
  return `<div class="legend">${data.map(d => `<div class="li" data-k="${esc(d.key ?? d.label)}"><span class="sw" style="background:${d.color}"></span><span>${esc(d.label)}${extra ? ` <span class="muted small">${extra(d)}</span>` : ''}</span><span class="muted small">${pct(d.value / tot)}</span><span class="money">${valueFmt(d.value)}</span></div>`).join('')}</div>`;
}
export function hbars(rows, { fmt = money, color = 'var(--accent)', max } = {}) { // [{label, value, key, sub}]
  const mx = max || Math.max(1, ...rows.map(r => r.value));
  if (!rows.length) return '<div class="empty">Veri yok</div>';
  return `<div class="hbars">${rows.map(r => `<div class="hbar" data-k="${esc(r.key ?? r.label)}" title="${esc(r.label)}"><span class="nm">${esc(r.label)}${r.sub ? ` <span class="muted small">${esc(r.sub)}</span>` : ''}</span><div class="tr"><div class="fl" style="width:${(r.value / mx * 100).toFixed(1)}%;background:${r.color || color}"></div></div><span class="vv">${fmt(r.value)}</span></div>`).join('')}</div>`;
}
export function vbars(labels, series, { h = 220, fmt = short, stacked = false } = {}) { // series: [{name, color, values}]
  const W = 720, pad = { l: 46, r: 8, t: 10, b: 26 }; const n = labels.length || 1;
  const max = Math.max(1, ...labels.map((_, i) => stacked ? series.reduce((a, s) => a + (s.values[i] || 0), 0) : Math.max(...series.map(s => s.values[i] || 0))));
  const ih = h - pad.t - pad.b, iw = W - pad.l - pad.r, bw = iw / n; const grid = [0, .25, .5, .75, 1];
  let out = grid.map(g => `<line class="grid" x1="${pad.l}" x2="${W - pad.r}" y1="${pad.t + ih * (1 - g)}" y2="${pad.t + ih * (1 - g)}"/><text x="${pad.l - 6}" y="${pad.t + ih * (1 - g) + 4}" text-anchor="end">${fmt(max * g)}</text>`).join('');
  const every = Math.ceil(n / 14);
  labels.forEach((lb, i) => {
    const x0 = pad.l + i * bw; let acc = 0;
    const inner = stacked ? bw * .7 : bw * .78 / series.length;
    series.forEach((s, j) => {
      const v = s.values[i] || 0; const bh = v / max * ih;
      const x = stacked ? x0 + bw * .15 : x0 + bw * .11 + j * inner; const y = pad.t + ih - bh - (stacked ? acc / max * ih : 0);
      out += `<rect class="bar" x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${Math.max(1, inner - 1.5).toFixed(1)}" height="${Math.max(0, bh).toFixed(1)}" rx="3" fill="${s.color}"><title>${esc(lb)} · ${esc(s.name)}: ${money(v)}</title></rect>`;
      if (stacked) acc += v;
    });
    if (i % every === 0) out += `<text x="${(x0 + bw / 2).toFixed(1)}" y="${h - 8}" text-anchor="middle">${esc(lb)}</text>`;
  });
  return `<div class="chart"><svg viewBox="0 0 ${W} ${h}" preserveAspectRatio="none" style="height:${h}px">${out}</svg></div>`;
}
export function lines(labels, series, { h = 230, fmt = short } = {}) {
  const W = 720, pad = { l: 46, r: 10, t: 12, b: 26 }; const n = Math.max(2, labels.length);
  const max = Math.max(1, ...series.flatMap(s => s.values));
  const ih = h - pad.t - pad.b, iw = W - pad.l - pad.r; const X = i => pad.l + iw * i / (n - 1), Y = v => pad.t + ih * (1 - v / max);
  let out = [0, .25, .5, .75, 1].map(g => `<line class="grid" x1="${pad.l}" x2="${W - pad.r}" y1="${Y(max * g)}" y2="${Y(max * g)}"/><text x="${pad.l - 6}" y="${Y(max * g) + 4}" text-anchor="end">${fmt(max * g)}</text>`).join('');
  series.forEach(s => {
    const pts = s.values.map((v, i) => `${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join(' ');
    if (s.fill) out += `<polygon points="${X(0)},${Y(0)} ${pts} ${X(s.values.length - 1)},${Y(0)}" fill="${s.color}" opacity=".12"/>`;
    out += `<polyline points="${pts}" fill="none" stroke="${s.color}" stroke-width="2.2" ${s.dash ? 'stroke-dasharray="5 5"' : ''} stroke-linejoin="round"/>`;
    s.values.forEach((v, i) => { out += `<circle cx="${X(i).toFixed(1)}" cy="${Y(v).toFixed(1)}" r="${labels.length > 40 ? 0 : 3}" fill="${s.color}"><title>${esc(labels[i] || '')} · ${esc(s.name)}: ${money(v)}</title></circle>`; });
  });
  const every = Math.ceil(labels.length / 12);
  labels.forEach((lb, i) => { if (i % every === 0) out += `<text x="${X(i).toFixed(1)}" y="${h - 8}" text-anchor="middle">${esc(lb)}</text>`; });
  return `<div class="chart"><svg viewBox="0 0 ${W} ${h}" preserveAspectRatio="none" style="height:${h}px">${out}</svg></div>`;
}

// ---------- dışa aktarma ----------
function dl(name, blob) { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500); }
const cell = v => typeof v === 'number' ? String(Math.round(v * 100) / 100).replace('.', ',') : `"${String(v ?? '').replace(/"/g, '""')}"`;
export function exportCSV(name, headers, rows) { // Excel (Türkçe) uyumlu: UTF-8 BOM + ; ayırıcı
  const s = '﻿' + [headers, ...rows].map(r => r.map(cell).join(';')).join('\r\n');
  dl(name.endsWith('.csv') ? name : name + '.csv', new Blob([s], { type: 'text/csv;charset=utf-8' }));
}
export function exportXLS(name, sheets) { // sheets: [{name, headers, rows}] — Excel 2003 XML (çok sayfalı)
  const x = v => String(v ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const row = r => '<Row>' + r.map(v => typeof v === 'number' ? `<Cell><Data ss:Type="Number">${v}</Data></Cell>` : `<Cell><Data ss:Type="String">${x(v)}</Data></Cell>`).join('') + '</Row>';
  const body = sheets.map(s => `<Worksheet ss:Name="${x(s.name.slice(0, 30).replace(/[\\/?*[\]:]/g, ' '))}"><Table>${row(s.headers).replace(/<Cell>/g, '<Cell ss:StyleID="h">')}${s.rows.map(row).join('')}</Table></Worksheet>`).join('');
  const xml = `<?xml version="1.0" encoding="UTF-8"?><?mso-application progid="Excel.Sheet"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Styles><Style ss:ID="h"><Font ss:Bold="1"/></Style></Styles>${body}</Workbook>`;
  dl(name.endsWith('.xls') ? name : name + '.xls', new Blob([xml], { type: 'application/vnd.ms-excel' }));
}

// Görseli küçültüp dataURL'e çevirir (yükleme boyutunu düşürür)
export function shrinkImage(file, max = 1600, q = .85) {
  return new Promise((res, rej) => {
    const fr = new FileReader();
    fr.onload = () => { const img = new Image(); img.onload = () => { const r = Math.min(1, max / Math.max(img.width, img.height)); const c = document.createElement('canvas'); c.width = Math.round(img.width * r); c.height = Math.round(img.height * r); const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(img, 0, 0, c.width, c.height); res(c.toDataURL('image/jpeg', q)); }; img.onerror = rej; img.src = fr.result; };
    fr.onerror = rej; fr.readAsDataURL(file);
  });
}
