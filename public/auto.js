// Otomatik Satış Gir: WhatsApp metni / ekran görüntüsü → önizleme → onay → fatura
import { S, api, esc, $, $$, icon, toast, money, int, dmy, today, parseNum, numIn, phoneFmt, phoneNorm, pill, srcById, payById, loadCatalog, searchCatalog, variantById, autocomplete, matchIl, matchIlce, ilIlce, shrinkImage, modal, confirmBox, fold } from './core.js';
import { setTitle } from './app.js';

const MAX_IMG = 20;
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
  ${hasKey ? '' : `<div class="notice">${icon('warn')} Sunucuda <b>ANTHROPIC_API_KEY</b> tanımlı değil. Şu an sadece <b>yapıştırılan metin</b> kural tabanlı ayrıştırıcıyla okunur; ekran görüntüsü okumak için Cloudflare'de anahtarı tanımlayın (kurulum notlarına bakın).</div>`}
  <div class="card"><div class="bd" style="padding-top:18px">
    <div class="drop" id="drop">
      <textarea class="in" id="txt" placeholder="WhatsApp sevkiyat grubundaki sipariş mesajlarını buraya yapıştırın…&#10;Ekran görüntülerini bu kutuya sürükleyip bırakabilir, Ctrl+V ile yapıştırabilir veya aşağıdan seçebilirsiniz (en fazla ${MAX_IMG} görsel).">${esc(STATE.text)}</textarea>
      <div class="thumbs" id="th"></div>
      <div class="row wrap" style="padding:6px 4px 0"><label class="btn sm">${icon('image')} Görsel seç<input type="file" id="file" accept="image/*" multiple hidden></label><span class="muted small" id="imgc"></span><span class="sp"></span><span class="muted small">Okuma: <b>${hasKey ? 'Claude (metin + görsel)' : 'Kural tabanlı (sadece metin)'}</b></span></div>
    </div>
    <div class="row wrap" style="margin-top:14px;gap:14px">
      <label class="field"><span>Satış tarihi (tüm siparişler bu tarihle kaydedilir) *</span><input class="in" type="date" id="date" value="${esc(STATE.date)}" style="width:210px" required></label>
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
    if (!dateEl.value) { dateEl.classList.add('bad'); dateEl.focus(); return toast('Önce satış tarihini seçin.', true); }
    dateEl.classList.remove('bad');
    if (!txt.value.trim() && !STATE.images.length) return toast('Metin yapıştırın veya görsel ekleyin.', true);
    if (STATE.images.length && !hasKey) return toast('Görsel okumak için API anahtarı gerekli. Görselleri kaldırıp metni yapıştırın.', true);
    const btn = $('#go', el); btn.disabled = true; btn.innerHTML = '<span class="spin"></span> Okunuyor…';
    $('#res', el).innerHTML = `<div class="card"><div class="empty"><span class="spin"></span><div style="margin-top:10px">Mesajlar okunuyor${STATE.images.length ? `, ${STATE.images.length} görsel işleniyor` : ''}… Bu işlem görsel sayısına göre 10–60 sn sürebilir.</div></div></div>`;
    try {
      const r = await api.post('/auto/parse', { brand, date: dateEl.value, text: txt.value, images: STATE.images, engine: $('#rule', el)?.checked ? 'kural' : undefined });
      STATE.result = { ...r, date: dateEl.value, orders: r.orders.map((o, i) => ({ ...o, _raw_index: i, _ok: false, _off: !!(o.duplicate || o.batch_duplicate_of !== undefined) })) };
      drawResult(ctx);
    } catch (e) { $('#res', el).innerHTML = `<div class="notice">${esc(e.message)}</div>`; }
    btn.disabled = false; btn.innerHTML = `${icon('spark')} Oluştur`;
  };
  if (STATE.result) drawResult(ctx);
}

function drawResult(ctx) {
  const { brand, el } = ctx; const R = STATE.result; const box = $('#res', el);
  const orders = R.orders;
  if (!orders.length) { box.innerHTML = '<div class="notice">Mesajlarda sipariş bulunamadı. Metni/görseli kontrol edin.</div>'; return; }
  const nWarn = orders.filter(o => issues(o).length).length;
  box.innerHTML = `<div class="card"><div class="bd" style="padding-top:16px"><div class="row wrap">
      <div><b style="font-size:16px">${orders.length} sipariş bulundu</b> <span class="muted">· ${dmy(R.date)} tarihli · okuma: ${esc(R.engine === 'claude' ? 'Claude' : 'kural tabanlı')}</span><div class="small ${nWarn ? '' : 'pos'}" style="margin-top:2px">${nWarn ? `${icon('warn')} ${nWarn} siparişte kontrol edilmesi gereken alan var (sarı işaretli).` : 'Belirsiz alan yok.'}</div></div>
      <span class="sp"></span><label class="chk small"><input type="checkbox" id="incl" ${S.boot.settings.prices_incl_vat_default ? 'checked' : ''}> Mesajdaki fiyatlar KDV dahil</label>
      <button class="btn" id="all">${icon('check')} Hepsini onayla</button><button class="btn pri up" id="commit">Onaylananları kaydet (<span id="nok">0</span>)</button></div></div></div>
    <div id="ol" style="display:grid;gap:14px"></div>
    <div class="row"><button class="btn sm" id="addo">+ Elle sipariş ekle</button><span class="sp"></span><button class="btn sm ghost" id="reset">Taslağı temizle</button></div>`;
  const ol = $('#ol', box);
  ol.innerHTML = orders.map((o, i) => orderCard(o, i)).join('');
  orders.forEach((o, i) => bindOrder(ctx, ol.querySelector(`.order[data-i="${i}"]`), o, i));
  const cnt = () => { $('#nok', box).textContent = orders.filter(o => o._ok && !o._off).length; };
  cnt();
  box.addEventListener('change', cnt); box.addEventListener('click', () => setTimeout(cnt));
  $('#all', box).onclick = () => { orders.forEach(o => { if (!o._off) o._ok = true; }); drawResult(ctx); };
  $('#reset', box).onclick = () => { STATE.result = null; box.innerHTML = ''; };
  $('#addo', box).onclick = () => { orders.push({ customer_name: '', phone: '', address: '', il: '', ilce: '', source_id: null, payment_id: null, note: '', flags: [], items: [{ description: '', qty: 1, unit_price: 0, warnings: [], confidence: 'low' }], _raw_index: null, _ok: false, source_ref: 'Elle eklendi' }); drawResult(ctx); };
  $('#commit', box).onclick = async () => {
    const sel = orders.filter(o => o._ok && !o._off);
    if (!sel.length) return toast('Kaydetmek için en az bir siparişi onaylayın.', true);
    const unmatched = sel.flatMap(o => o.items).filter(it => !it.variant_id && it.description).length;
    if (unmatched && !(await confirmBox(`${unmatched} ürün satırı katalogla eşleşmedi; serbest metin olarak kaydedilecek. Devam edilsin mi?`))) return;
    const noLen = sel.flatMap(o => o.items).filter(it => it.is_band && !it.band_length_mm).length;
    if (noLen && !(await confirmBox(`${noLen} şerit satırında boy (mm) yok. Metraj raporuna yansımaz. Devam edilsin mi?`))) return;
    const btn = $('#commit', box); btn.disabled = true;
    try {
      const r = await api.post('/auto/commit', { brand, date: R.date, batch_id: R.batch_id, prices_incl_vat: $('#incl', box).checked, orders: sel.map(o => ({ ...o, items: o.items.filter(it => it.description || it.variant_id) })) });
      toast(`${r.invoice_ids.length} fatura oluşturuldu`);
      const rest = orders.filter(o => !(o._ok && !o._off));
      if (rest.length) { R.orders = rest; drawResult(ctx); }
      else { STATE = null; location.hash = `#/b/${brand}/faturalar?auto=${R.batch_id}`; }
    } catch (e) { toast(e.message, true); btn.disabled = false; }
  };
}

function issues(o) {
  const out = [];
  for (const f of o.flags || []) out.push(f);
  if (!phoneNorm(o.phone)) out.push('phone');
  if (!o.source_id) out.push('source'); if (!o.payment_id) out.push('payment');
  if (o.il && !matchIl(o.il)) out.push('il'); if (o.ilce && o.il && !matchIlce(o.il, o.ilce)) out.push('ilce');
  for (const it of o.items || []) if ((it.warnings || []).length || it.confidence !== 'ok') out.push('item');
  if (o.duplicate || o.batch_duplicate_of !== undefined) out.push('dup');
  return [...new Set(out)];
}
const fl = (o, k) => ((o.flags || []).includes(k) || (k === 'phone' && !phoneNorm(o.phone)) || (k === 'source' && !o.source_id) || (k === 'payment' && !o.payment_id) || (k === 'il' && o.il && !matchIl(o.il)) || (k === 'ilce' && o.ilce && o.il && !matchIlce(o.il, o.ilce))) ? 'flag' : '';

function orderCard(o, i) {
  const iss = issues(o);
  const ex = o.existing_customer;
  return `<div class="order ${o._ok ? 'ok' : ''} ${o._off ? 'dis' : ''}" data-i="${i}">
    <div class="oh"><b>#${i + 1}</b><span class="muted small">${esc(o.source_ref || '')}</span>
      ${ex ? `<span class="badge-old">Kayıtlı müşteri · ${ex.orders + 1}. sipariş</span>` : (phoneNorm(o.phone) ? '<span class="badge-new">YENİ MÜŞTERİ</span>' : '')}
      ${o.duplicate ? `<span class="pill bad">Olası mükerrer: ${esc(o.duplicate.invoice_no)} aynı gün/müşteri/ürün</span>` : ''}
      ${o.batch_duplicate_of !== undefined ? `<span class="pill bad">Bu partide #${o.batch_duplicate_of + 1} ile aynı</span>` : ''}
      ${iss.length ? `<span class="pill warn">${iss.length} kontrol</span>` : '<span class="pill ok">Temiz</span>'}
      <span class="sp"></span>
      <label class="chk small"><input type="checkbox" data-a="off" ${o._off ? 'checked' : ''}> Atla</label>
      <label class="chk"><input type="checkbox" data-a="ok" ${o._ok ? 'checked' : ''} ${o._off ? 'disabled' : ''}> <b>Onayla</b></label></div>
    <div class="ob">
      <div class="fgrid">
        <label class="field ${fl(o, 'customer_name')}"><span>Ad Soyad</span><input class="in sm" data-k="customer_name" value="${esc(o.customer_name)}"></label>
        <label class="field ${fl(o, 'phone')}"><span>Telefon</span><input class="in sm" data-k="phone" value="${esc(phoneNorm(o.phone) ? phoneFmt(o.phone) : o.phone)}"></label>
        <label class="field ${fl(o, 'address')}"><span>Adres</span><input class="in sm" data-k="address" value="${esc(o.address)}"></label>
        <label class="field ${fl(o, 'il')}"><span>İl</span><input class="in sm" data-k="il" value="${esc(o.il)}"></label>
        <label class="field ${fl(o, 'ilce')}"><span>İlçe</span><input class="in sm" data-k="ilce" value="${esc(o.ilce)}"></label>
      </div>
      <div class="fgrid2">
        <label class="field ${fl(o, 'source')}"><span>Kaynak</span><select class="in sm" data-k="source_id"><option value="">Belirsiz — seçin</option>${S.boot.sources.filter(s => s.active).map(s => `<option value="${s.id}" ${o.source_id === s.id ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}</select></label>
        <label class="field ${fl(o, 'payment')}"><span>Ödeme yöntemi</span><select class="in sm" data-k="payment_id"><option value="">Belirsiz — seçin</option>${S.boot.payments.filter(s => s.active).map(s => `<option value="${s.id}" ${o.payment_id === s.id ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}</select></label>
        <label class="field"><span>Not</span><input class="in sm" data-k="note" value="${esc(o.note || '')}"></label>
      </div>
      <div style="display:grid;gap:8px">${(o.items || []).map((it, j) => itemRow(it, j)).join('')}</div>
      <div class="row wrap"><button class="btn sm" data-a="additem">+ Ürün satırı</button>${o.order_total != null ? `<span class="muted small">Mesajdaki toplam: <b>${money(o.order_total)}</b> · Satırların toplamı: <b data-sum></b></span>` : `<span class="muted small">Satırların toplamı: <b data-sum></b></span>`}</div>
      ${o.raw_text ? `<details><summary class="muted small" style="cursor:pointer">Mesaj metni</summary><div class="raw-msg">${esc(o.raw_text)}</div></details>` : ''}
    </div></div>`;
}
function itemRow(it, j) {
  const warn = (it.warnings || []).length || it.confidence !== 'ok';
  const alts = (it.alternatives || []).filter(a => a.variant_id !== it.variant_id);
  return `<div class="itemrow ${warn ? 'warn' : ''}" data-j="${j}">
    <div class="ac"><input class="in sm" data-ik="description" value="${esc(it.description)}" placeholder="Ürün ara / seç"></div>
    <label class="field"><span class="small">Adet</span><input class="in sm ${it.qty_missing ? 'flag' : ''}" data-ik="qty" inputmode="decimal" value="${esc(numIn(it.qty))}"></label>
    <label class="field ${it.is_band ? '' : 'hidden'}"><span class="small">Şerit boyu (mm)</span><input class="in sm ${it.is_band && !it.band_length_mm ? 'flag' : ''}" data-ik="band_length_mm" inputmode="decimal" value="${esc(numIn(it.band_length_mm))}"></label>
    ${it.is_band ? '' : '<span></span>'}
    <label class="field"><span class="small">Br. fiyat</span><input class="in sm ${!it.unit_price ? 'flag' : ''}" data-ik="unit_price" inputmode="decimal" value="${esc(numIn(it.unit_price))}"></label>
    <label class="field"><span class="small">Satır toplamı</span><input class="in sm" data-ik="line_total" inputmode="decimal" value="${esc(numIn((Number(it.qty) || 0) * (Number(it.unit_price) || 0)))}"></label>
    <button class="btn sm icon" data-a="rmitem" title="Satırı sil" style="align-self:end">${icon('x')}</button>
    ${it.raw_text ? `<div class="raw">Mesajda: “${esc(it.raw_text)}”${it.is_band && it.band_length_mm ? ` · ${esc(numIn(it.band_length_mm * (it.qty || 0) / 1000))} m` : ''}</div>` : ''}
    ${(it.warnings || []).length || alts.length ? `<div class="warns">${(it.warnings || []).map(w => `<span class="wmsg">${icon('warn')} ${esc(w)}</span>`).join('')}${alts.length ? `<select class="in sm" data-ik="alt" style="max-width:380px"><option value="">Diğer olası ürünler…</option>${alts.map(a => `<option value="${a.variant_id}">${esc(a.name)} — ${esc(a.label)}</option>`).join('')}</select>` : ''}</div>` : ''}
  </div>`;
}

function bindOrder(ctx, card, o, i) {
  const redraw = () => { const n = document.createElement('div'); n.innerHTML = orderCard(o, i); const nc = n.firstElementChild; card.replaceWith(nc); bindOrder(ctx, nc, o, i); };
  const sum = () => { const s = (o.items || []).reduce((a, it) => a + (Number(it.qty) || 0) * (Number(it.unit_price) || 0), 0); const b = card.querySelector('[data-sum]'); if (b) b.textContent = money(s); };
  card.querySelector('[data-a=ok]').onchange = e => { o._ok = e.target.checked; card.classList.toggle('ok', o._ok); };
  card.querySelector('[data-a=off]').onchange = e => { o._off = e.target.checked; if (o._off) o._ok = false; redraw(); };
  $$('[data-k]', card).forEach(inp => {
    inp.onchange = () => {
      const k = inp.dataset.k; let v = inp.value;
      if (k === 'source_id' || k === 'payment_id') v = v ? Number(v) : null;
      if (k === 'phone') { const n = phoneNorm(v); if (n) { v = n; inp.value = phoneFmt(n); } }
      if (k === 'il') { const m = matchIl(v); if (m) { v = m; inp.value = m; } }
      if (k === 'ilce') { const m = matchIlce(o.il, v); if (m) { v = m; inp.value = m; } }
      o[k] = v; o.flags = (o.flags || []).filter(f => f !== { customer_name: 'customer_name', phone: 'phone', address: 'address', il: 'il', ilce: 'ilce', source_id: 'source', payment_id: 'payment' }[k] && !(k === 'phone' && f === 'phone_format'));
      inp.closest('.field')?.classList.toggle('flag', !!fl(o, { source_id: 'source', payment_id: 'payment', customer_name: 'customer_name' }[k] || k));
    };
  });
  ilIlce(card.querySelector('[data-k=il]'), card.querySelector('[data-k=ilce]'));
  $$('.itemrow', card).forEach(row => {
    const it = o.items[+row.dataset.j];
    const d = row.querySelector('[data-ik=description]');
    const pick = v => { Object.assign(it, { variant_id: v.id, product_id: v.p.id, description: v.text, is_band: !!v.p.is_band, confidence: 'ok', warnings: (it.warnings || []).filter(w => !/eşleş|varyant|Marka|Freud/i.test(w)) }); if (!it.is_band) it.band_length_mm = null; redraw(); };
    autocomplete(d, q => searchCatalog(q, 40).map(v => ({ html: `<b>${esc(v.p.name)}</b> <small>${esc(v.label)}</small>`, group: `${v.p.category} › ${v.p.subcategory}`, v })), x => pick(x.v));
    d.oninput = () => { it.description = d.value; it.variant_id = null; it.product_id = null; };
    const alt = row.querySelector('[data-ik=alt]'); if (alt) alt.onchange = () => { const v = variantById(alt.value); if (v) pick(v); };
    for (const k of ['qty', 'unit_price', 'band_length_mm']) { const x = row.querySelector(`[data-ik=${k}]`); if (x) x.oninput = () => { it[k] = parseNum(x.value); if (k === 'qty') it.qty_missing = false; x.classList.remove('flag'); row.querySelector('[data-ik=line_total]').value = numIn((Number(it.qty) || 0) * (Number(it.unit_price) || 0)); sum(); }; }
    const lt = row.querySelector('[data-ik=line_total]'); lt.oninput = () => { const t = parseNum(lt.value); if (t != null && Number(it.qty)) { it.unit_price = +(t / Number(it.qty)).toFixed(4); row.querySelector('[data-ik=unit_price]').value = numIn(it.unit_price); } sum(); };
    row.querySelector('[data-a=rmitem]').onclick = () => { o.items.splice(+row.dataset.j, 1); redraw(); };
  });
  card.querySelector('[data-a=additem]').onclick = () => { o.items.push({ description: '', qty: 1, unit_price: 0, warnings: [], confidence: 'low' }); redraw(); };
  sum();
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
