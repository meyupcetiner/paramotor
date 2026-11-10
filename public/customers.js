// Müşteriler: Paraşüt listesi + güçlü filtre / segment paneli + müşteri detay
import { S, api, esc, $, $$, icon, toast, money, moneyHtml, int, dmy, today, parseNum, phoneFmt, phoneNorm, waLink, pill, srcById, payById, loadCatalog, searchCatalog, autocomplete, ilIlce, modal, confirmBox, exportCSV, exportXLS, hbars, fold } from './core.js';
import { setTitle } from './app.js';

const SEG_COLORS = { 'Yeni': 'var(--c2)', 'Sadık': 'var(--c1)', 'Tekrar Potansiyeli Yüksek': 'var(--c3)', 'Riskli / Uykuda': 'var(--danger)', 'Tek Seferlik': 'var(--c8)', 'Aktif': 'var(--c6)', 'Sipariş yok': 'var(--line-2)' };
const segPill = s => `<span class="pill" style="background:${SEG_COLORS[s] || '#777'};color:#111">${esc(s)}</span>`;
const KEYS = ['q', 'il', 'ilce', 'min_total', 'max_total', 'threshold', 'threshold_dir', 'min_basket', 'orders', 'segment', 'source', 'payment', 'product', 'category', 'first_from', 'first_to', 'last_from', 'last_to', 'official', 'sort', 'dir'];

const brandPill = id => { const x = S.boot.brands.find(b => b.id === id); return x ? `<span class="pill" style="background:${x.color};color:#fff">${esc(x.name)}</span>` : ''; };
export async function customersPage(ctx) {
  const { el, query } = ctx; const brand = ctx.brand || 'all', base = ctx.base, gen = !ctx.brand;
  setTitle('Müşteriler');
  await loadCatalog();
  const qs = new URLSearchParams(); for (const k of KEYS) if (query.get(k)) qs.set(k, query.get(k)); qs.set('brand', brand);
  const [d, saved] = await Promise.all([api('/customers?' + qs), api('/segments?brand=' + brand)]);
  const page = Number(query.get('page') || 1), per = 25, pages = Math.max(1, Math.ceil(d.customers.length / per));
  const multi = k => (query.get(k) || '').split(',').filter(Boolean);
  const activeN = KEYS.filter(k => !['q', 'sort', 'dir', 'threshold_dir'].includes(k) && query.get(k)).length;
  const prod = query.get('product') ? S.catalog.find(p => p.id === Number(query.get('product'))) : null;
  const help = S.boot.segmentHelp || {};
  const cats = Object.entries(S.boot.categories).flatMap(([c, subs]) => subs.map(s => `${c} / ${s}`));
  const sortTh = (k, label, cls = '') => `<th class="sortable ${cls}" data-sort="${k}">${label}${(query.get('sort') || 'total') === k ? (query.get('dir') === 'asc' ? ' ↑' : ' ↓') : ''}</th>`;
  el.innerHTML = `
  <div class="toolbar"><div class="searchbar"><button class="fbtn ${activeN ? 'on' : ''}" id="fb">${icon('filter')} Filtrele${activeN ? ` (${activeN})` : ''} ▾</button><input id="q" placeholder="Ara… (ad, telefon, unvan veya #reklam, #bileme)" value="${esc(query.get('q') || '')}">${icon('search')}</div>
    <select class="in" id="saved" style="width:auto;height:46px;border-radius:999px"><option value="">Kayıtlı segmentler</option>${saved.map(s => `<option value="${s.id}">${esc(s.name)}</option>`).join('')}</select></div>
  <div class="card ${activeN || query.get('open') ? '' : 'hidden'}" id="fp">
    <div class="filters">
      <div class="field"><span>İl (virgülle çoklu)</span><input class="in sm" data-f="il" value="${esc(query.get('il') || '')}" placeholder="İstanbul, Bursa"></div>
      <div class="field"><span>İlçe</span><input class="in sm" data-f="ilce" value="${esc(query.get('ilce') || '')}"></div>
      <div class="field"><span>Toplam sipariş tutarı (min – max ₺)</span><div class="row"><input class="in sm" data-f="min_total" inputmode="decimal" value="${esc(query.get('min_total') || '')}" placeholder="min"><input class="in sm" data-f="max_total" inputmode="decimal" value="${esc(query.get('max_total') || '')}" placeholder="max"></div></div>
      <div class="field"><span>Barem (eşik tutar)</span><div class="row"><input class="in sm" data-f="threshold" inputmode="decimal" value="${esc(query.get('threshold') || '')}" placeholder="ör. 5000"><select class="in sm" data-f="threshold_dir" style="width:110px"><option value="above">üzerinde</option><option value="below" ${query.get('threshold_dir') === 'below' ? 'selected' : ''}>altında</option></select></div></div>
      <div class="field"><span>Ortalama sepet (min ₺)</span><input class="in sm" data-f="min_basket" inputmode="decimal" value="${esc(query.get('min_basket') || '')}"></div>
      <div class="field"><span>Sipariş sayısı</span><div class="chips">${['1', '2', '3', '4+'].map(n => `<button class="chip ${multi('orders').includes(n) ? 'on' : ''}" data-m="orders" data-v="${n}">${n === '1' ? 'Tek sipariş' : n === '4+' ? '4 ve üzeri' : n + '. sipariş'}</button>`).join('')}</div></div>
      <div class="field"><span>Kaynak</span><div class="chips">${S.boot.sources.map(s => `<button class="chip ${multi('source').includes(String(s.id)) ? 'on' : ''}" data-m="source" data-v="${s.id}">${esc(s.name)}</button>`).join('')}</div></div>
      <div class="field"><span>Ödeme yöntemi</span><div class="chips">${S.boot.payments.map(s => `<button class="chip ${multi('payment').includes(String(s.id)) ? 'on' : ''}" data-m="payment" data-v="${s.id}">${esc(s.name)}</button>`).join('')}</div></div>
      <div class="field"><span>Şu ürünü almış olanlar</span><div class="ac"><input class="in sm" id="prodq" value="${esc(prod ? prod.name : '')}" placeholder="Ürün ara"></div></div>
      <div class="field"><span>Kategori almış olanlar</span><select class="in sm" data-f="category"><option value="">Tümü</option>${cats.map(c => `<option ${query.get('category') === c ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select></div>
      <div class="field span2"><span>İlk sipariş tarihi <small>(başlangıç – bitiş)</small></span><div class="daterange"><input class="in sm" type="date" data-f="first_from" value="${esc(query.get('first_from') || '')}" title="Başlangıç"><b>–</b><input class="in sm" type="date" data-f="first_to" value="${esc(query.get('first_to') || '')}" title="Bitiş"></div></div>
      <div class="field span2"><span>Son sipariş tarihi <small>(başlangıç – bitiş)</small></span><div class="daterange"><input class="in sm" type="date" data-f="last_from" value="${esc(query.get('last_from') || '')}" title="Başlangıç"><b>–</b><input class="in sm" type="date" data-f="last_to" value="${esc(query.get('last_to') || '')}" title="Bitiş"></div></div>
      <div class="field"><span>Resmi / gayriresmi</span><select class="in sm" data-f="official"><option value="">Tümü</option><option value="1" ${query.get('official') === '1' ? 'selected' : ''}>Resmi bilgisi olanlar</option><option value="0" ${query.get('official') === '0' ? 'selected' : ''}>Gayriresmi</option></select></div>
    </div>
    <div class="row wrap" style="padding:0 16px 14px"><button class="btn sm" id="savef">${icon('tag')} Filtreyi segment olarak kaydet</button>${query.get('seg_id') ? `<button class="btn sm danger" id="delseg">Bu kayıtlı segmenti sil</button>` : ''}<span class="sp"></span><button class="btn sm" id="clr">Filtreleri temizle</button><button class="btn sm pri" id="applyf">${icon('check')} Filtreleri uygula</button></div>
  </div>
  <div class="card"><div class="hd"><h3>Otomatik segmentler</h3><span class="sp"></span><button class="btn sm ghost" id="hl">Nasıl hesaplanır?</button></div><div class="bd"><div class="chips">${Object.keys(SEG_COLORS).filter(s => s !== 'Sipariş yok' || d.segments[s]).map(s => `<button class="chip ${multi('segment').includes(s) ? 'on' : ''}" data-m="segment" data-v="${esc(s)}" title="${esc(help[s] || '')}"><span class="sw" style="width:8px;height:8px;border-radius:2px;background:${SEG_COLORS[s]}"></span>${esc(s)} <span class="n">${int(d.segments[s] || 0)}</span></button>`).join('')}</div>
    <div class="helpbox hidden" id="hb" style="margin-top:12px">${Object.entries(help).map(([k, v]) => `<div style="margin:3px 0"><b>${esc(k)}:</b> ${esc(v)}</div>`).join('')}<div class="muted small" style="margin-top:6px">Eşikler Ayarlar › Segment kuralları'ndan değiştirilebilir. Sıra: Yeni → Riskli/Uykuda → Sadık → Tekrar potansiyeli → Tek seferlik → Aktif.</div></div></div></div>
  <div class="rgrid"><div class="card c8"><div class="hd"><h3>İl bazında müşteri ve ciro</h3><span class="sp"></span><span class="muted small">Tıklayınca filtreler</span></div><div class="bd" id="ilbars"></div></div>
    <div class="card c4 kpi"><div class="t">Filtrelenen müşteri</div><div class="v">${int(d.summary.count)}</div><div class="d muted">${int(d.summary.orders)} sipariş · ${money(d.summary.total)}</div><div class="d muted">Ortalama müşteri değeri: ${money(d.summary.count ? d.summary.total / d.summary.count : 0)}</div>
      <div class="row wrap" style="margin-top:14px"><button class="btn sm" id="xcsv">${icon('download')} CSV</button><button class="btn sm" id="xxls">${icon('download')} Excel</button><button class="btn sm" id="cp">${icon('copy')} Telefonları kopyala</button></div></div></div>
  <div class="tbl-wrap"><table class="tbl list"><thead><tr>${sortTh('name', 'Unvanı')}<th>Konum</th>${sortTh('order_count', 'Sipariş', 'r')}${sortTh('last_order', 'Son sipariş')}${sortTh('avg_basket', 'Ort. sepet', 'r')}${sortTh('total', 'Toplam sipariş', 'r')}</tr></thead><tbody>
  ${d.customers.slice((page - 1) * per, page * per).map(c => { const s = srcById(c.main_source); return `<tr class="click" data-id="${c.id}"><td><div class="row" style="gap:12px"><span class="avatar" style="width:40px;height:40px;flex:none">${icon(c.is_official ? 'building' : 'user')}</span><div><div class="t-title">${esc(c.name || '—')}</div><div class="t-sub">${esc(phoneFmt(c.phone))}</div><div class="tags">${segPill(c.segment)}${s ? pill(s.name, s.color) : ''}${c.is_official ? '<span class="pill soft">RESMİ</span>' : ''}${gen ? (c.brand_ids || [c.brand_id]).map(brandPill).join('') : ''}</div></div></div></td>
    <td class="t-sub">${esc([c.ilce, c.il].filter(Boolean).join(' / ') || '—')}</td><td class="r">${int(c.order_count)}</td><td>${dmy(c.last_order)}${c.days_since != null ? `<div class="t-sub">${c.days_since} gün önce</div>` : ''}</td><td class="r">${moneyHtml(c.avg_basket)}</td><td class="r">${moneyHtml(c.total)}</td></tr>`; }).join('') || '<tr><td colspan="6"><div class="empty">Müşteri bulunamadı. Müşteriler satış girildikçe telefon numarasına göre otomatik oluşur.</div></td></tr>'}
  </tbody></table></div>
  <div class="footbar"><div class="pager"><button data-pg="${page - 1}" ${page <= 1 ? 'disabled' : ''}>‹</button><button class="on">${page} / ${pages}</button><button data-pg="${page + 1}" ${page >= pages ? 'disabled' : ''}>›</button></div><span class="sp"></span><span class="sumtext">${int(d.summary.count)} Kayıt &nbsp; Toplam sipariş <b>${money(d.summary.total)}</b></span></div>`;

  const ils = Object.entries(d.byIl).sort((a, b) => b[1].total - a[1].total).slice(0, 12);
  $('#ilbars', el).innerHTML = hbars(ils.map(([k, v]) => ({ label: k, value: v.total, sub: `${v.customers} müşteri`, key: k })));
  $$('#ilbars .hbar', el).forEach(b => b.onclick = () => setQ('il', b.dataset.k === 'Belirtilmemiş' ? '' : b.dataset.k));

  function setQ(k, v) { const q = new URLSearchParams(query); if (v) q.set(k, v); else q.delete(k); q.delete('page'); q.delete('seg_id'); location.hash = `${base}musteriler?${q}`; }
  $('#fb', el).onclick = () => $('#fp', el).classList.toggle('hidden');
  $('#hl', el).onclick = () => $('#hb', el).classList.toggle('hidden');
  let tm; $('#q', el).oninput = e => { clearTimeout(tm); tm = setTimeout(() => setQ('q', e.target.value.trim()), 350); };
  // filtre paneli: seçimler biriktirilir, "Filtreleri uygula" (ya da Enter) ile uygulanır
  const pend = new URLSearchParams(query); pend.delete('page'); pend.delete('seg_id');
  const pset = (k, v) => { if (v) pend.set(k, v); else pend.delete(k); $('#applyf', el).classList.add('pulse'); };
  const applyF = () => { location.hash = `${base}musteriler?${pend}`; };
  $$('#fp [data-f]', el).forEach(i => { i.onchange = () => pset(i.dataset.f, i.value.trim()); i.onkeydown = e => { if (e.key === 'Enter') { pset(i.dataset.f, i.value.trim()); applyF(); } }; });
  $$('#fp [data-m]', el).forEach(b => b.onclick = () => { const k = b.dataset.m, v = b.dataset.v; const cur = (pend.get(k) || '').split(',').filter(Boolean); const n = cur.includes(v) ? cur.filter(x => x !== v) : [...cur, v]; b.classList.toggle('on', !cur.includes(v)); pset(k, n.join(',')); });
  $('#applyf', el).onclick = () => { $$('#fp [data-f]', el).forEach(i => pset(i.dataset.f, i.value.trim())); applyF(); };
  $$('[data-f]:not(#fp [data-f])', el).forEach(i => i.onchange = () => setQ(i.dataset.f, i.value.trim()));
  $$('[data-m]:not(#fp [data-m])', el).forEach(b => b.onclick = () => { const k = b.dataset.m, v = b.dataset.v; const cur = multi(k); const n = cur.includes(v) ? cur.filter(x => x !== v) : [...cur, v]; setQ(k, n.join(',')); });
  $$('[data-sort]', el).forEach(th => th.onclick = () => { const q = new URLSearchParams(query); const k = th.dataset.sort; q.set('dir', q.get('sort') === k && q.get('dir') !== 'asc' ? 'asc' : 'desc'); q.set('sort', k); location.hash = `${base}musteriler?${q}`; });
  $$('[data-pg]', el).forEach(b => b.onclick = () => { const q = new URLSearchParams(query); q.set('page', b.dataset.pg); location.hash = `${base}musteriler?${q}`; });
  $$('tr[data-id]', el).forEach(tr => tr.onclick = () => { location.hash = `${base}musteri/${tr.dataset.id}`; });
  $('#clr', el).onclick = () => { location.hash = `${base}musteriler`; };
  const pq = $('#prodq', el);
  autocomplete(pq, q => { const seen = new Set(); return searchCatalog(q, 80).filter(v => !seen.has(v.p.id) && seen.add(v.p.id)).slice(0, 15).map(v => ({ html: `<b>${esc(v.p.name)}</b> <small>${esc(v.p.subcategory)}</small>`, v })); }, it => setQ('product', it.v.p.id));
  pq.onchange = () => { if (!pq.value.trim()) setQ('product', ''); };
  $('#saved', el).onchange = e => { const s = saved.find(x => x.id === Number(e.target.value)); if (!s) return; const q = new URLSearchParams(JSON.parse(s.filters || '{}')); q.set('seg_id', s.id); location.hash = `${base}musteriler?${q}`; };
  if (query.get('seg_id')) { const s = saved.find(x => x.id === Number(query.get('seg_id'))); if (s) $('#saved', el).value = s.id; }
  $('#savef', el).onclick = async () => { const name = prompt('Segment adı (ör. "İstanbul 5000₺ üstü tek siparişliler")'); if (!name) return; const f = {}; for (const k of KEYS) if (query.get(k)) f[k] = query.get(k); await api.post('/segments', { brand_id: brand, name, filters: f }); toast('Segment kaydedildi'); customersPage(ctx); };
  $('#delseg', el)?.addEventListener('click', async () => { if (!(await confirmBox('Kayıtlı segment silinsin mi?'))) return; await api.del('/segments/' + query.get('seg_id')); location.hash = `${base}musteriler`; });
  const H = ['Ad Soyad', 'Telefon', 'İl', 'İlçe', 'Adres', 'Segment', 'Sipariş sayısı', 'İlk sipariş', 'Son sipariş', 'Son siparişten beri (gün)', 'Ort. sipariş aralığı (gün)', 'Ortalama sepet', 'Toplam', 'Ana kaynak', 'Ana ödeme', 'En çok aldığı kategori', 'Resmi', 'VKN/TCKN', 'Resmi unvan'];
  const rows = () => d.customers.map(c => [c.name || '', phoneFmt(c.phone), c.il || '', c.ilce || '', c.address || '', c.segment, c.order_count, dmy(c.first_order), dmy(c.last_order), c.days_since ?? '', c.avg_gap ?? '', c.avg_basket, c.total, (srcById(c.main_source) || {}).name || '', (payById(c.main_payment) || {}).name || '', c.top_category || '', c.is_official ? 'Evet' : 'Hayır', c.tax_no || '', c.official_title || '']);
  $('#xcsv', el).onclick = () => exportCSV(`musteriler-${brand}-${today()}`, H, rows());
  $('#xxls', el).onclick = () => exportXLS(`musteriler-${brand}-${today()}`, [{ name: 'Müşteriler', headers: H, rows: rows() }]);
  $('#cp', el).onclick = async () => { const list = [...new Set(d.customers.map(c => phoneNorm(c.phone)).filter(Boolean))]; const txt = list.map(p => '+90' + p.slice(1)).join('\n'); try { await navigator.clipboard.writeText(txt); toast(`${list.length} telefon kopyalandı`); } catch { modal({ title: 'Telefon listesi', body: `<textarea class="in" rows="12">${esc(txt)}</textarea>` }); } };
}

export async function customerDetail(ctx, id) {
  const { el } = ctx; const base = ctx.base;
  const d = await api('/customers/' + id + (ctx.brand ? '' : '?all=1')); const c = d.customer;
  setTitle(`<span class="crumb"><a href="${base}${c.archived ? 'arsiv' : 'musteriler'}">${c.archived ? 'Arşiv' : 'Müşteriler'}</a> › </span>${esc(c.name || 'Müşteri')}${c.archived ? ' <span class="pill soft">ARŞİVDE</span>' : ''}`);
  const next = c.avg_gap && c.last_order ? (() => { const x = new Date(c.last_order + 'T12:00:00'); x.setDate(x.getDate() + c.avg_gap); return x.toISOString().slice(0, 10); })() : null;
  const wa = waLink(c.phone);
  el.innerHTML = `<div class="rgrid">
    <div class="card c4"><div class="hd"><h3>Müşteri bilgileri</h3><span class="sp"></span>${segPill(c.segment)}</div><form class="bd" id="cf" style="display:grid;gap:10px">
      <label class="field"><span>Ad Soyad</span><input class="in" name="name" value="${esc(c.name || '')}"></label>
      <label class="field"><span>Telefon</span><input class="in" name="phone" value="${esc(phoneFmt(c.phone))}"></label>
      <label class="field"><span>Adres</span><input class="in" name="address" value="${esc(c.address || '')}"></label>
      <div class="grid2"><label class="field"><span>İl</span><input class="in" name="il" value="${esc(c.il || '')}"></label><label class="field"><span>İlçe</span><input class="in" name="ilce" value="${esc(c.ilce || '')}"></label></div>
      <label class="chk small"><input type="checkbox" name="is_official" ${c.is_official ? 'checked' : ''}> Resmi satış bilgileri</label>
      <div class="grid2 ${c.is_official ? '' : 'hidden'}" id="off"><label class="field"><span>VKN / TCKN</span><input class="in" name="tax_no" value="${esc(c.tax_no || '')}"></label><label class="field"><span>Vergi dairesi</span><input class="in" name="tax_office" value="${esc(c.tax_office || '')}"></label><label class="field" style="grid-column:1/-1"><span>Resmi unvan</span><input class="in" name="official_title" value="${esc(c.official_title || '')}"></label></div>
      <label class="field"><span>Not</span><textarea class="in" name="note" rows="2">${esc(c.note || '')}</textarea></label>
      <div class="row wrap"><button class="btn pri sm">Kaydet</button>${wa ? `<a class="btn sm" href="${wa}" target="_blank" rel="noopener">${icon('phone')} WhatsApp</a>` : ''}<a class="btn sm" href="#/b/${c.brand_id}/fatura/yeni?customer=${id}" id="newinv">+ Yeni satış</a><button type="button" class="btn sm" id="arc">${c.archived ? 'Arşivden çıkar' : 'Arşivle'}</button><span class="sp"></span><button type="button" class="btn sm danger" id="del">${icon('trash')}</button></div>
    </form></div>
    <div class="c8" style="display:grid;gap:18px;align-content:start">
      <div class="grid4"><div class="card kpi"><div class="t">Toplam sipariş</div><div class="v">${money(c.total)}</div><div class="d muted">${int(c.order_count)} sipariş</div></div><div class="card kpi"><div class="t">Ortalama sepet</div><div class="v">${money(c.avg_basket)}</div></div><div class="card kpi"><div class="t">İlk / son sipariş</div><div class="v" style="font-size:18px">${dmy(c.first_order) || '—'}<br>${dmy(c.last_order) || '—'}</div></div><div class="card kpi"><div class="t">Tekrar sipariş eğilimi</div><div class="v" style="font-size:18px">${c.avg_gap ? `~${c.avg_gap} günde bir` : (c.order_count === 1 ? 'Tek sipariş' : '—')}</div><div class="d muted">${next ? `Beklenen sonraki: ${dmy(next)}` : ''}${c.days_since != null ? ` · son siparişten ${c.days_since} gün` : ''}</div></div></div>
      <div class="card"><div class="hd"><h3>Faturaları</h3></div><div class="tbl-wrap"><table class="tbl compact"><thead><tr><th>Tarih</th><th>Fatura no</th><th>Kaynak / ödeme</th><th class="r">Toplam</th></tr></thead><tbody>${d.invoices.map(i => { const s = srcById(i.source_id), p = payById(i.payment_id); return `<tr class="click" data-inv="${i.id}" data-b="${i.brand_id}"><td>${dmy(i.date)}</td><td>${esc(i.invoice_no || '')}${ctx.brand ? '' : `<div class="t-sub">${esc((S.boot.brands.find(b => b.id === i.brand_id) || {}).name || '')}</div>`}</td><td><div class="tags">${s ? pill(s.name, s.color) : ''}${p ? pill(p.name, p.color) : ''}</div></td><td class="r">${moneyHtml(i.total)}</td></tr>`; }).join('') || '<tr><td colspan="4" class="empty">Fatura yok</td></tr>'}</tbody></table></div></div>
      ${c.categories && Object.keys(c.categories).length ? `<div class="card"><div class="hd"><h3>En çok aldığı kategoriler</h3></div><div class="bd">${hbars(Object.entries(c.categories).sort((a, b) => b[1] - a[1]).map(([k, v]) => ({ label: k, value: v })), {})}</div></div>` : ''}
    </div></div>`;
  const f = $('#cf', el); ilIlce(f.il, f.ilce);
  f.is_official.onchange = () => $('#off', el).classList.toggle('hidden', !f.is_official.checked);
  f.onsubmit = async e => { e.preventDefault(); await api.put('/customers/' + id, { name: f.name.value, phone: f.phone.value, address: f.address.value, il: f.il.value, ilce: f.ilce.value, note: f.note.value, is_official: f.is_official.checked, tax_no: f.tax_no.value, tax_office: f.tax_office.value, official_title: f.official_title.value }); toast('Müşteri güncellendi'); };
  $('#del', el).onclick = async () => { if (!(await confirmBox('Müşteri silinsin mi? (Faturası olan müşteri silinemez.)'))) return; try { await api.del('/customers/' + id); location.hash = `${base}musteriler`; } catch (e) { toast(e.message, true); } };
  $$('[data-inv]', el).forEach(tr => tr.onclick = () => { location.hash = `#/b/${tr.dataset.b}/fatura/${tr.dataset.inv}`; });
  $('#arc', el).onclick = async () => { const on = !c.archived; if (on && !(await confirmBox('Müşteri ve tüm faturaları arşive taşınsın mı? Hiçbir rapora, listeye ve hesaplamaya dahil edilmez.'))) return; await api.post(`/customers/${id}/archive`, { archived: on }); toast(on ? 'Arşive taşındı' : 'Arşivden çıkarıldı'); location.hash = on ? `#/b/${c.brand_id}/arsiv` : `${base}musteri/${id}`; if (!on) customerDetail(ctx, id); };
}

// Arşiv: arşivlenen müşteriler ve faturaları burada bekler; hiçbir hesaplamaya girmez
export async function archivePage(ctx) {
  const { brand, el } = ctx;
  setTitle('Arşiv');
  const list = await api('/archive?brand=' + brand);
  el.innerHTML = `<p class="muted small" style="margin:0 0 14px">Arşivdeki müşterilerin faturaları satış listesine, raporlara, müşteri segmentlerine ve gelir-gidere dahil edilmez. Müşteriyi açıp "Arşivden çıkar" ile geri alabilirsin.</p>
  <div class="tbl-wrap"><table class="tbl list"><thead><tr><th>Unvanı</th><th>Konum</th><th class="r">Fatura</th><th>Tarih aralığı</th><th class="r">Toplam</th><th></th></tr></thead><tbody>
  ${list.map(c => `<tr class="click" data-id="${c.id}"><td><div class="t-title">${esc(c.name || '—')}</div><div class="t-sub">${esc(phoneFmt(c.phone))}</div></td><td class="t-sub">${esc([c.ilce, c.il].filter(Boolean).join(' / ') || '—')}</td><td class="r">${int(c.order_count)}</td><td class="t-sub">${dmy(c.first_order) || '—'} – ${dmy(c.last_order) || '—'}</td><td class="r">${moneyHtml(c.total)}</td><td class="r"><button class="btn sm" data-un="${c.id}">Arşivden çıkar</button></td></tr>`).join('') || '<tr><td colspan="6"><div class="empty">Arşiv boş. Müşteri detayındaki "Arşivle" ile buraya taşıyabilirsin.</div></td></tr>'}
  </tbody></table></div>`;
  $$('tr[data-id]', el).forEach(tr => tr.onclick = e => { if (e.target.closest('[data-un]')) return; location.hash = `${ctx.base}musteri/${tr.dataset.id}`; });
  $$('[data-un]', el).forEach(b => b.onclick = async () => { await api.post(`/customers/${b.dataset.un}/archive`, { archived: false }); toast('Arşivden çıkarıldı'); archivePage(ctx); });
}
