// Otomatik Satış Gir: WhatsApp metni / ekran görüntüsü → önizleme → onay → fatura
import { S, api, esc, $, $$, icon, toast, money, int, dmy, today, parseNum, numIn, phoneFmt, phoneNorm, pill, srcById, payById, repById, loadCatalog, searchCatalog, variantById, autocomplete, matchIl, matchIlce, ilIlce, shrinkImage, modal, confirmBox, fold } from './core.js';
import { setTitle } from './app.js';

const MAX_IMG = 20;
const R_DATE = () => (STATE && STATE.result && STATE.result.date) || '';
const FIELD_TR = { customer_name: 'Ad Soyad', phone: 'Telefon', address: 'Adres', il: 'İl', ilce: 'İlçe', source: 'Kaynak', payment: 'Ödeme', items: 'Ürün', phone_format: 'Telefon biçimi' };
let STATE = null; // sayfa değişse de taslak kaybolmasın (aynı oturumda)

export async function autoPage(ctx) {
  const { brand, el, query } = ctx;
  setTitle(`<span class="crumb"><a href="#/b/${brand}/faturalar">Satış Faturaları</a> › </span>Otomatik Satış Gir`);
  await loadCatalog();
  if (query.get('tab') === 'gecmis') return history(ctx);
  if (!STATE || STATE.brand !== brand) STATE = { brand, text: '', images: [], date: '', result: null };
  const hasKey = S.boot.hasApiKey;
  el.innerHTML = `
  <div class="tabs"><a class="on" href="#/b/${brand}/otomatik">Yeni giriş</a><a href="#/b/${brand}/otomatik?tab=gecmis">Geçmiş ve doğruluk</a></div>
  <div class="card"><div class="bd" style="padding-top:18px">
    <div class="drop" id="drop">
      <textarea class="in" id="txt" placeholder="WhatsApp sevkiyat grubundan mesajları seçip kopyalayın ve buraya yapıştırın.&#10;Tarih, müşteri, ürün, fiyat, kaynak (Wp/insta/Mağaza) ve temsilci (M.cemal vb.) otomatik okunur.">${esc(STATE.text)}</textarea>
      <div class="thumbs" id="th"></div>
      <div class="row wrap ${hasKey ? '' : 'hidden'}" style="padding:6px 4px 0"><label class="btn sm">${icon('image')} Görsel seç<input type="file" id="file" accept="image/*" multiple hidden></label><span class="muted small" id="imgc"></span></div>
    </div>
    <div class="row wrap" style="margin-top:14px;gap:14px">
      <label class="field"><span>Tarih (sadece mesajda [tarih saat] yoksa)</span><input class="in" type="date" id="date" value="${esc(STATE.date)}" style="width:210px"></label>
      <div class="row" style="align-self:end;gap:6px"><button class="btn sm" data-d="0">Bugün</button><button class="btn sm" data-d="-1">Dün</button></div>
      <span class="sp"></span>
      ${hasKey ? `<label class="chk small" style="align-self:end"><input type="checkbox" id="rule"> Metni kural tabanlı oku (API kullanma)</label>` : ''}
      <button class="btn pri up" id="go" style="align-self:end;height:44px">${icon('spark')} Oluştur</button>
    </div>
  </div></div>
  <div id="res"></div>`;
  const txt = $('#txt', el), drop = $('#drop', el), dateEl = $('#date', el);
  txt.oninput = () => STATE.text = txt.value;
  dateEl.onchange = () => STATE.date = dateEl.value;
  $$('[data-d]', el).forEach(b => b.onclick = () => { const d = new Date(today() + 'T12:00:00'); d.setDate(d.getDate() + Number(b.dataset.d)); dateEl.value = d.toISOString().slice(0, 10); STATE.date = dateEl.value; });
  const drawThumbs = () => {
    $('#th', el).innerHTML = STATE.images.map((src, i) => `<div class="thumb" data-i="${i}"><img src="${src}" alt=""><span class="n">${i + 1}</span><button data-x="${i}" title="Kaldır">✕</button></div>`).join('');
    $('#imgc', el).textContent = STATE.images.length ? `${STATE.images.length}/${MAX_IMG} görsel` : '';
    $$('[data-x]', el).forEach(b => b.onclick = e => { e.stopPropagation(); STATE.images.splice(+b.dataset.x, 1); drawThumbs(); });
    $$('.thumb', el).forEach(t => t.onclick = () => modal({ title: `Görsel ${+t.dataset.i + 1}`, body: `<div class="zoom"><img src="${STATE.images[+t.dataset.i]}"></div>`, wide: true }));
  };
  const addFiles = async files => {
    const imgs = [...files].filter(f => f.type.startsWith('image/'));
    if (!imgs.length) return;
    const room = MAX_IMG - STATE.images.length;
    if (room <= 0) return toast(`En fazla ${MAX_IMG} görsel yüklenebilir.`, true);
    if (imgs.length > room) toast(`En fazla ${MAX_IMG} görsel: ilk ${room} tanesi eklendi.`, true);
    for (const f of imgs.slice(0, room)) STATE.images.push(await shrinkImage(f, 1800, .85));
    drawThumbs();
  };
  $('#file', el).onchange = e => addFiles(e.target.files);
  drop.addEventListener('dragover', e => { e.preventDefault(); drop.classList.add('over'); });
  drop.addEventListener('dragleave', () => drop.classList.remove('over'));
  drop.addEventListener('drop', e => { e.preventDefault(); drop.classList.remove('over'); addFiles(e.dataTransfer.files); });
  txt.addEventListener('paste', e => { const fs = [...(e.clipboardData?.files || [])]; if (fs.length) { e.preventDefault(); addFiles(fs); } });
  drawThumbs();

  $('#go', el).onclick = async () => {
    if (!dateEl.value && !/^\s*\[?\d{1,2}[./]\d{1,2}[./]\d{2,4}/m.test(txt.value)) { dateEl.classList.add('bad'); dateEl.focus(); return toast('Mesajlarda tarih yok; satış tarihini seçin.', true); }
    dateEl.classList.remove('bad');
    if (!txt.value.trim() && !STATE.images.length) return toast('Metin yapıştırın veya görsel ekleyin.', true);
    if (STATE.images.length && !hasKey) return toast('Görsel okumak için API anahtarı gerekli. Görselleri kaldırıp metni yapıştırın.', true);
    const btn = $('#go', el); btn.disabled = true; btn.innerHTML = '<span class="spin"></span> Okunuyor…';
    $('#res', el).innerHTML = `<div class="card"><div class="empty"><span class="spin"></span><div style="margin-top:10px">Mesajlar okunuyor${STATE.images.length ? `, ${STATE.images.length} görsel işleniyor` : ''}… Bu işlem görsel sayısına göre 10–60 sn sürebilir.</div></div></div>`;
    try {
      const r = await api.post('/auto/parse', { brand, date: dateEl.value, text: txt.value, images: STATE.images, engine: $('#rule', el)?.checked ? 'kural' : undefined });
      STATE.result = { ...r, date: dateEl.value, orders: r.orders.map((o, i) => ({ ...o, _raw_index: i, _ok: false, _off: !!(o.duplicate || o.batch_duplicate_of !== undefined || o.exchange) })) };
      drawResult(ctx);
    } catch (e) { $('#res', el).innerHTML = `<div class="notice">${esc(e.message)}</div>`; }
    btn.disabled = false; btn.innerHTML = `${icon('spark')} Oluştur`;
  };
  if (STATE.result) drawResult(ctx);
}


const MISS_TR = { customer_name: 'Ad soyad', phone: 'Telefon', il: 'İl', ilce: 'İlçe', source: 'Kaynak', payment: 'Ödeme', date: 'Tarih', rep: 'Temsilci', items: 'Ürün' };
function missing(o) {
  const m = [];
  if (!o.anonymous) { if (!o.customer_name) m.push('customer_name'); if (!phoneNorm(o.phone)) m.push('phone'); }
  if (!o.source_id) m.push('source');
  if (!o.payment_id && !o.anonymous && !o.is_official && !o.exchange) m.push('payment');
  if (!o.date) m.push('date');
  if (!o.rep_id && !o.rep_raw) m.push('rep');
  if (!(o.items || []).length) m.push('items');
  return m;
}
const SHORT = [[/güvenle eşleşmedi/, 'Ürün bulunamadı'], [/Birden fazla varyant|Marka\/varyant/, 'Ürün emin değil'], [/Freud/, 'Freud yok, en yakını seçildi'], [/Şerit boyu/, 'Boy yok'], [/Adet mesajda net/, 'Adet belirsiz'], [/1 kabul/, 'Adet 1 sayıldı'], [/eşit bölündü/, 'Toplam eşit bölündü'], [/Çıkma/, 'Çıkma ürün'], [/sipariş toplamından/, null], [/birim mi satır/, 'Fiyat birim mi toplam mı?'], [/Fiyat mesajda yok/, 'Fiyat yok']];
const shortWarn = w => { for (const [re, t] of SHORT) if (re.test(w)) return t; return w.replace(/^Belirsiz:\s*/, '').slice(0, 28); };
const itemIssues = it => { const out = [...new Set((it.warnings || []).filter(w => !(/Fiyat mesajda yok/.test(w) && Number(it.unit_price))).map(shortWarn).filter(Boolean))]; if (it.confidence === 'low' && !out.includes('Ürün bulunamadı') && !it.variant_id) out.unshift('Ürün bulunamadı'); return out; };
const itemWarn = it => itemIssues(it).length > 0;
const orderTotal = o => (o.items || []).reduce((a, it) => a + (Number(it.qty) || 0) * (Number(it.unit_price) || 0), 0);

function drawResult(ctx) {
  const { brand, el } = ctx; const R = STATE.result; const box = $('#res', el);
  const orders = R.orders;
  if (!orders.length) { box.innerHTML = '<div class="notice">Mesajlarda sipariş bulunamadı. Metni kontrol edin.</div>'; return; }
  const nCheck = orders.filter(o => !o._off && (missing(o).length || o.items.some(itemWarn))).length;
  const payOpts = S.boot.payments.filter(s => s.active).map(s => `<option value="${s.id}">${esc(s.name)}</option>`).join('');
  box.innerHTML = `<div class="card"><div class="bd" style="padding:16px 18px"><div class="row wrap" style="gap:12px">
      <div><b style="font-size:17px">${orders.length} sipariş</b> <span class="muted">· ${[...new Set(orders.map(o => dmy(o.date || R.date)))].filter(Boolean).join(', ')}</span>
        <div class="small muted" style="margin-top:2px">${nCheck ? `<span style="color:var(--warn)">${nCheck} siparişte eksik/kontrol</span> · ` : ''}değişim, mükerrer olanlar atlandı olarak gelir</div></div>
      <span class="sp"></span>
      <select class="in sm" id="bulkpay" style="width:auto"><option value="">Ödemesi boş olanlara…</option>${payOpts}</select>
      <button class="btn" id="all">${icon('check')} Hepsini onayla</button><button class="btn pri" id="commit">Kaydet (<span id="nok">0</span>)</button></div></div></div>
    <div id="ol" style="display:grid;gap:10px"></div>
    <div class="row"><button class="btn sm ghost" id="addo">+ Elle sipariş ekle</button><span class="sp"></span><button class="btn sm ghost" id="reset">Temizle</button></div>`;
  const ol = $('#ol', box);
  const cnt = () => { $('#nok', box).textContent = orders.filter(o => o._ok && !o._off).length; };
  const draw = () => { ol.innerHTML = orders.map((o, i) => orderCard(o, i)).join(''); orders.forEach((o, i) => bindOrder(ol.querySelector(`.ocard[data-i="${i}"]`), o, i, cnt)); cnt(); };
  draw();
  $('#bulkpay', box).onchange = e => { const v = Number(e.target.value); if (!v) return; orders.forEach(o => { if (!o.payment_id && !o.anonymous && !o.exchange) o.payment_id = v; }); e.target.value = ''; draw(); toast('Ödemesi boş siparişlere uygulandı'); };
  $('#all', box).onclick = () => { orders.forEach(o => { if (!o._off) o._ok = true; }); draw(); };
  $('#reset', box).onclick = () => { STATE.result = null; box.innerHTML = ''; };
  $('#addo', box).onclick = () => { orders.push({ customer_name: '', phone: '', address: '', il: '', ilce: '', source_id: null, payment_id: null, note: '', flags: [], date: R.date || today(), items: [{ description: '', qty: 1, unit_price: 0, warnings: [], confidence: 'low' }], _raw_index: null, _ok: false, _open: true }); draw(); };
  $('#commit', box).onclick = async () => {
    const sel = orders.filter(o => o._ok && !o._off);
    if (!sel.length) return toast('Kaydetmek için siparişleri onaylayın.', true);
    if (sel.some(o => !o.date && !R.date)) return toast('Tarihi olmayan sipariş var.', true);
    const unmatched = sel.flatMap(o => o.items).filter(it => !it.variant_id && it.description).length;
    if (unmatched && !(await confirmBox(`${unmatched} ürün katalogla eşleşmedi; yazıldığı gibi kaydedilecek. Devam?`))) return;
    const btn = $('#commit', box); btn.disabled = true;
    try {
      const r = await api.post('/auto/commit', { brand, date: R.date, batch_id: R.batch_id, orders: sel.map(o => ({ ...o, items: o.items.filter(it => it.description || it.variant_id) })) });
      toast(`${r.invoice_ids.length} satış kaydedildi`);
      try { const b2 = await api('/bootstrap'); S.boot.reps = b2.reps; } catch { }
      const rest = orders.filter(o => !(o._ok && !o._off));
      if (rest.some(o => !o._off)) { R.orders = rest; drawResult(ctx); }
      else { STATE = null; location.hash = `#/b/${brand}/faturalar?auto=${R.batch_id}`; }
    } catch (e) { toast(e.message, true); btn.disabled = false; }
  };
}

function orderCard(o, i) {
  const miss = missing(o);
  const ex = o.existing_customer;
  const rp = repById(o.rep_id); const src = srcById(o.source_id), pay = payById(o.payment_id);
  const chip = (txt, cls, color) => txt ? `<span class="mchip ${cls}"${color ? ` style="--c:${esc(color)}"` : ''}>${esc(txt)}</span>` : '';
  const metaHtml = [chip(dmy(o.date), 'date'), chip(src && src.name, 'src', src && src.color), chip(pay && pay.name, 'pay', pay && pay.color), chip(rp ? rp.name : (o.rep_raw ? o.rep_raw + ' (yeni)' : ''), 'rep'), chip([o.ilce, o.il].filter(Boolean).join(' / '), 'loc')].filter(Boolean).join('');
  const tags = [o.anonymous ? '<span class="pill soft">Mağaza · isimsiz</span>' : ex ? `<span class="badge-old">${ex.orders + 1}. sipariş</span>` : '', o.is_official ? '<span class="pill soft">Resmi</span>' : '', o.exchange ? '<span class="pill warn">Değişim — satış değil</span>' : '', o.duplicate ? `<span class="pill bad">Mükerrer: ${esc(o.duplicate.invoice_no)}</span>` : '', o.batch_duplicate_of !== undefined ? `<span class="pill bad">#${o.batch_duplicate_of + 1} ile aynı</span>` : ''].join('');
  const iss = [...miss.map(k => `${MISS_TR[k] || k} yok`), ...(o.items || []).flatMap((it, j) => itemIssues(it).map(t => (o.items.length > 1 ? `${j + 1}. ürün: ` : '') + t.toLowerCase()))];
  return `<div class="ocard ${o._ok && !o._off ? 'ok' : ''} ${o._off ? 'dis' : ''} ${iss.length && !o._off ? 'chk' : ''}" data-i="${i}">
    ${iss.length && !o._off ? `<div class="chkbar" data-open>${icon('warn')}<b>Kontrol et:</b> ${iss.map(esc).join(' · ')}</div>` : ''}
    <div class="top"><span class="num">${i + 1}</span>
      <div class="who"><input data-k="customer_name" value="${esc(o.customer_name)}" placeholder="${o.anonymous ? 'Mağaza müşterisi (isimsiz)' : 'Ad soyad'}"><div class="meta">${metaHtml} ${tags}</div></div>
      <div class="sum">${money(orderTotal(o))}${o.order_total != null && Math.abs(o.order_total - orderTotal(o)) > 1 ? `<small>mesajda ${money(o.order_total)}</small>` : ''}</div>
      <div class="row" style="gap:6px"><label class="chk-ok ${o._ok && !o._off ? 'on' : ''}"><input type="checkbox" data-a="ok" ${o._ok ? 'checked' : ''}>${icon('check')} Onayla</label><button class="btn sm ghost icon" data-a="off" title="${o._off ? 'Geri al' : 'Atla'}">${icon(o._off ? 'history' : 'x')}</button></div></div>
    <div class="items">${(o.items || []).map((it, j) => itemRow(it, j)).join('')}</div>
    <div class="foot">
      <details ${o._open ? 'open' : ''}><summary>${icon('pen')} Detaylar</summary></details><button class="btn sm ghost" data-a="additem">+ Ürün</button></div>
    <div class="detail ${o._open ? '' : 'hidden'}">
      <div class="dgrid">
        <label class="field"><span>Telefon</span><input class="in sm" data-k="phone" value="${esc(phoneNorm(o.phone) ? phoneFmt(o.phone) : o.phone)}"></label>
        <label class="field"><span>İl</span><input class="in sm" data-k="il" value="${esc(o.il)}"></label>
        <label class="field"><span>İlçe</span><input class="in sm" data-k="ilce" value="${esc(o.ilce)}"></label>
        <label class="field"><span>Tarih</span><input class="in sm" type="date" data-k="date" value="${esc(o.date || R_DATE())}"></label>
        <label class="field"><span>Kaynak</span><select class="in sm" data-k="source_id"><option value="">Seçin</option>${S.boot.sources.filter(s => s.active).map(s => `<option value="${s.id}" ${o.source_id === s.id ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}</select></label>
        <label class="field"><span>Ödeme</span><select class="in sm" data-k="payment_id"><option value="">Seçin</option>${S.boot.payments.filter(s => s.active).map(s => `<option value="${s.id}" ${o.payment_id === s.id ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}</select></label>
        <label class="field"><span>Temsilci</span><select class="in sm" data-k="rep_id"><option value="">${o.rep_raw && !o.rep_id ? `Yeni: ${esc(o.rep_raw)}` : 'Belirtilmemiş'}</option>${(S.boot.reps || []).filter(s => s.active).map(s => `<option value="${s.id}" ${o.rep_id === s.id ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}</select></label>
        <label class="field"><span>Resmi satış</span><select class="in sm" data-k="is_official"><option value="">Hayır</option><option value="1" ${o.is_official ? 'selected' : ''}>Evet</option></select></label>
        <label class="field wide"><span>Adres</span><input class="in sm" data-k="address" value="${esc(o.address)}"></label>
        <label class="field wide"><span>Not</span><input class="in sm" data-k="note" value="${esc(o.note || '')}"></label>
        ${o.is_official ? `<label class="field wide"><span>Resmi unvan</span><input class="in sm" data-k="official_title" value="${esc(o.official_title || '')}"></label><label class="field"><span>VKN / TCKN</span><input class="in sm" data-k="tax_no" value="${esc(o.tax_no || '')}"></label><label class="field"><span>Vergi dairesi</span><input class="in sm" data-k="tax_office" value="${esc(o.tax_office || '')}"></label>` : ''}
      </div>
      ${o.raw_text ? `<div class="raw-msg">${esc(o.raw_text)}</div>` : ''}
    </div></div>`;
}
function itemRow(it, j) {
  const warn = itemWarn(it);
  const alts = (it.alternatives || []).filter(a => a.variant_id !== it.variant_id).slice(0, 5);
  const issues = itemIssues(it);
  return `<div class="irow ${warn ? 'warn' : ''}" data-j="${j}">
    <div class="ac"><input class="in" data-ik="description" value="${esc(it.description)}" placeholder="Ürün ara" title="${esc(it.raw_text || '')}"></div>
    <input class="in" data-ik="qty" inputmode="decimal" value="${esc(numIn(it.qty))}" title="Adet">
    <input class="in" data-ik="unit_price" inputmode="decimal" value="${esc(numIn(it.unit_price))}" placeholder="Fiyat" title="Birim fiyat">
    <input class="in lt" data-ik="line_total" inputmode="decimal" value="${esc(numIn((Number(it.qty) || 0) * (Number(it.unit_price) || 0)))}" title="Satır toplamı">
    <button class="x" data-a="rmitem" title="Sil">${icon('x')}</button>
    ${it.is_band ? `<div class="ihint band">${icon('saw')} Boy <input class="in sm" data-ik="band_length_mm" inputmode="decimal" value="${esc(numIn(it.band_length_mm))}" style="width:90px;height:28px"> mm${it.band_length_mm ? ` · ${numIn(Math.round(it.band_length_mm * (it.qty || 0) / 10) / 100)} m` : ''}</div>` : ''}
    <div class="isrc">${warn ? issues.map(t => `<span class="wtag">${esc(t)}</span>`).join('') : ''}${it.raw_text ? `<span class="raw">Mesajda: ${esc(it.raw_text)}</span>` : ''}${warn && alts.length ? `<select class="in" data-ik="alt"><option value="">Başka ürün seç…</option>${alts.map(a => `<option value="${a.variant_id}">${esc(a.name)} — ${esc(a.label)}</option>`).join('')}</select>` : ''}</div>
  </div>`;
}

function bindOrder(card, o, i, cnt) {
  const redraw = () => { const n = document.createElement('div'); n.innerHTML = orderCard(o, i); const nc = n.firstElementChild; card.replaceWith(nc); card = nc; bindOrder(nc, o, i, cnt); cnt(); };
  card.querySelector('[data-a=ok]').onchange = e => { o._ok = e.target.checked; if (o._ok) o._off = false; redraw(); };
  card.querySelector('[data-a=off]').onclick = () => { o._off = !o._off; if (o._off) o._ok = false; redraw(); };
  const det = card.querySelector('details'), detail = card.querySelector('.detail');
  det.addEventListener('toggle', () => { o._open = det.open; detail.classList.toggle('hidden', !det.open); });
  $$('[data-open]', card).forEach(b => b.onclick = () => { det.open = true; });
  $$('[data-k]', card).forEach(inp => {
    inp.onchange = () => {
      const k = inp.dataset.k; let v = inp.value;
      if (['source_id', 'payment_id', 'rep_id'].includes(k)) v = v ? Number(v) : null;
      if (k === 'is_official') v = !!v;
      if (k === 'phone') { const n = phoneNorm(v); if (n) v = n; }
      if (k === 'il') { const m = matchIl(v); if (m) v = m; }
      if (k === 'ilce') { const m = matchIlce(o.il, v); if (m) v = m; }
      if (k === 'customer_name' && v.trim()) o.anonymous = false;
      o[k] = v;
      if (k !== 'customer_name' && k !== 'note' && k !== 'address') redraw();
    };
  });
  const il = card.querySelector('[data-k=il]'), ilce = card.querySelector('[data-k=ilce]'); if (il && ilce) ilIlce(il, ilce);
  $$('.irow', card).forEach(row => {
    const it = o.items[+row.dataset.j];
    const d = row.querySelector('[data-ik=description]');
    const pick = v => { Object.assign(it, { variant_id: v.id, product_id: v.p.id, description: v.text, is_band: !!v.p.is_band, confidence: 'ok', warnings: (it.warnings || []).filter(w => !/eşleş|varyant|Marka|Freud/i.test(w)) }); if (!it.is_band) it.band_length_mm = null; redraw(); };
    autocomplete(d, q => searchCatalog(q, 40).map(v => ({ html: `<b>${esc(v.p.name)}</b> <small>${esc(v.label)}</small>`, group: `${v.p.category} › ${v.p.subcategory}`, v })), x => pick(x.v));
    d.oninput = () => { it.description = d.value; it.variant_id = null; it.product_id = null; };
    const alt = row.querySelector('[data-ik=alt]'); if (alt) alt.onchange = () => { const v = variantById(alt.value); if (v) pick(v); };
    const upd = () => { const s = card.querySelector('.sum'); if (s) s.firstChild.textContent = money(orderTotal(o)); };
    for (const k of ['qty', 'unit_price', 'band_length_mm']) { const x = row.querySelector(`[data-ik=${k}]`); if (x) { x.onchange = () => { const re = { qty: /Adet/, unit_price: /Fiyat|eşit bölündü|birim mi/, band_length_mm: /Şerit boyu/ }[k]; const before = (it.warnings || []).length; it.warnings = (it.warnings || []).filter(w => !re.test(w)); if (it.warnings.length !== before) redraw(); }; } if (x) x.oninput = () => { it[k] = parseNum(x.value); if (k === 'qty') it.qty_missing = false; row.querySelector('[data-ik=line_total]').value = numIn((Number(it.qty) || 0) * (Number(it.unit_price) || 0)); upd(); }; }
    const lt = row.querySelector('[data-ik=line_total]'); lt.oninput = () => { const t = parseNum(lt.value); if (t != null && Number(it.qty)) { it.unit_price = +(t / Number(it.qty)).toFixed(4); row.querySelector('[data-ik=unit_price]').value = numIn(it.unit_price); } upd(); };
    row.querySelector('[data-a=rmitem]').onclick = () => { o.items.splice(+row.dataset.j, 1); redraw(); };
  });
  card.querySelector('[data-a=additem]').onclick = () => { o.items.push({ description: '', qty: 1, unit_price: 0, warnings: [], confidence: 'low' }); redraw(); };
}

async function history(ctx) {
  const { brand, el } = ctx;
  const rows = await api('/auto/history?brand=' + brand);
  const done = rows.filter(r => r.stats);
  const ch = done.reduce((a, r) => a + (r.stats.fields_checked || 0), 0), cr = done.reduce((a, r) => a + (r.stats.fields_corrected || 0), 0);
  el.innerHTML = `<div class="tabs"><a href="#/b/${brand}/otomatik">Yeni giriş</a><a class="on" href="#/b/${brand}/otomatik?tab=gecmis">Geçmiş ve doğruluk</a></div>
  <div class="grid4"><div class="card kpi"><div class="t">Okuma partisi</div><div class="v">${int(rows.length)}</div></div><div class="card kpi"><div class="t">Kaydedilen sipariş</div><div class="v">${int(done.reduce((a, r) => a + (r.stats.committed_orders || 0), 0))}</div></div><div class="card kpi"><div class="t">Kontrol edilen alan</div><div class="v">${int(ch)}</div></div><div class="card kpi"><div class="t">Elle düzeltme oranı</div><div class="v">${ch ? '%' + (cr / ch * 100).toFixed(1).replace('.', ',') : '—'}</div><div class="d muted">Önizlemede değiştirdiğiniz alan / tüm alanlar</div></div></div>
  <div class="tbl-wrap"><table class="tbl list"><thead><tr><th>Tarih</th><th>Satış tarihi</th><th>Girdi</th><th>Okuma</th><th class="r">Bulunan</th><th class="r">Kaydedilen</th><th class="r">Düzeltme</th><th>En çok düzeltilen</th></tr></thead><tbody>
  ${rows.map(r => { const s = r.stats || {}; const top = Object.entries(s.per_field || {}).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, v]) => `${k} (${v})`).join(', '); return `<tr class="click" data-id="${r.id}"><td>${dmy(r.created_at)}</td><td>${dmy(r.sale_date)}</td><td class="t-sub">${r.image_count ? r.image_count + ' görsel · ' : ''}${esc((r.preview || '').slice(0, 70))}</td><td class="t-sub">${esc(r.engine)}</td><td class="r">${s.parsed_orders ?? '—'}</td><td class="r">${s.committed_orders ?? (r.status === 'parsed' ? 'kaydedilmedi' : '—')}</td><td class="r">${s.fields_checked ? '%' + (s.error_rate * 100).toFixed(1).replace('.', ',') : '—'}</td><td class="t-sub">${esc(top)}</td></tr>`; }).join('') || '<tr><td colspan="8"><div class="empty">Henüz otomatik giriş yapılmadı.</div></td></tr>'}
  </tbody></table></div>`;
  $$('tr[data-id]', el).forEach(tr => tr.onclick = async () => {
    const d = await api('/auto/history/' + tr.dataset.id);
    modal({ title: `Parti #${d.id} · ${dmy(d.sale_date)}`, wide: true, body: `${d.input_text ? `<div class="label">Girdi metni</div><div class="raw-msg">${esc(d.input_text)}</div>` : ''}${(d.image_keys || []).length ? `<div class="thumbs">${d.image_keys.map(k => `<a class="thumb" href="/api/auto/image/${encodeURIComponent(k)}" target="_blank"><img src="/api/auto/image/${encodeURIComponent(k)}"></a>`).join('')}</div>` : ''}<div class="label">Okunan siparişler</div><div class="raw-msg">${esc(d.raw_result.map((o, i) => `#${i + 1} ${o.customer_name} · ${o.phone} · ${o.il}/${o.ilce}\n   ${o.items.map(it => `${it.qty}× ${it.description}${it.band_length_mm ? ' (' + it.band_length_mm + ' mm)' : ''} @ ${it.unit_price}`).join('\n   ')}`).join('\n'))}</div>${d.stats ? `<div class="helpbox">Kontrol edilen alan: <b>${d.stats.fields_checked}</b> · düzeltilen: <b>${d.stats.fields_corrected}</b> · atlanan sipariş: <b>${d.stats.dropped_orders}</b> · elle eklenen: <b>${d.stats.added_orders}</b></div>` : ''}<a class="btn sm" href="#/b/${brand}/faturalar?auto=${d.id}">Bu partinin faturaları</a>`, onOpen: (m, close) => m.querySelectorAll('a.btn').forEach(a => a.addEventListener('click', close)) });
  });
}
