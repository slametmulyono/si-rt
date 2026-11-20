# SiRT 25 — Sistem Informasi RT 25 / RW 05

Desa Gamping, Kec. Krian, Kab. Sidoarjo · Perumahan The Quality Garden Residence
Google Apps Script + Google Sheets, tampilan mobile-first.

## File yang dipasang ke Apps Script

| File di folder ini | Nama file di editor Apps Script |
|---|---|
| `Code.gs` | `Code.gs` |
| `Logo.gs` | `Logo.gs` (logo Kabupaten Sidoarjo, base64) |
| `Index.html` | `Index` (jenis HTML) |

Folder `dev/` dan `logo-sidoarjo.png` **tidak** perlu diunggah. Keduanya hanya untuk preview lokal dan arsip logo.

## Langkah pemasangan

1. Buka https://script.google.com, lalu buat **Proyek baru** dengan nama *SiRT 25 RW 05*.
2. Buat tiga file di atas dan tempel isinya.
3. Di editor, pilih fungsi `setup`, lalu klik **Jalankan** dan izinkan aksesnya.
   - Spreadsheet database "SiRT 25 RW 05 — Database" akan dibuat otomatis di Drive Anda.
   - Akun awal: No. HP `admin`, PIN `123456`. **Segera ganti PIN** di menu Profil.
   - Opsional: jalankan `isiDataContoh` untuk mengisi akun uji coba (PIN `111111`).
4. Klik **Terapkan → Deployment baru → Aplikasi web**.
   - Jalankan sebagai: **Saya**
   - Yang memiliki akses: **Siapa saja**
5. Bagikan URL `/exec` ke warga. Di HP, buka menu browser lalu pilih **Tambahkan ke Layar Utama**.
6. Setiap kali kode diubah, pilih **Kelola deployment → Edit → Versi baru**. Jika tidak, aplikasi tetap memakai kode lama.

## Pengaturan awal (login sebagai Super Admin → menu Pengaturan)
- **Identitas Wilayah & Logo:** isi RT, RW, perumahan, sebutan Desa atau Kelurahan, kecamatan, dan sebutan Kabupaten atau Kota. Logo bisa diganti dengan JPG/PNG (gambar otomatis diperkecil). Tombol **Logo bawaan** mengembalikan logo Sidoarjo. Pratinjau kop surat berubah langsung saat isian diubah, jadi aplikasi ini bisa dipakai RT di daerah lain.
- Isi **Nama Ketua RT** dan **Nama Ketua RW**. Keduanya tercetak di blok tanda tangan surat.
- Atur **Daftar gang**, **Nominal IPL**, dan **Kontak darurat**.
- Buat akun pengurus di menu **Data Warga**, lalu pilih perannya.

## Peran & hak akses

| Fitur | Warga | Koor. Blok | Bendahara | Sekretaris | Ketua RT | Super Admin |
|---|---|---|---|---|---|---|
| Beranda publik (tanpa login) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| IPL milik sendiri & laporan IPL | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Catat pembayaran IPL & iuran kegiatan | – | blok sendiri | semua | lihat | semua | semua |
| Buat iuran kegiatan, batalkan pembayaran, kelola kas | – | – | ✓ | – | ✓ | ✓ |
| Lihat kas RT | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Ajukan surat / laporan / pinjam aset | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Setujui surat, tanggapi laporan, kelola aset & pengumuman | – | lihat gang | – | ✓ | ✓ | ✓ |
| Setujui / tolak pinjam aset & tandai dikembalikan | – | lihat | lihat | lihat | ✓ | ✓ |
| e-Vote (1 KK terdaftar = 1 suara) | ✓ | ✓ | ✓ | ✓ | ✓ | atur sesi + pantau |
| Diskusi warga | tulis | tulis | tulis | tulis | tulis + moderasi | tulis + moderasi |
| Kelola akun warga | – | lihat gang | lihat | ✓ (warga) | ✓ (warga) | ✓ semua peran |
| Pengaturan | – | – | – | – | – | ✓ |
| Log Aktivitas | – | – | – | – | – | ✓ |

Semua hak akses dicek di server, bukan hanya di tampilan. Ketua RT memiliki semua hak Bendahara, sehingga dapat menggantikannya bila berhalangan.

## Data Keluarga (struktur Kartu Keluarga)
- Tab **KK** menyimpan No. KK, kepala keluarga, No. rumah, gang, alamat, dan status tinggal. Tab **ANGGOTA** berisi satu baris per orang dengan kolom mengikuti KK: NIK, nama, hubungan keluarga, jenis kelamin, tempat/tanggal lahir, agama, pendidikan, pekerjaan, golongan darah, status kawin, kewarganegaraan, nama ayah, dan nama ibu.
- Akun aplikasi terhubung ke KK lewat kolom `no_kk` di tab USERS. **Akun dengan No. KK sama dianggap satu keluarga/rumah**:
  - **IPL ditagih per KK.** Pembayaran oleh siapa pun di keluarga itu berlaku untuk semua anggotanya. Pembayaran lama tetap terbaca.
  - **e-Vote: 1 KK = 1 suara.**
  - Gang dan No. rumah akun mengikuti data KK.
- **Warga:** menu **Data Keluarga** → **Daftarkan KK Saya** → tambah anggota keluarga. Warga tidak bisa memakai No. KK yang sudah didaftarkan orang lain; dalam hal itu, pengurus yang menautkannya.
- **Pengurus:** tab **Semua KK** berisi ringkasan jumlah KK, jumlah jiwa, dan akun yang belum ber-KK. Ada tombol **Tambah KK** dan **Impor** dari CSV/Excel (satu baris = satu orang). Kolom `no_hp` menautkan orang ke akunnya. Akun juga bisa ditautkan dari **Data Warga** → isi No. KK. NIK dan No. KK hanya terlihat utuh oleh pemilik KK serta Sekretaris/Ketua/Super Admin; Bendahara dan Koordinator Blok melihat versi tersamar.
- **Surat pengantar:** warga yang sudah ber-KK tinggal memilih "Surat ini untuk" (dirinya atau anggota keluarga), dan datanya terisi otomatis. Data yang diketik di formulir disimpan atau diperbarui ke Data Keluarga.

## Impor warga, foto kandidat, aset
- **Impor warga sekaligus** (Super Admin, Ketua, Sekretaris): buka **Data Warga**, lalu tekan **Impor**. Salin tabel dari Excel atau Google Sheets dan tempel, atau pilih file `.csv`, lalu **Unduh template CSV** bila perlu contoh. Kolom wajib: `nama, no_hp, gang, no_rumah`. Kolom opsional: `nik, jk, peran`. Tekan **Periksa Data** dulu untuk melihat baris yang OK atau bermasalah, lalu **Impor**. Nomor HP berawalan 62 atau tanpa 0 diperbaiki otomatis. Nomor yang sudah terdaftar dilewati. Satu kali impor maksimal 500 baris. Akun pengurus hanya bisa diimpor oleh Super Admin, dan hanya Super Admin yang bisa menambah gang baru otomatis.
- **Peminjaman aset (stok per tanggal):** warga membuka **Aset & Pinjam**, memilih barang, lalu menekan **Pinjam** dan mengisi tanggal pinjam, tanggal kembali, dan jumlah. Stok tersedia pada tanggal itu langsung terlihat, lengkap dengan jadwal pemakaian warga lain (nama hanya terlihat oleh pengurus). Pengajuan yang melebihi stok tidak bisa dikirim. Persetujuan, penolakan, dan tanda **Dikembalikan** hanya bisa dilakukan oleh **Ketua RT & Super Admin**. Pinjaman yang disetujui mengurangi stok pada tanggalnya, sedangkan yang masih menunggu belum mengurangi stok. Pinjaman yang lewat tanggal kembali ditandai **Terlambat** dan tetap mengurangi stok sampai ditandai dikembalikan. Lama pinjam maksimal 30 hari.
- **Foto kandidat e-Vote:** di form kandidat, tekan **Pilih / ambil foto** untuk memakai kamera atau galeri HP. Foto otomatis diperkecil, lalu tampil di kartu kandidat.
- **Aset RT:** tombol **Tambah Aset** tersedia untuk Sekretaris, Ketua, dan Super Admin. Data yang bisa diisi: kode inventaris (otomatis `INV-RT25-001` bila kosong), kategori, jumlah, kondisi, lokasi, penanggung jawab, tanggal perolehan, sumber dana, nilai per unit, foto, dan keterangan. Tombol **Detail** menampilkan foto, seluruh data, stok tersedia/dipinjam, dan riwayat peminjaman. Nama peminjam hanya terlihat oleh pengurus. Di bagian atas ada ringkasan jumlah jenis, unit, dan nilai aset, serta pencarian dan filter kategori.
- Kolom baru (foto, detail aset) ditambahkan otomatis ke tab Sheets yang lama, jadi `setup()` tidak perlu dijalankan ulang.

## e-Vote: hak suara hanya untuk KK terdaftar
- Selama pemilihan dibuka, **calon beserta foto, nomor urut, serta visi & misi tampil di beranda publik**, sehingga bisa dilihat semua orang, termasuk yang belum punya akun. Hasil suara tidak ditampilkan di sana. Di menu e-Vote, visi & misi juga tampil dalam kotak tersendiri untuk semua warga yang login.
- Saat pemilihan sudah dibuka, Super Admin tetap bisa melengkapi atau mengubah **visi & misi** lewat tombol **Isi Visi & Misi** di kartu calon. Nama, nomor urut, dan foto tetap terkunci.
- Warga baru punya hak suara bila akunnya terhubung ke No. KK yang sudah ada di **Data Keluarga**. Satu KK = satu suara. Warga tanpa KK terdaftar melihat pesan dan tombol menuju Data Keluarga; server juga menolak suaranya. Jumlah pemilih (partisipasi) dihitung dari KK terdaftar.

## Istilah Blok, loading ringan, layar penuh
- Istilah "Gang" di semua tampilan, laporan, dan pesan diganti **"Blok"**. Data lama ikut diganti otomatis sekali saat aplikasi pertama dibuka setelah update: "Gang 1" menjadi "Blok 1" di Pengaturan, akun warga, dan data KK. Nama blok bisa diatur di Pengaturan, dan kolom impor boleh bernama `blok` atau `gang`.
- Tampilan tidak lagi memakai Tailwind CDN (yang dikompilasi di HP setiap kali dibuka), tetapi CSS siap pakai ±23 KB di dalam halaman. Logo (±50 KB) dikirim sekali lalu disimpan di HP. Halaman disajikan tanpa proses template.
- Di HP, ketukan pertama membuat aplikasi masuk layar penuh bila browser mengizinkan (umumnya Chrome Android; iPhone tidak mendukung). Agar selalu tanpa bilah browser, pakai menu browser **Tambahkan ke Layar Utama**.

## Bayar IPL di muka (tanpa batas tahun)
- Di **Iuran IPL → Catat Pembayaran**, satu pencatatan boleh mencakup bulan lintas tahun. Pakai tab tahun (tombol **+** menambah tahun berikutnya tanpa batas), **Semua bulan tahun ini**, atau **Lunasi sampai bulan …**. Opsi terakhir memilih semua bulan yang belum lunas sejak awal IPL berlaku (Pengaturan → IPL_MULAI) sampai bulan yang dipilih.
- Tanggal bayar selalu tanggal saat pembayaran dicatat. Semua bulan mendapat satu nomor kuitansi; kuitansi dan pesan WA meringkas per tahun (mis. "2026–2028: Jan–Des").
- Pilihan tahun di menu IPL dapat digeser ke tahun mana pun dengan tombol ‹ ›.

## Kuitansi pembayaran IPL (A6)
- Setiap kali pengurus mencatat pembayaran IPL (di **Iuran IPL → Catat Pembayaran**, dengan bentuk pembayaran **Tunai/Transfer**), sistem otomatis menerbitkan **No. Kuitansi** `KW/RT{RT}/{tahun}/0001`. Nomor ini urut per tahun, dan satu nomor berlaku untuk semua bulan yang dibayar sekaligus.
- Kuitansi berukuran **A6 (10,5 × 14,8 cm)**. Kopnya memakai data lingkungan dari Pengaturan: **logo perumahan** (unggah di Pengaturan → "Logo perumahan"; bila kosong dipakai logo RT), RT/RW, desa, kecamatan, dan kabupaten. Isinya: nama, rumah/gang, No. WA, centang bulan, Tunai/Transfer, jumlah dan terbilang, cap LUNAS, serta **tanda tangan dan nama petugas yang mencatat**.
- **Tanda tangan petugas:** setiap pengurus menggambarnya sekali di **Profil → Tanda Tangan Digital**.
- Keluaran: **Unduh JPG**, **Unduh PDF** (A6, sudah diverifikasi dengan `cekKuitansiPdf`), **Bagikan** (bila HP mendukung), dan **Kirim pesan WA** ke nomor warga, lalu lampirkan JPG/PDF-nya.
- Kuitansi bisa dibuka ulang oleh pengurus dengan mengetuk kotak hijau di matriks IPL, dan oleh warga dengan mengetuk bulan yang sudah lunas di **Iuran Saya**. Warga lain tidak bisa membukanya.

## Iuran Kegiatan (17-an, syukuran, sumbangan, dll.)
- Menu **Iuran Kegiatan** dipakai untuk iuran di luar IPL. Pengurus kas (Bendahara/Ketua/SA) membuat jenis iuran: nama, nominal per keluarga, sifat **wajib** atau **sukarela**, tanggal kegiatan, dan keterangan.
- Buka iuran → daftar keluarga (per KK, bisa difilter per gang) → ketuk warga → **Catat Bayar** (nominal bisa diubah untuk sukarela, Tunai/Transfer). Satu keluarga hanya tercatat sekali per iuran. Koordinator gang dapat mencatat warga gangnya saja.
- Setiap pembayaran otomatis masuk **Kas RT** (kategori = nama iuran) dan mendapat kuitansi A6 bernomor `KI/RT{RT}/{tahun}/0001`, dengan JPG/PDF/WA seperti kuitansi IPL.
- Membatalkan pembayaran juga menghapus baris kasnya. Iuran yang sudah punya pembayaran tidak bisa dihapus; tandai **Selesai** untuk menutupnya. Rekap per iuran bisa diunduh ke Excel.
- Warga melihat daftar iuran beserta status pembayarannya sendiri, dan bisa membuka kuitansinya.

## Log Aktivitas (khusus Super Admin)
- Menu **Log Aktivitas** mencatat siapa masuk dan melakukan apa. Dicatat otomatis di server: login berhasil/gagal (dengan No. HP yang dicoba), logout, semua aksi yang mengubah data, unduhan surat/laporan/kuitansi PDF, dan setiap percobaan membuka fitur tanpa hak (hasil **ditolak**).
- Setiap catatan berisi waktu, nama, peran, aktivitas, hasil, dan ringkasan isian (mis. nominal, periode, nama warga). PIN, foto, tanda tangan, dan logo tidak pernah dicatat.
- Bisa disaring per tanggal, pengguna, hasil, dan kata kunci, lalu diunduh ke Excel. Data lengkap tersimpan di tab **LOG** spreadsheet; sistem menyimpan ±30.000 catatan terakhir.

## Unduh laporan (Excel & PDF)
Menu **Unduh Laporan** hanya untuk **Super Admin, Ketua, Sekretaris, dan Bendahara**. Tombol pintasnya juga ada di halaman Kas RT dan tab Laporan IPL.
- **Rekap IPL seluruh warga**, dihitung per KK:
  - **Mingguan:** pembayaran yang diterima dalam minggu Senin–Minggu, berdasarkan tanggal bayar, beserta total per hari.
  - **Bulanan:** status lunas atau belum semua keluarga untuk satu bulan tagihan, lengkap dengan tanggal bayar dan pencatatnya.
  - **Tahunan:** matriks Januari–Desember per keluarga, dengan total dan tunggakan.
- **Laporan Keuangan Kas RT** dengan pilihan **Mingguan, Bulanan, Tahunan, atau rentang tanggal sendiri**. Isinya saldo awal, rincian transaksi dengan saldo berjalan, total, saldo akhir, dan ringkasan per kategori.
- **PDF:** memakai kop RT dan kolom tanda tangan Ketua RT serta Bendahara. **Excel (.xlsx):** dibuat di browser dengan SheetJS dari cdnjs, sehingga butuh internet saat mengunduh.
- **Warga** hanya bisa melihat halaman Kas RT tanpa tombol unduh. Server juga menolak permintaan unduh dari peran selain empat peran di atas.

## Grafik kas di dashboard
Beranda (setelah login) menampilkan grafik **Pemasukan & Pengeluaran RT** untuk semua akun, dengan tab **Tahunan / Bulanan / Mingguan**. Ketuk batang untuk melihat rincian (pemasukan, pengeluaran, selisih), lalu tekan **Lihat per bulan ›** atau **Lihat per minggu ›** untuk turun satu jenjang. Pilihan tahun dan bulan ada di bawah tab. Minggu dihitung per tanggal 1–7, 8–14, 15–21, 22–28, dan 29–akhir bulan. Data diambil dari Kas RT, termasuk IPL yang tercatat otomatis. Tersedia juga tampilan **Lihat tabel**.

## Surat pengantar
- Format surat mengikuti template Google Docs *Surat Pengantar RW* (`1k9RHx1aDCAQ5muvZLqUeIDOv0tUEF8OLnC7m1whJOpc`): kop dengan logo Sidoarjo, data diri dengan kotak centang, 14 pilihan keperluan, keterangan, serta tanda tangan pemohon, Ketua RW, dan Ketua RT. Kop menampilkan **Rukun Tetangga 25 – Rukun Warga 05**. Dua salah ketik di template diperbaiki: "laim-lain" menjadi "lain-lain" dan "unutk" menjadi "untuk".
- Alurnya: warga mengisi formulir → Sekretaris, Ketua, atau Super Admin menekan **Setujui** → nomor otomatis terbit (`001/RT.25/RW.05/X/2026`) → warga **Unduh PDF** atau **Cetak** → surat dibawa ke Ketua RT untuk tanda tangan dan stempel basah.
- **Syarat lunas IPL:** warga yang masih punya tunggakan IPL tidak bisa mengajukan surat. Tombol "Ajukan" terkunci dan muncul daftar bulan yang belum dibayar, dan server juga menolak pengajuannya. Tunggakan dihitung dari bulan **IPL_MULAI** (kosong berarti Januari tahun berjalan) sampai bulan berjalan. Aturan ini bisa dimatikan di Pengaturan ("Wajib lunas IPL..." = tidak). Super Admin dikecualikan karena tidak punya tagihan IPL.
- **Izin darurat:** Ketua RT dan Super Admin dapat membuka blokir untuk satu warga lewat **Data Warga → pilih warga → Buka Blokir Surat (Darurat)**. Alasan wajib diisi, dan izin berlaku untuk **1 kali pengajuan** dalam 1, 3, atau 7 hari. Izin bisa dicabut kapan saja, dan kembali berlaku jika pengajuannya dibatalkan warga. Tunggakan tetap tercatat. Surat yang memakai izin ini diberi label "Izin darurat" di daftar surat, dan semua riwayatnya tersimpan di tab `IZIN_SURAT` (tab ini dibuat otomatis).
- **Nomor & tanggal surat:** nomor urut berlanjut sepanjang tahun dan kembali ke 001 di tahun baru. Nomor diberikan saat surat disetujui, tetapi bulan (romawi) dan tahunnya mengikuti **tanggal pengajuan**. Tanggal surat ("Gamping, …") juga otomatis diisi tanggal pengajuan.
- PDF dibuat langsung di server setiap kali diunduh, jadi tidak ada file surat yang dibagikan di Drive. Data NIK hanya bisa dilihat pemohon dan pengurus layanan.

## Preview lokal (tanpa Google)
```bash
node dev/server.js 8810
```
Buka http://localhost:8810. Server ini menjalankan `Code.gs` asli dengan tiruan Google Sheets, dan datanya disimpan di `dev/db.json`. Unduh PDF hanya berfungsi setelah di-deploy. Di preview, gunakan tombol **Cetak**.

Akun uji di preview: `admin` / `123456`, Ketua `081200000001`, Sekretaris `…02`, Bendahara `…03`, Koordinator Blok 2 `…04`, Warga `…05` dan `…06`. Semua akun selain admin memakai PIN `111111`.

## Catatan teknis
- Di dalam `<script>` pada `Index.html` tidak boleh ada `//` atau `/*`, termasuk di dalam string, karena HtmlService memangkas komentar secara naif. Untuk mengecek:
  `python3 -c "import re;s=open('Index.html').read();[print(l) for sc in re.findall(r'<script>(.*?)</script>',s,re.S) for l in sc.split('\n') if '//' in l or '/*' in l]"`
- Teks seperti No. HP, NIK, dan periode disimpan dengan awalan `'` agar Sheets tidak mengubahnya menjadi angka atau tanggal.
- e-Vote: daftar rumah yang sudah memilih (`VOTE_PEMILIH`) disimpan terpisah dari jumlah suara (`VOTE_HASIL`), sehingga pilihan tidak bisa dilacak ke rumah tertentu.
