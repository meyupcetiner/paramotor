// Ürünler (fiyatsız katalog) ve Ayarlar
import { S, api, esc, $, $$, icon, toast, int, today, parseNum, numIn, pill, loadCatalog, modal, confirmBox, exportCSV, fold, shrinkImage } from './core.js';
import { setTitle, refreshBoot } from './app.js';

export async function productsPage(ctx) {
  const { el, query } = ctx;
  setTitle('Ürünler');
  const prods = await loadCatalog(true);
  const cat = query.get('cat') || '', sub = query.get('sub') || '', q = query.get('q') || '';
  const f = fold(q);
  const list = prods.filter(p => (!cat || p.category === cat) && (!sub || p.subcategory === sub) && (!f || fold(`${p.name} ${p.mfr} ${p.subcategory} ${p.variants.map(v => v.label).join(' ')}`).includes(f)));
  const cats = S.boot.categories;
  const base = ctx.base + 'urunler';
  const setQ = (k, v) => { const qq = new URLSearchParams(query); if (v) qq.set(k, v); else qq.delete(k); if (k === 'cat') qq.delete('sub'); location.hash = base + '?' + qq; };
  el.innerHTML = `<div class="notice info">${icon('box')} Ortak katalog: üç markada da aynı ürünler görünür. Katalogda <b>fiyat alanı yoktur</b>; fiyat yalnızca satış girilirken satır bazında yazılır ve raporlara satışlardan yansır.</div>
  <div class="toolbar"><div class="searchbar"><input id="q" placeholder="Ürün veya ölçü ara… (ör. 300 96, 27x0.9, bonemaster)" value="${esc(q)}">${icon('search')}</div><button class="btn up" id="imp" style="height:46px">İçe aktar</button><button class="btn up" id="exp" style="height:46px">${icon('download')} CSV</button><button class="btn pri up" id="add" style="height:46px">Yeni Ürün</button></div>
  <div class="tabs"><a href="javascript:void 0" data-cat="" class="${!cat ? 'on' : ''}">Tümü (${prods.length})</a>${Object.keys(cats).map(c => `<a href="javascript:void 0" data-cat="${esc(c)}" class="${cat === c ? 'on' : ''}">${esc(c)} (${prods.filter(p => p.category === c).length})</a>`).join('')}</div>
  ${cat ? `<div class="chips">${cats[cat].map(s => `<button class="chip ${sub === s ? 'on' : ''}" data-sub="${esc(s)}">${esc(s)} <span class="n">${prods.filter(p => p.category === cat && p.subcategory === s).length}</span></button>`).join('')}</div>` : ''}
  <div class="tbl-wrap"><table class="tbl list"><thead><tr><th>Ürün adı</th><th>Kategori</th><th>Marka / üretici</th><th>Birim</th><th class="r">Varyant</th><th class="r">Satış satırı</th></tr></thead><tbody>
  ${list.map(p => `<tr class="click ${p.active ? '' : 'muted'}" data-id="${p.id}"><td><div class="t-title">${esc(p.name)}${p.active ? '' : ' <span class="pill soft">PASİF</span>'}</div><div class="t-sub">${esc(p.variants.slice(0, 4).map(v => v.label).join(' · '))}${p.variants.length > 4 ? ' …' : ''}</div></td><td class="t-sub">${esc(p.category || '')} › ${esc(p.subcategory || '')}</td><td>${esc(p.mfr || '')}</td><td>${p.is_band ? 'Adet + şerit boyu (mm)' : esc(p.unit || 'Adet')}</td><td class="r">${p.variants.filter(v => v.active).length}</td><td class="r">${int(p.sold_lines)}</td></tr>`).join('') || '<tr><td colspan="6"><div class="empty">Ürün bulunamadı</div></td></tr>'}
  </tbody></table></div><div class="footbar"><span class="sp"></span><span class="sumtext">${list.length} ürün · ${int(list.reduce((a, p) => a + p.variants.length, 0))} varyant</span></div>`;
  let tm; $('#q', el).oninput = e => { clearTimeout(tm); tm = setTimeout(() => setQ('q', e.target.value.trim()), 350); };
  $$('[data-cat]', el).forEach(a => a.onclick = () => setQ('cat', a.dataset.cat));
  $$('[data-sub]', el).forEach(a => a.onclick = () => setQ('sub', sub === a.dataset.sub ? '' : a.dataset.sub));
  $$('tr[data-id]', el).forEach(tr => tr.onclick = () => editProduct(ctx, prods.find(p => p.id === Number(tr.dataset.id))));
  $('#add', el).onclick = () => editProduct(ctx, { name: '', category: cat || 'Daire Testereler', subcategory: sub || '', mfr: '', unit: 'Adet', description: '', is_band: cat === 'Şerit Testereler' ? 1 : 0, variants: [], active: 1 });
  $('#exp', el).onclick = () => exportCSV(`urunler-${today()}`, ['Ürün adı', 'Kategori', 'Alt kategori', 'Marka', 'Varyant', 'Çap', 'Kalınlık', 'Delik', 'Diş', 'Genişlik', 'TPI', 'Açıklama'], prods.flatMap(p => p.variants.map(v => [p.name, p.category, p.subcategory, p.mfr, v.label, v.diameter ?? '', v.thickness ?? '', v.bore ?? '', v.teeth ?? '', v.width ?? '', v.tpi ?? '', p.description || ''])));
  $('#imp', el).onclick = () => modal({ title: 'Ürün listesi içe aktar', body: `<p class="muted">CSV (noktalı virgül veya virgül ayraçlı) ya da Excel'den kopyalanan tablo yapıştırın. Sütunlar: <b>Ürün adı; Kategori; Alt kategori; Marka; Varyant; Açıklama</b>. Aynı adlı ürün varsa sadece yeni varyantlar eklenir. Fiyat sütunları yok sayılır.</p><textarea class="in" id="csv" rows="10" placeholder="Kronberg Ahşap Testeresi;Daire Testereler;Ahşap;Kronberg;Ø300 × 3,2 × 30 · Z60;"></textarea><label class="btn sm">Dosya seç<input type="file" id="cf" accept=".csv,.txt" hidden></label>`,
    actions: [{ label: 'Vazgeç' }, { label: 'İçe aktar', cls: 'pri', onClick: async m => {
      const txt = m.querySelector('#csv').value.trim(); if (!txt) return false;
      const rows = txt.split(/\r?\n/).map(l => l.split(l.includes('\t') ? '\t' : l.includes(';') ? ';' : ',').map(s => s.replace(/^"|"$/g, '').trim())).filter(r => r[0] && !/^ürün adı$/i.test(r[0]));
      const r = await api.post('/products/import', { rows: rows.map(c => ({ name: c[0], category: c[1], subcategory: c[2], mfr: c[3], variant: c[4], description: c[5] })) });
      toast(`${r.created} yeni ürün, ${r.variants} varyant eklendi`); productsPage(ctx);
    } }], onOpen: m => { m.querySelector('#cf').onchange = async e => { m.querySelector('#csv').value = await e.target.files[0].text(); }; } });
}

function editProduct(ctx, p) {
  const cats = S.boot.categories;
  const vars = p.variants.map(v => ({ ...v }));
  const vrow = (v, i) => `<tr data-i="${i}"><td><input class="in sm" data-v="label" value="${esc(v.label)}" placeholder="ör. Ø300 × 3,2 × 30 · Z96"></td><td><input class="in sm" data-v="diameter" value="${esc(numIn(v.diameter))}" style="width:70px"></td><td><input class="in sm" data-v="thickness" value="${esc(numIn(v.thickness))}" style="width:70px"></td><td><input class="in sm" data-v="teeth" value="${esc(v.teeth ?? '')}" style="width:60px"></td><td><input class="in sm" data-v="width" value="${esc(numIn(v.width))}" style="width:60px"></td><td><input class="in sm" data-v="tpi" value="${esc(v.tpi ?? '')}" style="width:70px"></td><td><button type="button" class="btn sm icon" data-rm>${icon('x')}</button></td></tr>`;
  modal({ title: p.id ? 'Ürünü düzenle' : 'Yeni ürün', wide: true, body: `<form id="pf" style="display:grid;gap:12px">
    <div class="grid2"><label class="field"><span>Ürün adı</span><input class="in" name="name" value="${esc(p.name)}" required></label><label class="field"><span>Marka / üretici</span><input class="in" name="mfr" value="${esc(p.mfr || '')}"></label></div>
    <div class="grid3"><label class="field"><span>Kategori</span><select class="in" name="category">${Object.keys(cats).map(c => `<option ${p.category === c ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select></label><label class="field"><span>Alt kategori</span><input class="in" name="subcategory" list="subs" value="${esc(p.subcategory || '')}"><datalist id="subs">${Object.values(cats).flat().map(s => `<option>${esc(s)}</option>`).join('')}</datalist></label><label class="field"><span>Birim</span><select class="in" name="unit">${['Adet', 'Metre', 'Paket', 'Takım'].map(u => `<option ${p.unit === u ? 'selected' : ''}>${u}</option>`).join('')}</select></label></div>
    <label class="chk"><input type="checkbox" name="is_band" ${p.is_band ? 'checked' : ''}> Şerit testere (satışta şerit boyu mm + adet girilir, metraj raporlanır)</label>
    <label class="field"><span>Açıklama</span><textarea class="in" name="description" rows="2">${esc(p.description || '')}</textarea></label>
    <div class="label">Varyantlar (çap / kalınlık / diş / genişlik / TPI) — fiyat yok</div>
    <div class="tbl-wrap"><table class="tbl compact"><thead><tr><th>Varyant adı</th><th>Çap</th><th>Kalınlık</th><th>Diş</th><th>Genişlik</th><th>TPI</th><th></th></tr></thead><tbody id="vb">${vars.map(vrow).join('')}</tbody></table></div>
    <div><button type="button" class="btn sm" id="addv">+ Varyant</button> ${p.id ? `<label class="chk small" style="margin-left:12px"><input type="checkbox" name="active" ${p.active ? 'checked' : ''}> Aktif</label>` : ''}</div></form>`,
    actions: [...(p.id ? [{ label: 'Sil', cls: 'danger', onClick: async () => { if (!(await confirmBox('Ürün silinsin mi? Satışlarda kullanıldıysa pasife alınır.'))) return false; const r = await api.del('/products/' + p.id); toast(r.deactivated ? 'Ürün satışlarda kullanıldığı için pasife alındı' : 'Ürün silindi'); S.catalog = null; productsPage(ctx); } }] : []), { label: 'Vazgeç' }, { label: 'Kaydet', cls: 'pri', onClick: async m => {
      const f = m.querySelector('#pf'); if (!f.name.value.trim()) { toast('Ürün adı gerekli', true); return false; }
      $$('#vb tr', m).forEach(tr => { const v = vars[+tr.dataset.i]; $$('[data-v]', tr).forEach(i => { const k = i.dataset.v; v[k] = ['label', 'tpi'].includes(k) ? i.value.trim() : parseNum(i.value); }); });
      const body = { name: f.name.value.trim(), mfr: f.mfr.value.trim(), category: f.category.value, subcategory: f.subcategory.value.trim(), unit: f.unit.value, description: f.description.value.trim(), is_band: f.is_band.checked ? 1 : 0, active: f.active ? (f.active.checked ? 1 : 0) : 1, variants: vars.filter(v => v.label) };
      if (!body.variants.length) body.variants = [{ label: 'Standart' }];
      if (p.id) await api.put('/products/' + p.id, body); else await api.post('/products', body);
      toast('Ürün kaydedildi'); S.catalog = null; productsPage(ctx);
    } }],
    onOpen: m => {
      const vb = m.querySelector('#vb');
      const bind = () => $$('[data-rm]', vb).forEach(b => b.onclick = () => { const tr = b.closest('tr'); $$('#vb tr', m).forEach(r => { const v = vars[+r.dataset.i]; $$('[data-v]', r).forEach(i => { v[i.dataset.v] = i.value; }); }); vars.splice(+tr.dataset.i, 1); vb.innerHTML = vars.map(vrow).join(''); bind(); });
      bind();
      m.querySelector('#addv').onclick = () => { $$('#vb tr', m).forEach(r => { const v = vars[+r.dataset.i]; $$('[data-v]', r).forEach(i => { v[i.dataset.v] = i.value; }); }); vars.push({ label: '' }); vb.innerHTML = vars.map(vrow).join(''); bind(); vb.lastElementChild.querySelector('input').focus(); };
    } });
}

// ======================= AYARLAR =======================
export async function settingsPage(ctx) {
  const { el, query } = ctx;
  setTitle('Ayarlar');
  await refreshBoot();
  const b = S.boot, st = b.settings, tab = query.get('tab') || 'markalar';
  const base = ctx.base + 'ayarlar';
  const R = st.segment_rules || {};
  const TABS = [['markalar', 'Marka Ayarları'], ['etiketler', 'Kaynak ve Ödeme'], ['segment', 'Segment Kuralları'], ['genel', 'Genel'], ['guvenlik', 'Güvenlik ve Yedek']];
  let html = `<div class="tabs">${TABS.map(([k, l]) => `<a href="${base}?tab=${k}" class="${tab === k ? 'on' : ''}">${l}</a>`).join('')}</div>`;
  if (tab === 'markalar') html += `<div class="rgrid">${b.brands.map(x => `<form class="card c4" data-b="${x.id}"><div class="bd" style="display:grid;gap:12px;padding-top:18px">
      <div style="background:#fff;border-radius:12px;height:150px;display:grid;place-items:center;padding:12px">${x.logo ? `<img src="${esc(x.logo)}" style="max-height:126px;object-fit:contain" data-prev>` : `<b style="color:#333" data-prev>${esc(x.name)}</b>`}</div>
      <label class="btn sm">${icon('image')} Logo yükle<input type="file" accept="image/*" name="logo" hidden></label>
      <label class="field"><span>Marka adı</span><input class="in" name="name" value="${esc(x.name)}"></label>
      <div class="grid2"><label class="field"><span>Marka rengi</span><input type="color" class="colorin" name="color" value="${esc(x.color || '#54c810')}"></label><label class="field"><span>Fatura no ön eki</span><input class="in" name="invoice_prefix" value="${esc(x.invoice_prefix || '')}" maxlength="8"></label></div>
      <button class="btn pri sm">Kaydet</button></div></form>`).join('')}</div><div class="muted small">Fatura numarası: <b>ÖNEK-YIL-SIRA</b> (ör. TU-2026-0001), marka bazında ayrı sıra. Faturada elle numara da girilebilir.</div>`;
  if (tab === 'etiketler') html += `<div class="rgrid">${[['sources', 'Kaynaklar (siparişin geldiği yer)', b.sources], ['payments', 'Ödeme yöntemleri', b.payments]].map(([k, t, list]) => `<div class="card c6"><div class="hd"><h3>${t}</h3></div><div class="bd" style="display:grid;gap:8px">${list.map(x => `<div class="row" data-k="${k}" data-id="${x.id}"><input type="color" class="colorin" value="${esc(x.color || '#888888')}" data-c><input class="in sm grow" value="${esc(x.name)}" data-n>${pill(x.name, x.color)}<label class="chk small"><input type="checkbox" data-a ${x.active ? 'checked' : ''}> aktif</label><button class="btn sm" data-save>Kaydet</button><button class="btn sm icon" data-del title="Sil">${icon('trash')}</button></div>`).join('')}
      <div class="row" style="margin-top:6px"><input type="color" class="colorin" value="#7048e8" data-nc="${k}"><input class="in sm grow" placeholder="Yeni ${k === 'sources' ? 'kaynak' : 'ödeme yöntemi'} adı" data-nn="${k}"><button class="btn sm pri" data-add="${k}">Ekle</button></div></div></div>`).join('')}</div>`;
  if (tab === 'segment') html += `<form class="card" id="segf"><div class="bd" style="display:grid;gap:14px;padding-top:18px">
      <div class="helpbox">Segmentler her müşteri için son sipariş tarihi, sipariş sayısı, ortalama sipariş aralığı ve toplam tutara göre (RFM mantığı) otomatik hesaplanır. Sıra: Yeni → Riskli/Uykuda → Sadık → Tekrar potansiyeli → Tek seferlik → Aktif.</div>
      <div class="grid4">${[['new_days', 'Yeni: ilk sipariş son … gün'], ['loyal_min_orders', 'Sadık: en az … sipariş'], ['loyal_max_days', 'Sadık: son sipariş en fazla … gün önce'], ['risk_days', 'Riskli/Uykuda: … günden uzun sipariş yok'], ['risk_gap_mult', 'Riskli: ya da ort. aralığın … katı'], ['pot_gap_min', 'Potansiyel: ort. aralığın en az … katı geçmiş'], ['pot_gap_max', 'Potansiyel: en fazla … katı'], ['pot_single_min_days', 'Tek siparişli potansiyel: en az … gün önce'], ['pot_single_max_days', '… en fazla … gün önce'], ['pot_single_min_spend', '… en az … ₺ harcamış']].map(([k, l]) => `<label class="field"><span>${l}</span><input class="in" name="${k}" inputmode="decimal" value="${esc(numIn(R[k]))}"></label>`).join('')}</div>
      <div class="helpbox">${Object.entries(b.segmentHelp).map(([k, v]) => `<div style="margin:3px 0"><b>${esc(k)}:</b> ${esc(v)}</div>`).join('')}</div>
      <div><button class="btn pri">Kaydet</button></div></div></form>`;
  if (tab === 'genel') html += `<form class="card" id="genf"><div class="bd" style="display:grid;gap:14px;padding-top:18px">
      <div class="grid3"><label class="field"><span>Varsayılan KDV (%)</span><input class="in" name="default_vat" value="${esc(st.default_vat)}" inputmode="decimal"></label>
      <label class="field"><span>Fiyat girişi varsayılanı</span><select class="in" name="prices_incl_vat_default"><option value="1" ${st.prices_incl_vat_default ? 'selected' : ''}>Girilen fiyatlar KDV dahil</option><option value="0" ${!st.prices_incl_vat_default ? 'selected' : ''}>Girilen fiyatlar KDV hariç (Paraşüt gibi)</option></select></label>
      <label class="field"><span>Şerit top uzunluğu (metre)</span><input class="in" name="band_roll_m" value="${esc(st.band_roll_m)}" inputmode="decimal"></label></div>
      <div class="grid3"><label class="field"><span>Otomatik giriş okuma motoru</span><select class="in" name="auto_engine"><option value="claude" ${st.auto_engine !== 'kural' ? 'selected' : ''}>Claude (metin + görsel)</option><option value="kural" ${st.auto_engine === 'kural' ? 'selected' : ''}>Kural tabanlı (sadece metin, ücretsiz)</option></select></label>
      <label class="field"><span>Claude modeli</span><input class="in" name="claude_model" value="${esc(st.claude_model)}"></label>
      <label class="field"><span>API anahtarı</span><input class="in" disabled value="${b.hasApiKey ? 'Sunucuda tanımlı ✓' : 'Tanımlı değil (Cloudflare secret: ANTHROPIC_API_KEY)'}"></label></div>
      <div class="grid3"><label class="field"><span>Ortak giderlerin markalara dağıtımı</span><select class="in" name="expense_allocation"><option value="ciro" ${st.expense_allocation === 'ciro' ? 'selected' : ''}>Dönem cirosu oranında</option><option value="esit" ${st.expense_allocation === 'esit' ? 'selected' : ''}>Eşit</option><option value="manuel" ${st.expense_allocation === 'manuel' ? 'selected' : ''}>Elle oran</option></select></label>
      ${b.brands.map(x => `<label class="field"><span>Elle oran — ${esc(x.name)} %</span><input class="in" name="share_${x.id}" value="${esc((st.expense_manual_shares || {})[x.id] ?? '')}" inputmode="decimal"></label>`).join('')}</div>
      <label class="field"><span>Gider kategorileri (virgülle)</span><input class="in" name="expense_categories" value="${esc((st.expense_categories || []).join(', '))}"></label>
      <label class="chk"><input type="checkbox" id="introEvery" ${localStorage.getItem('pm_intro_every') === '1' ? 'checked' : ''}> Giriş animasyonu her açılışta oynasın (kapalıysa oturumda bir kez)</label>
      <div><button class="btn pri">Kaydet</button></div></div></form>`;
  if (tab === 'guvenlik') html += `<div class="rgrid"><form class="card c6" id="pwf"><div class="hd"><h3>Şifre değiştir</h3></div><div class="bd" style="display:grid;gap:10px"><label class="field"><span>Mevcut şifre</span><input class="in" type="password" name="old" autocomplete="current-password"></label><label class="field"><span>Yeni şifre (en az 6 karakter)</span><input class="in" type="password" name="pw" autocomplete="new-password"></label><label class="field"><span>Yeni şifre (tekrar)</span><input class="in" type="password" name="pw2" autocomplete="new-password"></label><div><button class="btn pri">Şifreyi değiştir</button></div><div class="muted small">Değiştirince diğer tüm cihazlardaki oturumlar kapanır.</div></div></form>
      <div class="card c6"><div class="hd"><h3>Veri yedeği</h3></div><div class="bd" style="display:grid;gap:10px"><p class="muted" style="margin:0">Tüm markalar, müşteriler, faturalar, giderler, ürünler ve otomatik giriş geçmişi tek JSON dosyası olarak indirilir. Şifre yedeğe dahil değildir.</p><div><a class="btn" href="/api/export/backup">${icon('download')} JSON yedeği indir</a></div></div></div></div>`;
  el.innerHTML = html;

  $$('form[data-b]', el).forEach(f => {
    let logo = null;
    f.logo.onchange = async e => { const file = e.target.files[0]; if (!file) return; logo = await shrinkImage(file, 500, .9); const p = f.querySelector('[data-prev]'); p.outerHTML = `<img src="${logo}" style="max-height:126px;object-fit:contain" data-prev>`; };
    f.onsubmit = async e => { e.preventDefault(); await api.put('/brands/' + f.dataset.b, { name: f.name.value.trim(), color: f.color.value, invoice_prefix: f.invoice_prefix.value.trim().toUpperCase(), logo }); await refreshBoot(); toast('Marka kaydedildi'); settingsPage(ctx); };
  });
  $$('[data-save]', el).forEach(btn => btn.onclick = async () => { const r = btn.closest('[data-id]'); await api.put(`/${r.dataset.k}/${r.dataset.id}`, { name: r.querySelector('[data-n]').value.trim(), color: r.querySelector('[data-c]').value, active: r.querySelector('[data-a]').checked ? 1 : 0 }); toast('Kaydedildi'); settingsPage(ctx); });
  $$('[data-del]', el).forEach(btn => btn.onclick = async () => { const r = btn.closest('[data-id]'); if (!(await confirmBox('Silinsin mi? Faturalarda kullanıldıysa pasife alınır.'))) return; const x = await api.del(`/${r.dataset.k}/${r.dataset.id}`); toast(x.deactivated ? 'Kullanımda olduğu için pasife alındı' : 'Silindi'); settingsPage(ctx); });
  $$('[data-add]', el).forEach(btn => btn.onclick = async () => { const k = btn.dataset.add; const n = $(`[data-nn="${k}"]`, el).value.trim(); if (!n) return; await api.post('/' + k, { name: n, color: $(`[data-nc="${k}"]`, el).value }); toast('Eklendi'); settingsPage(ctx); });
  $('#segf', el)?.addEventListener('submit', async e => { e.preventDefault(); const f = e.target; const rules = {}; for (const k of Object.keys(R)) rules[k] = parseNum(f[k].value) ?? R[k]; await api.put('/settings', { segment_rules: rules }); await refreshBoot(); toast('Segment kuralları kaydedildi'); settingsPage(ctx); });
  $('#genf', el)?.addEventListener('submit', async e => {
    e.preventDefault(); const f = e.target; const shares = {}; for (const x of b.brands) shares[x.id] = parseNum(f['share_' + x.id].value) ?? 0;
    await api.put('/settings', { default_vat: parseNum(f.default_vat.value) ?? 20, prices_incl_vat_default: f.prices_incl_vat_default.value === '1', band_roll_m: parseNum(f.band_roll_m.value) ?? 100, auto_engine: f.auto_engine.value, claude_model: f.claude_model.value.trim() || 'claude-sonnet-5-5', expense_allocation: f.expense_allocation.value, expense_manual_shares: shares, expense_categories: f.expense_categories.value.split(',').map(s => s.trim()).filter(Boolean) });
    try { localStorage.setItem('pm_intro_every', $('#introEvery', el).checked ? '1' : '0'); } catch { }
    await refreshBoot(); toast('Ayarlar kaydedildi');
  });
  $('#pwf', el)?.addEventListener('submit', async e => { e.preventDefault(); const f = e.target; if (f.pw.value !== f.pw2.value) return toast('Yeni şifreler aynı değil', true); try { await api.post('/password', { old: f.old.value, password: f.pw.value }); toast('Şifre değiştirildi'); f.reset(); } catch (err) { toast(err.message, true); } });
}
