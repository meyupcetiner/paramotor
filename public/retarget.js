// Retargeting (genel muhasebe): sıcak / ılık / soğuk müşteriler, ara + WhatsApp şablon mesajı, ciro aralığı çubuğu
import { S, api, esc, $, $$, icon, money, moneyHtml, int, dmy, phoneFmt, waLink, toast, fold } from './core.js';
import { setTitle } from './app.js';

const TIERS = [
  { k: 'hot', t: 'Sıcak', d: 'Yakın zamanda alışveriş yaptı', c: '#ff6b4a' },
  { k: 'warm', t: 'Ilık', d: 'Bir süredir sipariş yok', c: '#f5b83d' },
  { k: 'cold', t: 'Soğuk', d: 'Uzun zamandır sipariş yok', c: '#5aa9ff' }
];
const BAREMS = [[0, 1000], [1000, 5000], [5000, 15000], [15000, 50000], [50000, Infinity]];
const bLabel = ([a, b]) => b === Infinity ? `${short(a)}+` : `${short(a)}–${short(b)}`;
const short = v => v >= 1000 ? (v / 1000).toLocaleString('tr-TR', { maximumFractionDigits: 1 }) + 'B' : String(v);
const ST = { tier: 'hot', q: '', brand: '', il: '', cat: '', orders: '', phone: true, due: false, fresh: false, lo: 0, hi: Infinity, open: null, sort: 'total' };
const ls = { get: k => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch { } } };

export async function retargetPage(ctx) {
  const { el } = ctx;
  setTitle('Retargeting');
  try { Object.assign(ST, JSON.parse(ls.get('pm_rt') || '{}'), { open: null }); if (ST.hi === null) ST.hi = Infinity; } catch { }
  el.innerHTML = '<div class="empty">Yükleniyor…</div>';
  const R = await api('/retargeting');
  const all = R.customers;
  const brands = S.boot.brands;
  const bName = id => (brands.find(b => b.id === id) || {}).name || id;
  const ils = [...new Set(all.map(c => c.il).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'tr'));
  const cats = [...new Set(all.flatMap(c => c.categories))].sort((a, b) => a.localeCompare(b, 'tr'));
  const maxT = Math.max(1000, ...all.map(c => c.total));
  // log ölçekli çubuk: 0..1000 adım → 0..maxT
  const STEPS = 1000, L0 = 100;
  const toVal = p => p <= 0 ? 0 : p >= STEPS ? Infinity : Math.round(L0 * Math.pow(maxT / L0, p / STEPS) / 50) * 50;
  const toPos = v => v <= 0 ? 0 : v === Infinity || v >= maxT ? STEPS : Math.max(0, Math.min(STEPS, Math.round(Math.log(Math.max(v, L0) / L0) / Math.log(maxT / L0) * STEPS)));

  el.innerHTML = `
  <div class="card rt-filters">
    <div class="rt-row">
      <div class="searchbar"><input id="rq" placeholder="Müşteri, telefon, il ara…" value="${esc(ST.q)}">${icon('search')}</div>
      <select class="in" id="rb"><option value="">Tüm markalar</option>${brands.map(b => `<option value="${b.id}" ${ST.brand === b.id ? 'selected' : ''}>${esc(b.name)}</option>`).join('')}</select>
      <select class="in" id="ri"><option value="">Tüm iller</option>${ils.map(x => `<option ${ST.il === x ? 'selected' : ''}>${esc(x)}</option>`).join('')}</select>
      <select class="in" id="rc"><option value="">Tüm kategoriler</option>${cats.map(x => `<option ${ST.cat === x ? 'selected' : ''}>${esc(x)}</option>`).join('')}</select>
      <select class="in" id="ro"><option value="">Sipariş sayısı</option>${[['1', 'Tek sipariş'], ['2', '2+ sipariş'], ['3', '3+ sipariş'], ['5', '5+ sipariş']].map(([v, t]) => `<option value="${v}" ${ST.orders === v ? 'selected' : ''}>${t}</option>`).join('')}</select>
    </div>
    <div class="rt-row chips">
      <label class="chk"><input type="checkbox" id="rp" ${ST.phone ? 'checked' : ''}> Telefonu olanlar</label>
      <label class="chk"><input type="checkbox" id="rd" ${ST.due ? 'checked' : ''}> Sipariş zamanı gelenler</label>
      <label class="chk"><input type="checkbox" id="rf" ${ST.fresh ? 'checked' : ''}> Son 14 günde aranmayan / mesaj atılmayan</label>
    </div>
    <div class="rt-range">
      <div class="rt-range-hd"><b>Toplam sipariş tutarı</b><span class="sp"></span><span class="muted small" id="rrs"></span></div>
      <div class="rt-hist" id="rh"></div>
      <div class="rt-slider"><div class="rt-track"><div class="rt-fill" id="rfl"></div></div>
        <input type="range" id="rlo" min="0" max="${STEPS}" value="${toPos(ST.lo)}"><input type="range" id="rhi" min="0" max="${STEPS}" value="${toPos(ST.hi)}"></div>
      <div class="rt-mm"><div><span>Minimum</span><input class="in" id="rmin" inputmode="numeric"></div><div class="rt-barems">${BAREMS.map((b, i) => `<button class="chipbtn" data-bar="${i}">${bLabel(b)} ₺</button>`).join('')}<button class="chipbtn" data-bar="all">Tümü</button></div><div><span>Maksimum</span><input class="in" id="rmax" inputmode="numeric"></div></div>
    </div>
  </div>
  <div class="rt-tiers" id="rtt"></div>
  <details class="card rt-tpl" id="rtpl"><summary>${icon('pen')} Mesaj şablonu — <span id="rtpln"></span><span class="muted small"> · {ad} {marka} {tarih} {gun} {urun} {ciro} kullanılabilir</span></summary>
    <textarea class="in" id="rtx" rows="3"></textarea><div class="row" style="margin-top:8px"><button class="btn sm pri" id="rts">Şablonu kaydet</button><span class="muted small">Sıcak, ılık ve soğuk için ayrı şablon tutulur.</span></div></details>
  <div class="tbl-wrap"><table class="tbl list rt-tbl"><thead><tr><th>Müşteri</th><th>Konum</th><th class="r sortable" data-s="orders">Sipariş</th><th class="r sortable" data-s="total">Toplam ciro</th><th class="sortable" data-s="last">Son alışveriş</th><th>Son temas</th><th class="r"></th></tr></thead><tbody id="rtb"></tbody></table></div>
  <p class="muted small">Sıcak: son siparişi ${R.days.hot} gün içinde · Ilık: ${R.days.hot + 1}–${R.days.warm} gün · Soğuk: ${R.days.warm} günden eski. "Zamanı geldi": birden çok siparişi olan ve son siparişinden bu yana kendi ortalama sipariş aralığı kadar geçmiş müşteri. Arşivdeki müşteriler listede yok.</p>`;

  const save = () => ls.set('pm_rt', JSON.stringify({ ...ST, open: null, hi: ST.hi === Infinity ? null : ST.hi }));
  const fill = s => String(s || '');
  const tplOf = k => (R.templates || {})[k] || '';
  const daysAgo = c => c.days_since == null ? '' : c.days_since === 0 ? 'bugün' : `${c.days_since} gün önce`;
  const contactTxt = v => { if (!v) return '—'; const [d, k] = v.split('|'); const days = Math.floor((Date.now() - new Date(d.replace(' ', 'T')).getTime()) / 864e5); return `${k === 'call' ? 'Arandı' : 'Mesaj'} · ${days <= 0 ? 'bugün' : days + ' gün önce'}`; };
  const msgFor = c => tplOf(c.tier)
    .replace(/\{ad\}/g, (c.name || '').replace(/\s+\d+$/, '').trim())
    .replace(/\{marka\}/g, bName(ST.brand || c.brand_ids[0]))
    .replace(/\{tarih\}/g, dmy(c.last_order))
    .replace(/\{gun\}/g, c.days_since ?? '')
    .replace(/\{urun\}/g, c.last_product || 'testere')
    .replace(/\{ciro\}/g, money(c.total));

  const base = () => all.filter(c => {
    if (ST.q) { const f = fold(ST.q); if (!fold(`${c.name} ${c.phone || ''} ${c.il || ''} ${c.ilce || ''}`).includes(f) && !String(c.phone || '').includes(ST.q.replace(/\D/g, '') || '§')) return false; }
    if (ST.brand && !c.brand_ids.includes(ST.brand)) return false;
    if (ST.il && c.il !== ST.il) return false;
    if (ST.cat && !c.categories.includes(ST.cat)) return false;
    if (ST.orders && (ST.orders === '1' ? c.order_count !== 1 : c.order_count < Number(ST.orders))) return false;
    if (ST.phone && !c.phone) return false;
    if (ST.due && !c.due) return false;
    if (ST.fresh && c.last_contact) { const d = new Date(c.last_contact.split('|')[0].replace(' ', 'T')); if (Date.now() - d.getTime() < 14 * 864e5) return false; }
    return true;
  });
  const inRange = c => c.total >= ST.lo && (ST.hi === Infinity || c.total <= ST.hi);

  function drawRange(list) {
    // histogram: 40 log-bölme, seçili aralık renkli
    const N = 40, bins = Array(N).fill(0);
    for (const c of list) { const p = toPos(c.total); bins[Math.min(N - 1, Math.floor(p / STEPS * N))]++; }
    const mx = Math.max(1, ...bins), lo = toPos(ST.lo), hi = toPos(ST.hi);
    $('#rh', el).innerHTML = bins.map((n, i) => { const mid = (i + .5) / N * STEPS; return `<i style="height:${n ? Math.max(6, n / mx * 100) : 0}%" class="${mid >= lo && mid <= hi ? 'on' : ''}" title="${n} müşteri"></i>`; }).join('');
    $('#rfl', el).style.left = (lo / STEPS * 100) + '%'; $('#rfl', el).style.right = (100 - hi / STEPS * 100) + '%';
    $('#rmin', el).value = money(ST.lo).replace(',00', ''); $('#rmax', el).value = ST.hi === Infinity ? money(maxT).replace(/,\d+/, '') + '+' : money(ST.hi).replace(',00', '');
    $$('[data-bar]', el).forEach(b => { const i = b.dataset.bar; const on = i === 'all' ? ST.lo === 0 && ST.hi === Infinity : BAREMS[i][0] === ST.lo && BAREMS[i][1] === ST.hi; b.classList.toggle('on', on); });
  }

  function draw() {
    const pre = base(), list0 = pre.filter(inRange);
    drawRange(pre);
    $('#rrs', el).textContent = `${int(list0.length)} müşteri · ${money(list0.reduce((a, c) => a + c.total, 0))}`;
    $('#rtt', el).innerHTML = TIERS.map(T => { const xs = list0.filter(c => c.tier === T.k); return `<button class="card rt-tier ${ST.tier === T.k ? 'on' : ''}" data-t="${T.k}" style="--tc:${T.c}"><div class="rt-dot"></div><div><div class="rt-tn">${T.t} müşteriler</div><div class="muted small">${T.d}</div></div><div class="rt-tc"><b>${int(xs.length)}</b><span class="muted small">${money(xs.reduce((a, c) => a + c.total, 0))}</span></div></button>`; }).join('');
    $('#rtpln', el).textContent = TIERS.find(t => t.k === ST.tier).t;
    if (document.activeElement !== $('#rtx', el)) $('#rtx', el).value = tplOf(ST.tier);
    const sorters = { total: (a, b) => b.total - a.total, orders: (a, b) => b.order_count - a.order_count || b.total - a.total, last: (a, b) => String(b.last_order).localeCompare(String(a.last_order)) };
    const list = list0.filter(c => c.tier === ST.tier).sort(sorters[ST.sort] || sorters.total);
    $$('th[data-s]', el).forEach(th => th.classList.toggle('on', th.dataset.s === ST.sort));
    const shown = list.slice(0, 300);
    $('#rtb', el).innerHTML = shown.map(c => `<tr class="click rt-r ${ST.open === c.id ? 'open' : ''}" data-id="${c.id}">
      <td><div class="t-title">${esc(c.name)}${c.due ? ' <span class="pill" style="background:#ff6b4a22;color:#ff8b6e">ZAMANI GELDİ</span>' : ''}</div><div class="t-sub">${esc(phoneFmt(c.phone) || 'telefon yok')} · ${c.brand_ids.map(bName).map(esc).join(', ')}</div></td>
      <td class="t-sub">${esc([c.ilce, c.il].filter(Boolean).join(' / ') || '—')}</td>
      <td class="r">${int(c.order_count)}</td><td class="r">${moneyHtml(c.total)}</td>
      <td>${dmy(c.last_order)}<div class="t-sub">${daysAgo(c)}</div></td>
      <td class="t-sub">${contactTxt(c.last_contact)}</td>
      <td class="r nowrap">${c.phone ? `<a class="btn sm" data-call="${c.id}" href="tel:${esc(c.phone)}">${icon('phone')} Ara</a> <a class="btn sm wa" data-wa="${c.id}" target="_blank" rel="noopener" href="${waLink(c.phone)}?text=${encodeURIComponent(msgFor(c))}">WhatsApp'tan yaz</a>` : '<span class="muted small">telefon yok</span>'}</td></tr>
      ${ST.open === c.id ? `<tr class="rt-detail"><td colspan="7"><div id="rtd" class="muted">Faturalar yükleniyor…</div></td></tr>` : ''}`).join('') || `<tr><td colspan="7"><div class="empty">Bu filtrede ${TIERS.find(t => t.k === ST.tier).t.toLocaleLowerCase('tr')} müşteri yok.</div></td></tr>`;
    if (list.length > shown.length) $('#rtb', el).insertAdjacentHTML('beforeend', `<tr><td colspan="7" class="muted small">İlk 300 müşteri gösteriliyor (${int(list.length)} toplam). Filtreyi daraltın.</td></tr>`);
    bindRows(list);
    save();
  }

  async function openDetail(c) {
    const box = $('#rtd', el); if (!box) return;
    try {
      const d = await api('/customers/' + c.id + '?all=1');
      box.classList.remove('muted');
      box.innerHTML = `<div class="rt-inv-hd"><b>Satış faturaları</b><span class="muted small">${int(d.invoices.length)} fatura · ortalama sepet ${money(c.avg_basket)}${c.avg_gap ? ` · ~${c.avg_gap} günde bir sipariş` : ''}</span><span class="sp"></span><a class="btn sm" href="#/genel/musteri/${c.id}">Müşteri kartı</a></div>
      <table class="tbl compact"><thead><tr><th>Tarih</th><th>Marka</th><th>Ürünler</th><th class="r">Toplam</th></tr></thead><tbody>${d.invoices.map(i => `<tr class="click" data-inv="${i.id}" data-b="${i.brand_id}"><td>${dmy(i.date)}</td><td class="t-sub">${esc(bName(i.brand_id))}</td><td class="t-sub">${esc(i.lines_summary || i.invoice_no || '')}</td><td class="r">${moneyHtml(i.total)}</td></tr>`).join('')}</tbody></table>`;
      $$('[data-inv]', box).forEach(tr => tr.onclick = () => { location.hash = `#/b/${tr.dataset.b}/fatura/${tr.dataset.inv}`; });
    } catch (e) { box.textContent = e.message; }
  }

  function bindRows(list) {
    $$('tr.rt-r', el).forEach(tr => tr.onclick = e => {
      if (e.target.closest('a,button')) return;
      const id = Number(tr.dataset.id); ST.open = ST.open === id ? null : id; draw();
      if (ST.open) openDetail(list.find(c => c.id === id));
    });
    const mark = async (id, kind) => { const c = all.find(x => x.id === Number(id)); try { const r = await api.post(`/customers/${id}/contact`, { kind, ids: c.member_ids }); c.last_contact = r.last_contact; setTimeout(draw, 300); } catch { } };
    $$('[data-call]', el).forEach(a => a.onclick = () => mark(a.dataset.call, 'call'));
    $$('[data-wa]', el).forEach(a => a.onclick = () => mark(a.dataset.wa, 'wa'));
  }

  // filtreler
  let tm;
  $('#rq', el).oninput = e => { clearTimeout(tm); tm = setTimeout(() => { ST.q = e.target.value.trim(); draw(); }, 250); };
  for (const [id, k] of [['#rb', 'brand'], ['#ri', 'il'], ['#rc', 'cat'], ['#ro', 'orders']]) $(id, el).onchange = e => { ST[k] = e.target.value; draw(); };
  for (const [id, k] of [['#rp', 'phone'], ['#rd', 'due'], ['#rf', 'fresh']]) $(id, el).onchange = e => { ST[k] = e.target.checked; draw(); };
  const lo = $('#rlo', el), hi = $('#rhi', el);
  const onSlide = () => { let a = +lo.value, b = +hi.value; if (a > b - 10) { if (document.activeElement === lo) a = b - 10; else b = a + 10; lo.value = a; hi.value = b; } ST.lo = toVal(a); ST.hi = toVal(b); draw(); };
  lo.oninput = hi.oninput = onSlide;
  const parseTL = v => { const n = Number(String(v).replace(/[^\d]/g, '')); return isFinite(n) ? n : 0; };
  $('#rmin', el).onchange = e => { ST.lo = parseTL(e.target.value); lo.value = toPos(ST.lo); draw(); };
  $('#rmax', el).onchange = e => { const v = parseTL(e.target.value); ST.hi = !v || /\+/.test(e.target.value) ? Infinity : v; hi.value = toPos(ST.hi); draw(); };
  $$('[data-bar]', el).forEach(b => b.onclick = () => { const i = b.dataset.bar; [ST.lo, ST.hi] = i === 'all' ? [0, Infinity] : BAREMS[i]; lo.value = toPos(ST.lo); hi.value = toPos(ST.hi); draw(); });
  $('#rtt', el).onclick = e => { const b = e.target.closest('[data-t]'); if (!b) return; ST.tier = b.dataset.t; ST.open = null; draw(); };
  $$('th[data-s]', el).forEach(th => th.onclick = () => { ST.sort = th.dataset.s; draw(); });
  $('#rts', el).onclick = async () => { const tpls = { ...(R.templates || {}), [ST.tier]: $('#rtx', el).value.trim() }; await api.put('/settings', { rt_templates: tpls }); R.templates = tpls; S.boot.settings.rt_templates = tpls; toast('Şablon kaydedildi'); draw(); };
  draw();
}
