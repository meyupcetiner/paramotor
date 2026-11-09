// Zeplin — uygulama kabuğu: giriş animasyonu, kimlik, marka seçimi, yönlendirici, yan menü
import { S, api, esc, icon, toast, money, int, today, rangePreset } from './core.js';
import { invoicesPage, invoiceForm } from './invoices.js';
import { autoPage } from './auto.js';
import { customersPage, customerDetail } from './customers.js';
import { reportsPage, pnlPage, expensesPage, productReportPage } from './reports.js';
import { productsPage, settingsPage } from './misc.js';

const root = document.getElementById('root');
let shellKey = null;
const ss = (k, v) => { try { if (v === undefined) return sessionStorage.getItem(k); sessionStorage.setItem(k, v); } catch { return null; } };
const ls = (k, v) => { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch { return null; } };

// ---------- giriş animasyonu (oturumda bir kez; ayardan her açılışta yapılabilir) ----------
function playIntro() {
  return new Promise(res => {
    const every = ls('pm_intro_every') === '1';
    if (!every && ss('pm_intro_seen')) { document.getElementById('intro').classList.add('hidden'); return res(); }
    const el = document.getElementById('intro'); el.classList.remove('hidden', 'go', 'done');
    let finished = false;
    const done = () => { if (finished) return; finished = true; ss('pm_intro_seen', '1'); el.classList.add('done'); setTimeout(() => { el.classList.add('hidden'); }, 420); res(); };
    el.querySelector('.skip').onclick = done;
    // görseller çözülünce (decode) başlar: ilk karede takılma olmaz
    const imgs = [...el.querySelectorAll('img')].map(i => (i.decode ? i.decode() : Promise.resolve()).catch(() => { }));
    const start = () => { requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('go'))); setTimeout(done, 2750); };
    Promise.race([Promise.all(imgs), new Promise(r => setTimeout(r, 1200))]).then(start);
  });
}

// Testeresan (genel muhasebe) seçilince logonun animasyonu
function playTesteresan() {
  return new Promise(res => {
    const el = document.getElementById('intro-ts'); el.classList.remove('hidden', 'go', 'done');
    let finished = false;
    const done = () => { if (finished) return; finished = true; el.classList.add('done'); setTimeout(() => { el.classList.add('hidden'); el.classList.remove('go'); }, 420); res(); };
    el.onclick = done;
    const imgs = ['/img/intro-blade.svg', '/img/intro-badge.png'].map(u => new Promise(r => { const i = new Image(); i.onload = i.onerror = r; i.src = u; }));
    Promise.race([Promise.all(imgs), new Promise(r => setTimeout(r, 800))]).then(() => { requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('go'))); setTimeout(done, 2400); });
  });
}

// ---------- kimlik ----------
function authScreen(mode) {
  shellKey = null;
  root.innerHTML = `<div class="auth"><form class="box" autocomplete="on">
    <img class="lg lg-d " src="/img/zeplin-logo.png" alt="Zeplin"><img class="lg lg-l " src="/img/zeplin-logo-light.png" alt="Zeplin">
    <h2>${mode === 'setup' ? 'İlk kurulum — panel şifresini belirleyin' : 'Detaylı Muhasebe Analiz Programı'}</h2>
    <div class="field"><span>${mode === 'setup' ? 'Yeni şifre (en az 6 karakter)' : 'Şifre'}</span><input class="in" type="password" name="password" autocomplete="${mode === 'setup' ? 'new-password' : 'current-password'}" required autofocus></div>
    ${mode === 'setup' ? '<div class="field" style="margin-top:10px"><span>Şifre (tekrar)</span><input class="in" type="password" name="password2" autocomplete="new-password" required></div>' : ''}
    <button class="btn pri up" style="width:100%;margin-top:18px;height:44px">${mode === 'setup' ? 'Şifreyi kaydet ve gir' : 'Giriş'}</button>
    <p class="muted small" style="text-align:center;margin:14px 0 0">Tek yönetici paneli · Testeresan</p></form></div>`;
  const f = root.querySelector('form');
  f.onsubmit = async e => {
    e.preventDefault();
    const pw = f.password.value;
    try {
      if (mode === 'setup') { if (pw !== f.password2.value) return toast('Şifreler aynı değil', true); await api.post('/setup', { password: pw }); }
      else await api.post('/login', { password: pw });
      S.boot = null; location.hash = '#/sec'; route();
    } catch (err) { toast(err.message, true); }
  };
}

async function ensureBoot() {
  if (S.boot) return S.boot;
  S.boot = await api('/bootstrap');
  return S.boot;
}

// ---------- marka seçimi ----------
async function selectPage() {
  shellKey = null;
  const b = S.boot;
  const [from, to] = rangePreset('month');
  root.innerHTML = `<div class="select-page"><div class="top"><span class="toplogo"><img class="lg lg-d " src="/img/zeplin-logo.png" alt="Zeplin"><img class="lg lg-l " src="/img/zeplin-logo-light.png" alt="Zeplin"></span><div class="row"><button class="btn ghost icon" id="th" title="Tema">${icon(document.documentElement.dataset.theme === 'light' ? 'moon' : 'sun')}</button><button class="btn ghost" id="lo">${icon('out')}<span>Çıkış</span></button></div></div>
  <div class="select-wrap">
    <a class="bcard main" href="#/genel" data-b="all"><div class="plate"><img src="/img/testeresan.png" alt="TESTERESAN"></div><div class="meta"><div><b>TESTERESAN · Genel Muhasebe</b><div class="muted small">Üç markanın birleşik görünümü</div></div><div class="k" data-k="all"><div>—</div><div class="muted small">bu ay</div></div></div></a>
    <div class="brand-row">${b.brands.map(x => `<a class="bcard" href="#/b/${x.id}/faturalar" data-b="${x.id}"><div class="plate">${x.logo ? `<img src="${esc(x.logo)}" alt="${esc(x.name)}">` : `<span class="ph">${esc(x.name)}</span>`}</div><div class="meta"><div><b>${esc(x.name)}</b><div class="muted small">Muhasebe paneli</div></div><div class="k" data-k="${x.id}"><div>—</div><div class="muted small">bu ay</div></div></div></a>`).join('')}</div>
  </div></div>`;
  root.querySelector('.bcard.main').onclick = async e => { e.preventDefault(); const go = playTesteresan(); setTimeout(() => { location.hash = '#/genel'; }, 1900); await go; };
  root.querySelector('#lo').onclick = logout;
  root.querySelector('#th').onclick = () => { toggleTheme(); selectPage(); };
  try {
    let vat = 'excl'; try { vat = localStorage.getItem('pm_vat') || 'excl'; } catch { }
    const r = await api(`/report?brand=all&from=${from}&to=${to}&vat=${vat}`);
    const set = (k, v, n) => { const el = root.querySelector(`[data-k="${k}"]`); if (el) el.innerHTML = `<div>${money(v)}</div><div class="muted small">bu ay · ${int(n)} sipariş</div>`; };
    set('all', r.total, r.orders);
    for (const x of b.brands) set(x.id, (r.byBrand[x.id] || {}).total || 0, (r.byBrand[x.id] || {}).orders || 0);
  } catch { }
}

async function logout() { try { await api.post('/logout'); } catch { } S.boot = null; S.catalog = null; location.hash = '#/giris'; route(); }
function toggleTheme() { const t = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light'; document.documentElement.dataset.theme = t; ls('pm_theme', t); }

// ---------- kabuk ----------
const BRAND_NAV = b => [
  ['faturalar', 'invoice', 'Satış Faturaları'],
  ['fatura/yeni', 'plus', 'Satış Oluştur'],
  ['otomatik', 'spark', 'Otomatik Satış Gir'],
  ['musteriler', 'users', 'Müşteriler'],
  ['raporlar', 'chart', 'Satış Raporları'],
  ['gelir-gider', 'coins', 'Gelir-Gider Raporu'],
  ['giderler', 'wallet', 'Giderler'],
  ['urunler', 'box', 'Ürünler'],
  ['ayarlar', 'gear', 'Ayarlar']
];
const GEN_NAV = [
  ['ozet', 'pie', 'Genel Bakış'],
  ['musteriler', 'users', 'Müşteriler'],
  ['urunler', 'box', 'Ürün Raporları'],
  ['gelir-gider', 'coins', 'Gelir-Gider Raporu'],
  ['giderler', 'wallet', 'Giderler (ortak dahil)'],
  ['ayarlar', 'gear', 'Ayarlar']
];

function shell(brand) {
  const key = brand || 'all';
  if (shellKey === key && document.getElementById('page')) return;
  shellKey = key;
  const b = brand ? S.boot.brands.find(x => x.id === brand) : null;
  const base = brand ? `#/b/${brand}/` : '#/genel/';
  const nav = brand ? BRAND_NAV(brand) : GEN_NAV;
  const collapsed = ls('pm_side') === '1';
  root.innerHTML = `<div class="app ${collapsed ? 'collapsed' : ''}" id="app">
    <aside class="side">
      <div class="logo"><a href="#/sec" title="Marka seçimi"><img class="lg lg-d full" src="/img/zeplin-logo.png" alt="Zeplin"><img class="lg lg-l full" src="/img/zeplin-logo-light.png" alt="Zeplin"><img class="icon" src="/img/zeplin-mark.png" alt="Zeplin"></a><button class="btn ghost sm icon" id="col" title="Menüyü daralt">${icon('side')}</button></div>
      <a class="brandchip" href="#/sec" title="Marka değiştir"><span class="dot" style="background-image:url('${esc(b ? b.logo : '/img/testeresan.png')}')"></span><div><b>${esc(b ? b.name : 'TESTERESAN')}</b><span>${b ? 'Marka paneli · değiştir' : 'Genel muhasebe · değiştir'}</span></div></a>
      <nav class="nav">${nav.map(([p, ic, t]) => `<a href="${base}${p}" data-p="${p}">${icon(ic)}<span>${t}</span></a>`).join('')}
        <div class="sep"></div><div class="grp">Hızlı geçiş</div>
        ${brand ? `<a href="#/genel/ozet">${icon('pie')}<span>Genel Muhasebe</span></a>` : ''}
        ${S.boot.brands.filter(x => x.id !== brand).map(x => `<a href="#/b/${x.id}/faturalar">${icon('swap')}<span>${esc(x.name)}</span></a>`).join('')}
      </nav>
      <div class="foot nav"><a href="javascript:void 0" id="th">${icon('moon')}<span>Açık / koyu tema</span></a><a href="javascript:void 0" id="lo">${icon('out')}<span>Çıkış</span></a></div>
    </aside>
    <main class="main"><header class="topbar"><button class="btn ghost icon burger" id="bg">${icon('menu')}</button><h1 id="title"></h1><span class="sp"></span>
      <div class="user"><div><b>${esc(b ? b.name : 'Testeresan')}</b><span>${esc(b ? 'MARKA PANELİ' : 'GENEL MUHASEBE')}</span></div><a class="avatar" href="#/sec" title="Marka değiştir">${icon('user')}</a></div></header>
      <section class="content" id="page"></section></main>
    <nav class="mtabs">${(brand ? [['raporlar', 'chart', 'Rapor'], ['faturalar', 'invoice', 'Satışlar'], ['musteriler', 'users', 'Müşteri'], ['gelir-gider', 'coins', 'Gelir-Gider']] : [['ozet', 'pie', 'Özet'], ['urunler', 'box', 'Ürün'], ['musteriler', 'users', 'Müşteri'], ['gelir-gider', 'coins', 'Gelir-Gider']]).map(([p, ic, t]) => `<a href="${base}${p}" data-mp="${p}">${icon(ic)}<span>${t}</span></a>`).join('')}<a href="javascript:void 0" id="mmenu">${icon('menu')}<span>Menü</span></a></nav></div>`;
  const app = root.querySelector('#app');
  root.querySelector('#col').onclick = () => { app.classList.toggle('collapsed'); ls('pm_side', app.classList.contains('collapsed') ? '1' : '0'); };
  root.querySelector('#bg').onclick = () => { app.classList.add('drawer'); const s = document.createElement('div'); s.className = 'scrim'; s.onclick = () => { app.classList.remove('drawer'); s.remove(); }; app.appendChild(s); };
  root.querySelector('#mmenu').onclick = () => root.querySelector('#bg').click();
  root.querySelector('#th').onclick = toggleTheme;
  root.querySelector('#lo').onclick = logout;
}
function markNav(p) {
  const app = document.getElementById('app'); if (!app) return;
  app.classList.remove('drawer'); app.querySelector('.scrim')?.remove();
  app.querySelectorAll('.mtabs a[data-mp]').forEach(a => a.classList.toggle('on', p === a.dataset.mp || (p.startsWith('fatura') && a.dataset.mp === 'faturalar') || (p.startsWith('musteri') && a.dataset.mp === 'musteriler') || (p.startsWith('urun') && a.dataset.mp === 'urunler')));
  app.querySelectorAll('.side nav a[data-p]').forEach(a => a.classList.toggle('on', p === a.dataset.p || (p.startsWith('fatura/') && a.dataset.p === 'faturalar' && p !== 'fatura/yeni') || (p.startsWith('musteri/') && a.dataset.p === 'musteriler') || (p.startsWith('urun/') && a.dataset.p === 'urunler')));
}
export function setTitle(html) { const t = document.getElementById('title'); if (t) t.innerHTML = html; document.title = (t ? t.textContent : '') + ' · Zeplin'; }

// ---------- yönlendirici ----------
let routing = 0;
async function route() {
  const my = ++routing;
  const raw = location.hash.replace(/^#/, '') || '/';
  const [path, qs] = raw.split('?');
  const query = new URLSearchParams(qs || '');
  const parts = path.split('/').filter(Boolean);
  try {
    if (parts[0] === 'giris' || parts[0] === 'kurulum' || parts.length === 0 || !S.boot) {
      const st = await api('/state');
      if (st.needsSetup) return authScreen('setup');
      if (!st.authed) return authScreen('login');
      await ensureBoot();
      if (parts.length === 0 || parts[0] === 'giris' || parts[0] === 'kurulum') { location.replace('#/sec'); return selectPage(); }
    }
    if (my !== routing) return;
    if (parts[0] === 'sec') return selectPage();
    let brand = null, sub;
    if (parts[0] === 'b') { brand = parts[1]; sub = parts.slice(2); if (!S.boot.brands.find(x => x.id === brand)) { location.hash = '#/sec'; return; } }
    else if (parts[0] === 'genel') sub = parts.slice(1).length ? parts.slice(1) : ['ozet'];
    else { location.hash = '#/sec'; return; }
    shell(brand);
    const page = document.getElementById('page');
    const ctx = { brand, query, el: page, path: sub.join('/'), go: h => { location.hash = h; }, base: brand ? `#/b/${brand}/` : '#/genel/' };
    markNav(ctx.path);
    page.innerHTML = '<div class="empty"><span class="spin"></span></div>';
    window.scrollTo(0, 0);
    const p0 = sub[0] || 'faturalar';
    if (brand) {
      if (p0 === 'faturalar') return await invoicesPage(ctx);
      if (p0 === 'fatura') return await invoiceForm(ctx, sub[1] === 'yeni' ? null : Number(sub[1]));
      if (p0 === 'otomatik') return await autoPage(ctx);
      if (p0 === 'musteriler') return await customersPage(ctx);
      if (p0 === 'musteri') return await customerDetail(ctx, Number(sub[1]));
      if (p0 === 'raporlar') return await reportsPage(ctx);
    }
    else {
      if (p0 === 'musteriler') return await customersPage(ctx);
      if (p0 === 'musteri') return await customerDetail(ctx, Number(sub[1]));
      if (p0 === 'urunler') return await productReportPage(ctx);
      if (p0 === 'urun') return await productReportPage(ctx, Number(sub[1]));
    }
    if (p0 === 'ozet') return await reportsPage(ctx);
    if (p0 === 'gelir-gider') return await pnlPage(ctx);
    if (p0 === 'giderler') return await expensesPage(ctx);
    if (p0 === 'urunler') return await productsPage(ctx);
    if (p0 === 'ayarlar') return await settingsPage(ctx);
    page.innerHTML = '<div class="empty">Sayfa bulunamadı</div>';
  } catch (e) {
    console.error(e);
    const page = document.getElementById('page');
    if (page) page.innerHTML = `<div class="notice">${esc(e.message)}</div>`; else if (e.message !== 'Oturum gerekli') toast(e.message, true);
  }
}
window.addEventListener('hashchange', () => { document.querySelectorAll('.modal-bg').forEach(m => m.remove()); route(); });
window.PM_route = route;
export const refreshBoot = async () => { S.boot = await api('/bootstrap'); shellKey = null; };

(async () => {
  const intro = playIntro(); // panel arkada hazırlanır, animasyon bitince görünür
  route();
  await intro;
})();
