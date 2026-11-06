// Testeresan 2025 Fiyat Listesi'nden çıkarılan ürün kataloğu (FİYATSIZ).
// Kaynak: kullanıcının yüklediği "Testeresan Fiyat Listesi 2025" PDF'i. Fiyat alanı kasıtlı olarak yok.
// Satır biçimi: daire testereler [çap, kalınlık, delik, diş]; şeritler [genişlik, kalınlık, "diş seçenekleri"].
// Diş seçenekleri '-' ile ayrılır; parantez içindekiler tek seçenektir: "6-(10/14)" => ["6","10/14"].

const D = 'Daire Testereler', S = 'Şerit Testereler', O = 'Diğer Ürünler';

export const CATEGORIES = {
  [D]: ['Ahşap', 'MDF-Suntalam', 'Alüminyum-PVC', 'Metal', 'Betopan'],
  [S]: ['Karbon', 'Et-Kemik', 'Ahşap', 'Bimetal', 'Carbide', 'Kağıt-Sünger'],
  [O]: ['El Testeresi', 'Planya Bıçağı', 'Endüstriyel Bıçak', 'Çıkma', 'Makine', 'Diğer'],
  ['Hizmetler']: ['Bileme', 'Kaynak']
};

// t: tip -> 'circ' (çap,kalınlık,delik,diş) | 'circ3' (çap,kalınlık,delik) | 'band' (gen,kal,tpi) | 'band2' (gen,kal) | 'band3' (gen,kal,diş tipi) | 'len' (uzunluk,genişlik,kalınlık) | 'hand' (uzunluk,diş) | 'single'
export const FAMILIES = [
  // ---------------- GLG (İspanya) ----------------
  { name: 'GLG HSS Freze Testere', mfr: 'GLG', cat: D, sub: 'Metal', t: 'circ', desc: 'Metal, pleksi, plastik kesimi. DIN1838, diş formu A.', rows: [
    [100,0.5,22,160],[100,0.7,22,128],[100,0.8,22,128],[100,1,22,128],[100,1.2,22,128],[100,1.6,22,100],[100,2,22,100],[100,2.5,22,100],[100,3,22,80],[100,3.5,22,80],[100,4,22,80],[100,4.5,22,80],[100,5,22,80],[100,5.5,22,64],[100,6,22,64],
    [125,0.5,22,160],[125,0.7,22,160],[125,0.8,22,160],[125,1,22,160],[125,1.2,22,128],[125,1.6,22,128],[125,2,22,128],[125,2.5,22,100],[125,3,22,100],[125,3.5,22,100],[125,4,22,100],[125,4.5,22,100],[125,5,22,80],[125,5.5,22,80],[125,6,22,80],
    [160,1,32,null],[160,1.2,32,null],[160,1.6,32,null],[160,2,32,null],[200,1,32,null],[200,1.2,32,null],[200,1.6,32,null],[200,2,32,null]] },
  { name: 'GLG HSS Kuyumcu Testeresi', mfr: 'GLG', cat: D, sub: 'Metal', t: 'circ', desc: 'Kuyumcu/bijuteri, çapaksız ve firesiz kesim. DIN1837.', rows: [[63,0.2,10,200],[63,0.3,10,200],[63,0.4,10,200]] },
  { name: 'GLG GF Makine Testeresi HSS/CO', mfr: 'GLG', cat: D, sub: 'Metal', t: 'circ', desc: 'Orbital boru kesme tezgahları için. %5 kobalt, diş formu BW.', rows: [[68,1.6,16,64]] },
  { name: 'GLG GF Makine Testeresi Extreme HSS/CO', mfr: 'GLG', cat: D, sub: 'Metal', t: 'circ', desc: 'Orbital boru kesme tezgahları için. Extreme seri.', rows: [[68,1.6,16,64]] },
  { name: 'GLG HSS Daire Testere White', mfr: 'GLG', cat: D, sub: 'Metal', t: 'circ3', desc: 'Düşük devir, soğutma sıvılı makineler. Not Steam Treated.', rows: [[200,1.8,32],[250,1.2,32],[250,1.6,32],[300,2,32]] },
  { name: 'GLG HSS Daire Testere Antifric', mfr: 'GLG', cat: D, sub: 'Metal', t: 'circ3', desc: 'Düşük devir, soğutma sıvılı makinelerde boru/profil/dolu malzeme.', rows: [[250,1.6,32],[250,2,32],[275,2,32],[275,2.5,32],[300,2,32],[300,2.5,32],[315,2,32],[315,2.5,32],[350,2,32],[350,2.5,32]] },
  { name: 'GLG HSS Daire Testere TIN', mfr: 'GLG', cat: D, sub: 'Metal', t: 'circ3', desc: 'Sert çelik ve paslanmaz, kaplamalı.', rows: [[250,2,32],[275,2,32],[315,2,32],[350,2,32]] },
  // ---------------- Krabbe ----------------
  { name: 'Krabbe HSS Daire Testere TIALN', mfr: 'Krabbe', cat: D, sub: 'Metal', t: 'circ3', desc: 'Sert çelik ve paslanmaz, TiAlN kaplama.', rows: [[225,1.6,32],[250,2,32],[275,1.6,32],[275,2,32],[275,2.5,32],[300,2,32],[300,2.5,32],[315,2,32],[315,2.5,32],[350,2,32],[350,2.5,32]] },
  { name: 'Krabbe Friksiyon ve Sıcak Kesim Testeresi CrV', mfr: 'Krabbe', cat: D, sub: 'Metal', t: 'circ3', desc: 'Chrome Vanadium, uçar testere, sıcak hadde kesimi.', rows: [[400,3,40],[450,3,40],[520,3,40],[520,4,40],[600,4,40]] },
  { name: 'Krabbe Cermet Daire Testere Kaplamasız', mfr: 'Krabbe', cat: D, sub: 'Metal', t: 'circ', desc: 'Çelik malzemelerin sulu kesimi.', rows: [[285,2,32,60],[285,2,32,80],[285,2,32,100],[460,2.7,50,40],[460,2.7,50,60],[460,2.7,50,80],[460,2.7,50,100]] },
  { name: 'Krabbe Cermet Daire Testere TIALN', mfr: 'Krabbe', cat: D, sub: 'Metal', t: 'circ', desc: 'Çelik malzemelerin sulu kesimi, TiAlN kaplama.', rows: [[285,2,32,60],[285,2,32,80],[285,2,32,100],[360,2.6,40,60],[360,2.6,40,80],[360,2.6,40,100],[460,2.7,50,40],[460,2.7,50,60],[460,2.7,50,80],[460,2.7,50,100]] },
  // ---------------- Kronberg (Almanya) ----------------
  { name: 'Kronberg Ağaç Testeresi (Atlamalı Dolu Boş Diş)', mfr: 'Kronberg', cat: D, sub: 'Ahşap', t: 'circ', desc: 'Kalın ağaç, odun vb. kesim.', rows: [[250,3.2,30,24],[300,3.2,30,28],[320,3.2,30,32],[350,3.5,30,32],[400,3.5,30,36],[450,4,30,40],[500,4,30,44],[550,4,30,40],[600,4.2,30,54]] },
  { name: 'Kronberg Ahşap Testeresi', mfr: 'Kronberg', cat: D, sub: 'Ahşap', t: 'circ', desc: 'Kalın ağaç, kereste, profesyonel kesim.', rows: [[250,2.4,30,40],[250,3.2,30,48],[250,3.2,30,60],[300,3.2,30,48],[300,3.2,30,60],[300,3.2,30,72],[350,3.5,30,54],[350,3.5,30,72],[400,3.5,30,60],[450,4,30,66],[500,4,30,72]] },
  { name: 'Kronberg Portatif Makine Testeresi', mfr: 'Kronberg', cat: D, sub: 'Ahşap', t: 'circ', desc: 'Portatif makinelerde sunta, kaba ağaç.', rows: [[160,2.6,'20-30',24],[160,2.6,'20-30',48],[180,2.4,'20-30',24],[180,2.4,'20-30',48],[190,2.4,'20-30',24],[190,2.4,'20-30',48],[200,2.8,30,48],[210,2.8,30,30],[210,2.8,30,48]] },
  { name: 'Kronberg Ahşap Çizici', mfr: 'Kronberg', cat: D, sub: 'MDF-Suntalam', t: 'circ', desc: 'Kaplı panellerde alt kırılmayı önler.', rows: [[125,'3.1/4.3',20,24]] },
  { name: 'Kronberg MDF Laminant Suntalam (Pozitif Diş)', mfr: 'Kronberg', cat: D, sub: 'MDF-Suntalam', t: 'circ', desc: 'MDF, laminant hassas ve sessiz kesim.', rows: [[200,3.2,30,64],[250,3.2,30,80],[300,3.2,30,96],[350,3.6,30,108]] },
  { name: 'Kronberg Alüminyum PVC (Negatif Diş)', mfr: 'Kronberg', cat: D, sub: 'Alüminyum-PVC', t: 'circ', desc: 'Alüminyum ve plastik profil, hassas ve sessiz kesim.', rows: [[190,2.8,30,54],[200,2,32,64],[200,3,30,64],[230,3.2,30,72],[250,3.2,30,80],[275,2.4,30,48],[300,3.2,'30-32',96],[355,2.2,30,50],[350,3.4,32,108],[400,4,30,108],[400,3.8,'30-32',120],[420,3.8,'30-32',120],[450,4,30,72],[450,3.8,32,120],[450,4,32,132],[500,4,32,120],[550,4,50,68],[550,4.4,30,128]] },
  { name: 'Kronberg Metal Dry Cut', mfr: 'Kronberg', cat: D, sub: 'Metal', t: 'circ', desc: 'Demir alaşımlı profillerin kuru kesimi. Çevresel hız 25 m/sn.', rows: [[180,2.2,20,34],[190,2.2,20,38],[200,1.8,32,68],[210,2.2,30,40],[230,2.2,30,44],[250,2.2,30,48],[305,2.2,25.4,60],[305,2.2,25.4,72],[305,2.2,25.4,80],[355,2.4,25.4,72],[355,2.4,25.4,84],[355,2.4,25.4,90],[400,2.6,32,108]] },
  { name: 'Kronberg Paslanmaz Dry Cut', mfr: 'Kronberg', cat: D, sub: 'Metal', t: 'circ', desc: 'Paslanmaz profillerin kuru kesimi.', rows: [[305,2.2,25.4,72],[355,2.4,25.4,84]] },
  { name: 'Kronberg Oluklu', mfr: 'Kronberg', cat: D, sub: 'MDF-Suntalam', t: 'circ', desc: 'Oluklu elmas testere; laminant ve kaplı panel.', rows: [[250, '3.2/2.2', 30, 48], [303, '3.2/2.2', 30, 60]] },
  // ---------------- Onci (Fransa) ----------------
  { name: 'Onci Ağaç Testeresi (Atlamalı Dolu Boş Diş)', mfr: 'Onci', cat: D, sub: 'Ahşap', t: 'circ', desc: 'Kalın ağaç, odun vb. kesim.', rows: [[250,2.2,30,24],[250,3.2,30,24],[300,2.5,30,28],[300,3.2,30,28],[350,3.6,30,32],[400,3.6,30,36],[450,4,30,36],[500,4,30,40]] },
  { name: 'Onci Ahşap Testeresi', mfr: 'Onci', cat: D, sub: 'Ahşap', t: 'circ', desc: 'Her türlü ağaç, plywood vb.', rows: [[250,3.2,30,48],[250,2.2,30,60],[250,3.2,30,60],[300,3.2,30,48],[300,3.2,30,60],[300,3.2,30,72]] },
  { name: 'Onci MDF Laminant Suntalam (Pozitif Diş)', mfr: 'Onci', cat: D, sub: 'MDF-Suntalam', t: 'circ', desc: 'MDF, laminant hassas kesim; kompakt laminant için ideal.', rows: [[200,2,30,64],[200,3,30,64],[250,2.2,30,80],[250,3.2,30,80],[300,2.5,30,96],[300,3.2,30,96]] },
  { name: 'Onci Alüminyum PVC (Negatif Diş)', mfr: 'Onci', cat: D, sub: 'Alüminyum-PVC', t: 'circ', desc: 'Alüminyum ve plastik profil, hassas ve sessiz kesim.', rows: [[180,3,30,58],[210,3,30,64],[250,2.2,32,80],[250,3.2,32,80],[300,2.5,32,96],[300,3.2,'30-32',96],[350,3.2,32,108],[400,2.6,30,108],[400,3.6,32,120],[400,3.8,'30-32',120],[420,3.2,32,72],[420,3.8,30,72],[450,4,32,108]] },
  { name: 'Onci Alüminyum PVC (Pozitif Diş)', mfr: 'Onci', cat: D, sub: 'Alüminyum-PVC', t: 'circ', desc: 'Alüminyum ve plastik profil, pozitif diş.', rows: [[500,4,'30-32',120],[550,4.4,50,68]] },
  { name: 'Onci Kurt Diş', mfr: 'Onci', cat: D, sub: 'MDF-Suntalam', t: 'circ', desc: 'Kurt diş; MDF ve laminant.', rows: [[250, 3.2, 30, 80], [300, 3.2, 30, 96]] },
  { name: 'Onci Goldenline Oluklu', mfr: 'Onci', cat: D, sub: 'MDF-Suntalam', t: 'circ', desc: 'Goldenline oluklu elmas testere; laminant ve kaplı panel.', rows: [[303, '3.2/2.2', 30, 60]] },
  { name: 'Onci Goldenline', mfr: 'Onci', cat: D, sub: 'MDF-Suntalam', t: 'circ', desc: 'Goldenline elmas testere (oluklu olmayan).', rows: [[250, '-', 30, 80]] },
  // ---------------- Flamex ----------------
  { name: 'Flamex PCD Betopan Kesim Testeresi', mfr: 'Flamex', cat: D, sub: 'Betopan', t: 'circ', desc: 'Fibercement, pvc, pleksiglas. TCT\'ye göre ~50 kat ömür.', rows: [[184,1.8,30,6],[235,2,30,6],[255,2.2,30,6],[305,2.4,30,8]] },
  { name: 'Flamex Elmas Uçlu Gaz Beton El Testeresi', mfr: 'Flamex', cat: O, sub: 'El Testeresi', t: 'hand', desc: 'Ytong kesimi, tüm dişler elmas uçlu.', rows: [[630,34]] },
  { name: 'Flamex Planya Bıçağı Carbon', mfr: 'Flamex', cat: O, sub: 'Planya Bıçağı', t: 'len', desc: 'Ahşap için planya bıçağı.', rows: [[400,35,3],[500,35,3],[600,35,3]] },
  { name: 'Flamex Planya Bıçağı HSS', mfr: 'Flamex', cat: O, sub: 'Planya Bıçağı', t: 'len', desc: 'Ahşap için planya bıçağı.', rows: [[400,35,3],[500,35,3],[600,35,3]] },
  // ---------------- Junior (şerit) ----------------
  { name: 'Junior Flexback Karbon Şerit', mfr: 'Junior', cat: S, sub: 'Karbon', t: 'band', bandType: 'karbon', desc: 'Ahşap, yumuşak metal, plastik.', rows: [[6,0.65,'4-6-8-10-14-18'],[10,0.65,'4-6-8-10-14-18'],[13,0.65,'4-6-8-10-14'],[16,0.8,'4-6-10'],[20,0.8,'4-6-10'],[25,0.9,'4-6-10']] },
  { name: 'Junior Multicut Bimetal Şerit (M42)', mfr: 'Junior', cat: S, sub: 'Bimetal', t: 'band', bandType: 'bimetal', desc: 'M42 çok amaçlı kullanım (6-13 mm dekupaj).', rows: [[6,0.6,'(10/14)'],[6,0.9,'10-14-(10/14)'],[10,0.6,'6-(10/14)'],[10,0.9,'6-8-10-14-(10/14)'],[13,0.6,'6-10-14-(6/10)-(8/12)-(10/14)'],[13,0.9,'4-6-8-10-14-(6/10)-(10/14)'],[20,0.9,'4-(4/6)-(5/8)-(6/10)-(8/12)-(10/14)'],[27,0.9,'2-3-4-(2/3)-(3/4)-(4/6)-(5/8)-(6/10)-(8/12)-(10/14)'],[34,1.1,'1.25-3-(1.5/2)-(2/3)-(3/4)-(4/6)-(5/8)'],[41,1.3,'1.25-(1.5/2)-(2/3)-(3/4)-(4/6)-(5/8)']] },
  { name: 'Junior Probeam Bimetal Şerit (M42)', mfr: 'Junior', cat: S, sub: 'Bimetal', t: 'band', bandType: 'bimetal', desc: 'M42 borular ve profiller.', rows: [[27,0.9,'(3/4)-(4/6)-(5/7)-(8/11)'],[34,1.1,'(2/3)-(3/4)-(4/6)-(5/7)'],[41,1.3,'(2/3)-(3/4)-(4/6)-(5/7)'],[54,1.6,'(2/3)-(3/4)-(4/6)'],[67,1.6,'(2/3)-(3/4)']] },
  { name: 'Junior Durocut Bimetal Şerit (M51)', mfr: 'Junior', cat: S, sub: 'Bimetal', t: 'band', bandType: 'bimetal', desc: 'M51 dolu ve sert malzemeler.', rows: [[27,0.9,'(2/3)-(3/4)-(4/6)'],[34,1.3,'(2/3)-(3/4)-(4/6)'],[41,1.3,'(1.5/2)-(2/3)-(3/4)-(4/6)']] },
  { name: 'Junior Powercut Carbide Şerit', mfr: 'Junior', cat: S, sub: 'Carbide', t: 'band', bandType: 'carbide', desc: 'İnkonel, titanyum, bronz vb. sert malzemeler.', rows: [[27,0.9,'(2/3)-3-(3/4)'],[34,1.1,'2-(2/3)'],[41,1.3,'(1.5/2)-(2/3)'],[54,1.6,'(0.85/1.15)-(1.5/2)']] },
  // ---------------- Schuster (şerit) ----------------
  { name: 'Schuster Signier 4HX Bimetal Şerit (M42)', mfr: 'Schuster', cat: S, sub: 'Bimetal', t: 'band', bandType: 'bimetal', desc: 'M42 çok amaçlı kullanım.', rows: [[20,0.9,'(5/8)-(8/12)-(10/14)'],[27,0.9,'(2/3)-(3/4)-(4/6)-(5/8)-(6/10)-(8/12)'],[34,1.1,'(2/3)-(3/4)-(4/6)-(5/8)'],[41,1.3,'(2/3)-(3/4)-(4/6)']] },
  { name: 'Schuster Performer RX Bimetal Şerit (M42)', mfr: 'Schuster', cat: S, sub: 'Bimetal', t: 'band', bandType: 'bimetal', desc: 'M42 boru, profil ve yapısal çelikler.', rows: [[20,0.9,'(4/6)-(5/7)'],[27,0.9,'(3/4)-(4/6)-(5/7)-(8/11)'],[34,1.1,'(2/3)-(3/4)-(4/6)'],[41,1.3,'(2/3)-(3/4)-(4/6)'],[54,1.6,'(2/3)-(3/4)-(4/6)']] },
  { name: 'Schuster Steelmaster Bimetal Şerit (M51)', mfr: 'Schuster', cat: S, sub: 'Bimetal', t: 'band', bandType: 'bimetal', desc: 'M51 sert çelik ve dolu malzemeler.', rows: [[27,0.9,'(2/3)-(3/4)-(4/6)'],[34,1.1,'(2/3)-(3/4)-(4/6)'],[41,1.3,'(2/3)-(3/4)']] },
  { name: 'Schuster Woodmaster Karbon Şerit', mfr: 'Schuster', cat: S, sub: 'Karbon', t: 'band', bandType: 'karbon', desc: 'Ahşap, yumuşak metal, plastik.', rows: [[6,0.65,'4-6'],[10,0.65,'4-6'],[13,0.65,'4-6']] },
  { name: 'Schuster Slender Karbon Şerit', mfr: 'Schuster', cat: S, sub: 'Karbon', t: 'band', bandType: 'karbon', desc: 'Küçük ölçekli, değerli ahşap firesiz kesim.', rows: [[6,0.36,'10-14'],[10,0.36,'10-14'],[13,0.36,'10-14']] },
  { name: 'Schuster Sharper Ahşap Şeridi (Bileyli Çaprazlı)', mfr: 'Schuster', cat: S, sub: 'Ahşap', t: 'band', bandType: 'ahşap', tpiLabel: 'hatve', desc: 'Standart marangoz makineleri. Dişsiz olarak da satılır.', rows: [[6,0.5,'4'],[10,0.5,'4'],[15,0.7,'8'],[20,0.7,'8'],[25,0.7,'8'],[30,0.7,'10'],[35,0.8,'12'],[40,0.8,'12']] },
  { name: 'Schuster Bonemaster Et-Kemik Şeridi', mfr: 'Schuster', cat: S, sub: 'Et-Kemik', t: 'band2', bandType: 'et-kemik', desc: 'Donmuş/kemikli et ve balık. İndüksiyonla sertleştirilmiş diş.', rows: [[16,0.5],[20,0.5],[25,0.8],[30,0.8]] },
  { name: 'Schuster Bonemaster Pro Et-Kemik Şeridi', mfr: 'Schuster', cat: S, sub: 'Et-Kemik', t: 'band2', bandType: 'et-kemik', desc: 'Pro seri, normal diş.', rows: [[16,0.5],[20,0.5]] },
  { name: 'Schuster Bonemaster Pro Et-Kemik Şeridi Vario Diş', mfr: 'Schuster', cat: S, sub: 'Et-Kemik', t: 'band2', bandType: 'et-kemik', desc: 'Pro seri, vario diş.', rows: [[16,0.5],[20,0.5]] },
  { name: 'Schuster Dişsiz Şerit (Kağıt/Sünger/Strafor)', mfr: 'Schuster', cat: S, sub: 'Kağıt-Sünger', t: 'band3', bandType: 'kağıt-sünger', desc: 'Bileysiz olarak 120 mm genişliğe kadar mevcut.', rows: [[10,0.45,'Bileyli'],[12,0.45,'Bileyli'],[15,0.45,'Bileyli'],[20,0.45,'Bileyli'],[25,0.45,'Bileyli'],[30,0.45,'Bileyli'],[10,0.45,'Çift Taraflı Bileyli'],[15,0.45,'Çift Taraflı Bileyli'],[20,0.45,'Bileysiz'],[25,0.45,'Bileysiz'],[30,0.45,'Bileysiz']] },
  { name: 'Schuster Dişli Çift Taraflı Şerit (Kağıt/Sünger)', mfr: 'Schuster', cat: S, sub: 'Kağıt-Sünger', t: 'band2', bandType: 'kağıt-sünger', desc: '20 ve 25 mm tek taraflı olarak da mevcut.', rows: [[10,0.45],[15,0.45],[20,0.45],[25,0.45],[30,0.45]] },
  { name: 'Schuster Dalgalı Şerit (Kağıt/Sünger)', mfr: 'Schuster', cat: S, sub: 'Kağıt-Sünger', t: 'band2', bandType: 'kağıt-sünger', desc: 'Dalgalı ağız.', rows: [[15,0.45],[20,0.45],[25,0.45],[30,0.45]] },
  { name: 'Schuster Sivri Dişli Dalgalı Şerit (Kağıt/Sünger)', mfr: 'Schuster', cat: S, sub: 'Kağıt-Sünger', t: 'band2', bandType: 'kağıt-sünger', desc: 'Sivri dişli dalgalı ağız.', rows: [[10,0.45],[15,0.45],[20,0.45]] },
  // ---------------- Testeresan imalat ----------------
  { name: 'Testeresan Endüstriyel Bıçak (Özel İmalat)', mfr: 'Testeresan', cat: O, sub: 'Endüstriyel Bıçak', t: 'single', desc: 'CNC ile özel ölçü imalat bıçaklar. Ölçü satırda açıklamaya yazılır.', rows: [[]] },
  // hizmetler (WhatsApp geçmişindeki satışlardan)
  { name: 'Bor Yağı', mfr: 'Testeresan', cat: O, sub: 'Diğer', t: 'single', desc: 'Kesme / soğutma yağı (bor yağı).', rows: [[]] },
  { name: 'Çıkma Testere', mfr: 'Testeresan', cat: O, sub: 'Çıkma', t: 'single', desc: 'İkinci el (çıkma) testere. Ölçü/tür satır açıklamasına yazılır.', rows: [[]] },
  { name: 'Bileme Hizmeti', mfr: 'Testeresan', cat: 'Hizmetler', sub: 'Bileme', t: 'single', desc: 'Freze, daire, Dry Cut / TCT bileme, diş açma, tamir.', rows: [[]] },
  { name: 'Kaynak Hizmeti', mfr: 'Testeresan', cat: 'Hizmetler', sub: 'Kaynak', t: 'single', desc: 'Şerit kesim ve kaynak, kopan şerit kaynağı.', rows: [[]] }
];

const num = v => (v === null || v === undefined) ? '' : String(v).replace('.', ',');
export function splitTpi(s) {
  const out = []; let cur = '', depth = 0;
  for (const ch of String(s)) {
    if (ch === '(') { depth++; continue; }
    if (ch === ')') { depth--; continue; }
    if (ch === '-' && depth === 0) { if (cur) out.push(cur); cur = ''; continue; }
    cur += ch;
  }
  if (cur) out.push(cur);
  return out;
}

// Aileleri düz varyant listesine çevirir.
export function expandCatalog() {
  const products = [];
  FAMILIES.forEach((f, i) => {
    const p = { key: i + 1, name: f.name, mfr: f.mfr, category: f.cat, subcategory: f.sub, unit: 'Adet', description: f.desc || '', is_band: f.cat === S ? 1 : 0, band_type: f.bandType || null, variants: [] };
    for (const r of f.rows) {
      if (f.t === 'circ' || f.t === 'circ3') {
        const [d, k, b, z] = r;
        p.variants.push({ label: (k === '-' ? `Ø${d} × ${num(b)}` : `Ø${d} × ${typeof k === 'number' ? num(k) : String(k).replace(/\./g, ',')} × ${num(b)}`) + (z ? ` · Z${z}` : ''), diameter: d, thickness: typeof k === 'number' ? k : null, bore: String(b), teeth: z || null });
      } else if (f.t === 'band') {
        const [w, k, tp] = r;
        for (const t of splitTpi(tp)) p.variants.push({ label: `${w} × ${num(k)} mm · ${t} ${f.tpiLabel === 'hatve' ? 'hatve' : 'TPI'}`, width: w, thickness: k, tpi: t });
      } else if (f.t === 'band2') {
        const [w, k] = r; p.variants.push({ label: `${w} × ${num(k)} mm`, width: w, thickness: k });
      } else if (f.t === 'band3') {
        const [w, k, x] = r; p.variants.push({ label: `${w} × ${num(k)} mm · ${x}`, width: w, thickness: k, tpi: x });
      } else if (f.t === 'len') {
        const [l, w, k] = r; p.variants.push({ label: `${l} × ${w} × ${k} mm`, length: l, width: w, thickness: k });
      } else if (f.t === 'hand') {
        const [l, z] = r; p.variants.push({ label: `${l} mm · ${z} diş`, length: l, teeth: z });
      } else {
        p.variants.push({ label: 'Standart' });
      }
    }
    products.push(p);
  });
  return products;
}
