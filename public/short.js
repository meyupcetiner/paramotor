// Kısa ürün adı: "Kronberg Drycut 305x80", "Onci Mdf 300x3.2x96", "Junior Bimetal Şerit 10x0.6 6 TPI"
// Ürünler sayfası dışındaki tüm ekranlarda (otomatik giriş, satış formu, liste) kullanılır. Hem tarayıcı hem worker içe aktarır.
const n = x => (x === null || x === undefined || x === '') ? '' : String(+x);
const BAND_T = { Karbon: 'Karbon Şerit', Bimetal: 'Bimetal Şerit', Ahşap: 'Ahşap Şeridi', 'Et-Kemik': 'Et Şeridi', Carbide: 'Carbide Şerit', 'Kağıt-Sünger': 'Sünger Şeridi' };
const CIRC_T = { Ahşap: 'Ahşap', 'MDF-Suntalam': 'Mdf', 'Alüminyum-PVC': 'Alüminyum', Metal: 'Metal', Betopan: 'Betopan' };
const noParen = s => String(s || '').replace(/\s*\(.*?\)/g, '').trim();

// p: {name, mfr, category, subcategory, is_band}  v: {diameter, thickness, teeth, width, tpi, length, label}  opt: {length_mm, withTpi}
export function shortName(p, v = {}, opt = {}) {
  if (!p || !p.name) return '';
  const name = p.name, mfr = p.mfr || '';
  if (p.category === 'Hizmetler' || p.subcategory === 'Çıkma') return noParen(name);
  if (p.is_band) {
    const t = BAND_T[p.subcategory] || 'Şerit';
    const brand = p.subcategory === 'Karbon' ? '' : mfr;
    // bimetal ve carbide'de seri (Multicut, Durocut, Signier 4HX…) önemli: fiyatı farklı
    if (p.subcategory === 'Bimetal' || p.subcategory === 'Carbide') {
      const model = noParen(name).replace(new RegExp('^' + mfr + '\\s*', 'i'), '').replace(/\s*(Bimetal|Carbide)\s*Şerit.*$/i, '').replace(/\s+(RX|4HX|GL)$/i, '').trim();
      const sz = opt.length_mm && v.width ? `${Math.round(opt.length_mm)}x${n(v.width)}` : v.width ? `${n(v.width)}x${n(v.thickness)}` : '';
      const tp = opt.withTpi && v.tpi && /\d/.test(v.tpi) ? `${v.tpi} TPI` : '';
      return [mfr, model || t, sz, tp].filter(Boolean).join(' ');
    }
    const size = opt.length_mm && v.width ? `${Math.round(opt.length_mm)}x${n(v.width)}` : v.width ? `${n(v.width)}x${n(v.thickness)}` : '';
    const tpi = opt.withTpi && p.subcategory === 'Karbon' && v.tpi && /\d/.test(v.tpi) ? `${v.tpi} TPI` : '';
    return [brand, t, size, tpi].filter(Boolean).join(' ');
  }
  if (/dry\s*cut/i.test(name)) return [mfr, /paslanmaz/i.test(name) ? 'Paslanmaz Drycut' : 'Drycut', v.diameter ? `${n(v.diameter)}x${v.teeth || ''}`.replace(/x$/, '') : ''].filter(Boolean).join(' ');
  if (v.diameter && /freze/i.test(name)) return [mfr, 'Freze', [n(v.diameter), n(v.thickness)].filter(Boolean).join('x')].filter(Boolean).join(' '); // frezede başlık kalınlık
  if (v.diameter) {
    const t = /goldenline/i.test(name) ? (/oluklu/i.test(name) ? 'Goldenline Oluklu' : 'Goldenline') : /kurt/i.test(name) ? 'Kurt Diş' : /oluklu/i.test(name) ? 'Oluklu' : /ağaç|atlamal/i.test(name) ? 'Atlamalı' : /çizici/i.test(name) ? 'Çizici' : /kuyumcu/i.test(name) ? 'Kuyumcu' : /freze/i.test(name) ? 'Freze' : /portatif/i.test(name) ? 'Portatif' : /cermet/i.test(name) ? 'Cermet' : /friksiyon/i.test(name) ? 'Friksiyon' : /white/i.test(name) ? 'White' : /antifric/i.test(name) ? 'Antifric' : /tialn/i.test(name) ? 'TiAlN' : /\btin\b/i.test(name) ? 'TiN' : /makine testeresi/i.test(name) ? 'GF Makine' : (CIRC_T[p.subcategory] || '');
    // Onci ve Kronberg'de aynı çap/dişte ince-kalın versiyon olabilir: kalınlık da yazılır
    const withThick = v.thickness && (/^(onci|kronberg)$/i.test(mfr) || !v.teeth);
    const size = [n(v.diameter), withThick ? n(v.thickness) : '', v.teeth || ''].filter(Boolean).join('x');
    return [mfr, t, size].filter(Boolean).join(' ');
  }
  if (v.length && v.width) return `${noParen(name)} ${n(v.length)}x${n(v.width)}${v.thickness ? 'x' + n(v.thickness) : ''}`;
  if (v.length) return `${noParen(name)} ${n(v.length)}`;
  return noParen(name);
}
