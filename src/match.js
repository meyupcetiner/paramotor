// Ürün eşleştirme: mesajdaki ürün metnini katalogdaki gerçek bir varyantla eşleştirir.
// Tahmin yapmaz: sadece puanlar; güven düşükse "warn" döner ve alternatifleri listeler.

export function trLower(s) {
  return String(s || '').replace(/I/g, 'ı').replace(/İ/g, 'i').toLowerCase();
}
export function fold(s) { // aksan/Türkçe harfleri sadeleştirir (arama için)
  return trLower(s).replace(/ı/g, 'i').replace(/ğ/g, 'g').replace(/ü/g, 'u').replace(/ş/g, 's').replace(/ö/g, 'o').replace(/ç/g, 'c').replace(/â/g, 'a');
}

const SUB_WORDS = [
  ['MDF-Suntalam', /\b(mdf|sunta|suntalam|laminant|laminat|tepsi|panel|cizici|cizer)/],
  ['Alüminyum-PVC', /\b(aluminyum|alu|alum|pvc|plastik|profil aluminyum)/],
  ['Betopan', /\b(betopan|fiber|fibercement|pcd)/],
  ['Et-Kemik', /\b(et|kemik|balik|kasap|bone|bonemaster)\b/],
  ['Bimetal', /\b(bimetal|bi-metal|bi metal|m42|m51|dekupaj)/],
  ['Carbide', /\b(carbide|karbur|karbit|powercut)/],
  ['Karbon', /\b(karbon|carbon|flexback|woodmaster|slender)/],
  ['Kağıt-Sünger', /\b(sunger|strafor|kagit|dissiz|dalgali)/],
  ['Metal', /\b(metal|demir|dry ?cut|kuru kesim|paslanmaz|inox|hss|celik|antifric|cermet|friksiyon|kuyumcu)/],
  ['Ahşap', /\b(ahsap|agac|odun|kereste|tomruk|ahşap|marangoz|sharper|kontrplak|plywood)/]
];
const BRANDS = ['kronberg', 'onci', 'glg', 'krabbe', 'junior', 'schuster', 'flamex', 'testeresan'];
const LINES = ['freze bileme', 'hss freze', 'drycut bileme', 'dry cut bileme', 'kaynak', 'tamir', 'multicut', 'probeam', 'durocut', 'powercut', 'flexback', 'signier', 'performer', 'steelmaster', 'woodmaster', 'slender', 'sharper', 'bonemaster', 'antifric', 'white', 'tialn', 'tin', 'cermet', 'kuyumcu', 'freze', 'portatif', 'cizici', 'friksiyon', 'vario', 'atlamali', 'bor yagi', 'goldenline', 'oluklu', 'kurt dis', 'dry cut', 'paslanmaz', 'planya', 'gaz beton'];

function numbersIn(t) {
  return (t.match(/\d+(?:[.,]\d+)?/g) || []).map(x => parseFloat(x.replace(',', '.')));
}

// Ham metinden ölçüleri çıkarmaya çalışır (yapay zekâ çıkardıysa onlar önceliklidir).
export function extractDims(raw) {
  const t = fold(raw).replace(/[×*]/g, 'x');
  const d = {};
  const z = t.match(/(?:\bz\s*-?\s*(\d{1,3})(?![\d/.,])|(?<![\d.,])(\d{1,3})\s*(?:dis|dişli|disli|diş|z)\b)/);
  if (z) d.teeth = parseInt(z[1] || z[2]);
  const tpi = t.match(/(\d{1,2}(?:[.,]\d+)?\s*\/\s*\d{1,2}(?:[.,]\d+)?)\s*(?:tpi)?/);
  if (tpi && !/x/.test(tpi[1])) d.tpi = tpi[1].replace(/\s/g, '').replace(/,/g, '.');
  else { const tp2 = t.match(/(\d{1,2}(?:[.,]\d+)?)\s*tpi/); if (tp2) d.tpi = tp2[1].replace(',', '.'); }
  const len = t.match(/(\d{3,5})\s*(mm|cm)?\s*(?:boy|uzunlu|uzunlug)/) || t.match(/(?:boy|uzunluk|uzunlugu)\s*:?\s*(\d{3,5})\s*(mm|cm)?/);
  if (len) { let v = parseFloat(len[1]); if (len[2] === 'cm') v *= 10; d.length_mm = v; }
  // a x b x c kalıbı
  const m = t.match(/(\d+(?:[.,]\d+)?)\s*x\s*(\d+(?:[.,]\d+)?)(?:\s*x\s*(\d+(?:[.,]\d+)?))?(?:\s*x\s*(\d+(?:[.,]\d+)?))?/);
  if (m) {
    const v = m.slice(1).filter(Boolean).map(x => parseFloat(x.replace(',', '.')));
    if (v[0] >= 500) { // şerit: boy x genişlik x kalınlık
      d.length_mm = d.length_mm || v[0]; if (v[1]) d.width = v[1]; if (v[2]) d.thickness = v[2];
    } else if (v[0] >= 6 && v[0] <= 67 && v[1] && v[1] < 2 && v[2] >= 500) { // genişlik x kalınlık x boy
      d.width = v[0]; d.thickness = v[1]; d.length_mm = d.length_mm || v[2];
    } else if (v[0] < 2 && v[1] >= 6 && v[1] <= 67) { // kalınlık x genişlik (x boy)
      d.thickness = v[0]; d.width = v[1]; if (v[2] >= 500) d.length_mm = d.length_mm || v[2];
    } else if (v[0] >= 60 && v[0] <= 700) { // daire: çap x kalınlık x delik [x diş] veya çap x diş
      d.diameter = v[0];
      if (v.length === 2) { if (v[1] >= 6 && Number.isInteger(v[1]) && v[1] > 10) d.teeth = d.teeth || v[1]; else d.thickness = v[1]; }
      else { d.thickness = v[1]; if (v[2]) d.bore = String(v[2]); if (v[3]) d.teeth = d.teeth || v[3]; }
    } else if (v[0] >= 6 && v[0] <= 67 && v[1] && v[1] < 2) { d.width = v[0]; d.thickness = v[1]; }
  }
  const lik = t.match(/(\d+(?:[.,]\d+)?)\s*'?\s*(?:lik|lık|luk|lük|lu|li|mm'lik)\b/);
  if (lik) { const v = parseFloat(lik[1].replace(',', '.')); if (v >= 100 && v <= 700 && !d.diameter) d.diameter = v; else if (v >= 6 && v <= 67 && !d.width) d.width = v; }
  if (d.width && !d.length_mm) { // şeritte ayrı yazılmış boy: "10x0,6 1790"
    const cand = (t.replace(/\d+(?:[.,]\d+)?\s*\/\s*\d+/g, ' ').match(/(?<![\d.,x])\d{3,4}(?![\d.,]|\s*(?:tl|₺|lira|z\b|dis))/g) || []).map(Number).find(n => n >= 500 && n <= 9999);
    if (cand) d.length_mm = cand;
  }
  const gen = t.match(/(\d{1,2})\s*mm\s*(?:genis|en\b)/) || t.match(/(?:genislik|en)\s*:?\s*(\d{1,2})\b/);
  if (gen && !d.width) d.width = parseFloat(gen[1]);
  if (!d.diameter && !d.width) {
    const nums = numbersIn(t);
    const dia = nums.find(n => n >= 100 && n <= 650 && Number.isInteger(n));
    if (dia && !/serit/.test(t)) d.diameter = dia;
  }
  return d;
}

function eqNum(a, b, tol = 0.011) { return a != null && b != null && Math.abs(Number(a) - Number(b)) <= tol; }
function normTpi(s) { return String(s || '').replace(/\s/g, '').replace(/,/g, '.').replace(/^0+(\d)/, '$1'); }

// catalog: [{id, product_id, label, diameter, thickness, bore, teeth, width, tpi, length, p: {name, mfr, category, subcategory, is_band}}]
export function matchItem(item, catalog) {
  const raw = [item.raw_text, item.product_hint, item.brand_hint].filter(Boolean).join(' ');
  const t = fold(raw).replace(/dry\s*-?\s*cut/g, 'dry cut').replace(/kuru\s*kesim/g, 'dry cut').replace(/martin\s*-?\s*mill?er/g, 'schuster sharper ahsap serit').replace(/golden\s*-?\s*line/g, 'goldenline').replace(/kurt\s*-?\s*dis/g, 'kurt dis');
  const dims = { ...extractDims(item.raw_text || ''), ...strip(item) };
  if (dims.width && dims.teeth != null && !dims.tpi && !dims.diameter) { dims.tpi = String(dims.teeth); delete dims.teeth; } // şeritte "14z" = 14 TPI
  let kind = item.kind && item.kind !== 'belirsiz' ? item.kind : null;
  if (item.service || (/bileme|bilet|dis ac|kopan|tamir|torna/.test(t) || (/kaynak|kaynat/.test(t) && !/kaynakli/.test(t))) && !/makine/.test(t)) kind = 'hizmet';
  const svcKaynak = /kaynak|kaynat|kopan/.test(t);
  if (!kind) kind = (/serit|şerit/.test(t) || dims.width || dims.length_mm) ? 'serit' : (dims.diameter ? 'daire' : null);
  const subs = SUB_WORDS.filter(([, re]) => re.test(t)).map(([s]) => s);
  const brand = BRANDS.find(b => t.includes(b)) || (item.brand_hint ? BRANDS.find(b => fold(item.brand_hint).includes(b)) : null);
  const lines = LINES.filter(l => t.includes(l));
  const freud = /fr[eo]u?d|fırud|front/.test(t);
  const words = [...new Set(t.split(/[^a-z0-9]+/).filter(w => w.length >= 3 && !/^\d/.test(w) && !['adet', 'serit', 'testere', 'mm', 'tpi', 'dis'].includes(w)))];

  const scored = [];
  for (const v of catalog) {
    const p = v.p; let s = 0; const why = [];
    const isBand = !!p.is_band;
    if (kind === 'serit' && !isBand) s -= 60;
    if (kind === 'daire' && isBand) s -= 60;
    if (kind === 'diger' && p.category !== 'Diğer Ürünler') s -= 30;
    if (kind === 'hizmet') { if (p.category !== 'Hizmetler') s -= 200; else s += 40 + ((p.subcategory === 'Kaynak') === svcKaynak ? 30 : -30); }
    else if (p.category === 'Hizmetler') s -= 80;
    const pname = fold(p.name + ' ' + p.subcategory + ' ' + p.mfr);
    if (subs.length) {
      const hit = subs.some(x => x === p.subcategory || (x === 'Ahşap' && isBand && p.subcategory === 'Karbon'));
      s += hit ? 25 : -25;
      if (hit) why.push('tür');
    }
    if (brand) { if (fold(p.mfr) === brand) { s += 20; why.push('marka'); } else s -= 25; }
    for (const l of lines) if (pname.includes(l)) { s += 15; why.push(l); }
    const SERIES = ['multicut', 'probeam', 'durocut', 'powercut', 'flexback', 'signier', 'performer', 'steelmaster', 'woodmaster', 'slender', 'sharper', 'bonemaster'];
    if (isBand && lines.some(l => SERIES.includes(l)) && SERIES.some(x => pname.includes(x)) && !lines.some(l => SERIES.includes(l) && pname.includes(l))) s -= 30; // mesajda seri yazıyorsa başka seri seçilmez
    for (const w of words) if (pname.includes(w)) s += 4; else if (/^(pro|vario|tin|tialn|white|antifric)$/.test(w)) s -= 0; 
    { const pn = fold(p.name).replace(/\s*\(.*?\)/g, '').trim(); if (pn.length >= 6 && t.includes(pn) && !v.diameter && !v.width) s += 40; } // ölçüsüz ürün adı birebir geçiyor (Bor Yağı vb.)
    if (/kurt dis|oluklu/.test(pname) && !lines.some(l => pname.includes(l))) s -= 12; // özel seriler ancak adı geçince
    if (/goldenline/.test(t) && !/golden/.test(pname)) s -= 200; // Goldenline ayrı seri
    if (/golden/.test(pname) && !/goldenline/.test(t)) s -= 30;
    if (!words.includes('pro') && /\bpro\b/.test(pname)) s -= 3; if (!words.includes('vario') && /vario/.test(pname)) s -= 3;
    if (dims.diameter != null) { if (eqNum(v.diameter, dims.diameter, 0.5)) { s += 40; why.push('çap'); } else if (v.diameter != null) s -= 45; else s -= 20; }
    if (dims.teeth != null) { if (v.teeth != null && Number(v.teeth) === Number(dims.teeth)) { s += 25; why.push('diş'); } else if (v.teeth != null) s -= 20; }
    if (dims.thickness != null) { if (eqNum(v.thickness, dims.thickness, 0.051)) { s += 12; why.push('kalınlık'); } else if (v.thickness != null) s -= 8; }
    if (dims.bore != null && v.bore) { if (String(v.bore).split('-').some(b => eqNum(b, String(dims.bore).replace(',', '.'), 0.2))) s += 5; else s -= 3; }
    if (dims.width != null) { if (eqNum(v.width, dims.width, 0.5)) { s += 30; why.push('genişlik'); } else if (v.width != null) s -= 40; else s -= 15; }
    if (dims.tpi != null && v.tpi) { if (normTpi(v.tpi) === normTpi(dims.tpi)) { s += 15; why.push('TPI'); } else s -= 6; }
    // marka belirtilmemişse öncelik sırası: Kronberg > Onci (iş kuralı), eşitlik bozucu çok küçük puan
    if (!brand) s += ({ Kronberg: 0.3, Onci: 0.2 })[p.mfr] || 0;
    if ((!brand || brand === 'junior') && !lines.length && p.subcategory === 'Bimetal' && p.mfr === 'Junior') s += /multicut/i.test(p.name) ? 14 : 4;
    if (brand === 'schuster' && !lines.length && p.subcategory === 'Bimetal' && /signier/i.test(p.name)) s += 14; // Schuster bimetal, seri yazmıyorsa: Signier 4HX // iş kuralı: markasız bimetal = Junior (Multicut)
    if (/dekupaj/.test(t) && isBand && v.width > 13) s -= 30; // dekupaj = 13 mm'ye kadar bimetal
    scored.push({ v, s, why });
  }
  scored.sort((a, b) => b.s - a.s);
  const best = scored[0], second = scored[1];
  const flags = [];
  if (freud) flags.push('Mesajda Freud geçiyor; Freud katalogda yok, en yakın ürün önerildi.');
  if (!best || best.s < 35) flags.push('Ürün katalogla güvenle eşleşmedi, lütfen seçin.');
  const sameSize = (a, b) => a.v.product_id === b.v.product_id && eqNum(a.v.width ?? -1, b.v.width ?? -1) && eqNum(a.v.thickness ?? -1, b.v.thickness ?? -1);
  const sameSpec = (a, b) => a && b && a.v.p.subcategory === b.v.p.subcategory && a.v.p.is_band === b.v.p.is_band && eqNum(a.v.width ?? -1, b.v.width ?? -1) && eqNum(a.v.thickness ?? -1, b.v.thickness ?? -1) && normTpi(a.v.tpi) === normTpi(b.v.tpi) && eqNum(a.v.diameter ?? -1, b.v.diameter ?? -1) && (a.v.teeth ?? -1) === (b.v.teeth ?? -1);
  // şeritte mesajdaki TPI katalogda yoksa: TPI fiyatı değiştirmez, en yakın kayıt alınır, mesajdaki TPI korunur (uyarı yok)
  let tpiOverride = null;
  if (best && best.v.p.is_band && dims.tpi && !catalog.some(x => x.product_id === best.v.product_id && eqNum(x.width, best.v.width) && eqNum(x.thickness, best.v.thickness) && normTpi(x.tpi) === normTpi(dims.tpi))) tpiOverride = dims.tpi;
  if (kind === 'hizmet' && best && best.v.p.category === 'Hizmetler') { /* hizmet: tek başlık, uyarı yok */ }
  else if (tpiOverride && second && sameSize(best, second)) { /* sadece TPI farkı: uyarı yok */ }
  else if (second && best.s - second.s < 8 && !(!brand && best.v.p.subcategory === 'Karbon' && sameSpec(best, second))) flags.push(brand ? 'Birden fazla varyant benzer; doğru olanı kontrol edin.' : 'Marka/varyant net değil; önerilen ürünü kontrol edin.');
  if (kind === 'serit' && !dims.length_mm && best && best.v.p.is_band) flags.push('Şerit boyu (mm) mesajda bulunamadı.');
  if (best && !best.v.p.is_band && dims.teeth != null && best.v.teeth != null && Number(best.v.teeth) !== Number(dims.teeth)) flags.push('Bu diş sayısı katalogda yok, en yakını önerildi.');
  const confident = !!best && best.s >= 35 && flags.length === 0;
  return {
    tpi_override: tpiOverride,
    variant_id: best && best.s >= 0 ? best.v.id : null,
    product_id: best && best.s >= 0 ? best.v.product_id : null,
    score: best ? Math.round(best.s) : 0,
    confidence: confident ? 'ok' : (best && best.s >= 35 ? 'warn' : 'low'),
    dims, flags,
    alternatives: scored.slice(0, 6).filter(x => x.s > -20).map(x => ({ variant_id: x.v.id, product_id: x.v.product_id, name: x.v.p.name, label: x.v.label, score: Math.round(x.s) }))
  };
}
function strip(o) {
  const r = {};
  for (const k of ['diameter', 'thickness', 'bore', 'teeth', 'width', 'tpi', 'length_mm']) if (o[k] !== undefined && o[k] !== null && o[k] !== '') r[k] = k === 'tpi' || k === 'bore' ? String(o[k]) : Number(o[k]);
  return r;
}
