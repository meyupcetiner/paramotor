// Satış Faturaları listesi + Yeni/Düzenle fatura formu (Paraşüt düzeni, istenen değişikliklerle)
import { S, api, esc, $, $$, icon, toast, money, moneyHtml, int, dmy, today, parseNum, numIn, phoneFmt, phoneNorm, pill, srcById, payById, repById, brandById, loadCatalog, searchCatalog, variantById, autocomplete, tagPicker, ilIlce, matchIl, matchIlce, confirmBox, exportCSV, exportXLS, fold, rangePreset } from './core.js';
import { setTitle } from './app.js';

const FILTER_KEYS = ['from', 'to', 'source', 'payment', 'rep', 'official', 'il', 'ilce', 'product', 'category', 'customer', 'first', 'auto'];
const LABELS = { from: 'Başlangıç', to: 'Bitiş', source: 'Kaynak', payment: 'Ödeme', rep: 'Temsilci', official: 'Resmi', il: 'İl', ilce: 'İlçe', product: 'Ürün', category: 'Kategori', customer: 'Müşteri', first: 'Müşteri tipi', auto: 'Otomatik parti' };

const nf = n => String(+n).replace('.', ',');
const BAND_T = { Karbon: 'Karbon Şerit', Bimetal: 'Bimetal Şerit', Ahşap: 'Ahşap Şeridi', 'Et-Kemik': 'Et Şeridi', Carbide: 'Carbide Şerit', 'Kağıt-Sünger': 'Sünger Şeridi' };
const CIRC_T = { Ahşap: 'Ahşap', 'MDF-Suntalam': 'MDF', 'Alüminyum-PVC': 'Alüminyum', Metal: 'Metal', Betopan: 'Betopan' };
// Kısa ürün başlığı: "DryCut 305x80", "Schuster Ahşap Şeridi 4100x25"
export function shortLabel(l) {
  if (!l.pname) { const d = String(l.description || '').replace(/\s+/g, ' ').trim(); return d.length > 42 ? d.slice(0, 40) + '…' : d; }
  const n = l.pname;
  if (l.is_band) { const t = BAND_T[l.subcategory] || 'Şerit'; const size = l.band_length_mm && l.vwidth ? `${Math.round(l.band_length_mm)}x${nf(l.vwidth)}` : l.vwidth ? `${nf(l.vwidth)}x${nf(l.vthick)}` : ''; return [l.mfr, t, size].filter(Boolean).join(' '); }
  if (/dry\s*cut/i.test(n)) return `${/paslanmaz/i.test(n) ? 'Paslanmaz ' : ''}DryCut${l.vdia ? ` ${nf(l.vdia)}x${l.vteeth || ''}` : ''}`.replace(/x$/, '');
  if (l.vdia && l.vteeth) { const t = /ağaç/i.test(n) ? 'Ağaç' : /çizici/i.test(n) ? 'Çizici' : /freze/i.test(n) ? 'Freze' : /portatif/i.test(n) ? 'Portatif' : (CIRC_T[l.subcategory] || ''); return [l.mfr, t, `${nf(l.vdia)}x${l.vteeth}`].filter(Boolean).join(' '); }
  if (l.vdia) return `${n.replace(/\s*\(.*?\)/g, '')} ${nf(l.vdia)}${l.vthick ? 'x' + nf(l.vthick) : ''}`;
  return n.replace(/\s*\(.*?\)/g, '');
}
const shortLine = l => (l.qty && +l.qty !== 1 ? `${int(l.qty)}× ` : '') + shortLabel(l);

export async function invoicesPage(ctx) {
  const { brand, query, el } = ctx;
  setTitle('Satış Faturaları');
  const page = Number(query.get('page') || 1);
  const qs = new URLSearchParams(query); qs.set('brand', brand); qs.set('page', page); qs.set('per', 25);
  const [d] = await Promise.all([api('/invoices?' + qs), loadCatalog()]);
  const active = FILTER_KEYS.filter(k => query.get(k));
  const chipVal = k => { const v = query.get(k); if (k === 'source') return v.split(',').map(x => x === 'none' ? 'Belirsiz' : (srcById(x) || {}).name).join(', '); if (k === 'payment') return v.split(',').map(x => x === 'none' ? 'Belirsiz' : (payById(x) || {}).name).join(', '); if (k === 'rep') return v.split(',').map(x => x === 'none' ? 'Belirtilmemiş' : (repById(x) || {}).name).join(', '); if (k === 'official') return v === '1' ? 'Resmi' : 'Gayriresmi'; if (k === 'first') return v === '1' ? 'İlk sipariş (yeni)' : 'Tekrar sipariş'; if (k === 'product') { const p = S.catalog.find(x => x.id === Number(v)); return p ? p.name : v; } if (k === 'from' || k === 'to') return dmy(v); return v; };
  const pages = Math.max(1, Math.ceil(d.summary.count / d.per));
  el.innerHTML = `
  <div class="toolbar">
    <div class="searchbar"><button class="fbtn ${active.length ? 'on' : ''}" id="fb">${icon('filter')} Filtrele${active.length ? ` (${active.length})` : ''} ▾</button><input id="q" placeholder="Ara… (müşteri, telefon, fatura no, ürün)" value="${esc(query.get('q') || '')}">${icon('search')}</div>
    <a class="btn up" href="#/b/${brand}/otomatik" style="height:46px">${icon('spark')} Otomatik Gir</a>
    <a class="btn pri up" href="#/b/${brand}/fatura/yeni" style="height:46px">Yeni Satış Oluştur</a>
  </div>
  <div class="card hidden" id="fp"><div class="filters">
    <div class="field"><span>Tarih aralığı</span><div class="row"><input class="in sm" type="date" data-f="from" value="${esc(query.get('from') || '')}"><input class="in sm" type="date" data-f="to" value="${esc(query.get('to') || '')}"></div></div>
    <div class="field"><span>Hazır aralık</span><select class="in sm" id="preset"><option value="">Seçin</option><option value="today">Bugün</option><option value="week">Bu hafta</option><option value="month">Bu ay</option><option value="lastmonth">Geçen ay</option><option value="90">Son 90 gün</option><option value="year">Bu yıl</option></select></div>
    <div class="field"><span>Kaynak</span><select class="in sm" data-f="source"><option value="">Tümü</option>${S.boot.sources.map(s => `<option value="${s.id}" ${query.get('source') === String(s.id) ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}<option value="none" ${query.get('source') === 'none' ? 'selected' : ''}>Belirsiz</option></select></div>
    <div class="field"><span>Ödeme yöntemi</span><select class="in sm" data-f="payment"><option value="">Tümü</option>${S.boot.payments.map(s => `<option value="${s.id}" ${query.get('payment') === String(s.id) ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}<option value="none" ${query.get('payment') === 'none' ? 'selected' : ''}>Belirsiz</option></select></div>
    <div class="field"><span>Satış temsilcisi</span><select class="in sm" data-f="rep"><option value="">Tümü</option>${(S.boot.reps || []).map(s => `<option value="${s.id}" ${query.get('rep') === String(s.id) ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}<option value="none" ${query.get('rep') === 'none' ? 'selected' : ''}>Belirtilmemiş</option></select></div>
    <div class="field"><span>Resmi / gayriresmi</span><select class="in sm" data-f="official"><option value="">Tümü</option><option value="1" ${query.get('official') === '1' ? 'selected' : ''}>Resmi satış</option><option value="0" ${query.get('official') === '0' ? 'selected' : ''}>Gayriresmi</option></select></div>
    <div class="field"><span>İl</span><input class="in sm" data-f="il" value="${esc(query.get('il') || '')}" placeholder="ör. İstanbul"></div>
  </div><div class="row" style="padding:0 16px 14px"><span class="sp"></span><button class="btn sm" id="clr">Filtreleri temizle</button></div></div>
  ${active.length ? `<div class="chips">${active.map(k => `<span class="chip on" data-rm="${k}">${LABELS[k]}: ${esc(chipVal(k))} ✕</span>`).join('')}</div>` : ''}
  <div class="tbl-wrap"><table class="tbl list"><thead><tr><th>Müşteri</th><th>Ürünler</th><th>Tarih</th><th class="r">Toplam</th></tr></thead><tbody>
  ${d.invoices.length ? d.invoices.map(i => { const s = srcById(i.source_id), p = payById(i.payment_id), rp = repById(i.rep_id); return `<tr class="click${i.is_official ? ' official' : ''}" data-id="${i.id}"><td><div class="t-title">${esc(i.title || i.cust_name || 'Mağaza müşterisi')}${i.cust_il ? ` <span class="t-il">${esc(i.cust_il)}</span>` : ''}${i.is_official ? ' <span class="tag-off">RESMİ SATIŞ</span>' : ''}</div><div class="tags">${s ? pill(s.name, s.color) : '<span class="pill out">KAYNAK?</span>'}${p ? pill(p.name, p.color) : '<span class="pill out">ÖDEME?</span>'}${rp ? `<span class="pill soft">${icon('user')} ${esc(rp.name)}</span>` : ''}</div></td>
      <td class="t-prod">${i.lines.map(l => `<div>${esc(shortLine(l))}</div>`).slice(0, 3).join('')}${i.lines.length > 3 ? `<div class="t-sub">+${i.lines.length - 3} kalem</div>` : ''}</td>
      <td>${dmy(i.date)}</td><td class="r">${moneyHtml(i.total)}</td></tr>`; }).join('') : `<tr><td colspan="4"><div class="empty">Kayıt bulunamadı. <a href="#/b/${brand}/fatura/yeni">Yeni satış oluşturun</a> veya <a href="#/b/${brand}/otomatik">otomatik girin</a>.</div></td></tr>`}
  </tbody></table></div>
  <div class="footbar"><button class="btn sm" id="xcsv">${icon('download')} CSV</button><button class="btn sm" id="xxls">${icon('download')} Excel</button>
    <div class="pager"><button data-pg="${page - 1}" ${page <= 1 ? 'disabled' : ''}>‹</button>${pagerNums(page, pages).map(n => n === '…' ? '<button disabled>…</button>' : `<button data-pg="${n}" class="${n === page ? 'on' : ''}">${n}</button>`).join('')}<button data-pg="${page + 1}" ${page >= pages ? 'disabled' : ''}>›</button></div>
    <span class="sp"></span><span class="sumtext">${int(d.summary.count)} Kayıt &nbsp; Toplam <b>${money(d.summary.total)}</b></span></div>`;
  const setQ = (k, v) => { const q = new URLSearchParams(query); if (v) q.set(k, v); else q.delete(k); if (k !== 'page') q.delete('page'); location.hash = `#/b/${brand}/faturalar?${q}`; };
  $('#fb', el).onclick = () => $('#fp', el).classList.toggle('hidden');
  let tm; $('#q', el).oninput = e => { clearTimeout(tm); tm = setTimeout(() => setQ('q', e.target.value.trim()), 350); };
  $$('[data-f]', el).forEach(i => i.onchange = () => setQ(i.dataset.f, i.value));
  $('#preset', el).onchange = e => { if (!e.target.value) return; const [f, t] = rangePreset(e.target.value); const q = new URLSearchParams(query); q.set('from', f); q.set('to', t); q.delete('page'); location.hash = `#/b/${brand}/faturalar?${q}`; };
  $('#clr', el).onclick = () => { location.hash = `#/b/${brand}/faturalar`; };
  $$('[data-rm]', el).forEach(c => c.onclick = () => setQ(c.dataset.rm, ''));
  $$('tr[data-id]', el).forEach(tr => tr.onclick = () => { location.hash = `#/b/${brand}/fatura/${tr.dataset.id}`; });
  $$('[data-pg]', el).forEach(b => b.onclick = () => setQ('page', b.dataset.pg));
  const exportRows = async () => { const q = new URLSearchParams(qs); q.set('per', 500); const all = []; for (let pg = 1; ; pg++) { q.set('page', pg); const r = await api('/invoices?' + q); all.push(...r.invoices); if (all.length >= r.summary.count || !r.invoices.length) break; } return all.map(i => [dmy(i.date), i.invoice_no || '', i.title || '', i.cust_name || '', phoneFmt(i.cust_phone), i.cust_il || '', i.cust_ilce || '', (srcById(i.source_id) || {}).name || 'Belirsiz', (payById(i.payment_id) || {}).name || 'Belirsiz', (repById(i.rep_id) || {}).name || '', i.is_official ? 'Resmi' : 'Gayriresmi', i.lines.map(l => `${l.qty}× ${l.description}${l.band_length_mm ? ` (${l.band_length_mm} mm)` : ''}`).join(' | '), i.subtotal, i.vat_total, i.total]); };
  const H = ['Tarih', 'Fatura No', 'Fatura İsmi', 'Müşteri', 'Telefon', 'İl', 'İlçe', 'Kaynak', 'Ödeme', 'Temsilci', 'Resmi', 'Ürünler', 'KDV Hariç', 'KDV', 'Toplam'];
  $('#xcsv', el).onclick = async () => exportCSV(`satislar-${brand}-${today()}`, H, await exportRows());
  $('#xxls', el).onclick = async () => exportXLS(`satislar-${brand}-${today()}`, [{ name: 'Satış Faturaları', headers: H, rows: await exportRows() }]);
}
function pagerNums(p, n) { const s = new Set([1, n, p - 1, p, p + 1].filter(x => x >= 1 && x <= n)); const a = [...s].sort((x, y) => x - y); const out = []; a.forEach((x, i) => { if (i && x - a[i - 1] > 1) out.push('…'); out.push(x); }); return out; }

// ======================= FATURA FORMU =======================
export async function invoiceForm(ctx, id) {
  const { brand, el } = ctx;
  await loadCatalog();
  const st = S.boot.settings;
  let inv;
  if (id) {
    const d = await api('/invoices/' + id);
    const incl = !!d.prices_incl_vat;
    inv = { ...d, customer: { customer_id: d.customer_id, name: d.cust_name || '', phone: d.cust_phone || '', address: d.cust_address || '', il: d.cust_il || '', ilce: d.cust_ilce || '' },
      lines: d.lines.map(l => ({ product_id: l.product_id, variant_id: l.variant_id, description: l.description, qty: l.qty, unit: l.unit, vat_rate: l.vat_rate, unit_price: incl ? l.unit_price * (1 + l.vat_rate / 100) : l.unit_price, band_length_mm: l.band_length_mm, is_band: !!l.is_band || !!l.band_length_mm })) };
    setTitle(`<span class="crumb"><a href="#/b/${brand}/faturalar">Satış Faturaları</a> › </span>${esc(d.invoice_no || 'Fatura')}`);
  } else {
    let pre = null; if (ctx.query.get('customer')) { try { pre = (await api('/customers/' + Number(ctx.query.get('customer')))).customer; } catch { } }
    inv = { title: '', customer: pre ? { customer_id: pre.id, name: pre.name || '', phone: pre.phone || '', address: pre.address || '', il: pre.il || '', ilce: pre.ilce || '' } : { name: '', phone: '', address: '', il: '', ilce: '' }, ...(pre && pre.is_official ? { is_official: 1, tax_no: pre.tax_no, official_title: pre.official_title, tax_office: pre.tax_office, person_type: pre.person_type } : {}), date: today(), invoice_no: '', order_info: '', note: '', source_id: null, payment_id: null, rep_id: null, is_official: pre && pre.is_official ? 1 : 0, prices_incl_vat: st.prices_incl_vat_default ? 1 : 0, lines: [blankLine()] };
    setTitle(`<span class="crumb"><a href="#/b/${brand}/faturalar">Satış Faturaları</a> › </span>Yeni Fatura`);
  }
  function blankLine() { return { product_id: null, variant_id: null, description: '', qty: 1, unit: 'Adet', unit_price: '', vat_rate: Number(st.default_vat ?? 0) || 0, band_length_mm: null, is_band: false }; }
  const custOrders = { n: id ? inv.customer_order_no : null };
  if (!id && inv.customer.customer_id) { const pc = await api('/customers/' + inv.customer.customer_id); custOrders.n = (pc.invoices || []).length + 1; }

  el.innerHTML = `<form class="form-card" id="f" autocomplete="off">
    <div class="formhead"><div>
      <div class="frow"><div class="ic">${icon('file')}</div><div class="label">Fatura İsmi</div><div><input class="in" name="title" value="${esc(inv.title || '')}" placeholder="Boş bırakılırsa müşteri adı kullanılır"></div><div class="row" style="justify-content:flex-end;gap:8px"><a class="btn up" href="#/b/${brand}/faturalar">Vazgeç</a><button class="btn pri up" type="submit" id="save">Kaydet</button></div></div>
      <div class="frow"><div class="ic">${icon('building')}</div><div class="label">Müşteri</div><div>
        <div class="ac-wrap"><input class="in" name="cname" placeholder="Müşteri ara veya yeni müşteri adı yazın" value="${esc(inv.customer.name)}"><span id="cbadge"></span></div>
        <div class="cust-mini" id="cm">
          <div class="g"><label class="field"><span>Ad Soyad</span><input class="in sm" name="name" value="${esc(inv.customer.name)}"></label><label class="field"><span>Telefon</span><input class="in sm" name="phone" inputmode="tel" value="${esc(phoneFmt(inv.customer.phone))}" placeholder="05XX XXX XX XX"></label></div>
          <label class="field"><span>Adres</span><input class="in sm" name="address" value="${esc(inv.customer.address)}"></label>
          <div class="g"><label class="field"><span>İl</span><input class="in sm" name="il" value="${esc(inv.customer.il)}" placeholder="İl ara"></label><label class="field"><span>İlçe</span><input class="in sm" name="ilce" value="${esc(inv.customer.ilce)}" placeholder="İlçe ara"></label></div>
        </div>
        <label class="chk official-toggle"><input type="checkbox" name="is_official" ${inv.is_official ? 'checked' : ''}> Resmi satış</label>
        <div class="cust-mini ${inv.is_official ? '' : 'hidden'}" id="off">
          <div class="g"><label class="field"><span>VKN / TCKN</span><input class="in sm" name="tax_no" value="${esc(inv.tax_no || '')}" inputmode="numeric"></label><label class="field"><span>Tür</span><select class="in sm" name="person_type"><option value="tuzel" ${inv.person_type !== 'gercek' ? 'selected' : ''}>Tüzel kişi</option><option value="gercek" ${inv.person_type === 'gercek' ? 'selected' : ''}>Gerçek kişi</option></select></label></div>
          <div class="g"><label class="field"><span>Resmi unvan (firma unvanı)</span><input class="in sm" name="official_title" value="${esc(inv.official_title || '')}"></label><label class="field"><span>Vergi dairesi</span><input class="in sm" name="tax_office" value="${esc(inv.tax_office || '')}"></label></div>
        </div>
      </div><div></div></div>
      <div class="frow"><div class="ic">${icon('cal')}</div><div class="label">Düzenleme Tarihi</div><div><input class="in" type="date" name="date" value="${esc(inv.date)}" required></div><div></div></div>
      <div class="frow tight"><div class="ic"></div><div></div><div class="row wrap">
        <button type="button" class="btn up sm" id="addno" ${inv.invoice_no ? 'style="display:none"' : ''}>+ Fatura No Ekle</button>
        <button type="button" class="btn up sm" id="addord" ${inv.order_info ? 'style="display:none"' : ''}>+ Sipariş Bilgisi Ekle</button>
      </div><div></div></div>
      <div class="frow ${inv.invoice_no ? '' : 'hidden'}" id="norow"><div class="ic">${icon('tag')}</div><div class="label">Fatura No</div><div><input class="in" name="invoice_no" value="${esc(inv.invoice_no || '')}" placeholder="Boşsa otomatik verilir (${esc((brandById(brand) || {}).invoice_prefix || '')}-YYYY-0001)"></div><div></div></div>
      <div class="frow ${inv.order_info ? '' : 'hidden'}" id="ordrow"><div class="ic">${icon('box')}</div><div class="label">Sipariş Bilgisi</div><div><input class="in" name="order_info" value="${esc(inv.order_info || '')}" placeholder="Sipariş no, kargo takip vb."></div><div></div></div>
      <div class="frow"><div class="ic">${icon('pen')}</div><div class="label">Fatura Notu</div><div><textarea class="in" name="note" rows="3">${esc(inv.note || '')}</textarea></div><div></div></div>
    </div>
    <aside class="sidebox">
      <div><div class="label" style="margin-bottom:8px">${icon('map')} Kaynak</div><div id="srcp"></div><div class="muted small" style="margin-top:6px;font-style:italic">Siparişin geldiği yer. Raporlarda kaynak bazında dağılımı görürsünüz.</div></div>
      <div><div class="label" style="margin-bottom:8px">${icon('wallet')} Ödeme Yöntemi</div><div id="payp"></div><div class="muted small" style="margin-top:6px;font-style:italic">Havale / kapıda ödeme dağılımı raporlanır.</div></div>
      <div><div class="label" style="margin-bottom:8px">${icon('user')} Satış Temsilcisi</div><div id="repp"></div><div class="muted small" style="margin-top:6px;font-style:italic">Satışı yapan kişi (müşteri değil). Raporlarda temsilci bazında görünür.</div></div>
      ${id ? `<div><button type="button" class="btn danger sm" id="del">${icon('trash')} Faturayı sil</button></div>` : ''}
    </aside></div>
    <div class="lines"><table><thead><tr><th style="width:44%">Hizmet / Ürün</th><th>Miktar</th><th>Birim</th><th>Br. Fiyat</th><th>Vergi</th><th style="text-align:right">Toplam</th><th></th></tr></thead><tbody id="lb"></tbody></table>
      <div class="row wrap" style="padding:10px 16px 4px"><button type="button" class="btn up sm" id="addl">+ Yeni Satır Ekle</button><span class="sp"></span><label class="chk small muted" title="Sadece KDV'li (resmi) satışlarda"><input type="checkbox" name="prices_incl_vat" ${inv.prices_incl_vat ? 'checked' : ''}> Fiyatlar KDV dahil</label></div>
      <div class="totals"><table><tr><td>Ara Toplam</td><td id="t1"></td></tr><tr id="t2r"><td>Toplam KDV</td><td id="t2"></td></tr><tr class="grand"><td>Genel Toplam</td><td id="t3"></td></tr></table></div>
    </div></form>`;

  const f = $('#f', el);
  tagPicker($('#srcp', el), { kind: 'source', value: inv.source_id, onChange: v => inv.source_id = v });
  tagPicker($('#payp', el), { kind: 'payment', value: inv.payment_id, onChange: v => inv.payment_id = v });
  tagPicker($('#repp', el), { kind: 'rep', value: inv.rep_id, onChange: v => inv.rep_id = v });
  ilIlce(f.il, f.ilce);
  $('#addno', el).onclick = e => { e.target.style.display = 'none'; $('#norow', el).classList.remove('hidden'); f.invoice_no.focus(); };
  $('#addord', el).onclick = e => { e.target.style.display = 'none'; $('#ordrow', el).classList.remove('hidden'); f.order_info.focus(); };
  f.is_official.onchange = () => { $('#off', el).classList.toggle('hidden', !f.is_official.checked); if (f.is_official.checked && !f.official_title.value) f.official_title.value = f.name.value; };

  // --- müşteri arama / eşleştirme ---
  const badge = () => {
    const b = $('#cbadge', el);
    if (inv.customer.customer_id) b.innerHTML = `<span class="badge-old">Kayıtlı müşteri${custOrders.n ? ` · ${custOrders.n}. sipariş` : ''}</span>`;
    else b.innerHTML = f.cname.value.trim() || f.name.value.trim() ? '<span class="badge-new">YENİ</span>' : '<span class="badge-old">Boş = mağaza müşterisi</span>';
  };
  const fillCustomer = c => {
    inv.customer.customer_id = c.id;
    f.cname.value = c.name || ''; f.name.value = c.name || ''; f.phone.value = phoneFmt(c.phone);
    f.address.value = c.address || ''; f.il.value = c.il || ''; f.ilce.value = c.ilce || '';
    if (c.is_official) { f.is_official.checked = true; $('#off', el).classList.remove('hidden'); f.tax_no.value = c.tax_no || ''; f.official_title.value = c.official_title || ''; f.tax_office.value = c.tax_office || ''; f.person_type.value = c.person_type || 'tuzel'; }
    custOrders.n = id ? custOrders.n : (c.orders || 0) + 1;
    badge();
  };
  autocomplete(f.cname, async q => { if (q.trim().length < 2) return []; const r = await api(`/customers/lookup?brand=${brand}&q=${encodeURIComponent(q)}`); return r.map(c => ({ html: `<b>${esc(c.name || '—')}</b> <small>${esc(phoneFmt(c.phone))} · ${esc([c.ilce, c.il].filter(Boolean).join('/'))} · ${c.orders} sipariş</small>`, c })); }, it => fillCustomer(it.c), { minLen: 2 });
  f.cname.addEventListener('input', () => { inv.customer.customer_id = null; f.name.value = f.cname.value; badge(); });
  f.name.addEventListener('input', () => { f.cname.value = f.name.value; badge(); });
  f.phone.addEventListener('change', async () => {
    const n = phoneNorm(f.phone.value);
    f.phone.classList.toggle('flag', !!f.phone.value && !n);
    if (!n) return;
    f.phone.value = phoneFmt(n);
    const r = await api(`/customers/lookup?brand=${brand}&q=${n}`);
    if (r[0] && r[0].id !== inv.customer.customer_id) {
      const c = r[0];
      inv.customer.customer_id = c.id; custOrders.n = id ? custOrders.n : (c.orders || 0) + 1;
      if (!f.name.value) { f.name.value = c.name || ''; f.cname.value = c.name || ''; }
      if (!f.address.value) f.address.value = c.address || ''; if (!f.il.value) f.il.value = c.il || ''; if (!f.ilce.value) f.ilce.value = c.ilce || '';
      toast(`Bu numara kayıtlı: ${c.name || ''} (${c.orders} sipariş). Müşteri eşleştirildi.`);
      badge();
    }
  });
  f.il.addEventListener('change', () => { const m = matchIl(f.il.value); if (m) f.il.value = m; f.il.classList.toggle('flag', !!f.il.value && !m); });
  f.ilce.addEventListener('change', () => { const m = matchIlce(f.il.value, f.ilce.value); if (m) f.ilce.value = m; f.ilce.classList.toggle('flag', !!f.ilce.value && !!f.il.value && !m); });
  badge();

  // --- satırlar ---
  const lb = $('#lb', el);
  const drawLines = () => {
    lb.innerHTML = inv.lines.map((l, i) => `<tr class="line" data-i="${i}">
      <td class="prod"><div class="ac"><input class="in" data-k="description" value="${esc(l.description)}" placeholder="Ürün ara: ör. kronberg 300 96, 27x0.9 bimetal">${icon('search')}</div></td>
      <td><input class="in" data-k="qty" inputmode="decimal" value="${esc(numIn(l.qty))}" style="width:90px"></td>
      <td><select class="in" data-k="unit" style="width:100px">${['Adet', 'Metre', 'Paket', 'Takım'].map(u => `<option ${l.unit === u ? 'selected' : ''}>${u}</option>`).join('')}</select></td>
      <td><input class="in" data-k="unit_price" inputmode="decimal" value="${esc(numIn(l.unit_price))}" placeholder="0,00" style="width:130px"></td>
      <td><select class="in" data-k="vat_rate" style="width:90px">${[20, 10, 1, 0].map(v => `<option value="${v}" ${Number(l.vat_rate) === v ? 'selected' : ''}>%${v}</option>`).join('')}</select></td>
      <td style="text-align:right;white-space:nowrap" data-tot></td>
      <td><button type="button" class="btn sm icon" data-rm title="Satırı sil">${icon('x')}</button></td></tr>
      ${l.is_band ? `<tr class="band" data-i="${i}"><td colspan="7"><div class="bandbox">${icon('saw')} Şerit boyu <input class="in sm" data-k="band_len" inputmode="decimal" value="${esc(l.band_length_mm ? numIn(l._cm ? l.band_length_mm / 10 : l.band_length_mm) : '')}" placeholder="ör. 2240"><select class="in sm" data-k="band_unit" style="width:70px"><option value="mm" ${!l._cm ? 'selected' : ''}>mm</option><option value="cm" ${l._cm ? 'selected' : ''}>cm</option></select> × adet = <b data-m></b> <span>· kaynaklı, boyuna kesilmiş şerit</span></div></td></tr>` : ''}`).join('');
    $$('tr.line', lb).forEach(tr => {
      const i = +tr.dataset.i, l = inv.lines[i];
      const inp = tr.querySelector('[data-k=description]');
      autocomplete(inp, q => searchCatalog(q, 40).map(v => ({ html: `<b>${esc(v.p.name)}</b> <small>${esc(v.label)}</small>`, group: `${v.p.category} › ${v.p.subcategory}`, v })), it => {
        Object.assign(l, { product_id: it.v.p.id, variant_id: it.v.id, description: it.v.text, is_band: !!it.v.p.is_band, unit: it.v.p.unit || 'Adet' });
        drawLines(); const nx = lb.querySelector(`tr.band[data-i="${i}"] [data-k=band_len]`) || lb.querySelector(`tr.line[data-i="${i}"] [data-k=qty]`); nx && nx.focus();
      });
      inp.addEventListener('input', () => { l.description = inp.value; if (l.variant_id) { const v = variantById(l.variant_id); if (!v || v.text !== inp.value) { l.variant_id = null; l.product_id = null; } } });
      tr.querySelector('[data-rm]').onclick = () => { inv.lines.splice(i, 1); if (!inv.lines.length) inv.lines.push(blankLine()); drawLines(); };
      for (const k of ['qty', 'unit_price']) tr.querySelector(`[data-k=${k}]`).oninput = e => { l[k] = parseNum(e.target.value); calc(); };
      tr.querySelector('[data-k=unit]').onchange = e => l.unit = e.target.value;
      tr.querySelector('[data-k=vat_rate]').onchange = e => { l.vat_rate = Number(e.target.value); calc(); };
    });
    $$('tr.band', lb).forEach(tr => {
      const l = inv.lines[+tr.dataset.i];
      const len = tr.querySelector('[data-k=band_len]'), un = tr.querySelector('[data-k=band_unit]');
      const upd = () => { const v = parseNum(len.value); l._cm = un.value === 'cm'; l.band_length_mm = v == null ? null : (l._cm ? v * 10 : v); calc(); };
      len.oninput = upd; un.onchange = upd;
    });
    calc();
  };
  const calc = () => {
    const incl = f.prices_incl_vat.checked; let sub = 0, vat = 0;
    inv.lines.forEach((l, i) => {
      const q = Number(l.qty) || 0, r = Number(l.vat_rate) || 0; let p = Number(l.unit_price) || 0; if (incl) p = p / (1 + r / 100);
      const net = q * p; sub += net; vat += net * r / 100;
      const td = lb.querySelector(`tr.line[data-i="${i}"] [data-tot]`); if (td) td.innerHTML = moneyHtml(incl ? net * (1 + r / 100) : net);
      const m = lb.querySelector(`tr.band[data-i="${i}"] [data-m]`); if (m) m.textContent = l.band_length_mm ? `${String(Math.round(l.band_length_mm * q / 10) / 100).replace('.', ',')} m` : '— m';
    });
    $('#t1', el).innerHTML = moneyHtml(sub); $('#t2', el).innerHTML = moneyHtml(vat); $('#t2r', el).style.display = vat > 0 ? '' : 'none'; $('#t3', el).innerHTML = moneyHtml(sub + vat);
  };
  f.prices_incl_vat.onchange = calc;
  $('#addl', el).onclick = () => { inv.lines.push(blankLine()); drawLines(); lb.querySelector(`tr.line[data-i="${inv.lines.length - 1}"] [data-k=description]`).focus(); };
  drawLines();

  if (id) $('#del', el).onclick = async () => { if (!(await confirmBox('Bu fatura kalıcı olarak silinsin mi?'))) return; await api.del('/invoices/' + id); toast('Fatura silindi'); location.hash = `#/b/${brand}/faturalar`; };

  f.onsubmit = async e => {
    e.preventDefault();
    const name = f.name.value.trim();
    const lines = inv.lines.filter(l => l.description || l.variant_id);
    if (!lines.length) return toast('En az bir ürün satırı ekleyin.', true);
    if (f.phone.value && !phoneNorm(f.phone.value) && !(await confirmBox('Telefon numarası 05XX XXX XX XX biçiminde değil. Yine de kaydedilsin mi?'))) return;
    const bad = lines.find(l => l.is_band && !l.band_length_mm);
    if (bad && !(await confirmBox('Şerit satırında boy (mm) girilmemiş. Metraj raporuna yansımaz. Devam edilsin mi?'))) return;
    const payload = {
      brand, title: f.title.value.trim(), date: f.date.value, invoice_no: f.invoice_no.value.trim(), order_info: f.order_info.value.trim(), note: f.note.value.trim(),
      source_id: inv.source_id, payment_id: inv.payment_id, rep_id: inv.rep_id, prices_incl_vat: f.prices_incl_vat.checked ? 1 : 0,
      is_official: f.is_official.checked ? 1 : 0, tax_no: f.tax_no.value.trim(), official_title: f.official_title.value.trim(), tax_office: f.tax_office.value.trim(), person_type: f.person_type.value,
      customer: { customer_id: inv.customer.customer_id || null, name, phone: phoneNorm(f.phone.value) || f.phone.value.trim(), address: f.address.value.trim(), il: f.il.value.trim(), ilce: f.ilce.value.trim() },
      lines: lines.map(l => ({ product_id: l.product_id, variant_id: l.variant_id, description: l.description, qty: Number(l.qty) || 0, unit: l.unit, unit_price: Number(l.unit_price) || 0, vat_rate: l.vat_rate, band_length_mm: l.is_band ? l.band_length_mm : null }))
    };
    $('#save', el).disabled = true;
    try {
      if (id) await api.put('/invoices/' + id, payload); else await api.post('/invoices', payload);
      toast(id ? 'Fatura güncellendi' : 'Fatura kaydedildi');
      location.hash = `#/b/${brand}/faturalar`;
    } catch (err) { toast(err.message, true); $('#save', el).disabled = false; }
  };
}
