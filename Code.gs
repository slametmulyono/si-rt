/**
 * SiRT 25 — Sistem Informasi RT 25 / RW 05
 * Desa Gamping, Kec. Krian, Kab. Sidoarjo — Perum The Quality Garden Residence
 *
 * Backend Google Apps Script. Semua request dari browser lewat satu pintu:
 *   google.script.run.api(token, action, payloadJson)  → string JSON
 * Hak akses dicek di server pada SETIAP request (tidak percaya data dari browser).
 *
 * Cara pasang: lihat README.md (jalankan setup() sekali dari editor).
 */

var TZ = 'Asia/Jakarta';

/* ============================================================
 *  PERAN & HAK AKSES
 * ============================================================ */
var R = { SA: 'superadmin', KT: 'ketua', SK: 'sekretaris', BD: 'bendahara', KG: 'koordinator', WG: 'warga' };
var ROLE_LABEL = {
  superadmin: 'Super Admin', ketua: 'Ketua RT', sekretaris: 'Sekretaris',
  bendahara: 'Bendahara', koordinator: 'Koordinator Blok', warga: 'Warga'
};
var ALL = [R.SA, R.KT, R.SK, R.BD, R.KG, R.WG];
var PENGURUS = [R.SA, R.KT, R.SK, R.BD, R.KG];
var PEMANTAU_LOG = [R.SA];                          // hanya Super Admin yang boleh membuka Log Aktivitas
var ADMIN_LAYANAN = [R.SA, R.KT, R.SK];       // surat, laporan, aset, pengumuman
var ADMIN_KAS = [R.SA, R.KT, R.BD];             // Ketua RT dapat menggantikan Bendahara
var ADMIN_IPL = [R.SA, R.KT, R.BD, R.KG];           // koordinator: hanya gang sendiri
var ADMIN_WARGA = [R.SA, R.KT, R.SK];         // kelola akun warga
var MOD_FORUM = [R.SA, R.KT];
var PENYETUJU_PINJAM = [R.SA, R.KT];
var UNDUH_LAPORAN = [R.SA, R.KT, R.SK, R.BD];   // unduh rekap IPL & laporan kas         // persetujuan & pengembalian pinjam aset

var KEPERLUAN_SURAT = [
  'Mencari Pekerjaan',
  'Bepergian',
  'Adat istiadat berkelakuan baik',
  'Bersih diri tidak terlibat G 30/S PKI',
  'Kartu Tanda Penduduk ( KTP )',
  'Kartu Susunan Keluarga ( KSK )',
  'Domisili Tinggal',
  'Kelahiran',
  'Pindah Tempat dan seterusnya',
  'Pindah tempat untuk kawin',
  'Menjual barang / Rojo Koyo',
  'Untuk berobat ke RUMAH SAKIT / PUSKESMAS',
  'Melaksanakan Hajatan',
  'Kejadian / Kehilangan / Pendatang baru'
];

/* ============================================================
 *  SKEMA DATABASE (1 Spreadsheet, 1 tab per tabel)
 * ============================================================ */
var SCHEMA = {
  PENGATURAN: ['kunci', 'nilai'],
  USERS: ['id', 'nama', 'no_hp', 'pin_hash', 'salt', 'role', 'gang', 'no_rumah', 'nik', 'jk', 'tempat_lahir',
    'tgl_lahir', 'kebangsaan', 'status_kawin', 'pekerjaan', 'status', 'dibuat', 'no_kk', 'ttd'],
  IPL: ['id', 'user_id', 'periode', 'nominal', 'tgl_bayar', 'dicatat_oleh', 'catatan', 'no_kk', 'kuitansi', 'metode', 'petugas_id'],
  KK: ['id', 'no_kk', 'kepala', 'no_rumah', 'gang', 'alamat', 'status_tinggal', 'dibuat', 'diperbarui'],
  ANGGOTA: ['id', 'kk_id', 'nik', 'nama', 'hubungan', 'jk', 'tempat_lahir', 'tgl_lahir', 'agama', 'pendidikan', 'pekerjaan',
    'gol_darah', 'status_kawin', 'kewarganegaraan', 'nama_ayah', 'nama_ibu', 'user_id', 'dibuat'],
  KAS: ['id', 'tanggal', 'jenis', 'kategori', 'nominal', 'keterangan', 'ref', 'dicatat_oleh'],
  ASET: ['id', 'nama', 'jumlah', 'kondisi', 'lokasi', 'keterangan', 'kode', 'kategori', 'tgl_perolehan', 'sumber', 'nilai', 'pj', 'foto'],
  PINJAM: ['id', 'aset_id', 'user_id', 'jumlah', 'tgl_pinjam', 'tgl_kembali', 'keperluan', 'status', 'catatan',
    'diproses_oleh', 'dibuat'],
  PENGUMUMAN: ['id', 'tanggal', 'judul', 'isi', 'publik', 'penting', 'penulis'],
  SURAT: ['id', 'no_surat', 'user_id', 'nama', 'jk', 'tempat_lahir', 'tgl_lahir', 'nik', 'kebangsaan',
    'status_kawin', 'keperluan', 'keterangan', 'status', 'catatan', 'dibuat', 'diproses_oleh', 'tgl_terbit'],
  LAPORAN: ['id', 'user_id', 'kategori', 'judul', 'isi', 'lokasi', 'status', 'tanggapan', 'penanggap', 'dibuat',
    'diperbarui'],
  VOTE_SESI: ['id', 'judul', 'keterangan', 'status', 'dibuat'],
  VOTE_KANDIDAT: ['id', 'sesi_id', 'no_urut', 'nama', 'visi_misi', 'foto'],
  VOTE_PEMILIH: ['id', 'sesi_id', 'no_rumah', 'waktu'],
  VOTE_HASIL: ['id', 'sesi_id', 'kandidat_id', 'jumlah'],
  IURAN: ['id', 'nama', 'nominal', 'sifat', 'tanggal', 'keterangan', 'status', 'dibuat', 'dibuat_oleh'],
  IURAN_BAYAR: ['id', 'iuran_id', 'unit', 'nominal', 'tgl_bayar', 'metode', 'kuitansi', 'petugas_id', 'dicatat_oleh', 'catatan'],
  DISKUSI: ['id', 'user_id', 'judul', 'isi', 'dibuat', 'aktivitas', 'jumlah_balasan'],
  BALASAN: ['id', 'topik_id', 'user_id', 'isi', 'dibuat'],
  IZIN_SURAT: ['id', 'user_id', 'alasan', 'diberikan_oleh', 'dibuat', 'berlaku_sampai', 'surat_id', 'status'],
  LOG: ['id', 'waktu', 'user_id', 'nama', 'role', 'aksi', 'keterangan', 'hasil', 'detail']
};

var DEFAULT_SETTING = {
  NAMA_APP: 'SiRT 25',
  RT: '25',
  RW: '05',
  SEBUTAN_DESA: 'Desa',
  DESA: 'Gamping',
  KECAMATAN: 'Krian',
  SEBUTAN_KAB: 'Kabupaten',
  KABUPATEN: 'Sidoarjo',
  LOGO: '',
  LOGO_PERUMAHAN: '',
  PERUMAHAN: 'Perumahan The Quality Garden Residence',
  TEMPAT_SURAT: 'Gamping',
  NAMA_KETUA_RT: '',
  NAMA_KETUA_RW: '',
  NOMINAL_IPL: '50000',
  DAFTAR_GANG: 'Blok A,Blok B,Blok C,Blok D',
  KONTAK_DARURAT: 'Panggilan Darurat|112\nPolisi|110\nPemadam Kebakaran|113\nAmbulans|118',
  IZINKAN_DAFTAR: 'ya',
  UKURAN_KERTAS: 'F4',
  SYARAT_IPL_SURAT: 'ya',
  IPL_MULAI: ''
};

/* ============================================================
 *  WEB APP ENTRY
 * ============================================================ */
function doGet() {
  try { migrasiBlok_(); } catch (e) { }
  var out = HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('SiRT 25 — RT 25 / RW 05')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, viewport-fit=cover')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  // Bila dipasang ke layar utama HP ("Tambahkan ke Layar Utama"), aplikasi terbuka tanpa bilah browser
  try { out.addMetaTag('mobile-web-app-capable', 'yes'); } catch (e) { }
  try { out.addMetaTag('apple-mobile-web-app-capable', 'yes'); } catch (e) { }
  // Ikon tab: logo Sidoarjo bawaan (hanya bila logo belum diganti di Pengaturan)
  try { if (!cfg_().LOGO) out.setFaviconUrl('https://lh3.googleusercontent.com/d/1y_-xid4KRS1GSFHBnPeW9Pt19g5Vgjt3=s64#.png'); } catch (e) { }
  return out;
}

/** Satu pintu RPC. Selalu mengembalikan string JSON {ok, data} / {ok:false, error}. */
function api(token, action, payloadJson) {
  var route = ROUTES[action];
  if (!route) return JSON.stringify({ ok: false, error: 'Aksi tidak dikenal: ' + action });
  var lock = null;
  try {
    var p = {};
    if (payloadJson) p = typeof payloadJson === 'string' ? JSON.parse(payloadJson) : payloadJson;
    var user = null;
    if (!route.publik) {
      user = sessionUser_(token);
      if (!user) return JSON.stringify({ ok: false, error: 'Sesi berakhir. Silakan login kembali.', relogin: true });
      if (route.roles.indexOf(user.role) < 0) throw new Error('Anda tidak memiliki akses untuk fitur ini.');
    }
    if (route.tulis) {
      lock = LockService.getScriptLock();
      lock.waitLock(20000);
    }
    var data = route.fn(p, user, token);
    if (route.tulis) SpreadsheetApp.flush();
    catatLog_(action, route, p, user, data, '');
    return JSON.stringify({ ok: true, data: data === undefined ? null : data });
  } catch (err) {
    var pesan = String(err && err.message ? err.message : err);
    catatLog_(action, route, p, user, null, pesan);
    return JSON.stringify({ ok: false, error: pesan });
  } finally {
    if (lock) try { lock.releaseLock(); } catch (e) { }
  }
}

function rt_(fn, roles, tulis) { return { fn: fn, roles: roles || ALL, tulis: !!tulis }; }
function pub_(fn, tulis) { return { fn: fn, publik: true, tulis: !!tulis }; }

var ROUTES = {
  // Publik (tanpa login)
  'publik.beranda': pub_(publik_beranda),
  'auth.login': pub_(auth_login),
  'auth.daftar': pub_(auth_daftar, true),

  // Sesi & profil
  'auth.me': rt_(auth_me),
  'auth.logout': rt_(auth_logout),
  'auth.gantiPin': rt_(auth_gantiPin, ALL, true),
  'profil.simpan': rt_(profil_simpan, ALL, true),
  'dashboard': rt_(dashboard_get),

  // IPL & Kas
  'ipl.saya': rt_(ipl_saya),
  'ipl.rekap': rt_(ipl_rekap),
  'ipl.matrix': rt_(ipl_matrix, PENGURUS),
  'ipl.bayar': rt_(ipl_bayar, ADMIN_IPL, true),
  'ipl.hapus': rt_(ipl_hapus, ADMIN_KAS, true),
  'ipl.kuitansi': rt_(ipl_kuitansi),
  'ipl.kuitansiPdf': rt_(ipl_kuitansiPdf),
  'iuran.list': rt_(iuran_list),
  'iuran.simpan': rt_(iuran_simpan, ADMIN_KAS, true),
  'iuran.hapus': rt_(iuran_hapus, ADMIN_KAS, true),
  'iuran.detail': rt_(iuran_detail, PENGURUS),
  'iuran.bayar': rt_(iuran_bayar, ADMIN_IPL, true),
  'iuran.batal': rt_(iuran_batal, ADMIN_KAS, true),
  'iuran.kuitansi': rt_(iuran_kuitansi),
  'profil.ttd': rt_(profil_ttd, ALL, true),
  'kas.list': rt_(kas_list),
  'kas.grafik': rt_(kas_grafik),
  'laporan.ipl': rt_(laporan_ipl, UNDUH_LAPORAN),
  'laporan.kas': rt_(laporan_kas, UNDUH_LAPORAN),
  'kas.simpan': rt_(kas_simpan, ADMIN_KAS, true),
  'kas.hapus': rt_(kas_hapus, ADMIN_KAS, true),

  // Aset & peminjaman
  'aset.list': rt_(aset_list),
  'aset.simpan': rt_(aset_simpan, ADMIN_LAYANAN, true),
  'aset.hapus': rt_(aset_hapus, ADMIN_LAYANAN, true),
  'aset.detail': rt_(aset_detail),
  'pinjam.list': rt_(pinjam_list),
  'pinjam.ajukan': rt_(pinjam_ajukan, ALL, true),
  'pinjam.proses': rt_(pinjam_proses, PENYETUJU_PINJAM, true),
  'aset.cek': rt_(aset_cek),
  'pinjam.batal': rt_(pinjam_batal, ALL, true),

  // Pengumuman
  'info.list': rt_(info_list),
  'info.simpan': rt_(info_simpan, ADMIN_LAYANAN, true),
  'info.hapus': rt_(info_hapus, ADMIN_LAYANAN, true),

  // Surat pengantar
  'surat.opsi': rt_(surat_opsi),
  'surat.list': rt_(surat_list),
  'surat.ajukan': rt_(surat_ajukan, ALL, true),
  'surat.batal': rt_(surat_batal, ALL, true),
  'surat.proses': rt_(surat_proses, ADMIN_LAYANAN, true),
  'surat.dokumen': rt_(surat_dokumen),

  // Laporan warga
  'lapor.list': rt_(lapor_list),
  'lapor.buat': rt_(lapor_buat, ALL, true),
  'lapor.tanggapi': rt_(lapor_tanggapi, ADMIN_LAYANAN, true),

  // e-Vote
  'vote.list': rt_(vote_list),
  'vote.pilih': rt_(vote_pilih, ALL, true),
  'vote.sesiSimpan': rt_(vote_sesiSimpan, [R.SA], true),
  'vote.sesiHapus': rt_(vote_sesiHapus, [R.SA], true),
  'vote.kandidatSimpan': rt_(vote_kandidatSimpan, [R.SA], true),
  'vote.kandidatHapus': rt_(vote_kandidatHapus, [R.SA], true),

  // Diskusi
  'forum.list': rt_(forum_list),
  'forum.detail': rt_(forum_detail),
  'forum.buat': rt_(forum_buat, ALL, true),
  'forum.balas': rt_(forum_balas, ALL, true),
  'forum.hapus': rt_(forum_hapus, ALL, true),

  // Akun & pengaturan
  'users.list': rt_(users_list, PENGURUS),
  'kk.saya': rt_(kk_saya),
  'kk.list': rt_(kk_list, PENGURUS),
  'kk.detail': rt_(kk_detail),
  'kk.simpan': rt_(kk_simpan, ALL, true),
  'kk.hapus': rt_(kk_hapus, ADMIN_WARGA, true),
  'kk.import': rt_(kk_import, ADMIN_WARGA, true),
  'anggota.simpan': rt_(anggota_simpan, ALL, true),
  'anggota.hapus': rt_(anggota_hapus, ALL, true),
  'izin.info': rt_(izin_info, [R.SA, R.KT]),
  'izin.buka': rt_(izin_buka, [R.SA, R.KT], true),
  'izin.cabut': rt_(izin_cabut, [R.SA, R.KT], true),
  'users.simpan': rt_(users_simpan, ADMIN_WARGA, true),
  'users.import': rt_(users_import, ADMIN_WARGA, true),
  'users.resetPin': rt_(users_resetPin, ADMIN_WARGA, true),
  'users.hapus': rt_(users_hapus, [R.SA], true),
  'setting.get': rt_(setting_get, [R.SA]),
  'setting.simpan': rt_(setting_simpan, [R.SA], true),
  'log.list': rt_(log_list, PEMANTAU_LOG)
};

/* ============================================================
 *  SETUP DATABASE — jalankan sekali dari editor Apps Script
 * ============================================================ */
function setup() {
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty('SPREADSHEET_ID');
  var ss;
  if (id) {
    ss = SpreadsheetApp.openById(id);
  } else {
    ss = SpreadsheetApp.create('SiRT 25 RW 05 — Database');
    props.setProperty('SPREADSHEET_ID', ss.getId());
  }
  Object.keys(SCHEMA).forEach(function (name) {
    var sh = ss.getSheetByName(name);
    if (!sh) sh = ss.insertSheet(name);
    var head = SCHEMA[name];
    sh.getRange(1, 1, 1, head.length).setValues([head]).setFontWeight('bold').setBackground('#065f46').setFontColor('#ffffff');
    sh.setFrozenRows(1);
    sh.getRange(1, 1, sh.getMaxRows(), head.length).setNumberFormat('@');
  });
  var def = ss.getSheetByName('Sheet1') || ss.getSheetByName('Sheet 1');
  if (def && ss.getSheets().length > 1) ss.deleteSheet(def);
  _cache = {};

  var cfg = settingsRaw_();
  Object.keys(DEFAULT_SETTING).forEach(function (k) {
    if (cfg[k] === undefined) insert_('PENGATURAN', { kunci: k, nilai: DEFAULT_SETTING[k] });
  });

  var admin = rows_('USERS').filter(function (u) { return u.role === R.SA; })[0];
  if (!admin) {
    var salt = uid_('s');
    insert_('USERS', {
      id: uid_('U'), nama: 'Super Admin', no_hp: 'admin', pin_hash: hash_(salt, '123456'), salt: salt,
      role: R.SA, gang: '', no_rumah: '', status: 'aktif', dibuat: now_()
    });
    Logger.log('Akun awal dibuat → No. HP / username: admin   PIN: 123456  (SEGERA ganti PIN setelah login)');
  }
  Logger.log('Database siap: ' + ss.getUrl());
  return ss.getUrl();
}

/**
 * Uji ukuran kertas PDF yang benar-benar dihasilkan Google (jalankan dari editor, lihat Execution log).
 * F4 = 609.4 x 935.4 pt, A4 = 595.3 x 841.9 pt, Letter = 612 x 792 pt.
 */
function cekUkuranPdf() {
  var cfg = cfg_();
  var s = rows_('SURAT').filter(function (x) { return x.status === 'disetujui'; })[0] || rows_('SURAT')[0] ||
    { nama: 'Contoh Warga', nik: '3515000000000001', jk: 'Laki-laki', tempat_lahir: 'Sidoarjo', tgl_lahir: '1990-01-01', kebangsaan: 'Indonesia',
      status_kawin: 'Kawin', keperluan: 'Domisili Tinggal', keterangan: 'Uji ukuran kertas', status: 'disetujui', no_surat: '000/UJI', dibuat: now_() };
  var pdf = Utilities.newBlob(suratHtml_(s, cfg), 'text/html', 'uji.html').getAs('application/pdf');
  var teks = Utilities.newBlob(pdf.getBytes()).getDataAsString('ISO-8859-1');
  var kotak = teks.match(/\/MediaBox\s*\[[^\]]*\]/g) || [];
  Logger.log('Pengaturan UKURAN_KERTAS = ' + (cfg.UKURAN_KERTAS || 'F4') + ' | jumlah halaman = ' + kotak.length + ' | MediaBox: ' + kotak.join(' ; '));
  return kotak;
}

/** Uji ukuran PDF kuitansi (A6 = 297.6 x 419.5 pt). Jalankan dari editor, lihat Execution log. */
function cekKuitansiPdf() {
  var html = '<!DOCTYPE html><html><head><meta charset="utf-8"><style>@page{size:105mm 148mm;margin:0}html,body{margin:0;padding:0}img{display:block;width:105mm;height:148mm}</style></head>' +
    '<body><img src="data:image/jpeg;base64,' + LOGO_SIDOARJO_B64 + '"></body></html>';
  var pdf = Utilities.newBlob(html, 'text/html', 'uji.html').getAs('application/pdf');
  var kotak = Utilities.newBlob(pdf.getBytes()).getDataAsString('ISO-8859-1').match(/\/MediaBox\s*\[[^\]]*\]/g) || [];
  Logger.log('Kuitansi A6 | jumlah halaman = ' + kotak.length + ' | ' + kotak.join(' ; '));
}

/** Opsional: isi contoh data untuk uji coba. */
function isiDataContoh() {
  setup();
  var pin = '111111';
  var contoh = [
    ['Budi Santoso', '081200000001', R.KT, 'Blok A', 'A-01'],
    ['Siti Aminah', '081200000002', R.SK, 'Blok A', 'A-05'],
    ['Agus Prasetyo', '081200000003', R.BD, 'Blok B', 'B-03'],
    ['Joko Widodo', '081200000004', R.KG, 'Blok B', 'B-07'],
    ['Rina Kusuma', '081200000005', R.WG, 'Blok B', 'B-10'],
    ['Dewi Lestari', '081200000006', R.WG, 'Blok C', 'C-02']
  ];
  contoh.forEach(function (c) {
    if (findBy_('USERS', 'no_hp', c[1])) return;
    var salt = uid_('s');
    insert_('USERS', {
      id: uid_('U'), nama: c[0], no_hp: c[1], pin_hash: hash_(salt, pin), salt: salt, role: c[2], gang: c[3],
      no_rumah: c[4], kebangsaan: 'Indonesia', status: 'aktif', dibuat: now_()
    });
  });
  insert_('PENGUMUMAN', {
    id: uid_('P'), tanggal: now_(), judul: 'Kerja bakti bersih lingkungan',
    isi: 'Minggu pagi pukul 06.30 seluruh warga diharapkan hadir membawa peralatan kebersihan.', publik: 'ya',
    penting: 'ya', penulis: 'Sekretaris'
  });
  insert_('ASET', { id: uid_('A'), nama: 'Tenda 4x6 m', jumlah: 2, kondisi: 'Baik', lokasi: 'Gudang RT', keterangan: '' });
  insert_('ASET', { id: uid_('A'), nama: 'Kursi lipat', jumlah: 50, kondisi: 'Baik', lokasi: 'Gudang RT', keterangan: '' });
  Logger.log('Data contoh dibuat. PIN semua akun contoh: ' + pin);
}

/* ============================================================
 *  LAPISAN DATABASE (Google Sheets)
 * ============================================================ */
var _ss = null;
var _cache = {};

function ss_() {
  if (_ss) return _ss;
  var id = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  if (!id) throw new Error('Database belum disiapkan. Jalankan fungsi setup() dari editor Apps Script.');
  _ss = SpreadsheetApp.openById(id);
  return _ss;
}

function sheet_(name) {
  var sh = ss_().getSheetByName(name);
  if (!sh && SCHEMA[name]) {
    // Tab baru (fitur versi baru) dibuat otomatis tanpa perlu menjalankan setup() lagi.
    try { sh = ss_().insertSheet(name); }
    catch (e) { return ss_().getSheetByName(name); } // dibuat bersamaan oleh request lain
    var head = SCHEMA[name];
    sh.getRange(1, 1, 1, head.length).setValues([head]).setFontWeight('bold').setBackground('#065f46').setFontColor('#ffffff');
    sh.setFrozenRows(1);
    sh.getRange(1, 1, sh.getMaxRows(), head.length).setNumberFormat('@');
  }
  if (!sh) throw new Error('Tab "' + name + '" tidak ditemukan. Jalankan setup() lagi.');
  if (!_headOk[name] && SCHEMA[name]) {
    // Kolom baru (fitur versi baru) ditambahkan otomatis di ujung kanan tab.
    var head2 = SCHEMA[name];
    var ada = sh.getLastColumn();
    if (ada < head2.length) {
      sh.getRange(1, ada + 1, 1, head2.length - ada).setValues([head2.slice(ada)])
        .setFontWeight('bold').setBackground('#065f46').setFontColor('#ffffff');
      sh.getRange(1, ada + 1, sh.getMaxRows(), head2.length - ada).setNumberFormat('@');
    }
    _headOk[name] = true;
  }
  return sh;
}
var _headOk = {};

function cell_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, TZ, 'yyyy-MM-dd HH:mm:ss');
  return v;
}

/** Semua baris tabel sebagai array objek (dicache per eksekusi). */
function rows_(name) {
  if (_cache[name]) return _cache[name];
  var sh = sheet_(name);
  var vals = sh.getDataRange().getValues();
  var head = SCHEMA[name];
  var out = [];
  for (var i = 1; i < vals.length; i++) {
    var r = vals[i];
    if (r.join('') === '') continue;
    var o = { _row: i + 1 };
    for (var j = 0; j < head.length; j++) o[head[j]] = cell_(r[j] === undefined ? '' : r[j]);
    out.push(o);
  }
  _cache[name] = out;
  return out;
}

/** String disimpan dengan awalan ' agar Sheets tidak mengubahnya jadi tanggal/angka (No HP, NIK, periode). */
function store_(v) {
  if (v === null || v === undefined) return '';
  if (typeof v === 'number' || typeof v === 'boolean') return v;
  v = String(v);
  return v === '' ? '' : "'" + v;
}

/** Tambah banyak baris sekaligus (satu kali tulis, untuk impor massal). */
function insertMany_(name, objs) {
  if (!objs.length) return;
  var head = SCHEMA[name];
  var sh = sheet_(name);
  sh.getRange(sh.getLastRow() + 1, 1, objs.length, head.length)
    .setValues(objs.map(function (o) { return head.map(function (h) { return store_(o[h]); }); }));
  delete _cache[name];
}

function insert_(name, obj) {
  var head = SCHEMA[name];
  sheet_(name).appendRow(head.map(function (h) { return store_(obj[h]); }));
  delete _cache[name];
  return obj;
}

function findBy_(name, key, val) {
  val = String(val);
  var all = rows_(name);
  for (var i = 0; i < all.length; i++) if (String(all[i][key]) === val) return all[i];
  return null;
}

function get_(name, id) { return findBy_(name, 'id', id); }

function update_(name, id, patch) {
  var row = get_(name, id);
  if (!row) throw new Error('Data tidak ditemukan.');
  var head = SCHEMA[name];
  var merged = head.map(function (h) { return store_(patch.hasOwnProperty(h) ? patch[h] : row[h]); });
  sheet_(name).getRange(row._row, 1, 1, head.length).setValues([merged]);
  delete _cache[name];
  return get_(name, id);
}

function remove_(name, id) {
  var row = get_(name, id);
  if (!row) return false;
  sheet_(name).deleteRow(row._row);
  delete _cache[name];
  return true;
}

/* ============================================================
 *  UTILITAS
 * ============================================================ */
function now_() { return Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd HH:mm:ss'); }
function today_() { return Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd'); }
var _seq = 0;
function uid_(prefix) {
  _seq = (_seq + 1) % 1296;
  return (prefix || '') + Date.now().toString(36).toUpperCase() + ('0' + _seq.toString(36)).slice(-2).toUpperCase() +
    Math.floor(Math.random() * 46656).toString(36).toUpperCase();
}
function hash_(salt, pin) {
  var raw = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, salt + '|' + pin, Utilities.Charset.UTF_8);
  return raw.map(function (b) { return ('0' + (b & 255).toString(16)).slice(-2); }).join('');
}
function str_(v, max) { v = v === null || v === undefined ? '' : String(v).trim(); return max ? v.slice(0, max) : v; }
function need_(v, label) { if (!str_(v)) throw new Error(label + ' wajib diisi.'); return str_(v); }
function num_(v) { var n = Number(String(v).replace(/[^0-9.\-]/g, '')); return isNaN(n) ? 0 : n; }
function normHp_(v) { return str_(v).replace(/[^0-9a-zA-Z]/g, '').toLowerCase(); }
function normRumah_(v) { return str_(v).toUpperCase().replace(/\s+/g, ''); }
function esc_(s) {
  return String(s === null || s === undefined ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function isRole_(u, roles) { return roles.indexOf(u.role) >= 0; }
function userMap_() {
  var m = {};
  rows_('USERS').forEach(function (u) { m[u.id] = u; });
  return m;
}
function namaUser_(map, id) { return map[id] ? map[id].nama : '(akun dihapus)'; }

var BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober',
  'November', 'Desember'];
var ROMAWI = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];

function tglIndo_(ymd) {
  var m = String(ymd || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return str_(ymd);
  return Number(m[3]) + ' ' + BULAN[Number(m[2]) - 1] + ' ' + m[1];
}
function umur_(tglLahir, padaTgl) {
  var a = String(tglLahir || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  var b = String(padaTgl || today_()).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!a || !b) return '';
  var u = Number(b[1]) - Number(a[1]);
  if (Number(b[2]) < Number(a[2]) || (b[2] === a[2] && Number(b[3]) < Number(a[3]))) u--;
  return u >= 0 ? u : '';
}

function settingsRaw_() {
  var o = {};
  rows_('PENGATURAN').forEach(function (r) { o[r.kunci] = String(r.nilai); });
  return o;
}
function cfg_() {
  var raw = settingsRaw_();
  var o = {};
  Object.keys(DEFAULT_SETTING).forEach(function (k) { o[k] = raw[k] !== undefined ? raw[k] : DEFAULT_SETTING[k]; });
  return o;
}
function gangList_(cfg) {
  return String(cfg.DAFTAR_GANG || '').split(',').map(function (g) { return g.trim(); }).filter(String);
}

/* ============================================================
 *  SESI & AUTENTIKASI
 *  Token acak 64 hex, disimpan di CacheService (cepat) + ScriptProperties (bertahan 14 hari).
 * ============================================================ */
var SESI_MS = 14 * 86400000;

function sessionUser_(token) {
  if (!token || !/^[a-f0-9]{64}$/.test(String(token))) return null;
  var key = 'S_' + token;
  var cache = CacheService.getScriptCache();
  var raw = cache.get(key);
  if (!raw) {
    raw = PropertiesService.getScriptProperties().getProperty(key);
    if (!raw) return null;
    cache.put(key, raw, 21600);
  }
  var s = JSON.parse(raw);
  if (s.exp < Date.now()) { endSession_(token); return null; }
  var u = get_('USERS', s.uid);
  if (!u || u.status !== 'aktif') return null;
  return u;
}

function startSession_(u) {
  var token = (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, '').toLowerCase();
  var raw = JSON.stringify({ uid: u.id, exp: Date.now() + SESI_MS });
  CacheService.getScriptCache().put('S_' + token, raw, 21600);
  var props = PropertiesService.getScriptProperties();
  props.setProperty('S_' + token, raw);
  if (Math.random() < 0.1) bersihkanSesi_(props);
  return token;
}

function endSession_(token) {
  CacheService.getScriptCache().remove('S_' + token);
  PropertiesService.getScriptProperties().deleteProperty('S_' + token);
}

function bersihkanSesi_(props) {
  var all = props.getProperties();
  Object.keys(all).forEach(function (k) {
    if (k.indexOf('S_') !== 0) return;
    try { if (JSON.parse(all[k]).exp < Date.now()) props.deleteProperty(k); } catch (e) { props.deleteProperty(k); }
  });
}

/** Data user yang aman dikirim ke browser (tanpa hash PIN). */
function safeUser_(u) {
  return {
    id: u.id, nama: u.nama, no_hp: u.no_hp, role: u.role, role_label: ROLE_LABEL[u.role] || u.role, gang: u.gang,
    no_rumah: u.no_rumah, nik: u.nik, jk: u.jk, tempat_lahir: u.tempat_lahir, tgl_lahir: u.tgl_lahir,
    kebangsaan: u.kebangsaan, status_kawin: u.status_kawin, pekerjaan: u.pekerjaan, status: u.status, no_kk: u.no_kk || '', ttd: u.ttd || ''
  };
}

function auth_login(p) {
  var hp = normHp_(p.no_hp);
  var pin = str_(p.pin);
  if (!hp || !pin) throw new Error('Isi No. HP dan PIN.');
  var cache = CacheService.getScriptCache();
  var failKey = 'F_' + hp;
  var gagal = Number(cache.get(failKey) || 0);
  if (gagal >= 5) throw new Error('Terlalu banyak percobaan. Coba lagi 10 menit lagi.');
  var u = null;
  rows_('USERS').forEach(function (x) { if (normHp_(x.no_hp) === hp) u = x; });
  if (!u || hash_(u.salt, pin) !== u.pin_hash) {
    cache.put(failKey, String(gagal + 1), 600);
    throw new Error('No. HP atau PIN salah.');
  }
  if (u.status === 'menunggu') throw new Error('Akun Anda masih menunggu persetujuan pengurus RT.');
  if (u.status !== 'aktif') throw new Error('Akun Anda tidak aktif. Hubungi pengurus RT.');
  cache.remove(failKey);
  return { token: startSession_(u), user: safeUser_(u), pinDefault: pin === '123456' };
}

function auth_daftar(p) {
  var cfg = cfg_();
  if (cfg.IZINKAN_DAFTAR !== 'ya') throw new Error('Pendaftaran mandiri sedang ditutup. Hubungi pengurus RT.');
  var nama = need_(p.nama, 'Nama');
  var hp = normHp_(need_(p.no_hp, 'No. HP'));
  if (!/^0\d{8,13}$/.test(hp)) throw new Error('No. HP tidak valid (contoh: 081234567890).');
  var pin = str_(p.pin);
  if (!/^\d{6}$/.test(pin)) throw new Error('PIN harus 6 digit angka.');
  var ada = rows_('USERS').some(function (x) { return normHp_(x.no_hp) === hp; });
  if (ada) throw new Error('No. HP sudah terdaftar.');
  var gang = str_(p.gang);
  if (gangList_(cfg).indexOf(gang) < 0) throw new Error('Pilih blok.');
  var salt = uid_('s');
  insert_('USERS', {
    id: uid_('U'), nama: str_(nama, 80), no_hp: hp, pin_hash: hash_(salt, pin), salt: salt, role: R.WG, gang: gang,
    no_rumah: normRumah_(need_(p.no_rumah, 'No. rumah')), kebangsaan: 'Indonesia', status: 'menunggu', dibuat: now_()
  });
  return { pesan: 'Pendaftaran terkirim. Tunggu persetujuan pengurus RT, lalu login dengan No. HP dan PIN Anda.' };
}

function auth_me(p, u) { return { user: safeUser_(u), cfg: cfgPublik_(p) }; }
function auth_logout(p, u, token) { endSession_(token); return true; }

function auth_gantiPin(p, u) {
  if (hash_(u.salt, str_(p.lama)) !== u.pin_hash) throw new Error('PIN lama salah.');
  var baru = str_(p.baru);
  if (!/^\d{6}$/.test(baru)) throw new Error('PIN baru harus 6 digit angka.');
  if (baru === '123456') throw new Error('Gunakan PIN selain 123456.');
  var salt = uid_('s');
  update_('USERS', u.id, { salt: salt, pin_hash: hash_(salt, baru) });
  return true;
}

function profil_simpan(p, u) {
  var patch = {
    nama: str_(need_(p.nama, 'Nama'), 80), nik: str_(p.nik, 16).replace(/\D/g, ''), jk: str_(p.jk),
    tempat_lahir: str_(p.tempat_lahir, 40), tgl_lahir: str_(p.tgl_lahir, 10), kebangsaan: str_(p.kebangsaan, 30),
    status_kawin: str_(p.status_kawin), pekerjaan: str_(p.pekerjaan, 40)
  };
  if (patch.nik && patch.nik.length !== 16) throw new Error('NIK harus 16 digit.');
  var ag = findBy_('ANGGOTA', 'user_id', u.id);
  if (ag) {
    update_('ANGGOTA', ag.id, { nik: patch.nik || ag.nik, jk: patch.jk || ag.jk, tempat_lahir: patch.tempat_lahir, tgl_lahir: patch.tgl_lahir,
      kewarganegaraan: patch.kebangsaan || ag.kewarganegaraan, status_kawin: patch.status_kawin || ag.status_kawin, pekerjaan: patch.pekerjaan });
  }
  return safeUser_(update_('USERS', u.id, patch));
}

/* ============================================================
 *  PUBLIK & DASHBOARD
 * ============================================================ */
function cfgPublik_(p) {
  var c = cfg_();
  // Logo (±50 KB) cukup dikirim sekali; HP menyimpannya dan cukup mengirim kuncinya di kunjungan berikutnya
  var logo = logoSrc_(c), kunci = logo.length + '-' + logo.slice(-24);
  var pakaiCache = !!(p && p.logoKey === kunci);
  return {
    LOGO_KEY: kunci, LOGO_CACHE: pakaiCache,
    NAMA_APP: c.NAMA_APP, RT: c.RT, RW: c.RW, DESA: c.DESA, KECAMATAN: c.KECAMATAN, KABUPATEN: c.KABUPATEN,
    SEBUTAN_DESA: c.SEBUTAN_DESA || 'Desa', SEBUTAN_KAB: c.SEBUTAN_KAB || 'Kabupaten', LOGO_KUSTOM: !!c.LOGO,
    UKURAN_KERTAS: c.UKURAN_KERTAS === 'A4' ? 'A4' : 'F4',
    PERUMAHAN: c.PERUMAHAN, NOMINAL_IPL: num_(c.NOMINAL_IPL), GANG: gangList_(c), IZINKAN_DAFTAR: c.IZINKAN_DAFTAR,
    KONTAK_DARURAT: String(c.KONTAK_DARURAT || '').split('\n').map(function (l) {
      var x = l.split('|'); return { nama: str_(x[0]), nomor: str_(x[1]) };
    }).filter(function (k) { return k.nama; }),
    LOGO: pakaiCache ? '' : logo
  };
}

/** Logo untuk aplikasi & kop surat: logo unggahan di Pengaturan, atau logo Kabupaten Sidoarjo bawaan. */
function logoSrc_(cfg) {
  return LOGO_RE.test(String(cfg.LOGO || '')) ? cfg.LOGO : 'data:image/jpeg;base64,' + LOGO_SIDOARJO_B64;
}
var LOGO_RE = /^data:image\/(jpeg|png);base64,[A-Za-z0-9+\/=]+$/;
/** Validasi foto (data URL JPG/PNG yang sudah diperkecil di HP, maks. ~48 ribu karakter agar muat 1 sel). */
function foto_(v) {
  v = String(v || '').trim();
  if (!v) return '';
  if (!LOGO_RE.test(v)) throw new Error('Format foto tidak valid. Gunakan JPG atau PNG.');
  if (v.length > 49000) throw new Error('Ukuran foto terlalu besar.');
  return v;
}

function ringkasKas_() {
  var bln = today_().slice(0, 7);
  var saldo = 0, masuk = 0, keluar = 0;
  rows_('KAS').forEach(function (k) {
    var n = num_(k.nominal);
    saldo += k.jenis === 'keluar' ? -n : n;
    if (String(k.tanggal).slice(0, 7) === bln) { if (k.jenis === 'keluar') keluar += n; else masuk += n; }
  });
  return { saldo: saldo, masuk: masuk, keluar: keluar, bulan: BULAN[Number(bln.slice(5)) - 1] + ' ' + bln.slice(0, 4) };
}

function publik_beranda(p) {
  var info = rows_('PENGUMUMAN').filter(function (x) { return x.publik === 'ya'; })
    .sort(function (a, b) { return String(b.tanggal).localeCompare(String(a.tanggal)); }).slice(0, 6)
    .map(function (x) { return { id: x.id, tanggal: x.tanggal, judul: x.judul, isi: x.isi, penting: x.penting }; });
  var urut = [R.KT, R.SK, R.BD, R.KG];
  var pengurus = rows_('USERS').filter(function (u) { return u.status === 'aktif' && urut.indexOf(u.role) >= 0; })
    .sort(function (a, b) { return urut.indexOf(a.role) - urut.indexOf(b.role); })
    .map(function (u) { return { nama: u.nama, jabatan: ROLE_LABEL[u.role] + (u.role === R.KG && u.gang ? ' ' + u.gang : '') }; });
  // Pemilihan yang sedang dibuka: calon beserta visi & misi boleh dilihat siapa saja (tanpa hasil suara)
  var pemilihan = rows_('VOTE_SESI').filter(function (x) { return x.status === 'buka'; })
    .sort(function (a, b) { return String(b.dibuat).localeCompare(String(a.dibuat)); })
    .map(function (x) {
      return {
        id: x.id, judul: x.judul, keterangan: x.keterangan,
        kandidat: rows_('VOTE_KANDIDAT').filter(function (k) { return k.sesi_id === x.id; })
          .sort(function (a, b) { return num_(a.no_urut) - num_(b.no_urut); })
          .map(function (k) { return { no_urut: num_(k.no_urut), nama: k.nama, visi_misi: k.visi_misi, foto: k.foto || '' }; })
      };
    });
  return { cfg: cfgPublik_(p), info: info, kas: ringkasKas_(), pengurus: pengurus, pemilihan: pemilihan };
}

function dashboard_get(p, u) {
  var tg = tunggakanIpl_(u);
  var d = {
    kas: ringkasKas_(),
    ipl: { bulanIni: tg.periode.indexOf(today_().slice(0, 7)) < 0, tunggakan: tg.periode.length, nominal: num_(cfg_().NOMINAL_IPL), suratTerkunci: !syaratSurat_(u).boleh },
    suratSaya: rows_('SURAT').filter(function (s) { return s.user_id === u.id; }).length,
    suratSiap: rows_('SURAT').filter(function (s) { return s.user_id === u.id && s.status === 'disetujui'; }).length,
    pinjamAktif: rows_('PINJAM').filter(function (x) { return x.user_id === u.id && (x.status === 'menunggu' || x.status === 'disetujui'); }).length,
    info: rows_('PENGUMUMAN').sort(function (a, b) { return String(b.tanggal).localeCompare(String(a.tanggal)); }).slice(0, 3),
    voteAktif: rows_('VOTE_SESI').filter(function (s) { return s.status === 'buka'; }).length,
    antrian: null
  };
  if (isRole_(u, PENGURUS)) {
    var gangOk = function (uid) { if (u.role !== R.KG) return true; var x = get_('USERS', uid); return x && x.gang === u.gang; };
    d.antrian = {
      surat: rows_('SURAT').filter(function (s) { return s.status === 'menunggu' && gangOk(s.user_id); }).length,
      laporan: rows_('LAPORAN').filter(function (s) { return s.status !== 'selesai' && gangOk(s.user_id); }).length,
      pinjam: rows_('PINJAM').filter(function (s) { return s.status === 'menunggu'; }).length,
      akun: rows_('USERS').filter(function (s) { return s.status === 'menunggu' && (u.role !== R.KG || s.gang === u.gang); }).length
    };
  }
  return d;
}

/* ============================================================
 *  IPL (Iuran Pengelolaan Lingkungan) & KAS
 * ============================================================ */
/*
 * IPL PER KELUARGA (KK)
 * Satu "unit tagihan" = satu No. KK. Akun yang belum terhubung ke KK dihitung sebagai unit sendiri.
 * Pembayaran lama (sebelum ada KK) tetap terbaca lewat akun pembayarnya.
 */
function unitKey_(u) { return u.no_kk ? 'KK:' + u.no_kk : 'U:' + u.id; }
function iplUnitOf_(i, um) {
  if (i.no_kk) return 'KK:' + i.no_kk;
  var w = um[i.user_id];
  return w && w.no_kk ? 'KK:' + w.no_kk : 'U:' + i.user_id;
}
var _iplUnit = null;
function iplPerUnit_() {
  if (_iplUnit && _cache.IPL) return _iplUnit;
  var um = userMap_(), m = {};
  rows_('IPL').forEach(function (i) { var k = iplUnitOf_(i, um); (m[k] = m[k] || {})[i.periode] = i; });
  _iplUnit = m;
  return m;
}
/** Semua unit tagihan IPL: setiap KK + akun aktif (bukan Super Admin) yang belum punya KK. */
function unitList_(gang) {
  var akunKk = {};
  var out = [];
  rows_('USERS').forEach(function (x) { if (x.no_kk) akunKk[x.no_kk] = (akunKk[x.no_kk] || 0) + 1; });
  var anggota = {};
  rows_('ANGGOTA').forEach(function (a) { anggota[a.kk_id] = (anggota[a.kk_id] || 0) + 1; });
  rows_('KK').forEach(function (k) {
    if (gang && k.gang !== gang) return;
    out.push({ id: 'KK:' + k.no_kk, jenis: 'kk', nama: k.kepala || ('KK ' + k.no_kk), gang: k.gang, no_rumah: k.no_rumah, anggota: anggota[k.id] || 0, akun: akunKk[k.no_kk] || 0 });
  });
  rows_('USERS').forEach(function (x) {
    if (x.status !== 'aktif' || x.role === R.SA || x.no_kk) return;
    if (gang && x.gang !== gang) return;
    out.push({ id: 'U:' + x.id, jenis: 'akun', nama: x.nama, gang: x.gang, no_rumah: x.no_rumah, anggota: 0, akun: 1 });
  });
  return out.sort(function (a, b) { return (a.gang + a.no_rumah).localeCompare(b.gang + b.no_rumah); });
}

function ipl_saya(p, u) {
  var tahun = str_(p.tahun) || today_().slice(0, 4);
  var um = userMap_(), key = unitKey_(u);
  var list = rows_('IPL').filter(function (i) { return iplUnitOf_(i, um) === key; })
    .sort(function (a, b) { return String(b.periode).localeCompare(String(a.periode)); });
  var bulan = [];
  for (var m = 1; m <= 12; m++) {
    var per = tahun + '-' + ('0' + m).slice(-2);
    var bayar = list.filter(function (i) { return i.periode === per; })[0];
    bulan.push({ periode: per, lunas: !!bayar, tgl: bayar ? bayar.tgl_bayar : '', nominal: bayar ? num_(bayar.nominal) : 0, id: bayar ? bayar.id : '', kw: bayar ? bayar.kuitansi || '' : '' });
  }
  var kk = u.no_kk ? findBy_('KK', 'no_kk', u.no_kk) : null;
  return { tahun: tahun, bulan: bulan, riwayat: list.slice(0, 24), nominal: num_(cfg_().NOMINAL_IPL), perKk: !!kk, kepala: kk ? kk.kepala : '' };
}

/** Rekap IPL per bulan tanpa nama (boleh dilihat semua warga yang login). */
function ipl_rekap(p) {
  var tahun = str_(p.tahun) || today_().slice(0, 4);
  var total = unitList_('').length;
  var per = {};
  rows_('IPL').forEach(function (i) {
    if (String(i.periode).slice(0, 4) !== tahun) return;
    var x = per[i.periode] || (per[i.periode] = { bayar: 0, nominal: 0 });
    x.bayar++; x.nominal += num_(i.nominal);
  });
  var bulan = [];
  for (var m = 1; m <= 12; m++) {
    var k = tahun + '-' + ('0' + m).slice(-2);
    var x = per[k] || { bayar: 0, nominal: 0 };
    bulan.push({ periode: k, bayar: x.bayar, belum: Math.max(total - x.bayar, 0), nominal: x.nominal });
  }
  return { tahun: tahun, totalKK: total, bulan: bulan };
}

/** Matriks warga × bulan untuk pengurus (koordinator: gang sendiri saja). */
function ipl_matrix(p, u) {
  var tahun = str_(p.tahun) || today_().slice(0, 4);
  var gang = u.role === R.KG ? u.gang : str_(p.gang);
  var per = iplPerUnit_();
  return {
    tahun: tahun, gang: gang, gangList: gangList_(cfg_()), nominal: num_(cfg_().NOMINAL_IPL),
    mulai: /^\d{4}-\d{2}$/.test(str_(cfg_().IPL_MULAI)) ? str_(cfg_().IPL_MULAI) : today_().slice(0, 4) + '-01',
    warga: unitList_(gang).map(function (w) {
      var b = {};
      Object.keys(per[w.id] || {}).forEach(function (k) {
        if (!p.semuaTahun && k.slice(0, 4) !== tahun) return;
        var i = per[w.id][k];
        b[k] = { id: i.id, nominal: num_(i.nominal), tgl: i.tgl_bayar, kw: i.kuitansi || '' };
      });
      w.bayar = b;
      return w;
    })
  };
}

function ipl_bayar(p, u) {
  var key = str_(p.user_id), w, rec;
  if (key.indexOf('KK:') === 0) {
    var kk = findBy_('KK', 'no_kk', key.slice(3));
    if (!kk) throw new Error('Data KK tidak ditemukan.');
    w = { nama: 'KK ' + (kk.kepala || kk.no_kk), no_rumah: kk.no_rumah, gang: kk.gang };
    rec = { user_id: '', no_kk: kk.no_kk };
  } else {
    var akun = get_('USERS', key.replace(/^U:/, ''));
    if (!akun) throw new Error('Warga tidak ditemukan.');
    if (akun.no_kk) { key = 'KK:' + akun.no_kk; rec = { user_id: '', no_kk: akun.no_kk }; }
    else { key = 'U:' + akun.id; rec = { user_id: akun.id, no_kk: '' }; }
    w = akun;
  }
  if (u.role === R.KG && w.gang !== u.gang) throw new Error('Koordinator hanya bisa mencatat warga ' + u.gang + '.');
  var periode = [].concat(p.periode || []).map(String).filter(function (x) { return /^\d{4}-\d{2}$/.test(x); });
  if (!periode.length) throw new Error('Pilih minimal satu bulan.');
  var nominal = num_(p.nominal) || num_(cfg_().NOMINAL_IPL);
  if (nominal <= 0) throw new Error('Nominal tidak valid.');
  var sudah = iplPerUnit_()[key] || {};
  var baru = periode.filter(function (per) { return !sudah[per]; }).sort();
  if (!baru.length) throw new Error('Bulan yang dipilih sudah lunas semua.');
  var metode = p.metode === 'Transfer' ? 'Transfer' : 'Tunai';
  var noKw = nomorKuitansi_(cfg_()), ipl = [], kas = [];
  // Ditulis sekaligus agar pembayaran banyak bulan (mis. sampai beberapa tahun ke depan) tetap cepat
  baru.forEach(function (per) {
    var id = uid_('I');
    ipl.push({ id: id, user_id: rec.user_id, no_kk: rec.no_kk, periode: per, nominal: nominal, tgl_bayar: now_(), dicatat_oleh: u.nama,
      catatan: str_(p.catatan, 100), kuitansi: noKw, metode: metode, petugas_id: u.id });
    kas.push({
      id: uid_('K'), tanggal: now_(), jenis: 'masuk', kategori: 'IPL', nominal: nominal,
      keterangan: 'IPL ' + w.nama + ' (' + w.no_rumah + ') ' + BULAN[Number(per.slice(5)) - 1] + ' ' + per.slice(0, 4) + ' · ' + noKw,
      ref: id, dicatat_oleh: u.nama
    });
  });
  insertMany_('IPL', ipl);
  insertMany_('KAS', kas);
  return { dicatat: baru, kuitansi: noKw };
}

/* ============================================================
 *  KUITANSI PEMBAYARAN IPL (A6) — satu nomor per pencatatan pembayaran
 * ============================================================ */
function nomorKuitansi_(cfg) {
  var th = today_().slice(0, 4), maks = 0;
  rows_('IPL').forEach(function (i) {
    var m = String(i.kuitansi || '').match(/\/(\d{4})\/(\d+)$/);
    if (m && m[1] === th) maks = Math.max(maks, Number(m[2]));
  });
  return 'KW/RT' + cfg.RT + '/' + th + '/' + ('000' + (maks + 1)).slice(-4);
}
function waNomor_(hp) {
  hp = String(hp || '').replace(/\D/g, '');
  if (/^0/.test(hp)) hp = '62' + hp.slice(1);
  return hp;
}

/** Data kuitansi. p.no = nomor kuitansi, atau p.id = id baris IPL (pembayaran lama tanpa nomor). */
function ipl_kuitansi(p, u) {
  var cfg = cfg_(), um = userMap_();
  var baris = p.no ? rows_('IPL').filter(function (i) { return i.kuitansi === p.no; }) : [];
  if (!baris.length && p.id) {
    var satu = get_('IPL', p.id);
    if (satu) baris = satu.kuitansi ? rows_('IPL').filter(function (i) { return i.kuitansi === satu.kuitansi; }) : [satu];
  }
  if (!baris.length) throw new Error('Kuitansi tidak ditemukan.');
  var key = iplUnitOf_(baris[0], um);
  if (!isRole_(u, PENGURUS) && unitKey_(u) !== key) throw new Error('Anda tidak berhak membuka kuitansi ini.');
  var nama = '', rumah = '', gang = '', hp = '';
  if (key.indexOf('KK:') === 0) {
    var kk = findBy_('KK', 'no_kk', key.slice(3));
    if (kk) { nama = kk.kepala; rumah = kk.no_rumah; gang = kk.gang; }
    var akun = rows_('USERS').filter(function (x) { return x.no_kk === key.slice(3) && x.status === 'aktif'; });
    var kep = akun.filter(function (x) { return x.nama === nama; })[0] || akun[0];
    if (kep) hp = kep.no_hp;
  } else {
    var w = um[key.slice(2)];
    if (w) { nama = w.nama; rumah = w.no_rumah; gang = w.gang; hp = w.no_hp; }
  }
  var b0 = baris[0];
  var petugas = b0.petugas_id ? um[b0.petugas_id] : rows_('USERS').filter(function (x) { return x.nama === b0.dicatat_oleh; })[0];
  var periode = baris.map(function (i) { return String(i.periode); }).sort();
  var total = baris.reduce(function (n, i) { return n + num_(i.nominal); }, 0);
  return {
    no: b0.kuitansi || ('IPL-' + b0.id), tanggal: String(b0.tgl_bayar).slice(0, 10), nama: nama || '-', no_rumah: rumah, gang: gang, hp: hp,
    wa: waNomor_(hp), periode: periode, metode: b0.metode || 'Tunai', total: total, terbilang: terbilang_(total),
    petugas: petugas ? petugas.nama : b0.dicatat_oleh, jabatan: petugas ? ROLE_LABEL[petugas.role] : '', ttd: petugas && petugas.ttd ? petugas.ttd : '',
    kop: { RT: cfg.RT, RW: cfg.RW, PERUMAHAN: cfg.PERUMAHAN, DESA: cfg.DESA, SEBUTAN_DESA: cfg.SEBUTAN_DESA || 'Desa', KECAMATAN: cfg.KECAMATAN,
      KABUPATEN: cfg.KABUPATEN, SEBUTAN_KAB: cfg.SEBUTAN_KAB || 'Kabupaten', LOGO: logoSrc_(cfg),
      LOGO_PERUMAHAN: LOGO_RE.test(String(cfg.LOGO_PERUMAHAN || '')) ? cfg.LOGO_PERUMAHAN : '' }
  };
}

/** PDF A6 dari gambar kuitansi (JPG yang digambar di HP) — desain identik dengan JPG. */
function ipl_kuitansiPdf(p, u) {
  var d = p.jenis === 'iuran' ? iuran_kuitansi({ no: p.no, id: p.id }, u) : ipl_kuitansi({ no: p.no, id: p.id }, u);
  var jpg = String(p.jpg || '');
  if (!/^data:image\/jpeg;base64,[A-Za-z0-9+\/=]+$/.test(jpg)) throw new Error('Gambar kuitansi tidak valid.');
  if (jpg.length > 3000000) throw new Error('Gambar kuitansi terlalu besar.');
  var html = '<!DOCTYPE html><html><head><meta charset="utf-8"><style>@page{size:105mm 148mm;margin:0}html,body{margin:0;padding:0}img{display:block;width:105mm;height:148mm}</style></head>' +
    '<body><img src="' + jpg + '"></body></html>';
  var blob = Utilities.newBlob(html, 'text/html', 'kuitansi.html').getAs('application/pdf');
  return { pdf: Utilities.base64Encode(blob.getBytes()), filename: 'Kuitansi ' + d.no.replace(/\//g, '-') + ' ' + d.nama + '.pdf' };
}

/** Angka → kata (Rupiah) untuk kuitansi. */
function terbilang_(n) {
  n = Math.floor(Math.abs(num_(n)));
  var s = ['', 'satu', 'dua', 'tiga', 'empat', 'lima', 'enam', 'tujuh', 'delapan', 'sembilan', 'sepuluh', 'sebelas'];
  var f = function (x) {
    if (x < 12) return s[x];
    if (x < 20) return f(x - 10) + ' belas';
    if (x < 100) return f(Math.floor(x / 10)) + ' puluh' + (x % 10 ? ' ' + f(x % 10) : '');
    if (x < 200) return 'seratus' + (x - 100 ? ' ' + f(x - 100) : '');
    if (x < 1000) return f(Math.floor(x / 100)) + ' ratus' + (x % 100 ? ' ' + f(x % 100) : '');
    if (x < 2000) return 'seribu' + (x - 1000 ? ' ' + f(x - 1000) : '');
    if (x < 1e6) return f(Math.floor(x / 1000)) + ' ribu' + (x % 1000 ? ' ' + f(x % 1000) : '');
    if (x < 1e9) return f(Math.floor(x / 1e6)) + ' juta' + (x % 1e6 ? ' ' + f(x % 1e6) : '');
    return f(Math.floor(x / 1e9)) + ' miliar' + (x % 1e9 ? ' ' + f(x % 1e9) : '');
  };
  var t = n ? f(n) + ' rupiah' : 'nol rupiah';
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/** Simpan / hapus tanda tangan digital pengguna (gambar PNG dari pad tanda tangan). */
function profil_ttd(p, u) {
  var v = String(p.ttd || '').trim();
  if (v) {
    if (!/^data:image\/png;base64,[A-Za-z0-9+\/=]+$/.test(v)) throw new Error('Format tanda tangan tidak valid.');
    if (v.length > 49000) throw new Error('Gambar tanda tangan terlalu besar. Hapus lalu tanda tangani ulang dengan lebih sederhana.');
  }
  update_('USERS', u.id, { ttd: v });
  return { ada: !!v };
}

/* ============================================================
 *  IURAN KEGIATAN (17-an, syukuran, sumbangan, dll) — di luar IPL
 *  Pengurus membuat jenis iuran, lalu mencatat pembayaran per keluarga (KK).
 *  Setiap pembayaran otomatis masuk Kas RT dan mendapat kuitansi.
 * ============================================================ */
function namaUnit_(key) {
  var um = userMap_();
  if (key.indexOf('KK:') === 0) {
    var kk = findBy_('KK', 'no_kk', key.slice(3));
    var akun = rows_('USERS').filter(function (x) { return x.no_kk === key.slice(3) && x.status === 'aktif'; });
    var kep = kk ? (akun.filter(function (x) { return x.nama === kk.kepala; })[0] || akun[0]) : null;
    return kk ? { nama: kk.kepala, no_rumah: kk.no_rumah, gang: kk.gang, hp: kep ? kep.no_hp : '' } : null;
  }
  var w = um[key.replace(/^U:/, '')];
  return w ? { nama: w.nama, no_rumah: w.no_rumah, gang: w.gang, hp: w.no_hp } : null;
}
function iuranView_(x, u) {
  var bayar = rows_('IURAN_BAYAR').filter(function (b) { return b.iuran_id === x.id; });
  var total = bayar.reduce(function (n, b) { return n + num_(b.nominal); }, 0);
  var unit = unitList_('').length;
  var milik = bayar.filter(function (b) { return b.unit === unitKey_(u); })[0];
  return {
    id: x.id, nama: x.nama, nominal: num_(x.nominal), sifat: x.sifat === 'sukarela' ? 'sukarela' : 'wajib', tanggal: x.tanggal, keterangan: x.keterangan,
    status: x.status === 'selesai' ? 'selesai' : 'aktif', dibuat: x.dibuat, terkumpul: total, jumlahBayar: bayar.length, jumlahKeluarga: unit,
    target: x.sifat === 'sukarela' ? 0 : unit * num_(x.nominal),
    saya: milik ? { id: milik.id, nominal: num_(milik.nominal), tgl: milik.tgl_bayar, kuitansi: milik.kuitansi } : null
  };
}
function iuran_list(p, u) {
  return rows_('IURAN').slice().sort(function (a, b) { return String(b.dibuat).localeCompare(String(a.dibuat)); })
    .map(function (x) { return iuranView_(x, u); });
}
function iuran_simpan(p, u) {
  var o = {
    nama: str_(need_(p.nama, 'Nama iuran'), 80), nominal: num_(p.nominal), sifat: p.sifat === 'sukarela' ? 'sukarela' : 'wajib',
    tanggal: /^\d{4}-\d{2}-\d{2}$/.test(str_(p.tanggal)) ? str_(p.tanggal) : '', keterangan: str_(p.keterangan, 300),
    status: p.status === 'selesai' ? 'selesai' : 'aktif'
  };
  if (o.sifat === 'wajib' && o.nominal <= 0) throw new Error('Isi nominal iuran per keluarga.');
  if (p.id) { if (!get_('IURAN', p.id)) throw new Error('Iuran tidak ditemukan.'); return iuranView_(update_('IURAN', p.id, o), u); }
  o.id = uid_('IR'); o.dibuat = now_(); o.dibuat_oleh = u.nama;
  return iuranView_(insert_('IURAN', o), u);
}
function iuran_hapus(p) {
  if (rows_('IURAN_BAYAR').some(function (b) { return b.iuran_id === p.id; })) throw new Error('Iuran sudah memiliki pembayaran. Batalkan semua pembayaran dulu, atau tandai Selesai.');
  remove_('IURAN', p.id);
  return true;
}
function iuran_detail(p, u) {
  var x = get_('IURAN', p.id);
  if (!x) throw new Error('Iuran tidak ditemukan.');
  var gang = u.role === R.KG ? u.gang : str_(p.gang);
  var bayar = {};
  rows_('IURAN_BAYAR').forEach(function (b) { if (b.iuran_id === x.id) bayar[b.unit] = b; });
  return {
    iuran: iuranView_(x, u), gangList: gangList_(cfg_()), gang: gang,
    warga: unitList_(gang).map(function (w) {
      var b = bayar[w.id];
      w.bayar = b ? { id: b.id, nominal: num_(b.nominal), tgl: b.tgl_bayar, metode: b.metode, kuitansi: b.kuitansi, oleh: b.dicatat_oleh } : null;
      return w;
    })
  };
}
function nomorKuitansiIuran_(cfg) {
  var th = today_().slice(0, 4), maks = 0;
  rows_('IURAN_BAYAR').forEach(function (b) { var m = String(b.kuitansi || '').match(/\/(\d{4})\/(\d+)$/); if (m && m[1] === th) maks = Math.max(maks, Number(m[2])); });
  return 'KI/RT' + cfg.RT + '/' + th + '/' + ('000' + (maks + 1)).slice(-4);
}
function iuran_bayar(p, u) {
  var x = get_('IURAN', p.iuran_id);
  if (!x) throw new Error('Iuran tidak ditemukan.');
  if (x.status === 'selesai') throw new Error('Iuran ini sudah ditutup (selesai).');
  var key = str_(p.unit);
  if (key.indexOf('KK:') !== 0 && key.indexOf('U:') !== 0) throw new Error('Pilih warga / keluarga.');
  if (key.indexOf('U:') === 0) { var ak = get_('USERS', key.slice(2)); if (ak && ak.no_kk) key = 'KK:' + ak.no_kk; }
  var w = namaUnit_(key);
  if (!w) throw new Error('Data warga tidak ditemukan.');
  if (u.role === R.KG && w.gang !== u.gang) throw new Error('Koordinator hanya bisa mencatat warga ' + u.gang + '.');
  if (rows_('IURAN_BAYAR').some(function (b) { return b.iuran_id === x.id && b.unit === key; })) throw new Error(w.nama + ' sudah tercatat membayar iuran ini.');
  var nominal = num_(p.nominal) || num_(x.nominal);
  if (nominal <= 0) throw new Error('Isi nominal pembayaran.');
  var noKw = nomorKuitansiIuran_(cfg_()), id = uid_('IB');
  insert_('IURAN_BAYAR', { id: id, iuran_id: x.id, unit: key, nominal: nominal, tgl_bayar: now_(), metode: p.metode === 'Transfer' ? 'Transfer' : 'Tunai',
    kuitansi: noKw, petugas_id: u.id, dicatat_oleh: u.nama, catatan: str_(p.catatan, 100) });
  insert_('KAS', { id: uid_('K'), tanggal: now_(), jenis: 'masuk', kategori: str_(x.nama, 40), nominal: nominal,
    keterangan: x.nama + ' – ' + w.nama + ' (' + w.no_rumah + ') · ' + noKw, ref: id, dicatat_oleh: u.nama });
  return { kuitansi: noKw, id: id };
}
function iuran_batal(p) {
  var b = get_('IURAN_BAYAR', p.id);
  if (!b) throw new Error('Pembayaran tidak ditemukan.');
  var k = findBy_('KAS', 'ref', b.id);
  if (k) remove_('KAS', k.id);
  remove_('IURAN_BAYAR', b.id);
  return true;
}
function iuran_kuitansi(p, u) {
  var b = p.no ? findBy_('IURAN_BAYAR', 'kuitansi', p.no) : get_('IURAN_BAYAR', p.id);
  if (!b) throw new Error('Kuitansi tidak ditemukan.');
  if (!isRole_(u, PENGURUS) && unitKey_(u) !== b.unit) throw new Error('Anda tidak berhak membuka kuitansi ini.');
  var x = get_('IURAN', b.iuran_id) || { nama: 'Iuran' };
  var w = namaUnit_(b.unit) || { nama: '-', no_rumah: '', gang: '', hp: '' };
  var petugas = b.petugas_id ? get_('USERS', b.petugas_id) : null;
  var cfg = cfg_();
  return {
    jenis: 'iuran', namaIuran: x.nama, tanggalKegiatan: x.tanggal || '', no: b.kuitansi, tanggal: String(b.tgl_bayar).slice(0, 10),
    nama: w.nama, no_rumah: w.no_rumah, gang: w.gang, hp: w.hp, wa: waNomor_(w.hp), periode: [], metode: b.metode || 'Tunai',
    total: num_(b.nominal), terbilang: terbilang_(num_(b.nominal)), petugas: petugas ? petugas.nama : b.dicatat_oleh,
    jabatan: petugas ? ROLE_LABEL[petugas.role] : '', ttd: petugas && petugas.ttd ? petugas.ttd : '',
    kop: { RT: cfg.RT, RW: cfg.RW, PERUMAHAN: cfg.PERUMAHAN, DESA: cfg.DESA, SEBUTAN_DESA: cfg.SEBUTAN_DESA || 'Desa', KECAMATAN: cfg.KECAMATAN,
      KABUPATEN: cfg.KABUPATEN, SEBUTAN_KAB: cfg.SEBUTAN_KAB || 'Kabupaten', LOGO: logoSrc_(cfg),
      LOGO_PERUMAHAN: LOGO_RE.test(String(cfg.LOGO_PERUMAHAN || '')) ? cfg.LOGO_PERUMAHAN : '' }
  };
}

function ipl_hapus(p) {
  var i = get_('IPL', p.id);
  if (!i) throw new Error('Data pembayaran tidak ditemukan.');
  var k = findBy_('KAS', 'ref', i.id);
  if (k) remove_('KAS', k.id);
  remove_('IPL', i.id);
  return true;
}

function kas_list(p) {
  var bulan = str_(p.bulan); // 'YYYY-MM' atau kosong (semua)
  var all = rows_('KAS').slice().sort(function (a, b) { return String(b.tanggal).localeCompare(String(a.tanggal)); });
  var saldo = 0;
  all.forEach(function (k) { saldo += k.jenis === 'keluar' ? -num_(k.nominal) : num_(k.nominal); });
  var list = all.filter(function (k) { return !bulan || String(k.tanggal).slice(0, 7) === bulan; });
  var masuk = 0, keluar = 0;
  list.forEach(function (k) { if (k.jenis === 'keluar') keluar += num_(k.nominal); else masuk += num_(k.nominal); });
  return {
    saldo: saldo, masuk: masuk, keluar: keluar,
    list: list.slice(0, 300).map(function (k) {
      return { id: k.id, tanggal: k.tanggal, jenis: k.jenis, kategori: k.kategori, nominal: num_(k.nominal), keterangan: k.keterangan, otomatis: !!k.ref, dicatat_oleh: k.dicatat_oleh };
    })
  };
}

/**
 * Rekap pemasukan & pengeluaran untuk grafik berjenjang:
 *   mode 'tahun'  → per tahun (maks. 6 tahun terakhir)
 *   mode 'bulan'  → 12 bulan dalam p.tahun
 *   mode 'minggu' → minggu ke-1..5 dalam p.tahun-p.bulan (tgl 1-7, 8-14, 15-21, 22-28, 29-akhir)
 */
function kas_grafik(p) {
  var kini = today_();
  var mode = ['tahun', 'bulan', 'minggu'].indexOf(p.mode) >= 0 ? p.mode : 'bulan';
  var tahun = /^\d{4}$/.test(str_(p.tahun)) ? str_(p.tahun) : kini.slice(0, 4);
  var bulan = /^\d{1,2}$/.test(str_(p.bulan)) ? ('0' + Number(p.bulan)).slice(-2) : kini.slice(5, 7);
  var kas = rows_('KAS');
  var thMin = kas.reduce(function (m, k) { var y = String(k.tanggal).slice(0, 4); return /^\d{4}$/.test(y) && y < m ? y : m; }, kini.slice(0, 4));
  var thMaks = kini.slice(0, 4);
  var data = [];
  var tambah = function (key, label, panjang) { data.push({ key: key, label: label, panjang: panjang, masuk: 0, keluar: 0 }); };
  if (mode === 'tahun') {
    for (var y = Math.max(Number(thMin), Number(thMaks) - 5); y <= Number(thMaks); y++) tambah(String(y), String(y), 'Tahun ' + y);
  } else if (mode === 'bulan') {
    for (var m = 1; m <= 12; m++) tambah(tahun + '-' + ('0' + m).slice(-2), BULAN[m - 1].slice(0, 3), BULAN[m - 1] + ' ' + tahun);
  } else {
    var akhir = new Date(Number(tahun), Number(bulan), 0).getDate();
    var nmBln = BULAN[Number(bulan) - 1].slice(0, 3);
    for (var w = 0; w * 7 < akhir; w++) {
      var a1 = w * 7 + 1, a2 = Math.min(w * 7 + 7, akhir);
      if (w === 4) a2 = akhir;
      if (w > 4) break;
      tambah(String(w + 1), 'Mg ' + (w + 1), a1 + '–' + a2 + ' ' + nmBln + ' ' + tahun);
    }
  }
  var cari = function (tgl) {
    tgl = String(tgl);
    if (mode === 'tahun') return tgl.slice(0, 4);
    if (mode === 'bulan') return tgl.slice(0, 4) === tahun ? tgl.slice(0, 7) : null;
    if (tgl.slice(0, 7) !== tahun + '-' + bulan) return null;
    return String(Math.min(Math.floor((Number(tgl.slice(8, 10)) - 1) / 7), 4) + 1);
  };
  var idx = {};
  data.forEach(function (d, i) { idx[d.key] = i; });
  kas.forEach(function (k) {
    var key = cari(k.tanggal);
    if (key === null || idx[key] === undefined) return;
    var d = data[idx[key]];
    if (k.jenis === 'keluar') d.keluar += num_(k.nominal); else d.masuk += num_(k.nominal);
  });
  var tot = data.reduce(function (t, d) { t.masuk += d.masuk; t.keluar += d.keluar; return t; }, { masuk: 0, keluar: 0 });
  return {
    mode: mode, tahun: tahun, bulan: bulan, namaBulan: BULAN[Number(bulan) - 1], data: data, total: tot,
    tahunList: (function () { var l = []; for (var y = Number(thMin); y <= Number(thMaks); y++) l.push(String(y)); return l; })()
  };
}

/* ============================================================
 *  LAPORAN UNDUHAN (Excel & PDF) — hanya Super Admin, Ketua, Sekretaris, Bendahara
 *  Server mengirim data tabel (dibuat Excel di browser) atau PDF berkop (dibuat di server).
 * ============================================================ */
function kopLaporan_(cfg) {
  return '<table style="width:100%"><tr>' +
    '<td style="width:64pt;vertical-align:middle"><img src="' + logoSrc_(cfg) + '" style="width:60pt;height:auto"></td>' +
    '<td style="text-align:center;vertical-align:middle;padding-right:50pt">' +
    '<div style="font-size:12pt">PEMERINTAH ' + esc_(String(cfg.SEBUTAN_KAB || 'Kabupaten').toUpperCase()) + ' ' + esc_(String(cfg.KABUPATEN).toUpperCase()) + '</div>' +
    '<div style="font-size:12pt">' + esc_(String(cfg.SEBUTAN_DESA || 'Desa').toUpperCase()) + ' ' + esc_(String(cfg.DESA).toUpperCase()) + ' &ndash; KECAMATAN ' + esc_(String(cfg.KECAMATAN).toUpperCase()) + '</div>' +
    '<div style="font-size:15pt;font-weight:bold">RUKUN TETANGGA ' + esc_(cfg.RT) + ' &ndash; RUKUN WARGA ' + esc_(cfg.RW) + '</div>' +
    '<div style="font-size:10.5pt">' + esc_(String(cfg.PERUMAHAN).toUpperCase()) + '</div></td></tr></table>' +
    '<div style="border-top:3px solid #000;margin-top:4pt"></div><div style="border-top:1px solid #000;margin-top:2pt"></div>';
}
/** Ukuran kertas PDF & cetak: F4 / Folio (215 x 330 mm, bawaan) atau A4. */
function ukuranKertas_(cfg, mendatar) {
  var f4 = (cfg || cfg_()).UKURAN_KERTAS !== 'A4';
  if (f4) return mendatar ? '330mm 215mm' : '215mm 330mm';
  return mendatar ? 'A4 landscape' : 'A4';
}
function rpTeks_(n) { n = Math.round(num_(n)); var s = String(Math.abs(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.'); return (n < 0 ? '-' : '') + 'Rp ' + s; }
function namaPeran_(role) { var x = rows_('USERS').filter(function (w) { return w.role === role && w.status === 'aktif'; })[0]; return x ? x.nama : ''; }
function ttdLaporan_(cfg) {
  var tgl = tglIndo_(today_());
  var kol = function (jab, nama) { return '<td style="width:50%;text-align:center;vertical-align:top;border:0">' + jab + '<br><br><br><br><br>( <b><u>' + esc_(nama || '..............................') + '</u></b> )</td>'; };
  return '<table style="width:100%;margin-top:18pt;page-break-inside:avoid"><tr><td style="border:0"></td><td style="text-align:center;border:0">' + esc_(cfg.TEMPAT_SURAT) + ', ' + tgl + '</td></tr>' +
    '<tr>' + kol('Mengetahui,<br>Ketua RT ' + esc_(cfg.RT), str_(cfg.NAMA_KETUA_RT) || namaPeran_(R.KT)) + kol('<br>Bendahara RT ' + esc_(cfg.RT), namaPeran_(R.BD)) + '</tr></table>';
}
function pdfDari_(html, nama) {
  var blob = Utilities.newBlob(html, 'text/html', 'laporan.html').getAs('application/pdf');
  return { pdf: Utilities.base64Encode(blob.getBytes()), filename: nama, html: html };
}
var CSS_LAPORAN = 'body{font-family:Arial,Helvetica,sans-serif;color:#000;margin:0}table{border-collapse:collapse}' +
  '.t td,.t th{border:1px solid #444;padding:2.5pt 3pt;font-size:8pt}.t th{background:#e8f3ee;font-weight:bold}.r{text-align:right}.c{text-align:center}' +
  '.tot td{font-weight:bold;background:#f3f4f6}';

/**
 * Rekap IPL: mode 'tahun' (matriks Jan–Des per keluarga), 'bulan' (status semua keluarga untuk 1 bulan tagihan),
 * 'minggu' (penerimaan IPL berdasarkan tanggal bayar dalam rentang 7 hari).
 */
function laporan_ipl(p, u) {
  if (p.mode === 'bulan') return laporanIplBulan_(p, u);
  if (p.mode === 'minggu') return laporanIplMinggu_(p, u);
  return laporanIplTahun_(p, u);
}

function htmlLaporan_(cfg, judul, sub, isi, landscape) {
  return '<!DOCTYPE html><html><head><meta charset="utf-8"><style>@page{size:' + ukuranKertas_(cfg, landscape) + ';margin:22pt 28pt}' + CSS_LAPORAN + '</style></head><body>' + kopLaporan_(cfg) +
    '<div style="text-align:center;font-weight:bold;font-size:12pt;margin:10pt 0 2pt">' + judul + '</div>' +
    '<div style="text-align:center;font-size:10pt;margin-bottom:8pt">' + sub + '</div>' + isi + ttdLaporan_(cfg) + '</body></html>';
}

function laporanIplBulan_(p, u) {
  var cfg = cfg_();
  var bulan = /^\d{4}-\d{2}$/.test(str_(p.bulan)) ? str_(p.bulan) : today_().slice(0, 7);
  var per = iplPerUnit_();
  var lunas = 0, total = 0;
  var rows = unitList_('').map(function (w, i) {
    var x = (per[w.id] || {})[bulan];
    if (x) { lunas++; total += num_(x.nominal); }
    return { no: i + 1, nama: w.nama, jenis: w.jenis === 'kk' ? 'KK (' + w.anggota + ' jiwa)' : 'Akun', no_rumah: w.no_rumah, gang: w.gang,
      status: x ? 'Lunas' : 'Belum', tgl_bayar: x ? String(x.tgl_bayar).slice(0, 10) : '', nominal: x ? num_(x.nominal) : 0, dicatat_oleh: x ? x.dicatat_oleh : '' };
  });
  var label = BULAN[Number(bulan.slice(5)) - 1] + ' ' + bulan.slice(0, 4);
  var out = { mode: 'bulan', judul: 'Rekap IPL Bulan ' + label, periode: label, bulan: bulan, rows: rows, lunas: lunas, belum: rows.length - lunas, total: total,
    target: rows.length * num_(cfg.NOMINAL_IPL), nominal: num_(cfg.NOMINAL_IPL), dicetak: now_(), oleh: u.nama };
  if (p.format !== 'pdf') return out;
  var pct = rows.length ? Math.round(lunas / rows.length * 100) : 0;
  var isi = '<table class="t" style="width:60%;margin-bottom:8pt"><tr><td>Jumlah keluarga</td><td class="r">' + rows.length + '</td></tr><tr><td>Sudah lunas</td><td class="r">' + lunas + ' (' + pct + '%)</td></tr>' +
    '<tr><td>Belum bayar</td><td class="r">' + out.belum + '</td></tr><tr><td>Target penerimaan</td><td class="r">' + rpTeks_(out.target) + '</td></tr><tr class="tot"><td>Total diterima</td><td class="r">' + rpTeks_(total) + '</td></tr></table>' +
    '<table class="t" style="width:100%"><tr><th>No</th><th>Kepala Keluarga / Warga</th><th>Rumah</th><th>Blok</th><th>Status</th><th>Tgl Bayar</th><th>Nominal</th><th>Dicatat oleh</th></tr>' +
    rows.map(function (r) {
      return '<tr><td class="c">' + r.no + '</td><td>' + esc_(r.nama) + '</td><td class="c">' + esc_(r.no_rumah) + '</td><td>' + esc_(r.gang) + '</td><td class="c"' + (r.status === 'Belum' ? ' style="color:#b91c1c"' : '') + '>' + r.status + '</td>' +
        '<td class="c">' + esc_(r.tgl_bayar) + '</td><td class="r">' + (r.nominal ? rpTeks_(r.nominal) : '-') + '</td><td>' + esc_(r.dicatat_oleh) + '</td></tr>';
    }).join('') + '<tr class="tot"><td colspan="6">Total diterima</td><td class="r">' + rpTeks_(total) + '</td><td></td></tr></table>' +
    '<div style="font-size:8pt;margin-top:4pt">Dicetak ' + esc_(tglIndo_(today_())) + ' oleh ' + esc_(u.nama) + '.</div>';
  return pdfDari_(htmlLaporan_(cfg, 'REKAP IURAN IPL BULANAN', 'Bulan tagihan ' + esc_(label) + ' &middot; Iuran ' + rpTeks_(out.nominal) + ' / bulan', isi, false), 'Rekap IPL RT' + cfg.RT + ' ' + bulan + '.pdf');
}

function laporanIplMinggu_(p, u) {
  var cfg = cfg_();
  var dari = /^\d{4}-\d{2}-\d{2}$/.test(str_(p.dari)) ? str_(p.dari) : today_();
  var sampai = /^\d{4}-\d{2}-\d{2}$/.test(str_(p.sampai)) ? str_(p.sampai) : tambahHari_(dari, 6);
  if (sampai < dari) throw new Error('Tanggal akhir tidak boleh sebelum tanggal awal.');
  var um = userMap_(), kkMap = {};
  rows_('KK').forEach(function (k) { kkMap[k.no_kk] = k; });
  var total = 0, hari = {};
  var rows = rows_('IPL').filter(function (i) { var t = String(i.tgl_bayar).slice(0, 10); return t >= dari && t <= sampai; })
    .sort(function (a, b) { return String(a.tgl_bayar).localeCompare(String(b.tgl_bayar)); })
    .map(function (i, n) {
      var key = iplUnitOf_(i, um), nama = '', rumah = '', gang = '';
      if (key.indexOf('KK:') === 0) { var k = kkMap[key.slice(3)]; if (k) { nama = k.kepala; rumah = k.no_rumah; gang = k.gang; } }
      else { var w = um[i.user_id]; if (w) { nama = w.nama; rumah = w.no_rumah; gang = w.gang; } }
      var t = String(i.tgl_bayar).slice(0, 10);
      total += num_(i.nominal); hari[t] = (hari[t] || 0) + num_(i.nominal);
      return { no: n + 1, tgl_bayar: t, nama: nama || '(dihapus)', no_rumah: rumah, gang: gang, periode: BULAN[Number(String(i.periode).slice(5)) - 1] + ' ' + String(i.periode).slice(0, 4),
        nominal: num_(i.nominal), dicatat_oleh: i.dicatat_oleh };
    });
  var harian = [];
  for (var d = dari, x = 0; d <= sampai && x < 62; d = tambahHari_(d, 1), x++) harian.push({ tanggal: d, nominal: hari[d] || 0 });
  var label = tglIndo_(dari) + ' s.d. ' + tglIndo_(sampai);
  var out = { mode: 'minggu', judul: 'Penerimaan IPL ' + label, periode: label, dari: dari, sampai: sampai, rows: rows, harian: harian, total: total, transaksi: rows.length, dicetak: now_(), oleh: u.nama };
  if (p.format !== 'pdf') return out;
  var HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  var namaHari = function (ymd) { return HARI[new Date(Number(ymd.slice(0, 4)), Number(ymd.slice(5, 7)) - 1, Number(ymd.slice(8, 10)), 12).getDay()]; };
  var isi = '<table class="t" style="width:60%;margin-bottom:8pt"><tr><th>Hari</th><th>Tanggal</th><th>Diterima</th></tr>' +
    harian.map(function (h2) { return '<tr><td>' + namaHari(h2.tanggal) + '</td><td class="c">' + esc_(tglIndo_(h2.tanggal)) + '</td><td class="r">' + (h2.nominal ? rpTeks_(h2.nominal) : '-') + '</td></tr>'; }).join('') +
    '<tr class="tot"><td colspan="2">Total ' + rows.length + ' pembayaran</td><td class="r">' + rpTeks_(total) + '</td></tr></table>' +
    '<div style="font-weight:bold;font-size:9.5pt;margin:6pt 0 3pt">Rincian pembayaran</div>' +
    '<table class="t" style="width:100%"><tr><th>No</th><th>Tgl Bayar</th><th>Kepala Keluarga / Warga</th><th>Rumah</th><th>Blok</th><th>Untuk Bulan</th><th>Nominal</th><th>Dicatat oleh</th></tr>' +
    (rows.length ? rows.map(function (r) {
      return '<tr><td class="c">' + r.no + '</td><td class="c">' + esc_(r.tgl_bayar) + '</td><td>' + esc_(r.nama) + '</td><td class="c">' + esc_(r.no_rumah) + '</td><td>' + esc_(r.gang) + '</td><td>' + esc_(r.periode) + '</td><td class="r">' + rpTeks_(r.nominal) + '</td><td>' + esc_(r.dicatat_oleh) + '</td></tr>';
    }).join('') : '<tr><td colspan="8" class="c">Tidak ada pembayaran pada periode ini</td></tr>') +
    '<tr class="tot"><td colspan="6">Total</td><td class="r">' + rpTeks_(total) + '</td><td></td></tr></table>' +
    '<div style="font-size:8pt;margin-top:4pt">Dicetak ' + esc_(tglIndo_(today_())) + ' oleh ' + esc_(u.nama) + '.</div>';
  return pdfDari_(htmlLaporan_(cfg, 'REKAP PENERIMAAN IPL MINGGUAN', 'Periode ' + esc_(label), isi, false), 'Rekap IPL Mingguan RT' + cfg.RT + ' ' + dari + ' sd ' + sampai + '.pdf');
}

function laporanIplTahun_(p, u) {
  var cfg = cfg_();
  var tahun = /^\d{4}$/.test(str_(p.tahun)) ? str_(p.tahun) : today_().slice(0, 4);
  var kini = today_().slice(0, 7);
  var mulai = /^\d{4}-\d{2}$/.test(str_(cfg.IPL_MULAI)) ? str_(cfg.IPL_MULAI) : kini.slice(0, 4) + '-01';
  var per = iplPerUnit_();
  var totBulan = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], lunasBulan = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], grand = 0, totTunggak = 0;
  var units = unitList_('');
  var rows = units.map(function (w, i) {
    var bayar = per[w.id] || {}, total = 0, lunas = 0, tunggak = 0, bln = [];
    for (var m = 1; m <= 12; m++) {
      var k = tahun + '-' + ('0' + m).slice(-2), x = bayar[k];
      var n = x ? num_(x.nominal) : 0;
      bln.push(n);
      if (x) { total += n; lunas++; totBulan[m - 1] += n; lunasBulan[m - 1]++; }
      else if (k >= mulai && k <= kini) tunggak++;
    }
    grand += total; totTunggak += tunggak;
    return { no: i + 1, nama: w.nama, jenis: w.jenis === 'kk' ? 'KK (' + w.anggota + ' jiwa)' : 'Akun', no_rumah: w.no_rumah, gang: w.gang, bulan: bln, total: total, lunas: lunas, tunggakan: tunggak };
  });
  var out = {
    mode: 'tahun', judul: 'Rekap Iuran IPL RT ' + cfg.RT + ' / RW ' + cfg.RW + ' Tahun ' + tahun, tahun: tahun, nominal: num_(cfg.NOMINAL_IPL), rows: rows,
    totBulan: totBulan, lunasBulan: lunasBulan, grand: grand, unit: rows.length, totTunggak: totTunggak, dicetak: now_(), oleh: u.nama
  };
  if (p.format !== 'pdf') return out;
  var BLN3 = BULAN.map(function (b) { return b.slice(0, 3); });
  var html = '<!DOCTYPE html><html><head><meta charset="utf-8"><style>@page{size:' + ukuranKertas_(cfg, true) + ';margin:20pt 24pt}' + CSS_LAPORAN + '</style></head><body>' + kopLaporan_(cfg) +
    '<div style="text-align:center;font-weight:bold;font-size:12pt;margin:10pt 0 2pt">REKAP IURAN PENGELOLAAN LINGKUNGAN (IPL)</div>' +
    '<div style="text-align:center;font-size:10pt;margin-bottom:8pt">Tahun ' + tahun + ' &middot; Iuran ' + rpTeks_(out.nominal) + ' / bulan &middot; ' + out.unit + ' keluarga</div>' +
    '<table class="t" style="width:100%"><tr><th>No</th><th>Kepala Keluarga / Warga</th><th>Rumah</th><th>Blok</th>' + BLN3.map(function (b) { return '<th>' + b + '</th>'; }).join('') + '<th>Total</th><th>Tunggak</th></tr>' +
    rows.map(function (r) {
      return '<tr><td class="c">' + r.no + '</td><td>' + esc_(r.nama) + '</td><td class="c">' + esc_(r.no_rumah) + '</td><td>' + esc_(r.gang) + '</td>' +
        r.bulan.map(function (n) { return '<td class="c">' + (n ? '&#10004;' : '-') + '</td>'; }).join('') + '<td class="r">' + rpTeks_(r.total) + '</td><td class="c">' + (r.tunggakan ? r.tunggakan + ' bln' : '-') + '</td></tr>';
    }).join('') +
    '<tr class="tot"><td colspan="4">Jumlah keluarga lunas</td>' + lunasBulan.map(function (n) { return '<td class="c">' + n + '</td>'; }).join('') + '<td></td><td></td></tr>' +
    '<tr class="tot"><td colspan="4">Total penerimaan</td>' + totBulan.map(function (n) { return '<td class="r">' + (n ? rpTeks_(n).replace('Rp ', '') : '-') + '</td>'; }).join('') + '<td class="r">' + rpTeks_(grand) + '</td><td class="c">' + totTunggak + '</td></tr>' +
    '</table><div style="font-size:8pt;margin-top:4pt">&#10004; = lunas &middot; Tunggak = jumlah bulan belum dibayar s.d. bulan berjalan. Dicetak ' + esc_(tglIndo_(today_())) + ' oleh ' + esc_(u.nama) + '.</div>' +
    ttdLaporan_(cfg) + '</body></html>';
  return pdfDari_(html, 'Rekap IPL RT' + cfg.RT + ' ' + tahun + '.pdf');
}

/** Laporan keuangan kas: saldo awal, mutasi masuk/keluar, saldo berjalan, ringkasan per kategori. */
function laporan_kas(p, u) {
  var cfg = cfg_();
  var dari = /^\d{4}-\d{2}-\d{2}$/.test(str_(p.dari)) ? str_(p.dari) : today_().slice(0, 8) + '01';
  var sampai = /^\d{4}-\d{2}-\d{2}$/.test(str_(p.sampai)) ? str_(p.sampai) : today_();
  if (sampai < dari) throw new Error('Tanggal akhir tidak boleh sebelum tanggal awal.');
  var semua = rows_('KAS').slice().sort(function (a, b) { return String(a.tanggal).localeCompare(String(b.tanggal)); });
  var saldoAwal = 0;
  semua.forEach(function (k) { if (String(k.tanggal).slice(0, 10) < dari) saldoAwal += k.jenis === 'keluar' ? -num_(k.nominal) : num_(k.nominal); });
  var saldo = saldoAwal, masuk = 0, keluar = 0, kat = {};
  var rows = semua.filter(function (k) { var t = String(k.tanggal).slice(0, 10); return t >= dari && t <= sampai; }).map(function (k, i) {
    var n = num_(k.nominal), isK = k.jenis === 'keluar';
    if (isK) { keluar += n; saldo -= n; } else { masuk += n; saldo += n; }
    var c = kat[k.kategori || 'Lainnya'] || (kat[k.kategori || 'Lainnya'] = { masuk: 0, keluar: 0 });
    if (isK) c.keluar += n; else c.masuk += n;
    return { no: i + 1, tanggal: String(k.tanggal).slice(0, 10), kategori: k.kategori, keterangan: k.keterangan, masuk: isK ? 0 : n, keluar: isK ? n : 0, saldo: saldo, oleh: k.dicatat_oleh };
  });
  var jenis = { minggu: 'Mingguan', bulan: 'Bulanan', tahun: 'Tahunan' }[p.mode] || '';
  var out = {
    mode: p.mode || 'pilih', jenis: jenis,
    judul: 'Laporan Keuangan Kas RT ' + cfg.RT + ' / RW ' + cfg.RW + (jenis ? ' (' + jenis + ')' : ''), dari: dari, sampai: sampai, periode: tglIndo_(dari) + ' s.d. ' + tglIndo_(sampai),
    saldoAwal: saldoAwal, masuk: masuk, keluar: keluar, saldoAkhir: saldo, rows: rows,
    kategori: Object.keys(kat).sort().map(function (k) { return { kategori: k, masuk: kat[k].masuk, keluar: kat[k].keluar }; }), dicetak: now_(), oleh: u.nama
  };
  if (p.format !== 'pdf') return out;
  var html = '<!DOCTYPE html><html><head><meta charset="utf-8"><style>@page{size:' + ukuranKertas_(cfg, false) + ';margin:24pt 30pt}' + CSS_LAPORAN + '</style></head><body>' + kopLaporan_(cfg) +
    '<div style="text-align:center;font-weight:bold;font-size:12pt;margin:10pt 0 2pt">LAPORAN KEUANGAN KAS RT' + (jenis ? ' ' + jenis.toUpperCase() : '') + '</div>' +
    '<div style="text-align:center;font-size:10pt;margin-bottom:8pt">Periode ' + esc_(out.periode) + '</div>' +
    '<table class="t" style="width:60%;margin-bottom:8pt"><tr><td>Saldo awal (' + esc_(tglIndo_(dari)) + ')</td><td class="r">' + rpTeks_(saldoAwal) + '</td></tr>' +
    '<tr><td>Total pemasukan</td><td class="r">' + rpTeks_(masuk) + '</td></tr><tr><td>Total pengeluaran</td><td class="r">' + rpTeks_(keluar) + '</td></tr>' +
    '<tr class="tot"><td>Saldo akhir (' + esc_(tglIndo_(sampai)) + ')</td><td class="r">' + rpTeks_(saldo) + '</td></tr></table>' +
    '<div style="font-weight:bold;font-size:9.5pt;margin:6pt 0 3pt">Rincian transaksi</div>' +
    '<table class="t" style="width:100%"><tr><th>No</th><th>Tanggal</th><th>Kategori</th><th>Keterangan</th><th>Pemasukan</th><th>Pengeluaran</th><th>Saldo</th></tr>' +
    '<tr><td></td><td class="c">' + esc_(dari) + '</td><td colspan="4"><i>Saldo awal</i></td><td class="r">' + rpTeks_(saldoAwal) + '</td></tr>' +
    (rows.length ? rows.map(function (r) {
      return '<tr><td class="c">' + r.no + '</td><td class="c">' + esc_(r.tanggal) + '</td><td>' + esc_(r.kategori) + '</td><td>' + esc_(r.keterangan) + '</td>' +
        '<td class="r">' + (r.masuk ? rpTeks_(r.masuk) : '') + '</td><td class="r">' + (r.keluar ? rpTeks_(r.keluar) : '') + '</td><td class="r">' + rpTeks_(r.saldo) + '</td></tr>';
    }).join('') : '<tr><td colspan="7" class="c">Tidak ada transaksi pada periode ini</td></tr>') +
    '<tr class="tot"><td colspan="4">Jumlah</td><td class="r">' + rpTeks_(masuk) + '</td><td class="r">' + rpTeks_(keluar) + '</td><td class="r">' + rpTeks_(saldo) + '</td></tr></table>' +
    (out.kategori.length ? '<div style="font-weight:bold;font-size:9.5pt;margin:10pt 0 3pt">Ringkasan per kategori</div><table class="t" style="width:70%"><tr><th>Kategori</th><th>Pemasukan</th><th>Pengeluaran</th></tr>' +
      out.kategori.map(function (k) { return '<tr><td>' + esc_(k.kategori) + '</td><td class="r">' + (k.masuk ? rpTeks_(k.masuk) : '-') + '</td><td class="r">' + (k.keluar ? rpTeks_(k.keluar) : '-') + '</td></tr>'; }).join('') + '</table>' : '') +
    '<div style="font-size:8pt;margin-top:4pt">Dicetak ' + esc_(tglIndo_(today_())) + ' oleh ' + esc_(u.nama) + '.</div>' + ttdLaporan_(cfg) + '</body></html>';
  return pdfDari_(html, 'Laporan Kas ' + (jenis ? jenis + ' ' : '') + 'RT' + cfg.RT + ' ' + dari + ' sd ' + sampai + '.pdf');
}

function kas_simpan(p, u) {
  var o = {
    tanggal: (str_(p.tanggal, 10) || today_()) + ' ' + now_().slice(11),
    jenis: p.jenis === 'keluar' ? 'keluar' : 'masuk', kategori: str_(need_(p.kategori, 'Kategori'), 40),
    nominal: num_(p.nominal), keterangan: str_(p.keterangan, 200), dicatat_oleh: u.nama
  };
  if (o.nominal <= 0) throw new Error('Nominal harus lebih dari 0.');
  if (p.id) {
    var lama = get_('KAS', p.id);
    if (!lama) throw new Error('Data kas tidak ditemukan.');
    if (lama.ref) throw new Error('Transaksi otomatis (IPL / Iuran Kegiatan) diubah dari menu asalnya.');
    return update_('KAS', p.id, o);
  }
  o.id = uid_('K'); o.ref = '';
  return insert_('KAS', o);
}

function kas_hapus(p) {
  var k = get_('KAS', p.id);
  if (!k) throw new Error('Data kas tidak ditemukan.');
  if (k.ref) throw new Error('Transaksi otomatis (IPL / Iuran Kegiatan) dibatalkan dari menu asalnya.');
  remove_('KAS', k.id);
  return true;
}

/* ============================================================
 *  ASET RT & PEMINJAMAN
 * ============================================================ */
/*
 * STOK BERDASARKAN TANGGAL
 * Pinjaman yang DISETUJUI memakai stok dari tgl_pinjam s.d. tgl_kembali. Bila belum ditandai dikembalikan
 * padahal tanggal kembali sudah lewat (terlambat), stok tetap dianggap terpakai sampai hari ini.
 * Pengajuan yang masih MENUNGGU tidak mengurangi stok, hanya ditampilkan sebagai informasi.
 */
function tambahHari_(ymd, n) {
  var d = new Date(Number(ymd.slice(0, 4)), Number(ymd.slice(5, 7)) - 1, Number(ymd.slice(8, 10)) + n, 12);
  return Utilities.formatDate(d, TZ, 'yyyy-MM-dd');
}
function rentangPakai_(x) {
  var akhir = String(x.tgl_kembali);
  var kini = today_();
  if (x.status === 'disetujui' && akhir < kini) akhir = kini;
  return { mulai: String(x.tgl_pinjam), akhir: akhir };
}
/** Jumlah unit terpakai (maksimum harian) untuk aset pada rentang t1..t2. status: 'disetujui' / 'menunggu'. */
function terpakai_(asetId, t1, t2, status, kecualiId) {
  var list = rows_('PINJAM').filter(function (x) { return x.aset_id === asetId && x.status === status && x.id !== kecualiId; })
    .map(function (x) { var r = rentangPakai_(x); return { mulai: r.mulai, akhir: r.akhir, jml: num_(x.jumlah) }; })
    .filter(function (r) { return r.mulai <= t2 && r.akhir >= t1; });
  if (!list.length) return 0;
  var maks = 0, d = t1;
  for (var i = 0; i < 62 && d <= t2; i++) {
    var n = 0;
    list.forEach(function (r) { if (r.mulai <= d && r.akhir >= d) n += r.jml; });
    if (n > maks) maks = n;
    d = tambahHari_(d, 1);
  }
  return maks;
}
function stokDipinjam_() {
  var m = {}, kini = today_();
  rows_('ASET').forEach(function (a) { m[a.id] = terpakai_(a.id, kini, kini, 'disetujui'); });
  return m;
}
/** Jadwal pemakaian aktif & mendatang (disetujui + menunggu). Nama hanya untuk pengurus / pemilik. */
function jadwalAset_(asetId, u) {
  var um = userMap_(), kini = today_(), pengurus = isRole_(u, PENGURUS);
  return rows_('PINJAM').filter(function (x) {
    return x.aset_id === asetId && (x.status === 'disetujui' || x.status === 'menunggu') && rentangPakai_(x).akhir >= kini;
  }).sort(function (a, b) { return String(a.tgl_pinjam).localeCompare(String(b.tgl_pinjam)); }).slice(0, 30).map(function (x) {
    var w = um[x.user_id];
    var oleh = x.user_id === u.id ? 'Anda' : (pengurus ? (w ? w.nama + (w.no_rumah ? ' (' + w.no_rumah + ')' : '') : '-') : 'Warga' + (w && w.gang ? ' ' + w.gang : ''));
    return { tgl_pinjam: x.tgl_pinjam, tgl_kembali: x.tgl_kembali, jumlah: num_(x.jumlah), status: x.status, oleh: oleh, terlambat: x.status === 'disetujui' && String(x.tgl_kembali) < kini };
  });
}
function cekTanggal_(t1, t2) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t1) || !/^\d{4}-\d{2}-\d{2}$/.test(t2)) throw new Error('Isi tanggal pinjam dan tanggal kembali.');
  if (t2 < t1) throw new Error('Tanggal kembali tidak boleh sebelum tanggal pinjam.');
  if (tambahHari_(t1, 30) < t2) throw new Error('Lama peminjaman maksimal 30 hari.');
}

/** Cek stok tersedia untuk rentang tanggal (dipakai form pinjam, tampil langsung ke warga). */
function aset_cek(p, u) {
  var a = get_('ASET', p.aset_id);
  if (!a) throw new Error('Aset tidak ditemukan.');
  var t1 = str_(p.tgl_pinjam), t2 = str_(p.tgl_kembali);
  cekTanggal_(t1, t2);
  var dipakai = terpakai_(a.id, t1, t2, 'disetujui');
  return {
    jumlah: num_(a.jumlah), dipakai: dipakai, tersedia: Math.max(num_(a.jumlah) - dipakai, 0),
    menunggu: terpakai_(a.id, t1, t2, 'menunggu'), jadwal: jadwalAset_(a.id, u)
  };
}

function asetView_(a, dipinjam, denganFoto) {
  var o = {
    id: a.id, nama: a.nama, jumlah: num_(a.jumlah), kondisi: a.kondisi, lokasi: a.lokasi, keterangan: a.keterangan,
    kode: a.kode, kategori: a.kategori, tgl_perolehan: a.tgl_perolehan, sumber: a.sumber, nilai: num_(a.nilai), pj: a.pj,
    adaFoto: !!a.foto, dipinjam: dipinjam[a.id] || 0, tersedia: Math.max(num_(a.jumlah) - (dipinjam[a.id] || 0), 0)
  };
  if (denganFoto) o.foto = a.foto;
  return o;
}

function aset_list() {
  var dipinjam = stokDipinjam_(), kini = today_();
  var jadwal = {};
  rows_('PINJAM').forEach(function (x) {
    if ((x.status === 'disetujui' || x.status === 'menunggu') && rentangPakai_(x).akhir >= kini) jadwal[x.aset_id] = (jadwal[x.aset_id] || 0) + 1;
  });
  return rows_('ASET').map(function (a) { var o = asetView_(a, dipinjam, false); o.jadwal = jadwal[a.id] || 0; return o; })
    .sort(function (a, b) { return a.nama.localeCompare(b.nama); });
}

/** Detail 1 aset + foto + riwayat peminjaman (nama peminjam hanya terlihat oleh pengurus). */
function aset_detail(p, u) {
  var a = get_('ASET', p.id);
  if (!a) throw new Error('Aset tidak ditemukan.');
  var um = userMap_();
  var pengurus = isRole_(u, PENGURUS);
  var riwayat = rows_('PINJAM').filter(function (x) { return x.aset_id === a.id; })
    .sort(function (x, y) { return String(y.dibuat).localeCompare(String(x.dibuat)); }).slice(0, 30)
    .map(function (x) {
      var w = um[x.user_id];
      return {
        peminjam: pengurus || x.user_id === u.id ? (w ? w.nama + (w.no_rumah ? ' (' + w.no_rumah + ')' : '') : '(akun dihapus)') : 'Warga',
        jumlah: num_(x.jumlah), tgl_pinjam: x.tgl_pinjam, tgl_kembali: x.tgl_kembali, status: x.status, keperluan: pengurus ? x.keperluan : ''
      };
    });
  var o = asetView_(a, stokDipinjam_(), true);
  o.riwayat = riwayat;
  o.jadwal = jadwalAset_(a.id, u);
  o.totalPinjam = riwayat.filter(function (x) { return x.status === 'disetujui' || x.status === 'dikembalikan'; }).length;
  return o;
}

function kodeAsetBaru_() {
  var maks = 0;
  rows_('ASET').forEach(function (a) { var m = String(a.kode || '').match(/(\d+)$/); if (m) maks = Math.max(maks, Number(m[1])); });
  return 'INV-RT' + cfg_().RT + '-' + ('00' + (maks + 1)).slice(-3);
}

function aset_simpan(p) {
  var o = {
    nama: str_(need_(p.nama, 'Nama aset'), 80), jumlah: num_(p.jumlah), kondisi: str_(p.kondisi, 30) || 'Baik',
    lokasi: str_(p.lokasi, 60), keterangan: str_(p.keterangan, 500), kode: str_(p.kode, 30), kategori: str_(p.kategori, 40),
    tgl_perolehan: /^\d{4}-\d{2}-\d{2}$/.test(str_(p.tgl_perolehan)) ? str_(p.tgl_perolehan) : '',
    sumber: str_(p.sumber, 60), nilai: num_(p.nilai), pj: str_(p.pj, 80)
  };
  if (o.jumlah < 0) throw new Error('Jumlah tidak valid.');
  if (o.nilai < 0) throw new Error('Nilai perolehan tidak valid.');
  if (p.foto !== undefined) o.foto = foto_(p.foto);
  if (o.kode) {
    var dobel = rows_('ASET').some(function (a) { return String(a.kode).toUpperCase() === o.kode.toUpperCase() && a.id !== p.id; });
    if (dobel) throw new Error('Kode inventaris ' + o.kode + ' sudah dipakai aset lain.');
  }
  if (p.id) {
    if (!o.kode) o.kode = get_('ASET', p.id).kode || kodeAsetBaru_();
    return asetView_(update_('ASET', p.id, o), stokDipinjam_(), false);
  }
  if (!o.kode) o.kode = kodeAsetBaru_();
  o.id = uid_('A');
  return asetView_(insert_('ASET', o), stokDipinjam_(), false);
}

function aset_hapus(p) {
  var aktif = rows_('PINJAM').some(function (x) { return x.aset_id === p.id && (x.status === 'disetujui' || x.status === 'menunggu'); });
  if (aktif) throw new Error('Aset masih dipinjam / ada pengajuan aktif.');
  remove_('ASET', p.id);
  return true;
}

function pinjam_list(p, u) {
  var um = userMap_();
  var am = {};
  rows_('ASET').forEach(function (a) { am[a.id] = a.nama; });
  var semua = isRole_(u, PENGURUS);
  return rows_('PINJAM').filter(function (x) { return semua || x.user_id === u.id; })
    .sort(function (a, b) { return String(b.dibuat).localeCompare(String(a.dibuat)); })
    .slice(0, 200).map(function (x) {
      return {
        id: x.id, aset: am[x.aset_id] || '(aset dihapus)', aset_id: x.aset_id, peminjam: namaUser_(um, x.user_id),
        no_rumah: um[x.user_id] ? um[x.user_id].no_rumah : '', milik: x.user_id === u.id, jumlah: num_(x.jumlah),
        tgl_pinjam: x.tgl_pinjam, tgl_kembali: x.tgl_kembali, keperluan: x.keperluan, status: x.status,
        catatan: x.catatan, diproses_oleh: x.diproses_oleh, terlambat: x.status === 'disetujui' && String(x.tgl_kembali) < today_()
      };
    });
}

function pinjam_ajukan(p, u) {
  var a = get_('ASET', p.aset_id);
  if (!a) throw new Error('Pilih aset.');
  var jml = num_(p.jumlah);
  if (jml < 1) throw new Error('Jumlah minimal 1.');
  var t1 = str_(p.tgl_pinjam), t2 = str_(p.tgl_kembali);
  cekTanggal_(t1, t2);
  if (t1 < today_()) throw new Error('Tanggal pinjam tidak boleh sebelum hari ini.');
  var tersedia = num_(a.jumlah) - terpakai_(a.id, t1, t2, 'disetujui');
  if (jml > tersedia) throw new Error('Pada ' + tglIndo_(t1) + (t2 !== t1 ? ' s.d. ' + tglIndo_(t2) : '') + ' stok ' + a.nama + ' yang tersedia hanya ' + Math.max(tersedia, 0) + '.');
  return insert_('PINJAM', {
    id: uid_('PJ'), aset_id: a.id, user_id: u.id, jumlah: jml, tgl_pinjam: t1, tgl_kembali: t2,
    keperluan: str_(need_(p.keperluan, 'Keperluan'), 200), status: 'menunggu', catatan: '', diproses_oleh: '', dibuat: now_()
  });
}

function pinjam_proses(p, u) {
  var x = get_('PINJAM', p.id);
  if (!x) throw new Error('Pengajuan tidak ditemukan.');
  var aksi = str_(p.aksi);
  var status;
  if (aksi === 'setujui') {
    if (x.status !== 'menunggu') throw new Error('Pengajuan sudah diproses.');
    var a = get_('ASET', x.aset_id);
    var tersedia = a ? num_(a.jumlah) - terpakai_(a.id, String(x.tgl_pinjam), String(x.tgl_kembali), 'disetujui', x.id) : 0;
    if (num_(x.jumlah) > tersedia) throw new Error('Stok tidak cukup pada tanggal tersebut (tersedia ' + Math.max(tersedia, 0) + ').');
    status = 'disetujui';
  } else if (aksi === 'tolak') {
    if (x.status !== 'menunggu') throw new Error('Pengajuan sudah diproses.');
    status = 'ditolak';
  } else if (aksi === 'kembali') {
    if (x.status !== 'disetujui') throw new Error('Hanya peminjaman yang disetujui yang bisa dikembalikan.');
    status = 'dikembalikan';
  } else throw new Error('Aksi tidak valid.');
  return update_('PINJAM', x.id, { status: status, catatan: str_(p.catatan, 200), diproses_oleh: u.nama });
}

function pinjam_batal(p, u) {
  var x = get_('PINJAM', p.id);
  if (!x || x.user_id !== u.id) throw new Error('Pengajuan tidak ditemukan.');
  if (x.status !== 'menunggu') throw new Error('Pengajuan yang sudah diproses tidak bisa dibatalkan.');
  remove_('PINJAM', x.id);
  return true;
}

/* ============================================================
 *  PENGUMUMAN
 * ============================================================ */
function info_list() {
  return rows_('PENGUMUMAN').slice().sort(function (a, b) { return String(b.tanggal).localeCompare(String(a.tanggal)); })
    .map(function (x) { return { id: x.id, tanggal: x.tanggal, judul: x.judul, isi: x.isi, publik: x.publik, penting: x.penting, penulis: x.penulis }; });
}

function info_simpan(p, u) {
  var o = {
    judul: str_(need_(p.judul, 'Judul'), 120), isi: str_(need_(p.isi, 'Isi'), 3000),
    publik: p.publik === 'ya' ? 'ya' : 'tidak', penting: p.penting === 'ya' ? 'ya' : 'tidak'
  };
  if (p.id) return update_('PENGUMUMAN', p.id, o);
  o.id = uid_('P'); o.tanggal = now_(); o.penulis = u.nama + ' (' + ROLE_LABEL[u.role] + ')';
  return insert_('PENGUMUMAN', o);
}

function info_hapus(p) { remove_('PENGUMUMAN', p.id); return true; }

/* ============================================================
 *  SURAT PENGANTAR (format sesuai template "Surat Pengantar RW")
 * ============================================================ */
/**
 * Bulan IPL yang belum dibayar, dari IPL_MULAI (default: Januari tahun berjalan) s.d. bulan berjalan.
 * Super Admin tidak punya tagihan IPL.
 */
function tunggakanIpl_(u) {
  var cfg = cfg_();
  var kini = today_().slice(0, 7);
  var mulai = /^\d{4}-\d{2}$/.test(str_(cfg.IPL_MULAI)) ? str_(cfg.IPL_MULAI) : kini.slice(0, 4) + '-01';
  var nominal = num_(cfg.NOMINAL_IPL);
  if (u.role === R.SA || mulai > kini) return { periode: [], total: 0, nominal: nominal };
  var lunas = iplPerUnit_()[unitKey_(u)] || {};
  var list = [];
  var y = Number(mulai.slice(0, 4)), m = Number(mulai.slice(5, 7));
  while (true) {
    var per = y + '-' + ('0' + m).slice(-2);
    if (per > kini) break;
    if (!lunas[per]) list.push(per);
    if (++m > 12) { m = 1; y++; }
  }
  return { periode: list, total: list.length * nominal, nominal: nominal };
}

/** Pengajuan surat dikunci bila masih ada tunggakan IPL (pengaturan SYARAT_IPL_SURAT = ya). */
function syaratSurat_(u) {
  var wajib = cfg_().SYARAT_IPL_SURAT === 'ya';
  var tg = wajib ? tunggakanIpl_(u) : { periode: [], total: 0, nominal: 0 };
  var izin = tg.periode.length ? izinAktif_(u.id) : null;
  return {
    wajib: wajib, boleh: tg.periode.length === 0 || !!izin, tunggakan: tg,
    izin: izin ? { alasan: izin.alasan, oleh: izin.diberikan_oleh, sampai: izin.berlaku_sampai } : null
  };
}

/*
 * IZIN DARURAT: Ketua RT / Super Admin dapat membuka blokir pengajuan surat untuk satu warga
 * yang masih menunggak IPL. Izin berlaku untuk 1 kali pengajuan dan kedaluwarsa setelah N hari.
 */
function izinAktif_(uid) {
  var kini = today_();
  return rows_('IZIN_SURAT').filter(function (z) {
    return z.user_id === uid && z.status === 'aktif' && !z.surat_id && String(z.berlaku_sampai) >= kini;
  })[0] || null;
}

function izin_info(p) {
  var w = get_('USERS', p.user_id);
  if (!w) throw new Error('Akun tidak ditemukan.');
  var sy = syaratSurat_(w);
  var riwayat = rows_('IZIN_SURAT').filter(function (z) { return z.user_id === w.id; })
    .sort(function (a, b) { return String(b.dibuat).localeCompare(String(a.dibuat)); }).slice(0, 5)
    .map(function (z) {
      var st = z.status !== 'aktif' ? z.status : (z.surat_id ? 'dipakai' : (String(z.berlaku_sampai) < today_() ? 'kedaluwarsa' : 'aktif'));
      return { id: z.id, alasan: z.alasan, oleh: z.diberikan_oleh, dibuat: z.dibuat, sampai: z.berlaku_sampai, status: st };
    });
  return { nama: w.nama, wajib: sy.wajib, tunggakan: sy.tunggakan, izin: sy.izin, riwayat: riwayat };
}

function izin_buka(p, u) {
  var w = get_('USERS', p.user_id);
  if (!w) throw new Error('Akun tidak ditemukan.');
  if (!tunggakanIpl_(w).periode.length) throw new Error(w.nama + ' tidak memiliki tunggakan IPL, pengajuan surat sudah terbuka.');
  if (izinAktif_(w.id)) throw new Error('Masih ada izin darurat aktif untuk ' + w.nama + '.');
  var alasan = str_(need_(p.alasan, 'Alasan darurat'), 300);
  var hari = Math.min(Math.max(num_(p.hari) || 3, 1), 14);
  var sampai = Utilities.formatDate(new Date(Date.now() + (hari - 1) * 86400000), TZ, 'yyyy-MM-dd');
  insert_('IZIN_SURAT', {
    id: uid_('Z'), user_id: w.id, alasan: alasan, diberikan_oleh: u.nama + ' (' + ROLE_LABEL[u.role] + ')', dibuat: now_(),
    berlaku_sampai: sampai, surat_id: '', status: 'aktif'
  });
  return { pesan: 'Blokir surat ' + w.nama + ' dibuka untuk 1 kali pengajuan s.d. ' + tglIndo_(sampai) + '.' };
}

function izin_cabut(p) {
  var z = izinAktif_(p.user_id);
  if (!z) throw new Error('Tidak ada izin darurat aktif.');
  update_('IZIN_SURAT', z.id, { status: 'dicabut' });
  return true;
}

function surat_opsi(p, u) {
  var kk = u.no_kk ? findBy_('KK', 'no_kk', u.no_kk) : null;
  var anggota = kk ? rows_('ANGGOTA').filter(function (a) { return a.kk_id === kk.id; }).map(function (a) { var v = anggotaView_(a); v.diri = a.user_id === u.id; return v; }) : [];
  return { keperluan: KEPERLUAN_SURAT, profil: safeUser_(u), syarat: syaratSurat_(u), anggota: anggota, punyaKk: !!kk };
}

function suratView_(s, um, u) {
  var pemohon = um[s.user_id];
  return {
    id: s.id, no_surat: s.no_surat, nama: s.nama, nik: bolehLihatNik_(u, s) ? s.nik : samarNik_(s.nik), jk: s.jk,
    tempat_lahir: s.tempat_lahir, tgl_lahir: s.tgl_lahir, kebangsaan: s.kebangsaan, status_kawin: s.status_kawin,
    keperluan: String(s.keperluan || '').split('|').filter(String), keterangan: s.keterangan, status: s.status,
    catatan: s.catatan, dibuat: s.dibuat, diproses_oleh: s.diproses_oleh, tgl_terbit: s.tgl_terbit,
    milik: s.user_id === u.id, pemohon: pemohon ? pemohon.nama : '', no_rumah: pemohon ? pemohon.no_rumah : '',
    gang: pemohon ? pemohon.gang : '', izin: izinSurat_(s.id)
  };
}
function izinSurat_(sid) {
  var z = findBy_('IZIN_SURAT', 'surat_id', sid);
  return z ? { alasan: z.alasan, oleh: z.diberikan_oleh } : null;
}
function bolehLihatNik_(u, s) { return s.user_id === u.id || isRole_(u, ADMIN_LAYANAN); }
function samarNik_(nik) { nik = String(nik || ''); return nik.length > 6 ? nik.slice(0, 4) + '********' + nik.slice(-4) : nik; }

function surat_list(p, u) {
  var um = userMap_();
  return rows_('SURAT').filter(function (s) {
    if (s.user_id === u.id || isRole_(u, ADMIN_LAYANAN)) return true;
    if (u.role === R.KG) { var w = um[s.user_id]; return w && w.gang === u.gang; }
    return false;
  }).sort(function (a, b) { return String(b.dibuat).localeCompare(String(a.dibuat)); })
    .slice(0, 300).map(function (s) { return suratView_(s, um, u); });
}

function surat_ajukan(p, u) {
  var sy = syaratSurat_(u);
  if (!sy.boleh) {
    throw new Error('Pengajuan surat belum bisa dilakukan: masih ada tunggakan IPL ' + sy.tunggakan.periode.length +
      ' bulan (' + sy.tunggakan.periode.map(function (x) { return BULAN[Number(x.slice(5)) - 1].slice(0, 3) + ' ' + x.slice(0, 4); }).join(', ') +
      '). Silakan lunasi ke Bendahara / Koordinator Blok, atau hubungi Ketua RT untuk keperluan darurat.');
  }
  var izinDipakai = sy.tunggakan.periode.length ? izinAktif_(u.id) : null;
  var kep = [].concat(p.keperluan || []).map(String).filter(function (k) { return KEPERLUAN_SURAT.indexOf(k) >= 0; });
  if (!kep.length) throw new Error('Centang minimal satu keperluan surat.');
  var nik = str_(p.nik).replace(/\D/g, '');
  if (nik.length !== 16) throw new Error('No. KTP / NIK harus 16 digit.');
  if (['Laki-laki', 'Perempuan'].indexOf(p.jk) < 0) throw new Error('Pilih jenis kelamin.');
  if (['Belum Kawin', 'Kawin', 'Duda / Janda'].indexOf(p.status_kawin) < 0) throw new Error('Pilih status perkawinan.');
  var tgl = need_(p.tgl_lahir, 'Tanggal lahir');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(tgl)) throw new Error('Format tanggal lahir tidak valid.');
  var s = insert_('SURAT', {
    id: uid_('SP'), no_surat: '', user_id: u.id, nama: str_(need_(p.nama, 'Nama'), 80), jk: p.jk,
    tempat_lahir: str_(need_(p.tempat_lahir, 'Tempat lahir'), 40), tgl_lahir: tgl, nik: nik,
    kebangsaan: str_(p.kebangsaan, 30) || 'Indonesia', status_kawin: p.status_kawin, keperluan: kep.join('|'),
    keterangan: str_(p.keterangan, 400), status: 'menunggu', catatan: '', dibuat: now_(), diproses_oleh: '', tgl_terbit: ''
  });
  if (izinDipakai) update_('IZIN_SURAT', izinDipakai.id, { surat_id: s.id });
  if (p.simpanProfil) simpanDataSurat_(p, u, s);
  return { id: s.id };
}

/** Data dari formulir surat disimpan ke data keluarga (ANGGOTA) dan/atau profil akun. */
function simpanDataSurat_(p, u, s) {
  var data = { nik: s.nik, nama: s.nama, jk: s.jk, tempat_lahir: s.tempat_lahir, tgl_lahir: s.tgl_lahir, kewarganegaraan: s.kebangsaan, status_kawin: s.status_kawin };
  var kk = u.no_kk ? findBy_('KK', 'no_kk', u.no_kk) : null;
  var ag = p.anggota_id ? get_('ANGGOTA', p.anggota_id) : null;
  if (ag && (!kk || ag.kk_id !== kk.id)) ag = null;
  if (!ag && kk) ag = rows_('ANGGOTA').filter(function (a) { return a.kk_id === kk.id && a.nik === s.nik; })[0] || null;
  var diri = !!p.untukDiri || (ag && ag.user_id === u.id) || !kk;
  if (ag) update_('ANGGOTA', ag.id, data);
  else if (kk && !findBy_('ANGGOTA', 'nik', s.nik)) {
    data.id = uid_('AG'); data.kk_id = kk.id; data.hubungan = HUBUNGAN.indexOf(p.hubungan) >= 0 ? p.hubungan : (diri ? 'Kepala Keluarga' : 'Lainnya');
    if (data.hubungan === 'Kepala Keluarga' && rows_('ANGGOTA').some(function (a) { return a.kk_id === kk.id && a.hubungan === 'Kepala Keluarga'; })) data.hubungan = 'Lainnya';
    data.user_id = diri && !findBy_('ANGGOTA', 'user_id', u.id) ? u.id : ''; data.dibuat = now_();
    insert_('ANGGOTA', data);
  }
  if (diri) update_('USERS', u.id, { nik: s.nik, jk: s.jk, tempat_lahir: s.tempat_lahir, tgl_lahir: s.tgl_lahir, kebangsaan: s.kebangsaan, status_kawin: s.status_kawin });
}

function surat_batal(p, u) {
  var s = get_('SURAT', p.id);
  if (!s || s.user_id !== u.id) throw new Error('Surat tidak ditemukan.');
  if (s.status !== 'menunggu') throw new Error('Surat yang sudah diproses tidak bisa dibatalkan.');
  var z = findBy_('IZIN_SURAT', 'surat_id', s.id);
  if (z) update_('IZIN_SURAT', z.id, { surat_id: '' }); // izin darurat dikembalikan bila pengajuan dibatalkan
  remove_('SURAT', s.id);
  return true;
}

/**
 * Nomor: 001/RT.25/RW.05/X/2026
 * - Nomor urut berlanjut sepanjang tahun dan kembali ke 001 di tahun baru.
 * - Bulan (romawi) & tahun mengikuti TANGGAL PENGAJUAN surat, bukan tanggal persetujuan.
 */
function nomorSurat_(cfg, s) {
  var tglAju = String(s.dibuat || today_()).slice(0, 10);
  var th = tglAju.slice(0, 4);
  var maks = 0;
  rows_('SURAT').forEach(function (x) {
    var m = String(x.no_surat || '').match(/^(\d+)\/.*\/(\d{4})$/);
    if (m && m[2] === th) maks = Math.max(maks, Number(m[1]));
  });
  return ('00' + (maks + 1)).slice(-3) + '/RT.' + cfg.RT + '/RW.' + cfg.RW + '/' + ROMAWI[Number(tglAju.slice(5, 7)) - 1] + '/' + th;
}

function surat_proses(p, u) {
  var s = get_('SURAT', p.id);
  if (!s) throw new Error('Surat tidak ditemukan.');
  if (p.aksi === 'setujui') {
    if (s.status !== 'menunggu') throw new Error('Surat sudah diproses.');
    return suratView_(update_('SURAT', s.id, {
      status: 'disetujui', no_surat: nomorSurat_(cfg_(), s), tgl_terbit: today_(), diproses_oleh: u.nama,
      catatan: str_(p.catatan, 200)
    }), userMap_(), u);
  }
  if (p.aksi === 'tolak') {
    if (s.status !== 'menunggu') throw new Error('Surat sudah diproses.');
    var alasan = need_(p.catatan, 'Alasan penolakan');
    return suratView_(update_('SURAT', s.id, { status: 'ditolak', diproses_oleh: u.nama, catatan: str_(alasan, 200) }), userMap_(), u);
  }
  throw new Error('Aksi tidak valid.');
}

/**
 * Dokumen surat: HTML (untuk pratinjau/cetak) + PDF base64 (untuk unduh).
 * Pemohon hanya bisa mengunduh setelah disetujui RT; admin layanan bisa pratinjau kapan saja.
 */
function surat_dokumen(p, u) {
  var s = get_('SURAT', p.id);
  if (!s) throw new Error('Surat tidak ditemukan.');
  var admin = isRole_(u, ADMIN_LAYANAN);
  if (!admin && s.user_id !== u.id) throw new Error('Anda tidak berhak membuka surat ini.');
  if (!admin && s.status !== 'disetujui') throw new Error('Surat belum disetujui Ketua RT.');
  var html = suratHtml_(s, cfg_());
  var nama = 'Surat Pengantar ' + (s.no_surat ? s.no_surat.replace(/\//g, '-') : 'DRAF') + ' - ' + s.nama + '.pdf';
  var pdf = '';
  if (!p.tanpaPdf) {
    var blob = Utilities.newBlob(html, 'text/html', 'surat.html').getAs('application/pdf');
    pdf = Utilities.base64Encode(blob.getBytes());
  }
  return { html: html, pdf: pdf, filename: nama, draf: s.status !== 'disetujui' };
}

function suratHtml_(s, cfg) {
  var kep = String(s.keperluan || '').split('|');
  var box = function (on) {
    return '<td style="width:20pt;height:11pt;border:1px solid #000;text-align:center;font-size:10pt;line-height:11pt;padding:0">' +
      (on ? '&#10004;' : '&nbsp;') + '</td>';
  };
  var opsi = function (label, on) {
    return '<table style="display:inline-table;border-collapse:collapse;margin-right:16pt;vertical-align:middle"><tr>' + box(on) +
      '<td style="padding:0 0 0 6pt;border:0">' + esc_(label) + '</td></tr></table>';
  };
  var baris = function (label, isi) {
    return '<tr><td style="width:115pt;padding:2.4pt 0;vertical-align:top">' + label + '</td><td style="width:12pt;padding:2.4pt 0;vertical-align:top">:</td>' +
      '<td style="padding:2.4pt 0;vertical-align:top">' + isi + '</td></tr>';
  };
  var garis = function (isi) { return '<span style="border-bottom:1px dotted #000;padding:0 4pt">' + isi + '</span>'; };

  var kolom = function (list) {
    return list.map(function (k) {
      var on = kep.indexOf(k) >= 0;
      return '<tr><td style="width:16pt;padding:2.5pt 0;vertical-align:top;font-size:12pt">' + (on ? '&#9673;' : '&#9675;') + '</td>' +
        '<td style="padding:2.5pt 0;vertical-align:top;' + (on ? 'font-weight:bold' : '') + '">' + esc_(k) +
        (on ? ' &nbsp;&#10004;' : '') + '</td></tr>';
    }).join('');
  };
  var kiri = KEPERLUAN_SURAT.slice(0, 7), kanan = KEPERLUAN_SURAT.slice(7);

  var ket = str_(s.keterangan);
  var ketHtml = '';
  var barisKet = ket ? ket.split(/\n/) : [];
  for (var i = 0; i < Math.max(3, barisKet.length); i++) {
    ketHtml += '<div style="border-bottom:1px solid #000;min-height:16pt;line-height:16pt;padding-top:3pt">' + esc_(barisKet[i] || '') + '&nbsp;</div>';
  }

  // Tanggal surat = tanggal warga mengajukan (terisi otomatis saat pengajuan)
  var tglSurat = tglIndo_(String(s.dibuat || today_()).slice(0, 10));
  var noSurat = s.no_surat || '........................ (belum disetujui)';
  var ketuaRt = str_(cfg.NAMA_KETUA_RT) || '..............................';
  var ketuaRw = str_(cfg.NAMA_KETUA_RW) || '..............................';
  var umur = umur_(s.tgl_lahir, String(s.dibuat || today_()).slice(0, 10));
  var draf = s.status !== 'disetujui'
    ? '<div style="position:absolute;top:330pt;left:0;right:0;text-align:center;font-size:72pt;color:#e5e5e5;font-weight:bold;transform:rotate(-25deg)">DRAF</div>'
    : '';

  return '<!DOCTYPE html><html><head><meta charset="utf-8"><title>Surat Pengantar</title><style>' +
    '@page{size:' + ukuranKertas_(cfg, false) + ';margin:30pt 42pt 30pt 42pt}' +
    'body{font-family:Arial,Helvetica,sans-serif;font-size:11.5pt;color:#000;margin:0;position:relative}' +
    'table{border-collapse:collapse}td{font-size:11.5pt}' +
    '</style></head><body>' + draf +
    // KOP SURAT
    '<table style="width:100%"><tr>' +
    '<td style="width:84pt;vertical-align:middle;text-align:left"><img src="' + logoSrc_(cfg) + '" style="width:80pt;height:auto"></td>' +
    '<td style="text-align:center;vertical-align:middle;padding-right:40pt">' +
    '<div style="font-size:15pt;line-height:19pt">PEMERINTAH ' + esc_(String(cfg.SEBUTAN_KAB || 'Kabupaten').toUpperCase()) + ' ' + esc_(String(cfg.KABUPATEN).toUpperCase()) + '</div>' +
    '<div style="font-size:15pt;line-height:19pt">' + esc_(String(cfg.SEBUTAN_DESA || 'Desa').toUpperCase()) + ' ' + esc_(String(cfg.DESA).toUpperCase()) + ' &ndash; KECAMATAN ' + esc_(String(cfg.KECAMATAN).toUpperCase()) + '</div>' +
    '<div style="font-size:18pt;line-height:23pt;font-weight:bold">RUKUN TETANGGA ' + esc_(cfg.RT) + ' &ndash; RUKUN WARGA ' + esc_(cfg.RW) + '</div>' +
    '<div style="font-size:13pt;line-height:17pt">' + esc_(String(cfg.PERUMAHAN).toUpperCase()) + '</div>' +
    '</td></tr></table>' +
    '<div style="border-top:3px solid #000;margin-top:5pt"></div><div style="border-top:1px solid #000;margin-top:2pt"></div>' +
    // JUDUL
    '<div style="text-align:center;font-size:14pt;font-weight:bold;text-decoration:underline;margin-top:12pt">SURAT PENGANTAR</div>' +
    '<div style="text-align:center;margin-top:2pt">No. : ' + esc_(noSurat) + '</div>' +
    '<p style="margin:14pt 0 6pt">Diberikan kepada warga yang tersebut dibawah ini :</p>' +
    // DATA
    '<table style="width:100%">' +
    baris('Nama', '<b>' + esc_(s.nama) + '</b>') +
    baris('Jenis Kelamin', opsi('Laki-laki', s.jk === 'Laki-laki') + opsi('Perempuan', s.jk === 'Perempuan')) +
    baris('Umur', garis(esc_(umur)) + ' Tahun') +
    baris('Tmpt/Tgl. Lahir', esc_(s.tempat_lahir) + ', ' + esc_(tglIndo_(s.tgl_lahir))) +
    baris('No. KTP', esc_(s.nik)) +
    baris('Kebangsaan', esc_(s.kebangsaan)) +
    baris('Status', opsi('Belum Kawin', s.status_kawin === 'Belum Kawin') + opsi('Kawin', s.status_kawin === 'Kawin') +
      opsi('Duda / Janda', s.status_kawin === 'Duda / Janda')) +
    '</table>' +
    // KEPERLUAN
    '<p style="margin:12pt 0 4pt">Bermaksud memohon surat pengantar / laporan perihal :</p>' +
    '<table style="width:100%"><tr>' +
    '<td style="width:50%;vertical-align:top;padding:0"><table style="width:100%">' + kolom(kiri) + '</table></td>' +
    '<td style="width:50%;vertical-align:top;padding:0"><table style="width:100%">' + kolom(kanan) + '</table></td>' +
    '</tr></table>' +
    '<p style="margin:4pt 0 0;font-size:9.5pt">* Centang ( &#10004; ) pada bagian yang dituju</p>' +
    '<p style="margin:10pt 0 0">Keterangan lain-lain :</p>' + ketHtml +
    // TANDA TANGAN
    // Satu blok utuh (tidak boleh terbelah ke halaman berikutnya)
    '<table style="width:100%;margin-top:14pt;page-break-inside:avoid;break-inside:avoid"><tr>' +
    '<td style="width:50%;vertical-align:top"></td>' +
    '<td style="width:50%;vertical-align:top;text-align:center">' + esc_(cfg.TEMPAT_SURAT) + ', ' + tglSurat + '<br>Yang Bersangkutan,<br><br><br><br>' +
    '( <b>' + esc_(s.nama) + '</b> )</td></tr>' +
    '<tr><td colspan="2" style="text-align:center;padding-top:10pt">Mengetahui,</td></tr>' +
    '<tr><td style="width:50%;text-align:center;vertical-align:top;padding-top:2pt">Ketua Rukun Warga ' + esc_(cfg.RW) + '<br><br><br><br><br>' +
    '( <b><u>' + esc_(ketuaRw) + '</u></b> )</td>' +
    '<td style="width:50%;text-align:center;vertical-align:top;padding-top:2pt">Ketua RT ' + esc_(cfg.RT) + '<br><br><br><br><br>' +
    '( <b><u>' + esc_(ketuaRt) + '</u></b> )</td>' +
    '</tr></table>' +
    '</body></html>';
}

/* ============================================================
 *  LAPORAN WARGA (aduan)
 * ============================================================ */
function lapor_list(p, u) {
  var um = userMap_();
  return rows_('LAPORAN').filter(function (x) {
    if (x.user_id === u.id || isRole_(u, ADMIN_LAYANAN)) return true;
    if (u.role === R.KG) { var w = um[x.user_id]; return w && w.gang === u.gang; }
    return false;
  }).sort(function (a, b) { return String(b.dibuat).localeCompare(String(a.dibuat)); }).slice(0, 300)
    .map(function (x) {
      var w = um[x.user_id];
      return {
        id: x.id, kategori: x.kategori, judul: x.judul, isi: x.isi, lokasi: x.lokasi, status: x.status,
        tanggapan: x.tanggapan, penanggap: x.penanggap, dibuat: x.dibuat, diperbarui: x.diperbarui,
        pelapor: w ? w.nama : '', no_rumah: w ? w.no_rumah : '', gang: w ? w.gang : '', milik: x.user_id === u.id
      };
    });
}

function lapor_buat(p, u) {
  var kat = ['Kebersihan', 'Keamanan', 'Infrastruktur', 'Penerangan', 'Sosial', 'Lainnya'];
  return insert_('LAPORAN', {
    id: uid_('L'), user_id: u.id, kategori: kat.indexOf(p.kategori) >= 0 ? p.kategori : 'Lainnya',
    judul: str_(need_(p.judul, 'Judul'), 120), isi: str_(need_(p.isi, 'Isi laporan'), 2000), lokasi: str_(p.lokasi, 120),
    status: 'baru', tanggapan: '', penanggap: '', dibuat: now_(), diperbarui: now_()
  });
}

function lapor_tanggapi(p, u) {
  var st = ['baru', 'diproses', 'selesai'];
  if (st.indexOf(p.status) < 0) throw new Error('Status tidak valid.');
  return update_('LAPORAN', p.id, { status: p.status, tanggapan: str_(p.tanggapan, 1000), penanggap: u.nama, diperbarui: now_() });
}

/* ============================================================
 *  e-VOTE KETUA RT
 *  - 1 rumah = 1 suara (dicatat di VOTE_PEMILIH berdasarkan no_rumah).
 *  - Pilihan disimpan HANYA sebagai penghitung di VOTE_HASIL, terpisah dari daftar pemilih,
 *    sehingga tidak ada data yang menghubungkan rumah dengan kandidat yang dipilih.
 *  - Hasil terlihat oleh semua setelah sesi ditutup; Super Admin bisa memantau langsung.
 * ============================================================ */
/** Kunci hak suara: 1 KK = 1 suara (akun tanpa KK memakai No. Rumah). */
/** Hak suara e-Vote: hanya warga yang No. KK-nya sudah terdaftar di Data Keluarga (1 KK = 1 suara). */
function kunciSuara_(u, kkAda) {
  kkAda = kkAda || kkTerdaftar_();
  var nk = str_(u.no_kk);
  return nk && kkAda[nk] ? 'KK' + nk : '';
}
function kkTerdaftar_() {
  var o = {};
  rows_('KK').forEach(function (k) { if (str_(k.no_kk)) o[str_(k.no_kk)] = 1; });
  return o;
}

function vote_list(p, u) {
  var kkAda = kkTerdaftar_();
  var rumah = kunciSuara_(u, kkAda);
  var totalRumah = {};
  rows_('USERS').forEach(function (x) { var kx = kunciSuara_(x, kkAda); if (x.status === 'aktif' && x.role !== R.SA && kx) totalRumah[kx] = 1; });
  var nRumah = Object.keys(totalRumah).length;
  return rows_('VOTE_SESI').filter(function (s) { return s.status !== 'draf' || u.role === R.SA; })
    .sort(function (a, b) { return String(b.dibuat).localeCompare(String(a.dibuat)); })
    .map(function (s) {
      var pemilih = rows_('VOTE_PEMILIH').filter(function (v) { return v.sesi_id === s.id; });
      var lihatHasil = s.status === 'tutup' || u.role === R.SA;
      var hasil = {};
      if (lihatHasil) rows_('VOTE_HASIL').forEach(function (h) { if (h.sesi_id === s.id) hasil[h.kandidat_id] = num_(h.jumlah); });
      return {
        id: s.id, judul: s.judul, keterangan: s.keterangan, status: s.status, dibuat: s.dibuat,
        sudahMemilih: !!rumah && pemilih.some(function (v) { return v.no_rumah === rumah; }),
        bisaMemilih: !!rumah, partisipasi: pemilih.length, totalRumah: nRumah, lihatHasil: lihatHasil,
        kandidat: rows_('VOTE_KANDIDAT').filter(function (k) { return k.sesi_id === s.id; })
          .sort(function (a, b) { return num_(a.no_urut) - num_(b.no_urut); })
          .map(function (k) { return { id: k.id, no_urut: num_(k.no_urut), nama: k.nama, visi_misi: k.visi_misi, foto: k.foto || '', suara: lihatHasil ? (hasil[k.id] || 0) : null }; })
      };
    });
}

function vote_pilih(p, u) {
  var s = get_('VOTE_SESI', p.sesi_id);
  if (!s || s.status !== 'buka') throw new Error('Pemungutan suara tidak sedang dibuka.');
  var k = get_('VOTE_KANDIDAT', p.kandidat_id);
  if (!k || k.sesi_id !== s.id) throw new Error('Kandidat tidak valid.');
  var rumah = kunciSuara_(u);
  if (!rumah) throw new Error('Anda belum memiliki hak suara karena No. KK belum terdaftar di Data Keluarga. Daftarkan KK di menu Data Keluarga atau hubungi pengurus.');
  var sudah = rows_('VOTE_PEMILIH').some(function (v) { return v.sesi_id === s.id && v.no_rumah === rumah; });
  if (sudah) throw new Error('Keluarga (KK) Anda sudah menggunakan hak suara.');
  insert_('VOTE_PEMILIH', { id: s.id + '|' + rumah, sesi_id: s.id, no_rumah: rumah, waktu: today_() });
  var hid = s.id + '|' + k.id;
  var h = get_('VOTE_HASIL', hid);
  if (h) update_('VOTE_HASIL', hid, { jumlah: num_(h.jumlah) + 1 });
  else insert_('VOTE_HASIL', { id: hid, sesi_id: s.id, kandidat_id: k.id, jumlah: 1 });
  return true;
}

function vote_sesiSimpan(p) {
  var st = ['draf', 'buka', 'tutup'];
  var o = { judul: str_(need_(p.judul, 'Judul'), 120), keterangan: str_(p.keterangan, 500), status: st.indexOf(p.status) >= 0 ? p.status : 'draf' };
  if (p.id) {
    var lama = get_('VOTE_SESI', p.id);
    if (lama && lama.status === 'tutup' && o.status !== 'tutup') throw new Error('Sesi yang sudah ditutup tidak bisa dibuka lagi.');
    if (o.status === 'buka' && !rows_('VOTE_KANDIDAT').some(function (k) { return k.sesi_id === p.id; })) throw new Error('Tambahkan kandidat dulu.');
    return update_('VOTE_SESI', p.id, o);
  }
  if (o.status === 'buka') o.status = 'draf';
  o.id = uid_('V'); o.dibuat = now_();
  return insert_('VOTE_SESI', o);
}

function vote_sesiHapus(p) {
  var s = get_('VOTE_SESI', p.id);
  if (!s) return true;
  if (s.status !== 'draf') throw new Error('Hanya sesi berstatus draf yang bisa dihapus.');
  rows_('VOTE_KANDIDAT').filter(function (k) { return k.sesi_id === s.id; }).forEach(function (k) { remove_('VOTE_KANDIDAT', k.id); });
  remove_('VOTE_SESI', s.id);
  return true;
}

function vote_kandidatSimpan(p) {
  var s = get_('VOTE_SESI', p.sesi_id);
  if (!s) throw new Error('Sesi tidak ditemukan.');
  if (s.status !== 'draf') {
    // Selama pemilihan berjalan, hanya visi & misi calon yang boleh dilengkapi (nama/nomor/foto tetap terkunci)
    if (s.status !== 'buka' || !p.id || !p.hanyaVisi) throw new Error('Kandidat hanya bisa diubah saat sesi masih draf. Saat pemilihan dibuka, hanya visi & misi yang bisa dilengkapi.');
    var kd = get_('VOTE_KANDIDAT', p.id);
    if (!kd || kd.sesi_id !== s.id) throw new Error('Kandidat tidak ditemukan.');
    return update_('VOTE_KANDIDAT', kd.id, { visi_misi: str_(p.visi_misi, 1500) });
  }
  var o = { sesi_id: s.id, no_urut: num_(p.no_urut) || 1, nama: str_(need_(p.nama, 'Nama kandidat'), 80), visi_misi: str_(p.visi_misi, 1500) };
  if (p.foto !== undefined) o.foto = foto_(p.foto);
  if (p.id) return update_('VOTE_KANDIDAT', p.id, o);
  o.id = uid_('C');
  return insert_('VOTE_KANDIDAT', o);
}

function vote_kandidatHapus(p) {
  var k = get_('VOTE_KANDIDAT', p.id);
  if (!k) return true;
  var s = get_('VOTE_SESI', k.sesi_id);
  if (s && s.status !== 'draf') throw new Error('Kandidat hanya bisa dihapus saat sesi masih draf.');
  remove_('VOTE_KANDIDAT', k.id);
  return true;
}

/* ============================================================
 *  DISKUSI WARGA
 * ============================================================ */
function forum_list(p, u) {
  var um = userMap_();
  return rows_('DISKUSI').slice().sort(function (a, b) { return String(b.aktivitas).localeCompare(String(a.aktivitas)); })
    .slice(0, 100).map(function (t) {
      var w = um[t.user_id];
      return {
        id: t.id, judul: t.judul, ringkas: String(t.isi).slice(0, 160), dibuat: t.dibuat, aktivitas: t.aktivitas,
        balasan: num_(t.jumlah_balasan), penulis: w ? w.nama : '(akun dihapus)', jabatan: w ? ROLE_LABEL[w.role] : '',
        bisaHapus: t.user_id === u.id || isRole_(u, MOD_FORUM)
      };
    });
}

function forum_detail(p, u) {
  var t = get_('DISKUSI', p.id);
  if (!t) throw new Error('Topik tidak ditemukan (mungkin sudah dihapus).');
  var um = userMap_();
  var orang = function (id) { var w = um[id]; return { penulis: w ? w.nama : '(akun dihapus)', jabatan: w ? ROLE_LABEL[w.role] : '', gang: w ? w.gang : '' }; };
  var topik = orang(t.user_id);
  topik.id = t.id; topik.judul = t.judul; topik.isi = t.isi; topik.dibuat = t.dibuat;
  topik.bisaHapus = t.user_id === u.id || isRole_(u, MOD_FORUM);
  return {
    topik: topik,
    balasan: rows_('BALASAN').filter(function (b) { return b.topik_id === t.id; })
      .sort(function (a, b) { return String(a.dibuat).localeCompare(String(b.dibuat)); })
      .map(function (b) {
        var o = orang(b.user_id);
        o.id = b.id; o.isi = b.isi; o.dibuat = b.dibuat; o.bisaHapus = b.user_id === u.id || isRole_(u, MOD_FORUM);
        return o;
      })
  };
}

function forum_buat(p, u) {
  var t = insert_('DISKUSI', {
    id: uid_('D'), user_id: u.id, judul: str_(need_(p.judul, 'Judul'), 120), isi: str_(need_(p.isi, 'Isi'), 3000),
    dibuat: now_(), aktivitas: now_(), jumlah_balasan: 0
  });
  return { id: t.id };
}

function forum_balas(p, u) {
  var t = get_('DISKUSI', p.topik_id);
  if (!t) throw new Error('Topik tidak ditemukan.');
  insert_('BALASAN', { id: uid_('B'), topik_id: t.id, user_id: u.id, isi: str_(need_(p.isi, 'Balasan'), 2000), dibuat: now_() });
  update_('DISKUSI', t.id, { aktivitas: now_(), jumlah_balasan: num_(t.jumlah_balasan) + 1 });
  return true;
}

function forum_hapus(p, u) {
  var tabel = p.tipe === 'balasan' ? 'BALASAN' : 'DISKUSI';
  var x = get_(tabel, p.id);
  if (!x) return true;
  if (x.user_id !== u.id && !isRole_(u, MOD_FORUM)) throw new Error('Anda tidak berhak menghapus ini.');
  if (tabel === 'DISKUSI') {
    rows_('BALASAN').filter(function (b) { return b.topik_id === x.id; }).reverse().forEach(function (b) { remove_('BALASAN', b.id); });
  } else {
    var t = get_('DISKUSI', x.topik_id);
    if (t) update_('DISKUSI', t.id, { jumlah_balasan: Math.max(num_(t.jumlah_balasan) - 1, 0) });
  }
  remove_(tabel, x.id);
  return true;
}

/* ============================================================
 *  MANAJEMEN AKUN & PENGATURAN
 * ============================================================ */
/* ============================================================
 *  DATA KELUARGA (Kartu Keluarga)
 *  KK (1 baris per No. KK) → ANGGOTA (anggota keluarga, kolom mengikuti KK Dukcapil).
 *  Akun warga terhubung ke KK lewat USERS.no_kk; semua akun dengan No. KK sama = satu keluarga/rumah.
 * ============================================================ */
var HUBUNGAN = ['Kepala Keluarga', 'Suami', 'Istri', 'Anak', 'Menantu', 'Cucu', 'Orang Tua', 'Mertua', 'Famili Lain', 'Pembantu', 'Lainnya'];
var AGAMA = ['Islam', 'Kristen', 'Katolik', 'Hindu', 'Buddha', 'Konghucu', 'Kepercayaan'];
var PENDIDIKAN = ['Tidak/Belum Sekolah', 'Belum Tamat SD/Sederajat', 'Tamat SD/Sederajat', 'SLTP/Sederajat', 'SLTA/Sederajat',
  'Diploma I/II', 'Akademi/Diploma III/S. Muda', 'Diploma IV/Strata I', 'Strata II', 'Strata III'];
var STATUS_TINGGAL = ['Tetap', 'Kontrak', 'Kos', 'Lainnya'];

function normKk_(v) { return String(v === null || v === undefined ? '' : v).replace(/\D/g, ''); }
function kkBaru_(no, kepala, rumah, gang) {
  return insert_('KK', { id: uid_('KK'), no_kk: no, kepala: str_(kepala, 80), no_rumah: normRumah_(rumah), gang: str_(gang), alamat: '', status_tinggal: 'Tetap', dibuat: now_(), diperbarui: now_() });
}
function milikKk_(u, kk) { return !!u.no_kk && kk.no_kk === u.no_kk; }
function bolehLihatKk_(u, kk) {
  if (milikKk_(u, kk) || isRole_(u, [R.SA, R.KT, R.SK, R.BD])) return true;
  return u.role === R.KG && kk.gang === u.gang;
}
function bolehUbahKk_(u, kk) { return milikKk_(u, kk) || isRole_(u, ADMIN_WARGA); }
function anggotaView_(a) {
  return {
    id: a.id, kk_id: a.kk_id, nik: a.nik, nama: a.nama, hubungan: a.hubungan, jk: a.jk, tempat_lahir: a.tempat_lahir, tgl_lahir: a.tgl_lahir,
    agama: a.agama, pendidikan: a.pendidikan, pekerjaan: a.pekerjaan, gol_darah: a.gol_darah, status_kawin: a.status_kawin,
    kewarganegaraan: a.kewarganegaraan, nama_ayah: a.nama_ayah, nama_ibu: a.nama_ibu, punyaAkun: !!a.user_id, umur: umur_(a.tgl_lahir)
  };
}
function kkView_(kk, u, lengkap) {
  var penuh = milikKk_(u, kk) || isRole_(u, ADMIN_LAYANAN);
  var urut = function (a) { var i = HUBUNGAN.indexOf(a.hubungan); return (i < 0 ? 99 : i) * 1000 + (Number(String(a.tgl_lahir).slice(0, 4)) || 9999) % 1000; };
  var ang = rows_('ANGGOTA').filter(function (a) { return a.kk_id === kk.id; }).sort(function (a, b) { return urut(a) - urut(b); });
  var akun = rows_('USERS').filter(function (x) { return x.no_kk && x.no_kk === kk.no_kk; });
  var o = {
    id: kk.id, no_kk: penuh ? kk.no_kk : samarNik_(kk.no_kk), kepala: kk.kepala, no_rumah: kk.no_rumah, gang: kk.gang, alamat: kk.alamat,
    status_tinggal: kk.status_tinggal, jumlahAnggota: ang.length, jumlahAkun: akun.length, milik: milikKk_(u, kk), bisaUbah: bolehUbahKk_(u, kk),
    diperbarui: kk.diperbarui
  };
  if (lengkap) {
    o.anggota = ang.map(function (a) { var v = anggotaView_(a); if (!penuh) v.nik = samarNik_(v.nik); return v; });
    o.akun = akun.map(function (x) { return { id: x.id, nama: x.nama, no_hp: penuh ? x.no_hp : '', role_label: ROLE_LABEL[x.role] }; });
  }
  return o;
}
function opsiKk_() { return { hubungan: HUBUNGAN, agama: AGAMA, pendidikan: PENDIDIKAN, status_tinggal: STATUS_TINGGAL, gang: gangList_(cfg_()) }; }

function kk_saya(p, u) {
  var kk = u.no_kk ? findBy_('KK', 'no_kk', u.no_kk) : null;
  return { kk: kk ? kkView_(kk, u, true) : null, opsi: opsiKk_(), profil: safeUser_(u) };
}

function kk_list(p, u) {
  var gang = u.role === R.KG ? u.gang : str_(p.gang);
  var list = rows_('KK').filter(function (k) { return (!gang || k.gang === gang) && bolehLihatKk_(u, k); })
    .map(function (k) { return kkView_(k, u, false); })
    .sort(function (a, b) { return (a.gang + a.no_rumah).localeCompare(b.gang + b.no_rumah); });
  var tanpaKk = rows_('USERS').filter(function (x) { return x.status === 'aktif' && x.role !== R.SA && !x.no_kk && (!gang || x.gang === gang); })
    .map(function (x) { return { id: x.id, nama: x.nama, gang: x.gang, no_rumah: x.no_rumah }; });
  var jiwa = list.reduce(function (n, k) { return n + k.jumlahAnggota; }, 0);
  return { list: list, tanpaKk: tanpaKk, jiwa: jiwa, opsi: opsiKk_() };
}

function kk_detail(p, u) {
  var kk = get_('KK', p.id);
  if (!kk) throw new Error('Data KK tidak ditemukan.');
  if (!bolehLihatKk_(u, kk)) throw new Error('Anda tidak berhak melihat KK ini.');
  return kkView_(kk, u, true);
}

function kk_simpan(p, u) {
  var admin = isRole_(u, ADMIN_WARGA);
  var no = normKk_(p.no_kk);
  if (no.length !== 16) throw new Error('No. KK harus 16 digit.');
  var gang = str_(p.gang);
  if (gangList_(cfg_()).indexOf(gang) < 0) throw new Error('Pilih blok.');
  var o = {
    kepala: str_(need_(p.kepala, 'Nama kepala keluarga'), 80), no_rumah: normRumah_(need_(p.no_rumah, 'No. rumah')), gang: gang,
    alamat: str_(p.alamat, 200), status_tinggal: STATUS_TINGGAL.indexOf(p.status_tinggal) >= 0 ? p.status_tinggal : 'Tetap', diperbarui: now_()
  };
  var lain = findBy_('KK', 'no_kk', no);
  var kk;
  if (p.id) {
    kk = get_('KK', p.id);
    if (!kk) throw new Error('Data KK tidak ditemukan.');
    if (!bolehUbahKk_(u, kk)) throw new Error('Anda tidak berhak mengubah KK ini.');
    if (no !== kk.no_kk) {
      if (!admin) throw new Error('No. KK hanya dapat diubah oleh pengurus.');
      if (lain) throw new Error('No. KK ' + no + ' sudah terdaftar.');
      o.no_kk = no;
      rows_('USERS').filter(function (x) { return x.no_kk === kk.no_kk; }).forEach(function (x) { update_('USERS', x.id, { no_kk: no }); });
      rows_('IPL').filter(function (i) { return i.no_kk === kk.no_kk; }).forEach(function (i) { update_('IPL', i.id, { no_kk: no }); });
    }
    kk = update_('KK', kk.id, o);
  } else {
    if (lain) throw new Error('No. KK ' + no + ' sudah terdaftar' + (admin ? '.' : '. Minta pengurus RT menghubungkan akun Anda ke KK tersebut.'));
    if (!admin && u.no_kk) throw new Error('Akun Anda sudah terhubung ke KK lain.');
    o.id = uid_('KK'); o.no_kk = no; o.dibuat = now_();
    kk = insert_('KK', o);
    if (!admin || p.hubungkanSaya) {
      update_('USERS', u.id, { no_kk: no });
      if (!findBy_('ANGGOTA', 'user_id', u.id) && !(u.nik && findBy_('ANGGOTA', 'nik', u.nik))) {
        insert_('ANGGOTA', {
          id: uid_('AG'), kk_id: kk.id, nik: u.nik || '', nama: u.nama, hubungan: HUBUNGAN.indexOf(p.hubungan_saya) >= 0 ? p.hubungan_saya : 'Kepala Keluarga',
          jk: u.jk, tempat_lahir: u.tempat_lahir, tgl_lahir: u.tgl_lahir, status_kawin: u.status_kawin, pekerjaan: u.pekerjaan,
          kewarganegaraan: u.kebangsaan || 'Indonesia', user_id: u.id, dibuat: now_()
        });
      }
    }
  }
  // akun dalam KK ini mengikuti gang & no. rumah KK
  rows_('USERS').filter(function (x) { return x.no_kk === kk.no_kk; }).forEach(function (x) {
    if (x.gang !== kk.gang || x.no_rumah !== kk.no_rumah) update_('USERS', x.id, { gang: kk.gang, no_rumah: kk.no_rumah });
  });
  return kkView_(get_('KK', kk.id), get_('USERS', u.id), true);
}

function kk_hapus(p) {
  var kk = get_('KK', p.id);
  if (!kk) return true;
  rows_('ANGGOTA').filter(function (a) { return a.kk_id === kk.id; }).reverse().forEach(function (a) { remove_('ANGGOTA', a.id); });
  rows_('USERS').filter(function (x) { return x.no_kk === kk.no_kk; }).forEach(function (x) { update_('USERS', x.id, { no_kk: '' }); });
  remove_('KK', kk.id);
  return true;
}

function tglImpor_(v) {
  v = str_(v);
  var m = v.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return m[1] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[3]).slice(-2);
  m = v.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
  if (m) return m[3] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[1]).slice(-2);
  return '';
}
function pilih_(list, v) {
  v = str_(v).toLowerCase();
  if (!v) return '';
  return list.filter(function (x) { return x.toLowerCase() === v; })[0] || list.filter(function (x) { return x.toLowerCase().indexOf(v) === 0; })[0] || '';
}
function dataAnggota_(p) {
  var o = {
    nik: normKk_(p.nik), nama: str_(need_(p.nama, 'Nama'), 80), hubungan: pilih_(HUBUNGAN, p.hubungan) || 'Lainnya',
    jk: /^p/i.test(str_(p.jk)) ? 'Perempuan' : (/^l/i.test(str_(p.jk)) ? 'Laki-laki' : ''), tempat_lahir: str_(p.tempat_lahir, 40),
    tgl_lahir: tglImpor_(p.tgl_lahir), agama: pilih_(AGAMA, p.agama), pendidikan: pilih_(PENDIDIKAN, p.pendidikan) || str_(p.pendidikan, 40),
    pekerjaan: str_(p.pekerjaan, 40), gol_darah: str_(p.gol_darah, 3).toUpperCase(),
    status_kawin: pilih_(['Belum Kawin', 'Kawin', 'Cerai Hidup', 'Cerai Mati', 'Duda / Janda'], p.status_kawin) || str_(p.status_kawin, 20),
    kewarganegaraan: str_(p.kewarganegaraan, 20) || 'WNI', nama_ayah: str_(p.nama_ayah, 80), nama_ibu: str_(p.nama_ibu, 80)
  };
  if (o.nik && o.nik.length !== 16) throw new Error('NIK harus 16 digit.');
  return o;
}

function anggota_simpan(p, u) {
  var kk = get_('KK', p.kk_id);
  if (!kk) throw new Error('Data KK tidak ditemukan.');
  if (!bolehUbahKk_(u, kk)) throw new Error('Anda tidak berhak mengubah KK ini.');
  var o = dataAnggota_(p);
  if (!o.nik) throw new Error('NIK wajib diisi.');
  var dobel = rows_('ANGGOTA').filter(function (a) { return a.nik === o.nik && a.id !== p.id; })[0];
  if (dobel) throw new Error('NIK ' + o.nik + ' sudah terdaftar' + (dobel.kk_id === kk.id ? ' di KK ini.' : ' di KK lain.'));
  if (o.hubungan === 'Kepala Keluarga') {
    var kep = rows_('ANGGOTA').filter(function (a) { return a.kk_id === kk.id && a.hubungan === 'Kepala Keluarga' && a.id !== p.id; })[0];
    if (kep) throw new Error(kep.nama + ' sudah tercatat sebagai Kepala Keluarga.');
  }
  var ag;
  if (p.id) {
    ag = get_('ANGGOTA', p.id);
    if (!ag || ag.kk_id !== kk.id) throw new Error('Anggota tidak ditemukan.');
    ag = update_('ANGGOTA', ag.id, o);
  } else {
    o.id = uid_('AG'); o.kk_id = kk.id; o.user_id = ''; o.dibuat = now_();
    ag = insert_('ANGGOTA', o);
  }
  if (o.hubungan === 'Kepala Keluarga' && kk.kepala !== o.nama) update_('KK', kk.id, { kepala: o.nama, diperbarui: now_() });
  else update_('KK', kk.id, { diperbarui: now_() });
  if (ag.user_id) update_('USERS', ag.user_id, { nik: o.nik, jk: o.jk, tempat_lahir: o.tempat_lahir, tgl_lahir: o.tgl_lahir, status_kawin: o.status_kawin, pekerjaan: o.pekerjaan });
  return anggotaView_(get_('ANGGOTA', ag.id));
}

function anggota_hapus(p, u) {
  var ag = get_('ANGGOTA', p.id);
  if (!ag) return true;
  var kk = get_('KK', ag.kk_id);
  if (kk && !bolehUbahKk_(u, kk)) throw new Error('Anda tidak berhak mengubah KK ini.');
  remove_('ANGGOTA', ag.id);
  return true;
}

/**
 * Impor data KK + anggota (1 baris = 1 orang). Kolom: no_kk, nik, nama, hubungan, jk, tempat_lahir, tgl_lahir, agama,
 * pendidikan, pekerjaan, status_kawin, gol_darah, nama_ayah, nama_ibu, gang, no_rumah, alamat, no_hp (opsional, untuk menautkan akun).
 */
function kk_import(p, u) {
  var rows = [].concat(p.rows || []);
  if (!rows.length) throw new Error('Tidak ada data untuk diimpor.');
  if (rows.length > 1000) throw new Error('Maksimal 1000 baris per impor.');
  var gangAda = gangList_(cfg_());
  var nikAda = {};
  rows_('ANGGOTA').forEach(function (a) { if (a.nik) nikAda[a.nik] = 1; });
  var hpAkun = {};
  rows_('USERS').forEach(function (x) { hpAkun[normHp_(x.no_hp)] = x; });
  var kkBaruMap = {}, kkInfo = {}, hasil = [], agBaru = [], tautan = [];
  rows.forEach(function (r) { var no = normKk_(r.no_kk); if (no && !kkInfo[no]) kkInfo[no] = {}; var inf = kkInfo[no]; if (!inf) return;
    if (!inf.gang && r.gang) inf.gang = str_(r.gang); if (!inf.no_rumah && r.no_rumah) inf.no_rumah = r.no_rumah; if (!inf.alamat && r.alamat) inf.alamat = r.alamat;
    if (/^kepala/i.test(str_(r.hubungan)) && !inf.kepala) inf.kepala = str_(r.nama, 80); if (!inf.pertama) inf.pertama = str_(r.nama, 80); });
  rows.forEach(function (r, i) {
    var res = { baris: i + 1, no_kk: normKk_(r.no_kk), nik: normKk_(r.nik), nama: str_(r.nama, 80), hubungan: pilih_(HUBUNGAN, r.hubungan) || 'Lainnya' };
    try {
      if (res.no_kk.length !== 16) throw new Error('No. KK harus 16 digit');
      if (!res.nama) throw new Error('Nama kosong');
      if (res.nik.length !== 16) throw new Error('NIK harus 16 digit');
      if (nikAda[res.nik]) throw new Error('NIK sudah terdaftar');
      var kk = findBy_('KK', 'no_kk', res.no_kk) || kkBaruMap[res.no_kk];
      if (!kk) {
        var inf = kkInfo[res.no_kk];
        var g = gangAda.filter(function (x) { return x.toLowerCase() === str_(inf.gang).toLowerCase(); })[0];
        if (!g) throw new Error(inf.gang ? 'Blok "' + inf.gang + '" belum terdaftar' : 'Blok kosong (isi di salah satu baris KK ini)');
        if (!inf.no_rumah) throw new Error('No. rumah kosong (isi di salah satu baris KK ini)');
        kk = { id: uid_('KK'), no_kk: res.no_kk, kepala: inf.kepala || inf.pertama, no_rumah: normRumah_(inf.no_rumah), gang: g, alamat: str_(inf.alamat, 200),
          status_tinggal: 'Tetap', dibuat: now_(), diperbarui: now_(), _baru: true };
        kkBaruMap[res.no_kk] = kk;
      }
      res.kkBaru = !!kk._baru;
      var o = dataAnggota_(r);
      o.id = uid_('AG'); o.kk_id = kk.id; o.dibuat = now_(); o.user_id = '';
      var akun = r.no_hp ? hpAkun[hpImpor_(r.no_hp)] : null;
      if (akun) { o.user_id = akun.id; tautan.push({ id: akun.id, no_kk: kk.no_kk, gang: kk.gang, no_rumah: kk.no_rumah }); res.akun = akun.nama; }
      nikAda[res.nik] = 1;
      agBaru.push(o);
      res.status = 'ok';
    } catch (e) { res.status = 'gagal'; res.pesan = e.message; }
    hasil.push(res);
  });
  var kkList = Object.keys(kkBaruMap).map(function (k) { var x = kkBaruMap[k]; delete x._baru; return x; });
  if (!p.cekSaja) {
    insertMany_('KK', kkList);
    insertMany_('ANGGOTA', agBaru);
    tautan.forEach(function (t) { update_('USERS', t.id, { no_kk: t.no_kk, gang: t.gang, no_rumah: t.no_rumah }); });
  }
  return { hasil: hasil, ok: agBaru.length, gagal: hasil.length - agBaru.length, kkBaru: kkList.length, akunTertaut: tautan.length, tersimpan: !p.cekSaja };
}

function users_list(p, u) {
  return rows_('USERS').filter(function (x) { return u.role !== R.KG || x.gang === u.gang; })
    .sort(function (a, b) { return (a.status === 'menunggu' ? '0' : '1') + a.gang + a.no_rumah > (b.status === 'menunggu' ? '0' : '1') + b.gang + b.no_rumah ? 1 : -1; })
    .map(function (x) {
      var o = safeUser_(x);
      o.ttd = o.ttd ? 'ada' : '';
      if (!isRole_(u, ADMIN_LAYANAN)) o.nik = samarNik_(o.nik);
      return o;
    });
}

function users_simpan(p, u) {
  var cfg = cfg_();
  var role = str_(p.role) || R.WG;
  if (!ROLE_LABEL[role]) throw new Error('Peran tidak valid.');
  var lama = p.id ? get_('USERS', p.id) : null;
  if (p.id && !lama) throw new Error('Akun tidak ditemukan.');
  // Hanya Super Admin yang boleh memberi/mengubah peran pengurus
  if (u.role !== R.SA) {
    if (role !== R.WG && (!lama || lama.role !== role)) throw new Error('Hanya Super Admin yang dapat mengatur peran pengurus.');
    if (lama && lama.role === R.SA) throw new Error('Akun Super Admin hanya dapat diubah oleh Super Admin.');
  }
  if (lama && lama.id === u.id && role !== u.role) throw new Error('Anda tidak dapat mengubah peran akun sendiri.');
  var hp = normHp_(need_(p.no_hp, 'No. HP'));
  var dobel = rows_('USERS').some(function (x) { return normHp_(x.no_hp) === hp && (!lama || x.id !== lama.id); });
  if (dobel) throw new Error('No. HP sudah dipakai akun lain.');
  var gang = str_(p.gang);
  if (role !== R.SA && gangList_(cfg).indexOf(gang) < 0) throw new Error('Pilih blok.');
  if (role === R.KG && !gang) throw new Error('Koordinator blok wajib memiliki blok.');
  var o = {
    nama: str_(need_(p.nama, 'Nama'), 80), no_hp: hp, role: role, gang: gang, no_rumah: normRumah_(p.no_rumah),
    status: ['aktif', 'menunggu', 'nonaktif'].indexOf(p.status) >= 0 ? p.status : 'aktif'
  };
  if (p.no_kk !== undefined) {
    var nkk = normKk_(p.no_kk);
    if (nkk) {
      if (nkk.length !== 16) throw new Error('No. KK harus 16 digit.');
      var kkAda = findBy_('KK', 'no_kk', nkk) || kkBaru_(nkk, o.nama, o.no_rumah, o.gang);
      o.no_kk = nkk; o.gang = kkAda.gang || o.gang; o.no_rumah = kkAda.no_rumah || o.no_rumah;
    } else o.no_kk = '';
  }
  if (lama && lama.id === u.id) o.status = 'aktif';
  if (lama) return safeUser_(update_('USERS', lama.id, o));
  var pin = str_(p.pin) || '123456';
  if (!/^\d{6}$/.test(pin)) throw new Error('PIN harus 6 digit angka.');
  o.id = uid_('U'); o.salt = uid_('s'); o.pin_hash = hash_(o.salt, pin); o.kebangsaan = 'Indonesia'; o.dibuat = now_();
  return safeUser_(insert_('USERS', o));
}

/** No. HP dari Excel sering kehilangan angka 0 di depan atau memakai 62 → dinormalkan ke 08xxx. */
function hpImpor_(v) {
  var hp = String(v === null || v === undefined ? '' : v).replace(/[^0-9]/g, '');
  if (/^62\d{8,13}$/.test(hp)) hp = '0' + hp.slice(2);
  if (/^8\d{7,12}$/.test(hp)) hp = '0' + hp;
  return hp;
}

/**
 * Impor akun warga massal (dari CSV / tempel tabel Excel).
 * p.rows: [{nama, no_hp, gang, no_rumah, nik, jk, role}], p.cekSaja: true = hanya periksa (tidak menyimpan),
 * p.tambahGang: true = gang yang belum terdaftar otomatis ditambahkan ke Pengaturan.
 */
function users_import(p, u) {
  var rows = [].concat(p.rows || []);
  if (!rows.length) throw new Error('Tidak ada data untuk diimpor.');
  if (rows.length > 500) throw new Error('Maksimal 500 baris per impor.');
  var cfg = cfg_();
  var gangAda = gangList_(cfg);
  var gangBaru = [];
  var hpDipakai = {};
  rows_('USERS').forEach(function (x) { hpDipakai[normHp_(x.no_hp)] = x.nama; });
  var pin = str_(p.pin) || '123456';
  if (!/^\d{6}$/.test(pin)) throw new Error('PIN awal harus 6 digit angka.');
  var hasil = [], simpan = [];
  rows.forEach(function (r, i) {
    var res = { baris: i + 1, nama: str_(r.nama, 80), no_hp: hpImpor_(r.no_hp), gang: str_(r.gang, 40), no_rumah: normRumah_(r.no_rumah) };
    try {
      if (!res.nama) throw new Error('Nama kosong');
      if (!/^0\d{8,13}$/.test(res.no_hp)) throw new Error('No. HP tidak valid');
      if (hpDipakai[res.no_hp]) throw new Error('No. HP sudah terdaftar (' + hpDipakai[res.no_hp] + ')');
      if (!res.gang) throw new Error('Blok kosong');
      var g = gangAda.concat(gangBaru).filter(function (x) { return x.toLowerCase() === res.gang.toLowerCase(); })[0];
      if (!g) {
        if (!p.tambahGang || u.role !== R.SA) throw new Error('Blok "' + res.gang + '" belum terdaftar');
        gangBaru.push(res.gang); g = res.gang;
      }
      res.gang = g;
      var role = str_(r.role).toLowerCase() || R.WG;
      var cari = Object.keys(ROLE_LABEL).filter(function (k) { return k === role || ROLE_LABEL[k].toLowerCase() === role; })[0];
      if (!cari) throw new Error('Peran "' + r.role + '" tidak dikenal');
      if (cari === R.SA) throw new Error('Super Admin tidak bisa diimpor');
      if (cari !== R.WG && u.role !== R.SA) throw new Error('Hanya Super Admin yang dapat mengimpor pengurus');
      var nik = str_(r.nik).replace(/\D/g, '');
      if (nik && nik.length !== 16) throw new Error('NIK harus 16 digit');
      var jk = /^p/i.test(str_(r.jk)) ? 'Perempuan' : (/^l/i.test(str_(r.jk)) ? 'Laki-laki' : '');
      res.role = cari;
      res.no_kk = normKk_(r.no_kk);
      if (res.no_kk && res.no_kk.length !== 16) throw new Error('No. KK harus 16 digit');
      hpDipakai[res.no_hp] = res.nama;
      res.status = 'ok';
      var salt = uid_('s');
      simpan.push({
        id: uid_('U'), nama: res.nama, no_hp: res.no_hp, pin_hash: p.cekSaja ? '' : hash_(salt, pin), salt: salt, role: cari,
        gang: g, no_rumah: res.no_rumah, nik: nik, jk: jk, kebangsaan: 'Indonesia', status: 'aktif', dibuat: now_(), no_kk: res.no_kk,
        _hubungan: str_(r.hubungan)
      });
    } catch (e) { res.status = 'gagal'; res.pesan = e.message; }
    hasil.push(res);
  });
  var ok = simpan.length;
  if (!p.cekSaja && ok) {
    if (gangBaru.length) setting_simpan({ DAFTAR_GANG: gangAda.concat(gangBaru).join(',') });
    var agBaru = [], nikAda = {};
    rows_('ANGGOTA').forEach(function (a) { if (a.nik) nikAda[a.nik] = 1; });
    simpan.forEach(function (o) {
      if (!o.no_kk) return;
      var kk = findBy_('KK', 'no_kk', o.no_kk) || kkBaru_(o.no_kk, o.nama, o.no_rumah, o.gang);
      if (o.nik && !nikAda[o.nik]) {
        nikAda[o.nik] = 1;
        var hub = HUBUNGAN.filter(function (x) { return x.toLowerCase() === String(o._hubungan).toLowerCase(); })[0] || (kk.kepala === o.nama ? 'Kepala Keluarga' : 'Lainnya');
        agBaru.push({ id: uid_('AG'), kk_id: kk.id, nik: o.nik, nama: o.nama, hubungan: hub, jk: o.jk, kewarganegaraan: 'Indonesia', user_id: o.id, dibuat: now_() });
      }
    });
    insertMany_('USERS', simpan);
    insertMany_('ANGGOTA', agBaru);
  }
  return { hasil: hasil, ok: ok, gagal: hasil.length - ok, gangBaru: gangBaru, tersimpan: !p.cekSaja };
}

function users_resetPin(p, u) {
  var x = get_('USERS', p.id);
  if (!x) throw new Error('Akun tidak ditemukan.');
  if (x.role === R.SA && u.role !== R.SA) throw new Error('Tidak diizinkan.');
  var salt = uid_('s');
  update_('USERS', x.id, { salt: salt, pin_hash: hash_(salt, '123456') });
  return { pesan: 'PIN ' + x.nama + ' direset ke 123456. Minta warga segera menggantinya.' };
}

function users_hapus(p, u) {
  if (p.id === u.id) throw new Error('Tidak dapat menghapus akun sendiri.');
  remove_('USERS', p.id);
  return true;
}

function setting_get() { return { nilai: cfg_(), kunci: Object.keys(DEFAULT_SETTING), logoBawaan: 'data:image/jpeg;base64,' + LOGO_SIDOARJO_B64 }; }

function setting_simpan(p) {
  var raw = settingsRaw_();
  Object.keys(DEFAULT_SETTING).forEach(function (k) {
    if (p[k] === undefined) return;
    var v;
    if (k === 'LOGO' || k === 'LOGO_PERUMAHAN') {
      v = String(p[k] || '').trim();
      if (v && !LOGO_RE.test(v)) throw new Error('Format logo tidak valid. Gunakan gambar JPG atau PNG.');
      if (v.length > 49000) throw new Error('Ukuran logo terlalu besar. Gunakan gambar yang lebih kecil.');
    } else if (k === 'SEBUTAN_DESA') {
      v = p[k] === 'Kelurahan' ? 'Kelurahan' : 'Desa';
    } else if (k === 'SEBUTAN_KAB') {
      v = p[k] === 'Kota' ? 'Kota' : 'Kabupaten';
    } else v = str_(p[k], 2000);
    var row = rows_('PENGATURAN').filter(function (r) { return r.kunci === k; })[0];
    if (row) {
      if (String(row.nilai) !== v) {
        sheet_('PENGATURAN').getRange(row._row, 2).setValue(store_(v));
        delete _cache.PENGATURAN;
      }
    } else insert_('PENGATURAN', { kunci: k, nilai: v });
  });
  return cfg_();
}

/* ============================================================
 *  LOG AKTIVITAS — siapa masuk & melakukan apa
 *  Dicatat otomatis di api(): login (berhasil/gagal), logout, semua aksi yang mengubah data,
 *  unduhan dokumen/laporan, dan setiap percobaan akses yang ditolak. Data ada di tab LOG.
 * ============================================================ */
var LOG_LABEL = {
  'auth.login': 'Masuk (login)', 'auth.logout': 'Keluar (logout)', 'auth.daftar': 'Daftar akun baru', 'auth.gantiPin': 'Ganti PIN',
  'profil.simpan': 'Ubah profil', 'profil.ttd': 'Simpan tanda tangan',
  'ipl.bayar': 'Catat pembayaran IPL', 'ipl.hapus': 'Batalkan pembayaran IPL', 'ipl.kuitansiPdf': 'Unduh kuitansi PDF',
  'iuran.simpan': 'Simpan iuran kegiatan', 'iuran.hapus': 'Hapus iuran kegiatan', 'iuran.bayar': 'Catat pembayaran iuran', 'iuran.batal': 'Batalkan pembayaran iuran',
  'kas.simpan': 'Simpan transaksi kas', 'kas.hapus': 'Hapus transaksi kas', 'laporan.ipl': 'Unduh rekap IPL', 'laporan.kas': 'Unduh laporan kas',
  'aset.simpan': 'Simpan aset', 'aset.hapus': 'Hapus aset', 'pinjam.ajukan': 'Ajukan pinjam aset', 'pinjam.proses': 'Proses pinjam aset', 'pinjam.batal': 'Batalkan pinjam aset',
  'info.simpan': 'Simpan pengumuman', 'info.hapus': 'Hapus pengumuman',
  'surat.ajukan': 'Ajukan surat pengantar', 'surat.batal': 'Batalkan surat', 'surat.proses': 'Proses surat pengantar', 'surat.dokumen': 'Unduh surat pengantar',
  'lapor.buat': 'Kirim laporan warga', 'lapor.tanggapi': 'Tanggapi laporan warga',
  'vote.pilih': 'Memberi suara e-Vote', 'vote.sesiSimpan': 'Simpan sesi e-Vote', 'vote.sesiHapus': 'Hapus sesi e-Vote', 'vote.kandidatSimpan': 'Simpan kandidat', 'vote.kandidatHapus': 'Hapus kandidat',
  'forum.buat': 'Buat topik diskusi', 'forum.balas': 'Balas diskusi', 'forum.hapus': 'Hapus diskusi',
  'kk.simpan': 'Simpan data KK', 'kk.hapus': 'Hapus data KK', 'kk.import': 'Impor data KK', 'anggota.simpan': 'Simpan anggota keluarga', 'anggota.hapus': 'Hapus anggota keluarga',
  'izin.buka': 'Buka blokir surat (darurat)', 'izin.cabut': 'Cabut izin darurat',
  'users.simpan': 'Simpan akun warga', 'users.import': 'Impor warga', 'users.resetPin': 'Reset PIN warga', 'users.hapus': 'Hapus akun',
  'setting.simpan': 'Ubah pengaturan'
};
// Aksi baca yang tetap dicatat (unduhan dokumen)
var LOG_BACA = { 'ipl.kuitansiPdf': 1, 'laporan.ipl': 1, 'laporan.kas': 1, 'surat.dokumen': 1 };
// Isian yang tidak disimpan ke log (rahasia atau berukuran besar)
var LOG_SKIP = /pin|salt|hash|lama|baru|sandi|token|foto|ttd|logo|gambar|csv|teks|baris|data|jpg|isi$/i;

function catatLog_(action, route, p, user, data, galat) {
  try {
    var ditolak = galat && /tidak memiliki akses|tidak berhak/i.test(galat);
    if (!route.tulis && !LOG_BACA[action] && action !== 'auth.login' && action !== 'auth.logout' && !ditolak) return;
    if ((action === 'laporan.ipl' || action === 'laporan.kas') && !p.format && !galat) return; // pratinjau ringkasan, bukan unduhan
    var u = user || (data && data.user) || null;
    var detail = /^auth\.(gantiPin|daftar)$|^users\.resetPin$/.test(action) ? '' : ringkasPayload_(p);
    if (!u && action === 'auth.login') detail = 'No. HP: ' + str_(p.no_hp, 20);
    if (data && typeof data === 'object' && !galat) {
      var ext = ['kuitansi', 'nomor', 'no_surat'].filter(function (k) { return data[k]; }).map(function (k) { return k + ': ' + data[k]; });
      if (ext.length) detail = (detail ? detail + ' · ' : '') + ext.join(' · ');
    }
    if (galat) detail = (detail ? detail + ' · ' : '') + 'Pesan: ' + galat;
    var sh = sheet_('LOG');
    sh.appendRow([uid_('L'), now_(), u ? u.id : '', store_(u ? u.nama : '(tidak dikenal)'), u ? u.role : '', action,
      store_(LOG_LABEL[action] || action), galat ? (ditolak ? 'ditolak' : 'gagal') : 'berhasil', store_(String(detail).slice(0, 500))]);
    // Batasi ukuran: simpan ±30.000 catatan terakhir
    if (sh.getLastRow() > 30000) sh.deleteRows(2, 5000);
  } catch (e) { }
}

function ringkasPayload_(p) {
  if (!p || typeof p !== 'object') return '';
  var um = null;
  return Object.keys(p).filter(function (k) { return !LOG_SKIP.test(k) && p[k] !== '' && p[k] !== null && p[k] !== undefined; }).map(function (k) {
    var v = p[k];
    if (k === 'user_id' || k === 'warga_id') {
      um = um || userMap_();
      if (um[v]) v = um[v].nama + ' (' + um[v].no_rumah + ')';
    }
    if (Array.isArray(v)) v = v.length > 6 ? v.slice(0, 6).join(', ') + ' … (' + v.length + ')' : v.join(', ');
    else if (typeof v === 'object') v = JSON.stringify(v);
    return k + ': ' + String(v).slice(0, 60);
  }).join(' · ');
}

function log_list(p) {
  var sh = sheet_('LOG');
  var head = SCHEMA.LOG, last = sh.getLastRow();
  var out = [], users = {};
  if (last >= 2) {
    var n = Math.min(last - 1, 8000);
    var vals = sh.getRange(last - n + 1, 1, n, head.length).getValues();
    var dari = str_(p.dari), sampai = str_(p.sampai), uid = str_(p.user_id), hasil = str_(p.hasil), cari = str_(p.cari).toLowerCase();
    for (var i = vals.length - 1; i >= 0; i--) {
      var o = {};
      for (var j = 0; j < head.length; j++) o[head[j]] = cell_(vals[i][j]);
      if (!o.id) continue;
      if (o.user_id) users[o.user_id] = o.nama;
      var t = String(o.waktu).slice(0, 10);
      if (dari && t < dari) continue;
      if (sampai && t > sampai) continue;
      if (uid && o.user_id !== uid) continue;
      if (hasil && o.hasil !== hasil) continue;
      if (cari && (o.nama + ' ' + o.keterangan + ' ' + o.detail + ' ' + o.aksi).toLowerCase().indexOf(cari) < 0) continue;
      if (out.length < 500) out.push(o);
    }
  }
  return {
    list: out, total: Math.max(0, last - 1),
    users: Object.keys(users).map(function (k) { return { id: k, nama: users[k] }; }).sort(function (a, b) { return String(a.nama).localeCompare(String(b.nama)); }),
    label: ROLE_LABEL
  };
}

/**
 * Sekali jalan: istilah "Gang" diganti "Blok" pada data (Pengaturan DAFTAR_GANG, USERS.gang, KK.gang).
 * Contoh "Gang 1" menjadi "Blok 1". Ditandai di ScriptProperties agar tidak diulang.
 */
function migrasiBlok_() {
  var props = PropertiesService.getScriptProperties();
  if (props.getProperty('MIGRASI_BLOK') === '1') return;
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    if (props.getProperty('MIGRASI_BLOK') === '1') return;
    var ganti = function (v) { return String(v).replace(/(^|,\s*)gang(?=\s|$)/gi, '$1Blok'); };
    var kolom = function (name, key) {
      var col = SCHEMA[name].indexOf(key) + 1, sh = sheet_(name);
      rows_(name).forEach(function (r) {
        var baru = ganti(r[key]);
        if (baru !== String(r[key])) sh.getRange(r._row, col).setValue(store_(baru));
      });
      delete _cache[name];
    };
    var col = SCHEMA.PENGATURAN.indexOf('nilai') + 1, sp = sheet_('PENGATURAN');
    rows_('PENGATURAN').forEach(function (r) {
      if (r.kunci !== 'DAFTAR_GANG') return;
      var baru = ganti(r.nilai);
      if (baru !== String(r.nilai)) sp.getRange(r._row, col).setValue(store_(baru));
    });
    delete _cache.PENGATURAN;
    kolom('USERS', 'gang');
    kolom('KK', 'gang');
    SpreadsheetApp.flush();
    props.setProperty('MIGRASI_BLOK', '1');
  } finally { lock.releaseLock(); }
}
