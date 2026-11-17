# GudangLingling AI
### Intelligent Household Asset Lending & Risk Triage Chatbot

> **Judul Akademik:** Sistem Pakar Chatbot untuk Rekomendasi Peminjaman, Diagnosis Kelayakan Teknis, dan Triase Risiko Keselamatan Peralatan Rumah Tangga Menggunakan Integrasi State-Space Representation, Forward Chaining, Certainty Factor, dan Heuristic Risk Evaluation.

---

## Identitas Pengembang & Proyek
- **Pengembang:** Liana Sry Astuti
- **NIM:** 2422031
- **Program Studi:** Teknik Komputer
- **Perguruan Tinggi:** Institut Teknologi Batam (ITEBA)
- **Mata Kuliah:** Artificial Intelligence (Kecerdasan Buatan)
- **Dosen Pengampu:** Bapak Deosa Putra Caniago, M.Kom (NIDN. 1003129101)

---

## Latar Belakang & Konsep Zero-Friction
Meminjamkan perkakas rumah tangga (terutama perkakas listrik bertorsi tinggi seperti mesin gerinda tangan, bor listrik impact, gergaji mesin, hingga tangga lipat) memiliki risiko kecelakaan kerja dan kerusakan alat yang tinggi jika tidak didahului pengecekan kelayakan komponen fisik maupun profil keamanan peminjam.

**GudangLingling AI** menghadirkan sistem pakar virtual berbasis **Mobile-First Conversational Web App** dengan konsep *zero-friction*:
1. **Tanpa instalasi aplikasi rumit** bagi tetangga/keluarga peminjam (cukup buka peramban smartphone/desktop).
2. **Pengecekan teknis terpandu** layaknya percakapan chat interaktif dengan visual minimalis dan profesional (tanpa elemen dekoratif tidak esensial).
3. **Pemberitahuan otomatis via WhatsApp (Click-to-Chat)** berisikan bukti peminjaman digital dan instruksi keselamatan APD.
4. **Fitur Penguncian Otomatis (Lockout Karantina)** jika alat terdeteksi mengalami bahaya fatal kelistrikan (Zona Merah).

---

## Integrasi Tiga Modul Perkuliahan AI

### 1. Modul 3.2 — State-Space Representation (Pemodelan Ruang Keadaan)
Alur percakapan dan status sistem dimodelkan sebagai tuple formal:
$$\mathcal{S} = \langle Q, \Sigma, \delta, s_0, G \rangle$$

- **Q (Himpunan State):**
  - $S_0$ (`AUTH_PIN`): Autentikasi PIN keluarga (Default: `2422031`).
  - $S_1$ (`SELECT_ITEM`): Pemilihan alat dan data peminjam.
  - $S_2$ (`PHYSICAL_CHECK`): Pengecekan kondisi komponen fisik alat ($F_{01} - F_{12}$).
  - $S_3$ (`BORROWER_CHECK`): Triase profil peminjam & medan kerja ($F_{13} - F_{20}$).
  - $S_4$ (`INFERENCE_CALC`): Komputasi Forward Chaining, CF Combine, dan skor $h(S)$.
  - $G$ (`DECISION_ACTION`): Tampilan zona keputusan, rekomendasi APD, dan integrasi WhatsApp.
- **$\Sigma$:** Masukan nilai keyakinan pengguna $CF_{\text{user}} \in [0.0, 1.0]$.
- **$\delta$:** Fungsi transisi status $\delta(S_i, \text{input}) \to S_{i+1}$.

---

### 2. Modul 6.7 — Forward Chaining & Certainty Factor (Mesin Inferensi & Ketidakpastian)
Forward Chaining mencocokkan fakta aktif pada working memory dengan premis kaidah produksi ($R_{01} - R_{15}$).

- **Perhitungan CF Kaidah Tunggal:**
  $$CF(H, E) = CF(E) \times CF_{\text{pakar}}$$
  dengan $CF(E) = \min(CF_{\text{user}})$ untuk operator `AND`, atau $\max(CF_{\text{user}})$ untuk operator `OR`.

- **Kombinasi CF Sejenis ($CF_{\text{combine}}$):**
  $$CF_{\text{combine}}(CF_1, CF_2) = CF_1 + CF_2 \times (1 - CF_1) \quad (\text{untuk } CF_1, CF_2 > 0)$$

- **Tingkat Keyakinan Akhir:**
  $$\text{Persentase} = CF_{\text{combine}} \times 100\%$$

---

### 3. Modul 4.5 — Heuristic Risk Evaluation Function (Triase Risiko Keselamatan)
Fungsi heuristik mengevaluasi total bobot bahaya:
$$h(S) = \min\left(100, \sum_{i \in \text{Fakta Terdeteksi}} w_i \times CF_{\text{user}}(F_i)\right)$$

- **Critical Red Flag Override:** Jika terdeteksi fakta kritis fatal ($F_{01}, F_{04}, F_{06}, F_{17}$) dengan $CF_{\text{user}} \ge 0.6$, sistem otomatis mengeset $h(S) \ge 80$.
- **Klasifikasi Tiga Zona Keputusan:**
  1. **Zona Hijau ($h(S) < 30$):** Layak Dipinjamkan. Status alat `AVAILABLE` $\to$ `BORROWED`.
  2. **Zona Kuning ($30 \le h(S) < 70$):** Peminjaman Bersyarat / Wajib APD.
  3. **Zona Merah ($h(S) \ge 70$):** Ditolak / Karantina Perbaikan. Status alat otomatis diubah menjadi `MAINTENANCE_LOCKED`.

---

## Ruang Lingkup Basis Pengetahuan (Knowledge Base)

### 5 Keputusan Utama ($K_{01} - K_{05}$)
- **K01:** Layak Pakai Optimal (Siap digunakan tanpa kendala teknis).
- **K02:** Degradasi Komponen Mekanis (Mata tumpul, pelumas kering, butuh servis ringan).
- **K03:** Risiko Bahaya Fatal Kelistrikan / Kerusakan Kritis (Kabel terkelupas, motor memercik, nyetrum).
- **K04:** Ketidaksesuaian Profil Peminjam / Beban Kerja Berlebih (Pemula tanpa APD / di bawah umur).
- **K05:** Rekomendasi Alat Alternatif Tepat Guna (Dialihkan ke obeng baterai atau perkakas manual).

### 20 Indikator Fakta ($F_{01} - F_{20}$) & Bobot Risiko ($w_i$)
- $F_{01}$: Kabel daya terkelupas ($w = 35$) [Red Flag]
- $F_{02}$: Steker goyang / gosong ($w = 30$)
- $F_{03}$: Motor listrik memercik api / bau sangit ($w = 35$) [Red Flag]
- $F_{04}$: Bodi alat mengalirkan induksi sengatan listrik ($w = 40$) [Red Flag]
- $F_{05}$: Mata pisau / bor tumpul ($w = 15$)
- $F_{06}$: Piringan gerinda / mata gergaji retak sumbing ($w = 35$) [Red Flag]
- $F_{07}$: Baut pengunci bilah / chuck bor longgar ($w = 25$)
- $F_{08}$: Pelindung keamanan (safety guard) dilepas ($w = 30$)
- $F_{09}$: Engsel tangga goyang / aus ($w = 35$)
- $F_{10}$: Suara bearing berdecit kasar ($w = 15$)
- $F_{11}$: Tuas pengaman (dead man's switch) macet/diganjal ($w = 35$) [Red Flag]
- $F_{12}$: Tombol On/Off macet di posisi ON ($w = 30$) [Red Flag]
- $F_{13}$: Peminjam pemula belum pernah pakai alat ini ($w = 25$)
- $F_{14}$: Peminjam tidak memakai APD ($w = 20$)
- $F_{15}$: Penggunaan di area lembab / basah / hujan ($w = 35$)
- $F_{16}$: Beban kerja melampaui batas alat ($w = 25$)
- $F_{17}$: Peminjam anak-anak / di bawah umur ($w = 40$) [Red Flag]
- $F_{18}$: Durasi maraton tanpa pendinginan mesin ($w = 15$)
- $F_{19}$: Bekerja di ketinggian $>3$ meter ($w = 25$)
- $F_{20}$: Kebutuhan pekerjaan mikro / estetika ($w = 5$)

### 15 Kaidah Produksi ($R_{01} - R_{15}$)
- **R01:** IF ($F_{01}$ OR $F_{04}$) THEN $K_{03}$ ($CF = 0.95$)
- **R02:** IF ($F_{02}$ AND $F_{03}$) THEN $K_{03}$ ($CF = 0.90$)
- **R03:** IF ($F_{05}$ AND $F_{10}$) THEN $K_{02}$ ($CF = 0.85$)
- **R04:** IF ($F_{06}$) THEN $K_{03}$ ($CF = 0.95$)
- **R05:** IF ($F_{07}$ AND $F_{08}$) THEN $K_{02}$ ($CF = 0.80$)
- **R06:** IF ($F_{09}$ AND $F_{19}$) THEN $K_{03}$ ($CF = 0.90$)
- **R07:** IF ($F_{11}$ OR $F_{12}$) THEN $K_{03}$ ($CF = 0.85$)
- **R08:** IF ($F_{13}$ AND $F_{14}$) THEN $K_{04}$ ($CF = 0.85$)
- **R09:** IF ($F_{15}$ AND $F_{01}$) THEN $K_{03}$ ($CF = 0.98$)
- **R10:** IF ($F_{13}$ AND $F_{16}$) THEN $K_{04}$ ($CF = 0.80$)
- **R11:** IF ($F_{17}$) THEN $K_{04}$ ($CF = 0.99$)
- **R12:** IF ($F_{20}$ AND $F_{13}$) THEN $K_{05}$ ($CF = 0.85$)
- **R13:** IF ($F_{16}$ AND $F_{05}$) THEN $K_{05}$ ($CF = 0.75$)
- **R14:** IF [Semua indikator normal] THEN $K_{01}$ ($CF = 0.95$)
- **R15:** IF ($F_{05}$) THEN $K_{02}$ ($CF = 0.75$)

---

## Panduan Instalasi & Hosting (Windows & Linux)

Aplikasi dibangun menggunakan **Python 3 Standard Library (Zero-Dependency)**. Tidak membutuhkan `pip install` paket pihak ketiga, sehingga dapat langsung di-host di Windows Server, Linux (Ubuntu/Debian/CentOS), atau macOS.

### Opsi A: Instalasi di Linux / macOS
Gunakan skrip installer otomatis:
```bash
chmod +x install.sh
./install.sh
```
Skrip ini akan:
1. Memverifikasi ketersediaan Python 3.8+.
2. Memeriksa ketersediaan pustaka stdlib.
3. Menginisialisasi basis data SQLite.
4. Membuat skrip eksekusi `start.sh`.
5. Menawarkan registrasi sebagai **systemd service** (opsional) agar aplikasi otomatis menyala saat server reboot.

Untuk menjalankan manual:
```bash
python3 run.py
# atau: ./start.sh
```

### Opsi B: Instalasi di Windows
1. Klik dua kali file `install.bat`.
2. Installer akan:
   - Mendeteksi Python di sistem.
   - Menginisialisasi basis data.
   - Membuat file `start.bat`.
   - Menawarkan pembuatan shortcut di Desktop.
   - Menawarkan registrasi ke **Windows Task Scheduler** (auto-start saat login).
3. Setelah selesai, cukup klik dua kali shortcut di Desktop atau `start.bat`.

---

## Pengujian & Verifikasi Akademik

```bash
# Menjalankan 10 test case unit & integrasi
python3 run.py test

# Menjalankan laporan simulasi 5 skenario akademik lengkap dengan perhitungan CF step-by-step
python3 run.py simulate

# Mereset dan mengisi ulang basis data alat awal
python3 run.py seed
```

**URL Akses:** `http://127.0.0.1:8085`  
**PIN Default Keluarga:** `2422031` (NIM Liana Sry Astuti)
