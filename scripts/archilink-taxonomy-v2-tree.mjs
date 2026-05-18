/**
 * Final Archilink taxonomy L1→L2→L3 (6 / 32 / N).
 * Sluglar URL-safe; özel slug gerekiyorsa explicit üçüncü argüman.
 */

/** Node script uyumlu slugify (src/lib/slugs.js ile aynı mantık; runtime import yok). */
function slugify(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ı/g, "i")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const ROWS = [];

function addL3(l1s, l1n, l2s, l2n, names) {
  for (const item of names) {
    if (typeof item === "string") {
      ROWS.push([l1s, l1n, l2s, l2n, slugify(item), item]);
    } else {
      ROWS.push([l1s, l1n, l2s, l2n, item.slug, item.name_tr]);
    }
  }
}

/* ─── 1. Zemin & Yüzey ─── */
addL3("zemin-yuzey", "Zemin & Yüzey", "zemin-kaplamalari", "Zemin Kaplamaları", [
  "Ahşap Zemin",
  "Laminat Zemin",
  "Vinil ve LVT Zemin",
  { slug: "hali-ve-karo-hali", name_tr: "Halı ve Karo Halı" },
  "Seramik ve Porselen Zemin",
  "Doğal Taş Zemin",
  "Beton ve Mikrobeton Zemin",
  "Terrazzo Zemin",
  "Epoksi ve Reçine Zemin",
  "Kauçuk Zemin",
  "Yükseltilmiş Döşeme Sistemleri",
  "Deck ve Dış Mekan Zemin Kaplamaları",
  "Süpürgelik ve Zemin Profilleri",
]);

addL3("zemin-yuzey", "Zemin & Yüzey", "duvar-kaplamalari", "Duvar Kaplamaları", [
  "Ahşap Duvar Kaplamaları",
  "Metal Duvar Kaplamaları",
  "Seramik Duvar Kaplamaları",
  "Doğal Taş Duvar Kaplamaları",
  "Cam Duvar Yüzeyleri",
  "Kompozit Duvar Panelleri",
  "Duvar Kağıtları",
  "Tekstil Duvar Kaplamaları",
  "Boya ve Dekoratif Sıvalar",
  "Mikrobeton ve Beton Görünümlü Yüzeyler",
  "Yüzey Bitişleri ve Profiller",
]);

addL3("zemin-yuzey", "Zemin & Yüzey", "tavan-sistemleri", "Tavan Sistemleri", [
  "Asma Tavan Sistemleri",
  "Modüler Tavan Sistemleri",
  "Taşyünü Tavan Panelleri",
  "Metal Tavan Sistemleri",
  "Mesh ve Grid Tavan Sistemleri",
  "Ahşap Tavan Sistemleri",
  "Alçıpan Tavan Sistemleri",
  "Lineer Tavan Sistemleri",
  "Gizli Işık Profilleri ve Tavan Kornişleri",
  "Tavan Taşıyıcı ve Profil Sistemleri",
  "Tavan Aksesuarları",
]);

addL3("zemin-yuzey", "Zemin & Yüzey", "panel-levha-yuzeyler", "Panel & Levha Yüzeyler", [
  "Ahşap Kaplama ve Veneer",
  "HPL ve Kompakt Laminat",
  "Metal Yüzey Levhaları",
  "Doğal Taş ve Mermer Levhalar",
  "Seramik ve Porselen Levhalar",
  "Reçine ve Solid Surface",
  "Kompozit Levhalar",
  { slug: "kece-paneller", name_tr: "Keçe Paneller" },
  "Tekstil ve Deri Yüzeyler",
  "Beton ve Çimento Esaslı Levhalar",
]);

addL3("zemin-yuzey", "Zemin & Yüzey", "akustik-urunler", "Akustik Ürünler", [
  "Akustik Paneller",
  { slug: "kece-akustik-paneller", name_tr: "Keçe Akustik Paneller" },
  "Ahşap ve Perfore Akustik Paneller",
  "3D Akustik Paneller",
  "Baffle ve Asılı Akustik Elemanlar",
  "Canopy Akustik Sistemler",
  "Akustik Grid Sistemleri",
  "Akustik Bölücüler ve Separatörler",
  "Akustik Kabinler",
  "Akustik Membran ve Bariyer",
  "Gürültü Kontrol Çözümleri",
]);

addL3("zemin-yuzey", "Zemin & Yüzey", "yalitim", "Yalıtım", [
  "Isı Yalıtımı",
  "Su Yalıtımı",
  "Ses Yalıtımı",
  "Yangın Yalıtımı",
  "Çatı Yalıtımı",
  "Cephe Yalıtımı",
  "Zemin Yalıtımı ve Şilte",
  "Yalıtım Levhaları",
  "Yalıtım Membranları",
  "Yalıtım Bantları ve Yardımcı Ürünler",
]);

/* ─── 2. Yapı & Cephe ─── */
addL3("yapi-cephe", "Yapı & Cephe", "cephe-sistemleri", "Cephe Sistemleri", [
  "Giydirme Cephe Sistemleri",
  "Alüminyum Cephe Sistemleri",
  "Metal Cephe Kaplamaları",
  "Seramik Cephe Kaplamaları",
  "Taş Cephe Kaplamaları",
  "Kompozit Cephe Panelleri",
  "Güneş Kırıcılar ve Lamellar",
  "Cephe Profilleri ve Taşıyıcılar",
  "Cephe Aksesuarları",
  "Metal Çatı Sistemleri",
  "Kiremit ve Çatı Kaplamaları",
  "Membran ve Çatı Örtüleri",
  "Çatı Panelleri",
  "Yeşil Çatı Sistemleri",
  "Çatı Aksesuarları ve Detayları",
]);

addL3("yapi-cephe", "Yapı & Cephe", "pencere-dograma-cam", "Pencere, Doğrama & Cam", [
  "Alüminyum Doğrama",
  "PVC Doğrama",
  "Ahşap Doğrama",
  "Kompozit Doğrama",
  "Panjur ve Kepenk Sistemleri",
  "Pencere Aksesuarları",
  "Cam Bölme Sistemleri",
  "Sürme ve Katlanır Cam Sistemleri",
  "Güvenlik ve Lamine Camlar",
  "Dekoratif Cam Yüzeyler",
  "Akıllı Cam ve Özel Cam Çözümleri",
]);

addL3("yapi-cephe", "Yapı & Cephe", "kapi-sistemleri", "Kapı Sistemleri", [
  "İç Kapılar",
  "Dış Kapılar",
  "Cam Kapılar",
  "Sürme Kapılar",
  "Katlanır ve Harmonika Kapılar",
  "Otomatik Kapılar",
  "Yangın Kapıları",
  "Akustik Kapılar",
]);

addL3("yapi-cephe", "Yapı & Cephe", "merdiven-korkuluk", "Merdiven & Korkuluk", [
  { slug: "ic-mekan-merdivenleri", name_tr: "İç Mekan Merdivenleri" },
  "Dış Mekan Merdivenleri",
  "Metal Korkuluklar",
  "Cam Korkuluklar",
  "Ahşap Korkuluklar",
  "Küpeşte Sistemleri",
  "Merdiven Basamak Kaplamaları",
  { slug: "merdiven-aksesuarlari", name_tr: "Merdiven Aksesuarları" },
]);

addL3("yapi-cephe", "Yapı & Cephe", "yapi-donanimi", "Yapı Donanımı", [
  "Kapı Kolları ve Tutamaklar",
  "Menteşeler",
  "Kilit ve Silindir Sistemleri",
  "Kapı Kapatıcılar ve Frenler",
  "Panik Barlar",
  "Sürme Sistem Donanımları",
  "Mobilya Donanımları",
  "Bağlantı ve Ankraj Elemanları",
  "Askı ve Taşıyıcı Aparatlar",
  "Profil ve Montaj Aksesuarları",
]);

addL3("yapi-cephe", "Yapı & Cephe", "yapi-kimyasallari", "Yapı Kimyasalları", [
  "Yapıştırıcılar",
  "Derz Dolguları",
  "Mastik ve Silikonlar",
  "Harç ve Tamir Ürünleri",
  "Astarlar ve Yüzey Hazırlık Ürünleri",
  "Montaj Köpükleri",
  "Ankraj Kimyasalları",
  "Koruyucu Kaplamalar ve Emprenye",
]);

/* ─── 3. İç Mekan & Mobilya ─── */
addL3("ic-mekan-mobilya", "İç Mekan & Mobilya", "koltuk-sandalye", "Koltuk & Sandalye", [
  "Sandalyeler",
  "Koltuklar",
  "Kanepeler ve Köşe Takımları",
  "Tabureler",
  "Puflar",
  "Banklar",
]);

addL3("ic-mekan-mobilya", "İç Mekan & Mobilya", "masa-buro", "Masa & Büro", [
  "Yemek Masaları",
  "Çalışma ve Ofis Masaları",
  "Toplantı Masaları",
  "Sehpa ve Yan Masalar",
  "Resepsiyon ve Banko Mobilyaları",
  "Çalışma İstasyonları ve Workstation Sistemleri",
  "Modüler Çalışma Alanları",
]);

addL3("ic-mekan-mobilya", "İç Mekan & Mobilya", "depolama-raf", "Depolama & Raf", [
  "Dolaplar",
  "Raf Sistemleri",
  "Vitrinler",
  "Keson ve Çekmece Sistemleri",
  "Ofis Depolama Sistemleri",
]);

addL3("ic-mekan-mobilya", "İç Mekan & Mobilya", "bolme-sistemleri", "Bölme Sistemleri", [
  "Ofis Bölme Sistemleri",
  "Hareketli Bölme Duvarlar",
  "Paravanlar",
  "Telefon Kabinleri",
  "Toplantı Kabinleri",
  "Çalışma Kabinleri",
  "Oda İçinde Oda Sistemleri",
  "Modüler Oda Sistemleri",
  "Temiz Oda ve Özel Hacim Sistemleri",
]);

addL3("ic-mekan-mobilya", "İç Mekan & Mobilya", "tekstil-hali", "Tekstil & Halı", [
  "Perdeler ve İç Mekan Stor Sistemleri",
  "Kilim ve Tekstil Zemin Örtüleri",
  "Döşemelik Kumaşlar",
  "Dekoratif Tekstil",
]);

addL3("ic-mekan-mobilya", "İç Mekan & Mobilya", "dekoratif-aksesuar", "Dekoratif Aksesuar", [
  "Aynalar",
  "Dekoratif Objeler",
  "Askılık ve Düzenleyici Aksesuarlar",
]);

/* ─── 4. Mutfak & Banyo ─── */
addL3("mutfak-banyo", "Mutfak & Banyo", "mutfak-sistemleri", "Mutfak Sistemleri", [
  "Modüler Mutfaklar",
  "Ada Mutfaklar",
  "Kitchenette ve Kompakt Mutfak",
  "Mutfak Dolapları",
  "Tezgahlar ve Çalışma Yüzeyleri",
  "Eviyeler",
  "Ankastre Cihazlar",
  "Davlumbaz ve Aspiratörler",
  "Mutfak Aksesuarları",
]);

addL3("mutfak-banyo", "Mutfak & Banyo", "banyo-vitrifiye", "Banyo & Vitrifiye", [
  "Lavabolar",
  "Klozet ve WC",
  "Pisuvar",
  "Bide",
  "Duş Tekneleri",
  "Duş Kabinleri",
  "Küvetler",
  "Banyo Mobilyaları",
  "Ayna ve Aydınlatmalı Dolaplar",
  "Drenaj ve Kanal Sistemleri",
  "Banyo Aksesuarları",
]);

addL3("mutfak-banyo", "Mutfak & Banyo", "armatur-batarya", "Armatür & Batarya", [
  "Mutfak Bataryaları",
  "Lavabo Bataryaları",
  "Duş Bataryaları ve Kolonları",
  "Ankastre Duş Sistemleri",
  "Termostatik Bataryalar",
  "Fotoselli ve Temassız Armatürler",
  "Sifon ve Gider Donanımları",
]);

addL3("mutfak-banyo", "Mutfak & Banyo", "spa-sauna", "SPA & Sauna", [
  "Sauna Sistemleri ve Kabin",
  "Buhar Odası Sistemleri",
  "Jakuzi ve Masaj Küveti",
  "SPA Aksesuarları",
]);

addL3("mutfak-banyo", "Mutfak & Banyo", "havuz", "Havuz", [
  "Havuz Sistemleri",
  "Havuz Kaplamaları",
  "Havuz Aksesuarları",
]);

/* ─── 5. Teknik Sistemler ─── */
addL3("teknik-sistemler", "Teknik Sistemler", "aydinlatma", "Aydınlatma", [
  "Sarkıt Aydınlatma",
  "Tavan ve Gömme Aydınlatma",
  "Downlight",
  "Spot ve Ray Aydınlatma",
  "Lineer Aydınlatma",
  "Duvar Aydınlatması",
  "Masa Lambaları",
  "Lambaderler",
  "Dış Mekan Aydınlatması",
  "Cephe ve Peyzaj Aydınlatması",
  "Aydınlatma Aksesuarları",
]);

addL3("teknik-sistemler", "Teknik Sistemler", "elektrik-akilli-sistemler", "Elektrik & Akıllı Sistemler", [
  "Anahtar ve Prizler",
  "Akıllı Ev ve Bina Otomasyon Sistemleri",
  "Aydınlatma Kontrol Sistemleri",
  "Sensörler",
  "İnterkom ve Görüntülü Diafon",
  "Enerji İzleme Sistemleri",
  "Kablo Kanalları ve Elektrik Altyapısı",
]);

addL3("teknik-sistemler", "Teknik Sistemler", "iklimlendirme", "İklimlendirme", [
  "Radyatörler",
  "Yerden Isıtma Sistemleri",
  "Klima Sistemleri",
  "Fan Coil Sistemleri",
  "Havalandırma Menfezleri ve Lineer Difüzörler",
  "Hava Kanalları",
  "Isı Pompaları",
]);

addL3("teknik-sistemler", "Teknik Sistemler", "yangin-guvenlik", "Yangın & Güvenlik", [
  "Yangın Algılama Sistemleri",
  "Yangın Söndürme Sistemleri",
  "Acil Yönlendirme ve Durum Aydınlatması",
  "Güvenlik Kameraları",
  "Alarm Sistemleri",
  "Erişim Kontrol Sistemleri",
]);

addL3("teknik-sistemler", "Teknik Sistemler", "tesisat-drenaj", "Tesisat & Drenaj", [
  "Drenaj Kanalları ve Lineer Drenaj",
  "Yer Süzgeçleri",
  "Yağmur Suyu Sistemleri",
  "Rögar ve Kapaklar",
]);

/* ─── 6. Dış Mekan & Peyzaj ─── */
addL3("dis-mekan-peyzaj", "Dış Mekan & Peyzaj", "golgelendirme-sistemleri", "Gölgelendirme Sistemleri", [
  "Pergola Sistemleri",
  "Bioklimatik Pergola",
  "Tente Sistemleri",
  "Şemsiye Sistemleri",
  "Gölgelik ve Branda Sistemleri",
  "Kış Bahçesi Sistemleri",
  "Dış Mekan Kapama ve Panjur Sistemleri",
]);

addL3("dis-mekan-peyzaj", "Dış Mekan & Peyzaj", "peyzaj-bahce", "Peyzaj & Bahçe", [
  "Saksı ve Planter Sistemleri",
  "Dikey Bahçe ve Yeşil Duvar Sistemleri",
  "Bitkilendirme ve Sulama Sistemleri",
  "Ağaç Izgaraları",
  "Peyzaj Sınır Elemanları",
  "Su Öğeleri ve Çeşmeler",
  "Bahçe Aksesuarları",
]);

addL3("dis-mekan-peyzaj", "Dış Mekan & Peyzaj", "dis-mekan-mobilyasi", "Dış Mekan Mobilyası", [
  "Outdoor Lounge ve Teras Mobilyaları",
  "Bahçe Şömineleri",
  "Ateş Çukuru ve Fire Pit",
  "Bioethanol Şömineler",
  "Dış Mekan Mutfak ve Barbekü Sistemleri",
  "Dış Mekan Duşları",
  "Dış Mekan Isıtıcıları",
]);

addL3("dis-mekan-peyzaj", "Dış Mekan & Peyzaj", "kent-kamusal-donatilar", "Kent & Kamusal Donatılar", [
  "Kamusal Alan Bankları",
  "Çöp Kutuları ve Geri Dönüşüm Üniteleri",
  "Bisiklet Park Elemanları",
  "Büyük Planter ve Yeşil Altyapı",
  "Araç ve Güvenlik Bariyerleri",
  "Otopark Yönlendirme Sistemleri",
  "Durak ve Bekleme Yapıları",
  "Aydınlatmalı Totem ve Kent Işıklandırma Elemanları",
  "Kamusal Alan Donatıları",
]);

function buildFromRows() {
  const l1Map = new Map();
  for (const [l1s, l1n, l2s, l2n, l3s, l3n] of ROWS) {
    if (!l1Map.has(l1s)) {
      l1Map.set(l1s, { name_tr: l1n, slug: l1s, l2Map: new Map() });
    }
    const l1 = l1Map.get(l1s);
    if (!l1.l2Map.has(l2s)) {
      l1.l2Map.set(l2s, { name_tr: l2n, slug: l2s, l3: [] });
    }
    l1.l2Map.get(l2s).l3.push({ name_tr: l3n, slug: l3s });
  }
  return [...l1Map.values()].map((l1) => ({
    name_tr: l1.name_tr,
    slug: l1.slug,
    children: [...l1.l2Map.values()].map((l2) => ({
      name_tr: l2.name_tr,
      slug: l2.slug,
      children: l2.l3,
    })),
  }));
}

export const HEADER_TAXONOMY = buildFromRows();

export function taxonomyStats() {
  const l1 = HEADER_TAXONOMY.length;
  let l2 = 0;
  let l3 = 0;
  for (const a of HEADER_TAXONOMY) {
    l2 += a.children?.length || 0;
    for (const b of a.children || []) {
      l3 += b.children?.length || 0;
    }
  }
  return { l1, l2, l3 };
}
