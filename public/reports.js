// Satış raporları, genel muhasebe, gelir-gider ve giderler
import { S, api, esc, $, $$, icon, toast, money, moneyHtml, int, dec1, short, pct, dmy, today, parseNum, numIn, phoneFmt, brandById, rangePreset, donut, legend, hbars, vbars, lines, PALETTE, exportCSV, exportXLS, modal, confirmBox } from './core.js';
import { setTitle } from './app.js';

const PRESETS = [['today', 'Bugün'], ['week', 'Bu hafta'], ['month', 'Bu ay'], ['lastmonth', 'Geçen ay'], ['90', 'Son 90 gün'], ['year', 'Bu yıl'], ['all', 'Tümü']];
const WD = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];
const colorOf = (list, name, i) => (list.find(x => x.name === name) || {}).color || (name === 'Belirsiz' ? 'var(--line-2)' : PALETTE[i % PALETTE.length]);

function dateBar(query, extra = '') {
  const p = query.get('p') || (query.get('from') ? '' : 'month');
  return `<div class="datebar no-print"><div class="seg">${PRESETS.map(([k, l]) => `<button data-p="${k}" class="${p === k ? 'on' : ''}">${l}</button>`).join('')}</div>
    <input class="in sm" type="date" id="df" style="width:150px"> <span class="muted">–</span> <input class="in sm" type="date" id="dt" style="width:150px">${extra}</div>`;
}
// KDV görünümü: varsayılan KDV hariç; seçim cihazda hatırlanır
const vatMode = query => { if (query.get('vat')) return query.get('vat'); try { return localStorage.getItem('pm_vat') || 'excl'; } catch { return 'excl'; } };
const vatToggle = vat => `<label class="chk small no-print vat-t" title="İşaretliyse tüm tutarlar KDV dahil gösterilir"><input type="checkbox" id="vatc" ${vat === 'incl' ? 'checked' : ''}> KDV dahil</label>`;
const bindVat = (el, query, baseHash) => { const c = $('#vatc', el); if (c) c.onchange = () => { const v = c.checked ? 'incl' : 'excl'; try { localStorage.setItem('pm_vat', v); } catch { } const q = new URLSearchParams(query); q.set('vat', v); location.hash = baseHash + '?' + q; }; };
function readRange(query) { if (query.get('from') && query.get('to')) return [query.get('from'), query.get('to')]; return rangePreset(query.get('p') || 'month'); }
function bindDateBar(el, query, baseHash) {
  const [f, t] = readRange(query); $('#df', el).value = f; $('#dt', el).value = t;
  const go = q => { location.hash = baseHash + '?' + q; };
  $$('.datebar [data-p]', el).forEach(b => b.onclick = () => { const q = new URLSearchParams(query); q.delete('from'); q.delete('to'); q.set('p', b.dataset.p); go(q); });
  const custom = () => { const q = new URLSearchParams(query); q.delete('p'); q.set('from', $('#df', el).value); q.set('to', $('#dt', el).value); if (q.get('from') && q.get('to')) go(q); };
  $('#df', el).onchange = custom; $('#dt', el).onchange = custom;
}
const delta = (cur, prev) => { if (prev == null) return ''; if (!prev) return cur ? '<span class="pos">yeni</span>' : ''; const d = (cur - prev) / prev; return `<span class="${d >= 0 ? 'pos' : 'neg'}">${d >= 0 ? '▲' : '▼'} ${pct(Math.abs(d))}</span> <span class="muted">önceki döneme göre</span>`; };

export async function reportsPage(ctx) {
  const { brand, el, query } = ctx;
  const all = !brand;
  setTitle(all ? 'Genel Muhasebe — Testeresan' : 'Satış Raporları');
  const [from, to] = readRange(query);
  const vat = vatMode(query), cmp = query.get('cmp') !== '0';
  const r = await api(`/report?brand=${brand || 'all'}&from=${from}&to=${to}&vat=${vat}&cmp=${cmp ? 1 : 0}`);
  const P = r.prev;
  const base = ctx.base + (all ? 'ozet' : 'raporlar');
  const invBase = b => `#/b/${b}/faturalar?from=${from}&to=${to}`;
  const drill = (params) => { const b = brand || params.brand || S.boot.brands[0].id; const q = new URLSearchParams({ from, to, ...params }); q.delete('brand'); if (all && !params.brand) return pickBrand(q); location.hash = `#/b/${b}/faturalar?${q}`; };
  const pickBrand = q => modal({ title: 'Hangi markanın faturaları?', body: `<div class="grid3">${S.boot.brands.map(b => `<a class="btn" href="#/b/${b.id}/faturalar?${q}">${esc(b.name)}</a>`).join('')}</div>`, onOpen: (m, close) => m.querySelectorAll('a').forEach(a => a.addEventListener('click', close)) });
  const src = Object.entries(r.bySource).sort((a, b) => b[1].total - a[1].total).map(([k, v], i) => ({ label: k, value: v.total, orders: v.orders, color: colorOf(S.boot.sources, k, i), key: k }));
  const pay = Object.entries(r.byPayment).sort((a, b) => b[1].total - a[1].total).map(([k, v], i) => ({ label: k, value: v.total, orders: v.orders, color: colorOf(S.boot.payments, k, i + 3), key: k }));
  const kapida = pay.filter(p => /kapıda/i.test(p.label)).reduce((a, p) => a + p.value, 0);
  const srcId = n => (S.boot.sources.find(s => s.name === n) || {}).id || 'none', payId = n => (S.boot.payments.find(s => s.name === n) || {}).id || 'none';
  // günlük seri
  const days = []; { const d = new Date(from + 'T12:00:00'), e = new Date(to + 'T12:00:00'); let guard = 0; while (d <= e && guard++ < 800) { days.push(d.toISOString().slice(0, 10)); d.setDate(d.getDate() + 1); } }
  const gran = days.length > 120 ? 'month' : days.length > 45 ? 'week' : 'day';
  const bucket = iso => gran === 'day' ? iso : gran === 'month' ? iso.slice(0, 7) : (() => { const d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d.toISOString().slice(0, 10); })();
  const series = {}; for (const dd of days) series[bucket(dd)] = 0; for (const [dd, v] of Object.entries(r.daily)) { const k = bucket(dd); if (k in series) series[k] += v; }
  const tsLabels = Object.keys(series).map(k => gran === 'month' ? k.slice(5) + '.' + k.slice(2, 4) : dmy(k).slice(0, 5));
  let prevVals = null;
  if (P && P.daily) { const pd = []; { const d = new Date(P.from + 'T12:00:00'), e = new Date(P.to + 'T12:00:00'); while (d <= e) { pd.push(d.toISOString().slice(0, 10)); d.setDate(d.getDate() + 1); } } const ps = {}; pd.forEach((dd, i) => { const k = bucket(days[i] || dd); ps[k] = (ps[k] || 0) + (P.daily[dd] || 0); }); prevVals = Object.keys(series).map(k => ps[k] || 0); }
  const ils = Object.entries(r.byIl).sort((a, b) => b[1].total - a[1].total).slice(0, 10);
  const ilces = Object.entries(r.byIlce).sort((a, b) => b[1].total - a[1].total).slice(0, 10);
  const prods = Object.values(r.byProduct).sort((a, b) => b.total - a.total);
  const cats = Object.entries(r.byCategory).sort((a, b) => b[1].total - a[1].total);
  const bT = Object.entries(r.bands.byType).sort((a, b) => b[1].meters - a[1].meters), bW = Object.entries(r.bands.byWidth).sort((a, b) => b[1].meters - a[1].meters).slice(0, 12);
  const srcNames = Object.keys(r.cross), payNames = (() => { const used = new Set(Object.values(r.cross).flatMap(o => Object.keys(o))), base = S.boot.payments.map(x => x.name); return [...base, ...[...used].filter(x => !base.includes(x))]; })();
  const brands = S.boot.brands.map((b, i) => ({ label: b.name, value: (r.byBrand[b.id] || {}).total || 0, orders: (r.byBrand[b.id] || {}).orders || 0, color: b.color || PALETTE[i], key: b.id, prev: P ? ((P.byBrand[b.id] || {}).total || 0) : null }));

  el.innerHTML = `
  <div class="row wrap">${dateBar(query)}<span class="sp"></span>
    ${vatToggle(vat)}
    <label class="chk small no-print"><input type="checkbox" id="cmp" ${cmp ? 'checked' : ''}> Önceki dönemle karşılaştır</label>
    <button class="btn sm no-print" id="xls">${icon('download')} Excel</button><button class="btn sm no-print" id="pdf">${icon('print')} PDF</button></div>
  <div class="muted small">${vat === 'incl' ? 'KDV dahil' : 'KDV hariç'} · ${dmy(from)} – ${dmy(to)}${P ? ` · karşılaştırma: ${dmy(P.from)} – ${dmy(P.to)}` : ''}</div>
  <div class="grid4">
    <div class="card kpi"><div class="t">Toplam satış</div><div class="v">${money(r.total)}</div><div class="d">${delta(r.total, P && P.total)}</div></div>
    <div class="card kpi"><div class="t">Sipariş sayısı</div><div class="v">${int(r.orders)}</div><div class="d">${delta(r.orders, P && P.orders)}${r.promo && r.promo.count ? ` <span class="muted">· +${int(r.promo.count)} reklam gönderimi</span>` : ''}</div></div>
    <div class="card kpi"><div class="t">Ortalama sepet</div><div class="v">${money(r.avgBasket)}</div><div class="d">${delta(r.avgBasket, P && P.avgBasket)}</div></div>
    <div class="card kpi"><div class="t">Tekil müşteri</div><div class="v">${int(r.customers)}</div><div class="d muted">Tekrar sipariş oranı ${pct(r.repeatRate)}</div></div>
  </div>
  <div class="rgrid">
    ${all ? `<div class="card c8"><div class="hd"><h3>Marka karşılaştırması</h3></div><div class="bd">${hbars(brands.map(b => ({ ...b, sub: `${int(b.orders)} sipariş${b.prev != null ? ' · önceki ' + short(b.prev) : ''}` })), {})}<div style="margin-top:16px">${vbars(['Ciro'], brands.map(b => ({ name: b.label, color: b.color, values: [b.value] })), { h: 160 })}</div></div></div>
    <div class="card c4"><div class="hd"><h3>Marka payı</h3></div><div class="bd">${donut(brands)}${legend(brands, { extra: d => int(d.orders) + ' sip.' })}</div></div>` : ''}
    <div class="card c8"><div class="hd"><h3>Satış zaman serisi</h3><span class="muted small">${gran === 'day' ? 'günlük' : gran === 'week' ? 'haftalık' : 'aylık'}</span></div><div class="bd">${lines(tsLabels, [{ name: 'Bu dönem', color: 'var(--accent)', values: Object.values(series), fill: true }, ...(prevVals ? [{ name: 'Önceki dönem', color: 'var(--muted)', values: prevVals, dash: true }] : [])])}</div></div>
    <div class="card c4"><div class="hd"><h3>Yeni vs geri dönen müşteri</h3></div><div class="bd">${(() => { const d = [{ label: 'Yeni müşteri (ilk sipariş)', value: r.newCust.total, color: 'var(--c2)', orders: r.newCust.orders, key: '1' }, { label: 'Geri dönen (tekrar sipariş)', value: r.retCust.total, color: 'var(--c1)', orders: r.retCust.orders, key: '0' }, ...(r.anon && r.anon.orders ? [{ label: 'İsimsiz mağaza müşterisi', value: r.anon.total, color: 'var(--c8)', orders: r.anon.orders, key: 'anon' }] : [])]; return donut(d) + `<div id="nr">${legend(d, { extra: x => int(x.orders) + ' sip.' })}</div>`; })()}</div></div>
    <div class="card c4"><div class="hd"><h3>Kaynak bazında</h3></div><div class="bd">${donut(src)}<div id="srcl">${legend(src, { extra: d => `${int(d.orders)} sip. · ort. ${short(d.value / (d.orders || 1))}` })}</div></div></div>
    <div class="card c4"><div class="hd"><h3>Ödeme yöntemi</h3><span class="sp"></span><span class="pill soft">Kapıda payı ${pct(r.total ? kapida / r.total : 0)}</span></div><div class="bd">${donut(pay)}<div id="payl">${legend(pay, { extra: d => int(d.orders) + ' sip.' })}</div></div></div>
    <div class="card c4"><div class="hd"><h3>Satış temsilcisi</h3></div><div class="bd" id="repb">${hbars(Object.entries(r.byRep).sort((a, b) => b[1].total - a[1].total).map(([k, v]) => ({ label: k, value: v.total, sub: v.orders + ' sip.' + (P && P.byRep && P.byRep[k] ? ' · önceki ' + short(P.byRep[k].total) : ''), key: k })), { color: 'var(--c7)' })}</div></div>
    <div class="card c4"><div class="hd"><h3>Resmi / gayriresmi</h3></div><div class="bd">${(() => { const d = [{ label: 'Resmi satış', value: r.official.total, orders: r.official.orders, color: 'var(--c5)', key: '1' }, { label: 'Gayriresmi', value: r.informal.total, orders: r.informal.orders, color: 'var(--c8)', key: '0' }]; return donut(d) + `<div id="offl">${legend(d, { extra: x => int(x.orders) + ' sip.' })}</div>`; })()}</div></div>
    <div class="card c12"><div class="hd"><h3>Kaynak × ödeme yöntemi</h3><span class="muted small">ciro · sipariş</span></div><div class="bd tbl-wrap"><table class="tbl compact xt"><thead><tr><th>Kaynak</th>${payNames.map(p => `<th>${esc(p)}</th>`).join('')}<th>Toplam</th></tr></thead><tbody>${srcNames.map(s => `<tr><td>${esc(s)}</td>${payNames.map(p => { const c = r.cross[s][p]; return `<td class="click" data-x="${esc(s)}|${esc(p)}">${c ? `${money(c.total)}<div class="muted">${c.orders} sip.</div>` : '<span class="muted">—</span>'}</td>`; }).join('')}<td><b>${money(r.bySource[s].total)}</b></td></tr>`).join('') || '<tr><td colspan="9" class="empty">Veri yok</td></tr>'}</tbody></table></div></div>
    <div class="card c6"><div class="hd"><h3>En iyi 10 il</h3></div><div class="bd" id="ilb">${hbars(ils.map(([k, v]) => ({ label: k, value: v.total, sub: v.orders + ' sip.', key: k })))}</div></div>
    <div class="card c6"><div class="hd"><h3>En iyi 10 ilçe</h3></div><div class="bd" id="ilceb">${hbars(ilces.map(([k, v]) => ({ label: k, value: v.total, sub: v.orders + ' sip.', key: k })), { color: 'var(--c2)' })}</div></div>
    <div class="card c6"><div class="hd"><h3>Kategori bazında satış</h3></div><div class="bd" id="catb">${hbars(cats.map(([k, v]) => ({ label: k, value: v.total, sub: int(v.qty) + ' adet', key: k })), { color: 'var(--c5)' })}</div></div>
    <div class="card c6"><div class="hd"><h3>En çok satan 10 ürün</h3></div><div class="bd tbl-wrap"><table class="tbl compact"><thead><tr><th>Ürün</th><th class="r">Adet</th><th class="r">Ciro</th></tr></thead><tbody>${prods.slice(0, 10).map(p => `<tr class="click" data-prod="${p.product_id || ''}"><td>${esc(p.name)}${p.meters ? ` <span class="muted small">· ${dec1(p.meters)} m</span>` : ''}</td><td class="r">${int(p.qty)}</td><td class="r">${moneyHtml(p.total)}</td></tr>`).join('') || '<tr><td colspan="3" class="empty">Veri yok</td></tr>'}</tbody></table></div></div>
    <div class="card c12"><div class="hd"><h3>Şerit testere metrajı</h3><span class="sp"></span><span class="muted small">Stok düşümü yok — sadece satış metrajı · ${S.boot.settings.band_roll_m || 100} m'lik top</span></div><div class="bd"><div class="grid4" style="margin-bottom:14px">
      <div class="kpi" style="padding:0"><div class="t">Satılan metre</div><div class="v">${dec1(r.bands.meters)} m</div><div class="d">${P ? delta(r.bands.meters, P.bandMeters) : ''}</div></div><div class="kpi" style="padding:0"><div class="t">Satılan adet (kaynaklı)</div><div class="v">${int(r.bands.pieces)}</div></div><div class="kpi" style="padding:0"><div class="t">Top karşılığı</div><div class="v">${dec1(r.bands.rolls)} top</div></div><div class="kpi" style="padding:0"><div class="t">Ortalama boy</div><div class="v">${r.bands.pieces ? int(r.bands.meters / r.bands.pieces * 1000) + ' mm' : '—'}</div></div></div>
      <div class="grid2"><div><div class="label" style="margin-bottom:8px">Tür bazında (metre)</div>${hbars(bT.map(([k, v]) => ({ label: k, value: v.meters, sub: int(v.pieces) + ' adet' })), { fmt: v => dec1(v) + ' m', color: 'var(--c6)' })}</div><div><div class="label" style="margin-bottom:8px">Genişlik × kalınlık (metre)</div>${hbars(bW.map(([k, v]) => ({ label: k, value: v.meters, sub: int(v.pieces) + ' adet' })), { fmt: v => dec1(v) + ' m', color: 'var(--c7)' })}</div></div></div></div>
    <div class="card c6"><div class="hd"><h3>Haftanın günü</h3></div><div class="bd">${vbars(WD, [{ name: 'Ciro', color: 'var(--accent)', values: r.weekday }], { h: 180 })}</div></div>
    <div class="card c6"><div class="hd"><h3>Ay içi dağılım</h3></div><div class="bd">${vbars(r.monthday.map((_, i) => String(i + 1)), [{ name: 'Ciro', color: 'var(--c2)', values: r.monthday }], { h: 180 })}</div></div>
    <div class="card c6"><div class="hd"><h3>En çok alışveriş yapan müşteriler</h3></div><div class="bd tbl-wrap"><table class="tbl compact"><thead><tr><th>Müşteri</th>${all ? '<th>Marka</th>' : ''}<th class="r">Sipariş</th><th class="r">Toplam</th></tr></thead><tbody>${r.topCustomers.map(c => `<tr class="click" data-cust="${c.id}" data-b="${c.brand}"><td>${esc(c.name || '—')}<div class="t-sub">${esc(phoneFmt(c.phone))}</div></td>${all ? `<td class="t-sub">${esc((brandById(c.brand) || {}).name || '')}</td>` : ''}<td class="r">${c.orders}</td><td class="r">${moneyHtml(c.total)}</td></tr>`).join('') || '<tr><td colspan="4" class="empty">Veri yok</td></tr>'}</tbody></table></div></div>
    <div class="card c6"><div class="hd"><h3>Bu dönem hiç satmayan ürünler</h3><span class="sp"></span><span class="muted small">${int(r.neverSold.length)} ürün</span></div><div class="bd" style="max-height:360px;overflow:auto">${r.neverSold.map(p => `<div class="row small" style="padding:4px 0;border-bottom:1px solid var(--line)"><span class="grow">${esc(p.name)}</span><span class="muted">${esc(p.subcategory || '')}</span></div>`).join('') || '<div class="empty">Tüm ürünler satıldı</div>'}</div></div>
  </div>`;
  bindDateBar(el, query, base); bindVat(el, query, base);
  $$('[data-vat]', el).forEach(b => b.onclick = () => { const q = new URLSearchParams(query); q.set('vat', b.dataset.vat); location.hash = base + '?' + q; });
  $('#cmp', el).onchange = e => { const q = new URLSearchParams(query); q.set('cmp', e.target.checked ? '1' : '0'); location.hash = base + '?' + q; };
  $('#pdf', el).onclick = () => window.print();
  // detay listelerine iniş
  $$('#srcl .li', el).forEach(li => li.onclick = () => drill({ source: String(srcId(li.dataset.k)) }));
  $$('#payl .li', el).forEach(li => li.onclick = () => drill({ payment: String(payId(li.dataset.k)) }));
  $$('#offl .li', el).forEach(li => li.onclick = () => drill({ official: li.dataset.k }));
  $$('#nr .li', el).forEach(li => li.onclick = () => li.dataset.k !== 'anon' && drill({ first: li.dataset.k }));
  $$('#repb .hbar', el).forEach(b => b.onclick = () => { const rp = (S.boot.reps || []).find(x => x.name === b.dataset.k); drill({ rep: rp ? String(rp.id) : 'none' }); });
  $$('#ilb .hbar', el).forEach(b => b.onclick = () => drill({ il: b.dataset.k }));
  $$('#ilceb .hbar', el).forEach(b => b.onclick = () => { const [ilce, il] = b.dataset.k.split(' / '); drill({ il, ilce }); });
  $$('#catb .hbar', el).forEach(b => b.onclick = () => drill({ category: b.dataset.k }));
  $$('[data-prod]', el).forEach(tr => tr.onclick = () => tr.dataset.prod && drill({ product: tr.dataset.prod }));
  $$('[data-x]', el).forEach(td => td.onclick = () => { const [s, p] = td.dataset.x.split('|'); drill({ source: String(srcId(s)), payment: String(payId(p)) }); });
  $$('[data-cust]', el).forEach(tr => tr.onclick = () => { location.hash = `#/b/${tr.dataset.b}/musteri/${tr.dataset.cust}`; });
  if (all) $$('.hbar', el.querySelector('.rgrid .card')).forEach(b => b.onclick = () => { location.hash = invBase(b.dataset.k); });
  $('#xls', el).onclick = () => exportXLS(`rapor-${brand || 'testeresan'}-${from}-${to}`, [
    { name: 'Özet', headers: ['Gösterge', 'Değer'], rows: [['Dönem', `${dmy(from)} - ${dmy(to)}`], ['KDV', vat === 'incl' ? 'Dahil' : 'Hariç'], ['Toplam satış', r.total], ['Sipariş', r.orders], ['Ortalama sepet', r.avgBasket], ['Tekil müşteri', r.customers], ['Yeni müşteri cirosu', r.newCust.total], ['Geri dönen müşteri cirosu', r.retCust.total], ['Resmi satış', r.official.total], ['Gayriresmi satış', r.informal.total], ['Şerit metre', r.bands.meters], ['Şerit adet', r.bands.pieces]] },
    ...(all ? [{ name: 'Markalar', headers: ['Marka', 'Sipariş', 'Ciro'], rows: brands.map(b => [b.label, b.orders, b.value]) }] : []),
    { name: 'Kaynak', headers: ['Kaynak', 'Sipariş', 'Ciro', 'Ort. sepet'], rows: src.map(s => [s.label, s.orders, s.value, s.orders ? s.value / s.orders : 0]) },
    { name: 'Ödeme', headers: ['Ödeme yöntemi', 'Sipariş', 'Ciro'], rows: pay.map(s => [s.label, s.orders, s.value]) },
    { name: 'Temsilci', headers: ['Satış temsilcisi', 'Sipariş', 'Ciro'], rows: Object.entries(r.byRep).map(([k, v]) => [k, v.orders, v.total]) },
    { name: 'Kaynak x Ödeme', headers: ['Kaynak', ...payNames.flatMap(p => [p + ' ciro', p + ' sipariş'])], rows: srcNames.map(s => [s, ...payNames.flatMap(p => [(r.cross[s][p] || {}).total || 0, (r.cross[s][p] || {}).orders || 0])]) },
    { name: 'İller', headers: ['İl', 'Sipariş', 'Ciro'], rows: Object.entries(r.byIl).map(([k, v]) => [k, v.orders, v.total]) },
    { name: 'İlçeler', headers: ['İlçe / İl', 'Sipariş', 'Ciro'], rows: Object.entries(r.byIlce).map(([k, v]) => [k, v.orders, v.total]) },
    { name: 'Ürünler', headers: ['Ürün', 'Adet', 'Ciro', 'Metre'], rows: prods.map(p => [p.name, p.qty, p.total, p.meters]) },
    { name: 'Kategoriler', headers: ['Kategori', 'Adet', 'Ciro'], rows: cats.map(([k, v]) => [k, v.qty, v.total]) },
    { name: 'Şerit metraj', headers: ['Tür', 'Metre', 'Adet', 'Ciro'], rows: bT.map(([k, v]) => [k, v.meters, v.pieces, v.total]) },
    { name: 'Zaman', headers: ['Tarih', 'Ciro'], rows: Object.entries(r.daily).sort().map(([k, v]) => [dmy(k), v]) },
    { name: 'Müşteriler', headers: ['Müşteri', 'Telefon', 'Sipariş', 'Toplam'], rows: r.topCustomers.map(c => [c.name || '', phoneFmt(c.phone), c.orders, c.total]) }
  ]);
}

// ---------------- Gelir-Gider ----------------
export async function pnlPage(ctx) {
  const { brand, el, query } = ctx;
  setTitle(brand ? 'Gelir-Gider Raporu' : 'Gelir-Gider Raporu — Testeresan');
  const q0 = new URLSearchParams(query); if (!q0.get('p') && !q0.get('from')) q0.set('p', 'year');
  const [from, to] = readRange(q0);
  const vat = vatMode(query);
  const d = await api(`/pnl?brand=${brand || 'all'}&from=${from}&to=${to}&vat=${vat}`);
  const cats = Object.entries(d.byCategory).sort((a, b) => b[1] - a[1]);
  const AL = { ciro: 'ciro oranına göre', esit: 'eşit', manuel: 'elle girilen oranlara göre' };
  el.innerHTML = `<div class="row wrap">${dateBar(q0)}<span class="sp"></span>${vatToggle(vat)}<a class="btn pri up" href="${ctx.base}giderler?yeni=1">+ Gider Ekle</a><button class="btn sm" id="xls">${icon('download')} Excel</button></div>
  <div class="muted small">Gelir = satışların ${vat === 'incl' ? 'KDV dahil' : 'KDV hariç'} toplamı. Ortak giderler markalara <b>${AL[d.allocation] || d.allocation}</b> dağıtılır (Ayarlar'dan değiştirilebilir).</div>
  <div class="grid4"><div class="card kpi"><div class="t">Gelir</div><div class="v">${money(d.income)}</div></div><div class="card kpi"><div class="t">Gider</div><div class="v">${money(d.expense)}</div></div><div class="card kpi"><div class="t">Net kâr / zarar</div><div class="v ${d.net >= 0 ? 'pos' : 'neg'}">${money(d.net)}</div></div><div class="card kpi"><div class="t">Kâr marjı</div><div class="v">${d.income ? pct(d.net / d.income) : '—'}</div></div></div>
  <div class="rgrid"><div class="card c8"><div class="hd"><h3>Aylık gelir / gider</h3></div><div class="bd">${vbars(d.months.map(m => m.month.slice(5) + '.' + m.month.slice(2, 4)), [{ name: 'Gelir', color: 'var(--accent)', values: d.months.map(m => m.income) }, { name: 'Gider', color: 'var(--danger)', values: d.months.map(m => m.expense) }], { h: 240 })}</div></div>
  <div class="card c4"><div class="hd"><h3>Gider kategorileri</h3></div><div class="bd">${hbars(cats.map(([k, v]) => ({ label: k, value: v })), { color: 'var(--danger)' })}</div></div>
  <div class="card c12"><div class="tbl-wrap"><table class="tbl compact"><thead><tr><th>Ay</th><th class="r">Sipariş</th><th class="r">Gelir</th><th class="r">Gider</th><th class="r">Net</th></tr></thead><tbody>${d.months.map(m => `<tr><td>${m.month}</td><td class="r">${int(m.orders)}</td><td class="r">${moneyHtml(m.income)}</td><td class="r">${moneyHtml(m.expense)}</td><td class="r"><b class="${m.net >= 0 ? 'pos' : 'neg'}">${money(m.net)}</b></td></tr>`).join('') || '<tr><td colspan="6" class="empty">Bu dönemde kayıt yok</td></tr>'}</tbody></table></div></div></div>`;
  bindDateBar(el, q0, ctx.base + 'gelir-gider'); bindVat(el, q0, ctx.base + 'gelir-gider');
  $('#xls', el).onclick = () => exportXLS(`gelir-gider-${brand || 'testeresan'}-${from}-${to}`, [{ name: 'Aylık', headers: ['Ay', 'Sipariş', 'Gelir KDV hariç', 'Gelir KDV dahil', 'Gider', 'Net'], rows: d.months.map(m => [m.month, m.orders, m.income, m.gross, m.expense, m.net]) }, { name: 'Giderler', headers: ['Tarih', 'Kategori', 'Açıklama', 'Marka', 'Tutar', 'Pay', 'Bu görünüme düşen'], rows: d.expenses.map(e => [dmy(e.date), e.category, e.description || '', e.brand_id ? (brandById(e.brand_id) || {}).name : 'Ortak', e.amount, e.share, e.part]) }]);
}

// ---------------- Giderler ----------------
export async function expensesPage(ctx) {
  const { brand, el, query } = ctx;
  setTitle(brand ? 'Giderler' : 'Giderler — ortak ve marka giderleri');
  const q0 = new URLSearchParams(query); if (!q0.get('p') && !q0.get('from')) q0.set('p', 'year');
  const [from, to] = readRange(q0);
  const vat = vatMode(query);
  const d = await api(`/pnl?brand=${brand || 'all'}&from=${from}&to=${to}&vat=${vat}`);
  el.innerHTML = `<div class="row wrap">${dateBar(q0)}<span class="sp"></span><button class="btn pri up" id="add">+ Gider Ekle</button></div>
  <div class="tbl-wrap"><table class="tbl list"><thead><tr><th>Tarih</th><th>Kategori</th><th>Açıklama</th><th>Marka</th><th class="r">Tutar</th>${brand ? '<th class="r">Bu markaya düşen</th>' : ''}</tr></thead><tbody>
  ${d.expenses.map(e => `<tr class="click" data-id="${e.id}"><td>${dmy(e.date)}</td><td>${esc(e.category)}</td><td class="t-sub">${esc(e.description || '')}</td><td>${e.brand_id ? esc((brandById(e.brand_id) || {}).name || e.brand_id) : '<span class="pill soft">ORTAK</span>'}</td><td class="r">${moneyHtml(e.amount)}</td>${brand ? `<td class="r">${moneyHtml(e.part)} <span class="muted small">${pct(e.share)}</span></td>` : ''}</tr>`).join('') || `<tr><td colspan="6"><div class="empty">Bu dönemde gider yok.</div></td></tr>`}
  </tbody></table></div><div class="footbar"><span class="sp"></span><span class="sumtext">${d.expenses.length} kayıt · ${brand ? 'bu markaya düşen' : 'toplam'} <b>${money(d.expense)}</b></span></div>`;
  bindDateBar(el, q0, ctx.base + 'giderler');
  const open = (e = {}) => {
    const st = S.boot.settings; const cats = st.expense_categories || [];
    let alloc = {}; try { alloc = e.allocation ? (typeof e.allocation === 'string' ? JSON.parse(e.allocation) : e.allocation) : {}; } catch { }
    modal({ title: e.id ? 'Gideri düzenle' : 'Gider ekle', body: `<form id="ef" style="display:grid;gap:12px">
      <div class="grid2"><label class="field"><span>Kategori</span><input class="in" name="category" list="ecats" value="${esc(e.category || cats[0] || '')}"><datalist id="ecats">${cats.map(c => `<option>${esc(c)}</option>`).join('')}</datalist></label><label class="field"><span>Tutar (₺)</span><input class="in" name="amount" inputmode="decimal" value="${esc(numIn(e.amount))}" required></label></div>
      <div class="grid2"><label class="field"><span>Tarih</span><input class="in" type="date" name="date" value="${esc(e.date || today())}" required></label><label class="field"><span>Marka</span><select class="in" name="brand_id"><option value="">Ortak gider (markalara dağıtılır)</option>${S.boot.brands.map(b => `<option value="${b.id}" ${(e.id ? e.brand_id : brand) === b.id ? 'selected' : ''}>${esc(b.name)}</option>`).join('')}</select></label></div>
      <label class="field"><span>Açıklama</span><input class="in" name="description" value="${esc(e.description || '')}"></label>
      <div id="al" class="helpbox"><div class="label" style="margin-bottom:6px">Ortak gider dağıtımı (boş bırakılırsa Ayarlar'daki yöntem: ${esc(st.expense_allocation)})</div><div class="grid3">${S.boot.brands.map(b => `<label class="field"><span>${esc(b.name)} %</span><input class="in sm" name="al_${b.id}" inputmode="decimal" value="${esc(alloc[b.id] ?? '')}"></label>`).join('')}</div></div></form>`,
      actions: [...(e.id ? [{ label: 'Sil', cls: 'danger', onClick: async () => { if (!(await confirmBox('Gider silinsin mi?'))) return false; await api.del('/expenses/' + e.id); expensesPage(ctx); } }] : []), { label: 'Vazgeç' }, { label: 'Kaydet', cls: 'pri', onClick: async m => {
        const f = m.querySelector('#ef'); const amount = parseNum(f.amount.value); if (!amount || !f.date.value) { toast('Tutar ve tarih gerekli', true); return false; }
        const al = {}; if (!f.brand_id.value) for (const b of S.boot.brands) { const v = parseNum(f['al_' + b.id].value); if (v != null) al[b.id] = v; }
        const body = { category: f.category.value.trim() || 'Diğer', amount, date: f.date.value, description: f.description.value.trim(), brand_id: f.brand_id.value || null, allocation: Object.keys(al).length ? al : null };
        if (e.id) await api.put('/expenses/' + e.id, body); else await api.post('/expenses', body);
        toast('Gider kaydedildi'); expensesPage(ctx);
      } }],
      onOpen: m => { const f = m.querySelector('#ef'); const t = () => m.querySelector('#al').classList.toggle('hidden', !!f.brand_id.value); f.brand_id.onchange = t; t(); f.amount.focus(); } });
  };
  $('#add', el).onclick = () => open();
  $$('tr[data-id]', el).forEach(tr => tr.onclick = () => open(d.expenses.find(x => x.id === Number(tr.dataset.id))));
  if (query.get('yeni')) { const q = new URLSearchParams(query); q.delete('yeni'); history.replaceState(null, '', ctx.base + 'giderler' + (q.toString() ? '?' + q : '')); query.delete('yeni'); open(); }
}
